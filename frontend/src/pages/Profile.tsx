import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import {
  apiFetch,
  formatCurrency,
  formatDate,
  initials,
  mediaURL,
  type Book,
  type Transaction,
  type User,
} from "../lib/api";
import { bookCategories, themesForCategory } from "../lib/bookTaxonomy";

type ProfileSection = "history" | "books" | "transactions";

const profileTabs: Array<{ id: ProfileSection; label: string }> = [
  { id: "history", label: "Riwayat Peminjaman" },
  { id: "books", label: "Buku Saya" },
  { id: "transactions", label: "Transaksi" },
];

type ProfilePageProps = {
  onBorrowBook: () => void;
};

function ProfilePage({ onBorrowBook }: ProfilePageProps) {
  const [activeSection, setActiveSection] = useState<ProfileSection>("history");
  const [user, setUser] = useState<User | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [borrowings, setBorrowings] = useState<Transaction[]>([]);
  const [lendings, setLendings] = useState<Transaction[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, myBooks, myBorrowings, myLendings] = await Promise.all([
        apiFetch<{ data: User }>("/api/profile"),
        apiFetch<{ data: Book[] }>("/api/my-books"),
        apiFetch<{ data: Transaction[] }>("/api/transactions/borrowings"),
        apiFetch<{ data: Transaction[] }>("/api/transactions/lendings"),
      ]);
      setUser(profile.data);
      setBooks(myBooks.data);
      setBorrowings(myBorrowings.data);
      setLendings(myLendings.data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Profil belum bisa dimuat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const completedIncome = useMemo(
    () =>
      lendings
        .filter((transaction) => transaction.status === "COMPLETED")
        .reduce((total, transaction) => total + transaction.total_price, 0),
    [lendings],
  );
  const activeTab = profileTabs.find((tab) => tab.id === activeSection) ?? profileTabs[0];

  async function actOnTransaction(
    transactionID: number,
    action: "respond" | "return" | "complete",
    status?: "ACCEPTED" | "REJECTED",
  ) {
    try {
      await apiFetch(`/api/transactions/${transactionID}/${action}`, {
        method: "PUT",
        body: status ? JSON.stringify({ status }) : undefined,
      });
      await loadProfile();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Transaksi belum bisa diproses.");
    }
  }

  return (
    <main className="profile-page">
      <section className="profile-shell">
        <header className="profile-header">
          <div className="profile-identity">
            <div className="profile-avatar">{initials(user?.name)}</div>
            <div>
              <span>Profil Pemilik Buku</span>
              <h1>{user?.name || "Profil UniLibra"}</h1>
              <p>
                Kelola buku milikmu, riwayat peminjaman, transaksi, dan
                notifikasi pemilik dari satu halaman profil.
              </p>
            </div>
          </div>

          <div className="profile-stats">
            <ProfileStat label="Buku saya" value={`${books.length}`} helper="Listing tercatat" />
            <ProfileStat
              label="Transaksi masuk"
              value={`${lendings.length}`}
              helper={`${lendings.filter((item) => item.status !== "COMPLETED").length} aktif`}
            />
            <ProfileStat
              label="Pendapatan selesai"
              value={formatCurrency(completedIncome)}
              helper="Dari transaksi selesai"
            />
          </div>
        </header>

        <section className="profile-panel profile-section-panel">
          <nav className="profile-section-nav" aria-label="Navigasi halaman profil">
            <div className="profile-section-tabs" role="tablist" aria-label="Bagian profil">
              {profileTabs.map((tab) => (
                <button
                  aria-controls={`profile-panel-${tab.id}`}
                  aria-selected={activeSection === tab.id}
                  className={activeSection === tab.id ? "is-active" : undefined}
                  id={`profile-tab-${tab.id}`}
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  role="tab"
                  type="button"
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </nav>

          <section
            aria-labelledby={`profile-tab-${activeTab.id}`}
            className="profile-tab-panel"
            id={`profile-panel-${activeTab.id}`}
            role="tabpanel"
          >
            {message ? <div className="borrow-submit-note">{message}</div> : null}
            {loading ? <div className="borrow-submit-note">Memuat profil...</div> : null}
            {!loading && activeSection === "history" ? (
              <BorrowingPanel
                borrowings={borrowings}
                onBorrowBook={onBorrowBook}
                onReturn={(id) => actOnTransaction(id, "return")}
              />
            ) : null}
            {!loading && activeSection === "books" ? (
              <BooksPanel
                books={books}
                onChanged={loadProfile}
                onNotice={setMessage}
              />
            ) : null}
            {!loading && activeSection === "transactions" ? (
              <TransactionsPanel
                completedIncome={completedIncome}
                lendings={lendings}
                onComplete={(id) => actOnTransaction(id, "complete")}
                onRespond={(id, status) => actOnTransaction(id, "respond", status)}
              />
            ) : null}
          </section>
        </section>
      </section>
    </main>
  );
}

function ProfileStat({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="profile-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function BorrowingPanel({
  borrowings,
  onBorrowBook,
  onReturn,
}: {
  borrowings: Transaction[];
  onBorrowBook: () => void;
  onReturn: (id: number) => void;
}) {
  return (
    <>
      <div className="profile-panel-head">
        <div>
          <span>Aktivitas</span>
          <h2>Riwayat Peminjaman</h2>
        </div>
        <strong>{borrowings.length} riwayat</strong>
      </div>
      {borrowings.length === 0 ? (
        <button className="btn-primary" type="button" onClick={onBorrowBook}>
          Cari Buku untuk Dipinjam
        </button>
      ) : (
        <div className="profile-table">
          <TableHead labels={["Buku", "Pemilik", "Mulai", "Status", "Aksi"]} />
          {borrowings.map((transaction) => (
            <div className="profile-table-row" key={transaction.id}>
              <span>{transaction.book?.title || `Buku #${transaction.book_id}`}</span>
              <span>
                {transaction.book?.owner?.name || "-"}
                <TransactionPlan transaction={transaction} />
              </span>
              <span>{formatDate(transaction.borrow_date)}</span>
              <span>{transaction.status}</span>
              {transaction.status === "ACCEPTED" ? (
                <button type="button" onClick={() => onReturn(transaction.id)}>
                  Ajukan Kembali
                </button>
              ) : (
                <strong>{formatDate(transaction.expected_return_date)}</strong>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

type BookEditForm = {
  id: number;
  title: string;
  author: string;
  category: string;
  theme: string;
  condition: string;
  rentalPrice: string;
  location: string;
  latitude: string;
  longitude: string;
  maxDuration: string;
  handover: string;
  description: string;
  cover: File | null;
};

function BooksPanel({
  books,
  onChanged,
  onNotice,
}: {
  books: Book[];
  onChanged: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const [editForm, setEditForm] = useState<BookEditForm | null>(null);
  const [busyBookID, setBusyBookID] = useState<number | null>(null);

  function beginEdit(book: Book) {
    setEditForm({
      id: book.id,
      title: book.title,
      author: book.author,
      category: book.category || "",
      theme: book.theme || "",
      condition: book.condition || "",
      rentalPrice: `${book.rental_price}`,
      location: book.location || "",
      latitude: `${book.latitude || 0}`,
      longitude: `${book.longitude || 0}`,
      maxDuration: book.max_duration || "",
      handover: book.handover || "",
      description: book.description || "",
      cover: null,
    });
    onNotice("");
  }

  function handleEditChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name } = event.target;
    const value =
      event.target instanceof HTMLInputElement && event.target.type === "file"
        ? event.target.files?.[0] ?? null
        : event.target.value;

    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [name]: value,
            ...(name === "category" ? { theme: "" } : {}),
          }
        : currentForm,
    );
  }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editForm) {
      return;
    }

    setBusyBookID(editForm.id);
    const payload = new FormData();
    payload.set("title", editForm.title);
    payload.set("author", editForm.author);
    payload.set("category", editForm.category);
    payload.set("theme", editForm.theme);
    payload.set("condition", editForm.condition);
    payload.set("rental_price", editForm.rentalPrice || "0");
    payload.set("location", editForm.location);
    payload.set("latitude", editForm.latitude);
    payload.set("longitude", editForm.longitude);
    payload.set("max_duration", editForm.maxDuration);
    payload.set("handover", editForm.handover);
    payload.set("description", editForm.description);
    if (editForm.cover) {
      payload.set("cover", editForm.cover);
    }

    try {
      await apiFetch(`/api/books/${editForm.id}`, {
        method: "PUT",
        body: payload,
      });
      setEditForm(null);
      onNotice("Listing buku berhasil diperbarui.");
      await onChanged();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Listing buku belum bisa diperbarui.");
    } finally {
      setBusyBookID(null);
    }
  }

  async function removeBook(book: Book) {
    if (!window.confirm(`Tarik "${book.title}" dari katalog?`)) {
      return;
    }

    setBusyBookID(book.id);
    try {
      await apiFetch(`/api/books/${book.id}`, { method: "DELETE" });
      setEditForm((currentForm) => (currentForm?.id === book.id ? null : currentForm));
      onNotice("Listing buku ditarik dari katalog.");
      await onChanged();
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Listing buku belum bisa ditarik.");
    } finally {
      setBusyBookID(null);
    }
  }

  return (
    <>
      <div className="profile-panel-head">
        <div>
          <span>Koleksi</span>
          <h2>Buku Saya</h2>
        </div>
        <strong>{books.length} buku</strong>
      </div>
      <div className="profile-book-list">
        {books.map((book) => (
          <article className="profile-book-card" key={book.id}>
            <div className="profile-book-cover">
              {book.cover_url ? <img src={mediaURL(book.cover_url)} alt={book.title} /> : book.title}
            </div>
            <div className="profile-book-detail">
              <div className="profile-book-topline">
                <div>
                  <span className="profile-book-status">{book.status}</span>
                  <h3>{book.title}</h3>
                  <p>{book.author}</p>
                </div>
                <div className="profile-book-actions">
                  <button type="button" onClick={() => beginEdit(book)}>
                    Edit
                  </button>
                  <button
                    className="is-danger"
                    disabled={busyBookID === book.id}
                    onClick={() => removeBook(book)}
                    type="button"
                  >
                    Tarik
                  </button>
                </div>
              </div>
              <div className="profile-book-meta">
                <small>{formatCurrency(book.rental_price)} / minggu</small>
                <small>{book.category || "Kategori belum diisi"}</small>
                <small>{book.theme || "Tema belum diisi"}</small>
                <small>{book.location || "Lokasi belum diisi"}</small>
              </div>
              {editForm?.id === book.id ? (
                <form className="profile-book-form" onSubmit={saveBook}>
                  <div className="profile-book-form-grid">
                    <label>
                      Judul
                      <input
                        name="title"
                        onChange={handleEditChange}
                        required
                        value={editForm.title}
                      />
                    </label>
                    <label>
                      Penulis
                      <input
                        name="author"
                        onChange={handleEditChange}
                        required
                        value={editForm.author}
                      />
                    </label>
                    <label>
                      Kategori
                      <select
                        name="category"
                        onChange={handleEditChange}
                        value={editForm.category}
                      >
                        <option value="">Pilih kategori</option>
                        {bookCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tema
                      <select
                        disabled={!editForm.category}
                        name="theme"
                        onChange={handleEditChange}
                        value={editForm.theme}
                      >
                        <option value="">
                          {editForm.category ? "Pilih tema" : "Pilih kategori dulu"}
                        </option>
                        {themesForCategory(editForm.category).map((theme) => (
                          <option key={theme} value={theme}>
                            {theme}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Kondisi
                      <input
                        name="condition"
                        onChange={handleEditChange}
                        value={editForm.condition}
                      />
                    </label>
                    <label>
                      Harga / minggu
                      <input
                        min="0"
                        name="rentalPrice"
                        onChange={handleEditChange}
                        required
                        type="number"
                        value={editForm.rentalPrice}
                      />
                    </label>
                    <label>
                      Lokasi
                      <input
                        name="location"
                        onChange={handleEditChange}
                        value={editForm.location}
                      />
                    </label>
                    <label>
                      Durasi maksimum
                      <input
                        name="maxDuration"
                        onChange={handleEditChange}
                        value={editForm.maxDuration}
                      />
                    </label>
                    <label>
                      Serah terima
                      <input
                        name="handover"
                        onChange={handleEditChange}
                        value={editForm.handover}
                      />
                    </label>
                    <label className="profile-book-form-wide">
                      Ganti cover
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        name="cover"
                        onChange={handleEditChange}
                        type="file"
                      />
                    </label>
                    <label className="profile-book-form-wide">
                      Deskripsi
                      <textarea
                        name="description"
                        onChange={handleEditChange}
                        rows={3}
                        value={editForm.description}
                      />
                    </label>
                  </div>
                  <div className="profile-book-form-actions">
                    <button disabled={busyBookID === book.id} type="submit">
                      {busyBookID === book.id ? "Menyimpan..." : "Simpan"}
                    </button>
                    <button type="button" onClick={() => setEditForm(null)}>
                      Batal
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

function TransactionsPanel({
  completedIncome,
  lendings,
  onRespond,
  onComplete,
}: {
  completedIncome: number;
  lendings: Transaction[];
  onRespond: (id: number, status: "ACCEPTED" | "REJECTED") => void;
  onComplete: (id: number) => void;
}) {
  return (
    <>
      <div className="profile-panel-head">
        <div>
          <span>Transaksi</span>
          <h2>Permintaan pada Buku Saya</h2>
        </div>
        <strong>{lendings.length} transaksi</strong>
      </div>
      <div className="profile-transaction-summary">
        <span>
          Pendapatan selesai
          <strong>{formatCurrency(completedIncome)}</strong>
        </span>
        <span>
          Menunggu approval
          <strong>{lendings.filter((item) => item.status === "PENDING_APPROVAL").length}</strong>
        </span>
        <span>
          Menunggu konfirmasi kembali
          <strong>{lendings.filter((item) => item.status === "RETURN_PENDING").length}</strong>
        </span>
      </div>
      <div className="profile-table">
        <TableHead labels={["Buku", "Peminjam", "Tanggal", "Status", "Nominal"]} />
        {lendings.map((transaction) => (
          <div className="profile-table-row" key={transaction.id}>
            <span>{transaction.book?.title || `Buku #${transaction.book_id}`}</span>
            <span>
              {transaction.borrower?.name || "-"}
              <TransactionPlan transaction={transaction} />
            </span>
            <span>{formatDate(transaction.created_at)}</span>
            <span>{transaction.status}</span>
            {transaction.status === "PENDING_APPROVAL" ? (
              <span>
                <button type="button" onClick={() => onRespond(transaction.id, "ACCEPTED")}>
                  Terima
                </button>
                <button type="button" onClick={() => onRespond(transaction.id, "REJECTED")}>
                  Tolak
                </button>
              </span>
            ) : transaction.status === "RETURN_PENDING" ? (
              <button type="button" onClick={() => onComplete(transaction.id)}>
                Selesaikan
              </button>
            ) : (
              <strong>{formatCurrency(transaction.total_price)}</strong>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function TransactionPlan({ transaction }: { transaction: Transaction }) {
  const plan = [transaction.handover, transaction.location, transaction.note].filter(Boolean);
  if (plan.length === 0) {
    return null;
  }

  return <small className="profile-transaction-plan">{plan.join(" - ")}</small>;
}

function TableHead({ labels }: { labels: string[] }) {
  return (
    <div className="profile-table-head">
      {labels.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  );
}

export default ProfilePage;
