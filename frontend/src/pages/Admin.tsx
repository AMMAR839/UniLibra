import { useEffect, useMemo, useState } from "react";
import {
  apiFetch,
  clearToken,
  formatCurrency,
  formatDate,
  type AdminSummary,
  type Transaction,
} from "../lib/api";

type AdminSection = "dashboard" | "transactions";

const adminSections: Array<{ id: AdminSection; label: string; number: string }> = [
  { id: "dashboard", label: "Dashboard", number: "01" },
  { id: "transactions", label: "Transaksi", number: "02" },
];

function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void refreshAdmin();
  }, []);

  const activeCopy = useMemo(() => {
    switch (activeSection) {
      case "transactions":
        return ["Manajemen Transaksi", "Monitoring request, aktif, dan selesai."];
      default:
        return ["Dashboard Admin", "Ringkasan layanan UniLibra hari ini."];
    }
  }, [activeSection]);

  async function refreshAdmin() {
    try {
      const [summaryResult, transactionsResult] =
        await Promise.all([
          apiFetch<{ data: AdminSummary }>("/api/admin/summary"),
          apiFetch<{ data: Transaction[] }>("/api/admin/transactions"),
        ]);
      setSummary(summaryResult.data);
      setTransactions(transactionsResult.data);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Data admin belum bisa dimuat.");
    }
  }

  function logoutAdmin() {
    clearToken();
    window.location.href = "/login";
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/">
          <img className="logo-mark" src="/Lambang.png" alt="UniLibra" />
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
        <button className="admin-logout-button" onClick={logoutAdmin} type="button">
          Keluar
        </button>
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
          <DashboardPanel transactions={transactions} />
        ) : (
          <TransactionsPanel transactions={transactions} />
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
  transactions,
}: {
  transactions: Transaction[];
}) {
  return (
    <section className="admin-dashboard-grid">
      <article className="admin-hero-card">
        <span>Operasional</span>
        <h2>{transactions.filter((item) => item.status === "PENDING_APPROVAL").length} request menunggu</h2>
        <p>Gunakan tab transaksi untuk memantau status peminjaman terbaru.</p>
        <div className="admin-hero-pills">
          <span>{transactions.filter((item) => item.status === "ACCEPTED").length} aktif</span>
          <span>{transactions.filter((item) => item.status === "COMPLETED").length} selesai</span>
        </div>
      </article>
      <article className="admin-panel">
        <PanelHeader title="Transaksi terbaru" text="Aktivitas pinjam paling baru." />
        <TransactionTable transactions={transactions.slice(0, 6)} />
      </article>
    </section>
  );
}

function TransactionsPanel({ transactions }: { transactions: Transaction[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredTransactions = normalizedQuery
    ? transactions.filter((transaction) => {
        const haystack = [
          String(transaction.id),
          transaction.book?.owner?.name,
          transaction.book?.owner?.email,
          transaction.borrower?.name,
          transaction.borrower?.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
    : transactions;

  return (
    <section className="admin-panel">
      <PanelHeader title="Transaksi" text="Monitoring transaksi platform." />
      <div className="admin-filterbar">
        <input
          aria-label="Cari transaksi"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari ID transaksi, nama pemilik, atau pengguna"
          type="search"
          value={query}
        />
      </div>
      <TransactionTable transactions={filteredTransactions} />
    </section>
  );
}

function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  return (
    <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
          <tr><th>ID</th><th>Buku</th><th>Pemilik</th><th>Pengguna</th><th>Status</th><th>Tanggal</th><th>Total</th></tr>
          </thead>
          <tbody>
            {transactions.map((transaction) => (
              <tr key={transaction.id}>
              <td>#{transaction.id}</td>
              <td>{transaction.book?.title || `Buku #${transaction.book_id}`}</td>
              <td>{adminUserLabel(transaction.book?.owner, "Pemilik belum terbaca")}</td>
              <td>{adminUserLabel(transaction.borrower, "Pengguna belum terbaca")}</td>
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

function adminUserLabel(user: Transaction["borrower"], fallback: string) {
  return user?.name || user?.email || fallback;
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
