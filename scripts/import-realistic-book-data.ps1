param(
  [string]$ApiUrl = "http://localhost:8080",
  [int]$TargetCopies = 48
)

$ErrorActionPreference = "Stop"

$password = "password123"
$coverDir = Join-Path $PSScriptRoot "api-covers"

Add-Type -AssemblyName System.Net.Http

function Wait-Backend {
  param([string]$BaseUrl)

  for ($attempt = 1; $attempt -le 30; $attempt++) {
    try {
      Invoke-RestMethod -Uri "$BaseUrl/ping" -Method Get | Out-Null
      return
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  throw "Backend belum siap di $BaseUrl."
}

function Invoke-Json {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Body,
    [string]$Token = ""
  )

  $headers = @{}
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $json = $null
  if ($null -ne $Body) {
    $json = $Body | ConvertTo-Json -Depth 8
  }

  return Invoke-RestMethod -Uri $Url -Method $Method -Headers $headers -ContentType "application/json" -Body $json
}

function Register-Or-Login {
  param(
    [string]$Name,
    [string]$Email,
    [string]$City
  )

  try {
    Invoke-Json -Method "Post" -Url "$ApiUrl/api/register" -Body @{
      name = $Name
      email = $Email
      password = $password
      city = $City
    } | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 409) {
      throw
    }
  }

  $login = Invoke-Json -Method "Post" -Url "$ApiUrl/api/login" -Body @{
    email = $Email
    password = $password
  }

  return @{
    id = [int]$login.user.id
    name = $login.user.name
    email = $login.user.email
    token = $login.token
  }
}

function ConvertTo-Slug {
  param([string]$Value)

  $slug = $Value.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
  $slug = $slug.Trim("-")
  if (-not $slug) {
    return "book"
  }

  return $slug
}

function Download-Image {
  param(
    [string]$Url,
    [string]$Path
  )

  if (-not $Url) {
    return $null
  }

  $cached = Get-Item -Path $Path -ErrorAction SilentlyContinue
  if ($cached -and $cached.Length -gt 2048) {
    return $Path
  }

  try {
    $headers = @{ "User-Agent" = "UniLibra catalog importer" }
    $safeUrl = ($Url -replace "^http://", "https://") -replace "zoom=1", "zoom=2"
    Invoke-WebRequest -Uri $safeUrl -Headers $headers -OutFile $Path -TimeoutSec 14 | Out-Null
    $file = Get-Item -Path $Path -ErrorAction Stop
    if ($file.Length -lt 2048) {
      Remove-Item -LiteralPath $Path -ErrorAction SilentlyContinue
      return $null
    }

    return $Path
  } catch {
    Remove-Item -LiteralPath $Path -ErrorAction SilentlyContinue
    return $null
  }
}

function Get-GoogleBook {
  param(
    [string]$Title,
    [string]$Author,
    [int]$VariantIndex
  )

  try {
    $query = "intitle:$Title"
    if ($Author) {
      $query = "$query inauthor:$Author"
    }

    $searchUrl = "https://www.googleapis.com/books/v1/volumes?q=$([uri]::EscapeDataString($query))&maxResults=20&printType=books"
    $result = Invoke-RestMethod -Uri $searchUrl -Method Get -TimeoutSec 10
    $items = @($result.items | Where-Object {
      $_.volumeInfo.title -and ($_.volumeInfo.imageLinks.thumbnail -or $_.volumeInfo.imageLinks.smallThumbnail)
    })
    $normalizedSeedTitle = (ConvertTo-Slug -Value $Title)
    $items = @($items | Where-Object {
      $normalizedTitle = ConvertTo-Slug -Value ([string]$_.volumeInfo.title)
      $rawTitle = [string]$_.volumeInfo.title
      $normalizedTitle -like "*$normalizedSeedTitle*" `
        -and $normalizedTitle -notlike "*collection-set*" `
        -and $normalizedTitle -notlike "*text-in-russian*" `
        -and $normalizedTitle -notlike "*reasons-to-stay-alive*" `
        -and $normalizedTitle -notlike "*boxed-set*" `
        -and $normalizedTitle -notlike "*calendar*" `
        -and $normalizedTitle -notlike "*published-by*" `
        -and $normalizedTitle -notlike "*hardcover*" `
        -and $normalizedTitle -notlike "*was-ist*" `
        -and $normalizedTitle -notlike "*trilogy*" `
        -and $normalizedTitle -notlike "*graphic-novel*" `
        -and $normalizedTitle -notlike "*workbook*" `
        -and $normalizedTitle -notlike "*sparknotes*" `
        -and $normalizedTitle -notlike "*adaptation*" `
        -and $normalizedTitle -notlike "*for-teens*" `
        -and $normalizedTitle -notlike "*digital-age*" `
        -and $normalizedTitle -notlike "*mathematical-mindsets*" `
        -and $normalizedTitle -notlike "*we-re-all-wonders*" `
        -and $normalizedTitle -notlike "*a-day-with-the-little-prince*" `
        -and $rawTitle -notlike "*/*" `
        -and $rawTitle -notlike "*[*" `
        -and $rawTitle.Length -le 78
    })

    if ($items.Count -eq 0) {
      return $null
    }

    $item = $items[($VariantIndex - 1) % $items.Count]
    $info = $item.volumeInfo
    $imageUrl = $info.imageLinks.thumbnail
    if (-not $imageUrl) {
      $imageUrl = $info.imageLinks.smallThumbnail
    }

    $slug = ConvertTo-Slug -Value "$Title-$Author-google-$VariantIndex"
    $coverPath = Download-Image -Url $imageUrl -Path (Join-Path $coverDir "$slug.jpg")
    if (-not $coverPath) {
      return $null
    }

    $authors = @($info.authors)
    $categories = @($info.categories)
    return @{
      title = if ($info.title) { [string]$info.title } else { $Title }
      author = if ($authors.Count -gt 0) { [string]($authors -join ", ") } else { $Author }
      description = if ($info.description) { [string]$info.description } else { "" }
      category = if ($categories.Count -gt 0) { [string]$categories[0] } else { "" }
      cover = $coverPath
    }
  } catch {
    return $null
  }
}

function Get-OpenLibraryBook {
  param(
    [string]$Title,
    [string]$Author,
    [int]$VariantIndex
  )

  try {
    $searchUrl = "https://openlibrary.org/search.json?title=$([uri]::EscapeDataString($Title))&author=$([uri]::EscapeDataString($Author))&limit=20"
    $result = Invoke-RestMethod -Uri $searchUrl -Method Get -TimeoutSec 10
    $matches = @($result.docs | Where-Object { $_.cover_i } | Select-Object -First 20)
    $normalizedSeedTitle = (ConvertTo-Slug -Value $Title)
    $matches = @($matches | Where-Object {
      $normalizedTitle = ConvertTo-Slug -Value ([string]$_.title)
      $rawTitle = [string]$_.title
      $normalizedTitle -like "*$normalizedSeedTitle*" `
        -and $normalizedTitle -notlike "*collection-set*" `
        -and $normalizedTitle -notlike "*text-in-russian*" `
        -and $normalizedTitle -notlike "*reasons-to-stay-alive*" `
        -and $normalizedTitle -notlike "*boxed-set*" `
        -and $normalizedTitle -notlike "*calendar*" `
        -and $normalizedTitle -notlike "*published-by*" `
        -and $normalizedTitle -notlike "*hardcover*" `
        -and $normalizedTitle -notlike "*was-ist*" `
        -and $normalizedTitle -notlike "*trilogy*" `
        -and $normalizedTitle -notlike "*graphic-novel*" `
        -and $normalizedTitle -notlike "*workbook*" `
        -and $normalizedTitle -notlike "*sparknotes*" `
        -and $normalizedTitle -notlike "*adaptation*" `
        -and $normalizedTitle -notlike "*for-teens*" `
        -and $normalizedTitle -notlike "*digital-age*" `
        -and $normalizedTitle -notlike "*mathematical-mindsets*" `
        -and $normalizedTitle -notlike "*we-re-all-wonders*" `
        -and $normalizedTitle -notlike "*a-day-with-the-little-prince*" `
        -and $rawTitle -notlike "*/*" `
        -and $rawTitle -notlike "*[*" `
        -and $rawTitle.Length -le 78
    })
    if ($matches.Count -eq 0) {
      return $null
    }

    $match = $matches[($VariantIndex - 1) % $matches.Count]
    $slug = ConvertTo-Slug -Value "$Title-$Author-openlibrary-$VariantIndex"
    $coverPath = Download-Image -Url "https://covers.openlibrary.org/b/id/$($match.cover_i)-L.jpg" -Path (Join-Path $coverDir "$slug.jpg")
    if (-not $coverPath) {
      return $null
    }

    return @{
      title = if ($match.title) { [string]$match.title } else { $Title }
      author = if ($match.author_name -and $match.author_name.Count -gt 0) { [string]($match.author_name -join ", ") } else { $Author }
      description = ""
      category = ""
      cover = $coverPath
    }
  } catch {
    return $null
  }
}

function Get-BookMetadata {
  param(
    [string]$Title,
    [string]$Author,
    [int]$VariantIndex
  )

  $google = Get-GoogleBook -Title $Title -Author $Author -VariantIndex $VariantIndex
  if ($google) {
    return $google
  }

  return Get-OpenLibraryBook -Title $Title -Author $Author -VariantIndex $VariantIndex
}

function Get-MediaType {
  param([string]$Filename)

  switch ([System.IO.Path]::GetExtension($Filename).ToLowerInvariant()) {
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".webp" { return "image/webp" }
    default { return "image/png" }
  }
}

function New-Book {
  param(
    [hashtable]$Owner,
    [hashtable]$Book
  )

  $client = New-Object System.Net.Http.HttpClient
  $client.DefaultRequestHeaders.Authorization = New-Object System.Net.Http.Headers.AuthenticationHeaderValue "Bearer", $Owner.token
  $content = New-Object System.Net.Http.MultipartFormDataContent
  $stream = $null

  try {
    $fields = @{
      title = $Book.title
      author = $Book.author
      category = $Book.category
      theme = $Book.theme
      condition = $Book.condition
      location = $Book.location
      max_duration = $Book.max_duration
      handover = $Book.handover
      rental_price = [string]$Book.rental_price
      description = $Book.description
      latitude = [string]$Book.latitude
      longitude = [string]$Book.longitude
    }

    foreach ($key in $fields.Keys) {
      $content.Add((New-Object System.Net.Http.StringContent ([string]$fields[$key])), $key)
    }

    $stream = [System.IO.File]::OpenRead($Book.cover)
    $fileContent = New-Object System.Net.Http.StreamContent $stream
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse((Get-MediaType -Filename $Book.cover))
    $content.Add($fileContent, "cover", [System.IO.Path]::GetFileName($Book.cover))

    $response = $client.PostAsync("$ApiUrl/api/books", $content).Result
    $body = $response.Content.ReadAsStringAsync().Result
    if (-not $response.IsSuccessStatusCode) {
      throw "Gagal membuat buku $($Book.title): $body"
    }

    return ($body | ConvertFrom-Json).data
  } finally {
    if ($stream) {
      $stream.Dispose()
    }
    $content.Dispose()
    $client.Dispose()
  }
}

function Request-Borrow {
  param(
    [hashtable]$Borrower,
    [int]$BookId,
    [string]$StartDate,
    [int]$Days,
    [string]$Handover,
    [string]$Location,
    [string]$Note
  )

  $start = ([DateTime]::Parse($StartDate)).ToString("yyyy-MM-ddT00:00:00Z")
  $end = ([DateTime]::Parse($StartDate).AddDays($Days)).ToString("yyyy-MM-ddT00:00:00Z")
  return Invoke-Json -Method "Post" -Url "$ApiUrl/api/transactions/borrow" -Token $Borrower.token -Body @{
    book_id = $BookId
    borrow_date = $start
    expected_return_date = $end
    handover = $Handover
    location = $Location
    note = $Note
  }
}

function Respond-Borrow {
  param([hashtable]$Owner, [int]$TransactionId, [string]$Status)

  Invoke-Json -Method "Put" -Url "$ApiUrl/api/transactions/$TransactionId/respond" -Token $Owner.token -Body @{
    status = $Status
  } | Out-Null
}

function Return-Borrow {
  param([hashtable]$Borrower, [int]$TransactionId)

  Invoke-Json -Method "Put" -Url "$ApiUrl/api/transactions/$TransactionId/return" -Token $Borrower.token -Body $null | Out-Null
}

function Complete-Borrow {
  param([hashtable]$Owner, [int]$TransactionId)

  Invoke-Json -Method "Put" -Url "$ApiUrl/api/transactions/$TransactionId/complete" -Token $Owner.token -Body $null | Out-Null
}

function Rate-Borrow {
  param([hashtable]$Borrower, [int]$TransactionId, [int]$Rating, [string]$Comment)

  Invoke-Json -Method "Post" -Url "$ApiUrl/api/transactions/$TransactionId/rating" -Token $Borrower.token -Body @{
    rating = $Rating
    comment = $Comment
  } | Out-Null
}

function Pick {
  param([array]$Items)

  return $Items[(Get-Random -Minimum 0 -Maximum $Items.Count)]
}

Wait-Backend -BaseUrl $ApiUrl

if (-not (Test-Path $coverDir)) {
  New-Item -ItemType Directory -Path $coverDir | Out-Null
}

$people = @(
  @{ name = "Nara Putri"; email = "nara.putri@unilibra.app"; city = "Sleman" }
  @{ name = "Reza Mahendra"; email = "reza.mahendra@unilibra.app"; city = "Yogyakarta" }
  @{ name = "Alia Safitri"; email = "alia.safitri@unilibra.app"; city = "Bantul" }
  @{ name = "Raka Wiratama"; email = "raka.wiratama@unilibra.app"; city = "Condongcatur" }
  @{ name = "Tania Laras"; email = "tania.laras@unilibra.app"; city = "Seturan" }
  @{ name = "Dimas Pranata"; email = "dimas.pranata@unilibra.app"; city = "Pogung" }
  @{ name = "Sekar Ayu"; email = "sekar.ayu@unilibra.app"; city = "Kotabaru" }
  @{ name = "Yoga Prasetyo"; email = "yoga.prasetyo@unilibra.app"; city = "Babarsari" }
  @{ name = "Maya Kartika"; email = "maya.kartika@unilibra.app"; city = "Demangan" }
  @{ name = "Arman Fikri"; email = "arman.fikri@unilibra.app"; city = "Maguwoharjo" }
  @{ name = "Rini Anindya"; email = "rini.anindya@unilibra.app"; city = "Godean" }
  @{ name = "Bagas Adikara"; email = "bagas.adikara@unilibra.app"; city = "Jalan Kaliurang" }
)

$users = @()
foreach ($person in $people) {
  $users += Register-Or-Login -Name $person.name -Email $person.email -City $person.city
}

$places = @(
  @{ location = "Pogung Kidul, Sinduadi, Sleman"; lat = -7.759; lon = 110.376 }
  @{ location = "Condongcatur, Depok, Sleman"; lat = -7.758; lon = 110.407 }
  @{ location = "Seturan, Caturtunggal, Sleman"; lat = -7.766; lon = 110.409 }
  @{ location = "Gejayan, Caturtunggal, Sleman"; lat = -7.777; lon = 110.389 }
  @{ location = "Kotabaru, Gondokusuman, Yogyakarta"; lat = -7.783; lon = 110.373 }
  @{ location = "Demangan, Gondokusuman, Yogyakarta"; lat = -7.783; lon = 110.392 }
  @{ location = "Babarsari, Depok, Sleman"; lat = -7.773; lon = 110.414 }
  @{ location = "Maguwoharjo, Depok, Sleman"; lat = -7.754; lon = 110.433 }
  @{ location = "Kasihan, Bantul, Daerah Istimewa Yogyakarta"; lat = -7.826; lon = 110.339 }
  @{ location = "Godean, Sleman, Daerah Istimewa Yogyakarta"; lat = -7.767; lon = 110.293 }
)

$conditions = @("Seperti baru", "Baik", "Cukup baik", "Ada catatan tipis")
$durations = @("1 minggu", "2 minggu", "3 minggu", "1 bulan")
$handovers = @("Area kampus", "Titik temu publik", "Kurir lokal", "Ambil di sekitar kos")
$comments = @(
  "Bukunya rapi dan pemilik mudah dihubungi.",
  "Pengambilan cepat, kondisi sesuai deskripsi.",
  "Cover aman, halaman lengkap, nyaman dibaca.",
  "Ada sedikit bekas pakai tapi isi masih bagus.",
  "Transaksi lancar dan pengembalian mudah.",
  "Cocok untuk referensi kuliah dan bacaan santai."
)

$catalogSeeds = @(
  @{ title = "Hujan"; author = "Tere Liye"; category = "Novel"; theme = "Drama" }
  @{ title = "Pulang"; author = "Tere Liye"; category = "Novel"; theme = "Drama" }
  @{ title = "Pergi"; author = "Tere Liye"; category = "Novel"; theme = "Adventure" }
  @{ title = "Bumi"; author = "Tere Liye"; category = "Novel"; theme = "Fantasi" }
  @{ title = "Matahari Minor"; author = "Tere Liye"; category = "Novel"; theme = "Fantasi" }
  @{ title = "Ronggeng Dukuh Paruk"; author = "Ahmad Tohari"; category = "Sastra"; theme = "Klasik" }
  @{ title = "Orang-Orang Biasa"; author = "Andrea Hirata"; category = "Novel"; theme = "Humor" }
  @{ title = "Edensor"; author = "Andrea Hirata"; category = "Novel"; theme = "Adventure" }
  @{ title = "Ayat-Ayat Cinta"; author = "Habiburrahman El Shirazy"; category = "Novel"; theme = "Romance" }
  @{ title = "Lelaki Harimau"; author = "Eka Kurniawan"; category = "Sastra"; theme = "Klasik" }
  @{ title = "Seperti Dendam, Rindu Harus Dibayar Tuntas"; author = "Eka Kurniawan"; category = "Sastra"; theme = "Drama" }
  @{ title = "Perahu Kertas"; author = "Dee Lestari"; category = "Novel"; theme = "Romance" }
  @{ title = "Supernova"; author = "Dee Lestari"; category = "Novel"; theme = "Fiksi ilmiah" }
  @{ title = "Filosofi Kopi"; author = "Dee Lestari"; category = "Sastra"; theme = "Cerita pendek" }
  @{ title = "Cantik Itu Luka"; author = "Eka Kurniawan"; category = "Sastra"; theme = "Klasik" }
  @{ title = "Laut Bercerita"; author = "Leila S. Chudori"; category = "Novel"; theme = "Sejarah" }
  @{ title = "Home Sweet Loan"; author = "Almira Bastari"; category = "Novel"; theme = "Urban" }
  @{ title = "Ganjil Genap"; author = "Almira Bastari"; category = "Novel"; theme = "Urban" }
  @{ title = "Nanti Kita Cerita Tentang Hari Ini"; author = "Marchella FP"; category = "Pengembangan diri"; theme = "Refleksi" }
  @{ title = "Berani Tidak Disukai"; author = "Ichiro Kishimi"; category = "Pengembangan diri"; theme = "Psikologi" }
  @{ title = "The Things You Can See Only When You Slow Down"; author = "Haemin Sunim"; category = "Pengembangan diri"; theme = "Mindfulness" }
  @{ title = "The Midnight Library"; author = "Matt Haig"; category = "Novel"; theme = "Fantasi" }
  @{ title = "Before the Coffee Gets Cold"; author = "Toshikazu Kawaguchi"; category = "Novel"; theme = "Drama" }
  @{ title = "Educated"; author = "Tara Westover"; category = "Nonfiksi"; theme = "Memoar" }
  @{ title = "Thinking, Fast and Slow"; author = "Daniel Kahneman"; category = "Nonfiksi"; theme = "Psikologi" }
  @{ title = "The Design of Everyday Things"; author = "Don Norman"; category = "Teknologi"; theme = "UX" }
  @{ title = "Don't Make Me Think"; author = "Steve Krug"; category = "Teknologi"; theme = "UX" }
  @{ title = "Refactoring"; author = "Martin Fowler"; category = "Teknologi"; theme = "Pemrograman" }
  @{ title = "Design Patterns"; author = "Erich Gamma"; category = "Teknologi"; theme = "Software engineering" }
  @{ title = "Introduction to Algorithms"; author = "Thomas H. Cormen"; category = "Teknologi"; theme = "Algoritma" }
  @{ title = "Computer Networking"; author = "James Kurose"; category = "Teknologi"; theme = "Jaringan" }
  @{ title = "Artificial Intelligence: A Modern Approach"; author = "Stuart Russell"; category = "Teknologi"; theme = "AI" }
  @{ title = "Machine Learning"; author = "Tom Mitchell"; category = "Teknologi"; theme = "AI" }
  @{ title = "Hands-On Machine Learning"; author = "Aurelien Geron"; category = "Teknologi"; theme = "AI" }
  @{ title = "Sistem Operasi"; author = "Abraham Silberschatz"; category = "Pendidikan"; theme = "Sistem operasi" }
  @{ title = "Microeconomics"; author = "Robert Pindyck"; category = "Pendidikan"; theme = "Ekonomi" }
  @{ title = "Dune"; author = "Frank Herbert"; category = "Novel"; theme = "Fiksi ilmiah" }
  @{ title = "The Hobbit"; author = "J.R.R. Tolkien"; category = "Novel"; theme = "Fantasi" }
  @{ title = "The Fellowship of the Ring"; author = "J.R.R. Tolkien"; category = "Novel"; theme = "Fantasi" }
  @{ title = "The Hunger Games"; author = "Suzanne Collins"; category = "Novel"; theme = "Adventure" }
  @{ title = "Catching Fire"; author = "Suzanne Collins"; category = "Novel"; theme = "Adventure" }
  @{ title = "Divergent"; author = "Veronica Roth"; category = "Novel"; theme = "Adventure" }
  @{ title = "The Fault in Our Stars"; author = "John Green"; category = "Novel"; theme = "Drama" }
  @{ title = "Wonder"; author = "R. J. Palacio"; category = "Novel"; theme = "Keluarga" }
  @{ title = "The Book Thief"; author = "Markus Zusak"; category = "Novel"; theme = "Sejarah" }
  @{ title = "The Kite Runner"; author = "Khaled Hosseini"; category = "Novel"; theme = "Drama" }
  @{ title = "A Thousand Splendid Suns"; author = "Khaled Hosseini"; category = "Novel"; theme = "Drama" }
  @{ title = "Norwegian Wood"; author = "Haruki Murakami"; category = "Novel"; theme = "Drama" }
  @{ title = "Kafka on the Shore"; author = "Haruki Murakami"; category = "Novel"; theme = "Fantasi" }
  @{ title = "The Alchemist"; author = "Paulo Coelho"; category = "Novel"; theme = "Inspiratif" }
  @{ title = "The Little Prince"; author = "Antoine de Saint-Exupery"; category = "Novel"; theme = "Klasik" }
  @{ title = "1984"; author = "George Orwell"; category = "Sastra"; theme = "Klasik" }
  @{ title = "Animal Farm"; author = "George Orwell"; category = "Sastra"; theme = "Klasik" }
  @{ title = "To Kill a Mockingbird"; author = "Harper Lee"; category = "Sastra"; theme = "Klasik" }
  @{ title = "The Seven Husbands of Evelyn Hugo"; author = "Taylor Jenkins Reid"; category = "Novel"; theme = "Drama" }
  @{ title = "It Ends with Us"; author = "Colleen Hoover"; category = "Novel"; theme = "Romance" }
  @{ title = "Where the Crawdads Sing"; author = "Delia Owens"; category = "Novel"; theme = "Drama" }
  @{ title = "The Silent Patient"; author = "Alex Michaelides"; category = "Novel"; theme = "Thriller" }
  @{ title = "The Song of Achilles"; author = "Madeline Miller"; category = "Novel"; theme = "Mitologi" }
  @{ title = "Circe"; author = "Madeline Miller"; category = "Novel"; theme = "Mitologi" }
  @{ title = "Ikigai"; author = "Hector Garcia"; category = "Pengembangan diri"; theme = "Mindset" }
  @{ title = "Start with Why"; author = "Simon Sinek"; category = "Bisnis"; theme = "Leadership" }
  @{ title = "Drive"; author = "Daniel H. Pink"; category = "Bisnis"; theme = "Produktivitas" }
  @{ title = "Grit"; author = "Angela Duckworth"; category = "Pengembangan diri"; theme = "Psikologi" }
  @{ title = "Mindset"; author = "Carol S. Dweck"; category = "Pengembangan diri"; theme = "Psikologi" }
  @{ title = "Make It Stick"; author = "Peter C. Brown"; category = "Pendidikan"; theme = "Belajar" }
  @{ title = "How to Win Friends and Influence People"; author = "Dale Carnegie"; category = "Pengembangan diri"; theme = "Komunikasi" }
  @{ title = "Influence"; author = "Robert Cialdini"; category = "Bisnis"; theme = "Psikologi" }
  @{ title = "Hooked"; author = "Nir Eyal"; category = "Bisnis"; theme = "Produk" }
  @{ title = "Inspired"; author = "Marty Cagan"; category = "Bisnis"; theme = "Produk" }
  @{ title = "The Mom Test"; author = "Rob Fitzpatrick"; category = "Bisnis"; theme = "Produk" }
  @{ title = "Lean UX"; author = "Jeff Gothelf"; category = "Teknologi"; theme = "UX" }
  @{ title = "Cracking the Coding Interview"; author = "Gayle Laakmann McDowell"; category = "Teknologi"; theme = "Pemrograman" }
  @{ title = "Grokking Algorithms"; author = "Aditya Bhargava"; category = "Teknologi"; theme = "Algoritma" }
  @{ title = "Fluent Python"; author = "Luciano Ramalho"; category = "Teknologi"; theme = "Pemrograman" }
  @{ title = "Python for Data Analysis"; author = "Wes McKinney"; category = "Teknologi"; theme = "Data science" }
  @{ title = "Effective Java"; author = "Joshua Bloch"; category = "Teknologi"; theme = "Pemrograman" }
  @{ title = "Head First Design Patterns"; author = "Eric Freeman"; category = "Teknologi"; theme = "Software engineering" }
  @{ title = "Kotlin in Action"; author = "Dmitry Jemerov"; category = "Teknologi"; theme = "Pemrograman" }
  @{ title = "You Don't Know JS"; author = "Kyle Simpson"; category = "Teknologi"; theme = "Pemrograman" }
  @{ title = "CSS Secrets"; author = "Lea Verou"; category = "Teknologi"; theme = "Frontend" }
  @{ title = "HTML and CSS"; author = "Jon Duckett"; category = "Teknologi"; theme = "Frontend" }
  @{ title = "Linear Algebra Done Right"; author = "Sheldon Axler"; category = "Pendidikan"; theme = "Matematika" }
  @{ title = "A Brief History of Time"; author = "Stephen Hawking"; category = "Nonfiksi"; theme = "Sains populer" }
  @{ title = "Cosmos"; author = "Carl Sagan"; category = "Nonfiksi"; theme = "Sains populer" }
  @{ title = "Factfulness"; author = "Hans Rosling"; category = "Nonfiksi"; theme = "Sains populer" }
  @{ title = "Outliers"; author = "Malcolm Gladwell"; category = "Nonfiksi"; theme = "Psikologi" }
  @{ title = "Blink"; author = "Malcolm Gladwell"; category = "Nonfiksi"; theme = "Psikologi" }
)

$bookCopies = @()
$titleOccurrences = @{}

foreach ($seed in $catalogSeeds) {
  if ($bookCopies.Count -ge $TargetCopies) {
    break
  }

  $copyTotal = Get-Random -Minimum 1 -Maximum 4
  for ($copy = 1; $copy -le $copyTotal; $copy++) {
    if ($bookCopies.Count -ge $TargetCopies) {
      break
    }

    $key = ConvertTo-Slug -Value $seed.title
    if (-not $titleOccurrences.ContainsKey($key)) {
      $titleOccurrences[$key] = 0
    }
    $titleOccurrences[$key]++

    $metadata = Get-BookMetadata -Title $seed.title -Author $seed.author -VariantIndex $titleOccurrences[$key]
    if (-not $metadata) {
      Write-Host "Lewati: $($seed.title) - cover tidak ditemukan." -ForegroundColor Yellow
      continue
    }

    $owner = Pick -Items $users
    $place = Pick -Items $places
    $condition = Pick -Items $conditions
    $duration = Pick -Items $durations
    $handover = Pick -Items $handovers
    $price = (Get-Random -Minimum 5 -Maximum 19) * 1000
    if ($seed.category -eq "Teknologi" -or $seed.category -eq "Pendidikan") {
      $price += 3000
    }

    $description = $metadata.description
    if (-not $description) {
      $description = "Koleksi bacaan $($seed.theme.ToLowerInvariant()) yang cocok untuk dipinjam mingguan."
    }

    $book = @{
      title = $metadata.title
      author = $metadata.author
      category = $seed.category
      theme = $seed.theme
      condition = $condition
      location = $place.location
      max_duration = $duration
      handover = $handover
      rental_price = $price
      latitude = $place.lat
      longitude = $place.lon
      description = $description
      cover = $metadata.cover
    }

    $created = New-Book -Owner $owner -Book $book
    $bookCopies += @{
      book = $created
      owner = $owner
    }

    Write-Host "Masuk: $($book.title) - $($owner.name)" -ForegroundColor Green
  }
}

$completedRatings = 0
$booksToRate = @($bookCopies | Sort-Object { Get-Random } | Select-Object -First ([Math]::Min(36, $bookCopies.Count)))

foreach ($item in $booksToRate) {
  $owner = $item.owner
  $borrower = Pick -Items @($users | Where-Object { $_.id -ne $owner.id })
  $startDate = (Get-Date).AddDays(-(Get-Random -Minimum 18 -Maximum 120)).ToString("yyyy-MM-dd")
  $days = Pick -Items @(7, 10, 14, 21)
  $place = Pick -Items $places

  try {
    $transaction = Request-Borrow `
      -Borrower $borrower `
      -BookId ([int]$item.book.id) `
      -StartDate $startDate `
      -Days ([int]$days) `
      -Handover (Pick -Items $handovers) `
      -Location $place.location `
      -Note "Dipinjam untuk bacaan pribadi dan referensi tugas."

    Respond-Borrow -Owner $owner -TransactionId ([int]$transaction.data.id) -Status "ACCEPTED"
    Return-Borrow -Borrower $borrower -TransactionId ([int]$transaction.data.id)
    Complete-Borrow -Owner $owner -TransactionId ([int]$transaction.data.id)
    Rate-Borrow `
      -Borrower $borrower `
      -TransactionId ([int]$transaction.data.id) `
      -Rating (Pick -Items @(4, 4, 4, 5, 5, 5, 3)) `
      -Comment (Pick -Items $comments)
    $completedRatings++
  } catch {
    Write-Host "Rating dilewati untuk book_id=$($item.book.id): $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Import data buku API selesai." -ForegroundColor Green
Write-Host "Users natural : $($users.Count)"
Write-Host "Books masuk   : $($bookCopies.Count)"
Write-Host "Rating masuk  : $completedRatings"
Write-Host "Login contoh  : nara.putri@unilibra.app / $password"
