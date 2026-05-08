import bulanCover from "../assets/novel_bulan_tere_liye.jpg";
import dilanCover from "../assets/Dilan.webp";
import harryCover from "../assets/book_harry.webp";

type CatalogBook = {
  title: string;
  author: string;
  genre: string;
  badge: string;
  badgeClass: string;
  rating: string;
  distance: string;
  price: string;
  coverSrc?: string;
  coverClass: string;
};

const catalogBooks: CatalogBook[] = [
  {
    title: "Dilan 1990",
    author: "Pidi Baiq",
    genre: "Romansa",
    badge: "Populer",
    badgeClass: "badge-popular",
    rating: "4.9",
    distance: "1.1 km",
    price: "Rp 7.000",
    coverSrc: dilanCover,
    coverClass: "bc-photo",
  },
  {
    title: "Bulan",
    author: "Tere Liye",
    genre: "Fantasi",
    badge: "Tersedia",
    badgeClass: "badge-available",
    rating: "4.8",
    distance: "1.4 km",
    price: "Rp 8.000",
    coverSrc: bulanCover,
    coverClass: "bc-photo",
  },
  {
    title: "Harry Potter and the Philosopher's Stone",
    author: "J.K. Rowling",
    genre: "Fantasi",
    badge: "Favorit",
    badgeClass: "badge-popular",
    rating: "4.9",
    distance: "1.6 km",
    price: "Rp 9.000",
    coverSrc: harryCover,
    coverClass: "bc-photo",
  },
  {
    title: "Laskar Pelangi",
    author: "Andrea Hirata",
    genre: "Fiksi Indonesia",
    badge: "Tersedia",
    badgeClass: "badge-available",
    rating: "4.9",
    distance: "1.8 km",
    price: "Rp 7.000",
    coverSrc: "/image.png",
    coverClass: "bc-photo",
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    genre: "Pengembangan diri",
    badge: "Paling dicari",
    badgeClass: "badge-popular",
    rating: "4.8",
    distance: "1.5 km",
    price: "Rp 7.000",
    coverSrc: "/2.png",
    coverClass: "bc-photo",
  },
  {
    title: "Bumi Manusia",
    author: "Pramoedya Ananta Toer",
    genre: "Sastra",
    badge: "Tersedia",
    badgeClass: "badge-available",
    rating: "4.7",
    distance: "2.1 km",
    price: "Rp 6.000",
    coverClass: "bc-5",
  },
];

const heroBooks = catalogBooks.slice(0, 3);
const filterLabels = ["Semua", "Terdekat", "Populer", "Fantasi", "Sastra"];

type CatalogPageProps = {
  onBorrowBook?: () => void;
  onLendBook?: () => void;
};

function CatalogPage({ onBorrowBook, onLendBook }: CatalogPageProps) {
  return (
    <main className="catalog-page">
      <section className="catalog-hero">
        <div className="catalog-hero-copy">
          <div className="hero-eyebrow">Katalog Buku UniLibra</div>
          <h1 className="catalog-title">
            Temukan buku yang dekat dengan hidupmu.
          </h1>
          <p className="catalog-sub">
            Pilih dari koleksi sekitar kampus, kos, dan komunitas. Setiap buku
            punya status, jarak, rating, dan biaya pinjam yang mudah dibandingkan.
          </p>
          <div className="catalog-hero-actions">
            <button className="btn-primary" type="button" onClick={onBorrowBook}>
              Mulai Meminjam
              <ArrowIcon />
            </button>
            <div className="catalog-hero-stats" aria-label="Statistik katalog">
              <span>
                <strong>12.400+</strong>
                Buku tersedia
              </span>
              <span>
                <strong>3.200+</strong>
                Peminjam aktif
              </span>
            </div>
          </div>
        </div>

        <aside className="catalog-showcase" aria-label="Pilihan buku unggulan">
          <div className="catalog-showcase-main">
            <img src={dilanCover} alt="Dilan 1990" />
            <div>
              <span>Rekomendasi minggu ini</span>
              <strong>Dilan 1990</strong>
              <p>Romansa ringan dari pemilik buku 1.1 km dari areamu.</p>
            </div>
          </div>
          <div className="catalog-showcase-list">
            {heroBooks.map((book) => (
              <div className="catalog-mini-book" key={book.title}>
                {book.coverSrc ? (
                  <img src={book.coverSrc} alt={book.title} />
                ) : (
                  <div className={`catalog-mini-cover ${book.coverClass}`}>
                    {book.title}
                  </div>
                )}
                <div>
                  <strong>{book.title}</strong>
                  <span>{book.distance} dari lokasi kamu</span>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="catalog-toolbar" aria-label="Cari dan filter katalog">
        <div className="search-input-wrap catalog-search-wrap">
          <SearchIcon size={18} />
          <input
            className="search-input"
            type="text"
            placeholder="Cari judul, penulis, genre, atau lokasi..."
          />
        </div>
        <div className="catalog-filter-row">
          {filterLabels.map((label) => (
            <button
              className={`catalog-filter-chip ${
                label === "Semua" ? "is-active" : ""
              }`}
              key={label}
              type="button"
            >
              {label === "Semua" ? <FilterIcon /> : null}
              {label}
            </button>
          ))}
        </div>
        <button className="btn-search catalog-search-button" type="button">
          <SearchIcon size={16} />
          Cari
        </button>
      </section>

      <section className="books-section catalog-books-section" id="catalog-books">
        <div className="catalog-section-header">
          <div>
            <span className="section-number">01 - Koleksi terdekat</span>
            <h2 className="section-title">Rekomendasi di Sekitarmu</h2>
          </div>
          <div className="catalog-section-meta">
            <span>6 buku cocok</span>
            <a href="#catalog-books" className="section-link">
              Lihat semua
              <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="book-grid catalog-book-grid">
          {catalogBooks.map((book) => (
            <BookCard book={book} key={book.title} onBorrowBook={onBorrowBook} />
          ))}
        </div>
      </section>

      <div className="banner-strip catalog-banner">
        <div>
          <div className="banner-title">Punya buku yang jarang dibaca?</div>
          <p className="banner-sub">
            Daftarkan koleksimu dan bantu pembaca lain menemukan buku yang
            mereka butuhkan tanpa harus membeli baru.
          </p>
        </div>
        <button className="btn-banner" type="button" onClick={onLendBook}>
          Pinjamkan Bukumu
          <ArrowIcon />
        </button>
      </div>
    </main>
  );
}

function BookCard({
  book,
  onBorrowBook,
}: {
  book: CatalogBook;
  onBorrowBook?: () => void;
}) {
  return (
    <article className="book-card catalog-book-card">
      <div className="book-cover-wrap">
        {book.coverSrc ? (
          <img
            className={`book-cover-img ${book.coverClass}`}
            src={book.coverSrc}
            alt={book.title}
          />
        ) : (
          <div className={`book-cover-img ${book.coverClass}`}>{book.title}</div>
        )}
        <span className={`book-badge ${book.badgeClass}`}>{book.badge}</span>
      </div>
      <div className="book-body">
        <span className="catalog-book-genre">{book.genre}</span>
        <div className="book-title">{book.title}</div>
        <div className="book-author">{book.author}</div>
        <div className="book-meta">
          <div className="book-rating">
            <StarIcon />
            {book.rating}
          </div>
          <div className="book-dist">
            <PinIcon />
            {book.distance}
          </div>
        </div>
      </div>
      <div className="book-footer">
        <div className="book-price">
          <strong>{book.price}</strong> / minggu
        </div>
        <button className="btn-pinjam" type="button" onClick={onBorrowBook}>
          Pinjam Sekarang
        </button>
      </div>
    </article>
  );
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

function SearchIcon({ size }: { size: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
      />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h16M7 12h10M10 18h4"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m12 2.6 2.86 5.8 6.4.93-4.63 4.51 1.1 6.37L12 17.2l-5.73 3.01 1.1-6.37-4.63-4.51 6.4-.93L12 2.6Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z"
      />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

export default CatalogPage;
