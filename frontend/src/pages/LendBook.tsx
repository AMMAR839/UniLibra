import { useState, type ChangeEvent, type FormEvent } from "react";
import { apiFetch } from "../lib/api";

type LendBookForm = {
  title: string;
  author: string;
  category: string;
  condition: string;
  price: string;
  location: string;
  duration: string;
  handover: string;
  bookPhoto: File | null;
  description: string;
  agreed: boolean;
};

const initialForm: LendBookForm = {
  title: "",
  author: "",
  category: "",
  condition: "",
  price: "",
  location: "",
  duration: "",
  handover: "",
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
    payload.set("condition", form.condition);
    payload.set("location", form.location);
    payload.set("max_duration", form.duration);
    payload.set("handover", form.handover);
    payload.set("description", form.description);
    payload.set("rental_price", form.price || "0");
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
                <option value="Akademik">Akademik</option>
                <option value="Sastra">Sastra</option>
                <option value="Nonfiksi">Nonfiksi</option>
                <option value="Pengembangan diri">Pengembangan diri</option>
                <option value="Fiksi populer">Fiksi populer</option>
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
              Lokasi
              <input
                name="location"
                onChange={handleChange}
                placeholder="Contoh: Sleman, Yogyakarta"
                type="text"
                value={form.location}
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

export default LendBookPage;
