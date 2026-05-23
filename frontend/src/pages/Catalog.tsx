import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { apiFetch, formatCurrency, mediaURL, type Book } from "../lib/api";
import { allBookThemes, bookCategories, themesForCategory } from "../lib/bookTaxonomy";

type CatalogPageProps = {
  onBorrowBook?: (bookID: number) => void;
  onLendBook?: () => void;
};

type SortMode = "latest" | "price_asc" | "price_desc" | "nearest";

function CatalogPage({ onBorrowBook, onLendBook }: CatalogPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [minDistanceFilter, setMinDistanceFilter] = useState("");
  const [maxDistanceFilter, setMaxDistanceFilter] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [popularBooks, setPopularBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "requesting" | "granted" | "denied" | "unsupported"
  >("idle");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setNotice("");
      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) {
          params.set("q", searchQuery.trim());
        }
        if (categoryFilter) {
          params.set("category", categoryFilter);
        }
        if (themeFilter) {
          params.set("theme", themeFilter);
        }
        if (minPriceFilter) {
          params.set("min_price", minPriceFilter);
        }
        if (maxPriceFilter) {
          params.set("max_price", maxPriceFilter);
        }
        if (minDistanceFilter) {
          params.set("min_distance", minDistanceFilter);
        }
        if (maxDistanceFilter) {
          params.set("max_distance", maxDistanceFilter);
        }
        if (sortMode !== "latest") {
          params.set("sort", sortMode);
        }
        if ((sortMode === "nearest" || minDistanceFilter || maxDistanceFilter) && userLocation) {
          params.set("latitude", String(userLocation.latitude));
          params.set("longitude", String(userLocation.longitude));
        }

        const queryString = params.toString();
        const response = await apiFetch<{ data: Book[] }>(
          `/api/books${queryString ? `?${queryString}` : ""}`,
          {
            auth: false,
            signal: controller.signal,
          },
        );
        setBooks(response.data);
      } catch (error) {
        if (!controller.signal.aborted) {
          setBooks([]);
          setNotice(error instanceof Error ? error.message : "Katalog belum bisa dimuat.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    categoryFilter,
    maxPriceFilter,
    minDistanceFilter,
    minPriceFilter,
    maxDistanceFilter,
    searchQuery,
    sortMode,
    themeFilter,
    userLocation,
  ]);

  useEffect(() => {
    apiFetch<{ popular_books?: Book[]; results?: Book[] }>("/api/ai/popular", {
      auth: false,
    })
      .then((response) => setPopularBooks(response.popular_books ?? response.results ?? []))
      .catch(() => setPopularBooks([]));
  }, []);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
  }

  function handleNearestSort() {
    if (sortMode === "nearest") {
      setSortMode("latest");
      return;
    }

    requestLocation(true);
  }

  function requestLocation(enableNearest: boolean) {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      setNotice("Browser belum mendukung akses lokasi.");
      return;
    }

    setLocationStatus("requesting");
    setNotice("Mengambil lokasi untuk mengurutkan buku terdekat...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (enableNearest) {
          setSortMode("nearest");
        }
        setLocationStatus("granted");
        setNotice("");
      },
      () => {
        setLocationStatus("denied");
        setNotice("Lokasi belum diizinkan. Aktifkan izin lokasi untuk filter terdekat.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter("");
    setThemeFilter("");
    setMinPriceFilter("");
    setMaxPriceFilter("");
    setMinDistanceFilter("");
    setMaxDistanceFilter("");
    setSortMode("latest");
    setUserLocation(null);
    setLocationStatus("idle");
    setNotice("");
  }

  const hasActiveFilters =
    searchQuery.trim() ||
    categoryFilter ||
    themeFilter ||
    minPriceFilter ||
    maxPriceFilter ||
    minDistanceFilter ||
    maxDistanceFilter ||
    sortMode !== "latest";

  const needsLocation = sortMode === "nearest" || minDistanceFilter || maxDistanceFilter;
  const visibleThemeOptions = categoryFilter
    ? themesForCategory(categoryFilter)
    : allBookThemes();

  function updateCategoryFilter(category: string) {
    setCategoryFilter(category);
    const nextThemes = themesForCategory(category) as readonly string[];
    if (themeFilter && category && !nextThemes.includes(themeFilter)) {
      setThemeFilter("");
    }
  }

  return (
    <main className="catalog-page">
      <section className="books-section catalog-books-section" id="catalog-books">
        <div className="catalog-section-header">
          <div>
            <span className="section-number">Katalog Buku</span>
            <h2 className="section-title">Pilih Buku yang Mau Dipinjam</h2>
          </div>
          <div className="catalog-section-meta">
            <span>{books.length} buku cocok</span>
            <a href="#catalog-books" className="section-link">
              Lihat semua
              <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="catalog-search-filter-wrap">
          <label className="catalog-inline-search">
            <SearchIcon />
            <input
              onChange={handleSearchChange}
              placeholder="Cari judul, penulis, kategori, atau tema buku..."
              type="search"
              value={searchQuery}
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery("")}>
                Bersihkan
              </button>
            ) : null}
          </label>

          <div className="catalog-filter-menu">
            <button
              className={hasActiveFilters ? "catalog-filter-toggle is-active" : "catalog-filter-toggle"}
              type="button"
              onClick={() => setFilterOpen((current) => !current)}
              aria-expanded={filterOpen}
            >
              <FilterIcon />
              Filter
            </button>

            {filterOpen ? (
              <div className="catalog-filter-panel" aria-label="Filter katalog buku">
                <label>
                  Kategori
                  <select
                    onChange={(event) => updateCategoryFilter(event.target.value)}
                    value={categoryFilter}
                  >
                    <option value="">Semua kategori</option>
                    {bookCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Tema
                  <select
                    onChange={(event) => setThemeFilter(event.target.value)}
                    value={themeFilter}
                  >
                    <option value="">
                      {categoryFilter ? "Semua tema kategori ini" : "Semua tema"}
                    </option>
                    {visibleThemeOptions.map((theme) => (
                      <option key={theme} value={theme}>
                        {theme}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="catalog-price-range">
                  <span>Rentang jarak dari kamu</span>
                  <label>
                    Minimal KM
                    <input
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setMinDistanceFilter(event.target.value)}
                      placeholder="0"
                      type="number"
                      value={minDistanceFilter}
                    />
                  </label>
                  <label>
                    Maksimal KM
                    <input
                      inputMode="decimal"
                      min="0"
                      onChange={(event) => setMaxDistanceFilter(event.target.value)}
                      placeholder="10"
                      type="number"
                      value={maxDistanceFilter}
                    />
                  </label>
                  {needsLocation && !userLocation ? (
                    <button
                      className="catalog-location-button"
                      type="button"
                      onClick={() => requestLocation(false)}
                    >
                      <PinIcon />
                      {locationStatus === "requesting"
                        ? "Meminta lokasi..."
                        : locationStatus === "denied"
                          ? "Izinkan ulang"
                          : "Izinkan lokasi"}
                    </button>
                  ) : null}
                  {userLocation ? (
                    <span className="catalog-location-note">Lokasi aktif</span>
                  ) : null}
                </div>

                <div className="catalog-price-range">
                  <span>Rentang harga / minggu</span>
                  <label>
                    Minimal
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setMinPriceFilter(event.target.value)}
                      placeholder="0"
                      type="number"
                      value={minPriceFilter}
                    />
                  </label>
                  <label>
                    Maksimal
                    <input
                      inputMode="numeric"
                      min="0"
                      onChange={(event) => setMaxPriceFilter(event.target.value)}
                      placeholder="25000"
                      type="number"
                      value={maxPriceFilter}
                    />
                  </label>
                </div>

                <label>
                  Urutkan
                  <select
                    onChange={(event) => setSortMode(event.target.value as SortMode)}
                    value={sortMode}
                  >
                    <option value="latest">Terbaru</option>
                    <option value="price_asc">Harga termurah</option>
                    <option value="price_desc">Harga tertinggi</option>
                  </select>
                </label>

                <div className="catalog-filter-actions">
                  <button
                    className={sortMode === "nearest" ? "is-active" : undefined}
                    type="button"
                    onClick={handleNearestSort}
                  >
                    <PinIcon />
                    Terdekat
                  </button>

                  {hasActiveFilters ? (
                    <button type="button" onClick={clearFilters}>
                      Reset
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="book-grid catalog-book-grid">
          {books.map((book) => (
            <BookCard book={book} key={book.id} onBorrowBook={onBorrowBook} />
          ))}
        </div>

        {loading ? <div className="catalog-empty-state">Memuat katalog...</div> : null}
        {notice ? <div className="catalog-empty-state">{notice}</div> : null}
        {!loading && books.length === 0 ? (
          <div className="catalog-empty-state">
            Tidak ada buku yang cocok dengan pencarianmu.
          </div>
        ) : null}
      </section>

      {popularBooks.length > 0 && !hasActiveFilters ? (
        <section className="books-section catalog-books-section">
          <div className="catalog-section-header">
            <div>
              <span className="section-number">Rekomendasi AI</span>
              <h2 className="section-title">Buku yang Banyak Dilirik</h2>
            </div>
          </div>
          <div className="book-grid catalog-book-grid">
            {popularBooks.slice(0, 4).map((book) => (
              <BookCard book={book} key={`popular-${book.id}`} onBorrowBook={onBorrowBook} />
            ))}
          </div>
        </section>
      ) : null}

      <div className="banner-strip catalog-banner">
        <div>
          <div className="banner-title">Punya buku yang jarang dibaca?</div>
          <p className="banner-sub">
            Daftarkan koleksimu dan bantu pembaca lain menemukan buku yang
            mereka butuhkan tanpa harus membeli baru.
          </p>
        </div>
        <button className="btn-banner" type="button" onClick={onLendBook}>
          Pinjamkan Bukumu
          <ArrowIcon />
        </button>
      </div>
    </main>
  );
}

function BookCard({
  book,
  onBorrowBook,
}: {
  book: Book;
  onBorrowBook?: (bookID: number) => void;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onBorrowBook?.(book.id);
    }
  }

  return (
    <article
      aria-label={`Pinjam buku ${book.title}`}
      className="book-card catalog-book-card"
      onClick={() => onBorrowBook?.(book.id)}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
    >
      <div className="book-cover-wrap">
        {book.cover_url ? (
          <img
            className="book-cover-img bc-photo"
            src={mediaURL(book.cover_url)}
            alt={book.title}
          />
        ) : (
          <div className="book-cover-img bc-5">{book.title}</div>
        )}
        <span className="book-badge badge-available">Tersedia</span>
      </div>
      <div className="book-body">
        <span className="catalog-book-genre">{book.category || "Katalog"}</span>
        <span className="catalog-book-theme">{book.theme || "Tema umum"}</span>
        <div className="book-title">{book.title}</div>
        <div className="book-author">{book.author}</div>
        <div className="book-meta">
          <div className="book-rating">
            <StarIcon />
            {book.owner?.name || "Pemilik"}
          </div>
          <div className="book-dist">
            <PinIcon />
            {book.location || "Lokasi belum diisi"}
          </div>
        </div>
      </div>
      <div className="book-footer">
        <div className="book-price">
          <strong>{formatCurrency(book.rental_price)}</strong> / minggu
        </div>
      </div>
    </article>
  );
}

function ArrowIcon() {
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
        d="M17 8l4 4m0 0l-4 4m4-4H3"
      />
    </svg>
  );
}

function SearchIcon() {
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
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
      />
    </svg>
  );
}

function FilterIcon() {
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
        d="M4 6h16M7 12h10M10 18h4"
      />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m12 2.6 2.86 5.8 6.4.93-4.63 4.51 1.1 6.37L12 17.2l-5.73 3.01 1.1-6.37-4.63-4.51 6.4-.93L12 2.6Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      aria-hidden="true"
      width="13"
      height="13"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11Z"
      />
      <circle cx="12" cy="10" r="2" />
    </svg>
  );
}

export default CatalogPage;
