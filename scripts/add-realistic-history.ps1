param(
  [string]$ApiUrl = "http://localhost:8080",
  [string]$DbContainer = "unilibra-postgres",
  [string]$DbUser = "unilibra",
  [string]$DbName = "unilibra",
  [int]$Count = 120
)

$ErrorActionPreference = "Stop"
$password = "password123"

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

function Login-User {
  param([string]$Email)

  try {
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
  } catch {
    return $null
  }
}

function Read-DatabaseJson {
  param([string]$Sql)

  $result = $Sql | docker exec -i $DbContainer psql -U $DbUser -d $DbName -t -A
  $text = ($result | Out-String).Trim()
  if (-not $text -or $text -eq "null") {
    return @()
  }

  return @($text | ConvertFrom-Json)
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

$users = Read-DatabaseJson -Sql @"
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
  SELECT id, name, email
  FROM users
  WHERE status = 'active'
    AND email <> 'admin@unilibra.local'
  ORDER BY id
) t;
"@

$books = Read-DatabaseJson -Sql @"
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
  SELECT id, owner_id, title
  FROM books
  WHERE status = 'available'
  ORDER BY random()
  LIMIT $Count
) t;
"@

$tokensByUserID = @{}
foreach ($user in $users) {
  $loggedIn = Login-User -Email $user.email
  if ($loggedIn) {
    $tokensByUserID[[int]$loggedIn.id] = $loggedIn
  }
}

$places = @(
  "Perpustakaan pusat UGM",
  "Kafe sekitar Gejayan",
  "Lobi fakultas",
  "Titik temu Condongcatur",
  "Area kos Seturan",
  "Halte Trans Jogja terdekat",
  "Kampus ISI Yogyakarta",
  "Kafe Kotabaru",
  "Perpustakaan daerah",
  "Taman baca komunitas"
)

$handovers = @("Area kampus", "Titik temu publik", "Kurir lokal", "Ambil di sekitar kos")
$notes = @(
  "Dipinjam untuk bacaan akhir pekan.",
  "Butuh referensi untuk tugas kuliah.",
  "Saya ambil sore setelah kelas.",
  "Dipakai untuk diskusi klub buku.",
  "Pinjam untuk riset kecil dan catatan pribadi.",
  "Ingin baca sebelum presentasi minggu depan."
)
$comments = @(
  "Bukunya rapi dan proses peminjaman lancar.",
  "Pemilik responsif, kondisi buku sesuai.",
  "Cover aman, isi lengkap, nyaman dibaca.",
  "Ada sedikit bekas pakai tapi masih sangat layak.",
  "Pengambilan dan pengembalian mudah.",
  "Membantu untuk tugas dan bacaan pribadi.",
  "Kondisi buku bagus, saya puas meminjamnya."
)

$created = 0
foreach ($book in $books) {
  $owner = $tokensByUserID[[int]$book.owner_id]
  if (-not $owner) {
    continue
  }

  $borrowerCandidates = @($tokensByUserID.Values | Where-Object { $_.id -ne [int]$book.owner_id })
  if ($borrowerCandidates.Count -eq 0) {
    continue
  }

  $borrower = Pick -Items $borrowerCandidates
  $startDate = (Get-Date).AddDays(-(Get-Random -Minimum 21 -Maximum 210)).ToString("yyyy-MM-dd")
  $days = Pick -Items @(7, 10, 14, 21, 28)

  try {
    $transaction = Request-Borrow `
      -Borrower $borrower `
      -BookId ([int]$book.id) `
      -StartDate $startDate `
      -Days ([int]$days) `
      -Handover (Pick -Items $handovers) `
      -Location (Pick -Items $places) `
      -Note (Pick -Items $notes)

    Respond-Borrow -Owner $owner -TransactionId ([int]$transaction.data.id) -Status "ACCEPTED"
    Return-Borrow -Borrower $borrower -TransactionId ([int]$transaction.data.id)
    Complete-Borrow -Owner $owner -TransactionId ([int]$transaction.data.id)
    Rate-Borrow `
      -Borrower $borrower `
      -TransactionId ([int]$transaction.data.id) `
      -Rating (Pick -Items @(3, 4, 4, 4, 5, 5, 5, 5)) `
      -Comment (Pick -Items $comments)

    $created++
  } catch {
    Write-Host "Lewati riwayat book_id=$($book.id): $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Riwayat transaksi realistis selesai." -ForegroundColor Green
Write-Host "Transaksi + rating masuk: $created"
