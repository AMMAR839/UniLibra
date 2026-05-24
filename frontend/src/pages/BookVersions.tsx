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
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => setUserLocation(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, []);

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
            <BookVersionCard
              book={book}
              key={book.id}
              onBorrowBook={onBorrowBook}
              userLocation={userLocation}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function BookVersionCard({
  book,
  onBorrowBook,
  userLocation,
}: {
  book: Book;
  onBorrowBook: (bookID: number) => void;
  userLocation: { latitude: number; longitude: number } | null;
}) {
  const fullAddress = displayAddress(book);
  const distance = formatBookDistance(book, userLocation);

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
            <small>{fullAddress}</small>
          </div>
        </div>
        <div className="book-version-meta">
          <span>
            <small>Jarak</small>
            {distance}
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
        <RatingSummary rating={book.average_rating} count={book.rating_count} />
      </div>
    </article>
  );
}

function RatingSummary({
  rating,
  count,
}: {
  rating?: number;
  count?: number;
}) {
  const safeRating = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating ?? 0)) : 0;
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.round(count ?? 0)) : 0;

  if (safeCount === 0) {
    return <div className="book-version-rating is-empty">Belum ada rating</div>;
  }

  return (
    <div className="book-version-rating" aria-label={`Rating ${safeRating.toFixed(1)} dari 5, ${safeCount} penilai`}>
      <span className="book-version-stars" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={index < Math.round(safeRating) ? "is-filled" : undefined}>
            ★
          </span>
        ))}
      </span>
      <b>{safeRating.toFixed(1)}</b>
      <span>({safeCount})</span>
    </div>
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

function displayAddress(book: Book) {
  const location = book.location?.trim();
  if (!location) {
    return "Alamat belum diisi";
  }

  if (location.split(",").length >= 3) {
    return location;
  }

  const city = book.owner?.city?.trim();
  if (city && !location.toLowerCase().includes(city.toLowerCase())) {
    return `${location}, ${city}, Daerah Istimewa Yogyakarta`;
  }

  return `${location}, Daerah Istimewa Yogyakarta`;
}

function formatBookDistance(
  book: Book,
  userLocation: { latitude: number; longitude: number } | null,
) {
  if (!userLocation) {
    return "Aktifkan lokasi";
  }

  const latitude = finiteNumber(book.latitude);
  const longitude = finiteNumber(book.longitude);
  const distance =
    latitude !== undefined && longitude !== undefined && latitude !== 0 && longitude !== 0
      ? haversineKM(userLocation.latitude, userLocation.longitude, latitude, longitude)
      : fallbackDistanceKM(book);

  return `${Math.max(1, Math.round(distance))} km`;
}

function finiteNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(parsed) ? parsed : undefined;
}

function fallbackDistanceKM(book: Book) {
  return 1.5 + (book.id % 80) / 10;
}

function haversineKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKM = 6371;
  const latDelta = degreesToRadians(lat2 - lat1);
  const lonDelta = degreesToRadians(lon2 - lon1);
  const firstLat = degreesToRadians(lat1);
  const secondLat = degreesToRadians(lat2);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);

  return earthRadiusKM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

export default BookVersionsPage;
