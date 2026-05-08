type HistoryStatus = "active" | "pending" | "returned" | "cancelled";

type HistoryItem = {
  title: string;
  author: string;
  owner: string;
  ownerInitial: string;
  ownerLocation: string;
  coverClass: string;
  status: HistoryStatus;
  statusText: string;
  total: string;
  note: string;
  meta: Array<{
    label: string;
    value: string;
  }>;
  actions: string[];
};

const summaryStats = [
  {
    label: "Total transaksi",
    value: "18",
    text: "Seluruh request dan peminjaman yang pernah dibuat.",
  },
  {
    label: "Sedang aktif",
    value: "3",
    text: "Buku yang saat ini sedang kamu pinjam atau menunggu jatuh tempo.",
  },
  {
    label: "Sudah dikembalikan",
    value: "11",
    text: "Riwayat peminjaman yang selesai tanpa kendala.",
  },
  {
    label: "Dibatalkan",
    value: "4",
    text: "Request yang tidak jadi diproses atau dibatalkan salah satu pihak.",
  },
];

const historyItems: HistoryItem[] = [
  {
    title: "Bumi Manusia",
    author: "Pramoedya Ananta Toer",
    owner: "Sinta M.",
    ownerInitial: "SM",
    ownerLocation: "Yogyakarta",
    coverClass: "history-cover-rust",
    status: "returned",
    statusText: "Dikembalikan",
    total: "Rp 6.000",
    note: "Salah satu transaksi tercepat dan paling mulus. Pemilik memberi rating bagus dan membuka kemungkinan untuk pinjam judul lain dari koleksinya.",
    meta: [
      { label: "Status", value: "Dikembalikan" },
      { label: "Tanggal pinjam", value: "7 Jan 2026" },
      { label: "Tanggal kembali", value: "14 Jan 2026" },
      { label: "Catatan", value: "Tepat waktu" },
    ],
    actions: ["Lihat Detail", "Pinjam Lagi", "Chat Pemilik"],
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    owner: "Raka D.",
    ownerInitial: "RD",
    ownerLocation: "Bantul",
    coverClass: "history-cover-blue",
    status: "returned",
    statusText: "Dikembalikan",
    total: "Rp 14.000",
    note: "Peminjaman selesai dengan baik dan buku sudah dikembalikan tepat waktu. Kamu juga sudah memberi ulasan positif untuk pemilik buku.",
    meta: [
      { label: "Status", value: "Dikembalikan" },
      { label: "Tanggal pinjam", value: "26 Feb 2026" },
      { label: "Tanggal kembali", value: "12 Mar 2026" },
      { label: "Rating", value: "5.0" },
    ],
    actions: ["Lihat Detail", "Pinjam Lagi", "Lihat Ulasan"],
  },
  {
    title: "Matematika Teknik",
    author: "Smeed",
    owner: "Agus R.",
    ownerInitial: "AR",
    ownerLocation: "Depok",
    coverClass: "history-cover-dark",
    status: "cancelled",
    statusText: "Dibatalkan",
    total: "Rp 9.000",
    note: "Request batal diproses karena jadwal serah terima tidak cocok. Transaksi ditutup tanpa biaya tambahan dan kamu masih bisa mencari buku lain dengan kategori serupa.",
    meta: [
      { label: "Status", value: "Dibatalkan" },
      { label: "Tanggal request", value: "28 Mar 2026" },
      { label: "Alasan", value: "Jadwal bentrok" },
      { label: "Refund", value: "Tidak ada" },
    ],
    actions: ["Lihat Detail", "Cari Buku Serupa", "Hubungi Lagi"],
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    owner: "Nicholas S.",
    ownerInitial: "NS",
    ownerLocation: "Sleman",
    coverClass: "history-cover-yellow",
    status: "active",
    statusText: "Sedang dipinjam",
    total: "Rp 16.000",
    note: "Buku sedang aktif dipinjam. Pemilik sudah konfirmasi titik temu dan transaksi berjalan normal. Kamu masih bisa chat pemilik atau ajukan perpanjangan sebelum jatuh tempo.",
    meta: [
      { label: "Status", value: "Sedang dipinjam" },
      { label: "Tanggal mulai", value: "2 Apr 2026" },
      { label: "Jatuh tempo", value: "16 Apr 2026" },
      { label: "Metode", value: "Ketemuan langsung" },
    ],
    actions: ["Lihat Detail", "Perpanjang", "Chat Pemilik"],
  },
  {
    title: "Filosofi Teras",
    author: "Henry Manampiring",
    owner: "Nanda P.",
    ownerInitial: "NP",
    ownerLocation: "Yogyakarta",
    coverClass: "history-cover-green",
    status: "pending",
    statusText: "Menunggu",
    total: "Rp 12.000",
    note: "Request sudah dikirim dan sedang menunggu konfirmasi dari pemilik. Kamu masih bisa edit pesan, ubah preferensi lokasi, atau membatalkan request sebelum disetujui.",
    meta: [
      { label: "Status", value: "Menunggu" },
      { label: "Tanggal request", value: "4 Apr 2026" },
      { label: "Durasi", value: "2 minggu" },
      { label: "Lokasi", value: "Sekitar UGM" },
    ],
    actions: ["Lihat Request", "Edit Request", "Chat Pemilik"],
  },
];

const statusOverview = [
  { label: "Request menunggu konfirmasi", value: "1 transaksi" },
  { label: "Sedang dipinjam", value: "3 buku" },
  { label: "Perlu dikembalikan minggu ini", value: "1 buku" },
  { label: "Sudah selesai bulan ini", value: "2 transaksi" },
];

const flowSteps = [
  {
    title: "Request dibuat",
    text: "Pengguna memilih buku, durasi, dan metode serah terima, lalu request masuk ke pemilik.",
    active: true,
  },
  {
    title: "Menunggu konfirmasi",
    text: "Pemilik mengecek ketersediaan dan menyepakati detail melalui chat.",
    active: true,
  },
  {
    title: "Sedang dipinjam",
    text: "Buku sudah diterima dan status berjalan sampai tanggal jatuh tempo.",
    active: true,
  },
  {
    title: "Dikembalikan / selesai",
    text: "Setelah buku kembali dan transaksi selesai, riwayat masuk ke arsip.",
    active: false,
  },
];

function HistoryPage() {
  function openNavbarChat() {
    window.dispatchEvent(new Event("unilibra:open-chat"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="history-page">
      <section className="history-hero">
        <div className="history-hero-copy">
          <span className="hero-eyebrow">Riwayat peminjaman</span>
          <h1>
            Semua pesanan buku, yang <em>dipinjam</em>, dikembalikan, sampai
            dibatalkan.
          </h1>
          <p>
            Halaman ini merangkum aktivitas peminjamanmu di UniLibra: request
            yang masih menunggu, buku yang sedang aktif dipinjam, histori yang
            sudah dikembalikan, dan transaksi yang dibatalkan.
          </p>
          <div className="history-hero-tags" aria-label="Keunggulan riwayat">
            <span>Semua status dalam satu tempat</span>
            <span>Bisa filter dan cari cepat</span>
            <span>Cocok untuk lanjutan halaman peminjaman</span>
          </div>
        </div>

        <aside className="history-hero-panel" aria-label="Cuplikan riwayat buku">
          {historyItems.slice(3).map((item) => (
            <article className="history-mini-card" key={item.title}>
              <div className={`history-mini-cover ${item.coverClass}`}>
                {item.title}
              </div>
              <div>
                <strong>{item.title}</strong>
                <span>{item.author}</span>
                <b className={`history-status history-status-${item.status}`}>
                  {item.statusText}
                </b>
              </div>
              <small>{item.status === "active" ? "Kembali 16 Apr" : "Perlu cek"}</small>
            </article>
          ))}
        </aside>
      </section>

      <section className="history-stats" aria-label="Ringkasan riwayat">
        {summaryStats.map((stat) => (
          <article className="history-stat-card" key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
            <p>{stat.text}</p>
          </article>
        ))}
      </section>

      <section className="history-toolbar" aria-label="Cari dan filter riwayat">
        <label className="history-search">
          <SearchIcon />
          <input placeholder="Cari judul buku, penulis, atau nama pemilik..." />
        </label>
        <select aria-label="Filter status" defaultValue="all">
          <option value="all">Semua status</option>
          <option value="pending">Menunggu</option>
          <option value="active">Sedang dipinjam</option>
          <option value="returned">Dikembalikan</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
        <select aria-label="Urutan riwayat" defaultValue="newest">
          <option value="newest">Urutkan: terbaru</option>
          <option value="oldest">Urutkan: terlama</option>
        </select>
        <button className="btn-search" type="button">
          Terapkan
        </button>
        <div className="history-filter-row">
          {["Semua", "Menunggu", "Sedang dipinjam", "Dikembalikan", "Dibatalkan"].map(
            (filter) => (
              <button
                className={filter === "Semua" ? "is-active" : undefined}
                key={filter}
                type="button"
              >
                {filter}
              </button>
            ),
          )}
        </div>
        <span className="history-found">5 riwayat ditemukan</span>
      </section>

      <section className="history-content">
        <div className="history-list">
          {historyItems.map((item) => (
            <HistoryCard item={item} key={item.title} onOpenChat={openNavbarChat} />
          ))}
        </div>

        <aside className="history-side">
          <article className="history-side-card">
            <h2>Status Aktif Saat Ini</h2>
            <p>Ringkasan cepat untuk transaksi yang masih berjalan atau perlu perhatian.</p>
            <div className="history-status-list">
              {statusOverview.map((status) => (
                <span key={status.label}>
                  {status.label}
                  <strong>{status.value}</strong>
                </span>
              ))}
            </div>
          </article>

          <article className="history-side-card">
            <h2>Alur Riwayat Peminjaman</h2>
            <p>Semua transaksi di UniLibra biasanya bergerak melalui tahapan berikut.</p>
            <ol className="history-flow">
              {flowSteps.map((step, index) => (
                <li className={step.active ? "is-active" : undefined} key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>

          <article className="history-side-card history-quick-card">
            <h2>Aksi Cepat</h2>
            <p>Bagian ini bisa dipakai untuk tombol lanjutan dari histori.</p>
            <button type="button">
              Butuh perpanjangan pinjam?
              <span>Ajukan</span>
            </button>
            <button type="button">
              Ingin cari judul serupa?
              <span>Jelajahi</span>
            </button>
            <button type="button" onClick={openNavbarChat}>
              Perlu hubungi pemilik?
              <span>Buka Chat</span>
            </button>
          </article>
        </aside>
      </section>
    </main>
  );
}

function HistoryCard({
  item,
  onOpenChat,
}: {
  item: HistoryItem;
  onOpenChat: () => void;
}) {
  return (
    <article className="history-card">
      <div className={`history-cover ${item.coverClass}`}>
        <span>{item.title}</span>
      </div>

      <div className="history-card-body">
        <div className="history-card-head">
          <div>
            <h2>{item.title}</h2>
            <p>{item.author}</p>
          </div>
          <div>
            <span>Total transaksi</span>
            <strong>{item.total}</strong>
          </div>
          <b className={`history-status history-status-${item.status}`}>
            {item.statusText}
          </b>
        </div>

        <div className="history-meta-grid">
          {item.meta.map((meta) => (
            <span key={meta.label}>
              {meta.label}
              <strong>{meta.value}</strong>
            </span>
          ))}
        </div>

        <p className="history-note">{item.note}</p>

        <div className="history-owner-row">
          <div className="avatar">{item.ownerInitial}</div>
          <span>
            Pemilik: {item.owner} - {item.ownerLocation}
          </span>
        </div>

        <div className="history-card-actions">
          {item.actions.map((action) => (
            <button
              className={action.includes("Chat") || action.includes("Hubungi") ? "is-dark" : ""}
              key={action}
              onClick={action.includes("Chat") || action.includes("Hubungi") ? onOpenChat : undefined}
              type="button"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function SearchIcon() {
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
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
      />
    </svg>
  );
}

export default HistoryPage;
