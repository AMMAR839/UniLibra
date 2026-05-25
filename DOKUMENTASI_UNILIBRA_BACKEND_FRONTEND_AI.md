# Dokumentasi UniLibra: Backend, Frontend, dan AI

Dokumen ini menjelaskan cara kerja aplikasi UniLibra secara menyeluruh: backend Go, frontend React, dan AI service Python. Fokusnya adalah memahami isi repo, alur data, endpoint penting, dan bagaimana semua service saling terhubung.

## Ringkasan Sistem

UniLibra terdiri dari tiga service utama:

1. Frontend React
   - Lokasi: `frontend/`
   - Framework: Vite + React + TypeScript
   - Tugas utama: menampilkan halaman aplikasi, katalog buku, login/register, profil, transaksi, chat, admin, dan halaman AI.

2. Backend Go
   - Lokasi: `backend/`
   - Framework: Gin + GORM
   - Tugas utama: menyediakan REST API, autentikasi, CRUD buku, transaksi peminjaman, notifikasi, chat realtime, admin panel, upload cover, dan proxy ke AI service.

3. AI Service Python
   - Lokasi: `AI/`
   - Framework: FastAPI
   - Model: `SentenceTransformer('all-MiniLM-L6-v2')`
   - Gemini: opsional lewat env `GEMINI_API`
   - Tugas utama: semantic search, rekomendasi buku, refresh embedding, dan chatbot UniBot.

Alur sederhananya:

```txt
User
  -> Frontend React
  -> Backend Go API
  -> PostgreSQL
  -> AI FastAPI jika fitur AI dipakai
  -> Gemini jika chatbot AI aktif dan GEMINI_API diisi
```

Frontend tidak langsung memanggil AI Python. Frontend memanggil backend Go, lalu backend Go meneruskan request tertentu ke AI service.

## Struktur Folder Penting

```txt
UniLibra/
  backend/
    cmd/unilibra/main.go
    internal/app/routes/routes.go
    internal/app/controllers/
    internal/app/middlewares/
    internal/pkg/models/models.go
    internal/pkg/config/database.go
    internal/pkg/storage/covers.go
    internal/pkg/utils/jwt.go

  frontend/
    src/App.tsx
    src/lib/api.ts
    src/components/
    src/pages/
    src/styles/
    src/assets/
    public/

  AI/
    main.py
    migrate_data.py
    requirements.txt
    Dockerfile
    Books_Data_Clean.csv

  docker-compose.yml
  .env
```

## Backend

Backend berada di folder `backend/`. Service ini berjalan di port `8080`.

Entrypoint backend:

```txt
backend/cmd/unilibra/main.go
```

Tugas entrypoint:

- membaca konfigurasi dari `.env`
- membuka koneksi database
- menjalankan auto migration model
- memasang semua route dari `routes.go`
- menjalankan server Gin di `:8080`

### Routing Backend

File route utama:

```txt
backend/internal/app/routes/routes.go
```

Route publik:

```txt
GET  /ping
POST /api/register
POST /api/login
GET  /api/auth/google
GET  /api/auth/google/callback
GET  /api/realtime
GET  /api/books
GET  /api/books/:id
GET  /api/ai/search
GET  /api/ai/similar/:id
GET  /api/ai/popular
POST /api/ai/chat
```

Route yang butuh login/JWT:

```txt
GET    /api/profile
PUT    /api/profile
GET    /api/my-books
GET    /api/transactions/borrowings
GET    /api/transactions/lendings
GET    /api/notifications
PUT    /api/notifications/read-all
PUT    /api/notifications/:id/read
GET    /api/chat/threads
POST   /api/chat/threads
GET    /api/chat/threads/:id/messages
POST   /api/chat/threads/:id/messages
POST   /api/books
PUT    /api/books/:id
DELETE /api/books/:id
POST   /api/transactions/borrow
PUT    /api/transactions/:id/respond
PUT    /api/transactions/:id/return
PUT    /api/transactions/:id/complete
```

Route admin:

```txt
GET   /api/admin/summary
GET   /api/admin/users
PATCH /api/admin/users/:id
GET   /api/admin/books
PATCH /api/admin/books/:id
GET   /api/admin/transactions
GET   /api/admin/reports
```

Admin route membutuhkan user yang sudah login dan memiliki role admin.

### Model Database Backend

Model utama berada di:

```txt
backend/internal/pkg/models/models.go
```

Model yang dipakai:

1. `User`
   - menyimpan akun pengguna
   - field penting: `name`, `email`, `password_hash`, `google_id`, `role`, `status`, `city`, `phone_number`, `latitude`, `longitude`

2. `Book`
   - menyimpan buku di katalog
   - field penting: `title`, `author`, `description`, `category`, `condition`, `location`, `max_duration`, `handover`, `owner_id`, `rental_price`, `latitude`, `longitude`, `status`, `cover_url`, `embedding`
   - field `embedding` bertipe `vector(384)` untuk pgvector

3. `Transaction`
   - menyimpan proses peminjaman
   - field penting: `book_id`, `borrower_id`, `borrow_date`, `expected_return_date`, `handover`, `location`, `note`, `status`, `total_price`

4. `Notification`
   - menyimpan notifikasi user
   - field penting: `user_id`, `type`, `title`, `body`, `link`, `read_at`

5. `ChatThread`
   - menyimpan percakapan antara peminjam dan pemilik buku
   - terhubung ke `Book`, `CreatedBy`, dan `Recipient`

6. `ChatMessage`
   - menyimpan isi pesan dalam thread chat

### Autentikasi

Backend menggunakan:

- register/login email dan password
- bcrypt untuk hash password
- JWT untuk sesi login
- Google OAuth untuk login dengan Google

Frontend menyimpan token di `localStorage`. Saat request protected endpoint, frontend mengirim:

```txt
Authorization: Bearer <token>
```

Middleware auth membaca token, memvalidasi JWT, lalu memasukkan `userID` ke context request.

### Buku dan Upload Cover

Controller buku berada di:

```txt
backend/internal/app/controllers/book.go
```

Fitur buku:

- mengambil katalog buku tersedia
- mengambil detail buku
- menambahkan buku
- mengedit buku
- menghapus buku dari katalog
- upload cover buku
- refresh embedding AI setelah buku dibuat atau diubah

Cover disimpan oleh:

```txt
backend/internal/pkg/storage/covers.go
```

Backend mendukung dua mode storage:

1. Local storage
   - memakai `UPLOAD_DIR`
   - default Docker: `/app/uploads`
   - diakses publik lewat `/uploads`

2. Azure Blob Storage
   - aktif jika `STORAGE_PROVIDER=azure`
   - memakai:
     - `AZURE_STORAGE_CONNECTION_STRING`
     - `AZURE_STORAGE_CONTAINER`
     - `AZURE_STORAGE_PUBLIC_BASE_URL`

Saat local Docker, gambar cover aman selama volume `uploads_data` tidak dihapus.

### Transaksi Peminjaman

Controller transaksi berada di:

```txt
backend/internal/app/controllers/transaction.go
```

Status transaksi yang terlihat dari alur aplikasi:

- `PENDING_APPROVAL`
- `ACCEPTED`
- `REJECTED`
- `RETURN_PENDING`
- `COMPLETED`

Alur umumnya:

```txt
User memilih buku
  -> frontend membuka /meminjam?book=<id>
  -> user mengirim request pinjam
  -> backend membuat Transaction
  -> pemilik buku menerima/menolak
  -> jika selesai, status transaksi berubah sampai COMPLETED
```

### Chat Realtime Antar User

Chat user ke user berbeda dari chatbot AI.

Chat user berada di:

```txt
backend/internal/app/controllers/chat.go
backend/internal/app/controllers/realtime.go
```

Frontend memakai:

```txt
GET  /api/chat/threads
POST /api/chat/threads
GET  /api/chat/threads/:id/messages
POST /api/chat/threads/:id/messages
```

Realtime memakai WebSocket:

```txt
GET /api/realtime
```

Fitur ini dipakai untuk komunikasi peminjam dan pemilik buku.

### Backend sebagai Proxy AI

Controller AI backend:

```txt
backend/internal/app/controllers/ai.go
```

Backend tidak menjalankan model AI sendiri. Backend hanya meneruskan request ke AI service berdasarkan env:

```txt
AI_ENGINE_URL
```

Jika env kosong, default-nya:

```txt
http://ai-engine:8000
```

Mapping route:

```txt
GET  /api/ai/search?q=...
  -> AI /search?query=...

GET  /api/ai/similar/:id
  -> AI /recommend/similar/:id

GET  /api/ai/popular
  -> AI /recommend/popular

POST /api/ai/chat
  -> AI /api/chat
```

Jika AI search/recommendation tidak tersedia, backend dapat fallback ke katalog biasa untuk beberapa endpoint.

## Frontend

Frontend berada di folder:

```txt
frontend/
```

Framework:

- Vite
- React
- TypeScript

File utama:

```txt
frontend/src/App.tsx
frontend/src/lib/api.ts
frontend/src/App.css
```

### Routing Frontend

Frontend belum memakai React Router. Routing diatur manual di:

```txt
frontend/src/App.tsx
```

Fungsi penting:

```txt
pageFromPath()
navigateTo()
```

Route frontend:

```txt
/                 -> HomePage
/katalog          -> CatalogPage
/catalog          -> CatalogPage
/pinjamkan        -> LendBookPage
/meminjam         -> BorrowBookPage
/pinjam-buku      -> BorrowBookPage
/kontak           -> ContactPage
/contact          -> ContactPage
/notifikasi       -> NotificationPage
/notification     -> NotificationPage
/notifications    -> NotificationPage
/profil           -> ProfilePage
/profile          -> ProfilePage
/riwayat          -> ProfilePage
/history          -> ProfilePage
/admin            -> AdminPage
/ai               -> AIPage
/unibot           -> AIPage
/login            -> Login
/register         -> Register
/auth/callback    -> OAuthCallback
```

Protected page:

```txt
pinjamkan
meminjam
notifikasi
profil
admin
```

Jika user belum login dan membuka protected page, frontend akan mengarahkan ke login.

### API Helper Frontend

File:

```txt
frontend/src/lib/api.ts
```

Fungsi penting:

- `apiFetch<T>()`
- `getToken()`
- `setToken()`
- `clearToken()`
- `mediaURL()`
- `realtimeURL()`
- `formatCurrency()`
- `formatDate()`
- `initials()`

Base URL backend:

```txt
VITE_API_URL
```

Jika env tidak diisi, default:

```txt
http://localhost:8080
```

Untuk cover/media, `mediaURL()` akan:

- memakai URL langsung jika sudah `http://` atau `https://`
- menambahkan `API_URL` jika path relatif seperti `/uploads/...`

### Halaman Frontend

Folder:

```txt
frontend/src/pages/
```

Halaman penting:

1. `Home.tsx`
   - halaman utama
   - mengambil `/api/books`
   - mengambil `/api/ai/popular`
   - menampilkan hero, rekomendasi, dan rail buku
   - sudah memiliki fallback gambar dari `frontend/src/assets`

2. `Catalog.tsx`
   - halaman katalog
   - search buku
   - memakai `/api/books` dan `/api/ai/search`
   - menampilkan rekomendasi AI dari `/api/ai/popular`

3. `BorrowBook.tsx`
   - halaman peminjaman
   - membaca query `?book=<id>`
   - mengambil detail buku
   - membuat request peminjaman
   - menampilkan rekomendasi serupa dari `/api/ai/similar/:id`

4. `LendBook.tsx`
   - halaman pinjamkan buku
   - form tambah buku
   - upload cover
   - input lokasi dan detail pengambilan
   - memiliki flow kamera untuk ISBN

5. `Profile.tsx`
   - profil sekaligus dashboard pemilik
   - menampilkan buku yang dipinjamkan
   - riwayat transaksi
   - keuntungan
   - edit buku

6. `Notification.tsx`
   - menampilkan notifikasi user

7. `Contact.tsx`
   - halaman kontak

8. `Admin.tsx`
   - halaman admin
   - menampilkan summary, user, buku, transaksi, dan reports

9. `AIPage.tsx`
   - halaman chatbot AI UniLibra
   - route: `/ai` atau `/unibot`
   - mengirim pertanyaan ke `/api/ai/chat`
   - bisa memakai lokasi user dari browser
   - hasil buku dari AI bisa diklik dan diarahkan ke `/meminjam?book=<id>`

### Komponen Frontend

Folder:

```txt
frontend/src/components/
```

Komponen penting:

1. `Navbar.tsx`
   - navigasi utama
   - login/logout
   - avatar profile
   - notifikasi
   - chat realtime antar user

2. `Footer.tsx`
   - footer global
   - link navigasi

3. `FloatingAIButton.tsx`
   - tombol robot AI berbentuk lingkaran
   - muncul di kanan bawah setiap page
   - mengarah ke `/ai`

4. `LoginCharacterArt.tsx`
   - visual login/register

### Styling Frontend

Style utama:

```txt
frontend/src/App.css
```

`App.css` mengimport file CSS lain:

```txt
frontend/src/styles/base.css
frontend/src/styles/ai.css
frontend/src/styles/home.css
frontend/src/styles/catalog.css
frontend/src/styles/lend-book.css
frontend/src/styles/borrow-book.css
frontend/src/styles/contact.css
frontend/src/styles/notification.css
frontend/src/styles/profile.css
frontend/src/styles/admin.css
```

Style chatbot AI berada di:

```txt
frontend/src/styles/ai.css
```

Saat ini page AI dibuat dengan tema hitam putih:

- background hitam
- teks putih
- bubble user putih dengan teks hitam
- bubble AI gelap/transparan
- tombol robot kecil di kanan bawah

## AI Service

AI service berada di:

```txt
AI/main.py
```

Service ini memakai FastAPI dan berjalan di port `8000`.

Endpoint AI:

```txt
GET  /
GET  /health
GET  /search
GET  /recommend/similar/{book_id}
GET  /recommend/popular
POST /embeddings/books
POST /api/chat
```

### Model Embedding

AI memakai:

```txt
SentenceTransformer('all-MiniLM-L6-v2')
```

Model ini mengubah teks buku dan query user menjadi vector. Vector ini dipakai untuk pencarian semantik.

Dimensi embedding:

```txt
384
```

Di database, field embedding berada di model `Book`:

```txt
Embedding *string `gorm:"type:vector(384)"`
```

### Semantic Search

Fungsi utama:

```txt
execute_semantic_search()
```

Alur:

```txt
User mencari "buku Tere Liye"
  -> query diubah jadi embedding
  -> AI mencari buku available dengan embedding terdekat
  -> PostgreSQL pgvector mengurutkan dengan operator <=>
  -> hasil dikirim kembali ke backend
  -> frontend menampilkan buku
```

AI juga melakukan exact match sederhana terhadap title, author, category, dan location agar pertanyaan seperti:

```txt
Buku Tere Liye masih ada?
```

tetap mudah menemukan buku yang benar.

### Rekomendasi Buku Serupa

Endpoint:

```txt
GET /recommend/similar/{book_id}
```

Alur:

```txt
AI mengambil embedding buku target
  -> mencari buku lain yang embedding-nya paling dekat
  -> hanya buku status available
  -> mengembalikan daftar rekomendasi
```

Frontend memakai endpoint ini di halaman peminjaman buku.

### Rekomendasi Populer

Endpoint:

```txt
GET /recommend/popular
```

Endpoint ini melihat jumlah transaksi per buku:

```txt
COUNT(t.id)
```

Lalu mengurutkan buku berdasarkan:

1. jumlah transaksi terbanyak
2. `updated_at` terbaru

Endpoint ini dipakai di Home dan Catalog sebagai rekomendasi AI/populer.

### Refresh Embedding

Endpoint:

```txt
POST /embeddings/books
```

Request body:

```json
{
  "book_id": 1
}
```

Backend memanggil endpoint ini setelah:

- buku baru dibuat
- buku diedit

Endpoint ini dilindungi token internal:

```txt
AI_INTERNAL_TOKEN
```

Header yang dikirim backend:

```txt
X-AI-Internal-Token: <token>
```

Jika token cocok, AI akan:

1. mengambil data buku dari database
2. membuat teks gabungan dari `title`, `author`, `category`, `location`, dan `description`
3. membuat embedding baru
4. menyimpan embedding ke field `books.embedding`

### Chatbot UniBot

Endpoint:

```txt
POST /api/chat
```

Request body:

```json
{
  "pesan": "Buku Tere Liye masih ada?",
  "latitude": -7.77,
  "longitude": 110.38
}
```

`latitude` dan `longitude` opsional. Jika dikirim, AI akan menghitung jarak buku dari lokasi user.

Alur chatbot:

```txt
Frontend AIPage
  -> POST /api/ai/chat ke backend
  -> backend meneruskan ke AI /api/chat
  -> AI mencari buku relevan dari database
  -> AI membuat konteks buku
  -> jika GEMINI_API diisi, Gemini membuat jawaban natural
  -> jika GEMINI_API kosong, AI memakai semantic fallback
  -> frontend menampilkan jawaban dan kartu buku
```

Jika Gemini aktif, model yang dipanggil:

```txt
gemini-flash-latest
```

Jika Gemini tidak aktif, chatbot tetap berjalan memakai jawaban fallback dari hasil semantic search.

### Gemini API

Env:

```txt
GEMINI_API=
```

Jika `GEMINI_API` diisi, AI membuat client Gemini:

```txt
genai.Client(api_key=GEMINI_API_KEY)
```

Gemini tidak menggantikan database. Gemini hanya menyusun jawaban natural berdasarkan data buku yang sudah diambil dari database.

Artinya:

- data buku tetap dari PostgreSQL
- ranking buku tetap dari semantic search/pgvector
- Gemini hanya membantu bahasa jawaban
- Gemini diarahkan agar tidak mengarang buku di luar konteks database

## Database

Database yang dipakai adalah PostgreSQL dengan extension vector/pgvector.

Docker Compose memakai image:

```txt
pgvector/pgvector:pg15
```

Database menyimpan:

- user
- buku
- transaksi
- notifikasi
- chat thread
- chat message
- embedding buku

Field penting untuk AI:

```txt
books.embedding
```

Field penting untuk rekomendasi dekat lokasi:

```txt
books.latitude
books.longitude
books.location
users.latitude
users.longitude
```

## Docker

File:

```txt
docker-compose.yml
```

Service Docker:

1. `db`
   - PostgreSQL + pgvector
   - port `5432`
   - volume `postgres_data`

2. `backend`
   - Go API
   - port `8080`
   - volume `uploads_data`
   - terhubung ke `db`
   - terhubung ke `ai-engine`

3. `ai-engine`
   - FastAPI AI
   - port `8000`
   - terhubung ke `db`

Volume:

```txt
postgres_data
uploads_data
```

Artinya:

- data database tidak hilang saat container restart
- gambar upload tidak hilang saat container restart
- data hilang jika menjalankan `docker compose down -v` atau menghapus volume manual

Command umum:

```powershell
docker compose up --build
docker compose up -d
docker compose restart ai-engine
docker compose down
```

Jika hanya mengubah `.env` seperti `GEMINI_API`, cukup restart AI container:

```powershell
docker compose restart ai-engine
```

Jika mengubah kode `AI/main.py`, backend Go, frontend build, Dockerfile, atau dependency, rebuild:

```powershell
docker compose up --build
```

## Environment Variable Penting

Root `.env` dipakai oleh Docker Compose dan service.

Backend:

```txt
DB_HOST
DB_USER
DB_PASSWORD
DB_NAME
DB_PORT
JWT_SECRET
ADMIN_EMAILS
FRONTEND_URL
CORS_ALLOWED_ORIGINS
AI_ENGINE_URL
AI_INTERNAL_TOKEN
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URL
STORAGE_PROVIDER
UPLOAD_DIR
UPLOAD_PUBLIC_BASE_URL
AZURE_STORAGE_CONNECTION_STRING
AZURE_STORAGE_CONTAINER
AZURE_STORAGE_PUBLIC_BASE_URL
```

AI:

```txt
DATABASE_URL
AI_INTERNAL_TOKEN
GEMINI_API
AI_SEED_OWNER_EMAIL
```

Frontend:

```txt
VITE_API_URL
VITE_WS_URL
VITE_GOOGLE_LOGIN_URL
```

## Alur Fitur Utama

### 1. User Register/Login

```txt
Frontend login/register
  -> POST /api/login atau POST /api/register
  -> backend validasi user
  -> backend membuat JWT
  -> frontend menyimpan token ke localStorage
  -> request berikutnya memakai Authorization: Bearer <token>
```

### 2. User Melihat Katalog

```txt
Frontend Catalog/Home
  -> GET /api/books
  -> backend mengambil buku status available
  -> frontend menampilkan grid/kartu buku
```

Jika search AI dipakai:

```txt
Frontend Catalog
  -> GET /api/ai/search?q=...
  -> backend meneruskan ke AI /search
  -> AI semantic search ke PostgreSQL
  -> hasil kembali ke frontend
```

### 3. User Menambahkan Buku

```txt
Frontend LendBook
  -> POST /api/books dengan form data dan cover
  -> backend menyimpan buku
  -> backend menyimpan cover
  -> backend menjalankan refreshBookEmbedding(book.ID)
  -> AI membuat embedding untuk buku tersebut
```

### 4. User Meminjam Buku

```txt
Frontend BorrowBook
  -> GET /api/books/:id
  -> user isi form peminjaman
  -> POST /api/transactions/borrow
  -> backend membuat transaction
  -> pemilik buku melihat request di profile/dashboard
```

### 5. Chat Antar User

```txt
Frontend membuka chat
  -> GET /api/chat/threads
  -> user kirim pesan
  -> POST /api/chat/threads/:id/messages
  -> backend simpan pesan
  -> websocket mengirim update realtime
```

Ini bukan chatbot AI. Ini chat antar peminjam dan pemilik.

### 6. Chatbot AI UniBot

```txt
User klik tombol robot kanan bawah
  -> masuk /ai
  -> user bertanya
  -> frontend POST /api/ai/chat
  -> backend proxy ke AI /api/chat
  -> AI membaca database
  -> AI cari buku relevan
  -> Gemini menyusun jawaban jika GEMINI_API aktif
  -> frontend menampilkan jawaban dan buku
  -> klik buku masuk /meminjam?book=<id>
```

## Perbedaan Chat User dan Chatbot AI

Chat user:

- file frontend: `Navbar.tsx`
- endpoint backend: `/api/chat/threads`
- fungsi: komunikasi peminjam dan pemilik buku
- realtime: iya, memakai WebSocket

Chatbot AI:

- file frontend: `AIPage.tsx`
- endpoint backend: `/api/ai/chat`
- endpoint AI: `/api/chat`
- fungsi: tanya rekomendasi buku, ketersediaan buku, buku terdekat
- Gemini: opsional

## Catatan Penting

1. Frontend tidak langsung akses database.
   Semua data lewat backend.

2. Frontend tidak langsung akses AI service.
   Frontend memanggil backend, backend meneruskan ke AI.

3. Gemini tidak menyimpan data buku.
   Data buku tetap di PostgreSQL.

4. Gemini tidak wajib.
   Jika `GEMINI_API` kosong, chatbot tetap bisa menjawab dengan semantic fallback.

5. Embedding harus tersedia agar semantic search maksimal.
   Buku baru otomatis meminta refresh embedding lewat backend.

6. Cover upload aman di Docker selama volume tidak dihapus.
   Jangan pakai `docker compose down -v` jika tidak ingin data hilang.

7. Untuk production, cover lebih aman di Azure Blob Storage/S3.
   Local uploads cocok untuk development.

8. Page `/ai` memakai browser geolocation.
   Fitur lokasi hanya bekerja jika user memberi izin lokasi dan browser berjalan di `localhost` atau HTTPS.

## Cara Menjalankan Local

### Dengan Docker

Pastikan Docker Desktop sudah running.

```powershell
cd C:\Users\Ammar\Documents\UniLibra
docker compose up --build
```

Service:

```txt
Backend: http://localhost:8080
AI:      http://localhost:8000
DB:      localhost:5432
```

Frontend dijalankan terpisah:

```powershell
cd C:\Users\Ammar\Documents\UniLibra\frontend
npm.cmd run dev
```

Buka:

```txt
http://127.0.0.1:5173
```

### Health Check

Backend:

```txt
http://localhost:8080/ping
```

AI:

```txt
http://localhost:8000/health
```

Frontend:

```txt
http://127.0.0.1:5173
```

## Ringkasan Akhir

UniLibra adalah aplikasi peminjaman buku dengan tiga lapisan:

- Frontend React untuk pengalaman pengguna.
- Backend Go untuk API, auth, transaksi, chat, upload, dan admin.
- AI FastAPI untuk semantic search, rekomendasi, embedding, dan chatbot UniBot.

AI UniLibra bukan sekadar keyword matching. Sistem memakai embedding transformer dan pgvector untuk mencari buku berdasarkan makna. Gemini dipakai sebagai tambahan agar jawaban chatbot lebih natural, tetapi semua jawaban tetap diarahkan berdasarkan data buku yang ada di database.
