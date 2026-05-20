import { useEffect, useState, type MouseEvent } from "react";

type ChatMessage = {
  id: number;
  from: "me" | "them";
  text: string;
  time: string;
};

type ChatConversation = {
  id: string;
  name: string;
  avatar: string;
  avatarClass?: string;
  bookTitle: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  messages: ChatMessage[];
};

type NavbarProps = {
  isLoggedIn: boolean;
  activePage?: "home" | "catalog" | "lend" | "contact" | "notification" | "profile";
  onLoginClick?: () => void;
  onNavigate?: (path: string) => void;
};

const chatConversations: ChatConversation[] = [
  {
    id: "nicholas",
    name: "Nicholas S.",
    avatar: "NS",
    bookTitle: "Atomic Habits",
    lastMessage: "Atomic Habits masih tersedia. Ajukan durasinya ya.",
    time: "Baru saja",
    unread: 2,
    online: true,
    messages: [
      {
        id: 1,
        from: "them",
        text: "Halo, bukunya masih tersedia ya. Kalau mau pinjam, langsung ajukan saja durasinya.",
        time: "09:14",
      },
      {
        id: 2,
        from: "me",
        text: "Halo kak, saya tertarik pinjam Atomic Habits untuk sekitar 2 minggu.",
        time: "09:16",
      },
      {
        id: 3,
        from: "them",
        text: "Siap. Untuk pengambilan saya fleksibel sore hari. Sekitar UGM atau Seturan juga bisa.",
        time: "09:18",
      },
    ],
  },
  {
    id: "raina",
    name: "Raina A.",
    avatar: "RA",
    avatarClass: "nav-chat-avatar-alt",
    bookTitle: "Bulan",
    lastMessage: "Buku Bulan bisa diambil sekitar kampus sore ini.",
    time: "12 menit lalu",
    unread: 1,
    online: true,
    messages: [
      {
        id: 1,
        from: "them",
        text: "Untuk buku Bulan masih ada. Kondisinya bagus, hanya ada sedikit bekas lipatan di sampul.",
        time: "08:41",
      },
      {
        id: 2,
        from: "me",
        text: "Boleh saya ambil sore ini di sekitar kampus?",
        time: "08:44",
      },
      {
        id: 3,
        from: "them",
        text: "Bisa. Saya kosong setelah jam 16.30.",
        time: "08:48",
      },
    ],
  },
  {
    id: "bima",
    name: "Bima R.",
    avatar: "BR",
    avatarClass: "nav-chat-avatar-blue",
    bookTitle: "Laskar Pelangi",
    lastMessage: "Kalau jadi, nanti saya bawakan bukunya besok pagi.",
    time: "1 jam lalu",
    unread: 0,
    online: false,
    messages: [
      {
        id: 1,
        from: "me",
        text: "Halo, Laskar Pelangi masih bisa dipinjam minggu ini?",
        time: "07:20",
      },
      {
        id: 2,
        from: "them",
        text: "Masih. Kalau jadi, nanti saya bawakan bukunya besok pagi.",
        time: "07:36",
      },
    ],
  },
  {
    id: "salsa",
    name: "Salsa N.",
    avatar: "SN",
    avatarClass: "nav-chat-avatar-green",
    bookTitle: "Filosofi Teras",
    lastMessage: "Durasi 2 minggu aman, asal dikembalikan sebelum tanggal 20.",
    time: "Kemarin",
    unread: 0,
    online: false,
    messages: [
      {
        id: 1,
        from: "them",
        text: "Durasi 2 minggu aman, asal dikembalikan sebelum tanggal 20.",
        time: "19:05",
      },
      {
        id: 2,
        from: "me",
        text: "Siap kak, nanti saya ajukan request dari halaman buku.",
        time: "19:09",
      },
    ],
  },
];

function Navbar({
  isLoggedIn,
  activePage = "home",
  onLoginClick,
  onNavigate,
}: NavbarProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState(chatConversations[0].id);
  const [draftMessage, setDraftMessage] = useState("");
  const selectedConversation =
    chatConversations.find((conversation) => conversation.id === selectedChatId) ??
    chatConversations[0];
  const unreadCount = chatConversations.reduce(
    (total, conversation) => total + conversation.unread,
    0,
  );

  useEffect(() => {
    function openChatFromPage() {
      setIsChatOpen(true);
    }

    window.addEventListener("unilibra:open-chat", openChatFromPage);

    return () => window.removeEventListener("unilibra:open-chat", openChatFromPage);
  }, []);

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

  return (
    <nav>
      <a href="/" className="nav-logo" onClick={handleNavigate("/")}>
        <div className="logo-mark"></div>
        <span className="logo-text">UniLibra</span>
      </a>

      <ul className="nav-links">
        <li>
          <a
            className={activePage === "home" ? "is-active" : undefined}
            href="/"
            onClick={handleNavigate("/")}
          >
            Beranda
          </a>
        </li>
        <li>
          <a
            className={activePage === "catalog" ? "is-active" : undefined}
            href="/katalog"
            onClick={handleNavigate("/katalog")}
          >
            Katalog Buku
          </a>
        </li>
        <li>
          <a
            className={activePage === "lend" ? "is-active" : undefined}
            href="/pinjamkan"
            onClick={handleNavigate("/pinjamkan")}
          >
            Pinjamkan Buku
          </a>
        </li>
        <li>
          <a
            className={activePage === "contact" ? "is-active" : undefined}
            href="/kontak"
            onClick={handleNavigate("/kontak")}
          >
            Kontak
          </a>
        </li>
      </ul>

      <div className="nav-actions">
        <div className="nav-chat-wrap">
          <button
            aria-expanded={isChatOpen}
            aria-label="Buka chat"
            className="nav-chat-trigger"
            onClick={() => setIsChatOpen((current) => !current)}
            type="button"
          >
            <ChatIcon />
            <span>Chat</span>
            <strong>{unreadCount}</strong>
          </button>

          {isChatOpen ? (
            <div className="nav-chat-popover" role="dialog" aria-label="Chat UniLibra">
              <div className="nav-chat-header">
                <div>
                  <strong>Chat UniLibra</strong>
                  <span>{chatConversations.length} percakapan aktif</span>
                </div>
                <button
                  aria-label="Tutup chat"
                  onClick={() => setIsChatOpen(false)}
                  type="button"
                >
                  x
                </button>
              </div>

              <div className="nav-chat-body">
                <div className="nav-chat-list">
                  <label className="nav-chat-search">
                    <SearchIcon />
                    <input placeholder="Cari chat atau judul buku" type="text" />
                  </label>

                  <div className="nav-chat-tabs" aria-label="Filter chat">
                    <button className="is-active" type="button">
                      Semua
                    </button>
                    <button type="button">Belum dibaca</button>
                  </div>

                  <div className="nav-chat-scroll">
                    {chatConversations.map((conversation) => (
                      <button
                        className={`nav-chat-item ${
                          conversation.id === selectedConversation.id ? "is-active" : ""
                        }`}
                        key={conversation.id}
                        onClick={() => setSelectedChatId(conversation.id)}
                        type="button"
                      >
                        <div
                          className={`avatar ${conversation.avatarClass ?? ""}`.trim()}
                        >
                          {conversation.avatar}
                        </div>
                        <div>
                          <span className="nav-chat-item-head">
                            <strong>{conversation.name}</strong>
                            <small>{conversation.time}</small>
                          </span>
                          <p>{conversation.lastMessage}</p>
                          <span className="nav-chat-book">{conversation.bookTitle}</span>
                        </div>
                        {conversation.unread > 0 ? (
                          <b aria-label={`${conversation.unread} pesan belum dibaca`}>
                            {conversation.unread}
                          </b>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>

                <section className="nav-chat-thread" aria-label="Isi percakapan">
                  <div className="nav-chat-thread-head">
                    <div className="avatar">
                      {selectedConversation.avatar}
                    </div>
                    <div>
                      <strong>{selectedConversation.name}</strong>
                      <span>
                        {selectedConversation.online ? "Online" : "Offline"} -{" "}
                        {selectedConversation.bookTitle}
                      </span>
                    </div>
                  </div>

                  <div className="nav-chat-messages">
                    <span className="nav-chat-day">Hari ini</span>
                    {selectedConversation.messages.map((message) => (
                      <div
                        className={`nav-chat-bubble ${
                          message.from === "me" ? "is-user" : ""
                        }`}
                        key={message.id}
                      >
                        <p>{message.text}</p>
                        <span>{message.time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="nav-chat-compose">
                    <input
                      aria-label="Balas chat"
                      onChange={(event) => setDraftMessage(event.target.value)}
                      placeholder={`Balas ${selectedConversation.name}...`}
                      type="text"
                      value={draftMessage}
                    />
                    <button type="button">Kirim</button>
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
              className={`nav-notification-link ${
                activePage === "notification" ? "is-active" : ""
              }`.trim()}
              href="/notifikasi"
              onClick={handleNavigate("/notifikasi")}
              title="Notifikasi"
            >
              <BellIcon />
              <strong aria-label="3 notifikasi belum dibaca">3</strong>
            </a>
            <a
              className={`avatar-chip ${activePage === "profile" ? "is-active" : ""}`.trim()}
              href="/profil"
              onClick={handleNavigate("/profil")}
            >
              <div className="avatar">NS</div>
              <span>Nicholas S.</span>
            </a>
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

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
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

function ChatIcon() {
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
        d="M7 8h10M7 12h6m-8 8 3.2-2.4c.35-.26.78-.4 1.22-.4H17a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v6.2A4 4 0 0 0 7 17h.2L5 20Z"
      />
    </svg>
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

export default Navbar;
