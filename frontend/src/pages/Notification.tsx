import { useEffect, useMemo, useState } from "react";
import { apiFetch, formatDate, type Notification } from "../lib/api";

function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadNotifications();
  }, []);

  const visibleNotifications = useMemo(
    () =>
      filter === "unread"
        ? notifications.filter((notification) => !notification.read_at)
        : notifications,
    [filter, notifications],
  );

  async function loadNotifications() {
    try {
      const response = await apiFetch<{
        data: Notification[];
        unread_count: number;
      }>("/api/notifications");
      setNotifications(response.data);
      setUnreadCount(response.unread_count);
      window.dispatchEvent(
        new CustomEvent("unilibra:notifications-updated", {
          detail: { unreadCount: response.unread_count },
        }),
      );
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Notifikasi belum bisa dimuat.");
    }
  }

  async function markRead(notificationID: number) {
    await apiFetch(`/api/notifications/${notificationID}/read`, {
      method: "PUT",
    });
    await loadNotifications();
  }

  async function markAllRead() {
    await apiFetch("/api/notifications/read-all", { method: "PUT" });
    await loadNotifications();
  }

  return (
    <main className="notification-page">
      <section className="notification-shell">
        <header className="notification-header">
          <div className="notification-copy">
            <span>Pusat Notifikasi</span>
            <h1>Aktivitas yang Perlu Kamu Lihat</h1>
            <p>
              Notifikasi berasal dari permintaan peminjaman, pengembalian, dan
              pesan chat yang benar-benar masuk ke sistem.
            </p>
          </div>
          <div className="notification-stats">
            <article>
              <span>Belum dibaca</span>
              <strong>{unreadCount}</strong>
            </article>
            <article>
              <span>Total</span>
              <strong>{notifications.length}</strong>
            </article>
          </div>
        </header>

        <section className="notification-layout" aria-label="Daftar notifikasi">
          <section className="notification-stream">
            <div className="notification-toolbar">
              <div className="notification-toolbar-copy">
                <span>Timeline</span>
                <h2>Notifikasi Sistem</h2>
              </div>
              <div className="notification-toolbar-actions" aria-label="Filter notifikasi">
                <button
                  className={filter === "all" ? "is-active" : undefined}
                  onClick={() => setFilter("all")}
                  type="button"
                >
                  Semua
                </button>
                <button
                  className={filter === "unread" ? "is-active" : undefined}
                  onClick={() => setFilter("unread")}
                  type="button"
                >
                  Belum dibaca
                </button>
              </div>
            </div>

            {message ? <div className="notification-mini-log">{message}</div> : null}
            <div className="notification-list">
              {visibleNotifications.map((notification) => (
                <article
                  className={`notification-row notification-tone-amber ${
                    notification.read_at ? "" : "is-unread"
                  }`.trim()}
                  key={notification.id}
                >
                  <div className="notification-mark" aria-hidden="true">
                    {notification.type.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="notification-row-copy">
                    <span>
                      {notification.type}
                      <small>{formatDate(notification.created_at)}</small>
                    </span>
                    <h3>{notification.title}</h3>
                    <p>{notification.body}</p>
                  </div>
                  {!notification.read_at ? (
                    <button type="button" onClick={() => void markRead(notification.id)}>
                      Tandai dibaca
                    </button>
                  ) : (
                    <b>Tercatat</b>
                  )}
                </article>
              ))}
              {visibleNotifications.length === 0 ? (
                <div className="notification-mini-log">
                  Belum ada notifikasi untuk filter ini.
                </div>
              ) : null}
            </div>
          </section>

          <aside className="notification-side" aria-label="Ringkasan notifikasi">
            <span>Aksi cepat</span>
            <strong>Rapikan inbox notifikasimu.</strong>
            <p>
              Badge pada navbar akan ikut turun setelah notifikasi ditandai
              selesai dibaca.
            </p>
            <button type="button" onClick={() => void markAllRead()}>
              Tandai Semua Dibaca
            </button>
          </aside>
        </section>
      </section>
    </main>
  );
}

export default NotificationPage;
