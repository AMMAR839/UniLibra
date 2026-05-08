import { useMemo, useState } from "react";

type AdminSection = "dashboard" | "users" | "books" | "transactions" | "reports";
type BadgeTone = "green" | "amber" | "red" | "blue" | "neutral";

type Stat = {
  label: string;
  value: string;
  helper: string;
};

type TableColumn = {
  key: string;
  label: string;
};

type TableRow = Record<string, string | { text: string; tone: BadgeTone }>;

const adminSections: Array<{
  id: AdminSection;
  label: string;
  number: string;
}> = [
  { id: "dashboard", label: "Dashboard", number: "01" },
  { id: "users", label: "Pengguna", number: "02" },
  { id: "books", label: "Buku", number: "03" },
  { id: "transactions", label: "Transaksi", number: "04" },
  { id: "reports", label: "Laporan", number: "05" },
];

const sectionCopy: Record<
  AdminSection,
  {
    title: string;
    subtitle: string;
    search: string;
    action: string;
  }
> = {
  dashboard: {
    title: "Dashboard Admin",
    subtitle:
      "Ringkasan performa platform, transaksi aktif, dan isu yang perlu perhatian hari ini.",
    search: "Cari data admin...",
    action: "Export Ringkasan",
  },
  users: {
    title: "Manajemen Pengguna",
    subtitle: "Kelola akun user, role, status akun, verifikasi, dan aktivitas penting.",
    search: "Cari pengguna...",
    action: "Tambah Admin",
  },
  books: {
    title: "Manajemen Buku",
    subtitle: "Kelola listing buku, moderasi konten, status ketersediaan, dan kualitas data katalog.",
    search: "Cari buku...",
    action: "Tambah Kategori",
  },
  transactions: {
    title: "Manajemen Transaksi",
    subtitle: "Kelola request peminjaman, status transaksi, keterlambatan, dan penyelesaian kasus.",
    search: "Cari transaksi...",
    action: "Export CSV",
  },
  reports: {
    title: "Laporan Platform",
    subtitle: "Pantau laporan pengguna, tren operasional, dan catatan performa mingguan.",
    search: "Cari laporan...",
    action: "Unduh Laporan",
  },
};

const dashboardStats: Stat[] = [
  { label: "Total user", value: "1.240", helper: "+8.2% dibanding bulan lalu" },
  { label: "Buku aktif", value: "12.400", helper: "1.120 listing baru bulan ini" },
  { label: "Transaksi aktif", value: "328", helper: "+14% dalam 30 hari" },
  { label: "Laporan masuk", value: "9", helper: "+3 sejak kemarin" },
];

const userStats: Stat[] = [
  { label: "Total user", value: "1.240", helper: "Semua akun terdaftar" },
  { label: "User aktif", value: "1.108", helper: "Login dalam 30 hari terakhir" },
  { label: "Perlu verifikasi", value: "6", helper: "Pemilik buku baru" },
  { label: "Akun disuspend", value: "12", helper: "Terkait pelanggaran atau komplain" },
];

const bookStats: Stat[] = [
  { label: "Total buku", value: "12.400", helper: "Semua listing terdaftar" },
  { label: "Tersedia", value: "8.240", helper: "Siap dipinjam saat ini" },
  { label: "Perlu moderasi", value: "15", helper: "Menunggu review admin" },
  { label: "Dinonaktifkan", value: "42", helper: "Masalah data atau laporan" },
];

const transactionStats: Stat[] = [
  { label: "Total transaksi", value: "328", helper: "Berjalan bulan ini" },
  { label: "Menunggu", value: "41", helper: "Butuh konfirmasi owner" },
  { label: "Aktif", value: "233", helper: "Buku sedang dipinjam" },
  { label: "Terlambat", value: "24", helper: "Perlu reminder atau tindakan" },
];

const reportStats: Stat[] = [
  { label: "Laporan baru", value: "9", helper: "Masuk hari ini" },
  { label: "Kasus selesai", value: "31", helper: "Dalam 7 hari terakhir" },
  { label: "Butuh bukti", value: "7", helper: "Menunggu upload pendukung" },
  { label: "Prioritas tinggi", value: "3", helper: "Perlu keputusan admin" },
];

const userColumns: TableColumn[] = [
  { key: "name", label: "Nama" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "city", label: "Kota" },
  { key: "action", label: "Aksi" },
];

const userRows: TableRow[] = [
  {
    name: "Ammar Ali",
    email: "ammar@mail.com",
    role: { text: "Pembaca", tone: "neutral" },
    status: { text: "Aktif", tone: "green" },
    city: "Yogyakarta",
    action: "Lihat",
  },
  {
    name: "Nicholas S.",
    email: "nicholas@mail.com",
    role: { text: "Pemilik Buku", tone: "neutral" },
    status: { text: "Aktif", tone: "green" },
    city: "Sleman",
    action: "Edit",
  },
  {
    name: "Nanda Putri",
    email: "nanda@mail.com",
    role: { text: "Pemilik Buku", tone: "neutral" },
    status: { text: "Review", tone: "amber" },
    city: "Bantul",
    action: "Verifikasi",
  },
  {
    name: "Agus R.",
    email: "agus@mail.com",
    role: { text: "Pembaca", tone: "neutral" },
    status: { text: "Suspend", tone: "red" },
    city: "Depok",
    action: "Aktifkan",
  },
  {
    name: "Sinta Maharani",
    email: "sinta@mail.com",
    role: { text: "Admin", tone: "neutral" },
    status: { text: "Aktif", tone: "green" },
    city: "Jakarta",
    action: "Kelola",
  },
];

const transactionColumns: TableColumn[] = [
  { key: "id", label: "ID" },
  { key: "book", label: "Buku" },
  { key: "borrower", label: "Peminjam" },
  { key: "owner", label: "Pemilik" },
  { key: "status", label: "Status" },
  { key: "total", label: "Total" },
];

const transactionRows: TableRow[] = [
  {
    id: "TRX-2041",
    book: "Atomic Habits",
    borrower: "Ammar Ali",
    owner: "Nicholas S.",
    status: { text: "Aktif", tone: "green" },
    total: "Rp 16.000",
  },
  {
    id: "TRX-2040",
    book: "Filosofi Teras",
    borrower: "Nina Putri",
    owner: "Sinta M.",
    status: { text: "Menunggu", tone: "amber" },
    total: "Rp 12.000",
  },
  {
    id: "TRX-2038",
    book: "Sapiens",
    borrower: "Raka D.",
    owner: "Agus R.",
    status: { text: "Terlambat", tone: "red" },
    total: "Rp 14.000",
  },
  {
    id: "TRX-2037",
    book: "Bumi Manusia",
    borrower: "Sinta M.",
    owner: "Rara K.",
    status: { text: "Selesai", tone: "blue" },
    total: "Rp 10.000",
  },
];

const books = [
  {
    title: "Laskar Pelangi",
    author: "Andrea Hirata",
    owner: "Nicholas S.",
    location: "Yogyakarta",
    coverClass: "admin-cover-rust",
    badges: [
      { text: "Tersedia", tone: "green" as BadgeTone },
      { text: "Populer", tone: "amber" as BadgeTone },
    ],
    action: "Edit",
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    owner: "Nanda P.",
    location: "Sleman",
    coverClass: "admin-cover-yellow",
    badges: [
      { text: "Tersedia", tone: "green" as BadgeTone },
      { text: "Top", tone: "amber" as BadgeTone },
    ],
    action: "Edit",
  },
  {
    title: "Matematika Teknik",
    author: "Smeed",
    owner: "Agus R.",
    location: "Depok",
    coverClass: "admin-cover-blue",
    badges: [
      { text: "Dilaporkan", tone: "red" as BadgeTone },
      { text: "Review", tone: "amber" as BadgeTone },
    ],
    action: "Review",
  },
  {
    title: "Filosofi Teras",
    author: "Henry Manampiring",
    owner: "Sinta M.",
    location: "Bantul",
    coverClass: "admin-cover-green",
    badges: [
      { text: "Tersedia", tone: "green" as BadgeTone },
      { text: "Baru", tone: "amber" as BadgeTone },
    ],
    action: "Edit",
  },
];

const userActions = [
  {
    initials: "NP",
    title: "Nanda Putri",
    text: "Role: Pemilik Buku - 3 listing baru - verifikasi identitas tertunda",
    action: "Review",
  },
  {
    initials: "AR",
    title: "Agus R.",
    text: "2 laporan pembatalan sepihak - status suspend sementara",
    action: "Lihat Kasus",
  },
  {
    initials: "RD",
    title: "Raka D.",
    text: "Aktivitas tinggi - kandidat trusted owner untuk badge khusus",
    action: "Tandai",
  },
  {
    initials: "SM",
    title: "Sinta M.",
    text: "Meminta upgrade role menjadi admin operasional",
    action: "Proses",
  },
];

const bookIssues = [
  {
    title: "Matematika Teknik",
    issue: "Cover tidak sesuai",
    status: { text: "Moderasi", tone: "amber" as BadgeTone },
  },
  {
    title: "Sapiens",
    issue: "Laporan kondisi buku",
    status: { text: "Dilaporkan", tone: "red" as BadgeTone },
  },
  {
    title: "Bumi Manusia",
    issue: "Harga ekstrem rendah",
    status: { text: "Cek", tone: "amber" as BadgeTone },
  },
  {
    title: "Ronggeng Dukuh Paruk",
    issue: "Listing duplikat",
    status: { text: "Nonaktif", tone: "red" as BadgeTone },
  },
];

const priorityCases = [
  {
    title: "TRX-2038 - Sapiens",
    text: "Peminjam belum mengembalikan buku 3 hari setelah jatuh tempo. Chat terakhir belum dibalas oleh kedua pihak.",
    status: { text: "Terlambat", tone: "red" as BadgeTone },
    action: "Kirim Reminder",
  },
  {
    title: "TRX-2040 - Filosofi Teras",
    text: "Request menunggu lebih dari 24 jam. Owner belum konfirmasi, tapi peminjam sudah follow up dua kali.",
    status: { text: "Menunggu", tone: "amber" as BadgeTone },
    action: "Hubungi Owner",
  },
  {
    title: "TRX-2029 - Ronggeng Dukuh Paruk",
    text: "Pemilik melaporkan kondisi buku berubah saat pengembalian. Perlu review dispute dan bukti foto.",
    status: { text: "Dispute", tone: "red" as BadgeTone },
    action: "Review Kasus",
  },
];

const dashboardTasks = [
  {
    mark: "!",
    title: "Review 9 laporan baru",
    text: "Mayoritas terkait keterlambatan pengembalian dan kondisi buku.",
    time: "Sekarang",
  },
  {
    mark: "B",
    title: "Approve 15 listing buku",
    text: "Listing menunggu moderasi sebelum tampil di katalog.",
    time: "Hari ini",
  },
  {
    mark: "U",
    title: "Verifikasi 6 user baru",
    text: "Pemeriksaan profil pemilik buku dengan aktivitas tinggi.",
    time: "1 jam",
  },
  {
    mark: "$",
    title: "Audit pembayaran mingguan",
    text: "Cek komisi layanan dan refund yang tertunda.",
    time: "17:00",
  },
];

const healthMetrics = [
  { label: "Transaksi berhasil", value: 92 },
  { label: "Response owner", value: 81 },
  { label: "Pengembalian tepat waktu", value: 87 },
];

const reportItems = [
  {
    title: "Keterlambatan pengembalian",
    value: "24",
    helper: "Naik 6 kasus dibanding minggu lalu",
  },
  {
    title: "Konten listing bermasalah",
    value: "15",
    helper: "Mayoritas cover dan deskripsi kurang sesuai",
  },
  {
    title: "Komplain kondisi buku",
    value: "8",
    helper: "Perlu validasi bukti dari pemilik dan peminjam",
  },
];

function AdminPage() {
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const copy = sectionCopy[activeSection];
  const stats = useMemo(() => getStats(activeSection), [activeSection]);

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin" onClick={(event) => event.preventDefault()}>
          <div className="logo-mark"></div>
          <div>
            <strong>UniLibra Admin</strong>
            <span>Panel pengelolaan sistem</span>
          </div>
        </a>

        <span className="admin-nav-label">Navigasi</span>
        <nav className="admin-nav" aria-label="Navigasi admin">
          {adminSections.map((section) => (
            <button
              className={activeSection === section.id ? "is-active" : undefined}
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
          <h2>{activeSection === "dashboard" ? "Butuh tindakan cepat?" : "Pengguna perlu review"}</h2>
          <p>
            {activeSection === "dashboard"
              ? "Ada 9 laporan baru dan 24 buku terlambat. Prioritaskan review komplain dan reminder pengembalian."
              : "Ada 6 akun pemilik buku baru yang perlu diverifikasi dan 2 akun perlu tindakan karena laporan berulang."}
          </p>
          <button type="button">
            {activeSection === "dashboard" ? "Buka Laporan Prioritas" : "Review Sekarang"}
          </button>
        </div>
      </aside>

      <section className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.subtitle}</p>
          </div>
          <div className="admin-top-actions">
            <input aria-label={copy.search} placeholder={copy.search} type="search" />
            <button type="button">{copy.action}</button>
            <div className="admin-profile">
              <span>AD</span>
              Admin Utama
            </div>
          </div>
        </header>

        <section className="admin-stats">
          {stats.map((stat) => (
            <article className="admin-stat-card" key={stat.label}>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <p>{stat.helper}</p>
            </article>
          ))}
        </section>

        {activeSection === "dashboard" ? <DashboardView /> : null}
        {activeSection === "users" ? <UsersView /> : null}
        {activeSection === "books" ? <BooksView /> : null}
        {activeSection === "transactions" ? <TransactionsView /> : null}
        {activeSection === "reports" ? <ReportsView /> : null}
      </section>
    </main>
  );
}

function DashboardView() {
  return (
    <>
      <section className="admin-dashboard-grid">
        <article className="admin-hero-card">
          <div>
            <h2>Pusat kontrol untuk mengelola pengguna, buku, dan transaksi UniLibra.</h2>
            <p>
              Pantau seluruh aktivitas platform dalam satu tampilan: permintaan baru,
              keterlambatan pengembalian, performa kategori, dan laporan yang perlu
              ditindaklanjuti.
            </p>
            <div className="admin-hero-pills">
              <span>1.240 pengguna aktif</span>
              <span>12.400 buku terdaftar</span>
              <span>328 transaksi berjalan</span>
            </div>
          </div>
          <div className="admin-hero-stack">
            <span>
              <strong>9</strong>
              Laporan baru hari ini
            </span>
            <span>
              <strong>24</strong>
              Keterlambatan pengembalian
            </span>
            <span>
              <strong>15</strong>
              Listing buku perlu review
            </span>
          </div>
        </article>

        <article className="admin-panel">
          <h2>Kesehatan Sistem</h2>
          <p>Indikator cepat untuk melihat area operasional yang paling memerlukan intervensi admin.</p>
          <div className="admin-health-list">
            {healthMetrics.map((metric) => (
              <div className="admin-health-row" key={metric.label}>
                <span>
                  {metric.label}
                  <strong>{metric.value}%</strong>
                </span>
                <div>
                  <i style={{ width: `${metric.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="admin-main-grid">
        <article className="admin-panel">
          <PanelHeader title="Transaksi terbaru" text="Aktivitas terbaru yang masuk ke sistem admin." />
          <AdminTable columns={transactionColumns} rows={transactionRows} />
        </article>

        <article className="admin-panel">
          <PanelHeader title="Prioritas hari ini" text="Tugas yang perlu diselesaikan admin." />
          <div className="admin-task-list">
            {dashboardTasks.map((task) => (
              <div className="admin-task-card" key={task.title}>
                <span>{task.mark}</span>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.text}</p>
                </div>
                <small>{task.time}</small>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function UsersView() {
  return (
    <>
      <FilterBar
        firstPlaceholder="Cari nama, email, kota..."
        second="Semua role"
        third="Semua status"
      />
      <section className="admin-main-grid">
        <article className="admin-panel">
          <PanelHeader title="Daftar Pengguna" text="Gunakan tabel ini untuk melihat role, status, dan tindakan admin." />
          <AdminTable columns={userColumns} rows={userRows} />
        </article>

        <article className="admin-panel">
          <PanelHeader title="Perlu tindakan" text="Akun yang sedang perlu ditinjau admin." />
          <div className="admin-action-list">
            {userActions.map((item) => (
              <ActionItem
                action={item.action}
                initials={item.initials}
                key={item.title}
                text={item.text}
                title={item.title}
              />
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function BooksView() {
  return (
    <>
      <FilterBar
        firstPlaceholder="Cari judul, penulis, pemilik..."
        second="Semua kategori"
        third="Semua status"
      />
      <section className="admin-main-grid">
        <article className="admin-panel">
          <PanelHeader title="Listing Buku" text="Preview cepat untuk moderasi dan pengelolaan katalog." />
          <div className="admin-book-grid">
            {books.map((book) => (
              <article className="admin-book-card" key={book.title}>
                <div className={`admin-book-cover ${book.coverClass}`}>{book.title}</div>
                <div>
                  <h3>{book.title}</h3>
                  <p>
                    {book.author} - Pemilik: {book.owner} - {book.location}
                  </p>
                  <div className="admin-badge-row">
                    {book.badges.map((badge) => (
                      <Badge key={badge.text} text={badge.text} tone={badge.tone} />
                    ))}
                  </div>
                </div>
                <button type="button">{book.action}</button>
              </article>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <PanelHeader title="Buku yang perlu tindakan" text="Daftar cepat untuk moderasi dan perbaikan data." />
          <div className="admin-issue-table">
            {bookIssues.map((item) => (
              <div className="admin-issue-row" key={item.title}>
                <strong>{item.title}</strong>
                <span>{item.issue}</span>
                <Badge text={item.status.text} tone={item.status.tone} />
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function TransactionsView() {
  return (
    <>
      <FilterBar
        firstPlaceholder="Cari ID, peminjam, pemilik, judul..."
        second="Semua status"
        third="Semua metode"
      />
      <section className="admin-main-grid">
        <article className="admin-panel">
          <PanelHeader title="Daftar Transaksi" text="Status peminjaman real-time dan total biaya." />
          <AdminTable columns={transactionColumns} rows={transactionRows} />
        </article>

        <article className="admin-panel">
          <PanelHeader title="Kasus prioritas" text="Transaksi yang perlu campur tangan admin." />
          <div className="admin-case-list">
            {priorityCases.map((item) => (
              <article className="admin-case-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <div>
                  <Badge text={item.status.text} tone={item.status.tone} />
                  <button type="button">{item.action}</button>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function ReportsView() {
  return (
    <>
      <FilterBar
        firstPlaceholder="Cari laporan, user, atau transaksi..."
        second="Semua kategori"
        third="Semua prioritas"
      />
      <section className="admin-main-grid">
        <article className="admin-panel">
          <PanelHeader title="Ringkasan Laporan" text="Area yang paling sering muncul dalam laporan pengguna." />
          <div className="admin-report-grid">
            {reportItems.map((item) => (
              <article className="admin-report-card" key={item.title}>
                <span>{item.title}</span>
                <strong>{item.value}</strong>
                <p>{item.helper}</p>
              </article>
            ))}
          </div>
        </article>

        <article className="admin-panel">
          <PanelHeader title="Kasus prioritas" text="Laporan yang perlu ditutup lebih dahulu." />
          <div className="admin-case-list">
            {priorityCases.map((item) => (
              <article className="admin-case-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <div>
                  <Badge text={item.status.text} tone={item.status.tone} />
                  <button type="button">{item.action}</button>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function FilterBar({
  firstPlaceholder,
  second,
  third,
}: {
  firstPlaceholder: string;
  second: string;
  third: string;
}) {
  return (
    <section className="admin-filterbar" aria-label="Filter data admin">
      <input placeholder={firstPlaceholder} type="search" />
      <select defaultValue="">
        <option value="">{second}</option>
      </select>
      <select defaultValue="">
        <option value="">{third}</option>
      </select>
      <button type="button">Filter</button>
    </section>
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

function ActionItem({
  action,
  initials,
  text,
  title,
}: {
  action: string;
  initials: string;
  text: string;
  title: string;
}) {
  return (
    <article className="admin-action-item">
      <div className="avatar">{initials}</div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <button type="button">{action}</button>
    </article>
  );
}

function AdminTable({ columns, rows }: { columns: TableColumn[]; rows: TableRow[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${index}-${String(row[columns[0].key])}`}>
              {columns.map((column) => {
                const value = row[column.key];

                return (
                  <td key={column.key}>
                    {typeof value === "string" ? (
                      value
                    ) : (
                      <Badge text={value.text} tone={value.tone} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ text, tone }: { text: string; tone: BadgeTone }) {
  return <span className={`admin-badge admin-badge-${tone}`}>{text}</span>;
}

function getStats(section: AdminSection): Stat[] {
  if (section === "users") return userStats;
  if (section === "books") return bookStats;
  if (section === "transactions") return transactionStats;
  if (section === "reports") return reportStats;
  return dashboardStats;
}

export default AdminPage;
