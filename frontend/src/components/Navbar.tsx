import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  apiFetch,
  clearToken,
  getToken,
  initials,
  realtimeURL,
  type ChatMessage,
  type ChatThread,
  type Notification,
  type User,
} from "../lib/api";

type NavbarProps = {
  isLoggedIn: boolean;
  activePage?: "home" | "catalog" | "lend" | "contact" | "notification" | "profile";
  onLoginClick?: () => void;
  onNavigate?: (path: string) => void;
};

type RealtimeEnvelope = {
  type: string;
  payload: ChatMessage | Notification | { user_id: number };
};

type NotificationsResponse = {
  data: Notification[];
  unread_count: number;
};

function Navbar({
  isLoggedIn,
  activePage = "home",
  onLoginClick,
  onNavigate,
}: NavbarProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedChatID, setSelectedChatID] = useState<number | null>(null);
  const [draftMessage, setDraftMessage] = useState("");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [profile, setProfile] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [chatNotice, setChatNotice] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  const selectedThread = useMemo(
    () => threads.find((thread) => thread.id === selectedChatID) ?? null,
    [selectedChatID, threads],
  );

  useEffect(() => {
    function openChatFromPage(event: Event) {
      const detail = (event as CustomEvent<{ threadID?: number }>).detail;
      if (detail?.threadID) {
        setSelectedChatID(detail.threadID);
      }
      setIsChatOpen(true);
    }

    window.addEventListener("unilibra:open-chat", openChatFromPage);
    return () => window.removeEventListener("unilibra:open-chat", openChatFromPage);
  }, []);

  useEffect(() => {
    function syncUnreadCount(event: Event) {
      const detail = (event as CustomEvent<{ unreadCount?: number; chatUnreadCount?: number }>).detail;
      if (typeof detail?.unreadCount === "number") {
        setUnreadCount(detail.unreadCount);
      }
      if (typeof detail?.chatUnreadCount === "number") {
        setChatUnreadCount(detail.chatUnreadCount);
      }
    }

    window.addEventListener("unilibra:notifications-updated", syncUnreadCount);
    return () =>
      window.removeEventListener("unilibra:notifications-updated", syncUnreadCount);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      setThreads([]);
      setMessages([]);
      setProfile(null);
      setUnreadCount(0);
      setChatUnreadCount(0);
      socketRef.current?.close();
      return;
    }

    void loadSessionData();

    const token = getToken();
    if (!token) {
      return;
    }

    const socket = new WebSocket(`${realtimeURL()}?token=${encodeURIComponent(token)}`);
    socketRef.current = socket;
    socket.onmessage = (event) => {
      const envelope = JSON.parse(event.data) as RealtimeEnvelope;
      if (envelope.type === "notification.created") {
        const notification = envelope.payload as Notification;
        setUnreadCount((current) => current + 1);
        if (notification.type === "chat") {
          setChatUnreadCount((current) => current + 1);
        }
      }
      if (envelope.type === "chat.message") {
        const message = envelope.payload as ChatMessage;
        setMessages((current) =>
          current.some((item) => item.id === message.id)
            ? current
            : message.thread_id === selectedChatID
              ? [...current, message]
              : current,
        );
        void loadThreads();
      }
    };

    return () => socket.close();
  }, [isLoggedIn, selectedChatID]);

  useEffect(() => {
    if (!selectedChatID || !isLoggedIn) {
      return;
    }

    apiFetch<{ data: ChatMessage[] }>(`/api/chat/threads/${selectedChatID}/messages`)
      .then((response) => {
        setMessages(response.data);
        setChatNotice("");
      })
      .catch((error) =>
        setChatNotice(error instanceof Error ? error.message : "Chat belum bisa dimuat."),
      );
  }, [isLoggedIn, selectedChatID]);

  async function loadSessionData() {
    const [profileResponse, notificationResponse] = await Promise.allSettled([
      apiFetch<{ data: User }>("/api/profile"),
      apiFetch<NotificationsResponse>("/api/notifications"),
    ]);
    if (profileResponse.status === "fulfilled") {
      setProfile(profileResponse.value.data);
    }
    if (notificationResponse.status === "fulfilled") {
      syncNotificationCounts(notificationResponse.value);
    }
    await loadThreads();
  }

  function syncNotificationCounts(response: NotificationsResponse) {
    setUnreadCount(response.unread_count);
    setChatUnreadCount(countUnreadChatNotifications(response.data));
  }

  async function loadThreads() {
    try {
      const response = await apiFetch<{ data: ChatThread[] }>("/api/chat/threads");
      setThreads(response.data);
      setSelectedChatID((current) => current ?? response.data[0]?.id ?? null);
    } catch {
      setThreads([]);
    }
  }

  function handleNavigate(path: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!onNavigate) {
        return;
      }
      event.preventDefault();
      setIsChatOpen(false);
      onNavigate(path);
    };
  }

  function toggleChat() {
    setIsChatOpen((current) => {
      const next = !current;
      if (next) {
        void markChatNotificationsRead();
      }
      return next;
    });
  }

  async function markChatNotificationsRead() {
    if (chatUnreadCount <= 0) {
      return;
    }

    const clearedCount = chatUnreadCount;
    setChatUnreadCount(0);
    setUnreadCount((current) => Math.max(0, current - clearedCount));

    try {
      await apiFetch("/api/notifications/read-all?type=chat", { method: "PUT" });
      const response = await apiFetch<NotificationsResponse>("/api/notifications");
      syncNotificationCounts(response);
      window.dispatchEvent(
        new CustomEvent("unilibra:notifications-updated", {
          detail: {
            unreadCount: response.unread_count,
            chatUnreadCount: countUnreadChatNotifications(response.data),
          },
        }),
      );
    } catch {
      await loadSessionData();
    }
  }

  async function sendMessage() {
    if (!selectedThread || !draftMessage.trim()) {
      return;
    }
    const body = draftMessage.trim();
    setDraftMessage("");
    try {
      const response = await apiFetch<{ data: ChatMessage }>(
        `/api/chat/threads/${selectedThread.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ body }),
        },
      );
      setMessages((current) => [...current, response.data]);
      await loadThreads();
    } catch (error) {
      setDraftMessage(body);
      setChatNotice(error instanceof Error ? error.message : "Pesan belum terkirim.");
    }
  }

  function logout() {
    clearToken();
    onNavigate?.("/");
  }

  return (
    <nav>
      <a href="/" className="nav-logo" onClick={handleNavigate("/")}>
        <div className="logo-mark"></div>
        <span className="logo-text">UniLibra</span>
      </a>

      <ul className="nav-links">
        <NavLink active={activePage === "home"} href="/" label="Beranda" onClick={handleNavigate("/")} />
        <NavLink active={activePage === "catalog"} href="/katalog" label="Katalog Buku" onClick={handleNavigate("/katalog")} />
        <NavLink active={activePage === "lend"} href="/pinjamkan" label="Pinjamkan Buku" onClick={handleNavigate("/pinjamkan")} />
        <NavLink active={activePage === "contact"} href="/kontak" label="Kontak" onClick={handleNavigate("/kontak")} />
      </ul>

      <div className="nav-actions">
        <div className="nav-chat-wrap">
          <button
            aria-expanded={isChatOpen}
            aria-label="Buka chat"
            className="nav-chat-trigger"
            onClick={toggleChat}
            type="button"
          >
            <ChatIcon />
            <span>Chat</span>
            {chatUnreadCount > 0 ? <strong>{chatUnreadCount}</strong> : null}
          </button>
          {isChatOpen ? (
            <div className="nav-chat-popover" role="dialog" aria-label="Chat UniLibra">
              <div className="nav-chat-header">
                <div>
                  <strong>Chat UniLibra</strong>
                  <span>{threads.length} percakapan</span>
                </div>
                <button aria-label="Tutup chat" onClick={() => setIsChatOpen(false)} type="button">
                  x
                </button>
              </div>
              <div className="nav-chat-body">
                <div className="nav-chat-list">
                  <div className="nav-chat-scroll">
                    {threads.map((thread) => {
                      const peer = chatPeer(thread, profile);
                      return (
                        <button
                          className={`nav-chat-item ${thread.id === selectedThread?.id ? "is-active" : ""}`}
                          key={thread.id}
                          onClick={() => setSelectedChatID(thread.id)}
                          type="button"
                        >
                          <div className="avatar">{initials(peer?.name)}</div>
                          <div>
                            <span className="nav-chat-item-head">
                              <strong>{peer?.name || "Pengguna"}</strong>
                            </span>
                            <p>{thread.book?.title || "Percakapan UniLibra"}</p>
                            <span className="nav-chat-book">{thread.book?.author || "Chat langsung"}</span>
                          </div>
                        </button>
                      );
                    })}
                    {threads.length === 0 ? <p className="nav-chat-book">Belum ada percakapan.</p> : null}
                  </div>
                </div>
                <section className="nav-chat-thread" aria-label="Isi percakapan">
                  <div className="nav-chat-thread-head">
                    <div className="avatar">{initials(chatPeer(selectedThread, profile)?.name)}</div>
                    <div>
                      <strong>{chatPeer(selectedThread, profile)?.name || "Pilih percakapan"}</strong>
                      <span>{selectedThread?.book?.title || "Chat peminjaman buku"}</span>
                    </div>
                  </div>
                  <div className="nav-chat-messages">
                    <span className="nav-chat-day">Realtime</span>
                    {messages.map((message) => (
                      <div
                        className={`nav-chat-bubble ${message.sender_id === profile?.id ? "is-user" : ""}`}
                        key={message.id}
                      >
                        <p>{message.body}</p>
                        <span>{new Date(message.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    ))}
                    {chatNotice ? <p className="nav-chat-book">{chatNotice}</p> : null}
                  </div>
                  <div className="nav-chat-compose">
                    <input
                      aria-label="Balas chat"
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          void sendMessage();
                        }
                      }}
                      placeholder={selectedThread ? "Tulis pesan..." : "Pilih chat dulu"}
                      type="text"
                      value={draftMessage}
                    />
                    <button type="button" onClick={() => void sendMessage()}>
                      Kirim
                    </button>
                  </div>
                </section>
              </div>
            </div>
          ) : null}
        </div>

        {isLoggedIn ? (
          <>
            <a
              aria-label="Buka notifikasi"
              className={`nav-notification-link ${activePage === "notification" ? "is-active" : ""}`.trim()}
              href="/notifikasi"
              onClick={handleNavigate("/notifikasi")}
              title="Notifikasi"
            >
              <BellIcon />
              <strong aria-label={`${unreadCount} notifikasi belum dibaca`}>{unreadCount}</strong>
            </a>
            <a
              className={`avatar-chip ${activePage === "profile" ? "is-active" : ""}`.trim()}
              href="/profil"
              onClick={handleNavigate("/profil")}
            >
              <div className="avatar">{initials(profile?.name)}</div>
              <span>{profile?.name || "Profil"}</span>
            </a>
            <button className="btn-ghost" type="button" onClick={logout}>
              Keluar
            </button>
          </>
        ) : (
          <button className="btn-ghost" type="button" onClick={onLoginClick}>
            Masuk / Daftar
          </button>
        )}
      </div>
    </nav>
  );
}

function NavLink({
  active,
  href,
  label,
  onClick,
}: {
  active: boolean;
  href: string;
  label: string;
  onClick: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <li>
      <a className={active ? "is-active" : undefined} href={href} onClick={onClick}>
        {label}
      </a>
    </li>
  );
}

function chatPeer(thread: ChatThread | null, profile: User | null) {
  if (!thread) {
    return null;
  }
  return thread.created_by_id === profile?.id ? thread.recipient : thread.created_by;
}

function countUnreadChatNotifications(notifications: Notification[]) {
  return notifications.filter(
    (notification) => notification.type === "chat" && !notification.read_at,
  ).length;
}

function ChatIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h6m-8 8 3.2-2.4c.35-.26.78-.4 1.22-.4H17a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v6.2A4 4 0 0 0 7 17h.2L5 20Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg aria-hidden="true" width="19" height="19" fill="none" viewBox="0 0 24 24">
      <path
        d="M18.7491 9.70957V9.00497C18.7491 5.13623 15.7274 2 12 2C8.27256 2 5.25087 5.13623 5.25087 9.00497V9.70957C5.25087 10.5552 5.00972 11.3818 4.5578 12.0854L3.45036 13.8095C2.43882 15.3843 3.21105 17.5249 4.97036 18.0229C9.57274 19.3257 14.4273 19.3257 19.0296 18.0229C20.789 17.5249 21.5612 15.3843 20.5496 13.8095L19.4422 12.0854C18.9903 11.3818 18.7491 10.5552 18.7491 9.70957Z"
        stroke="currentColor"
        strokeWidth="1.65"
      />
      <path
        d="M7.5 19C8.15503 20.7478 9.92246 22 12 22C14.0775 22 15.845 20.7478 16.5 19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.65"
      />
    </svg>
  );
}

export default Navbar;
