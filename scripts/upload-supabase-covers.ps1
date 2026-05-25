param(
  [string]$SupabaseUrl = $env:SUPABASE_URL,
  [string]$ServiceRoleKey = $env:SUPABASE_SERVICE_ROLE_KEY,
  [string]$Bucket = "book-covers",
  [string]$SourceDir = ".\supabase-uploads",
  [switch]$Overwrite
)

$ErrorActionPreference = "Stop"

if (-not $SupabaseUrl) {
  throw "SUPABASE_URL belum diisi. Contoh: `$env:SUPABASE_URL='https://wkwrvtvcaxprlcqibnmu.supabase.co'"
}

if (-not $ServiceRoleKey) {
  throw "SUPABASE_SERVICE_ROLE_KEY belum diisi. Ambil dari Supabase Project Settings > API > service_role key."
}

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "Folder source tidak ditemukan: $SourceDir. Jalankan dulu: docker cp unilibra-backend:/app/uploads ./supabase-uploads"
}

$resolvedSourceDir = (Resolve-Path -LiteralPath $SourceDir).Path
$files = Get-ChildItem -LiteralPath $resolvedSourceDir -File

if ($files.Count -eq 0) {
  throw "Tidak ada file gambar di folder: $resolvedSourceDir"
}

function Get-ContentType {
  param([string]$Path)

  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".jpg"  { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".png"  { return "image/png" }
    ".webp" { return "image/webp" }
    ".gif"  { return "image/gif" }
    default { return "application/octet-stream" }
  }
}

$baseUrl = $SupabaseUrl.TrimEnd("/")
$headers = @{
  "apikey"        = $ServiceRoleKey
  "Authorization" = "Bearer $ServiceRoleKey"
  "x-upsert"      = $(if ($Overwrite) { "true" } else { "false" })
}

Write-Host "Upload $($files.Count) file ke bucket '$Bucket'..."
Write-Host "Source: $resolvedSourceDir"
Write-Host "Target: $baseUrl/storage/v1/object/$Bucket"

$uploaded = 0
$failed = 0

foreach ($file in $files) {
  $objectName = [Uri]::EscapeDataString($file.Name)
  $uploadUrl = "$baseUrl/storage/v1/object/$Bucket/$objectName"
  $contentType = Get-ContentType $file.FullName

  try {
    Invoke-RestMethod `
      -Method Post `
      -Uri $uploadUrl `
      -Headers $headers `
      -ContentType $contentType `
      -InFile $file.FullName | Out-Null

    $uploaded++
    Write-Host "OK  $($file.Name)"
  } catch {
    $failed++
    Write-Warning "FAIL $($file.Name) - $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "Selesai. Uploaded: $uploaded, Failed: $failed"

if ($failed -gt 0 -and -not $Overwrite) {
  Write-Host "Kalau gagal karena file sudah ada, ulangi dengan flag -Overwrite."
}
