# Cara Deploy UniLibra

Dokumen ini khusus untuk deployment UniLibra ke cloud. Untuk menjalankan aplikasi di komputer local, baca `run-local.md`.

Arsitektur aplikasi saat ini terdiri dari tiga service:

1. Frontend React/Vite.
2. Backend Go/Gin sebagai API publik.
3. AI FastAPI untuk semantic search, recommendation, dan refresh embedding buku.

Frontend hanya memanggil backend. Backend yang memanggil AI service. Database dipakai bersama oleh backend dan AI, dengan extension `vector`/pgvector untuk embedding buku.

## 1. Target Deployment yang Direkomendasikan

Rekomendasi utama adalah Microsoft Azure:

| Bagian | Service Azure | Catatan |
| --- | --- | --- |
| Frontend | Azure Static Web Apps | Cocok untuk hasil build Vite static. |
| Backend API | Azure Container Apps | Cocok untuk Go API, HTTP ingress, dan WebSocket chat. |
| AI service | Azure Container Apps | Dipisah dari backend karena dependency Python/model berbeda. |
| Image registry | Azure Container Registry | Menyimpan image backend dan AI. |
| Database | Azure Database for PostgreSQL Flexible Server | Satu database untuk backend, AI, dan pgvector. |
| Cover buku | Azure Blob Storage | Menyimpan file cover buku. |
| Secret/env | Container Apps secrets atau Azure Key Vault | Menyimpan password, JWT secret, OAuth secret, dan token internal. |

Opsi selain Azure:

- Frontend: Vercel, Netlify, Cloudflare Pages.
- Backend dan AI: Render, Railway, Fly.io, Google Cloud Run, AWS App Runner.
- Database: Supabase PostgreSQL, Neon, Railway PostgreSQL.
- Storage: Cloudflare R2, AWS S3, Google Cloud Storage.

Tetap pertahankan prinsip yang sama: frontend static, backend container, AI container, PostgreSQL dengan pgvector, dan object storage untuk cover.

## 2. Persiapan Sebelum Deploy

Pastikan local sudah bisa build:

```powershell
cd backend
go test ./...

cd ..\frontend
npm.cmd run build

cd ..
python -m py_compile AI\main.py AI\cek_modul.py AI\migrate_data.py
```

Pastikan file ini sudah ada:

- `backend/Dockerfile`
- `AI/Dockerfile`
- `frontend/package.json`
- `.env.example`
- `frontend/.env.example`
- `.env.production.example`
- `frontend/.env.production.example`
- `frontend/public/staticwebapp.config.json`
- `.github/workflows/azure-deploy.yml`

Jangan deploy memakai `.env` local. Production secret harus disimpan di secret manager/cloud configuration.

## 3. Resource Azure yang Perlu Dibuat

Gunakan nama resource yang konsisten. Contoh:

| Resource | Contoh nama |
| --- | --- |
| Resource group | `rg-unilibra-prod` |
| Region | `southeastasia` atau region terdekat user |
| Container Registry | `acunilibra` |
| Container Apps Environment | `cae-unilibra-prod` |
| Backend Container App | `app-unilibra-backend` |
| AI Container App | `app-unilibra-ai` |
| PostgreSQL server | `pg-unilibra-prod` |
| Database | `unilibra` |
| Storage account | `stunilibraprod` |
| Blob container | `book-covers` |
| Static Web App | `swa-unilibra-prod` |

## 4. Database Production

Gunakan Azure Database for PostgreSQL Flexible Server.

Setelah database dibuat, aktifkan extension vector:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Catatan penting:

- Di Azure PostgreSQL Flexible Server, extension perlu di-allowlist terlebih dahulu dari konfigurasi server.
- Nama extension yang dibuat di database adalah `vector`, bukan `pgvector`.
- Backend menjalankan `AutoMigrate`, tetapi extension tetap harus tersedia agar field embedding bisa dipakai.
- Gunakan SSL/TLS untuk koneksi production bila diwajibkan provider.

Connection value untuk backend memakai format pecah:

```env
DB_HOST=<postgres-host>
DB_USER=<postgres-user>
DB_PASSWORD=<postgres-password>
DB_NAME=unilibra
DB_PORT=5432
```

Connection value untuk AI memakai DSN:

```env
DATABASE_URL=postgresql://<postgres-user>:<postgres-password>@<postgres-host>:5432/unilibra
```

## 5. Storage Cover Buku

Untuk production, gunakan Azure Blob Storage.

1. Buat Storage Account.
2. Buat container, contoh `book-covers`.
3. Tentukan strategi akses:
   - Public read untuk cover sederhana.
   - Atau private container + CDN/SAS bila butuh kontrol lebih ketat.
4. Isi env backend:

```env
STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
AZURE_STORAGE_CONTAINER=book-covers
AZURE_STORAGE_PUBLIC_BASE_URL=https://<storage-account>.blob.core.windows.net/book-covers
```

Backend tetap menyimpan URL cover di `books.cover_url`, jadi frontend tidak perlu tahu detail storage.

## 6. Build dan Push Image

Login ke Azure dan ACR:

```powershell
az login
az acr login --name acunilibra
```

Build dan push backend:

```powershell
docker build -t acunilibra.azurecr.io/unilibra-backend:latest ./backend
docker push acunilibra.azurecr.io/unilibra-backend:latest
```

`backend/Dockerfile` memiliki target `dev` untuk Docker Compose local dan target final production untuk Azure. `docker build ./backend` otomatis memakai target production, sedangkan `docker-compose.yml` memakai target `dev`.

Build dan push AI:

```powershell
docker build -t acunilibra.azurecr.io/unilibra-ai:latest ./AI
docker push acunilibra.azurecr.io/unilibra-ai:latest
```

Gunakan tag commit SHA untuk deployment production yang lebih aman:

```powershell
docker build -t acunilibra.azurecr.io/unilibra-backend:<commit-sha> ./backend
docker build -t acunilibra.azurecr.io/unilibra-ai:<commit-sha> ./AI
```

## 7. Deploy AI Container App

Deploy AI sebagai service internal bila hanya backend yang perlu mengaksesnya. Jika butuh debugging awal, boleh expose public sementara, lalu kunci lagi setelah stabil.

Environment variable AI:

```env
DATABASE_URL=postgresql://<postgres-user>:<postgres-password>@<postgres-host>:5432/unilibra
AI_INTERNAL_TOKEN=<token-sama-dengan-backend>
GEMINI_API=<opsional>
```

Health check:

```text
GET https://<ai-domain>/health
```

Jika AI dibuat internal-only, health check dilakukan dari lingkungan yang bisa mengakses internal network Container Apps.

## 8. Deploy Backend Container App

Backend perlu public ingress karena frontend, OAuth callback, API, upload URL, dan WebSocket mengarah ke backend.

Environment variable backend:

```env
DB_HOST=<postgres-host>
DB_USER=<postgres-user>
DB_PASSWORD=<postgres-password>
DB_NAME=unilibra
DB_PORT=5432
JWT_SECRET=<secret-panjang>
ADMIN_EMAILS=admin@domain.com
FRONTEND_URL=https://<frontend-domain>
CORS_ALLOWED_ORIGINS=https://<frontend-domain>
AI_ENGINE_URL=https://<ai-domain-atau-internal-url>
AI_INTERNAL_TOKEN=<token-sama-dengan-ai>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_REDIRECT_URL=https://<backend-domain>/api/auth/google/callback
STORAGE_PROVIDER=azure
AZURE_STORAGE_CONNECTION_STRING=<connection-string>
AZURE_STORAGE_CONTAINER=book-covers
AZURE_STORAGE_PUBLIC_BASE_URL=https://<storage-account>.blob.core.windows.net/book-covers
```

Endpoint yang perlu dicek setelah backend hidup:

```text
GET https://<backend-domain>/ping
GET https://<backend-domain>/api/books
GET https://<backend-domain>/api/ai/popular
```

WebSocket chat memakai:

```text
wss://<backend-domain>/api/realtime?token=<jwt>
```

## 9. Deploy Frontend

Frontend dibuild menjadi static assets.

Build env frontend production:

```env
VITE_API_URL=https://<backend-domain>
VITE_WS_URL=wss://<backend-domain>/api/realtime
VITE_GOOGLE_LOGIN_URL=https://<backend-domain>/api/auth/google
```

Build manual:

```powershell
cd frontend
npm.cmd install
npm.cmd run build
```

Deploy folder hasil build:

```text
frontend/dist
```

Jika memakai Azure Static Web Apps dari GitHub, set:

- App location: `frontend`
- Output location: `dist`
- Build command: `npm run build`

Repo sudah menyediakan `frontend/public/staticwebapp.config.json` dengan `navigationFallback` ke `/index.html` agar route React seperti `/login`, `/register`, `/auth/callback`, dan `/profil` tidak 404 ketika dibuka langsung.

Setelah frontend mendapatkan domain production, update env backend:

```env
FRONTEND_URL=https://<frontend-domain>
CORS_ALLOWED_ORIGINS=https://<frontend-domain>
```

Lalu redeploy/restart backend.

## 10. Google OAuth Production

Di Google Cloud Console, tambahkan redirect URI production:

```text
https://<backend-domain>/api/auth/google/callback
```

Pastikan env ini sama persis:

```env
GOOGLE_REDIRECT_URL=https://<backend-domain>/api/auth/google/callback
FRONTEND_URL=https://<frontend-domain>
```

Flow production:

1. Frontend membuka `VITE_GOOGLE_LOGIN_URL`.
2. Backend redirect ke Google.
3. Google kembali ke backend callback.
4. Backend membuat JWT.
5. Backend redirect ke `FRONTEND_URL/auth/callback#token=...`.
6. Frontend menyimpan token dan user masuk ke aplikasi.

## 11. Migrasi dari Local ke Production

Ada dua jenis migrasi: schema dan data.

### 11.1 Schema

Backend memakai GORM AutoMigrate saat startup. Untuk production awal:

1. Pastikan database kosong sudah dibuat.
2. Pastikan extension `vector` aktif.
3. Jalankan backend production.
4. Backend akan membuat/memperbarui tabel:
   - `users`
   - `books`
   - `transactions`
   - `notifications`
   - `chat_threads`
   - `chat_messages`

Untuk production serius, sebaiknya nanti tambah migration versioned, misalnya `golang-migrate`, agar perubahan schema lebih terkontrol.

### 11.2 Data PostgreSQL

Backup dari local:

```powershell
pg_dump --format=custom --file=unilibra-local.dump --dbname=postgresql://unilibra:unilibra@localhost:5432/unilibra
```

Restore ke production:

```powershell
pg_restore --clean --if-exists --dbname=postgresql://<user>:<password>@<postgres-host>:5432/unilibra unilibra-local.dump
```

Jika tidak ingin menimpa database production, jangan pakai `--clean`. Restore ke database staging dulu untuk validasi.

### 11.3 Migrasi Cover Buku

Jika sebelumnya cover ada di local folder `uploads`, pindahkan file cover ke Azure Blob Storage.

Setelah upload:

1. Pastikan path file di blob sama dengan path yang disimpan di `books.cover_url`, atau
2. Update `books.cover_url` agar mengarah ke URL blob production.

Contoh target:

```text
https://<storage-account>.blob.core.windows.net/book-covers/<nama-file>
```

### 11.4 Refresh Embedding AI

Setelah data buku masuk production:

1. Pastikan AI service hidup.
2. Pastikan `AI_INTERNAL_TOKEN` backend dan AI sama.
3. Update satu buku dari frontend/profile, atau panggil endpoint refresh embedding internal dari backend flow create/update.

Jika ingin refresh massal, buat script kecil terpisah yang membaca semua `books.id` lalu memanggil endpoint AI internal `POST /embeddings/books` untuk setiap buku.

## 12. CI/CD yang Disarankan

Gunakan GitHub Actions.

Repo sudah menyediakan workflow awal di `.github/workflows/azure-deploy.yml`. Workflow ini melakukan:

1. `go test ./...` untuk backend.
2. `npm ci` dan `npm run build` untuk frontend.
3. `python -m py_compile` untuk service AI.
4. Build dan push image backend/AI ke Azure Container Registry.
5. Update Azure Container Apps backend/AI ke image tag commit SHA.
6. Deploy frontend ke Azure Static Web Apps.

Pull request:

1. Backend:
   ```powershell
   cd backend
   go test ./...
   ```
2. AI:
   ```powershell
   python -m py_compile AI/main.py AI/cek_modul.py AI/migrate_data.py
   ```
3. Frontend:
   ```powershell
   cd frontend
   npm ci
   npm run build
   ```

Merge ke branch production:

1. Build image backend.
2. Push ke Azure Container Registry.
3. Deploy/revise backend Container App.
4. Build image AI.
5. Push ke Azure Container Registry.
6. Deploy/revise AI Container App.
7. Build frontend.
8. Deploy frontend ke Azure Static Web Apps.

Secret GitHub Actions yang biasanya diperlukan:

```text
AZURE_CREDENTIALS
AZURE_STATIC_WEB_APPS_API_TOKEN
```

Variables GitHub Actions yang biasanya diperlukan:

```text
AZURE_RESOURCE_GROUP
AZURE_CONTAINER_REGISTRY
BACKEND_CONTAINER_APP
AI_CONTAINER_APP
VITE_API_URL
VITE_WS_URL
VITE_GOOGLE_LOGIN_URL
```

Runtime secret aplikasi tetap disimpan di Azure Container Apps secrets atau Key Vault, bukan di repository.

## 13. Checklist Setelah Deploy

Jalankan checklist ini setelah semua service hidup:

| Cek | URL/Aksi |
| --- | --- |
| Backend health | `GET https://<backend-domain>/ping` |
| AI health | `GET https://<ai-domain>/health` |
| Katalog | `GET https://<backend-domain>/api/books` |
| AI fallback/search | `GET https://<backend-domain>/api/ai/search?q=test` |
| Frontend | Buka `https://<frontend-domain>` |
| Register/login | Buat user baru dan login |
| Google OAuth | Klik login Google |
| Upload cover | Tambah buku dari menu Pinjamkan Buku |
| Cover tampil | Buka katalog dan detail buku |
| Transaksi | Ajukan peminjaman buku |
| Notifikasi | Cek badge dan halaman notifikasi |
| Chat | Kirim pesan antar user |
| Admin | Login email dari `ADMIN_EMAILS`, buka `/admin` |

## 14. Rollback

Untuk rollback cepat:

1. Simpan image tag lama backend dan AI.
2. Revisi Container App ke image tag sebelumnya.
3. Jika frontend bermasalah, rollback deployment Static Web Apps dari workflow run sebelumnya.
4. Jangan rollback database sembarangan setelah ada transaksi baru. Backup dulu sebelum restore.

Gunakan tag immutable, misalnya commit SHA, bukan hanya `latest`, agar rollback lebih mudah.

## 15. Troubleshooting Production

| Masalah | Penyebab umum | Solusi |
| --- | --- | --- |
| Frontend gagal fetch API | `VITE_API_URL` salah atau CORS belum mengizinkan frontend domain | Update build env frontend dan `CORS_ALLOWED_ORIGINS`, lalu redeploy. |
| OAuth redirect mismatch | URL callback di Google tidak sama dengan `GOOGLE_REDIRECT_URL` | Samakan persis domain, path, dan protocol HTTPS. |
| WebSocket gagal | `VITE_WS_URL` masih `ws://` atau backend ingress bermasalah | Pakai `wss://<backend-domain>/api/realtime`. |
| AI recommendation kosong | AI tidak bisa akses database atau embedding belum ada | Cek `DATABASE_URL`, pgvector, dan refresh embedding. |
| Backend gagal startup | DB env salah atau extension vector belum aktif | Cek log Container App dan aktifkan `CREATE EXTENSION vector;`. |
| Cover tidak tampil | Blob URL tidak public atau `AZURE_STORAGE_PUBLIC_BASE_URL` salah | Cek container access/CDN/SAS dan isi env storage. |
| Admin 403 | User bukan admin saat dibuat | Pastikan email masuk `ADMIN_EMAILS`, lalu buat/login ulang atau update role di database. |

## 16. Referensi Resmi

- Azure Static Web Apps: `https://learn.microsoft.com/azure/static-web-apps/deploy-web-framework`
- Azure Container Apps GitHub Actions: `https://learn.microsoft.com/azure/container-apps/github-actions`
- Azure Container Apps environment variables: `https://learn.microsoft.com/azure/container-apps/environment-variables`
- Azure PostgreSQL pgvector: `https://learn.microsoft.com/azure/postgresql/flexible-server/how-to-use-pgvector`
- Azure Blob Storage: `https://learn.microsoft.com/azure/storage/blobs/storage-blobs-overview`
- Google OAuth web server flow: `https://developers.google.com/identity/protocols/oauth2/web-server`
