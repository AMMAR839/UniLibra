import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import "./App.css";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import Login from "./pages/login";

type AppPage = "home" | "login";

function App() {
  const [page, setPage] = useState<AppPage>(() =>
    window.location.pathname === "/login" ? "login" : "home",
  );
  const isLoggedIn = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    function syncPageWithUrl() {
      setPage(window.location.pathname === "/login" ? "login" : "home");
    }

    window.addEventListener("popstate", syncPageWithUrl);

    return () => window.removeEventListener("popstate", syncPageWithUrl);
  }, []);

  function openLogin() {
    setPage("login");
    window.history.pushState({}, "", "/login");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (page === "login") {
    return <Login />;
  }

  return (
    <>
      <Navbar isLoggedIn={isLoggedIn} onLoginClick={openLogin} />

      <section className="hero">
        <div className="hero-content">
          <div className="hero-eyebrow">Komunitas Baca Indonesia</div>
          <h1 className="hero-title">
            Pinjam Buku
            <br />
            di <em>Sekitarmu</em>
            <br />
            &mdash; Murah & Mudah
          </h1>
          <p className="hero-sub">
            Temukan koleksi buku tetanggamu dan bagikan koleksimu. Membaca jadi
            lebih terjangkau untuk semua.
          </p>
          <div className="hero-cta">
            <button className="btn-primary" type="button">
              Mulai Meminjam
              <ArrowIcon />
            </button>
            <div className="hero-stat">
              <div>
                <strong>12.400+</strong>
                <br />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Buku tersedia
                </span>
              </div>
              <div
                style={{
                  width: "1px",
                  height: "32px",
                  background: "var(--border)",
                }}
              />
              <div>
                <strong>3.200+</strong>
                <br />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  Peminjam aktif
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="floating-card">
            <img
              className="cover-placeholder"
              src="image.png"
              alt="Laskar Pelangi"
              style={{ objectFit: "cover", borderRadius: "4px" }}
            />
            <div className="card-info">
              <div className="card-title">Laskar Pelangi</div>
              <div className="card-meta">Andrea Hirata</div>
              <span className="card-tag tag-amber">Fiksi</span>
            </div>
            <div className="card-dist">1.2 km</div>
          </div>

          <div className="floating-card">
            <img
              className="cover-placeholder"
              src="2.png"
              alt="Atomic Habits"
              style={{ objectFit: "cover", borderRadius: "4px" }}
            />
            <div className="card-info">
              <div className="card-title">Atomic Habits</div>
              <div className="card-meta">James Clear</div>
              <span className="card-tag tag-green">Tersedia</span>
            </div>
            <div className="card-dist">1.5 km</div>
          </div>

          <div className="floating-card">
            <div className="cover-placeholder cover-c">Sapiens</div>
            <div className="card-info">
              <div className="card-title">Sapiens</div>
              <div className="card-meta">Yuval Noah Harari</div>
              <span className="card-tag tag-amber">Populer</span>
            </div>
            <div className="card-dist">1.5 km</div>
          </div>
        </div>
      </section>

      <section className="search-section">
        <div className="search-container">
          <div className="search-input-wrap">
            <SearchIcon size={18} />
            <input
              className="search-input"
              type="text"
              placeholder="Cari judul, penulis, genre, atau lokasi..."
            />
          </div>
          <button className="btn-search" type="button">
            <SearchIcon size={16} />
            Cari
          </button>
        </div>
      </section>

      <section className="books-section">
        <div className="section-header">
          <div className="section-label">
            <span className="section-number">01 &mdash;</span>
            <h2 className="section-title">Rekomendasi di Sekitarmu</h2>
          </div>
          <a href="#" className="section-link">
            Lihat semua &rarr;
          </a>
        </div>

        <div className="book-grid">
          <BookCard
            coverClass="bc-1"
            cover={
              <>
                Laskar
                <br />
                Pelangi
              </>
            }
            badge="Tersedia"
            badgeClass="badge-available"
            title="Laskar Pelangi"
            author="Andrea Hirata"
            rating="4.9"
            distance="1.8 km"
            price="Rp 7.000"
          />

          <BookCard
            coverClass="bc-2"
            cover={
              <>
                Atomic
                <br />
                Habits
              </>
            }
            badge="Populer"
            badgeClass="badge-popular"
            title="Atomic Habits"
            author="James Clear"
            rating="4.8"
            distance="1.5 km"
            price="Rp 7.000"
          />

          <BookCard
            coverClass="bc-3"
            cover="Sapiens"
            badge="Tersedia"
            badgeClass="badge-available"
            title="Sapiens"
            author="Yuval Noah Harari"
            rating="4.7"
            distance="1.5 km"
            price="Rp 7.000"
          />

          <BookCard
            coverClass="bc-4"
            cover={
              <>
                Matematika
                <br />
                Teknik
              </>
            }
            badge="Tersedia"
            badgeClass="badge-available"
            title="Matematika Teknik"
            author="Smeed"
            rating="4.2"
            distance="1.5 km"
            price="Rp 7.000"
          />

          <BookCard
            coverClass="bc-5"
            cover={
              <>
                Bumi
                <br />
                Manusia
              </>
            }
            badge="Populer"
            badgeClass="badge-popular"
            title="Bumi Manusia"
            author="Pramoedya Ananta Toer"
            rating="4.9"
            distance="1 Casan"
            price="Rp 1.000"
          />

          <BookCard
            coverClass="bc-6"
            cover={
              <>
                Ronggeng
                <br />
                Dukuh Peruk
              </>
            }
            badge="Tersedia"
            badgeClass="badge-available"
            title="Ronggeng Dukuh Peruk"
            author="Ahmad Tohari"
            rating="4.6"
            distance="1.8 km"
            price="Rp 7.000"
          />
        </div>
      </section>

      <div className="banner-strip">
        <div>
          <div className="banner-title">Punya buku yang jarang dibaca?</div>
          <p className="banner-sub">
            Daftarkan koleksimu dan mulai menghasilkan dari buku yang
            mengumpulkan debu di rak. Bergabung dengan 3.200+ peminjam aktif di
            Yogyakarta.
          </p>
        </div>
        <button className="btn-banner" type="button">
          Pinjamkan Bukumu &rarr;
        </button>
      </div>

      <Footer />
    </>
  );
}

function BookCard({
  coverClass,
  cover,
  badge,
  badgeClass,
  title,
  author,
  rating,
  distance,
  price,
}: {
  coverClass: string;
  cover: ReactNode;
  badge: string;
  badgeClass: string;
  title: string;
  author: string;
  rating: string;
  distance: string;
  price: string;
}) {
  return (
    <div className="book-card">
      <div className="book-cover-wrap">
        <div className={`book-cover-img ${coverClass}`}>{cover}</div>
        <span className={`book-badge ${badgeClass}`}>{badge}</span>
      </div>
      <div className="book-body">
        <div className="book-title">{title}</div>
        <div className="book-author">{author}</div>
        <div className="book-meta">
          <div className="book-rating">
            <span className="star">&#9733;</span> {rating}
          </div>
          <div className="book-dist">&#128205; {distance}</div>
        </div>
      </div>
      <div className="book-footer">
        <div className="book-price">
          <strong>{price}</strong> / minggu
        </div>
        <button className="btn-pinjam" type="button">
          Pinjam Sekarang
        </button>
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg
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
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  );
}

function SearchIcon({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
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

export default App;
