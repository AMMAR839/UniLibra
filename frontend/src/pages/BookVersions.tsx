import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  apiFetch,
  formatCurrency,
  initials,
  mediaURL,
  type Book,
} from "../lib/api";

type BookVersionsPageProps = {
  onBackToCatalog: () => void;
  onBorrowBook: (bookID: number) => void;
};

function BookVersionsPage({ onBackToCatalog, onBorrowBook }: BookVersionsPageProps) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const title = params.get("title")?.trim() ?? "";
  const author = params.get("author")?.trim() ?? "";
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!title) {
      setBooks([]);
      setNotice("Judul buku belum dipilih.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({ title });
    if (author) {
      query.set("author", author);
    }

    setLoading(true);
    setNotice("");
    apiFetch<{ data: Book[] }>(`/api/books/versions?${query.toString()}`, {
      auth: false,
      signal: controller.signal,
    })
      .then((response) => setBooks(response.data))
      .catch((error) => {
        if (!controller.signal.aborted) {
          setBooks([]);
          setNotice(
            error instanceof Error ? error.message : "Versi buku belum bisa dimuat.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [author, title]);

  return (
    <main className="catalog-page">
      <section className="books-section book-versions-section">
        <div className="catalog-section-header book-versions-header">
          <div>
            <span className="section-number">Pilihan Pemilik</span>
            <h2 className="section-title">{title || "Versi Buku"}</h2>
            {author ? <p>{author}</p> : null}
          </div>
          <div className="catalog-section-meta">
            <span>{books.length} pilihan tersedia</span>
            <button className="section-link" type="button" onClick={onBackToCatalog}>
              Kembali ke katalog
              <ArrowIcon />
            </button>
          </div>
        </div>

        {loading ? <div className="catalog-empty-state">Memuat versi buku...</div> : null}
        {notice ? <div className="catalog-empty-state">{notice}</div> : null}
        {!loading && !notice && books.length === 0 ? (
          <div className="catalog-empty-state">
            Belum ada versi lain untuk buku ini.
          </div>
        ) : null}

        <div className="book-version-list">
          {books.map((book) => (
            <BookVersionCard book={book} key={book.id} onBorrowBook={onBorrowBook} />
          ))}
        </div>
      </section>
    </main>
  );
}

function BookVersionCard({
  book,
  onBorrowBook,
}: {
  book: Book;
  onBorrowBook: (bookID: number) => void;
}) {
  function openBorrowPage() {
    onBorrowBook(book.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openBorrowPage();
    }
  }

  return (
    <article
      aria-label={`Pilih buku ${book.title} dari ${book.owner?.name || "pemilik"}`}
      className="book-version-card"
      onClick={openBorrowPage}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="book-version-cover">
        {book.cover_url ? (
          <img alt={book.title} src={mediaURL(book.cover_url)} />
        ) : (
          <strong>{book.title}</strong>
        )}
      </div>

      <div className="book-version-copy">
        <div className="book-version-title-row">
          <span>{book.category || "Katalog"}</span>
          <span>{book.theme || "Tema umum"}</span>
        </div>
        <h3>{book.title}</h3>
        <p>{book.author}</p>
        <div className="book-version-owner">
          <span className="avatar">{initials(book.owner?.name)}</span>
          <div>
            <strong>{book.owner?.name || "Pemilik buku"}</strong>
            <small>{book.owner?.city || book.location || "Lokasi belum diisi"}</small>
          </div>
        </div>
        <div className="book-version-meta">
          <span>
            <small>Lokasi</small>
            {book.location || "Belum diisi"}
          </span>
          <span>
            <small>Kondisi</small>
            {book.condition || "Belum diisi"}
          </span>
          <span>
            <small>Status</small>
            {book.status || "available"}
          </span>
        </div>
      </div>

      <div className="book-version-action">
        <span>Harga pinjam</span>
        <strong>{formatCurrency(book.rental_price)}</strong>
        <small>/ minggu</small>
        <button className="btn-search" type="button">
          Pilih Buku Ini
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

export default BookVersionsPage;
