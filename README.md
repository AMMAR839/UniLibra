# UniLibra
### Platform Peminjaman Buku Universal


## Anggota Kelompok:  
| Nama | NIM | Role |
| :--- | :--- | :--- |
| **Christian Kevin Andhika Danidaiva** | 23/513576/TK/56433 | Project Manager & Backend Engineer |
| **Nicholas Shane Pangihutan Siahaan** | 23/520590/TK/57399 | AI Engineer |
| **Ammar Ali Yasir** | 23/520644/TK/57406 | Frontend Engineer |

## Getting Started

Jalankan environment setiap mulai sesi pengembangan lokal
```bash
make up
```

Matikan environment setelah sesi pengembangan selesai
```bash
make down
```

## Workflow

Dilarang melakukan *push* atau *commit* langsung ke `main`.

**1. Sinkronisasi main branch:**
```bash
git switch main
git pull origin main
```

**2. Pindah ke branch individu:**
```bash
git switch -c [NIU]  # Untuk membuat branch baru
```
or
```bash
git switch [NIU] # Jika branch sudah ada
git pull --rebase origin main
```

**3. Code:** 

Setiap kode di-save, perubahan akan langsung disinkronisasi oleh Docker Compose dan dapat langsung dilihat

**4. Commit:**
```bash
git add .
git status # Pastikan tidak ada unwanted file
git commit -m "feat: [deskripsi fitur]"
```

**5. Pull perubahan di main:**
```bash
git pull --rebase origin main
```

**6. Push ke repositori:**
```bash
git push origin [NIU]
```

**7. Pull Request (PR):**
Ajukan PR ke cabang `main`. Wajib mendapatkan persetujuan (*approval*) minimal dari 1 anggota tim sebelum di-*merge*.

## Konvensi Commit Message
Gunakan standar [Conventional Commits](https://www.conventionalcommits.org/):
* `feat:` Penambahan fitur baru
* `fix:` Perbaikan bug
* `docs:` Pembaruan dokumentasi
* `refactor:` Restrukturisasi kode tanpa ubah fungsi
* `chore:` Penyesuaian konfigurasi atau dependensi
#### Commit early, commit often

### Departemen Teknologi Elektro dan Teknologi Informasi, Fakultas Teknik, Universitas Gadjah Mada
