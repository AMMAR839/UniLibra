# UniLibra
### Platform Peminjaman Buku Universal

## Anggota Kelompok:  
- Anggota 1:  Christian Kevin Andhika Danidaiva (23/513576/TK/56433)
- Anggota 2:  Nicholas Shane Pangihutan Siahaan (23/520590/TK/57399)
- Anggota 3:  Ammar Ali Yasir  (23/520644/TK/57406)

## Workflow

Dilarang melakukan *push* atau *commit* langsung ke `main`.

**1. Sinkronisasi main branch:**
```bash
git switch main
git pull origin main
```

**2. Pindah ke branch untuk pengembangan fitur:**
```bash
git switch -c feat/[nama-fitur]  # Untuk membuat branch baru
```
or
```bash
git switch feat/[nama-fitur] # Jika branch sudah ada
```

**3. Implementasi dan commit:**
```bash
git add .
git commit -m "feat: [deskripsi fitur]"
```

**4. Push ke repositori:**
```bash
git push origin feat/[nama-fitur]
```

**5. Pull Request (PR):**
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
