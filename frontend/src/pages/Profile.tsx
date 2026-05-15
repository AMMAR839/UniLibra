const profileStats = [
  { label: "Buku dipinjamkan", value: "12", helper: "8 aktif di katalog" },
  { label: "Transaksi selesai", value: "34", helper: "4 berjalan bulan ini" },
  { label: "Keuntungan bersih", value: "Rp 286.000", helper: "Akumulasi tahun ini" },
];

const lentBooks = [
  {
    title: "Atomic Habits",
    author: "James Clear",
    status: "Sedang dipinjam",
    price: "Rp 7.000 / minggu",
    borrower: "Ammar Ali",
    dueDate: "16 Apr 2026",
    coverClass: "profile-cover-yellow",
    approval: "Disetujui sistem",
  },
  {
    title: "Filosofi Teras",
    author: "Henry Manampiring",
    status: "Tersedia",
    price: "Rp 6.000 / minggu",
    borrower: "-",
    dueDate: "-",
    coverClass: "profile-cover-green",
    approval: "Disetujui sistem",
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    status: "Menunggu konfirmasi",
    price: "Rp 9.000 / minggu",
    borrower: "Raka D.",
    dueDate: "Request baru",
    coverClass: "profile-cover-blue",
    approval: "Menunggu approval",
  },
];

const transactions = [
  {
    book: "Atomic Habits",
    borrower: "Ammar Ali",
    date: "2 Apr 2026",
    status: "Aktif",
    amount: "Rp 16.000",
  },
  {
    book: "Bumi Manusia",
    borrower: "Sinta M.",
    date: "14 Jan 2026",
    status: "Selesai",
    amount: "Rp 6.000",
  },
  {
    book: "Filosofi Teras",
    borrower: "Nanda P.",
    date: "4 Apr 2026",
    status: "Menunggu",
    amount: "Rp 12.000",
  },
  {
    book: "Sapiens",
    borrower: "Raka D.",
    date: "12 Mar 2026",
    status: "Selesai",
    amount: "Rp 14.000",
  },
];

const profitRows = [
  { label: "Pendapatan kotor", value: "Rp 344.000" },
  { label: "Biaya layanan", value: "Rp 58.000" },
  { label: "Keuntungan bersih", value: "Rp 286.000" },
];

function ProfilePage() {
  return (
    <main className="profile-page">
      <section className="profile-shell">
        <header className="profile-header">
          <div className="profile-identity">
            <div className="profile-avatar">NS</div>
            <div>
              <span>Profil Pemilik Buku</span>
              <h1>Nicholas S.</h1>
              <p>
                Pemilik koleksi aktif di Sleman. Mengelola buku yang
                dipinjamkan, riwayat transaksi, dan keuntungan dari satu tempat.
              </p>
            </div>
          </div>

          <div className="profile-stats">
            {profileStats.map((stat) => (
              <article className="profile-stat-card" key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.helper}</small>
              </article>
            ))}
          </div>
        </header>

        <section className="profile-grid">
          <section className="profile-panel profile-books-panel">
            <div className="profile-panel-head">
              <div>
                <span>Koleksi</span>
                <h2>Buku yang Dipinjamkan</h2>
              </div>
              <strong>{lentBooks.length} buku</strong>
            </div>

            <div className="profile-book-list">
              {lentBooks.map((book) => (
                <article className="profile-book-card" key={book.title}>
                  <div className={`profile-book-cover ${book.coverClass}`}>
                    {book.title}
                  </div>
                  <div className="profile-book-detail">
                    <div className="profile-book-topline">
                      <div>
                        <span className="profile-book-status">{book.status}</span>
                        <h3>{book.title}</h3>
                        <p>{book.author}</p>
                      </div>
                      <button type="button">Edit</button>
                    </div>
                    <span className="profile-approval-badge">
                      {book.approval}
                    </span>
                    <div className="profile-book-meta">
                      <small>{book.price}</small>
                      <small>Peminjam: {book.borrower}</small>
                      <small>Jatuh tempo: {book.dueDate}</small>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="profile-panel profile-transaction-panel">
          <div className="profile-panel-head">
            <div>
              <span>Transaksi</span>
              <h2>Riwayat Transaksi</h2>
            </div>
            <strong>{transactions.length} transaksi</strong>
          </div>

          <div className="profile-transaction-summary">
            {profitRows.map((row) => (
              <span key={row.label}>
                {row.label}
                <strong>{row.value}</strong>
              </span>
            ))}
          </div>

          <div className="profile-table">
            <div className="profile-table-head">
              <span>Buku</span>
              <span>Peminjam</span>
              <span>Tanggal</span>
              <span>Status</span>
              <span>Nominal</span>
            </div>

            {transactions.map((transaction) => (
              <div className="profile-table-row" key={`${transaction.book}-${transaction.date}`}>
                <span>{transaction.book}</span>
                <span>{transaction.borrower}</span>
                <span>{transaction.date}</span>
                <span>{transaction.status}</span>
                <strong>{transaction.amount}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

export default ProfilePage;
