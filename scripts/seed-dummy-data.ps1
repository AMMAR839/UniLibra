param(
  [string]$ApiUrl = "http://localhost:8080",
  [string]$DbContainer = "unilibra-postgres",
  [string]$DbUser = "unilibra",
  [string]$DbName = "unilibra",
  [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"

$internalPassword = "password123"
$coverDir = Join-Path $PSScriptRoot "dummy-covers"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")

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

  throw "Backend belum siap di $BaseUrl. Pastikan docker compose masih berjalan."
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

function Register-User {
  param(
    [string]$Name,
    [string]$Email,
    [string]$City
  )

  try {
    Invoke-Json -Method "Post" -Url "$ApiUrl/api/register" -Body @{
      name = $Name
      email = $Email
      password = $internalPassword
      city = $City
    } | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 409) {
      throw
    }
  }

  $login = Invoke-Json -Method "Post" -Url "$ApiUrl/api/login" -Body @{
    email = $Email
    password = $internalPassword
  }

  return @{
    id = [int]$login.user.id
    name = $login.user.name
    email = $login.user.email
    token = $login.token
  }
}

function New-CoverImage {
  param(
    [string]$Filename,
    [string]$Title,
    [string]$Author,
    [string]$ColorA,
    [string]$ColorB
  )

  if (-not (Test-Path $coverDir)) {
    New-Item -ItemType Directory -Path $coverDir | Out-Null
  }

  Add-Type -AssemblyName System.Drawing

  $path = Join-Path $coverDir $Filename
  $bitmap = New-Object System.Drawing.Bitmap 720, 1000
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

  $rect = New-Object System.Drawing.Rectangle 0, 0, 720, 1000
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.ColorTranslator]::FromHtml($ColorA)), ([System.Drawing.ColorTranslator]::FromHtml($ColorB)), 45
  $graphics.FillRectangle($brush, $rect)

  $overlay = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(58, 255, 255, 255))
  $graphics.FillRectangle($overlay, 62, 84, 596, 832)

  $lineBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(185, 26, 18, 8))
  $fontTitle = New-Object System.Drawing.Font "Georgia", 44, ([System.Drawing.FontStyle]::Bold)
  $fontAuthor = New-Object System.Drawing.Font "Arial", 20, ([System.Drawing.FontStyle]::Bold)
  $fontBadge = New-Object System.Drawing.Font "Arial", 18, ([System.Drawing.FontStyle]::Bold)

  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Near
  $format.LineAlignment = [System.Drawing.StringAlignment]::Near

  $graphics.DrawString("UNILIBRA", $fontBadge, $lineBrush, 92, 126)
  $graphics.DrawString($Title, $fontTitle, $lineBrush, (New-Object System.Drawing.RectangleF 92, 284, 536, 300), $format)
  $graphics.DrawString($Author, $fontAuthor, $lineBrush, (New-Object System.Drawing.RectangleF 92, 720, 536, 90), $format)

  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)

  $fontTitle.Dispose()
  $fontAuthor.Dispose()
  $fontBadge.Dispose()
  $lineBrush.Dispose()
  $overlay.Dispose()
  $brush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()

  return $path
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

function Get-OpenLibraryCover {
  param(
    [string]$Title,
    [string]$Author,
    [string]$FallbackPath,
    [int]$VariantIndex = 1
  )

  $safeTitle = $Title
  $slug = ConvertTo-Slug -Value "$safeTitle-$Author"
  $targetPath = Join-Path $coverDir "openlibrary-$slug-$VariantIndex.jpg"

  $cachedFile = Get-Item -Path $targetPath -ErrorAction SilentlyContinue
  if ($cachedFile -and $cachedFile.Length -gt 1024) {
    return $targetPath
  }

  try {
    $searchUrl = "https://openlibrary.org/search.json?title=$([uri]::EscapeDataString($safeTitle))&author=$([uri]::EscapeDataString($Author))&limit=12"
    $headers = @{ "User-Agent" = "UniLibra local seed script" }
    $result = Invoke-RestMethod -Uri $searchUrl -Method Get -Headers $headers -TimeoutSec 8
    $matches = @($result.docs | Where-Object { $_.cover_i } | Select-Object -First 12)

    if ($matches.Count -eq 0) {
      return $FallbackPath
    }

    $match = $matches[($VariantIndex - 1) % $matches.Count]
    $coverUrl = "https://covers.openlibrary.org/b/id/$($match.cover_i)-L.jpg"
    Invoke-WebRequest -Uri $coverUrl -Headers $headers -OutFile $targetPath -TimeoutSec 12 | Out-Null

    $file = Get-Item -Path $targetPath -ErrorAction Stop
    if ($file.Length -lt 1024) {
      Remove-Item -LiteralPath $targetPath -ErrorAction SilentlyContinue
      return $FallbackPath
    }

    return $targetPath
  } catch {
    return $FallbackPath
  }
}

function Get-GoogleBooksCover {
  param(
    [string]$Title,
    [string]$Author,
    [string]$FallbackPath,
    [int]$VariantIndex = 1
  )

  $slug = ConvertTo-Slug -Value "$Title-$Author"
  $targetPath = Join-Path $coverDir "google-$slug-$VariantIndex.jpg"

  $cachedFile = Get-Item -Path $targetPath -ErrorAction SilentlyContinue
  if ($cachedFile -and $cachedFile.Length -gt 1024) {
    return $targetPath
  }

  try {
    $query = "intitle:$Title inauthor:$Author"
    $searchUrl = "https://www.googleapis.com/books/v1/volumes?q=$([uri]::EscapeDataString($query))&maxResults=20&printType=books"
    $headers = @{ "User-Agent" = "UniLibra local seed script" }
    $result = Invoke-RestMethod -Uri $searchUrl -Method Get -Headers $headers -TimeoutSec 8
    $items = @($result.items | Where-Object {
      $_.volumeInfo.imageLinks.thumbnail -or $_.volumeInfo.imageLinks.smallThumbnail
    })

    if ($items.Count -eq 0) {
      return $FallbackPath
    }

    $item = $items[($VariantIndex - 1) % $items.Count]
    $coverUrl = $item.volumeInfo.imageLinks.thumbnail
    if (-not $coverUrl) {
      $coverUrl = $item.volumeInfo.imageLinks.smallThumbnail
    }
    $coverUrl = ($coverUrl -replace "^http://", "https://") -replace "zoom=1", "zoom=2"
    Invoke-WebRequest -Uri $coverUrl -Headers $headers -OutFile $targetPath -TimeoutSec 12 | Out-Null

    $file = Get-Item -Path $targetPath -ErrorAction Stop
    if ($file.Length -lt 1024) {
      Remove-Item -LiteralPath $targetPath -ErrorAction SilentlyContinue
      return $FallbackPath
    }

    return $targetPath
  } catch {
    return $FallbackPath
  }
}

function Get-BookCover {
  param(
    [string]$Title,
    [string]$Author,
    [string]$FallbackPath,
    [int]$VariantIndex = 1
  )

  $googleCover = Get-GoogleBooksCover -Title $Title -Author $Author -FallbackPath $FallbackPath -VariantIndex $VariantIndex
  if ($googleCover -ne $FallbackPath) {
    return $googleCover
  }

  return Get-OpenLibraryCover -Title $Title -Author $Author -FallbackPath $FallbackPath -VariantIndex $VariantIndex
}

function Get-AssetCover {
  param([string]$Filename)

  $path = Join-Path $repoRoot "frontend\src\assets\$Filename"
  if (-not (Test-Path $path)) {
    throw "Asset cover tidak ditemukan: $path"
  }

  return $path
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
      theme = if ($Book.theme) { $Book.theme } else { $Book.category }
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

function CleanupSeedData {
  $sql = @"
CREATE TEMP TABLE seed_dummy_users AS
  SELECT id FROM users
  WHERE email IN (
    'admin@unilibra.local',
    'nicholas@unilibra.local',
    'rania@unilibra.local',
    'ammar@unilibra.local',
    'salsa@unilibra.local',
    'bima@unilibra.local',
    'dewi@unilibra.local',
    'farhan@unilibra.local',
    'nadia@unilibra.local',
    'yusuf@unilibra.local',
    'lara@unilibra.local',
    'kevin@unilibra.local',
    'mira@unilibra.local',
    'adit@unilibra.local',
    'intan@unilibra.local',
    'galih@unilibra.local'
  )
  OR LOWER(email) LIKE '%.' || 'de' || 'mo' || '@unilibra.local';

CREATE TEMP TABLE seed_dummy_books AS
  SELECT id FROM books
  WHERE owner_id IN (SELECT id FROM seed_dummy_users)
     OR title LIKE '[' || 'DE' || 'MO' || '] %';

CREATE TEMP TABLE seed_dummy_threads AS
  SELECT id FROM chat_threads
  WHERE created_by_id IN (SELECT id FROM seed_dummy_users)
     OR recipient_id IN (SELECT id FROM seed_dummy_users)
     OR book_id IN (SELECT id FROM seed_dummy_books);

DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM seed_dummy_threads);
DELETE FROM chat_threads WHERE id IN (SELECT id FROM seed_dummy_threads);
DELETE FROM notifications WHERE user_id IN (SELECT id FROM seed_dummy_users);
DO `$`$
BEGIN
  IF to_regclass('public.book_ratings') IS NOT NULL THEN
    DELETE FROM book_ratings
      WHERE user_id IN (SELECT id FROM seed_dummy_users)
         OR book_id IN (SELECT id FROM seed_dummy_books)
         OR transaction_id IN (
           SELECT id FROM transactions
           WHERE borrower_id IN (SELECT id FROM seed_dummy_users)
              OR book_id IN (SELECT id FROM seed_dummy_books)
         );
  END IF;
END
`$`$;
DELETE FROM transactions
  WHERE borrower_id IN (SELECT id FROM seed_dummy_users)
     OR book_id IN (SELECT id FROM seed_dummy_books);
DELETE FROM books WHERE id IN (SELECT id FROM seed_dummy_books);
DELETE FROM users WHERE id IN (SELECT id FROM seed_dummy_users);
"@

  $sql | docker exec -i $DbContainer psql -U $DbUser -d $DbName | Out-Null
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
  param(
    [hashtable]$Owner,
    [int]$TransactionId,
    [string]$Status
  )

  Invoke-Json -Method "Put" -Url "$ApiUrl/api/transactions/$TransactionId/respond" -Token $Owner.token -Body @{
    status = $Status
  } | Out-Null
}

function Return-Borrow {
  param(
    [hashtable]$Borrower,
    [int]$TransactionId
  )

  Invoke-Json -Method "Put" -Url "$ApiUrl/api/transactions/$TransactionId/return" -Token $Borrower.token -Body $null | Out-Null
}

function Complete-Borrow {
  param(
    [hashtable]$Owner,
    [int]$TransactionId
  )

  Invoke-Json -Method "Put" -Url "$ApiUrl/api/transactions/$TransactionId/complete" -Token $Owner.token -Body $null | Out-Null
}

function Rate-Borrow {
  param(
    [hashtable]$Borrower,
    [int]$TransactionId,
    [int]$Rating,
    [string]$Comment = ""
  )

  Invoke-Json -Method "Post" -Url "$ApiUrl/api/transactions/$TransactionId/rating" -Token $Borrower.token -Body @{
    rating = $Rating
    comment = $Comment
  } | Out-Null
}

function New-Chat {
  param(
    [hashtable]$Sender,
    [int]$ParticipantId,
    [int]$BookId,
    [string[]]$Messages
  )

  $thread = Invoke-Json -Method "Post" -Url "$ApiUrl/api/chat/threads" -Token $Sender.token -Body @{
    participant_id = $ParticipantId
    book_id = $BookId
  }

  foreach ($message in $Messages) {
    Invoke-Json -Method "Post" -Url "$ApiUrl/api/chat/threads/$($thread.data.id)/messages" -Token $Sender.token -Body @{
      body = $message
    } | Out-Null
  }
}

Wait-Backend -BaseUrl $ApiUrl

if (-not $SkipCleanup) {
  CleanupSeedData
}

$admin = Register-User -Name "Admin UniLibra" -Email "admin@unilibra.local" -City "Yogyakarta"
$nicholas = Register-User -Name "Nicholas S." -Email "nicholas@unilibra.local" -City "Sleman"
$rania = Register-User -Name "Rania Putri" -Email "rania@unilibra.local" -City "Bantul"
$ammar = Register-User -Name "Ammar Fikri" -Email "ammar@unilibra.local" -City "Yogyakarta"
$salsa = Register-User -Name "Salsa Nabila" -Email "salsa@unilibra.local" -City "Condongcatur"
$bima = Register-User -Name "Bima Prasetyo" -Email "bima@unilibra.local" -City "Seturan"
$dewi = Register-User -Name "Dewi Laras" -Email "dewi@unilibra.local" -City "Pogung"
$farhan = Register-User -Name "Farhan Aziz" -Email "farhan@unilibra.local" -City "Kota Yogyakarta"
$nadia = Register-User -Name "Nadia Kirana" -Email "nadia@unilibra.local" -City "Bantul"
$yusuf = Register-User -Name "Yusuf Hidayat" -Email "yusuf@unilibra.local" -City "UGM"
$lara = Register-User -Name "Lara Maheswari" -Email "lara@unilibra.local" -City "Kotabaru"
$kevin = Register-User -Name "Kevin Arya" -Email "kevin@unilibra.local" -City "Babarsari"
$mira = Register-User -Name "Mira Anindya" -Email "mira@unilibra.local" -City "Maguwoharjo"
$adit = Register-User -Name "Adit Wicaksono" -Email "adit@unilibra.local" -City "Jakal"
$intan = Register-User -Name "Intan Permata" -Email "intan@unilibra.local" -City "Demangan"
$galih = Register-User -Name "Galih Pradana" -Email "galih@unilibra.local" -City "Godean"

$covers = @(
  Get-BookCover -Title "Filosofi Teras" -Author "Henry Manampiring" -FallbackPath (New-CoverImage -Filename "filosofi-teras.png" -Title "Filosofi Teras" -Author "Henry Manampiring" -ColorA "#F2C14E" -ColorB "#B8651B")
  Get-BookCover -Title "Atomic Habits" -Author "James Clear" -FallbackPath (New-CoverImage -Filename "atomic-habits.png" -Title "Atomic Habits" -Author "James Clear" -ColorA "#2F6F73" -ColorB "#172A3A")
  Get-BookCover -Title "Laskar Pelangi" -Author "Andrea Hirata" -FallbackPath (New-CoverImage -Filename "laskar-pelangi.png" -Title "Laskar Pelangi" -Author "Andrea Hirata" -ColorA "#5B8E7D" -ColorB "#1D4E35")
  Get-BookCover -Title "Bumi Manusia" -Author "Pramoedya Ananta Toer" -FallbackPath (New-CoverImage -Filename "bumi-manusia.png" -Title "Bumi Manusia" -Author "Pramoedya A. Toer" -ColorA "#9E2A2B" -ColorB "#540B0E")
  Get-BookCover -Title "Algoritma Dasar" -Author "Rinaldi Munir" -FallbackPath (New-CoverImage -Filename "algoritma.png" -Title "Algoritma Dasar" -Author "Rinaldi Munir" -ColorA "#3D5A80" -ColorB "#1D3557")
  Get-BookCover -Title "Clean Code" -Author "Robert C. Martin" -FallbackPath (New-CoverImage -Filename "clean-code.png" -Title "Clean Code" -Author "Robert C. Martin" -ColorA "#2B2D42" -ColorB "#8D99AE")
  Get-BookCover -Title "Psikologi Uang" -Author "Morgan Housel" -FallbackPath (New-CoverImage -Filename "psikologi-uang.png" -Title "Psikologi Uang" -Author "Morgan Housel" -ColorA "#BC6C25" -ColorB "#283618")
  Get-BookCover -Title "Laut Bercerita" -Author "Leila S. Chudori" -FallbackPath (New-CoverImage -Filename "laut-bercerita.png" -Title "Laut Bercerita" -Author "Leila S. Chudori" -ColorA "#006D77" -ColorB "#003049")
  Get-BookCover -Title "Data Science from Scratch" -Author "Joel Grus" -FallbackPath (New-CoverImage -Filename "data-science.png" -Title "Data Science" -Author "Joel Grus" -ColorA "#7B2CBF" -ColorB "#240046")
  Get-BookCover -Title "Deep Work" -Author "Cal Newport" -FallbackPath (New-CoverImage -Filename "deep-work.png" -Title "Deep Work" -Author "Cal Newport" -ColorA "#264653" -ColorB "#0A192F")
  Get-BookCover -Title "The Lean Startup" -Author "Eric Ries" -FallbackPath (New-CoverImage -Filename "lean-startup.png" -Title "The Lean Startup" -Author "Eric Ries" -ColorA "#2A9D8F" -ColorB "#1B4332")
  Get-BookCover -Title "Change by Design" -Author "Tim Brown" -FallbackPath (New-CoverImage -Filename "design-thinking.png" -Title "Design Thinking" -Author "Tim Brown" -ColorA "#E76F51" -ColorB "#6D2E46")
  Get-BookCover -Title "Negeri 5 Menara" -Author "A. Fuadi" -FallbackPath (New-CoverImage -Filename "negeri-5-menara.png" -Title "Negeri 5 Menara" -Author "A. Fuadi" -ColorA "#457B9D" -ColorB "#1D3557")
  Get-BookCover -Title "Cantik Itu Luka" -Author "Eka Kurniawan" -FallbackPath (New-CoverImage -Filename "cantik-itu-luka.png" -Title "Cantik Itu Luka" -Author "Eka Kurniawan" -ColorA "#9D0208" -ColorB "#370617")
  Get-BookCover -Title "Calculus" -Author "Purcell" -FallbackPath (New-CoverImage -Filename "kalkulus-dasar.png" -Title "Kalkulus Dasar" -Author "Purcell" -ColorA "#4361EE" -ColorB "#03045E")
  Get-BookCover -Title "Database System Concepts" -Author "Silberschatz" -FallbackPath (New-CoverImage -Filename "database-system.png" -Title "Database System" -Author "Silberschatz" -ColorA "#3A0CA3" -ColorB "#10002B")
  Get-BookCover -Title "The Pragmatic Programmer" -Author "Andrew Hunt" -FallbackPath (New-CoverImage -Filename "pragmatic-programmer.png" -Title "Pragmatic Programmer" -Author "Hunt & Thomas" -ColorA "#343A40" -ColorB "#111111")
  Get-BookCover -Title "Sapiens" -Author "Yuval Noah Harari" -FallbackPath (New-CoverImage -Filename "sapiens.png" -Title "Sapiens" -Author "Yuval Noah Harari" -ColorA "#A98467" -ColorB "#4E342E")
  Get-BookCover -Title "Rich Dad Poor Dad" -Author "Robert Kiyosaki" -FallbackPath (New-CoverImage -Filename "rich-dad-poor-dad.png" -Title "Rich Dad Poor Dad" -Author "Robert Kiyosaki" -ColorA "#F4A261" -ColorB "#99582A")
  Get-BookCover -Title "Matematika Diskrit" -Author "Rinaldi Munir" -FallbackPath (New-CoverImage -Filename "matematika-diskrit.png" -Title "Matematika Diskrit" -Author "Rinaldi Munir" -ColorA "#023E8A" -ColorB "#001845")
  Get-BookCover -Title "Eloquent JavaScript" -Author "Marijn Haverbeke" -FallbackPath (New-CoverImage -Filename "eloquent-javascript.png" -Title "Eloquent JavaScript" -Author "Marijn Haverbeke" -ColorA "#F7B801" -ColorB "#6A4C93")
  Get-AssetCover -Filename "Dilan.webp"
  Get-AssetCover -Filename "novel_bulan_tere_liye.jpg"
  Get-AssetCover -Filename "book_harry.webp"
)

$bookSeeds = @(
  @{ owner = $nicholas; cover = $covers[0]; title = "Filosofi Teras"; author = "Henry Manampiring"; category = "Pengembangan diri"; condition = "Baik"; location = "Sleman, Yogyakarta"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 7000; latitude = -7.747; longitude = 110.355; description = "Buku pengantar stoisisme yang ringan untuk belajar mengelola emosi, ekspektasi, dan keputusan sehari-hari." }
  @{ owner = $nicholas; cover = $covers[1]; title = "Atomic Habits"; author = "James Clear"; category = "Nonfiksi"; condition = "Seperti baru"; location = "UGM, Sleman"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 9000; latitude = -7.771; longitude = 110.377; description = "Panduan praktis membangun kebiasaan kecil yang konsisten dan mudah diterapkan untuk mahasiswa." }
  @{ owner = $nicholas; cover = $covers[4]; title = "Algoritma Dasar"; author = "Rinaldi Munir"; category = "Akademik"; condition = "Ada catatan"; location = "Pogung, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 12000; latitude = -7.759; longitude = 110.376; description = "Buku akademik untuk struktur data, algoritma dasar, dan latihan pemrograman." }
  @{ owner = $rania; cover = $covers[2]; title = "Laskar Pelangi"; author = "Andrea Hirata"; category = "Sastra"; condition = "Baik"; location = "Bantul, Yogyakarta"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 6000; latitude = -7.875; longitude = 110.327; description = "Novel Indonesia tentang pendidikan, persahabatan, dan mimpi besar dari Belitung." }
  @{ owner = $rania; cover = $covers[3]; title = "Bumi Manusia"; author = "Pramoedya Ananta Toer"; category = "Sastra"; condition = "Cukup baik"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Kurir lokal"; rental_price = 8000; latitude = -7.801; longitude = 110.364; description = "Novel sejarah Indonesia dengan latar kolonial, cocok untuk pembaca sastra dan sejarah." }
  @{ owner = $rania; cover = $covers[5]; title = "Clean Code"; author = "Robert C. Martin"; category = "Akademik"; condition = "Baik"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 13000; latitude = -7.758; longitude = 110.408; description = "Buku wajib untuk belajar menulis kode yang rapi, mudah dirawat, dan profesional." }
  @{ owner = $nicholas; cover = $covers[6]; title = "Psikologi Uang"; author = "Morgan Housel"; category = "Nonfiksi"; condition = "Seperti baru"; location = "Seturan"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8500; latitude = -7.766; longitude = 110.409; description = "Kumpulan insight sederhana tentang perilaku manusia dalam mengelola uang." }
  @{ owner = $rania; cover = $covers[7]; title = "Laut Bercerita"; author = "Leila S. Chudori"; category = "Fiksi populer"; condition = "Baik"; location = "Gejayan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 7500; latitude = -7.777; longitude = 110.389; description = "Novel emosional tentang keluarga, aktivisme, dan ingatan yang belum selesai." }
  @{ owner = $nicholas; cover = $covers[8]; title = "Data Science dari Nol"; author = "Joel Grus"; category = "Akademik"; condition = "Baik"; location = "Sleman"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 14000; latitude = -7.748; longitude = 110.355; description = "Pengantar data science, statistik, Python, dan machine learning untuk pemula." }
  @{ owner = $nicholas; cover = $covers[9]; title = "Deep Work"; author = "Cal Newport"; category = "Pengembangan diri"; condition = "Seperti baru"; location = "Pogung, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 9000; latitude = -7.759; longitude = 110.377; description = "Buku tentang fokus mendalam, produktivitas, dan cara bekerja tanpa distraksi." }
  @{ owner = $rania; cover = $covers[10]; title = "The Lean Startup"; author = "Eric Ries"; category = "Nonfiksi"; condition = "Baik"; location = "Kota Yogyakarta"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 10000; latitude = -7.797; longitude = 110.370; description = "Panduan membangun produk dan startup dengan eksperimen cepat, validasi ide, dan iterasi." }
  @{ owner = $rania; cover = $covers[11]; title = "Design Thinking"; author = "Tim Brown"; category = "Nonfiksi"; condition = "Baik"; location = "Condongcatur"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 9500; latitude = -7.758; longitude = 110.407; description = "Buku untuk memahami pemecahan masalah kreatif, riset pengguna, dan prototyping." }
  @{ owner = $nicholas; cover = $covers[12]; title = "Negeri 5 Menara"; author = "A. Fuadi"; category = "Fiksi populer"; condition = "Cukup baik"; location = "Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 6500; latitude = -7.746; longitude = 110.355; description = "Novel inspiratif tentang persahabatan, pendidikan pesantren, dan mimpi besar." }
  @{ owner = $rania; cover = $covers[13]; title = "Cantik Itu Luka"; author = "Eka Kurniawan"; category = "Sastra"; condition = "Baik"; location = "Bantul"; max_duration = "2 minggu"; handover = "Kurir lokal"; rental_price = 8500; latitude = -7.875; longitude = 110.331; description = "Novel sastra Indonesia dengan gaya realisme magis, sejarah keluarga, dan kritik sosial." }
  @{ owner = $nicholas; cover = $covers[14]; title = "Kalkulus Dasar"; author = "Purcell"; category = "Akademik"; condition = "Ada catatan"; location = "UGM, Sleman"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 11000; latitude = -7.771; longitude = 110.378; description = "Buku kalkulus untuk limit, turunan, integral, dan latihan dasar matematika teknik." }
  @{ owner = $nicholas; cover = $covers[15]; title = "Database System Concepts"; author = "Silberschatz"; category = "Akademik"; condition = "Baik"; location = "Seturan"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 15000; latitude = -7.766; longitude = 110.410; description = "Referensi database untuk SQL, desain relasi, transaksi, indeks, dan arsitektur DBMS." }
  @{ owner = $rania; cover = $covers[16]; title = "The Pragmatic Programmer"; author = "Andrew Hunt & David Thomas"; category = "Akademik"; condition = "Seperti baru"; location = "Gejayan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 14000; latitude = -7.778; longitude = 110.388; description = "Buku pengembangan software tentang kebiasaan engineer, desain kode, dan disiplin kerja." }
  @{ owner = $rania; cover = $covers[17]; title = "Sapiens"; author = "Yuval Noah Harari"; category = "Nonfiksi"; condition = "Baik"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 10000; latitude = -7.801; longitude = 110.365; description = "Ringkasan sejarah manusia dari masa purba sampai masyarakat modern." }
  @{ owner = $nicholas; cover = $covers[18]; title = "Rich Dad Poor Dad"; author = "Robert Kiyosaki"; category = "Pengembangan diri"; condition = "Baik"; location = "Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8000; latitude = -7.748; longitude = 110.356; description = "Buku populer tentang literasi finansial, aset, arus kas, dan cara berpikir soal uang." }
  @{ owner = $nicholas; cover = $covers[19]; title = "Matematika Diskrit"; author = "Rinaldi Munir"; category = "Akademik"; condition = "Cukup baik"; location = "Pogung"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 12000; latitude = -7.760; longitude = 110.376; description = "Materi logika, himpunan, relasi, graf, kombinatorika, dan dasar teori komputasi." }
  @{ owner = $rania; cover = $covers[20]; title = "Eloquent JavaScript"; author = "Marijn Haverbeke"; category = "Akademik"; condition = "Baik"; location = "Condongcatur"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 12500; latitude = -7.758; longitude = 110.407; description = "Buku JavaScript modern untuk dasar bahasa, struktur program, DOM, dan pemrograman web." }
  @{ owner = $nicholas; cover = $covers[21]; title = "Dilan 1990"; author = "Pidi Baiq"; category = "Fiksi populer"; condition = "Baik"; location = "Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 7000; latitude = -7.748; longitude = 110.355; description = "Novel remaja populer tentang Dilan dan Milea. Cover ini memakai asset lama frontend yang sekarang ikut di-upload ke backend." }
  @{ owner = $rania; cover = $covers[22]; title = "Bulan"; author = "Tere Liye"; category = "Fiksi populer"; condition = "Seperti baru"; location = "Gejayan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 8000; latitude = -7.777; longitude = 110.389; description = "Novel fantasi dan petualangan dari Tere Liye. Cover berasal dari asset lama frontend lalu dimasukkan ke backend." }
  @{ owner = $nicholas; cover = $covers[23]; title = "Harry Potter"; author = "J.K. Rowling"; category = "Fiksi populer"; condition = "Baik"; location = "UGM, Sleman"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 9000; latitude = -7.771; longitude = 110.377; description = "Kisah dunia sihir yang populer untuk pembaca fantasi. Cover lama frontend sekarang disimpan sebagai cover backend." }
)

$bookSeeds += @(
  @{ owner = $salsa; cover = $covers[22]; title = "Bulan"; author = "Tere Liye"; category = "Novel"; theme = "Fantasi"; condition = "Baik"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 7500; latitude = -7.758; longitude = 110.407; description = "Edisi paperback rapi untuk pembaca seri petualangan Tere Liye." }
  @{ owner = $bima; cover = $covers[22]; title = "Bulan"; author = "Tere Liye"; category = "Novel"; theme = "Adventure"; condition = "Cukup baik"; location = "Seturan"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 6500; latitude = -7.766; longitude = 110.409; description = "Ada sedikit lipatan di beberapa halaman, tetapi isi lengkap dan nyaman dibaca." }
  @{ owner = $dewi; cover = $covers[22]; title = "Bulan"; author = "Tere Liye"; category = "Novel"; theme = "Fantasi"; condition = "Seperti baru"; location = "Pogung, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 9000; latitude = -7.759; longitude = 110.376; description = "Koleksi pribadi yang masih bersih, cocok untuk melanjutkan seri Bumi." }
  @{ owner = $farhan; cover = $covers[2]; title = "Laskar Pelangi"; author = "Andrea Hirata"; category = "Novel"; theme = "Drama"; condition = "Cukup baik"; location = "Kota Yogyakarta"; max_duration = "2 minggu"; handover = "Kurir lokal"; rental_price = 5500; latitude = -7.797; longitude = 110.370; description = "Novel inspiratif tentang sekolah, persahabatan, dan perjuangan anak-anak Belitung." }
  @{ owner = $nadia; cover = $covers[2]; title = "Laskar Pelangi"; author = "Andrea Hirata"; category = "Novel"; theme = "Keluarga"; condition = "Baik"; location = "Bantul"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 7000; latitude = -7.875; longitude = 110.331; description = "Cocok untuk bacaan santai atau referensi tugas literasi sekolah." }
  @{ owner = $yusuf; cover = $covers[1]; title = "Atomic Habits"; author = "James Clear"; category = "Pengembangan diri"; theme = "Kebiasaan"; condition = "Baik"; location = "UGM, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 8500; latitude = -7.771; longitude = 110.377; description = "Buku populer untuk memahami sistem kebiasaan kecil yang konsisten." }
  @{ owner = $dewi; cover = $covers[1]; title = "Atomic Habits"; author = "James Clear"; category = "Pengembangan diri"; theme = "Produktivitas"; condition = "Ada catatan"; location = "Pogung"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 7000; latitude = -7.760; longitude = 110.376; description = "Beberapa halaman diberi stabilo, cocok untuk pembaca yang suka ringkasan visual." }
  @{ owner = $salsa; cover = $covers[5]; title = "Clean Code"; author = "Robert C. Martin"; category = "Teknologi"; theme = "Pemrograman"; condition = "Seperti baru"; location = "Condongcatur"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 15000; latitude = -7.758; longitude = 110.407; description = "Referensi software engineering untuk latihan menulis kode yang mudah dirawat." }
  @{ owner = $bima; cover = $covers[5]; title = "Clean Code"; author = "Robert C. Martin"; category = "Teknologi"; theme = "Pemrograman"; condition = "Cukup baik"; location = "Seturan"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 11500; latitude = -7.766; longitude = 110.409; description = "Buku programming dengan beberapa tanda pakai, isi tetap lengkap." }
  @{ owner = $farhan; cover = $covers[15]; title = "Database System Concepts"; author = "Silberschatz"; category = "Teknologi"; theme = "Database"; condition = "Baik"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Kurir lokal"; rental_price = 14500; latitude = -7.801; longitude = 110.365; description = "Cocok untuk mata kuliah basis data, transaksi, indeks, dan desain relasional." }
  @{ owner = $yusuf; cover = $covers[15]; title = "Database System Concepts"; author = "Silberschatz"; category = "Teknologi"; theme = "Database"; condition = "Ada catatan"; location = "UGM, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 12500; latitude = -7.771; longitude = 110.378; description = "Ada catatan kuliah ringan pada beberapa bab inti database." }
  @{ owner = $nadia; cover = $covers[3]; title = "Bumi Manusia"; author = "Pramoedya Ananta Toer"; category = "Sastra"; theme = "Klasik"; condition = "Baik"; location = "Bantul"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 8500; latitude = -7.875; longitude = 110.331; description = "Novel klasik Indonesia dengan latar kolonial dan konflik sosial yang kuat." }
  @{ owner = $farhan; cover = $covers[3]; title = "Bumi Manusia"; author = "Pramoedya Ananta Toer"; category = "Sastra"; theme = "Sejarah"; condition = "Cukup baik"; location = "Kota Yogyakarta"; max_duration = "2 minggu"; handover = "Kurir lokal"; rental_price = 7000; latitude = -7.797; longitude = 110.370; description = "Edisi lama yang masih layak baca untuk penggemar sastra sejarah." }
  @{ owner = $salsa; cover = $covers[7]; title = "Laut Bercerita"; author = "Leila S. Chudori"; category = "Novel"; theme = "Sejarah"; condition = "Baik"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 8000; latitude = -7.758; longitude = 110.407; description = "Novel Indonesia tentang ingatan keluarga, aktivisme, dan sejarah politik." }
  @{ owner = $dewi; cover = $covers[7]; title = "Laut Bercerita"; author = "Leila S. Chudori"; category = "Novel"; theme = "Drama"; condition = "Seperti baru"; location = "Pogung"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 9500; latitude = -7.759; longitude = 110.376; description = "Kondisi sangat rapi, cocok untuk pembaca novel Indonesia kontemporer." }
  @{ owner = $bima; cover = $covers[20]; title = "Eloquent JavaScript"; author = "Marijn Haverbeke"; category = "Teknologi"; theme = "Pemrograman"; condition = "Baik"; location = "Seturan"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 12000; latitude = -7.766; longitude = 110.409; description = "Referensi JavaScript modern untuk dasar bahasa dan pemrograman web." }
  @{ owner = $yusuf; cover = $covers[20]; title = "Eloquent JavaScript"; author = "Marijn Haverbeke"; category = "Teknologi"; theme = "Pemrograman"; condition = "Cukup baik"; location = "UGM, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 10500; latitude = -7.771; longitude = 110.377; description = "Ada bekas pemakaian ringan, isi masih nyaman untuk belajar." }
  @{ owner = $salsa; cover = $covers[9]; title = "Deep Work"; author = "Cal Newport"; category = "Pengembangan diri"; theme = "Produktivitas"; condition = "Baik"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8500; latitude = -7.758; longitude = 110.407; description = "Buku fokus kerja mendalam untuk belajar mengurangi distraksi digital." }
  @{ owner = $farhan; cover = $covers[9]; title = "Deep Work"; author = "Cal Newport"; category = "Pengembangan diri"; theme = "Karier"; condition = "Seperti baru"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Kurir lokal"; rental_price = 10000; latitude = -7.797; longitude = 110.370; description = "Koleksi rapi untuk pembaca yang ingin membangun rutinitas fokus." }
  @{ owner = $nadia; cover = $covers[21]; title = "Dilan 1990"; author = "Pidi Baiq"; category = "Novel"; theme = "Romance"; condition = "Baik"; location = "Bantul"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 6500; latitude = -7.875; longitude = 110.331; description = "Novel remaja populer dengan cerita ringan dan dialog khas." }
  @{ owner = $bima; cover = $covers[21]; title = "Dilan 1990"; author = "Pidi Baiq"; category = "Novel"; theme = "Romance"; condition = "Cukup baik"; location = "Seturan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 5500; latitude = -7.766; longitude = 110.409; description = "Ada sedikit bekas pakai di cover, halaman masih lengkap." }
  @{ owner = $dewi; cover = $covers[0]; title = "Filosofi Teras"; author = "Henry Manampiring"; category = "Pengembangan diri"; theme = "Mindset"; condition = "Baik"; location = "Pogung"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 8000; latitude = -7.759; longitude = 110.376; description = "Bacaan pengantar stoisisme untuk refleksi dan pengambilan keputusan." }
  @{ owner = $salsa; cover = $covers[0]; title = "Filosofi Teras"; author = "Henry Manampiring"; category = "Pengembangan diri"; theme = "Psikologi"; condition = "Ada catatan"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 6500; latitude = -7.758; longitude = 110.407; description = "Beberapa catatan kecil di margin, cocok untuk diskusi bacaan." }
  @{ owner = $farhan; cover = $covers[18]; title = "Rich Dad Poor Dad"; author = "Robert Kiyosaki"; category = "Bisnis"; theme = "Keuangan"; condition = "Baik"; location = "Kota Yogyakarta"; max_duration = "2 minggu"; handover = "Kurir lokal"; rental_price = 8500; latitude = -7.797; longitude = 110.370; description = "Buku literasi finansial populer tentang aset, arus kas, dan pola pikir uang." }
  @{ owner = $yusuf; cover = $covers[18]; title = "Rich Dad Poor Dad"; author = "Robert Kiyosaki"; category = "Bisnis"; theme = "Investasi"; condition = "Cukup baik"; location = "UGM, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 7000; latitude = -7.771; longitude = 110.377; description = "Edisi terpakai tetapi masih jelas untuk dibaca." }
  @{ owner = $nadia; cover = $covers[13]; title = "Cantik Itu Luka"; author = "Eka Kurniawan"; category = "Sastra"; theme = "Klasik"; condition = "Seperti baru"; location = "Bantul"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 9000; latitude = -7.875; longitude = 110.331; description = "Novel sastra Indonesia dengan nuansa sejarah, keluarga, dan realisme magis." }
  @{ owner = $bima; cover = $covers[14]; title = "Kalkulus Dasar"; author = "Purcell"; category = "Pendidikan"; theme = "Matematika"; condition = "Ada catatan"; location = "Seturan"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 9500; latitude = -7.766; longitude = 110.409; description = "Buku kalkulus dengan coretan latihan dan catatan rumus dasar." }
  @{ owner = $yusuf; cover = $covers[14]; title = "Kalkulus Dasar"; author = "Purcell"; category = "Pendidikan"; theme = "Matematika"; condition = "Baik"; location = "UGM, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 10500; latitude = -7.771; longitude = 110.378; description = "Referensi dasar kalkulus untuk turunan, integral, dan latihan teknik." }
  @{ owner = $salsa; cover = $covers[4]; title = "Algoritma Dasar"; author = "Rinaldi Munir"; category = "Teknologi"; theme = "Pemrograman"; condition = "Baik"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 11500; latitude = -7.758; longitude = 110.407; description = "Cocok untuk belajar struktur data, kompleksitas, dan dasar algoritma." }
  @{ owner = $dewi; cover = $covers[4]; title = "Algoritma Dasar"; author = "Rinaldi Munir"; category = "Teknologi"; theme = "Pemrograman"; condition = "Cukup baik"; location = "Pogung"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 9500; latitude = -7.759; longitude = 110.376; description = "Ada tanda pakai di cover, isi masih lengkap untuk referensi kuliah." }
  @{ owner = $farhan; cover = $covers[17]; title = "Sapiens"; author = "Yuval Noah Harari"; category = "Nonfiksi"; theme = "Sejarah"; condition = "Seperti baru"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Kurir lokal"; rental_price = 11000; latitude = -7.797; longitude = 110.370; description = "Buku sejarah populer tentang perkembangan manusia dan masyarakat." }
  @{ owner = $nadia; cover = $covers[17]; title = "Sapiens"; author = "Yuval Noah Harari"; category = "Nonfiksi"; theme = "Sains populer"; condition = "Baik"; location = "Bantul"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 9500; latitude = -7.875; longitude = 110.331; description = "Cocok untuk pembaca nonfiksi populer dan sejarah manusia." }
  @{ owner = $bima; cover = $covers[16]; title = "The Pragmatic Programmer"; author = "Andrew Hunt & David Thomas"; category = "Teknologi"; theme = "Pemrograman"; condition = "Seperti baru"; location = "Seturan"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 15000; latitude = -7.766; longitude = 110.409; description = "Buku praktik software engineering untuk kebiasaan engineer sehari-hari." }
  @{ owner = $salsa; cover = $covers[16]; title = "The Pragmatic Programmer"; author = "Andrew Hunt & David Thomas"; category = "Teknologi"; theme = "Pemrograman"; condition = "Baik"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 13500; latitude = -7.758; longitude = 110.407; description = "Referensi ringkas untuk desain kode, debugging, dan disiplin pengembangan." }
  @{ owner = $dewi; cover = $covers[10]; title = "The Lean Startup"; author = "Eric Ries"; category = "Bisnis"; theme = "Startup"; condition = "Baik"; location = "Pogung"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 9500; latitude = -7.759; longitude = 110.376; description = "Buku validasi ide produk, eksperimen cepat, dan pembelajaran startup." }
  @{ owner = $farhan; cover = $covers[10]; title = "The Lean Startup"; author = "Eric Ries"; category = "Bisnis"; theme = "Kewirausahaan"; condition = "Cukup baik"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Kurir lokal"; rental_price = 8500; latitude = -7.797; longitude = 110.370; description = "Edisi terpakai untuk bacaan bisnis dan pengembangan produk." }
  @{ owner = $nadia; cover = $covers[6]; title = "Psikologi Uang"; author = "Morgan Housel"; category = "Bisnis"; theme = "Keuangan"; condition = "Baik"; location = "Bantul"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8000; latitude = -7.875; longitude = 110.331; description = "Kumpulan cerita pendek tentang perilaku manusia saat mengambil keputusan finansial." }
  @{ owner = $yusuf; cover = $covers[6]; title = "Psikologi Uang"; author = "Morgan Housel"; category = "Bisnis"; theme = "Investasi"; condition = "Seperti baru"; location = "UGM, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 9500; latitude = -7.771; longitude = 110.377; description = "Kondisi rapi untuk bacaan literasi finansial yang ringan." }
  @{ owner = $salsa; cover = $covers[8]; title = "Data Science dari Nol"; author = "Joel Grus"; category = "Teknologi"; theme = "Data science"; condition = "Baik"; location = "Condongcatur"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 13500; latitude = -7.758; longitude = 110.407; description = "Pengantar data science, Python, statistik, dan machine learning dasar." }
  @{ owner = $bima; cover = $covers[8]; title = "Data Science dari Nol"; author = "Joel Grus"; category = "Teknologi"; theme = "AI"; condition = "Cukup baik"; location = "Seturan"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 12000; latitude = -7.766; longitude = 110.409; description = "Ada beberapa catatan latihan, cocok untuk pemula yang belajar mandiri." }
  @{ owner = $dewi; cover = $covers[23]; title = "Harry Potter"; author = "J.K. Rowling"; category = "Novel"; theme = "Fantasi"; condition = "Baik"; location = "Pogung"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 8500; latitude = -7.759; longitude = 110.376; description = "Bacaan fantasi populer dengan kondisi halaman masih lengkap dan rapi." }
  @{ owner = $farhan; cover = $covers[23]; title = "Harry Potter"; author = "J.K. Rowling"; category = "Novel"; theme = "Adventure"; condition = "Cukup baik"; location = "Kota Yogyakarta"; max_duration = "2 minggu"; handover = "Kurir lokal"; rental_price = 7500; latitude = -7.797; longitude = 110.370; description = "Ada tanda pakai di cover, isi tetap nyaman dibaca." }
)

$bookSeeds += @(
  @{ owner = $lara; cover = $covers[11]; title = "Sprint"; author = "Jake Knapp"; category = "Bisnis"; theme = "Produk"; condition = "Baik"; location = "Kotabaru, Yogyakarta"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 10500; latitude = -7.783; longitude = 110.373; description = "Panduan design sprint untuk memvalidasi ide produk dalam waktu singkat." }
  @{ owner = $kevin; cover = $covers[8]; title = "Python Crash Course"; author = "Eric Matthes"; category = "Teknologi"; theme = "Pemrograman"; condition = "Seperti baru"; location = "Babarsari"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 14000; latitude = -7.773; longitude = 110.414; description = "Buku pemrograman Python untuk pemula dengan proyek praktis dan latihan dasar." }
  @{ owner = $mira; cover = $covers[12]; title = "Sebuah Seni untuk Bersikap Bodo Amat"; author = "Mark Manson"; category = "Pengembangan diri"; theme = "Mindset"; condition = "Baik"; location = "Maguwoharjo"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8000; latitude = -7.754; longitude = 110.433; description = "Buku populer tentang prioritas hidup, pilihan, dan cara memandang masalah." }
  @{ owner = $adit; cover = $covers[6]; title = "The Psychology of Money"; author = "Morgan Housel"; category = "Bisnis"; theme = "Keuangan"; condition = "Seperti baru"; location = "Jalan Kaliurang"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 9500; latitude = -7.743; longitude = 110.380; description = "Versi bahasa Inggris dari buku perilaku finansial yang populer." }
  @{ owner = $intan; cover = $covers[13]; title = "Pulang"; author = "Tere Liye"; category = "Novel"; theme = "Drama"; condition = "Baik"; location = "Demangan"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 7500; latitude = -7.783; longitude = 110.392; description = "Novel Tere Liye tentang keluarga, pilihan hidup, dan perjalanan pulang." }
  @{ owner = $galih; cover = $covers[17]; title = "Homo Deus"; author = "Yuval Noah Harari"; category = "Nonfiksi"; theme = "Sains populer"; condition = "Cukup baik"; location = "Godean"; max_duration = "1 bulan"; handover = "Kurir lokal"; rental_price = 9500; latitude = -7.767; longitude = 110.293; description = "Lanjutan diskusi sejarah manusia, teknologi, data, dan masa depan masyarakat." }
  @{ owner = $lara; cover = $covers[20]; title = "JavaScript: The Good Parts"; author = "Douglas Crockford"; category = "Teknologi"; theme = "Pemrograman"; condition = "Baik"; location = "Kotabaru"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 11000; latitude = -7.783; longitude = 110.373; description = "Buku ringkas tentang bagian penting JavaScript dan gaya penulisan yang lebih bersih." }
  @{ owner = $kevin; cover = $covers[15]; title = "SQL Antipatterns"; author = "Bill Karwin"; category = "Teknologi"; theme = "Database"; condition = "Baik"; location = "Babarsari"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 12500; latitude = -7.773; longitude = 110.414; description = "Referensi praktis untuk menghindari pola desain database yang sering bermasalah." }
  @{ owner = $mira; cover = $covers[2]; title = "Ronggeng Dukuh Paruk"; author = "Ahmad Tohari"; category = "Sastra"; theme = "Klasik"; condition = "Baik"; location = "Maguwoharjo"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 7000; latitude = -7.754; longitude = 110.433; description = "Novel sastra Indonesia tentang tradisi, politik, dan perubahan sosial." }
  @{ owner = $adit; cover = $covers[7]; title = "Amba"; author = "Laksmi Pamuntjak"; category = "Sastra"; theme = "Sejarah"; condition = "Seperti baru"; location = "Jalan Kaliurang"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8500; latitude = -7.743; longitude = 110.380; description = "Novel sejarah Indonesia dengan narasi keluarga dan ingatan masa lalu." }
  @{ owner = $intan; cover = $covers[0]; title = "Man's Search for Meaning"; author = "Viktor E. Frankl"; category = "Pengembangan diri"; theme = "Psikologi"; condition = "Baik"; location = "Demangan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 8500; latitude = -7.783; longitude = 110.392; description = "Buku psikologi klasik tentang makna hidup, ketahanan, dan pengalaman manusia." }
  @{ owner = $galih; cover = $covers[10]; title = "Zero to One"; author = "Peter Thiel"; category = "Bisnis"; theme = "Startup"; condition = "Baik"; location = "Godean"; max_duration = "2 minggu"; handover = "Kurir lokal"; rental_price = 9000; latitude = -7.767; longitude = 110.293; description = "Buku startup tentang membangun sesuatu yang benar-benar baru dan bernilai." }
  @{ owner = $lara; cover = $covers[22]; title = "Matahari"; author = "Tere Liye"; category = "Novel"; theme = "Fantasi"; condition = "Baik"; location = "Kotabaru"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8000; latitude = -7.783; longitude = 110.373; description = "Lanjutan seri fantasi Tere Liye dengan petualangan dunia paralel." }
  @{ owner = $kevin; cover = $covers[22]; title = "Matahari"; author = "Tere Liye"; category = "Novel"; theme = "Adventure"; condition = "Cukup baik"; location = "Babarsari"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 6500; latitude = -7.773; longitude = 110.414; description = "Edisi terpakai dengan isi lengkap, cocok untuk melanjutkan seri Bulan." }
  @{ owner = $mira; cover = $covers[1]; title = "Atomic Habits"; author = "James Clear"; category = "Pengembangan diri"; theme = "Produktivitas"; condition = "Seperti baru"; location = "Maguwoharjo"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 10000; latitude = -7.754; longitude = 110.433; description = "Kondisi sangat rapi untuk pembaca yang ingin membangun kebiasaan baru." }
  @{ owner = $adit; cover = $covers[5]; title = "Clean Code"; author = "Robert C. Martin"; category = "Teknologi"; theme = "Pemrograman"; condition = "Baik"; location = "Jalan Kaliurang"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 14500; latitude = -7.743; longitude = 110.380; description = "Edisi rapi untuk belajar prinsip clean code dan refactoring dasar." }
)

$bookSeeds += @(
  @{ owner = $ammar; cover = $covers[5]; title = "Clean Code"; author = "Robert C. Martin"; category = "Teknologi"; theme = "Pemrograman"; condition = "Seperti baru"; location = "Kampus UII, Sleman"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 15000; latitude = -7.687; longitude = 110.414; description = "Koleksi Ammar untuk pembaca yang ingin belajar menulis kode lebih rapi dan mudah dirawat." }
  @{ owner = $ammar; cover = $covers[4]; title = "Algoritma Dasar"; author = "Rinaldi Munir"; category = "Teknologi"; theme = "Pemrograman"; condition = "Baik"; location = "Kampus UII, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 12000; latitude = -7.687; longitude = 110.414; description = "Buku kuliah algoritma dengan catatan kecil di beberapa halaman latihan." }
  @{ owner = $ammar; cover = $covers[15]; title = "Database System Concepts"; author = "Silberschatz"; category = "Teknologi"; theme = "Database"; condition = "Baik"; location = "Kaliurang, Sleman"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 14500; latitude = -7.704; longitude = 110.405; description = "Referensi basis data untuk SQL, transaksi, indeks, dan desain relasi." }
  @{ owner = $ammar; cover = $covers[8]; title = "Data Science dari Nol"; author = "Joel Grus"; category = "Teknologi"; theme = "Data science"; condition = "Cukup baik"; location = "Kampus UII, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 13000; latitude = -7.687; longitude = 110.414; description = "Buku pengantar data science, statistik, Python, dan machine learning dasar." }
  @{ owner = $ammar; cover = $covers[1]; title = "Atomic Habits"; author = "James Clear"; category = "Pengembangan diri"; theme = "Produktivitas"; condition = "Seperti baru"; location = "Kaliurang, Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 9000; latitude = -7.704; longitude = 110.405; description = "Buku kebiasaan kecil yang cocok untuk mahasiswa yang ingin membangun rutinitas belajar." }
  @{ owner = $ammar; cover = $covers[9]; title = "Deep Work"; author = "Cal Newport"; category = "Pengembangan diri"; theme = "Produktivitas"; condition = "Baik"; location = "Kampus UII, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 8500; latitude = -7.687; longitude = 110.414; description = "Bacaan fokus mendalam untuk mengurangi distraksi dan meningkatkan kualitas kerja." }
  @{ owner = $ammar; cover = $covers[22]; title = "Bulan"; author = "Tere Liye"; category = "Novel"; theme = "Fantasi"; condition = "Baik"; location = "Kaliurang, Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 7500; latitude = -7.704; longitude = 110.405; description = "Novel fantasi Tere Liye dari koleksi pribadi Ammar, cocok untuk bacaan santai." }
  @{ owner = $ammar; cover = $covers[3]; title = "Bumi Manusia"; author = "Pramoedya Ananta Toer"; category = "Sastra"; theme = "Sejarah"; condition = "Baik"; location = "Kampus UII, Sleman"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 8500; latitude = -7.687; longitude = 110.414; description = "Novel sejarah Indonesia dengan latar kolonial dan konflik sosial yang kuat." }
  @{ owner = $ammar; cover = $covers[10]; title = "The Lean Startup"; author = "Eric Ries"; category = "Bisnis"; theme = "Startup"; condition = "Baik"; location = "Kaliurang, Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 9500; latitude = -7.704; longitude = 110.405; description = "Buku validasi produk, eksperimen cepat, dan iterasi startup." }
  @{ owner = $ammar; cover = $covers[6]; title = "Psikologi Uang"; author = "Morgan Housel"; category = "Bisnis"; theme = "Keuangan"; condition = "Seperti baru"; location = "Kampus UII, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 8500; latitude = -7.687; longitude = 110.414; description = "Bacaan ringan tentang perilaku manusia saat mengambil keputusan finansial." }
)

$titleOccurrences = @{}
foreach ($seed in $bookSeeds) {
  $titleKey = ConvertTo-Slug -Value $seed.title
  if (-not $titleOccurrences.ContainsKey($titleKey)) {
    $titleOccurrences[$titleKey] = 0
  }
  $titleOccurrences[$titleKey]++

  $seed.cover = Get-BookCover `
    -Title $seed.title `
    -Author $seed.author `
    -FallbackPath $seed.cover `
    -VariantIndex $titleOccurrences[$titleKey]
}

$createdBooks = @()
foreach ($seed in $bookSeeds) {
  $createdBooks += New-Book -Owner $seed.owner -Book $seed
}

$pending = Request-Borrow -Borrower $ammar -BookId ([int]$createdBooks[0].id) -StartDate "2026-05-22" -Days 14 -Handover "Area kampus" -Location "Perpustakaan pusat UGM" -Note "Saya butuh untuk tugas refleksi. Bisa ambil Jumat sore."
$accepted = Request-Borrow -Borrower $ammar -BookId ([int]$createdBooks[3].id) -StartDate "2026-05-20" -Days 14 -Handover "Titik temu publik" -Location "Titik Nol Yogyakarta" -Note "Saya fleksibel sore hari."
Respond-Borrow -Owner $rania -TransactionId ([int]$accepted.data.id) -Status "ACCEPTED"

$completed = Request-Borrow -Borrower $ammar -BookId ([int]$createdBooks[4].id) -StartDate "2026-05-01" -Days 14 -Handover "Kurir lokal" -Location "Kampus ISI Yogyakarta" -Note "Pinjam untuk riset sastra sejarah."
Respond-Borrow -Owner $rania -TransactionId ([int]$completed.data.id) -Status "ACCEPTED"
Return-Borrow -Borrower $ammar -TransactionId ([int]$completed.data.id)
Complete-Borrow -Owner $rania -TransactionId ([int]$completed.data.id)
Rate-Borrow -Borrower $ammar -TransactionId ([int]$completed.data.id) -Rating 5 -Comment "Bukunya rapi dan pemilik responsif."

$transactionPlans = @(
  @{ borrower = $salsa; owner = $rania; bookIndex = 5; start = "2026-04-08"; days = 14; rating = 5; comment = "Clean Code masih enak dibaca dan cover aman." }
  @{ borrower = $bima; owner = $nicholas; bookIndex = 6; start = "2026-04-10"; days = 14; rating = 4; comment = "Isi lengkap, cocok untuk bacaan finansial." }
  @{ borrower = $dewi; owner = $rania; bookIndex = 7; start = "2026-04-12"; days = 14; rating = 5; comment = "Novel sangat rapi, transaksi lancar." }
  @{ borrower = $farhan; owner = $nicholas; bookIndex = 8; start = "2026-04-13"; days = 21; rating = 4; comment = "Buku data science lengkap, beberapa halaman ada tanda pakai." }
  @{ borrower = $nadia; owner = $nicholas; bookIndex = 9; start = "2026-04-15"; days = 14; rating = 5; comment = "Kondisi seperti baru." }
  @{ borrower = $yusuf; owner = $rania; bookIndex = 10; start = "2026-04-16"; days = 14; rating = 4; comment = "Buku startup membantu untuk tugas produk." }
  @{ borrower = $lara; owner = $rania; bookIndex = 11; start = "2026-04-17"; days = 21; rating = 5; comment = "Design Thinking sangat bersih." }
  @{ borrower = $kevin; owner = $nicholas; bookIndex = 12; start = "2026-04-18"; days = 14; rating = 4; comment = "Buku inspiratif, peminjaman mudah." }
  @{ borrower = $mira; owner = $rania; bookIndex = 13; start = "2026-04-19"; days = 14; rating = 5; comment = "Cantik Itu Luka sampai dalam kondisi bagus." }
  @{ borrower = $adit; owner = $nicholas; bookIndex = 14; start = "2026-04-20"; days = 21; rating = 4; comment = "Kalkulusnya membantu untuk latihan." }
  @{ borrower = $intan; owner = $nicholas; bookIndex = 15; start = "2026-04-21"; days = 14; rating = 5; comment = "Database System Concepts lengkap dan bersih." }
  @{ borrower = $galih; owner = $rania; bookIndex = 16; start = "2026-04-22"; days = 14; rating = 5; comment = "The Pragmatic Programmer sangat rapi." }
  @{ borrower = $ammar; owner = $rania; bookIndex = 17; start = "2026-04-23"; days = 21; rating = 4; comment = "Sapiens nyaman dibaca." }
  @{ borrower = $salsa; owner = $nicholas; bookIndex = 18; start = "2026-04-24"; days = 14; rating = 4; comment = "Rich Dad Poor Dad cukup bagus." }
  @{ borrower = $bima; owner = $nicholas; bookIndex = 19; start = "2026-04-25"; days = 14; rating = 3; comment = "Ada catatan, tapi masih berguna." }
  @{ borrower = $dewi; owner = $rania; bookIndex = 20; start = "2026-04-26"; days = 21; rating = 5; comment = "Eloquent JavaScript bagus untuk referensi." }
  @{ borrower = $farhan; owner = $nicholas; bookIndex = 21; start = "2026-04-27"; days = 14; rating = 4; comment = "Dilan masih layak baca." }
  @{ borrower = $nadia; owner = $salsa; bookIndex = 24; start = "2026-04-28"; days = 14; rating = 5; comment = "Bulan edisi ini bersih." }
  @{ borrower = $yusuf; owner = $bima; bookIndex = 25; start = "2026-04-29"; days = 14; rating = 4; comment = "Harga murah dan kondisi cukup." }
  @{ borrower = $lara; owner = $dewi; bookIndex = 26; start = "2026-05-01"; days = 14; rating = 5; comment = "Pemilik ramah, buku seperti baru." }
  @{ borrower = $kevin; owner = $farhan; bookIndex = 27; start = "2026-05-02"; days = 14; rating = 4; comment = "Laskar Pelangi cocok untuk tugas literasi." }
  @{ borrower = $mira; owner = $nadia; bookIndex = 28; start = "2026-05-03"; days = 21; rating = 5; comment = "Buku rapi dan mudah diambil." }
  @{ borrower = $adit; owner = $yusuf; bookIndex = 29; start = "2026-05-04"; days = 14; rating = 4; comment = "Atomic Habits membantu untuk habit tracking." }
  @{ borrower = $intan; owner = $dewi; bookIndex = 30; start = "2026-05-05"; days = 14; rating = 3; comment = "Ada stabilo, tapi masih nyaman." }
  @{ borrower = $galih; owner = $salsa; bookIndex = 31; start = "2026-05-06"; days = 14; rating = 5; comment = "Clean Code seperti baru." }
  @{ borrower = $ammar; owner = $bima; bookIndex = 32; start = "2026-05-07"; days = 14; rating = 4; comment = "Cukup baik untuk belajar refactoring." }
  @{ borrower = $salsa; owner = $farhan; bookIndex = 33; start = "2026-05-08"; days = 21; rating = 5; comment = "Database lengkap dan kondisi bagus." }
  @{ borrower = $bima; owner = $yusuf; bookIndex = 34; start = "2026-05-09"; days = 14; rating = 4; comment = "Ada catatan kuliah yang membantu." }
)

foreach ($plan in $transactionPlans) {
  $transaction = Request-Borrow `
    -Borrower $plan.borrower `
    -BookId ([int]$createdBooks[$plan.bookIndex].id) `
    -StartDate $plan.start `
    -Days ([int]$plan.days) `
    -Handover "Titik temu publik" `
    -Location "Area kampus Yogyakarta" `
    -Note "Seed riwayat peminjaman untuk pengujian katalog dan rating."
  Respond-Borrow -Owner $plan.owner -TransactionId ([int]$transaction.data.id) -Status "ACCEPTED"
  Return-Borrow -Borrower $plan.borrower -TransactionId ([int]$transaction.data.id)
  Complete-Borrow -Owner $plan.owner -TransactionId ([int]$transaction.data.id)
  Rate-Borrow -Borrower $plan.borrower -TransactionId ([int]$transaction.data.id) -Rating ([int]$plan.rating) -Comment $plan.comment
}

$personalHistoryPlans = @(
  @{ borrower = $ammar; bookIndex = 29; start = "2026-03-01"; days = 14; rating = 5; comment = "Atomic Habits cocok dengan bacaan pengembangan diri saya." }
  @{ borrower = $ammar; bookIndex = 30; start = "2026-03-16"; days = 14; rating = 4; comment = "Masih satu tema produktivitas dan kebiasaan." }
  @{ borrower = $ammar; bookIndex = 39; start = "2026-03-31"; days = 14; rating = 5; comment = "Deep Work pas untuk fokus belajar." }
  @{ borrower = $ammar; bookIndex = 44; start = "2026-04-14"; days = 14; rating = 4; comment = "Filosofi Teras membantu untuk refleksi." }
  @{ borrower = $salsa; bookIndex = 31; start = "2026-03-02"; days = 21; rating = 5; comment = "Clean Code bagus untuk programming." }
  @{ borrower = $salsa; bookIndex = 32; start = "2026-03-24"; days = 14; rating = 4; comment = "Masih relevan untuk refactoring." }
  @{ borrower = $salsa; bookIndex = 49; start = "2026-04-08"; days = 14; rating = 5; comment = "Algoritma Dasar cocok untuk kuliah." }
  @{ borrower = $salsa; bookIndex = 54; start = "2026-04-22"; days = 21; rating = 5; comment = "Pragmatic Programmer jadi favorit software engineering." }
  @{ borrower = $bima; bookIndex = 24; start = "2026-03-03"; days = 14; rating = 5; comment = "Bulan enak untuk bacaan fantasi." }
  @{ borrower = $bima; bookIndex = 25; start = "2026-03-18"; days = 14; rating = 4; comment = "Masih suka petualangan Tere Liye." }
  @{ borrower = $bima; bookIndex = 64; start = "2026-04-02"; days = 21; rating = 5; comment = "Harry Potter cocok untuk fantasi ringan." }
  @{ borrower = $bima; bookIndex = 60; start = "2026-04-24"; days = 14; rating = 4; comment = "Dilan jadi selingan novel santai." }
  @{ borrower = $dewi; bookIndex = 27; start = "2026-03-04"; days = 14; rating = 5; comment = "Laskar Pelangi menarik untuk novel Indonesia." }
  @{ borrower = $dewi; bookIndex = 28; start = "2026-03-19"; days = 14; rating = 5; comment = "Tema keluarga dan pendidikan kuat." }
  @{ borrower = $dewi; bookIndex = 40; start = "2026-04-03"; days = 21; rating = 5; comment = "Bumi Manusia cocok untuk sastra sejarah." }
  @{ borrower = $dewi; bookIndex = 59; start = "2026-04-25"; days = 14; rating = 4; comment = "Cantik Itu Luka masih masuk selera sastra." }
  @{ borrower = $farhan; bookIndex = 33; start = "2026-03-05"; days = 14; rating = 5; comment = "Database System Concepts berguna untuk tugas." }
  @{ borrower = $farhan; bookIndex = 34; start = "2026-03-20"; days = 14; rating = 4; comment = "Buku database dengan catatan kuliah membantu." }
  @{ borrower = $farhan; bookIndex = 61; start = "2026-04-04"; days = 21; rating = 4; comment = "Kalkulus Dasar cocok untuk referensi akademik." }
  @{ borrower = $farhan; bookIndex = 50; start = "2026-04-26"; days = 14; rating = 5; comment = "Algoritma Dasar melengkapi bacaan teknologi." }
  @{ borrower = $nadia; bookIndex = 40; start = "2026-03-06"; days = 14; rating = 5; comment = "Bumi Manusia jadi bacaan sastra favorit." }
  @{ borrower = $nadia; bookIndex = 41; start = "2026-03-21"; days = 14; rating = 4; comment = "Sastra sejarahnya kuat." }
  @{ borrower = $nadia; bookIndex = 42; start = "2026-04-05"; days = 21; rating = 5; comment = "Laut Bercerita sangat cocok." }
  @{ borrower = $nadia; bookIndex = 59; start = "2026-04-27"; days = 14; rating = 5; comment = "Novel sastra Indonesia masih jadi pilihan." }
  @{ borrower = $yusuf; bookIndex = 49; start = "2026-03-07"; days = 14; rating = 5; comment = "Algoritma Dasar membantu kuliah." }
  @{ borrower = $yusuf; bookIndex = 50; start = "2026-03-22"; days = 14; rating = 4; comment = "Bacaan pemrograman tetap relevan." }
  @{ borrower = $yusuf; bookIndex = 52; start = "2026-04-06"; days = 21; rating = 5; comment = "Data Science dari Nol menarik untuk AI." }
  @{ borrower = $yusuf; bookIndex = 53; start = "2026-04-28"; days = 14; rating = 4; comment = "Tema data science cocok dengan minat saya." }
  @{ borrower = $lara; bookIndex = 55; start = "2026-03-08"; days = 14; rating = 5; comment = "The Lean Startup cocok untuk produk." }
  @{ borrower = $lara; bookIndex = 56; start = "2026-03-23"; days = 14; rating = 4; comment = "Bacaan kewirausahaan tetap menarik." }
  @{ borrower = $lara; bookIndex = 57; start = "2026-04-07"; days = 21; rating = 5; comment = "Psikologi Uang cocok untuk bisnis dan finansial." }
  @{ borrower = $lara; bookIndex = 58; start = "2026-04-29"; days = 14; rating = 4; comment = "Tema investasi masih relevan." }
  @{ borrower = $kevin; bookIndex = 31; start = "2026-03-09"; days = 14; rating = 5; comment = "Programming jadi minat utama." }
  @{ borrower = $kevin; bookIndex = 49; start = "2026-03-24"; days = 14; rating = 5; comment = "Algoritma membantu latihan coding." }
  @{ borrower = $kevin; bookIndex = 52; start = "2026-04-08"; days = 21; rating = 4; comment = "Data science menambah referensi." }
  @{ borrower = $kevin; bookIndex = 65; start = "2026-04-30"; days = 14; rating = 4; comment = "Fantasi jadi bacaan jeda." }
  @{ borrower = $mira; bookIndex = 24; start = "2026-03-10"; days = 14; rating = 5; comment = "Bulan cocok untuk novel fantasi." }
  @{ borrower = $mira; bookIndex = 26; start = "2026-03-25"; days = 14; rating = 5; comment = "Masih suka seri Tere Liye." }
  @{ borrower = $mira; bookIndex = 64; start = "2026-04-09"; days = 21; rating = 4; comment = "Harry Potter enak dibaca santai." }
  @{ borrower = $mira; bookIndex = 42; start = "2026-05-01"; days = 14; rating = 5; comment = "Novel drama sejarah juga cocok." }
  @{ borrower = $adit; bookIndex = 61; start = "2026-03-11"; days = 14; rating = 5; comment = "Kalkulus membantu latihan." }
  @{ borrower = $adit; bookIndex = 62; start = "2026-03-26"; days = 14; rating = 4; comment = "Matematika tetap jadi kebutuhan." }
  @{ borrower = $adit; bookIndex = 33; start = "2026-04-10"; days = 21; rating = 5; comment = "Database cocok untuk tugas akhir." }
  @{ borrower = $adit; bookIndex = 34; start = "2026-05-02"; days = 14; rating = 4; comment = "Referensi database dengan catatan berguna." }
  @{ borrower = $intan; bookIndex = 44; start = "2026-03-12"; days = 14; rating = 5; comment = "Filosofi Teras cocok untuk refleksi." }
  @{ borrower = $intan; bookIndex = 45; start = "2026-03-27"; days = 14; rating = 4; comment = "Masih suka tema psikologi." }
  @{ borrower = $intan; bookIndex = 39; start = "2026-04-11"; days = 21; rating = 5; comment = "Deep Work membantu produktivitas." }
  @{ borrower = $intan; bookIndex = 29; start = "2026-05-03"; days = 14; rating = 5; comment = "Atomic Habits cocok untuk kebiasaan." }
  @{ borrower = $galih; bookIndex = 55; start = "2026-03-13"; days = 14; rating = 5; comment = "Startup dan bisnis cocok untuk saya." }
  @{ borrower = $galih; bookIndex = 46; start = "2026-03-28"; days = 14; rating = 4; comment = "Keuangan pribadi menarik." }
  @{ borrower = $galih; bookIndex = 57; start = "2026-04-12"; days = 21; rating = 5; comment = "Psikologi Uang mudah dipahami." }
  @{ borrower = $galih; bookIndex = 58; start = "2026-05-04"; days = 14; rating = 4; comment = "Investasi tetap jadi minat." }
)

foreach ($plan in $personalHistoryPlans) {
  $bookIndex = [int]$plan.bookIndex
  $owner = $bookSeeds[$bookIndex].owner
  if ($owner.email -eq $plan.borrower.email) {
    continue
  }

  $transaction = Request-Borrow `
    -Borrower $plan.borrower `
    -BookId ([int]$createdBooks[$bookIndex].id) `
    -StartDate $plan.start `
    -Days ([int]$plan.days) `
    -Handover "Titik temu publik" `
    -Location "Area kampus Yogyakarta" `
    -Note "Seed riwayat personalisasi katalog."
  Respond-Borrow -Owner $owner -TransactionId ([int]$transaction.data.id) -Status "ACCEPTED"
  Return-Borrow -Borrower $plan.borrower -TransactionId ([int]$transaction.data.id)
  Complete-Borrow -Owner $owner -TransactionId ([int]$transaction.data.id)
  Rate-Borrow -Borrower $plan.borrower -TransactionId ([int]$transaction.data.id) -Rating ([int]$plan.rating) -Comment $plan.comment
}

$returnPending = Request-Borrow -Borrower $kevin -BookId ([int]$createdBooks[35].id) -StartDate "2026-05-15" -Days 14 -Handover "Area kampus" -Location "Perpustakaan Fakultas Teknik" -Note "Sudah selesai dibaca, siap dikembalikan."
Respond-Borrow -Owner $nadia -TransactionId ([int]$returnPending.data.id) -Status "ACCEPTED"
Return-Borrow -Borrower $kevin -TransactionId ([int]$returnPending.data.id)

$accepted2 = Request-Borrow -Borrower $mira -BookId ([int]$createdBooks[36].id) -StartDate "2026-05-18" -Days 14 -Handover "Titik temu publik" -Location "Kafe dekat kampus" -Note "Masih saya pakai untuk kelas minggu ini."
Respond-Borrow -Owner $farhan -TransactionId ([int]$accepted2.data.id) -Status "ACCEPTED"

$pending2 = Request-Borrow -Borrower $intan -BookId ([int]$createdBooks[37].id) -StartDate "2026-05-25" -Days 14 -Handover "Area kampus" -Location "Demangan" -Note "Boleh pinjam untuk dua minggu?"
$pending3 = Request-Borrow -Borrower $galih -BookId ([int]$createdBooks[38].id) -StartDate "2026-05-26" -Days 21 -Handover "Kurir lokal" -Location "Godean" -Note "Untuk referensi tugas akhir."

$ammarBookStartIndex = $createdBooks.Count - 10
$ammarIncomingPlans = @(
  @{ borrower = $salsa; offset = 0; start = "2026-05-20"; days = 14; status = "pending"; note = "Mau pinjam Clean Code dari Ammar untuk latihan refactoring." }
  @{ borrower = $bima; offset = 1; start = "2026-05-18"; days = 14; status = "accepted"; note = "Butuh Algoritma Dasar untuk persiapan ujian." }
  @{ borrower = $dewi; offset = 2; start = "2026-05-12"; days = 21; status = "return_pending"; note = "Database System Concepts sudah selesai dibaca." }
  @{ borrower = $farhan; offset = 4; start = "2026-05-01"; days = 14; status = "completed"; rating = 5; comment = "Atomic Habits punya Ammar masih sangat rapi." }
  @{ borrower = $nadia; offset = 7; start = "2026-05-03"; days = 21; status = "completed"; rating = 4; comment = "Bumi Manusia cocok untuk referensi sastra." }
)

foreach ($plan in $ammarIncomingPlans) {
  $transaction = Request-Borrow `
    -Borrower $plan.borrower `
    -BookId ([int]$createdBooks[$ammarBookStartIndex + [int]$plan.offset].id) `
    -StartDate $plan.start `
    -Days ([int]$plan.days) `
    -Handover "Area kampus" `
    -Location "Kampus UII atau titik temu Kaliurang" `
    -Note $plan.note

  if ($plan.status -ne "pending") {
    Respond-Borrow -Owner $ammar -TransactionId ([int]$transaction.data.id) -Status "ACCEPTED"
  }
  if ($plan.status -eq "return_pending" -or $plan.status -eq "completed") {
    Return-Borrow -Borrower $plan.borrower -TransactionId ([int]$transaction.data.id)
  }
  if ($plan.status -eq "completed") {
    Complete-Borrow -Owner $ammar -TransactionId ([int]$transaction.data.id)
    Rate-Borrow -Borrower $plan.borrower -TransactionId ([int]$transaction.data.id) -Rating ([int]$plan.rating) -Comment $plan.comment
  }
}

New-Chat -Sender $ammar -ParticipantId ([int]$nicholas.id) -BookId ([int]$createdBooks[1].id) -Messages @(
  "Halo kak, Atomic Habits masih bisa dipinjam minggu ini?",
  "Kalau bisa saya ambil di sekitar kampus hari Jumat sore."
)

New-Chat -Sender $ammar -ParticipantId ([int]$rania.id) -BookId ([int]$createdBooks[7].id) -Messages @(
  "Halo, saya tertarik pinjam Laut Bercerita untuk dua minggu.",
  "Cover dan kondisi bukunya masih aman ya kak?"
)

Write-Host ""
Write-Host "Seed dummy data selesai." -ForegroundColor Green
Write-Host "Login internal:"
Write-Host "  Admin    : admin@unilibra.local / $internalPassword"
Write-Host "  Owner 1  : nicholas@unilibra.local / $internalPassword"
Write-Host "  Owner 2  : rania@unilibra.local / $internalPassword"
Write-Host "  Peminjam : ammar@unilibra.local / $internalPassword"
Write-Host "  Pembaca  : lara@unilibra.local / $internalPassword"
Write-Host ""
Write-Host "Data dibuat:"
Write-Host "  Users    : 16"
Write-Host "  Books    : $($createdBooks.Count)"
Write-Host "  Transaksi: 86+"
Write-Host "  Rating   : 77"
Write-Host "  Chat     : 2 thread"
