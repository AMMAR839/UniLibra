import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";

type BorrowForm = {
  startDate: string;
  duration: string;
  handover: string;
  location: string;
  note: string;
};

type BorrowBookPageProps = {
  onBackToCatalog: () => void;
};

const initialBorrowForm: BorrowForm = {
  startDate: "2026-04-02",
  duration: "2 minggu",
  handover: "Ketemuan langsung",
  location: "Sekitar UGM / Sleman",
  note: "Halo kak, saya ingin pinjam buku ini untuk 2 minggu. Saya fleksibel untuk ketemu Kamis sore atau Jumat siang.",
};

const processSteps = [
  {
    title: "Request dikirim",
    text: "Data durasi, tanggal, dan catatanmu sudah terkirim ke pemilik buku.",
    active: true,
  },
  {
    title: "Pemilik meninjau request",
    text: "Pemilik akan mengecek ketersediaan, waktu kosong, dan menyepakati metode serah terima.",
    active: false,
  },
  {
    title: "Waktu & lokasi dikonfirmasi",
    text: "Kamu dan pemilik menyepakati detail pengambilan lewat chat.",
    active: false,
  },
  {
    title: "Buku dipinjam",
    text: "Status akan berubah jadi aktif, dan sistem bisa menampilkan tenggat pengembalian.",
    active: false,
  },
];

function BorrowBookPage({ onBackToCatalog }: BorrowBookPageProps) {
  const [form, setForm] = useState<BorrowForm>(initialBorrowForm);
  const [submitted, setSubmitted] = useState(false);

  const pricing = useMemo(() => {
    const rentalPrice =
      form.duration === "1 minggu" ? 7000 : form.duration === "1 bulan" ? 28000 : 14000;
    const serviceFee = 2000;

    return {
      rentalPrice,
      serviceFee,
      total: rentalPrice + serviceFee,
    };
  }, [form.duration]);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setForm((currentForm) => ({
      ...currentForm,
      [name]: value,
    }));

    if (submitted) {
      setSubmitted(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function openNavbarChat() {
    window.dispatchEvent(new Event("unilibra:open-chat"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="borrow-page">
      <section className="borrow-layout">
        <div className="borrow-main-column">
          <article className="borrow-book-card">
            <div className="borrow-cover">
              <span className="book-badge badge-available">Tersedia</span>
              <strong>Atomic Habits</strong>
            </div>

            <div className="borrow-book-detail">
              <div className="borrow-book-head">
                <div>
                  <h2>Atomic Habits</h2>
                  <p>James Clear</p>
                </div>
                <div className="borrow-price">
                  <span>Harga pinjam</span>
                  <strong>Rp 7.000</strong>
                </div>
              </div>

              <div className="borrow-meta-grid">
                <span>
                  <small>Kategori</small>
                  Pengembangan Diri
                </span>
                <span>
                  <small>Rating</small>
                  4.8 / 5.0
                </span>
                <span>
                  <small>Jarak</small>
                  1.5 km
                </span>
                <span>
                  <small>Kondisi</small>
                  Sangat baik
                </span>
              </div>

              <p className="borrow-description">
                Buku ini cocok untuk pembaca yang ingin membangun kebiasaan
                kecil tapi konsisten. Pemilik memperbolehkan highlight ringan
                dengan sticky note, namun tidak untuk tulisan langsung di
                halaman. Pengambilan bisa di area Sleman atau titik temu sekitar
                kampus.
              </p>

              <div className="borrow-owner-row">
                <div className="avatar">NS</div>
                <div>
                  <strong>Nicholas S.</strong>
                  <span>Pemilik buku - 34 transaksi - Respon cepat</span>
                </div>
                <button
                  className="btn-primary"
                  type="button"
                  onClick={openNavbarChat}
                >
                  Buka Chat
                </button>
              </div>
            </div>
          </article>

          <form className="borrow-request-card" onSubmit={handleSubmit}>
            <div className="borrow-card-head">
              <h2>Ajukan Peminjaman</h2>
              <p>
                Isi detail peminjamanmu. Setelah request dikirim, kamu bisa
                lanjut diskusi di chat untuk atur waktu ambil, titik temu, atau
                pertanyaan seputar kondisi buku.
              </p>
            </div>

            <div className="borrow-field-grid">
              <label>
                Tanggal mulai pinjam
                <input
                  name="startDate"
                  onChange={handleChange}
                  type="date"
                  value={form.startDate}
                />
              </label>
              <label>
                Durasi pinjam
                <select name="duration" onChange={handleChange} value={form.duration}>
                  <option value="1 minggu">1 minggu</option>
                  <option value="2 minggu">2 minggu</option>
                  <option value="1 bulan">1 bulan</option>
                </select>
              </label>
              <label>
                Metode serah terima
                <select name="handover" onChange={handleChange} value={form.handover}>
                  <option value="Ketemuan langsung">Ketemuan langsung</option>
                  <option value="Area kampus">Area kampus</option>
                  <option value="Kurir lokal">Kurir lokal</option>
                </select>
              </label>
              <label>
                Preferensi lokasi
                <input
                  name="location"
                  onChange={handleChange}
                  type="text"
                  value={form.location}
                />
              </label>
            </div>

            <label className="borrow-full-field">
              Catatan untuk pemilik
              <textarea
                name="note"
                onChange={handleChange}
                rows={5}
                value={form.note}
              />
            </label>

            <div className="borrow-summary-box">
              <span>
                Harga sewa
                <strong>{formatCurrency(pricing.rentalPrice)}</strong>
              </span>
              <span>
                Biaya layanan
                <strong>{formatCurrency(pricing.serviceFee)}</strong>
              </span>
              <span>
                Metode serah terima
                <strong>{form.handover}</strong>
              </span>
              <span className="borrow-total-row">
                Total estimasi
                <strong>{formatCurrency(pricing.total)}</strong>
              </span>
            </div>

            {submitted ? (
              <div className="borrow-submit-note" role="status">
                Request peminjaman berhasil disimulasikan dan siap dibahas lewat
                chat pemilik.
              </div>
            ) : null}

            <div className="borrow-form-actions">
              <button className="btn-search" type="submit">
                Ajukan Peminjaman
              </button>
              <button className="btn-ghost" type="button" onClick={onBackToCatalog}>
                Kembali ke Katalog
              </button>
            </div>
          </form>

          <section className="borrow-process-card">
            <div className="borrow-card-head">
              <h2>Status Proses Peminjaman</h2>
              <p>Setelah request dikirim, alurnya akan berjalan seperti ini.</p>
            </div>

            <ol className="borrow-process-list">
              {processSteps.map((step, index) => (
                <li className={step.active ? "is-active" : undefined} key={step.title}>
                  <span>{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </section>
    </main>
  );
}

function formatCurrency(value: number) {
  return `Rp ${value.toLocaleString("id-ID")}`;
}

export default BorrowBookPage;
