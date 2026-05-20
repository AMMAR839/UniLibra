import type { KeyboardEvent, MouseEvent } from "react";

type HistoryItem = {
  title: string;
  author: string;
  owner: string;
  ownerInitial: string;
  ownerLocation: string;
  coverClass: string;
  total: string;
  note: string;
  meta: Array<{
    label: string;
    value: string;
  }>;
};

type HistorySectionProps = {
  onBorrowBook: () => void;
};

const historyItems: HistoryItem[] = [
  {
    title: "Bumi Manusia",
    author: "Pramoedya Ananta Toer",
    owner: "Sinta M.",
    ownerInitial: "SM",
    ownerLocation: "Yogyakarta",
    coverClass: "history-cover-rust",
    total: "Rp 6.000",
    note: "Salah satu transaksi tercepat dan paling mulus. Pemilik memberi rating bagus dan membuka kemungkinan untuk pinjam judul lain dari koleksinya.",
    meta: [
      { label: "Status", value: "Dikembalikan" },
      { label: "Tanggal pinjam", value: "7 Jan 2026" },
      { label: "Tanggal kembali", value: "14 Jan 2026" },
      { label: "Catatan", value: "Tepat waktu" },
    ],
  },
  {
    title: "Sapiens",
    author: "Yuval Noah Harari",
    owner: "Raka D.",
    ownerInitial: "RD",
    ownerLocation: "Bantul",
    coverClass: "history-cover-blue",
    total: "Rp 14.000",
    note: "Peminjaman selesai dengan baik dan buku sudah dikembalikan tepat waktu. Kamu juga sudah memberi ulasan positif untuk pemilik buku.",
    meta: [
      { label: "Status", value: "Dikembalikan" },
      { label: "Tanggal pinjam", value: "26 Feb 2026" },
      { label: "Tanggal kembali", value: "12 Mar 2026" },
      { label: "Rating", value: "5.0" },
    ],
  },
  {
    title: "Matematika Teknik",
    author: "Smeed",
    owner: "Agus R.",
    ownerInitial: "AR",
    ownerLocation: "Depok",
    coverClass: "history-cover-dark",
    total: "Rp 9.000",
    note: "Request batal diproses karena jadwal serah terima tidak cocok. Transaksi ditutup tanpa biaya tambahan dan kamu masih bisa mencari buku lain dengan kategori serupa.",
    meta: [
      { label: "Status", value: "Dibatalkan" },
      { label: "Tanggal request", value: "28 Mar 2026" },
      { label: "Alasan", value: "Jadwal bentrok" },
      { label: "Refund", value: "Tidak ada" },
    ],
  },
  {
    title: "Atomic Habits",
    author: "James Clear",
    owner: "Nicholas S.",
    ownerInitial: "NS",
    ownerLocation: "Sleman",
    coverClass: "history-cover-yellow",
    total: "Rp 16.000",
    note: "Buku sedang aktif dipinjam. Pemilik sudah konfirmasi titik temu dan transaksi berjalan normal. Kamu masih bisa chat pemilik atau ajukan perpanjangan sebelum jatuh tempo.",
    meta: [
      { label: "Status", value: "Sedang dipinjam" },
      { label: "Tanggal mulai", value: "2 Apr 2026" },
      { label: "Jatuh tempo", value: "16 Apr 2026" },
      { label: "Metode", value: "Ketemuan langsung" },
    ],
  },
  {
    title: "Filosofi Teras",
    author: "Henry Manampiring",
    owner: "Nanda P.",
    ownerInitial: "NP",
    ownerLocation: "Yogyakarta",
    coverClass: "history-cover-green",
    total: "Rp 12.000",
    note: "Request sudah dikirim dan sedang menunggu konfirmasi dari pemilik. Kamu masih bisa edit pesan, ubah preferensi lokasi, atau membatalkan request sebelum disetujui.",
    meta: [
      { label: "Status", value: "Menunggu" },
      { label: "Tanggal request", value: "4 Apr 2026" },
      { label: "Durasi", value: "2 minggu" },
      { label: "Lokasi", value: "Sekitar UGM" },
    ],
  },
];

function HistorySection({ onBorrowBook }: HistorySectionProps) {
  function openNavbarChat() {
    window.dispatchEvent(new Event("unilibra:open-chat"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="history-section">
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
            <HistoryCard
              item={item}
              key={item.title}
              onOpenBorrow={onBorrowBook}
              onOpenChat={openNavbarChat}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function HistoryCard({
  item,
  onOpenBorrow,
  onOpenChat,
}: {
  item: HistoryItem;
  onOpenBorrow: () => void;
  onOpenChat: () => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenBorrow();
    }
  }

  function handleOpenChat(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    onOpenChat();
  }

  return (
    <article
      className="history-card"
      onClick={onOpenBorrow}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
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
          <button
            className="history-owner-chat"
            onClick={handleOpenChat}
            type="button"
          >
            Chat Pemilik
          </button>
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

export default HistorySection;
