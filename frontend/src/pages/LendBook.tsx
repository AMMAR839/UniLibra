import { useState, type ChangeEvent, type FormEvent } from "react";
import { apiFetch } from "../lib/api";
import { bookCategories, themesForCategory } from "../lib/bookTaxonomy";

type LendBookForm = {
  title: string;
  author: string;
  category: string;
  theme: string;
  condition: string;
  price: string;
  location: string;
  duration: string;
  handover: string;
  latitude: string;
  longitude: string;
  mapsUrl: string;
  bookPhoto: File | null;
  description: string;
  agreed: boolean;
};

const initialForm: LendBookForm = {
  title: "",
  author: "",
  category: "",
  theme: "",
  condition: "",
  price: "",
  location: "",
  duration: "",
  handover: "",
  latitude: "",
  longitude: "",
  mapsUrl: "",
  bookPhoto: null,
  description: "",
  agreed: false,
};

function LendBookPage() {
  const [form, setForm] = useState<LendBookForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    let nextValue: string | boolean | File | null = value;

    if (event.target instanceof HTMLInputElement) {
      if (event.target.type === "checkbox") {
        nextValue = event.target.checked;
      }

      if (event.target.type === "file") {
        nextValue = event.target.files?.[0] ?? null;
      }
    }

    setForm((currentForm) => ({
      ...currentForm,
      [name]: nextValue,
      ...(name === "category" ? { theme: "" } : {}),
    }));

    if (submitted) {
      setSubmitted(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage("");

    const payload = new FormData();
    payload.set("title", form.title);
    payload.set("author", form.author);
    payload.set("category", form.category);
    payload.set("theme", form.theme);
    payload.set("condition", form.condition);
    payload.set("location", form.location);
    payload.set("max_duration", form.duration);
    payload.set("handover", form.handover);
    payload.set("description", form.description);
    payload.set("rental_price", form.price || "0");
    payload.set("latitude", form.latitude);
    payload.set("longitude", form.longitude);
    if (form.bookPhoto) {
      payload.set("cover", form.bookPhoto);
    }

    try {
      await apiFetch("/api/books", {
        method: "POST",
        body: payload,
      });
      setSubmitted(true);
      setSubmitMessage("Listing buku berhasil dikirim ke katalog.");
    } catch (error) {
      setSubmitMessage(
        error instanceof Error ? error.message : "Listing buku belum bisa dikirim.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setForm(initialForm);
    setSubmitted(false);
    setSubmitMessage("");
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setSubmitMessage("Browser belum mendukung akses lokasi.");
      return;
    }

    setSubmitMessage("Mengambil lokasi buku...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        setForm((currentForm) => ({
          ...currentForm,
          latitude: String(latitude),
          longitude: String(longitude),
          location: currentForm.location || `Mencari alamat (${latitude}, ${longitude})...`,
          mapsUrl: googleMapsURL(latitude, longitude),
        }));
        setSubmitMessage("Koordinat tersimpan. Mencari alamat otomatis...");
        void fillAddressFromCoordinates(latitude, longitude);
      },
      () => {
        setSubmitMessage("Lokasi belum diizinkan. Kamu tetap bisa mengirim listing tanpa filter jarak.");
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  const themeOptions = themesForCategory(form.category);

  async function fillAddressFromCoordinates(latitude: number, longitude: number) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            "Accept-Language": "id,en",
          },
        },
      );
      if (!response.ok) {
        throw new Error("Reverse geocode gagal");
      }

      const data = (await response.json()) as { display_name?: string };
      const address = data.display_name?.trim();
      if (!address) {
        throw new Error("Alamat kosong");
      }

      setForm((currentForm) => ({
        ...currentForm,
        location: address,
      }));
      setSubmitMessage("Lokasi dan alamat otomatis berhasil diisi.");
    } catch {
      setForm((currentForm) => ({
        ...currentForm,
        location:
          currentForm.location && !currentForm.location.startsWith("Mencari alamat")
            ? currentForm.location
            : `Koordinat ${latitude}, ${longitude}`,
      }));
      setSubmitMessage("Koordinat berhasil diisi. Alamat otomatis belum tersedia, isi alamat manual bila perlu.");
    }
  }

  function handleMapsUrlChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setForm((currentForm) => ({
      ...currentForm,
      mapsUrl: value,
    }));
  }

  async function useMapsLinkLocation() {
    let coordinates = parseMapsCoordinates(form.mapsUrl);
    if (!coordinates) {
      try {
        setSubmitMessage("Membuka short link Maps lewat backend...");
        const response = await apiFetch<{
          latitude: number;
          longitude: number;
        }>(`/api/maps/resolve?url=${encodeURIComponent(form.mapsUrl)}`, {
          auth: false,
        });
        coordinates = {
          latitude: Number(response.latitude.toFixed(6)),
          longitude: Number(response.longitude.toFixed(6)),
        };
      } catch (error) {
        setSubmitMessage(
          error instanceof Error
            ? error.message
            : "Link Google Maps belum memuat koordinat yang bisa dibaca.",
        );
        return;
      }
    }

    if (!coordinates) {
      setSubmitMessage("Link Google Maps belum memuat koordinat yang bisa dibaca.");
      return;
    }

    setForm((currentForm) => ({
      ...currentForm,
      latitude: String(coordinates.latitude),
      longitude: String(coordinates.longitude),
      location:
        currentForm.location ||
        `Mencari alamat (${coordinates.latitude}, ${coordinates.longitude})...`,
    }));
    setSubmitMessage("Koordinat dari link Maps berhasil dibaca. Mencari alamat otomatis...");
    void fillAddressFromCoordinates(coordinates.latitude, coordinates.longitude);
  }

  return (
    <main className="lend-page">
      <section className="lend-section lend-form-layout" id="form-pinjamkan">
        <form className="lend-form-card" onSubmit={handleSubmit}>
          <div className="lend-card-head">
            <span className="section-number">Pinjamkan Buku</span>
            <h2>Data Listing Buku</h2>
            <p>
              Isi informasi utama agar listing buku terlihat jelas, rapi, dan
              mudah dipahami calon peminjam.
            </p>
          </div>

          <div className="lend-field-grid">
            <label>
              Judul buku
              <input
                name="title"
                onChange={handleChange}
                placeholder="Contoh: Filosofi Teras"
                type="text"
                value={form.title}
              />
            </label>
            <label>
              Penulis
              <input
                name="author"
                onChange={handleChange}
                placeholder="Contoh: Henry Manampiring"
                type="text"
                value={form.author}
              />
            </label>
            <label>
              Kategori
              <select name="category" onChange={handleChange} value={form.category}>
                <option value="">Pilih kategori</option>
                {bookCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Kondisi buku
              <select
                name="condition"
                onChange={handleChange}
                value={form.condition}
              >
                <option value="">Pilih kondisi</option>
                <option value="Seperti baru">Seperti baru</option>
                <option value="Baik">Baik</option>
                <option value="Cukup baik">Cukup baik</option>
                <option value="Ada catatan">Ada catatan</option>
              </select>
            </label>
            <label>
              Tema
              <select
                disabled={!form.category}
                name="theme"
                onChange={handleChange}
                value={form.theme}
              >
                <option value="">
                  {form.category ? "Pilih tema" : "Pilih kategori dulu"}
                </option>
                {themeOptions.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Harga pinjam / minggu
              <input
                name="price"
                onChange={handleChange}
                placeholder="Contoh: 7000"
                type="text"
                value={form.price}
              />
            </label>
            <label>
              Durasi maksimum
              <select name="duration" onChange={handleChange} value={form.duration}>
                <option value="">Pilih durasi</option>
                <option value="1 minggu">1 minggu</option>
                <option value="2 minggu">2 minggu</option>
                <option value="1 bulan">1 bulan</option>
              </select>
            </label>
            <label>
              Metode serah terima
              <select name="handover" onChange={handleChange} value={form.handover}>
                <option value="">Pilih metode</option>
                <option value="Titik temu publik">Titik temu publik</option>
                <option value="Area kampus">Area kampus</option>
                <option value="Kurir lokal">Kurir lokal</option>
              </select>
            </label>
          </div>

          <div className="lend-location-fields" aria-label="Lokasi buku">
            <label className="lend-location-address">
              Alamat
              <input
                name="location"
                onChange={handleChange}
                placeholder="Contoh: Perpustakaan kampus, Sleman, Yogyakarta"
                type="text"
                value={form.location}
              />
            </label>

            <div className="lend-location-bottom">
              <div className="lend-coordinate-grid">
                <label>
                  Latitude
                  <input
                    name="latitude"
                    onChange={handleChange}
                    placeholder="-7.771"
                    type="number"
                    value={form.latitude}
                  />
                </label>
                <label>
                  Longitude
                  <input
                    name="longitude"
                    onChange={handleChange}
                    placeholder="110.377"
                    type="number"
                    value={form.longitude}
                  />
                </label>
              </div>
              <div className="lend-location-action-row">
                <button className="lend-map-action" type="button" onClick={useCurrentLocation}>
                  Ambil lokasi
                </button>
              </div>
              <label className="lend-maps-link-field">
                Link Google Maps
                <div className="lend-maps-link-bar">
                  <input
                    name="mapsUrl"
                    onChange={handleMapsUrlChange}
                    placeholder="Tempel link lokasi buku dari Google Maps"
                    type="url"
                    value={form.mapsUrl}
                  />
                  <button type="button" onClick={useMapsLinkLocation}>
                    Ambil dari link
                  </button>
                </div>
              </label>
            </div>
          </div>

          <div className="lend-upload-grid">
            <label>
              Cover buku
              <input
                accept="image/png,image/jpeg,image/webp"
                name="bookPhoto"
                onChange={handleChange}
                type="file"
              />
            </label>
          </div>

          <label className="lend-full-field">
            Deskripsi buku
            <textarea
              name="description"
              onChange={handleChange}
              placeholder="Tulis ringkasan singkat, kondisi fisik, atau aturan tambahan untuk peminjam."
              rows={5}
              value={form.description}
            />
          </label>

          <label className="lend-checkbox">
            <input
              checked={form.agreed}
              name="agreed"
              onChange={handleChange}
              type="checkbox"
            />
            <span>
              Saya setuju bahwa informasi buku yang saya kirimkan akan
              ditampilkan sebagai listing dan saya siap mengelola permintaan
              peminjaman secara aktif.
            </span>
          </label>

          {submitMessage ? (
            <div className="lend-submit-note" role="status">
              {submitMessage}
            </div>
          ) : null}

          <div className="lend-form-actions">
            <button className="btn-primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Mengirim..." : "Kirim Listing Buku"}
            </button>
            <button className="btn-ghost" type="reset" onClick={handleReset}>
              Reset Form
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function googleMapsURL(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

function parseMapsCoordinates(value: string) {
  const directCoordinates =
    value.match(/@(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/) ||
    value.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/) ||
    value.match(/(?:[?&](?:q|query|ll)=|\/maps\/search\/)(-?\d+(?:\.\d+)?),\s*\+?(-?\d+(?:\.\d+)?)/);
  if (!directCoordinates) {
    return null;
  }

  const latitude = Number(directCoordinates[1]);
  const longitude = Number(directCoordinates[2]);
  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
  };
}

export default LendBookPage;
