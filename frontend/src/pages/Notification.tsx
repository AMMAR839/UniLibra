type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  time: string;
  tone: string;
  kind: string;
  unread?: boolean;
};

const notificationStats = [
  { label: "Belum dibaca", value: "3", helper: "Perlu dicek hari ini" },
  { label: "Jatuh tempo", value: "1", helper: "Atomic Habits besok" },
  { label: "Chat baru", value: "2", helper: "Dari pemilik buku" },
];

const priorityNotifications: NotificationItem[] = [
  {
    id: "atomic-due",
    title: "Pengembalian Atomic Habits mendekat",
    detail:
      "Batas pengembalian tinggal satu hari. Konfirmasi jadwal serah terima dengan Nicholas S.",
    time: "8 menit lalu",
    tone: "notification-tone-amber",
    kind: "Tempo",
    unread: true,
  },
  {
    id: "filosofi-approved",
    title: "Request Filosofi Teras disetujui",
    detail:
      "Nanda P. menyetujui peminjaman dua minggu dan menunggu detail titik temu.",
    time: "24 menit lalu",
    tone: "notification-tone-green",
    kind: "Disetujui",
    unread: true,
  },
  {
    id: "chat-raina",
    title: "Balasan chat untuk buku Bulan",
    detail:
      "Raina A. mengirim pembaruan kondisi buku dan waktu pengambilan sore ini.",
    time: "1 jam lalu",
    tone: "notification-tone-blue",
    kind: "Chat",
    unread: true,
  },
];

const recentNotifications: NotificationItem[] = [
  {
    id: "sapiens-returned",
    title: "Transaksi Sapiens selesai",
    detail:
      "Buku sudah dikembalikan tepat waktu dan riwayat transaksi diperbarui di profil.",
    time: "Kemarin",
    tone: "notification-tone-dark",
    kind: "Riwayat",
  },
  {
    id: "catalog-review",
    title: "Buku baru masuk tahap pemeriksaan",
    detail:
      "Pengajuan buku pinjamanmu sedang diperiksa sebelum tampil di katalog.",
    time: "Kemarin",
    tone: "notification-tone-rust",
    kind: "Katalog",
  },
  {
    id: "recommendation",
    title: "Koleksi serupa tersedia di sekitar kampus",
    detail:
      "Ada beberapa buku pengembangan diri yang bisa dipinjam dari area Yogyakarta.",
    time: "12 Mei 2026",
    tone: "notification-tone-sage",
    kind: "Rekomendasi",
  },
];

function NotificationPage() {
  function openNavbarChat() {
    window.dispatchEvent(new Event("unilibra:open-chat"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="notification-page">
      <section className="notification-shell">
        <header className="notification-header">
          <div className="notification-copy">
            <span>Notifikasi</span>
            <h1>Pembaruan aktivitas akunmu.</h1>
            <p>
              Pantau persetujuan peminjaman, pesan baru, dan pengingat
              pengembalian sebelum masuk ke riwayat profil.
            </p>
          </div>

          <div className="notification-stats">
            {notificationStats.map((stat) => (
              <article key={stat.label}>
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.helper}</small>
              </article>
            ))}
          </div>
        </header>

        <section className="notification-layout" aria-label="Daftar notifikasi">
          <section className="notification-stream">
            <div className="notification-toolbar">
              <div className="notification-toolbar-copy">
                <span>Perlu perhatian</span>
                <h2>Notifikasi Terbaru</h2>
              </div>

              <div className="notification-toolbar-actions" aria-label="Filter notifikasi">
                <button className="is-active" type="button">
                  Semua
                </button>
                <button type="button">Belum dibaca</button>
                <button type="button">Transaksi</button>
              </div>
            </div>

            <div className="notification-list">
              {priorityNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpenChat={openNavbarChat}
                />
              ))}
            </div>

            <div className="notification-toolbar notification-toolbar-secondary">
              <div className="notification-toolbar-copy">
                <span>Sudah tercatat</span>
                <h2>Aktivitas Sebelumnya</h2>
              </div>
              <button className="notification-mark-all" type="button">
                Tandai semua dibaca
              </button>
            </div>

            <div className="notification-list">
              {recentNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onOpenChat={openNavbarChat}
                />
              ))}
            </div>
          </section>

          <aside className="notification-side" aria-label="Ringkasan notifikasi">
            <span>Pengingat</span>
            <strong>1 buku perlu dikembalikan besok.</strong>
            <p>
              Buka chat dari notifikasi untuk menyepakati waktu pengembalian
              dengan pemilik buku.
            </p>
            <button onClick={openNavbarChat} type="button">
              Buka Chat
            </button>

            <div className="notification-mini-log">
              <small>Aktivitas profil</small>
              <p>Riwayat peminjaman kini tersimpan langsung di menu profil.</p>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function NotificationRow({
  notification,
  onOpenChat,
}: {
  notification: NotificationItem;
  onOpenChat: () => void;
}) {
  return (
    <article
      className={`notification-row ${notification.tone} ${
        notification.unread ? "is-unread" : ""
      }`.trim()}
    >
      <div className="notification-mark" aria-hidden="true">
        <BellIcon />
      </div>

      <div className="notification-row-copy">
        <span>
          {notification.kind}
          <small>{notification.time}</small>
        </span>
        <h3>{notification.title}</h3>
        <p>{notification.detail}</p>
      </div>

      {notification.kind === "Chat" || notification.kind === "Tempo" ? (
        <button onClick={onOpenChat} type="button">
          Buka Chat
        </button>
      ) : (
        <b>{notification.unread ? "Baru" : "Tercatat"}</b>
      )}
    </article>
  );
}

function BellIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17H9m8-2V10a5 5 0 0 0-10 0v5l-2 2h14l-2-2Zm-3 4a2 2 0 0 1-4 0"
      />
    </svg>
  );
}

export default NotificationPage;
