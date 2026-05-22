import { useMemo, useState } from "react";
import { apiFetch, formatCurrency, mediaURL, type Book } from "../lib/api";

type AIPageProps = {
  onBorrowBook: (bookID: number) => void;
};

type ChatBook = Book & {
  distance_km?: number | null;
};

type AIChatResponse = {
  jawaban: string;
  buku_referensi?: ChatBook[];
  engine?: string;
};

type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  books?: ChatBook[];
};

type Coordinates = {
  latitude: number;
  longitude: number;
};

const suggestions = [
  "Buku Tere Liye masih ada?",
  "Buku yang cocok dan dekat dengan saya",
  "Rekomendasi novel Indonesia yang ringan",
  "Ada buku pemrograman yang tersedia?",
];

function AIPage({ onBorrowBook }: AIPageProps) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [notice, setNotice] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const canSend = useMemo(() => message.trim().length > 0 && !isSending, [message, isSending]);
  const hasConversation = messages.length > 0;

  async function useCurrentLocation() {
    if (!navigator.geolocation) {
      setNotice("Browser belum mendukung akses lokasi.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setNotice("Lokasi aktif. AI akan memprioritaskan buku terdekat.");
        setIsLocating(false);
      },
      () => {
        setNotice("Izin lokasi belum diberikan.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function askAI(prompt = message) {
    const text = prompt.trim();
    if (!text || isSending) {
      return;
    }

    setMessage("");
    setNotice("");
    setIsSending(true);
    setMessages((current) => [...current, { id: Date.now(), role: "user", text }]);

    try {
      const response = await apiFetch<AIChatResponse>("/api/ai/chat", {
        method: "POST",
        auth: false,
        body: JSON.stringify({
          pesan: text,
          latitude: coordinates?.latitude,
          longitude: coordinates?.longitude,
        }),
      });

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: response.jawaban,
          books: response.buku_referensi?.slice(0, 4) ?? [],
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: error instanceof Error ? error.message : "AI UniLibra belum bisa menjawab.",
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <main className={`ai-page ${hasConversation ? "has-conversation" : ""}`}>
      <section className="ai-stage" aria-label="AI UniLibra">
        <div className="ai-brand">
          <span className="ai-brand-mark">
            <img alt="" src="/robot-assistant.png" />
          </span>
          <span>AI UniLibra</span>
        </div>

        <div className="ai-center">
          <h1>Tanyakan buku apa saja.</h1>
          <p>
            Cari buku tersedia, tanya penulis, minta rekomendasi, atau aktifkan lokasi
            untuk menemukan buku yang paling dekat.
          </p>
        </div>

        {hasConversation ? (
          <div className="ai-conversation" aria-live="polite">
            {messages.map((item) => (
              <article className={`ai-message is-${item.role}`} key={item.id}>
                <p>{item.text}</p>
                {item.books?.length ? (
                  <div className="ai-result-list">
                    {item.books.map((book) => (
                      <button
                        className="ai-result"
                        key={book.id}
                        onClick={() => onBorrowBook(book.id)}
                        type="button"
                      >
                        <span className="ai-result-cover">
                          {book.cover_url ? <img alt="" src={mediaURL(book.cover_url)} /> : null}
                        </span>
                        <span className="ai-result-copy">
                          <strong>{cleanTitle(book.title)}</strong>
                          <small>
                            {book.author} | {book.location || "Lokasi belum diisi"}
                            {typeof book.distance_km === "number"
                              ? ` | ${book.distance_km} km`
                              : ""}
                          </small>
                          <b>{formatCurrency(book.rental_price)} / minggu</b>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : null}

        <div className="ai-suggestions" aria-label="Contoh pertanyaan AI">
          {suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => void askAI(suggestion)} type="button">
              {suggestion}
            </button>
          ))}
        </div>

        {notice ? <p className="ai-notice">{notice}</p> : null}

        <div className="ai-prompt-shell">
          <button
            aria-label="Gunakan lokasi saya"
            className={`ai-icon-button ${coordinates ? "is-active" : ""}`.trim()}
            disabled={isLocating}
            onClick={() => void useCurrentLocation()}
            type="button"
          >
            <LocationIcon />
          </button>
          <input
            aria-label="Tulis pertanyaan untuk AI UniLibra"
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void askAI();
              }
            }}
            placeholder="Minta AI UniLibra..."
            type="text"
            value={message}
          />
          <button
            aria-label="Kirim pertanyaan"
            className="ai-send-button"
            disabled={!canSend}
            onClick={() => void askAI()}
            type="button"
          >
            <SendIcon />
          </button>
        </div>
      </section>
    </main>
  );
}

function cleanTitle(title: string) {
  return title.replace(/^\[DEMO\]\s*/i, "");
}

function LocationIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.1 7-11a7 7 0 1 0-14 0c0 5.9 7 11 7 11Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 12 14-7-4 14-3-6-7-1Z" />
    </svg>
  );
}

export default AIPage;
