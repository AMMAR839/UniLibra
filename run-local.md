# Menjalankan UniLibra di Local dan Cloud

Dokumen ini menjelaskan cara menjalankan tiga service UniLibra:

1. Backend Go/Gin sebagai API publik aplikasi.
2. AI FastAPI untuk pencarian semantik, rekomendasi, dan refresh embedding buku.
3. Frontend React/Vite sebagai UI pengguna dan admin.

Frontend hanya berkomunikasi langsung dengan backend. Backend akan meneruskan request pencarian/rekomendasi ke AI dan tetap memberi fallback katalog biasa bila AI belum siap.

## 1. Requirement

### Wajib

| Kebutuhan | Catatan |
| --- | --- |
| Git | Clone dan kolaborasi repo. |
| PostgreSQL + extension `vector` | Dibutuhkan backend dan AI. Opsi paling mudah local adalah image `pgvector/pgvector:pg15` dari Compose. |
| Go | Backend memakai module pada `backend/go.mod`. |
| Python | AI service direkomendasikan memakai Python 3.10+ agar sesuai `AI/Dockerfile`. |
| Node.js + npm | Frontend Vite React. |

### Opsi yang direkomendasikan

- Docker Desktop atau Docker Engine dengan Docker Compose.
- Virtual environment Python untuk AI bila tidak memakai container.
- Google OAuth credentials bila tombol login Google ingin dipakai.

Pada PowerShell Windows yang memblokir `npm.ps1`, gunakan `npm.cmd` untuk command npm.

## 2. Environment Variable

Salin template root menjadi file local:

```powershell
Copy-Item .env.example .env
Copy-Item frontend\.env.example frontend\.env
```

Jangan commit `.env`, Google client secret, JWT secret, database password, storage connection string, atau API key.

### Root `.env`

| Variable | Service | Kegunaan |
| --- | --- | --- |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT` | Backend/Compose | Koneksi PostgreSQL backend. |
| `DATABASE_URL` | AI manual run | DSN PostgreSQL AI. Compose membentuk DSN sendiri untuk service AI. |
| `AI_SEED_OWNER_EMAIL` | AI importer | Owner sistem untuk buku dataset saat `AI/migrate_data.py` dijalankan. |
| `JWT_SECRET` | Backend | Signing JWT email-password dan Google OAuth. |
| `ADMIN_EMAILS` | Backend | Email dipisahkan koma yang otomatis menjadi role admin saat register/OAuth. |
| `FRONTEND_URL` | Backend | Origin frontend dan target redirect `/auth/callback` setelah Google OAuth. |
| `CORS_ALLOWED_ORIGINS` | Backend | Origin frontend yang boleh mengakses API. |
| `AI_ENGINE_URL` | Backend | URL AI dari backend. Local manual biasanya `http://localhost:8000`; Compose memakai `http://ai-engine:8000`. |
| `AI_INTERNAL_TOKEN` | Backend/AI | Header internal saat backend meminta AI refresh embedding. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Backend | Credential Google OAuth web application. |
| `GOOGLE_REDIRECT_URL` | Backend/Google | Callback backend, default local `http://localhost:8080/api/auth/google/callback`. |
| `STORAGE_PROVIDER` | Backend | `local` untuk disk local atau `azure` untuk Azure Blob Storage. |
| `UPLOAD_DIR`, `UPLOAD_PUBLIC_BASE_URL` | Backend | Folder dan base URL cover saat storage local. |
| `AZURE_STORAGE_CONNECTION_STRING` | Backend | Credential Blob Storage saat provider `azure`. |
| `AZURE_STORAGE_CONTAINER` | Backend | Container cover buku. |
| `AZURE_STORAGE_PUBLIC_BASE_URL` | Backend | Public base URL container/blob untuk `books.cover_url`. |
| `GEMINI_API` | AI | Hanya diperlukan bila endpoint chatbot AI lama dipakai; UI v1 memakai search dan recommendation. |

### Frontend `frontend/.env`

| Variable | Kegunaan |
| --- | --- |
| `VITE_API_URL` | Base URL backend API, default local `http://localhost:8080`. |
| `VITE_WS_URL` | Base WebSocket realtime, default local `ws://localhost:8080/api/realtime`. |
| `VITE_GOOGLE_LOGIN_URL` | Start route Google OAuth backend. |

## 3. Urutan Menjalankan Service

Urutan yang aman:

1. Database PostgreSQL/pgvector.
2. Backend.
3. AI service.
4. Frontend.

Backend dapat tetap berjalan ketika AI service mati. Katalog biasa tetap tersedia, tetapi pencarian semantik dan rekomendasi dapat turun ke fallback.

## 4. Menjalankan dengan Docker Compose

Isi `.env`, lalu jalankan dari root repo:

```powershell
docker compose --env-file .env up --build
```

Atau gunakan target repo:

```powershell
make up
```

Compose saat ini menjalankan:

- PostgreSQL pgvector pada port `5432`.
- Backend pada `http://localhost:8080`.
- AI service pada `http://localhost:8000`.

Frontend masih dijalankan dari folder `frontend` agar HMR Vite tetap cepat:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Buka `http://localhost:5173`.

## 5. Menjalankan Manual

### 5.1 Database

Jika PostgreSQL local dipakai, pastikan database pada `.env` sudah dibuat dan extension vector tersedia:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Backend juga mencoba membuat extension ini saat startup. Pada provider database yang membatasi extension, aktifkan `vector` dari panel/provider lebih dulu.

### 5.2 Backend

Dari root repo:

```powershell
cd backend
go mod download
go run .\cmd\unilibra\main.go
```

Backend:

- Menjalankan auto-migrate untuk user, book, transaction, notification, dan chat.
- Menyajikan cover local dari `/uploads`.
- Mengekspos health sederhana di `GET http://localhost:8080/ping`.

### 5.3 AI Service

Dari root repo:

```powershell
cd AI
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Endpoint pemeriksaan:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/search?query=buku%20pengembangan%20diri`

Embedding buku baru direfresh oleh backend lewat `POST /embeddings/books` setelah create/update buku.

### 5.4 Frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Build verifikasi:

```powershell
npm.cmd run build
```

## 6. Google OAuth Local

1. Buat OAuth client bertipe Web application di Google Cloud Console.
2. Tambahkan redirect URI yang sama persis dengan `GOOGLE_REDIRECT_URL`, default local:

   `http://localhost:8080/api/auth/google/callback`

3. Isi `GOOGLE_CLIENT_ID` dan `GOOGLE_CLIENT_SECRET` di `.env`.
4. Pastikan frontend memakai start route backend `http://localhost:8080/api/auth/google`.

Flow local:

1. Frontend membuka backend `GET /api/auth/google`.
2. Backend mengirim user ke Google dan menyimpan state sementara pada cookie.
3. Google kembali ke backend callback.
4. Backend membuat/link user, membuat JWT, lalu redirect ke `FRONTEND_URL/auth/callback#token=...`.

## 7. Fitur yang Terhubung

### Backend publik

- Auth email-password dan Google OAuth.
- Katalog buku, upload cover, dan transaksi peminjaman.
- AI proxy search/popular/similar.
- Notifikasi user.
- Chat thread/message dan WebSocket realtime.
- Admin summary/users/books/transactions/reports.

### Frontend

- Login, register, Google OAuth callback, logout.
- Katalog backend dan pencarian AI.
- Pinjamkan buku dengan upload cover.
- Pengajuan pinjam buku.
- Profil dengan riwayat peminjaman, buku saya, dan transaksi owner.
- Notifikasi nyata dari sistem.
- Chat realtime di navbar.
- Admin v1 dari endpoint role admin.

## 8. Deployment Cloud

Panduan deployment lengkap sudah dipisah ke `cara.deploy.md`. Bagian di bawah ini hanya ringkasan arsitektur cloud.

### Arsitektur rekomendasi Azure

| Bagian | Azure service | Alasan |
| --- | --- | --- |
| Frontend React | Azure Static Web Apps | Frontend Vite dibuild menjadi static assets. |
| Backend Go | Azure Container Apps | Backend sudah punya Dockerfile dan butuh HTTP/WebSocket ingress. |
| AI FastAPI | Azure Container Apps | AI memiliki dependency Python/model dan lebih cocok dipisah dari backend. |
| Database | Azure Database for PostgreSQL Flexible Server | Satu PostgreSQL untuk backend dan embedding vector. |
| Cover buku | Azure Blob Storage | Media cover adalah object/binary data. |
| Secret | Azure Key Vault + Container Apps secret references | JWT secret, DB password, OAuth secret, storage secret, dan token internal tidak masuk image. |

Catatan database Azure:

- Allowlist extension `vector` pada PostgreSQL Flexible Server.
- Jalankan `CREATE EXTENSION vector;` pada database UniLibra.
- Gunakan koneksi TLS sesuai setting Azure production.

### Environment production

Backend Container App:

- `DB_*`
- `JWT_SECRET`
- `ADMIN_EMAILS`
- `FRONTEND_URL`
- `CORS_ALLOWED_ORIGINS`
- `AI_ENGINE_URL`
- `AI_INTERNAL_TOKEN`
- `GOOGLE_*`
- `STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_*`

AI Container App:

- `DATABASE_URL`
- `AI_INTERNAL_TOKEN`
- `GEMINI_API` hanya bila chatbot lama tetap diaktifkan.

Frontend Static Web Apps build env:

- `VITE_API_URL=https://<backend-domain>`
- `VITE_WS_URL=wss://<backend-domain>/api/realtime`
- `VITE_GOOGLE_LOGIN_URL=https://<backend-domain>/api/auth/google`

### CI/CD yang disarankan

1. Pull request:
   - `go test` backend.
   - Python syntax/test check AI.
   - `npm run build` frontend.
2. Merge ke branch deploy:
   - Build image backend dan AI.
   - Push image ke Azure Container Registry.
   - Deploy/revise backend dan AI Container Apps.
   - Build/deploy frontend ke Azure Static Web Apps.
3. Simpan production secret di Key Vault/Container Apps secret references, bukan di workflow file.

Dokumentasi resmi yang relevan:

- Azure Static Web Apps React: `https://learn.microsoft.com/azure/static-web-apps/deploy-react`
- Azure Container Apps GitHub Actions: `https://learn.microsoft.com/azure/container-apps/github-actions`
- Azure Container Apps secrets: `https://learn.microsoft.com/azure/container-apps/manage-secrets`
- Azure PostgreSQL pgvector: `https://learn.microsoft.com/azure/postgresql/flexible-server/how-to-use-pgvector`
- Azure Blob Storage overview: `https://learn.microsoft.com/azure/storage/blobs/storage-blobs-overview`
- Google OAuth web server flow: `https://developers.google.com/identity/protocols/oauth2/web-server`

## 9. Troubleshooting

| Gejala | Cek |
| --- | --- |
| Frontend gagal fetch backend | Pastikan `VITE_API_URL` dan `CORS_ALLOWED_ORIGINS` memakai origin yang benar. |
| WebSocket chat gagal connect | Pastikan token masih ada, backend hidup, dan gunakan `ws://` local atau `wss://` production. |
| Google redirect mismatch | Cocokkan `GOOGLE_REDIRECT_URL` backend dengan redirect URI pada Google Cloud Console. |
| AI search kosong untuk buku baru | Pastikan AI hidup, `AI_INTERNAL_TOKEN` sama di backend/AI, lalu update/create buku agar embedding direfresh. |
| Cover tidak tampil | Untuk local cek `/uploads`; untuk Azure cek container public URL/SAS/CDN policy yang dipakai. |
| Endpoint admin 403 | Login memakai email yang terdaftar pada `ADMIN_EMAILS` saat user dibuat, atau ubah role lewat database/admin yang sudah aktif. |
