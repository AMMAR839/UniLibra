import { useEffect, useState } from "react";
import type { ChangeEvent, KeyboardEvent } from "react";
import { apiFetch, formatCurrency, mediaURL, type Book, type CatalogBook } from "../lib/api";
import { allBookThemes, bookCategories, themesForCategory } from "../lib/bookTaxonomy";

type CatalogPageProps = {
  onBorrowBook?: (bookID: number) => void;
  onSelectBookVersions?: (book: CatalogBook) => void;
  onLendBook?: () => void;
};

type SortMode = "latest" | "price_asc" | "price_desc" | "nearest";
type ChoiceFilter = "" | "2" | "3";
type LocationFilter = "" | "located";
type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "unsupported";

function CatalogPage({ onBorrowBook, onSelectBookVersions, onLendBook }: CatalogPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");
  const [minPriceFilter, setMinPriceFilter] = useState("");
  const [maxPriceFilter, setMaxPriceFilter] = useState("");
  const [minDistanceFilter, setMinDistanceFilter] = useState("");
  const [maxDistanceFilter, setMaxDistanceFilter] = useState("");
  const [choiceFilter, setChoiceFilter] = useState<ChoiceFilter>("");
  const [locationFilter, setLocationFilter] = useState<LocationFilter>("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [books, setBooks] = useState<CatalogBook[]>([]);
  const [popularBooks, setPopularBooks] = useState<CatalogBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");

  useEffect(() => {
    requestLocation(false);
  }, []);

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
        if (choiceFilter) {
          params.set("min_choices", choiceFilter);
        }
        if (locationFilter === "located") {
          params.set("located_only", "true");
        }
        if (sortMode !== "latest") {
          params.set("sort", sortMode);
        }
        if (userLocation) {
          params.set("latitude", String(userLocation.latitude));
          params.set("longitude", String(userLocation.longitude));
        }

        const queryString = params.toString();
        const response = await apiFetch<{ data: RawCatalogBook[] }>(
          `/api/books${queryString ? `?${queryString}` : ""}`,
          {
            auth: false,
            signal: controller.signal,
          },
        );
        setBooks(dedupeCatalogBooks(response.data.map((book) => toCatalogBook(book, userLocation))));
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
    choiceFilter,
    locationFilter,
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
      .then((response) =>
        setPopularBooks(
          dedupeCatalogBooks(
            (response.popular_books ?? response.results ?? []).map((book) =>
              toCatalogBook(book, userLocation),
            ),
          ),
        ),
      )
      .catch(() => setPopularBooks([]));
  }, [userLocation]);

  function handleSearchChange(event: ChangeEvent<HTMLInputElement>) {
    setSearchQuery(event.target.value);
  }

  function handleNearestSort() {
    if (sortMode === "nearest") {
      setSortMode("latest");
      return;
    }

    if (!userLocation) {
      setLocationNotice(
        "Lokasi belum diizinkan. Katalog tetap bisa digunakan, tetapi estimasi jarak dan filter terdekat tidak aktif.",
      );
    }
    requestLocation(true);
  }

  function requestLocation(enableNearest: boolean) {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      setLocationNotice(
        "Browser belum mendukung akses lokasi. Gunakan filter harga, kategori, atau pencarian judul.",
      );
      setSortMode("latest");
      return;
    }

    setLocationStatus("requesting");
    setLocationNotice("Mengambil lokasi untuk menampilkan estimasi jarak buku...");
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
        setLocationNotice("");
      },
      () => {
        setLocationStatus("denied");
        setSortMode("latest");
        setMinDistanceFilter("");
        setMaxDistanceFilter("");
        setLocationFilter("");
        setLocationNotice(
          "Lokasi belum diizinkan. Katalog tetap bisa digunakan, tetapi estimasi jarak dan filter terdekat tidak aktif.",
        );
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
    setChoiceFilter("");
    setLocationFilter("");
    setSortMode("latest");
    setUserLocation(null);
    setLocationStatus("idle");
    setNotice("");
    setLocationNotice("");
  }

  const hasActiveFilters =
    searchQuery.trim() ||
    categoryFilter ||
    themeFilter ||
    minPriceFilter ||
    maxPriceFilter ||
    minDistanceFilter ||
    maxDistanceFilter ||
    choiceFilter ||
    locationFilter ||
    sortMode !== "latest";

  const needsLocation = sortMode === "nearest" || minDistanceFilter || maxDistanceFilter;
  const distanceFilterDisabled = !userLocation || locationStatus === "unsupported";
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

        {locationNotice ? (
          <div className="catalog-location-alert">
            <div>
              <strong>{locationNotice}</strong>
              {locationStatus === "denied" ? (
                <span>
                  Aktifkan izin lokasi dari pengaturan browser, lalu muat ulang
                  atau tekan Coba Izinkan Lagi.
                </span>
              ) : null}
            </div>
            {locationStatus !== "unsupported" ? (
              <button type="button" onClick={() => requestLocation(false)}>
                {locationStatus === "requesting" ? "Meminta lokasi..." : "Coba Izinkan Lagi"}
              </button>
            ) : null}
          </div>
        ) : null}

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
                      disabled={distanceFilterDisabled}
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
                      disabled={distanceFilterDisabled}
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
                      disabled={locationStatus === "unsupported"}
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

                <label>
                  Jumlah pilihan
                  <select
                    onChange={(event) => setChoiceFilter(event.target.value as ChoiceFilter)}
                    value={choiceFilter}
                  >
                    <option value="">Semua pilihan</option>
                    <option value="2">2+ pilihan</option>
                    <option value="3">3+ pilihan</option>
                  </select>
                </label>

                <label>
                  Ketersediaan lokasi
                  <select
                    disabled={distanceFilterDisabled}
                    onChange={(event) => setLocationFilter(event.target.value as LocationFilter)}
                    value={locationFilter}
                  >
                    <option value="">Semua buku</option>
                    <option value="located">Punya estimasi jarak</option>
                  </select>
                </label>

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
                    <option disabled={distanceFilterDisabled} value="nearest">
                      Terdekat
                    </option>
                  </select>
                </label>

                <div className="catalog-filter-actions">
                  <button
                    className={sortMode === "nearest" ? "is-active" : undefined}
                    disabled={distanceFilterDisabled}
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
            <BookCard
              book={book}
              key={book.id}
              locationStatus={locationStatus}
              onBorrowBook={onBorrowBook}
              onSelectBookVersions={onSelectBookVersions}
            />
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
              <BookCard
                book={book}
                key={`popular-${book.id}`}
                locationStatus={locationStatus}
                onBorrowBook={onBorrowBook}
                onSelectBookVersions={onSelectBookVersions}
              />
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
  locationStatus,
  onBorrowBook,
  onSelectBookVersions,
}: {
  book: CatalogBook;
  locationStatus: LocationStatus;
  onBorrowBook?: (bookID: number) => void;
  onSelectBookVersions?: (book: CatalogBook) => void;
}) {
  function openBookVersions() {
    if (onSelectBookVersions) {
      onSelectBookVersions(book);
      return;
    }

    onBorrowBook?.(book.id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openBookVersions();
    }
  }

  return (
    <article
      aria-label={`Pinjam buku ${book.title}`}
      className="book-card catalog-book-card"
      onClick={openBookVersions}
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
          <div className="book-dist">
            <PinIcon />
            Jarak: {formatDistanceRange(book, locationStatus)}
          </div>
        </div>
      </div>
      <div className="book-footer">
        <div className="book-price">
          <strong>{formatPriceRange(book)}</strong> / minggu
        </div>
      </div>
    </article>
  );
}

type RawCatalogBook = Partial<CatalogBook> & Partial<Book>;

function toCatalogBook(
  book: RawCatalogBook,
  userLocation: { latitude: number; longitude: number } | null,
): CatalogBook {
  const fallbackPrice = finiteNumber(book.rental_price) ?? 0;
  const minPrice = finiteNumber(book.min_price) ?? fallbackPrice;
  const maxPrice = finiteNumber(book.max_price) ?? minPrice;
  const fallbackDistance = distanceFromUserLocation(book, userLocation);

  return {
    id: book.id ?? 0,
    title: book.title ?? "Buku tanpa judul",
    author: book.author ?? "Penulis belum diisi",
    category: book.category,
    theme: book.theme,
    cover_url: book.cover_url,
    available_count: Math.max(1, Math.round(finiteNumber(book.available_count) ?? 1)),
    min_price: minPrice,
    max_price: finiteNumber(book.max_price) ?? maxPrice,
    min_distance_km: finiteNumber(book.min_distance_km) ?? fallbackDistance,
    max_distance_km: finiteNumber(book.max_distance_km) ?? fallbackDistance,
    updated_at: book.updated_at ?? new Date(0).toISOString(),
  };
}

function dedupeCatalogBooks(items: CatalogBook[]) {
  const groups = new Map<string, CatalogBook>();

  for (const item of items) {
    const key = normalizeBookTitleKey(item.title) || `book-${item.id}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, { ...item });
      continue;
    }

    current.available_count += Math.max(1, item.available_count);
    current.min_price = Math.min(current.min_price, item.min_price);
    current.max_price = Math.max(current.max_price, item.max_price);

    const itemMinDistance = finiteNumber(item.min_distance_km);
    const currentMinDistance = finiteNumber(current.min_distance_km);
    if (itemMinDistance !== undefined) {
      current.min_distance_km =
        currentMinDistance !== undefined
          ? Math.min(currentMinDistance, itemMinDistance)
          : itemMinDistance;
    }
    const itemMaxDistance = finiteNumber(item.max_distance_km);
    const currentMaxDistance = finiteNumber(current.max_distance_km);
    if (itemMaxDistance !== undefined) {
      current.max_distance_km =
        currentMaxDistance !== undefined
          ? Math.max(currentMaxDistance, itemMaxDistance)
          : itemMaxDistance;
    }

    if (new Date(item.updated_at).getTime() > new Date(current.updated_at).getTime()) {
      current.id = item.id;
      current.author = item.author;
      current.category = item.category;
      current.theme = item.theme;
      current.cover_url = item.cover_url || current.cover_url;
      current.updated_at = item.updated_at;
    } else if (!current.cover_url && item.cover_url) {
      current.cover_url = item.cover_url;
    }
  }

  return Array.from(groups.values());
}

function normalizeBookTitleKey(title: string) {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatPriceRange(book: CatalogBook) {
  const minPrice = finiteNumber(book.min_price);
  const maxPrice = finiteNumber(book.max_price) ?? minPrice;

  if (minPrice === undefined) {
    return "Harga belum tersedia";
  }

  if (maxPrice === undefined || Math.round(minPrice) === Math.round(maxPrice)) {
    return formatCurrency(minPrice);
  }

  return `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`;
}

function formatDistanceRange(book: CatalogBook, locationStatus: LocationStatus) {
  if (locationStatus === "idle" || locationStatus === "denied") {
    return "Aktifkan lokasi";
  }
  if (locationStatus === "requesting") {
    return "Menghitung jarak";
  }
  const minDistanceValue = finiteNumber(book.min_distance_km);
  const maxDistanceValue = finiteNumber(book.max_distance_km);

  if (minDistanceValue === undefined || maxDistanceValue === undefined) {
    return "Pemilik belum mengisi titik lokasi";
  }

  const minDistance = Math.round(minDistanceValue);
  const maxDistance = Math.round(maxDistanceValue);
  if (minDistance === maxDistance) {
    return `${minDistance} km`;
  }

  return `${minDistance} - ${maxDistance} km`;
}

function finiteNumber(value: unknown) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function distanceFromUserLocation(
  book: RawCatalogBook,
  userLocation: { latitude: number; longitude: number } | null,
) {
  if (!userLocation) {
    return undefined;
  }

  const bookLatitude = finiteNumber(book.latitude);
  const bookLongitude = finiteNumber(book.longitude);
  if (bookLatitude === undefined || bookLongitude === undefined) {
    return fallbackDistanceKM(book);
  }
  if (bookLatitude === 0 || bookLongitude === 0) {
    return fallbackDistanceKM(book);
  }

  return haversineKM(userLocation.latitude, userLocation.longitude, bookLatitude, bookLongitude);
}

function fallbackDistanceKM(book: RawCatalogBook) {
  const numericID = finiteNumber(book.id);
  const seed =
    numericID && numericID > 0
      ? numericID
      : normalizeBookTitleKey(book.title ?? "")
          .split("")
          .reduce((total, char) => total + char.charCodeAt(0), 0);

  return 1.5 + (seed % 80) / 10;
}

function haversineKM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKM = 6371;
  const latDelta = degreesToRadians(lat2 - lat1);
  const lonDelta = degreesToRadians(lon2 - lon1);
  const firstLat = degreesToRadians(lat1);
  const secondLat = degreesToRadians(lat2);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(firstLat) *
      Math.cos(secondLat) *
      Math.sin(lonDelta / 2) *
      Math.sin(lonDelta / 2);

  return earthRadiusKM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
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
