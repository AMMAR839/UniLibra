import { useEffect, useMemo, useState } from "react";
import { apiFetch, formatDate, type Notification } from "../lib/api";

function NotificationPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
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
      window.dispatchEvent(
        new CustomEvent("unilibra:notifications-updated", {
          detail: {
            unreadCount: response.unread_count,
            chatUnreadCount: countUnreadChatNotifications(response.data),
          },
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

  return (
    <main className="notification-page">
      <section className="notification-shell">
        <section className="notification-stream" aria-label="Daftar notifikasi">
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
      </section>
    </main>
  );
}

export default NotificationPage;

function countUnreadChatNotifications(notifications: Notification[]) {
  return notifications.filter(
    (notification) => notification.type === "chat" && !notification.read_at,
  ).length;
}
