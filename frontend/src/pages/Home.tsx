import { useEffect, useState } from "react";
import { apiFetch, formatCurrency, mediaURL, type Book } from "../lib/api";

type HomeProps = {
  onExploreCatalog: () => void;
  onBorrowBook?: (bookID: number) => void;
};

type AIRecommendationResponse = {
  popular_books?: Book[];
  results?: Book[];
  warning?: string;
};

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

function HomePage({ onExploreCatalog, onBorrowBook }: HomeProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [backendBooks, setBackendBooks] = useState<Book[]>([]);
  const [aiBooks, setAiBooks] = useState<Book[]>([]);
  const [homeNotice, setHomeNotice] = useState("");
  const heroBooks = (aiBooks.length > 0 ? aiBooks : backendBooks).slice(0, 4);
  const featuredBook = heroBooks[activeSlide] ?? heroBooks[0];
  const nextSlide = heroBooks.length > 0 ? (activeSlide + 1) % heroBooks.length : 0;
  const viralBooks = (aiBooks.length > 0 ? aiBooks : backendBooks).slice(0, 10);

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      apiFetch<{ data: Book[] }>("/api/books", {
        auth: false,
        signal: controller.signal,
      }),
      apiFetch<AIRecommendationResponse>("/api/ai/popular", {
        auth: false,
        signal: controller.signal,
      }),
    ]).then(([backendResult, aiResult]) => {
      if (controller.signal.aborted) {
        return;
      }

      if (backendResult.status === "fulfilled") {
        setBackendBooks(backendResult.value.data);
      } else {
        setHomeNotice("Katalog backend belum bisa dimuat.");
      }

      if (aiResult.status === "fulfilled") {
        setAiBooks(aiResult.value.popular_books ?? aiResult.value.results ?? []);
        if (aiResult.value.warning) {
          setHomeNotice(aiResult.value.warning);
        }
      }
    });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (activeSlide >= heroBooks.length) {
      setActiveSlide(0);
    }
  }, [activeSlide, heroBooks.length]);

  useEffect(() => {
    if (heroBooks.length <= 1) {
      return;
    }

    const slideTimer = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % heroBooks.length);
    }, 5600);

    return () => window.clearInterval(slideTimer);
  }, [heroBooks.length]);

  function openBook(bookID: number) {
    if (onBorrowBook) {
      onBorrowBook(bookID);
      return;
    }

    onExploreCatalog();
  }

  return (
    <main className="home-page">
      <section className="home-hero" id="tentang">
        <div className="home-hero-bg" aria-hidden="true">
          <div className="home-hero-carousel">
            {heroBooks.map((book, index) => (
              <div
                className={`home-hero-slide ${
                  index === activeSlide ? "is-active" : ""
                }`}
                key={`hero-${book.id}`}
              >
                {book.cover_url ? <img src={mediaURL(book.cover_url)} alt="" /> : null}
              </div>
            ))}
          </div>
          <div className="home-featured-stack">
            {heroBooks.map((book, index) => (
              <div
                className={`home-featured-slide ${
                  index === activeSlide
                    ? "is-active"
                    : index === nextSlide
                      ? "is-next"
                      : "is-previous"
                }`}
                key={`featured-${book.id}`}
              >
                <div className="home-featured-book">
                  {book.cover_url ? <img src={mediaURL(book.cover_url)} alt="" /> : null}
                  <span>{book.title}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="home-hero-content">
          <h1 className="home-title">UniLibra</h1>
          <p className="home-tagline">
            Tempat buku fisik menemukan pembaca baru di sekitarmu.
          </p>
          <p className="home-sub">
            Pinjam, temukan, dan bagikan koleksi buku dari komunitas sekitar.
            UniLibra membuat membaca terasa dekat, hemat, dan lebih hidup.
          </p>
        </div>

        <div className="home-hero-panel">
          <span className="home-panel-kicker">
            {aiBooks.length > 0 ? "Rekomendasi AI" : "Katalog backend"}
          </span>
          <strong>{featuredBook ? featuredBook.title : "Buku UniLibra"}</strong>
          <span className="home-panel-author">
            {featuredBook?.author || "Data dari backend"}
          </span>
          <p>
            {featuredBook?.description ||
              "Buku dari katalog backend akan tampil di sini lengkap dengan cover yang tersimpan di backend."}
          </p>
          <div className="home-panel-meta">
            {featuredBook ? (
              <>
                <span>{featuredBook.category || "Katalog"}</span>
                <span>{formatCurrency(featuredBook.rental_price)} / minggu</span>
                <span>{featuredBook.location || "Lokasi belum diisi"}</span>
              </>
            ) : null}
          </div>
          <div className="home-hero-dots" aria-label="Pilihan buku hero">
            {heroBooks.map((book, index) => (
              <button
                aria-label={`Tampilkan ${book.title}`}
                aria-pressed={index === activeSlide}
                className={index === activeSlide ? "is-active" : ""}
                key={`dot-${book.id}`}
                onClick={() => setActiveSlide(index)}
                type="button"
              />
            ))}
          </div>
        </div>
        
        <div className="home-actions">
            <button className="btn-primary" type="button" onClick={onExploreCatalog}>
              Jelajahi Katalog
              <ArrowIcon />
            </button>
            <a className="btn-text home-watch-link" href="#sedang-ramai">
              Lihat yang ramai
            </a>
        </div>
      </section>


      <section className="home-rail-section" id="sedang-ramai">
        <div className="home-section-heading">
          <div>
            <span>Buku Viral</span>
            <h2>Buku yang sedang ramai dicari pembaca.</h2>
          </div>
          <button className="btn-ghost" type="button" onClick={onExploreCatalog}>
            Buka katalog
          </button>
        </div>

        {homeNotice ? <p className="home-data-note">{homeNotice}</p> : null}

        <div className="home-book-rail">
          {viralBooks.map((book) => (
            <button
              className="home-poster"
              key={book.id}
              onClick={() => openBook(book.id)}
              type="button"
            >
              <div className="home-poster-cover">
                {book.cover_url ? <img src={mediaURL(book.cover_url)} alt="" /> : null}
                <span>{book.title}</span>
              </div>
              <div className="home-poster-body">
                <span>{book.category || "Katalog"}</span>
                <h3>{book.title}</h3>
                <p>
                  {book.author} &bull; {formatBookPrice(book)}
                </p>
              </div>
            </button>
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

function formatBookPrice(book: Book) {
  const rentalPrice = Number(book.rental_price);
  const minPrice = Number((book as Book & { min_price?: number }).min_price);
  const maxPrice = Number((book as Book & { max_price?: number }).max_price);

  if (Number.isFinite(rentalPrice)) {
    return formatCurrency(rentalPrice);
  }
  if (Number.isFinite(minPrice) && Number.isFinite(maxPrice) && Math.round(minPrice) !== Math.round(maxPrice)) {
    return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
  }
  if (Number.isFinite(minPrice)) {
    return formatCurrency(minPrice);
  }

  return "Harga tersedia di katalog";
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
