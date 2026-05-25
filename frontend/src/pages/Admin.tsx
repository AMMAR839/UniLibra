import { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  formatCurrency,
  formatDate,
  initials,
  type AdminSummary,
  type Book,
  type Transaction,
  type User,
} from "../lib/api";

type AdminSection = "dashboard" | "users" | "books" | "transactions" | "reports";

const adminSections: Array<{ id: AdminSection; label: string; number: string }> = [
  { id: "dashboard", label: "Dashboard", number: "01" },
  { id: "users", label: "Pengguna", number: "02" },
  { id: "books", label: "Buku", number: "03" },
  { id: "transactions", label: "Transaksi", number: "04" },
  { id: "reports", label: "Laporan", number: "05" },
];

type AdminReports = {
  summary: AdminSummary;
  generated_at: string;
  pending_transactions: number;
  return_pending: number;
  completed_transactions: number;
  unread_notifications: number;
};

function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reports, setReports] = useState<AdminReports | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void refreshAdmin();
  }, []);

  const activeCopy = useMemo(() => {
    switch (activeSection) {
      case "users":
        return ["Manajemen Pengguna", "Role dan status akun dari backend."];
      case "books":
        return ["Manajemen Buku", "Moderasi listing buku dan ketersediaan katalog."];
      case "transactions":
        return ["Manajemen Transaksi", "Monitoring request, aktif, dan selesai."];
      case "reports":
        return ["Laporan Platform", "Ringkasan operasional yang dihitung dari data sistem."];
      default:
        return ["Dashboard Admin", "Ringkasan layanan UniLibra hari ini."];
    }
  }, [activeSection]);

  async function refreshAdmin() {
    try {
      const [summaryResult, usersResult, booksResult, transactionsResult, reportsResult] =
        await Promise.all([
          apiFetch<{ data: AdminSummary }>("/api/admin/summary"),
          apiFetch<{ data: User[] }>("/api/admin/users"),
          apiFetch<{ data: Book[] }>("/api/admin/books"),
          apiFetch<{ data: Transaction[] }>("/api/admin/transactions"),
          apiFetch<{ data: AdminReports }>("/api/admin/reports"),
        ]);
      setSummary(summaryResult.data);
      setUsers(usersResult.data);
      setBooks(booksResult.data);
      setTransactions(transactionsResult.data);
      setReports(reportsResult.data);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Data admin belum bisa dimuat.");
    }
  }

  async function toggleUser(user: User, patch: Partial<Pick<User, "role" | "status">>) {
    try {
      await apiFetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refreshAdmin();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "User belum bisa diperbarui.");
    }
  }

  async function setBookStatus(book: Book, status: string) {
    try {
      await apiFetch(`/api/admin/books/${book.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await refreshAdmin();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Buku belum bisa diperbarui.");
    }
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <div className="logo-mark"></div>
          <strong>UniLibra</strong>
        </a>
        <span className="admin-nav-label">Navigasi</span>
        <nav className="admin-nav" aria-label="Navigasi admin">
          {adminSections.map((section) => (
            <button
              className={section.id === activeSection ? "is-active" : undefined}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              <span className="admin-nav-text">{section.label}</span>
              <span className="admin-nav-number">{section.number}</span>
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-note">
          <h2>Admin v1</h2>
          <p>Data di halaman ini sekarang berasal dari endpoint admin backend.</p>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <h1>{activeCopy[0]}</h1>
            <p>{activeCopy[1]}</p>
          </div>
          <div className="admin-profile">
            <span>A</span>
            <strong>Admin</strong>
          </div>
        </header>

        {notice ? <section className="admin-panel">{notice}</section> : null}
        {summary ? <SummaryCards summary={summary} /> : null}

        {activeSection === "dashboard" ? (
          <DashboardPanel books={books} transactions={transactions} users={users} />
        ) : activeSection === "users" ? (
          <UsersPanel users={users} onPatch={toggleUser} />
        ) : activeSection === "books" ? (
          <BooksPanel books={books} onStatus={setBookStatus} />
        ) : activeSection === "transactions" ? (
          <TransactionsPanel transactions={transactions} />
        ) : (
          <ReportsPanel reports={reports} />
        )}
      </section>
    </main>
  );
}

function SummaryCards({ summary }: { summary: AdminSummary }) {
  const rows = [
    ["Total user", summary.users],
    ["Total buku", summary.books],
    ["Buku tersedia", summary.available_books],
    ["Transaksi aktif", summary.active_transactions],
  ];
  return (
    <section className="admin-stats">
      {rows.map(([label, value]) => (
        <article className="admin-stat-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <p>Data backend terbaru</p>
        </article>
      ))}
    </section>
  );
}

function DashboardPanel({
  books,
  transactions,
  users,
}: {
  books: Book[];
  transactions: Transaction[];
  users: User[];
}) {
  return (
    <section className="admin-dashboard-grid">
      <article className="admin-hero-card">
        <span>Operasional</span>
        <h2>{transactions.filter((item) => item.status === "PENDING_APPROVAL").length} request menunggu</h2>
        <p>Gunakan tab transaksi untuk memantau status peminjaman terbaru.</p>
        <div className="admin-hero-pills">
          <span>{users.filter((item) => item.role === "admin").length} admin</span>
          <span>{books.filter((item) => item.status === "hidden").length} buku disembunyikan</span>
        </div>
      </article>
      <article className="admin-panel">
        <PanelHeader title="Transaksi terbaru" text="Aktivitas pinjam paling baru." />
        <TransactionTable transactions={transactions.slice(0, 6)} />
      </article>
    </section>
  );
}

function UsersPanel({
  users,
  onPatch,
}: {
  users: User[];
  onPatch: (user: User, patch: Partial<Pick<User, "role" | "status">>) => void;
}) {
  return (
    <section className="admin-panel">
      <PanelHeader title="Daftar Pengguna" text="Kelola status dan role akun." />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Nama</th><th>Email</th><th>Role</th><th>Status</th><th>Aksi</th></tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.status}</td>
                <td>
                  <button type="button" onClick={() => onPatch(user, { role: user.role === "admin" ? "user" : "admin" })}>
                    {user.role === "admin" ? "Jadikan User" : "Jadikan Admin"}
                  </button>
                  <button type="button" onClick={() => onPatch(user, { status: user.status === "active" ? "suspended" : "active" })}>
                    {user.status === "active" ? "Suspend" : "Aktifkan"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BooksPanel({
  books,
  onStatus,
}: {
  books: Book[];
  onStatus: (book: Book, status: string) => void;
}) {
  return (
    <section className="admin-panel">
      <PanelHeader title="Listing Buku" text="Status listing dapat disembunyikan atau dikembalikan." />
      <div className="admin-book-grid">
        {books.map((book) => (
          <article className="admin-book-card" key={book.id}>
            <div className="admin-book-cover">{book.title}</div>
            <h3>{book.title}</h3>
            <p>{book.author} - {book.owner?.name || "Pemilik"}</p>
            <div className="admin-badge-row">
              <span className="admin-badge admin-badge-neutral">{book.status}</span>
              <span className="admin-badge admin-badge-amber">{formatCurrency(book.rental_price)}</span>
            </div>
            <button type="button" onClick={() => onStatus(book, book.status === "hidden" ? "available" : "hidden")}>
              {book.status === "hidden" ? "Tampilkan" : "Sembunyikan"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function TransactionsPanel({ transactions }: { transactions: Transaction[] }) {
  return (
    <section className="admin-panel">
      <PanelHeader title="Transaksi" text="Monitoring transaksi platform." />
      <TransactionTable transactions={transactions} />
    </section>
  );
}

function ReportsPanel({ reports }: { reports: AdminReports | null }) {
  if (!reports) {
    return <section className="admin-panel">Laporan belum tersedia.</section>;
  }
  const rows = [
    ["Menunggu approval", reports.pending_transactions],
    ["Menunggu kembali", reports.return_pending],
    ["Selesai", reports.completed_transactions],
    ["Notifikasi belum dibaca", reports.unread_notifications],
  ];
  return (
    <section className="admin-report-grid">
      {rows.map(([label, value]) => (
        <article className="admin-report-card" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
          <p>Dihitung {formatDate(reports.generated_at)}</p>
        </article>
      ))}
    </section>
  );
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr><th>Buku</th><th>Peminjam</th><th>Status</th><th>Tanggal</th><th>Total</th></tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.id}>
              <td>{transaction.book?.title || `Buku #${transaction.book_id}`}</td>
              <td>{transaction.borrower?.name || initials(transaction.borrower?.email)}</td>
              <td>{transaction.status}</td>
              <td>{formatDate(transaction.created_at)}</td>
              <td>{formatCurrency(transaction.total_price)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelHeader({ title, text }: { title: string; text: string }) {
  return (
    <div className="admin-panel-head">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export default AdminPage;
