export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export type User = {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin" | string;
  status: string;
  city?: string;
  phone_number?: string;
};

export type Book = {
  id: number;
  title: string;
  author: string;
  description: string;
  category?: string;
  theme?: string;
  condition?: string;
  location?: string;
  max_duration?: string;
  handover?: string;
  owner_id: number;
  owner?: User;
  rental_price: number;
  latitude?: number;
  longitude?: number;
  status: string;
  cover_url?: string;
  average_rating?: number;
  rating_count?: number;
  created_at: string;
  updated_at: string;
};

export type CatalogBook = {
  id: number;
  title: string;
  author: string;
  category?: string;
  theme?: string;
  cover_url?: string;
  available_count: number;
  min_price: number;
  max_price: number;
  min_distance_km?: number;
  max_distance_km?: number;
  updated_at: string;
};

export type Transaction = {
  id: number;
  book_id: number;
  book?: Book;
  borrower_id: number;
  borrower?: User;
  borrow_date: string;
  expected_return_date: string;
  handover?: string;
  location?: string;
  note?: string;
  status: string;
  total_price: number;
  created_at: string;
};

export type Notification = {
  id: number;
  user_id: number;
  type: string;
  title: string;
  body: string;
  link?: string;
  read_at?: string | null;
  created_at: string;
};

export type ChatThread = {
  id: number;
  book_id?: number | null;
  book?: Book | null;
  created_by_id: number;
  created_by?: User;
  recipient_id: number;
  recipient?: User;
  last_message_at?: string | null;
  created_at: string;
};

export type ChatMessage = {
  id: number;
  thread_id: number;
  sender_id: number;
  sender?: User;
  body: string;
  created_at: string;
};

export type AdminSummary = {
  users: number;
  books: number;
  available_books: number;
  active_transactions: number;
  completed_transactions: number;
};

type ApiOptions = RequestInit & {
  auth?: boolean;
};

export function getToken() {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
  window.dispatchEvent(new Event("unilibra:auth-changed"));
}

export function clearToken() {
  localStorage.removeItem("token");
  window.dispatchEvent(new Event("unilibra:auth-changed"));
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}) {
  const headers = new Headers(options.headers);
  const token = getToken();
  const bodyIsFormData = options.body instanceof FormData;

  if (!bodyIsFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && options.auth !== false) {
      clearToken();
    }

    throw new Error(payload?.error || "Permintaan ke server gagal.");
  }

  return payload as T;
}

export function mediaURL(value?: string) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return `${API_URL}${value.startsWith("/") ? "" : "/"}${value}`;
}

export function realtimeURL() {
  const explicitURL = import.meta.env.VITE_WS_URL as string | undefined;
  if (explicitURL) {
    return explicitURL;
  }

  return `${API_URL.replace(/^http/, "ws")}/api/realtime`;
}

export function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
  }).format(new Date(value));
}

export function initials(name?: string) {
  if (!name) {
    return "UL";
  }

  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
