import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { apiFetch, formatCurrency, mediaURL, type Book } from "../lib/api";

type CatalogPageProps = {
  onBorrowBook?: (bookID: number) => void;
  onLendBook?: () => void;
};

function CatalogPage({ onBorrowBook, onLendBook }: CatalogPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setNotice("");
      try {
        const query = searchQuery.trim();
        if (query) {
          const response = await apiFetch<{
            results: Book[];
            fallback?: boolean;
            warning?: string;
          }>(`/api/ai/search?q=${encodeURIComponent(query)}`, {
            auth: false,
            signal: controller.signal,
          });
          setBooks(response.results ?? []);
          setNotice(response.warning || "");
        } else {
          const response = await apiFetch<{ data: Book[] }>("/api/books", {
            auth: false,
            signal: controller.signal,
          });
          setBooks(response.data);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setBooks([]);
          setNotice(error instanceof Error ? error.message : "Katalog belum bisa dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    apiFetch<{ popular_books?: Book[]; results?: Book[] }>("/api/ai/popular", {
      auth: false,
    })
      .then((response) => setPopularBooks(response.popular_books ?? response.results ?? []))
      .catch(() => setPopularBooks([]));
  }, []);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
  }

  return (
    <main className="catalog-page">
      <section className="books-section catalog-books-section" id="catalog-books">
        <div className="catalog-section-header">
          <div>
            <span className="section-number">Katalog Buku</span>
            <h2 className="section-title">Pilih Buku yang Mau Dipinjam</h2>
          </div>
          <div className="catalog-section-meta">
            <span>{books.length} buku cocok</span>
            <a href="#catalog-books" className="section-link">
              Lihat semua
              <ArrowIcon />
            </a>
          </div>
        </div>

        <label className="catalog-inline-search">
          <SearchIcon />
          <input
            onChange={handleSearchChange}
            placeholder="Cari judul, penulis, atau genre buku..."
            type="search"
            value={searchQuery}
          />
          {searchQuery ? (
            <button type="button" onClick={() => setSearchQuery("")}>
              Bersihkan
            </button>
          ) : null}
        </label>

        <div className="book-grid catalog-book-grid">
          {books.map((book) => (
            <BookCard book={book} key={book.id} onBorrowBook={onBorrowBook} />
          ))}
        </div>

        {loading ? <div className="catalog-empty-state">Memuat katalog...</div> : null}
        {notice ? <div className="catalog-empty-state">{notice}</div> : null}
        {!loading && books.length === 0 ? (
          <div className="catalog-empty-state">
            Tidak ada buku yang cocok dengan pencarianmu.
          </div>
        ) : null}
      </section>

      {popularBooks.length > 0 && !searchQuery.trim() ? (
        <section className="books-section catalog-books-section">
          <div className="catalog-section-header">
            <div>
              <span className="section-number">Rekomendasi AI</span>
              <h2 className="section-title">Buku yang Banyak Dilirik</h2>
            </div>
          </div>
          <div className="book-grid catalog-book-grid">
            {popularBooks.slice(0, 4).map((book) => (
              <BookCard book={book} key={`popular-${book.id}`} onBorrowBook={onBorrowBook} />
            ))}
          </div>
        </section>
      ) : null}

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
  book: Book;
  onBorrowBook?: (bookID: number) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onBorrowBook?.(book.id);
    }
  }

  return (
    <article
      aria-label={`Pinjam buku ${book.title}`}
      className="book-card catalog-book-card"
      onClick={() => onBorrowBook?.(book.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="book-cover-wrap">
        {book.cover_url ? (
          <img
            className="book-cover-img bc-photo"
            src={mediaURL(book.cover_url)}
            alt={book.title}
          />
        ) : (
          <div className="book-cover-img bc-5">{book.title}</div>
        )}
        <span className="book-badge badge-available">Tersedia</span>
      </div>
      <div className="book-body">
        <span className="catalog-book-genre">{book.category || "Katalog"}</span>
        <div className="book-title">{book.title}</div>
        <div className="book-author">{book.author}</div>
        <div className="book-meta">
          <div className="book-rating">
            <StarIcon />
            {book.owner?.name || "Pemilik"}
          </div>
          <div className="book-dist">
            <PinIcon />
            {book.location || "Lokasi belum diisi"}
          </div>
        </div>
      </div>
      <div className="book-footer">
        <div className="book-price">
          <strong>{formatCurrency(book.rental_price)}</strong> / minggu
        </div>
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

function SearchIcon() {
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
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
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
