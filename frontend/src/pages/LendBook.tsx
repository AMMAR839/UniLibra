import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

type LendBookForm = {
  title: string;
  author: string;
  category: string;
  condition: string;
  price: string;
  location: string;
  duration: string;
  handover: string;
  description: string;
  agreed: boolean;
};

const initialForm: LendBookForm = {
  title: "",
  author: "",
  category: "",
  condition: "",
  price: "",
  location: "",
  duration: "",
  handover: "",
  description: "",
  agreed: false,
};

const ownerStats = [
  { value: "3.200+", label: "Peminjam aktif" },
  { value: "8.500+", label: "Transaksi berhasil" },
  { value: "94%", label: "Pengembalian tepat waktu" },
];

const heroCards = [
  {
    title: "Kenapa cocok untuk pemilik buku?",
    text: "Buku yang hanya diam di rak bisa tetap terawat, lebih berguna, dan memberi pemasukan tambahan tanpa kehilangan nilai koleksi.",
  },
  {
    title: "Yang kamu atur sendiri",
    points: [
      "Harga pinjam per minggu",
      "Durasi minimum dan maksimum",
      "Lokasi serah terima",
      "Kondisi dan aturan buku",
    ],
  },
  {
    title: "Kurasi yang lebih relevan",
    text: "Pembaca bisa menemukan buku akademik, sastra, dan nonfiksi niche yang sering sulit dicari di toko buku biasa.",
  },
];

const benefits = [
  {
    icon: <IncomeIcon />,
    title: "Pemasukan tambahan",
    text: "Dapatkan penghasilan dari koleksi yang jarang disentuh, tanpa harus menjual buku yang masih kamu sayangi.",
  },
  {
    icon: <StackIcon />,
    title: "Buku lebih berguna",
    text: "Koleksi yang mengendap di rak bisa dipakai mahasiswa, pembaca aktif, dan komunitas di sekitar lokasi kamu.",
  },
  {
    icon: <ShieldIcon />,
    title: "Kontrol tetap di tanganmu",
    text: "Kamu memilih harga, durasi pinjam, titik temu, serta aturan tambahan agar proses peminjaman tetap nyaman.",
  },
];

const listingTips = [
  "Tulis judul dan penulis dengan jelas agar mudah ditemukan lewat pencarian.",
  "Sebutkan kondisi buku secara jujur, termasuk highlight, lipatan, atau sampul lecet.",
  "Pasang harga yang masuk akal agar menarik untuk mahasiswa dan pembaca aktif.",
  "Pilih lokasi serah terima yang aman dan mudah dijangkau kedua pihak.",
];

const faqItems = [
  {
    question: "Apakah saya harus punya banyak buku untuk mulai?",
    answer:
      "Tidak. Bahkan satu buku yang relevan dan banyak dicari tetap bisa menarik peminjam, terutama buku akademik, self-improvement, atau judul sastra populer.",
  },
  {
    question: "Bagaimana kalau saya hanya ingin pinjamkan di area tertentu?",
    answer:
      "Kamu bisa menulis area serah terima yang jelas, misalnya kampus, kos, perpustakaan, atau titik publik yang sering kamu lewati.",
  },
  {
    question: "Apakah harga harus mengikuti rekomendasi platform?",
    answer:
      "Tidak harus. Rekomendasi hanya membantu, sedangkan harga akhir tetap bisa kamu sesuaikan dengan kondisi buku, durasi, dan tingkat permintaan.",
  },
  {
    question: "Bisa tidak saya menolak permintaan peminjaman?",
    answer:
      "Bisa. Pemilik buku tetap memegang keputusan akhir agar koleksi pribadi terasa aman dan nyaman dipinjamkan.",
  },
];

function LendBookPage() {
  const [form, setForm] = useState<LendBookForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);

  const preview = useMemo(
    () => ({
      title: form.title.trim() || "Judul buku",
      author: form.author.trim() || "Nama penulis",
      category: form.category || "Kategori",
      location: form.location.trim() || "Lokasi",
      price: form.price.trim() || "Rp 0",
    }),
    [form],
  );

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    const nextValue =
      event.target instanceof HTMLInputElement && event.target.type === "checkbox"
        ? event.target.checked
        : value;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: nextValue,
    }));

    if (submitted) {
      setSubmitted(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function handleReset() {
    setForm(initialForm);
    setSubmitted(false);
  }

  function scrollToForm() {
    document
      .querySelector("#form-pinjamkan")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="lend-page">
      <section className="lend-hero">
        <div className="lend-hero-copy">
          <span className="hero-eyebrow">Halaman baru - pemilik buku</span>
          <h1 className="lend-title">
            Pinjamkan Bukumu, <em>Hidupkan</em> Rak Bacamu
          </h1>
          <p className="lend-sub">
            Daftarkan buku yang jarang dibaca, tentukan harga sewa mingguan,
            dan biarkan pembaca di sekitarmu menemukan koleksi yang mereka
            butuhkan. Sederhana, aman, dan terasa personal.
          </p>

          <div className="lend-actions">
            <button className="btn-primary" type="button" onClick={scrollToForm}>
              Mulai Daftarkan Buku
              <ArrowIcon />
            </button>
            <a className="btn-ghost lend-ghost-link" href="#manfaat-pinjamkan">
              Lihat Manfaat
            </a>
          </div>

          <div className="lend-stats" aria-label="Statistik pemilik buku">
            {ownerStats.map((stat) => (
              <span key={stat.label}>
                <strong>{stat.value}</strong>
                {stat.label}
              </span>
            ))}
          </div>
        </div>

        <aside className="lend-hero-panel" aria-label="Ringkasan fitur pemilik buku">
          {heroCards.map((card) => (
            <article className="lend-hero-card" key={card.title}>
              <h2>{card.title}</h2>
              {card.text ? <p>{card.text}</p> : null}
              {card.points ? (
                <ul>
                  {card.points.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </aside>
      </section>

      <section className="lend-section lend-benefit-section" id="manfaat-pinjamkan">
        <div className="lend-section-head">
          <div>
            <span className="section-number">01 - Manfaat</span>
            <h2 className="section-title">
              Kenapa Perlu Pinjamkan Buku di UniLibra
            </h2>
          </div>
          <p>
            Dirancang untuk pemilik koleksi personal yang ingin bukunya lebih
            bermanfaat, tetap terkontrol, dan mudah ditemukan pembaca sekitar.
          </p>
        </div>

        <div className="lend-benefit-grid">
          {benefits.map((benefit) => (
            <article className="lend-benefit-card" key={benefit.title}>
              <div className="lend-icon" aria-hidden="true">
                {benefit.icon}
              </div>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="lend-section lend-form-layout" id="form-pinjamkan">
        <form className="lend-form-card" onSubmit={handleSubmit}>
          <div className="lend-card-head">
            <h2>Form Daftarkan Buku</h2>
            <p>
              Isi data dasar buku untuk membuat halaman listing awal. Versi ini
              adalah prototipe, jadi tombol submit akan menampilkan simulasi
              berhasil.
            </p>
          </div>

          <div className="lend-field-grid">
            <label>
              Judul buku
              <input
                name="title"
                onChange={handleChange}
                placeholder="Contoh: Filosofi Teras"
                type="text"
                value={form.title}
              />
            </label>
            <label>
              Penulis
              <input
                name="author"
                onChange={handleChange}
                placeholder="Contoh: Henry Manampiring"
                type="text"
                value={form.author}
              />
            </label>
            <label>
              Kategori
              <select name="category" onChange={handleChange} value={form.category}>
                <option value="">Pilih kategori</option>
                <option value="Akademik">Akademik</option>
                <option value="Sastra">Sastra</option>
                <option value="Nonfiksi">Nonfiksi</option>
                <option value="Pengembangan diri">Pengembangan diri</option>
                <option value="Fiksi populer">Fiksi populer</option>
              </select>
            </label>
            <label>
              Kondisi buku
              <select
                name="condition"
                onChange={handleChange}
                value={form.condition}
              >
                <option value="">Pilih kondisi</option>
                <option value="Seperti baru">Seperti baru</option>
                <option value="Baik">Baik</option>
                <option value="Cukup baik">Cukup baik</option>
                <option value="Ada catatan">Ada catatan</option>
              </select>
            </label>
            <label>
              Harga pinjam / minggu
              <input
                name="price"
                onChange={handleChange}
                placeholder="Contoh: 7000"
                type="text"
                value={form.price}
              />
            </label>
            <label>
              Lokasi
              <input
                name="location"
                onChange={handleChange}
                placeholder="Contoh: Sleman, Yogyakarta"
                type="text"
                value={form.location}
              />
            </label>
            <label>
              Durasi maksimum
              <select name="duration" onChange={handleChange} value={form.duration}>
                <option value="">Pilih durasi</option>
                <option value="1 minggu">1 minggu</option>
                <option value="2 minggu">2 minggu</option>
                <option value="1 bulan">1 bulan</option>
              </select>
            </label>
            <label>
              Metode serah terima
              <select name="handover" onChange={handleChange} value={form.handover}>
                <option value="">Pilih metode</option>
                <option value="Titik temu publik">Titik temu publik</option>
                <option value="Area kampus">Area kampus</option>
                <option value="Kurir lokal">Kurir lokal</option>
              </select>
            </label>
          </div>

          <label className="lend-full-field">
            Deskripsi buku
            <textarea
              name="description"
              onChange={handleChange}
              placeholder="Tulis ringkasan singkat, kondisi fisik, atau aturan tambahan untuk peminjam."
              rows={5}
              value={form.description}
            />
          </label>

          <label className="lend-checkbox">
            <input
              checked={form.agreed}
              name="agreed"
              onChange={handleChange}
              type="checkbox"
            />
            <span>
              Saya setuju bahwa informasi buku yang saya kirimkan akan
              ditampilkan sebagai listing dan saya siap mengelola permintaan
              peminjaman secara aktif.
            </span>
          </label>

          {submitted ? (
            <div className="lend-submit-note" role="status">
              Listing awal berhasil disimulasikan. Preview di samping sudah
              mengikuti data yang kamu isi.
            </div>
          ) : null}

          <div className="lend-form-actions">
            <button className="btn-primary" type="submit">
              Kirim Listing Buku
            </button>
            <button className="btn-ghost" type="button" onClick={handleReset}>
              Reset Form
            </button>
          </div>
        </form>

        <aside className="lend-side-column">
          <article className="lend-info-card">
            <h2>Tips agar bukumu cepat dipinjam</h2>
            <ul>
              {listingTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </article>

          <article className="lend-preview-card">
            <div className="lend-card-head">
              <h2>Preview Listing</h2>
              <p>Contoh tampilan sederhana setelah buku berhasil didaftarkan.</p>
            </div>
            <div className="lend-preview-cover">
              <span>{preview.title}</span>
            </div>
            <div className="lend-preview-body">
              <span className="lend-status">Tersedia</span>
              <h3>{preview.title}</h3>
              <p>
                {preview.author} - {preview.location}
              </p>
              <span>{preview.category}</span>
              <strong>
                {formatPrice(preview.price)}
                <small> / minggu</small>
              </strong>
            </div>
            <ul className="lend-preview-notes">
              <li>Listing ini bisa dikembangkan ke fitur upload cover asli.</li>
              <li>
                Bisa ditambah rating peminjam, status permintaan, dan histori
                transaksi.
              </li>
            </ul>
          </article>
        </aside>
      </section>

      <section className="lend-section lend-faq-section">
        <div className="lend-section-head">
          <div>
            <span className="section-number">02 - FAQ</span>
            <h2 className="section-title">Pertanyaan Umum Pemilik Buku</h2>
          </div>
          <p>
            Beberapa hal yang biasanya ditanyakan sebelum seseorang mulai
            mendaftarkan koleksi bukunya.
          </p>
        </div>

        <div className="lend-faq-list">
          {faqItems.map((item, index) => (
            <article className="lend-faq-item" key={item.question}>
              <button
                aria-expanded={openFaq === index}
                onClick={() => setOpenFaq(openFaq === index ? -1 : index)}
                type="button"
              >
                {item.question}
                <span aria-hidden="true">{openFaq === index ? "x" : "+"}</span>
              </button>
              {openFaq === index ? <p>{item.answer}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="lend-final-cta">
        <div>
          <h2>Mulai dari satu buku dulu.</h2>
          <p>
            Kadang yang dibutuhkan pembaca lain bukan toko buku besar, tapi rak
            kecil milik seseorang di sekitar mereka. UniLibra membuat koneksi
            itu terasa dekat dan praktis.
          </p>
        </div>
        <button className="btn-banner" type="button" onClick={scrollToForm}>
          Daftarkan Sekarang
        </button>
      </section>
    </main>
  );
}

function formatPrice(value: string) {
  const numbersOnly = value.replace(/\D/g, "");

  if (!numbersOnly) {
    return "Rp 0";
  }

  return `Rp ${Number(numbersOnly).toLocaleString("id-ID")}`;
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  );
}

function IncomeIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-2.5 0-4 1-4 2.5S9.5 13 12 13s4 1 4 2.5S14.5 18 12 18m0-10V6m0 12v-2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 5h14v14H5z"
      />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m12 4 8 4-8 4-8-4 8-4Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4 12 8 4 8-4M4 16l8 4 8-4"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-3.5 7-10V5l-7-3-7 3v6c0 6.5 7 10 7 10Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-5" />
    </svg>
  );
}

export default LendBookPage;
