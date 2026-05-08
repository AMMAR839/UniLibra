import { useEffect, useState } from "react";
import bulanHero from "../assets/bulan-hero.png";
import harryHero from "../assets/book_harry-hero.webp";
import harryBookCover from "../assets/book_harry.webp";
import dilanHero from "../assets/Dilan.png";
import dilanBookCover from "../assets/Dilan.webp";
import bulanBookCover from "../assets/novel_bulan_tere_liye.jpg";

type HomeProps = {
  onExploreCatalog: () => void;
};

const heroSlides = [
  {
    title: "Dilan 1990",
    author: "Pidi Baiq",
    kicker: "Sedang dipinjam minggu ini",
    heroImage: dilanHero,
    bookCover: dilanBookCover,
    description:
      "Novel remaja populer tentang Dilan dan Milea yang ringan, hangat, dan sering dicari pembaca baru.",
    meta: ["4.9 rating", "Rp 7.000 / minggu"],
  },
  {
    title: "Bulan",
    author: "Tere Liye",
    kicker: "Petualangan favorit pembaca",
    heroImage: bulanHero,
    bookCover: bulanBookCover,
    description:
      "Lanjutan dunia fantasi Tere Liye yang membawa pembaca ke perjalanan besar penuh rahasia dan keberanian.",
    meta: ["4.8 rating", "Rp 8.000 / minggu"],
  },
  {
    title: "Harry Potter",
    author: "J.K. Rowling",
    kicker: "Fantasi klasik pilihan pembaca",
    heroImage: harryHero,
    bookCover: harryBookCover,
    description:
      "Kisah awal dunia sihir yang tetap seru dibaca ulang, cocok untuk pembaca fantasi dan petualangan.",
    meta: ["4.9 rating", "Rp 9.000 / minggu"],
  },
];

const trendingBooks = [
  {
    title: "Laskar Pelangi",
    author: "Andrea Hirata",
    meta: "1.8 km",
    coverClass: "home-cover-laskar",
    label: "Populer",
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    meta: "1.5 km",
    coverClass: "home-cover-atomic",
    label: "Paling dicari",
  },
  {
    title: "Bumi Manusia",
    author: "Pramoedya Ananta Toer",
    meta: "2.1 km",
    coverClass: "home-cover-bumi",
    label: "Sastra",
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    meta: "1.5 km",
    coverClass: "home-cover-sapiens",
    label: "Nonfiksi",
  },
  {
    title: "Ronggeng Dukuh Peruk",
    author: "Ahmad Tohari",
    meta: "1.8 km",
    coverClass: "home-cover-ronggeng",
    label: "Tersedia",
  },
];

const readingPaths = [
  "Bacaan ringan setelah kuliah",
  "Buku pengembangan diri",
  "Novel Indonesia populer",
  "Referensi tugas dan riset",
  "Koleksi dekat kos",
];

const benefits = [
  {
    number: "01",
    title: "Buku dekat dengan hidupmu",
    text: "Cari buku dari orang di sekitar rumah, kampus, atau komunitas yang kamu ikuti.",
  },
  {
    number: "02",
    title: "Rak pribadi jadi berguna",
    text: "Buku yang jarang dibuka bisa dipinjamkan dan kembali punya nilai untuk orang lain.",
  },
  {
    number: "03",
    title: "Pilihan baca terasa personal",
    text: "Katalog dapat dikembangkan menjadi rekomendasi berdasarkan genre, lokasi, dan riwayat.",
  },
];

function HomePage({ onExploreCatalog }: HomeProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const featuredSlide = heroSlides[activeSlide];
  const nextSlide = (activeSlide + 1) % heroSlides.length;

  useEffect(() => {
    const slideTimer = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % heroSlides.length);
    }, 5600);

    return () => window.clearInterval(slideTimer);
  }, []);

  return (
    <main className="home-page">
      <section className="home-hero" id="tentang">
        <div className="home-hero-bg" aria-hidden="true">
          <div className="home-hero-carousel">
            {heroSlides.map((slide, index) => (
              <div
                className={`home-hero-slide ${
                  index === activeSlide ? "is-active" : ""
                }`}
                key={slide.title}
              >
                <img src={slide.heroImage} alt="" />
              </div>
            ))}
          </div>
          <div className="home-featured-stack">
            {heroSlides.map((slide, index) => (
              <div
                className={`home-featured-slide ${
                  index === activeSlide
                    ? "is-active"
                    : index === nextSlide
                      ? "is-next"
                      : "is-previous"
                }`}
                key={slide.title}
              >
                <div className="home-featured-book">
                  <img src={slide.bookCover} alt="" />
                  <span>{slide.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="home-hero-content">
          <div className="hero-eyebrow">Komunitas baca Indonesia</div>
          <h1 className="home-title">UniLibra</h1>
          <p className="home-tagline">
            Tempat buku fisik menemukan pembaca baru di sekitarmu.
          </p>
          <p className="home-sub">
            Pinjam, temukan, dan bagikan koleksi buku dari komunitas sekitar.
            UniLibra membuat membaca terasa dekat, hemat, dan lebih hidup.
          </p>
          <div className="home-actions">
            <button className="btn-primary" type="button" onClick={onExploreCatalog}>
              Jelajahi Katalog
              <ArrowIcon />
            </button>
            <a className="btn-text home-watch-link" href="#sedang-ramai">
              Lihat yang ramai
            </a>
          </div>
        </div>

        <div className="home-hero-panel">
          <span className="home-panel-kicker">{featuredSlide.kicker}</span>
          <strong>{featuredSlide.title}</strong>
          <span className="home-panel-author">{featuredSlide.author}</span>
          <p>{featuredSlide.description}</p>
          <div className="home-panel-meta">
            {featuredSlide.meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="home-hero-dots" aria-label="Pilihan buku hero">
            {heroSlides.map((slide, index) => (
              <button
                aria-label={`Tampilkan ${slide.title}`}
                aria-pressed={index === activeSlide}
                className={index === activeSlide ? "is-active" : ""}
                key={slide.title}
                onClick={() => setActiveSlide(index)}
                type="button"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="home-rail-section" id="sedang-ramai">
        <div className="home-section-heading">
          <div>
            <span>Trending di UniLibra</span>
            <h2>Buku yang bikin orang berhenti scroll.</h2>
          </div>
          <button className="btn-ghost" type="button" onClick={onExploreCatalog}>
            Buka katalog
          </button>
        </div>

        <div className="home-book-rail">
          {trendingBooks.map((book) => (
            <article className="home-poster" key={book.title}>
              <div className={`home-poster-cover ${book.coverClass}`}>
                <span>{book.title}</span>
              </div>
              <div className="home-poster-body">
                <span>{book.label}</span>
                <h3>{book.title}</h3>
                <p>
                  {book.author} &bull; {book.meta}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="home-story-band" id="cara-kerja">
        <div className="home-story-copy">
          <span>Cara kerja UniLibra</span>
          <h2>Buka katalog, pilih buku, lalu baca tanpa harus membeli baru.</h2>
          <p>
            Setiap buku punya konteks: siapa penulisnya, lokasinya, status
            ketersediaannya, dan biaya pinjamnya. Dari situ pembaca bisa
            menemukan bacaan yang relevan, sementara pemilik buku punya alasan
            untuk merawat koleksinya.
          </p>
        </div>
        <div className="home-benefits">
          {benefits.map((benefit) => (
            <article className="home-benefit" key={benefit.number}>
              <span>{benefit.number}</span>
              <h3>{benefit.title}</h3>
              <p>{benefit.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-path-section" id="blog">
        <div className="home-section-heading">
          <div>
            <span>Mulai dari mood baca</span>
            <h2>Pilih jalur bacaan yang terasa paling dekat.</h2>
          </div>
        </div>
        <div className="home-path-row">
          {readingPaths.map((path) => (
            <button className="home-path-pill" type="button" key={path}>
              {path}
            </button>
          ))}
        </div>
      </section>

      <section className="home-owner-section" id="pinjamkan">
        <div>
          <span>Untuk pemilik buku</span>
          <h2>Rak yang diam bisa jadi pintu masuk pembaca lain.</h2>
        </div>
        <p>
          UniLibra membuat koleksi pribadi lebih mudah ditemukan. Buku yang
          jarang dibaca bisa berpindah tangan sementara, memberi manfaat, lalu
          kembali ke rak dengan cerita baru.
        </p>
      </section>

      <section className="home-final-cta" id="kontak">
        <div>
          <span>Siap mulai?</span>
          <h2>Lihat dulu bukunya. Setelah itu baru putuskan mau pinjam yang mana.</h2>
        </div>
        <button className="btn-banner" type="button" onClick={onExploreCatalog}>
          Masuk ke Katalog
        </button>
      </section>
    </main>
  );
}

function ArrowIcon() {
  return (
    <svg
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

export default HomePage;
