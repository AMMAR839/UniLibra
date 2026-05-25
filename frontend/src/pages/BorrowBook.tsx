import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  apiFetch,
  formatCurrency,
  initials,
  mediaURL,
  type Book,
  type ChatThread,
} from "../lib/api";

type BorrowForm = {
  startDate: string;
  duration: string;
  handover: string;
  location: string;
  note: string;
};

type BorrowBookPageProps = {
  onBackToCatalog: () => void;
  onBorrowBook: (bookID: number) => void;
};

const initialBorrowForm: BorrowForm = {
  startDate: new Date().toISOString().slice(0, 10),
  duration: "2 minggu",
  handover: "Ketemuan langsung",
  location: "Sekitar UGM / Sleman",
  note: "Halo kak, saya ingin pinjam buku ini untuk 2 minggu. Saya fleksibel untuk ketemu Kamis sore atau Jumat siang.",
};

type SimilarBooksResponse = {
  results?: Book[];
  data?: Book[];
};

function BorrowBookPage({ onBackToCatalog, onBorrowBook }: BorrowBookPageProps) {
  const [form, setForm] = useState<BorrowForm>(initialBorrowForm);
  const [book, setBook] = useState<Book | null>(null);
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitMessage, setSubmitMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const bookID = new URLSearchParams(window.location.search).get("book");

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => setUserLocation(null),
      { enableHighAccuracy: true, maximumAge: 300000, timeout: 9000 },
    );
  }, []);

  useEffect(() => {
    if (!bookID) {
      setLoading(false);
      return;
    }

    Promise.allSettled([
      apiFetch<{ data: Book }>(`/api/books/${bookID}`, { auth: false }),
      apiFetch<SimilarBooksResponse>(`/api/ai/similar/${bookID}`, { auth: false }),
    ])
      .then(([bookResult, similarResult]) => {
        if (bookResult.status === "rejected") {
          throw bookResult.reason;
        }

        setBook(bookResult.value.data);
        if (similarResult.status === "fulfilled") {
          const candidates = similarResult.value.results ?? similarResult.value.data ?? [];
          setSimilarBooks(
            candidates.filter((item) => item.id !== bookResult.value.data.id).slice(0, 4),
          );
        }
      })
      .catch((error) =>
        setSubmitMessage(
          error instanceof Error ? error.message : "Detail buku belum bisa dimuat.",
        ),
      )
      .finally(() => setLoading(false));
  }, [bookID]);

  const pricing = useMemo(() => {
    const rentalPrice =
      form.duration === "1 minggu"
        ? book?.rental_price ?? 0
        : form.duration === "1 bulan"
          ? (book?.rental_price ?? 0) * 4
          : (book?.rental_price ?? 0) * 2;
    const serviceFee = 0;

    return {
      rentalPrice,
      serviceFee,
      total: rentalPrice + serviceFee,
    };
  }, [book?.rental_price, form.duration]);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    setSubmitMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!book) {
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/transactions/borrow", {
        method: "POST",
        body: JSON.stringify({
          book_id: book.id,
          borrow_date: new Date(`${form.startDate}T00:00:00`).toISOString(),
          expected_return_date: expectedReturnDate(
            form.startDate,
            form.duration,
          ).toISOString(),
          handover: form.handover,
          location: form.location,
          note: form.note,
        }),
      });
      setSubmitMessage("Permintaan peminjaman sudah dikirim ke pemilik buku.");
    } catch (error) {
      setSubmitMessage(
        error instanceof Error ? error.message : "Permintaan peminjaman gagal.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function openNavbarChat() {
    if (!book?.owner_id) {
      return;
    }

    try {
      const response = await apiFetch<{ data: ChatThread }>("/api/chat/threads", {
        method: "POST",
        body: JSON.stringify({
          participant_id: book.owner_id,
          book_id: book.id,
        }),
      });
      window.dispatchEvent(
        new CustomEvent("unilibra:open-chat", {
          detail: { threadID: response.data.id },
        }),
      );
    } catch (error) {
      setSubmitMessage(error instanceof Error ? error.message : "Chat belum bisa dibuka.");
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return <main className="borrow-page"><div className="borrow-submit-note">Memuat buku...</div></main>;
  }

  if (!book) {
    return (
      <main className="borrow-page">
        <div className="borrow-submit-note">
          Pilih buku dari katalog terlebih dahulu.
        </div>
      </main>
    );
  }

  return (
    <main className="borrow-page">
      <section className="borrow-layout">
        <div className="borrow-main-column">
          <article className="borrow-book-card">
            <div className="borrow-cover">
              <span className="book-badge badge-available">Tersedia</span>
              {book.cover_url ? (
                <img src={mediaURL(book.cover_url)} alt={book.title} />
              ) : (
                <strong>{book.title}</strong>
              )}
            </div>

            <div className="borrow-book-detail">
              <div className="borrow-book-head">
                <div>
                  <h2>{book.title}</h2>
                  <p>{book.author}</p>
                </div>
                <div className="borrow-price">
                  <span>Harga pinjam</span>
                  <strong>{formatCurrency(book.rental_price)}</strong>
                </div>
              </div>

              <div className="borrow-meta-grid">
                <span>
                  <small>Kategori</small>
                  {book.category || "Belum diisi"}
                </span>
                <span>
                  <small>Tema</small>
                  {book.theme || "Belum diisi"}
                </span>
                <span>
                  <small>Jarak</small>
                  {formatBookDistance(book, userLocation)}
                </span>
                <span>
                  <small>Kondisi</small>
                  {book.condition || "Belum diisi"}
                </span>
              </div>

              <p className="borrow-description">
                {book.description || "Pemilik belum menambahkan deskripsi buku."}
              </p>

              <BorrowRatingSummary
                rating={book.average_rating}
                count={book.rating_count}
              />

              <div className="borrow-owner-row">
                <div className="avatar">{initials(book.owner?.name)}</div>
                <div>
                  <strong>{book.owner?.name || "Pemilik buku"}</strong>
                  <span>{displayAddress(book)}</span>
                </div>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={openNavbarChat}
                >
                  Buka Chat
                </button>
              </div>
            </div>
          </article>

          <form className="borrow-request-card" onSubmit={handleSubmit}>
            <div className="borrow-card-head">
              <h2>Ajukan Peminjaman</h2>
              <p>
                Tanggal dan durasi dikirim ke pemilik buku. Detail serah terima
                dapat dilanjutkan lewat chat.
              </p>
            </div>

            <div className="borrow-field-grid">
              <label>
                Tanggal mulai pinjam
                <input
                  name="startDate"
                  onChange={handleChange}
                  type="date"
                  value={form.startDate}
                />
              </label>
              <label>
                Durasi pinjam
                <select name="duration" onChange={handleChange} value={form.duration}>
                  <option value="1 minggu">1 minggu</option>
                  <option value="2 minggu">2 minggu</option>
                  <option value="1 bulan">1 bulan</option>
                </select>
              </label>
              <label>
                Metode serah terima
                <select name="handover" onChange={handleChange} value={form.handover}>
                  <option value="Ketemuan langsung">Ketemuan langsung</option>
                  <option value="Area kampus">Area kampus</option>
                  <option value="Kurir lokal">Kurir lokal</option>
                </select>
              </label>
              <label>
                Preferensi lokasi
                <input
                  name="location"
                  onChange={handleChange}
                  type="text"
                  value={form.location}
                />
              </label>
            </div>

            <label className="borrow-full-field">
              Catatan untuk pemilik
              <textarea
                name="note"
                onChange={handleChange}
                rows={5}
                value={form.note}
              />
            </label>

            <div className="borrow-summary-box">
              <span>
                Harga sewa
                <strong>{formatCurrency(pricing.rentalPrice)}</strong>
              </span>
              <span>
                Biaya layanan
                <strong>{formatCurrency(pricing.serviceFee)}</strong>
              </span>
              <span>
                Metode serah terima
                <strong>{form.handover}</strong>
              </span>
              <span className="borrow-total-row">
                Total estimasi
                <strong>{formatCurrency(pricing.total)}</strong>
              </span>
            </div>

            {submitMessage ? (
              <div className="borrow-submit-note" role="status">
                {submitMessage}
              </div>
            ) : null}

            <div className="borrow-form-actions">
              <button className="btn-search" type="submit" disabled={submitting}>
                {submitting ? "Mengirim..." : "Ajukan Peminjaman"}
              </button>
              <button className="btn-ghost" type="button" onClick={onBackToCatalog}>
                Kembali ke Katalog
              </button>
            </div>
          </form>

          {similarBooks.length ? (
            <section className="borrow-recommendation-card">
              <div className="borrow-card-head">
                <h2>Buku Serupa</h2>
                <p>Rekomendasi dari pencarian semantik untuk buku yang sedang kamu lihat.</p>
              </div>
              <div className="borrow-recommendation-grid">
                {similarBooks.map((similarBook) => (
                  <button
                    className="borrow-recommendation-book"
                    key={similarBook.id}
                    onClick={() => onBorrowBook(similarBook.id)}
                    type="button"
                  >
                    <span>
                      {similarBook.cover_url ? (
                        <img src={mediaURL(similarBook.cover_url)} alt={similarBook.title} />
                      ) : (
                        similarBook.title
                      )}
                    </span>
                    <strong>{similarBook.title}</strong>
                    <small>{similarBook.author}</small>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function expectedReturnDate(startDate: string, duration: string) {
  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(
    date.getDate() +
      (duration === "1 minggu" ? 7 : duration === "1 bulan" ? 30 : 14),
  );
  return date;
}

function displayAddress(book: Book) {
  const location = book.location?.trim();
  if (!location) {
    return book.owner?.city || "Lokasi pemilik belum diisi";
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

function BorrowRatingSummary({
  rating,
  count,
}: {
  rating?: number;
  count?: number;
}) {
  const safeRating = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating ?? 0)) : 0;
  const safeCount = Number.isFinite(count) ? Math.max(0, Math.round(count ?? 0)) : 0;

  if (safeCount === 0) {
    return (
      <div className="borrow-rating-summary is-empty">
        <span>Rating buku</span>
        <strong>Belum ada rating</strong>
      </div>
    );
  }

  return (
    <div
      className="borrow-rating-summary"
      aria-label={`Rating ${safeRating.toFixed(1)} dari 5, ${safeCount} penilai`}
    >
      <span>Rating buku</span>
      <div>
        <b aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <i key={index} className={index < Math.round(safeRating) ? "is-filled" : undefined}>
              ★
            </i>
          ))}
        </b>
        <strong>{safeRating.toFixed(1)}</strong>
        <small>({safeCount})</small>
      </div>
    </div>
  );
}

export default BorrowBookPage;
