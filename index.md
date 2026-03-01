## LAB 2.4: Merancang SDLC Pengembangan Produk

# UniLibra

### Anggota Kelompok:  
- Anggota 1:  Christian Kevin Andhika Danidaiva (23/513576/TK/56433)
- Anggota 2:  Nicholas Shane Pangihutan Siahaan (23/520590/TK/57399)
- Anggota 3:  Ammar Ali Yasir  (23/520644/TK/57406) 

### Project Senior Project TI 

### Departemen Teknologi Elektro dan Teknologi Informasi, Fakultas Teknik, Universitas Gadjah Mada

### Perumusan Permasalahan

### Identitas Produk
* **Nama Produk:** UniLibra
* **Jenis Produk:** Layanan Aplikasi Peminjaman Buku Fisik *Peer-to-Peer* (P2P)

### Latar Belakang & Permasalahan
Minat baca masyarakat Indonesia sebenarnya cukup tinggi (88% anak muda menyukai aktivitas membaca), namun terhambat oleh mahalnya harga buku (rata-rata Rp80.000 - Rp150.000) dan pengeluaran pendidikan yang minim. Buku fisik sering menjadi tidak produktif setelah dibaca. 
**Rumusan Masalah:**
1. Bagaimana upaya optimalisasi buku yang tidak lagi produktif agar memiliki nilai ekonomi dan edukatif?
2. Bagaimana merancang aplikasi peminjaman buku yang mudah diakses dan menarik sebagai alternatif legal terhadap buku bajakan?
3. Bagaimana perubahan minat buku masyarakat dengan kemajuan teknologi yang ada?

### Ide Solusi
Aplikasi **UniLibra** menyediakan sarana bagi pengguna untuk meminjamkan buku fisik yang dimiliki dan meminjam buku fisik milik pengguna lain.

**Rancangan Fitur:**
* **Autentikasi & Otorisasi:** Registrasi untuk peminjam dan pemilik buku.
* **Beranda Rekomendasi:** Menampilkan buku sesuai minat pengguna menggunakan *Machine Learning*.
* **Meminjamkan Buku:** Mengunggah buku ke katalog dengan harga sewa tertentu.
* **Meminjam Buku:** Meminjam buku dari katalog.
* **Pencarian Pintar:** Pencarian judul menggunakan ML untuk mendeteksi kemiripan kata.
* **Sortir & Filter:** Pengurutan berdasarkan jarak terdekat/harga, dan filter genre.
* **Tracking Status:** Mengetahui jadwal ketersediaan buku.

### Analisis Kompetitor
* **Google Book (Tertiary):** Layanan buku digital raksasa, kredibel, namun mahal dan memicu ketergantungan layar.
* **Deepublish Digital (Tertiary):** Fokus ke jurnal dan mahasiswa, namun minim fiksi dan berupa e-book.
* **Perpustakaan Indonesia (Indirect):** Memudahkan peminjaman, namun terbatas pada perpustakaan kota asal dan koleksi kurang lengkap.
* **Keunggulan UniLibra (Unique Value):** Belum ada layanan P2P buku fisik berbasis lokasi terdekat dengan sistem katalog tak hingga yang memberdayakan koleksi pribadi masyarakat.

## LAB 2.4: Merancang SDLC Pengembangan Produk

### 1. Metodologi SDLC yang Diimplementasikan
**Metodologi:** Agile Scrum
**Alasan Pemilihan:** Tim Literasi Tinggi terdiri dari peran spesifik (UI/UX & Cloud, AI Engineer, Software Engineer). Metodologi Agile memungkinkan pengembangan fitur aplikasi (UniLibra) dilakukan secara iteratif (berulang) dalam *sprint* yang fleksibel. Tim dapat memprioritaskan fitur inti seperti katalog dan peminjaman di awal, sambil secara paralel mengembangkan dan melatih model *Machine Learning* untuk rekomendasi. Agile sangat adaptif jika ada perubahan kebutuhan di tengah jalan.

### 2. Tahap 1-3 SDLC (Perancangan)

**a. Tujuan dari Produk**
Membangun aplikasi *peer-to-peer* (UniLibra) untuk mengoptimalisasi nilai ekonomi dan edukatif dari buku fisik yang menganggur, serta menyediakan akses peminjaman buku yang terjangkau, legal, dan berbasis lokasi terdekat bagi masyarakat guna meningkatkan literasi.

**b. Pengguna Potensial dan Kebutuhannya**
* **Peminjam (Borrower):** Masyarakat atau mahasiswa yang gemar membaca buku fisik namun terkendala biaya. 
  * *Kebutuhan:* Akses pencarian buku yang mudah, rekomendasi yang akurat, dan menemukan buku dengan jarak terdekat untuk menghemat ongkos.
* **Pemilik Buku (Lender):** Kolektor buku atau individu yang memiliki buku yang sudah selesai dibaca. 
  * *Kebutuhan:* Platform yang aman untuk menyewakan koleksi buku mereka demi mendapatkan penghasilan tambahan (*passive income*).

**c. Use Case Diagram**
Berikut adalah rancangan Use Case Diagram untuk aplikasi UniLibra:
![Use Case Diagram UniLibra](masukkan-link-gambar-use-case-kalian-disini.png)

**d. Functional Requirements**
1. Sistem harus dapat memverifikasi registrasi dan autentikasi pengguna.
2. Sistem harus menyediakan antarmuka bagi pengguna untuk mengunggah detail buku ke katalog (judul, genre, harga sewa, foto).
3. Sistem harus mengintegrasikan algoritma *Machine Learning* untuk menampilkan rekomendasi buku di Beranda berdasarkan data pengguna.
4. Sistem harus memiliki fitur pencarian dengan dukungan *Machine Learning* untuk mendeteksi kemiripan kata (keyword).
5. Sistem harus dapat memproses lokasi pengguna dan mengurutkan hasil pencarian berdasarkan jarak terdekat atau harga termurah.
6. Sistem harus dapat melacak dan mengubah status ketersediaan/jadwal buku secara *real-time*.

**e. Entity Relationship Diagram (ERD)**
Berikut adalah rancangan struktur database aplikasi:
![ERD UniLibra](masukkan-link-gambar-erd-kalian-disini.png)

**f. Low-Fidelity Wireframe**
Berikut adalah sketsa rancangan antarmuka pengguna (UI) awal untuk halaman Beranda dan Detail Buku:
![Wireframe UniLibra](masukkan-link-gambar-wireframe-kalian-disini.png)

**g. Gantt-Chart (Pengerjaan 1 Semester)**
Berikut adalah linimasa pengerjaan proyek selama satu semester ke depan:
![Gantt Chart UniLibra](masukkan-link-gambar-gantt-chart-kalian-disini.png)
