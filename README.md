# UniLibra

UniLibra adalah platform peminjaman buku fisik berbasis lokasi yang mempertemukan pemilik buku dan peminjam dalam satu sistem katalog antarpengguna. Proyek ini dirancang sebagai solusi peer-to-peer untuk membuat koleksi buku fisik lebih produktif, mudah ditemukan, dan lebih relevan dengan kebutuhan pengguna.

## Anggota Kelompok:  
| Nama | NIM | Role |
| :--- | :--- | :--- |
| **Christian Kevin Andhika Danidaiva** | 23/513576/TK/56433 | Project Manager & Backend Engineer |
| **Nicholas Shane Pangihutan Siahaan** | 23/520590/TK/57399 | AI Engineer |
| **Ammar Ali Yasir** | 23/520644/TK/57406 | Frontend Engineer |

## Gambaran Singkat

Aplikasi ini memiliki tiga komponen utama:

- Frontend React/Vite untuk antarmuka pengguna
- Backend Go untuk logika bisnis, autentikasi, dan API
- AI Service Python untuk rekomendasi, pencarian semantik, dan chatbot

Selain itu, UniLibra juga menggunakan PostgreSQL sebagai basis data utama dan mendukung pencarian berbasis lokasi serta pendekatan machine learning untuk pengalaman pengguna yang lebih baik.

## Fitur Utama

- Registrasi dan login pengguna
- Katalog buku fisik antarpengguna
- Peminjaman dan peminjaman buku
- Rekomendasi buku berbasis AI
- Pencarian pintar dan filter katalog
- Tracking status ketersediaan buku
- Chatbot bantuan buku dan rekomendasi

## Teknologi yang Digunakan

- Frontend: React, Vite, TypeScript
- Backend: Go, Gin
- AI Service: Python, FastAPI
- Database: PostgreSQL
- Deployment: Docker, Azure Container Apps, GitHub Actions

## Struktur Proyek

- `frontend/` - aplikasi web utama
- `backend/` - API dan logika bisnis
- `AI/` - layanan AI dan chatbot
- `docs/` - dokumentasi proyek dan GitHub Pages
- `.github/workflows/` - pipeline CI/CD

## Menjalankan Proyek Secara Lokal

Untuk menjalankan lingkungan pengembangan lokal, gunakan:

```bash
make up
```

Untuk menghentikan seluruh layanan:

```bash
make down
```

### Departemen Teknologi Elektro dan Teknologi Informasi, Fakultas Teknik, Universitas Gadjah Mada
