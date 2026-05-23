param(
  [string]$ApiUrl = "http://localhost:8080",
  [string]$DbContainer = "unilibra-postgres",
  [string]$DbUser = "unilibra",
  [string]$DbName = "unilibra",
  [switch]$SkipCleanup
)

$ErrorActionPreference = "Stop"

$demoPassword = "password123"
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
      password = $demoPassword
      city = $City
    } | Out-Null
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 409) {
      throw
    }
  }

  $login = Invoke-Json -Method "Post" -Url "$ApiUrl/api/login" -Body @{
    email = $Email
    password = $demoPassword
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

  $graphics.DrawString("UNILIBRA DEMO", $fontBadge, $lineBrush, 92, 126)
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
    [string]$FallbackPath
  )

  $safeTitle = $Title -replace "^\[DEMO\]\s*", ""
  $slug = ConvertTo-Slug -Value "$safeTitle-$Author"
  $targetPath = Join-Path $coverDir "web-$slug.jpg"

  try {
    $searchUrl = "https://openlibrary.org/search.json?title=$([uri]::EscapeDataString($safeTitle))&author=$([uri]::EscapeDataString($Author))&limit=3"
    $headers = @{ "User-Agent" = "UniLibra local seed script" }
    $result = Invoke-RestMethod -Uri $searchUrl -Method Get -Headers $headers -TimeoutSec 20
    $match = $result.docs | Where-Object { $_.cover_i } | Select-Object -First 1

    if (-not $match) {
      return $FallbackPath
    }

    $coverUrl = "https://covers.openlibrary.org/b/id/$($match.cover_i)-L.jpg"
    Invoke-WebRequest -Uri $coverUrl -Headers $headers -OutFile $targetPath -TimeoutSec 30 | Out-Null

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

function Cleanup-DemoData {
  $sql = @"
CREATE TEMP TABLE seed_dummy_users AS
  SELECT id FROM users
  WHERE email IN (
    'admin@unilibra.local',
    'nicholas.demo@unilibra.local',
    'rania.demo@unilibra.local',
    'ammar.demo@unilibra.local'
  );

CREATE TEMP TABLE seed_dummy_books AS
  SELECT id FROM books
  WHERE owner_id IN (SELECT id FROM seed_dummy_users)
     OR title LIKE '[DEMO] %';

CREATE TEMP TABLE seed_dummy_threads AS
  SELECT id FROM chat_threads
  WHERE created_by_id IN (SELECT id FROM seed_dummy_users)
     OR recipient_id IN (SELECT id FROM seed_dummy_users)
     OR book_id IN (SELECT id FROM seed_dummy_books);

DELETE FROM chat_messages WHERE thread_id IN (SELECT id FROM seed_dummy_threads);
DELETE FROM chat_threads WHERE id IN (SELECT id FROM seed_dummy_threads);
DELETE FROM notifications WHERE user_id IN (SELECT id FROM seed_dummy_users);
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
  Cleanup-DemoData
}

$admin = Register-User -Name "Admin UniLibra" -Email "admin@unilibra.local" -City "Yogyakarta"
$nicholas = Register-User -Name "Nicholas S." -Email "nicholas.demo@unilibra.local" -City "Sleman"
$rania = Register-User -Name "Rania Putri" -Email "rania.demo@unilibra.local" -City "Bantul"
$ammar = Register-User -Name "Ammar Fikri" -Email "ammar.demo@unilibra.local" -City "Yogyakarta"

$covers = @(
  Get-OpenLibraryCover -Title "Filosofi Teras" -Author "Henry Manampiring" -FallbackPath (New-CoverImage -Filename "filosofi-teras.png" -Title "Filosofi Teras" -Author "Henry Manampiring" -ColorA "#F2C14E" -ColorB "#B8651B")
  Get-OpenLibraryCover -Title "Atomic Habits" -Author "James Clear" -FallbackPath (New-CoverImage -Filename "atomic-habits.png" -Title "Atomic Habits" -Author "James Clear" -ColorA "#2F6F73" -ColorB "#172A3A")
  Get-OpenLibraryCover -Title "Laskar Pelangi" -Author "Andrea Hirata" -FallbackPath (New-CoverImage -Filename "laskar-pelangi.png" -Title "Laskar Pelangi" -Author "Andrea Hirata" -ColorA "#5B8E7D" -ColorB "#1D4E35")
  Get-OpenLibraryCover -Title "Bumi Manusia" -Author "Pramoedya Ananta Toer" -FallbackPath (New-CoverImage -Filename "bumi-manusia.png" -Title "Bumi Manusia" -Author "Pramoedya A. Toer" -ColorA "#9E2A2B" -ColorB "#540B0E")
  Get-OpenLibraryCover -Title "Algoritma Dasar" -Author "Rinaldi Munir" -FallbackPath (New-CoverImage -Filename "algoritma.png" -Title "Algoritma Dasar" -Author "Rinaldi Munir" -ColorA "#3D5A80" -ColorB "#1D3557")
  Get-OpenLibraryCover -Title "Clean Code" -Author "Robert C. Martin" -FallbackPath (New-CoverImage -Filename "clean-code.png" -Title "Clean Code" -Author "Robert C. Martin" -ColorA "#2B2D42" -ColorB "#8D99AE")
  Get-OpenLibraryCover -Title "Psikologi Uang" -Author "Morgan Housel" -FallbackPath (New-CoverImage -Filename "psikologi-uang.png" -Title "Psikologi Uang" -Author "Morgan Housel" -ColorA "#BC6C25" -ColorB "#283618")
  Get-OpenLibraryCover -Title "Laut Bercerita" -Author "Leila S. Chudori" -FallbackPath (New-CoverImage -Filename "laut-bercerita.png" -Title "Laut Bercerita" -Author "Leila S. Chudori" -ColorA "#006D77" -ColorB "#003049")
  Get-OpenLibraryCover -Title "Data Science from Scratch" -Author "Joel Grus" -FallbackPath (New-CoverImage -Filename "data-science.png" -Title "Data Science" -Author "Joel Grus" -ColorA "#7B2CBF" -ColorB "#240046")
  Get-OpenLibraryCover -Title "Deep Work" -Author "Cal Newport" -FallbackPath (New-CoverImage -Filename "deep-work.png" -Title "Deep Work" -Author "Cal Newport" -ColorA "#264653" -ColorB "#0A192F")
  Get-OpenLibraryCover -Title "The Lean Startup" -Author "Eric Ries" -FallbackPath (New-CoverImage -Filename "lean-startup.png" -Title "The Lean Startup" -Author "Eric Ries" -ColorA "#2A9D8F" -ColorB "#1B4332")
  Get-OpenLibraryCover -Title "Change by Design" -Author "Tim Brown" -FallbackPath (New-CoverImage -Filename "design-thinking.png" -Title "Design Thinking" -Author "Tim Brown" -ColorA "#E76F51" -ColorB "#6D2E46")
  Get-OpenLibraryCover -Title "Negeri 5 Menara" -Author "A. Fuadi" -FallbackPath (New-CoverImage -Filename "negeri-5-menara.png" -Title "Negeri 5 Menara" -Author "A. Fuadi" -ColorA "#457B9D" -ColorB "#1D3557")
  Get-OpenLibraryCover -Title "Cantik Itu Luka" -Author "Eka Kurniawan" -FallbackPath (New-CoverImage -Filename "cantik-itu-luka.png" -Title "Cantik Itu Luka" -Author "Eka Kurniawan" -ColorA "#9D0208" -ColorB "#370617")
  Get-OpenLibraryCover -Title "Calculus" -Author "Purcell" -FallbackPath (New-CoverImage -Filename "kalkulus-dasar.png" -Title "Kalkulus Dasar" -Author "Purcell" -ColorA "#4361EE" -ColorB "#03045E")
  Get-OpenLibraryCover -Title "Database System Concepts" -Author "Silberschatz" -FallbackPath (New-CoverImage -Filename "database-system.png" -Title "Database System" -Author "Silberschatz" -ColorA "#3A0CA3" -ColorB "#10002B")
  Get-OpenLibraryCover -Title "The Pragmatic Programmer" -Author "Andrew Hunt" -FallbackPath (New-CoverImage -Filename "pragmatic-programmer.png" -Title "Pragmatic Programmer" -Author "Hunt & Thomas" -ColorA "#343A40" -ColorB "#111111")
  Get-OpenLibraryCover -Title "Sapiens" -Author "Yuval Noah Harari" -FallbackPath (New-CoverImage -Filename "sapiens.png" -Title "Sapiens" -Author "Yuval Noah Harari" -ColorA "#A98467" -ColorB "#4E342E")
  Get-OpenLibraryCover -Title "Rich Dad Poor Dad" -Author "Robert Kiyosaki" -FallbackPath (New-CoverImage -Filename "rich-dad-poor-dad.png" -Title "Rich Dad Poor Dad" -Author "Robert Kiyosaki" -ColorA "#F4A261" -ColorB "#99582A")
  Get-OpenLibraryCover -Title "Matematika Diskrit" -Author "Rinaldi Munir" -FallbackPath (New-CoverImage -Filename "matematika-diskrit.png" -Title "Matematika Diskrit" -Author "Rinaldi Munir" -ColorA "#023E8A" -ColorB "#001845")
  Get-OpenLibraryCover -Title "Eloquent JavaScript" -Author "Marijn Haverbeke" -FallbackPath (New-CoverImage -Filename "eloquent-javascript.png" -Title "Eloquent JavaScript" -Author "Marijn Haverbeke" -ColorA "#F7B801" -ColorB "#6A4C93")
  Get-AssetCover -Filename "Dilan.webp"
  Get-AssetCover -Filename "novel_bulan_tere_liye.jpg"
  Get-AssetCover -Filename "book_harry.webp"
)

$bookSeeds = @(
  @{ owner = $nicholas; cover = $covers[0]; title = "[DEMO] Filosofi Teras"; author = "Henry Manampiring"; category = "Pengembangan diri"; condition = "Baik"; location = "Sleman, Yogyakarta"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 7000; latitude = -7.747; longitude = 110.355; description = "Buku pengantar stoisisme yang ringan untuk belajar mengelola emosi, ekspektasi, dan keputusan sehari-hari." }
  @{ owner = $nicholas; cover = $covers[1]; title = "[DEMO] Atomic Habits"; author = "James Clear"; category = "Nonfiksi"; condition = "Seperti baru"; location = "UGM, Sleman"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 9000; latitude = -7.771; longitude = 110.377; description = "Panduan praktis membangun kebiasaan kecil yang konsisten dan mudah diterapkan untuk mahasiswa." }
  @{ owner = $nicholas; cover = $covers[4]; title = "[DEMO] Algoritma Dasar"; author = "Rinaldi Munir"; category = "Akademik"; condition = "Ada catatan"; location = "Pogung, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 12000; latitude = -7.759; longitude = 110.376; description = "Buku akademik untuk struktur data, algoritma dasar, dan latihan pemrograman." }
  @{ owner = $rania; cover = $covers[2]; title = "[DEMO] Laskar Pelangi"; author = "Andrea Hirata"; category = "Sastra"; condition = "Baik"; location = "Bantul, Yogyakarta"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 6000; latitude = -7.875; longitude = 110.327; description = "Novel Indonesia tentang pendidikan, persahabatan, dan mimpi besar dari Belitung." }
  @{ owner = $rania; cover = $covers[3]; title = "[DEMO] Bumi Manusia"; author = "Pramoedya Ananta Toer"; category = "Sastra"; condition = "Cukup baik"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Kurir lokal"; rental_price = 8000; latitude = -7.801; longitude = 110.364; description = "Novel sejarah Indonesia dengan latar kolonial, cocok untuk pembaca sastra dan sejarah." }
  @{ owner = $rania; cover = $covers[5]; title = "[DEMO] Clean Code"; author = "Robert C. Martin"; category = "Akademik"; condition = "Baik"; location = "Condongcatur"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 13000; latitude = -7.758; longitude = 110.408; description = "Buku wajib untuk belajar menulis kode yang rapi, mudah dirawat, dan profesional." }
  @{ owner = $nicholas; cover = $covers[6]; title = "[DEMO] Psikologi Uang"; author = "Morgan Housel"; category = "Nonfiksi"; condition = "Seperti baru"; location = "Seturan"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8500; latitude = -7.766; longitude = 110.409; description = "Kumpulan insight sederhana tentang perilaku manusia dalam mengelola uang." }
  @{ owner = $rania; cover = $covers[7]; title = "[DEMO] Laut Bercerita"; author = "Leila S. Chudori"; category = "Fiksi populer"; condition = "Baik"; location = "Gejayan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 7500; latitude = -7.777; longitude = 110.389; description = "Novel emosional tentang keluarga, aktivisme, dan ingatan yang belum selesai." }
  @{ owner = $nicholas; cover = $covers[8]; title = "[DEMO] Data Science dari Nol"; author = "Joel Grus"; category = "Akademik"; condition = "Baik"; location = "Sleman"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 14000; latitude = -7.748; longitude = 110.355; description = "Pengantar data science, statistik, Python, dan machine learning untuk pemula." }
  @{ owner = $nicholas; cover = $covers[9]; title = "[DEMO] Deep Work"; author = "Cal Newport"; category = "Pengembangan diri"; condition = "Seperti baru"; location = "Pogung, Sleman"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 9000; latitude = -7.759; longitude = 110.377; description = "Buku tentang fokus mendalam, produktivitas, dan cara bekerja tanpa distraksi." }
  @{ owner = $rania; cover = $covers[10]; title = "[DEMO] The Lean Startup"; author = "Eric Ries"; category = "Nonfiksi"; condition = "Baik"; location = "Kota Yogyakarta"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 10000; latitude = -7.797; longitude = 110.370; description = "Panduan membangun produk dan startup dengan eksperimen cepat, validasi ide, dan iterasi." }
  @{ owner = $rania; cover = $covers[11]; title = "[DEMO] Design Thinking"; author = "Tim Brown"; category = "Nonfiksi"; condition = "Baik"; location = "Condongcatur"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 9500; latitude = -7.758; longitude = 110.407; description = "Buku untuk memahami pemecahan masalah kreatif, riset pengguna, dan prototyping." }
  @{ owner = $nicholas; cover = $covers[12]; title = "[DEMO] Negeri 5 Menara"; author = "A. Fuadi"; category = "Fiksi populer"; condition = "Cukup baik"; location = "Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 6500; latitude = -7.746; longitude = 110.355; description = "Novel inspiratif tentang persahabatan, pendidikan pesantren, dan mimpi besar." }
  @{ owner = $rania; cover = $covers[13]; title = "[DEMO] Cantik Itu Luka"; author = "Eka Kurniawan"; category = "Sastra"; condition = "Baik"; location = "Bantul"; max_duration = "2 minggu"; handover = "Kurir lokal"; rental_price = 8500; latitude = -7.875; longitude = 110.331; description = "Novel sastra Indonesia dengan gaya realisme magis, sejarah keluarga, dan kritik sosial." }
  @{ owner = $nicholas; cover = $covers[14]; title = "[DEMO] Kalkulus Dasar"; author = "Purcell"; category = "Akademik"; condition = "Ada catatan"; location = "UGM, Sleman"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 11000; latitude = -7.771; longitude = 110.378; description = "Buku kalkulus untuk limit, turunan, integral, dan latihan dasar matematika teknik." }
  @{ owner = $nicholas; cover = $covers[15]; title = "[DEMO] Database System Concepts"; author = "Silberschatz"; category = "Akademik"; condition = "Baik"; location = "Seturan"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 15000; latitude = -7.766; longitude = 110.410; description = "Referensi database untuk SQL, desain relasi, transaksi, indeks, dan arsitektur DBMS." }
  @{ owner = $rania; cover = $covers[16]; title = "[DEMO] The Pragmatic Programmer"; author = "Andrew Hunt & David Thomas"; category = "Akademik"; condition = "Seperti baru"; location = "Gejayan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 14000; latitude = -7.778; longitude = 110.388; description = "Buku pengembangan software tentang kebiasaan engineer, desain kode, dan disiplin kerja." }
  @{ owner = $rania; cover = $covers[17]; title = "[DEMO] Sapiens"; author = "Yuval Noah Harari"; category = "Nonfiksi"; condition = "Baik"; location = "Kota Yogyakarta"; max_duration = "1 bulan"; handover = "Titik temu publik"; rental_price = 10000; latitude = -7.801; longitude = 110.365; description = "Ringkasan sejarah manusia dari masa purba sampai masyarakat modern." }
  @{ owner = $nicholas; cover = $covers[18]; title = "[DEMO] Rich Dad Poor Dad"; author = "Robert Kiyosaki"; category = "Pengembangan diri"; condition = "Baik"; location = "Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 8000; latitude = -7.748; longitude = 110.356; description = "Buku populer tentang literasi finansial, aset, arus kas, dan cara berpikir soal uang." }
  @{ owner = $nicholas; cover = $covers[19]; title = "[DEMO] Matematika Diskrit"; author = "Rinaldi Munir"; category = "Akademik"; condition = "Cukup baik"; location = "Pogung"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 12000; latitude = -7.760; longitude = 110.376; description = "Materi logika, himpunan, relasi, graf, kombinatorika, dan dasar teori komputasi." }
  @{ owner = $rania; cover = $covers[20]; title = "[DEMO] Eloquent JavaScript"; author = "Marijn Haverbeke"; category = "Akademik"; condition = "Baik"; location = "Condongcatur"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 12500; latitude = -7.758; longitude = 110.407; description = "Buku JavaScript modern untuk dasar bahasa, struktur program, DOM, dan pemrograman web." }
  @{ owner = $nicholas; cover = $covers[21]; title = "[DEMO] Dilan 1990"; author = "Pidi Baiq"; category = "Fiksi populer"; condition = "Baik"; location = "Sleman"; max_duration = "2 minggu"; handover = "Titik temu publik"; rental_price = 7000; latitude = -7.748; longitude = 110.355; description = "Novel remaja populer tentang Dilan dan Milea. Cover ini memakai asset lama frontend yang sekarang ikut di-upload ke backend." }
  @{ owner = $rania; cover = $covers[22]; title = "[DEMO] Bulan"; author = "Tere Liye"; category = "Fiksi populer"; condition = "Seperti baru"; location = "Gejayan"; max_duration = "2 minggu"; handover = "Area kampus"; rental_price = 8000; latitude = -7.777; longitude = 110.389; description = "Novel fantasi dan petualangan dari Tere Liye. Cover berasal dari asset lama frontend lalu dimasukkan ke backend." }
  @{ owner = $nicholas; cover = $covers[23]; title = "[DEMO] Harry Potter"; author = "J.K. Rowling"; category = "Fiksi populer"; condition = "Baik"; location = "UGM, Sleman"; max_duration = "1 bulan"; handover = "Area kampus"; rental_price = 9000; latitude = -7.771; longitude = 110.377; description = "Kisah dunia sihir yang populer untuk pembaca fantasi. Cover lama frontend sekarang disimpan sebagai cover backend." }
)

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
Write-Host "Login demo:"
Write-Host "  Admin    : admin@unilibra.local / $demoPassword"
Write-Host "  Owner 1  : nicholas.demo@unilibra.local / $demoPassword"
Write-Host "  Owner 2  : rania.demo@unilibra.local / $demoPassword"
Write-Host "  Peminjam : ammar.demo@unilibra.local / $demoPassword"
Write-Host ""
Write-Host "Data dibuat:"
Write-Host "  Users    : 4"
Write-Host "  Books    : $($createdBooks.Count)"
Write-Host "  Transaksi: 3"
Write-Host "  Chat     : 2 thread"
