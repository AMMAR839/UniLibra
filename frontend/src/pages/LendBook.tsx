import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

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
  isbnBarcodePhoto: File | null;
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
  isbnBarcodePhoto: null,
  description: "",
  agreed: false,
};

function LendBookPage() {
  const [form, setForm] = useState<LendBookForm>(initialForm);
  const [submitted, setSubmitted] = useState(false);
  const [isIsbnCameraOpen, setIsIsbnCameraOpen] = useState(false);
  const [isbnCameraError, setIsbnCameraError] = useState("");
  const [isbnPreviewUrl, setIsbnPreviewUrl] = useState("");
  const isbnVideoRef = useRef<HTMLVideoElement | null>(null);
  const isbnCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isbnStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isIsbnCameraOpen || !isbnVideoRef.current || !isbnStreamRef.current) {
      return;
    }

    isbnVideoRef.current.srcObject = isbnStreamRef.current;
    void isbnVideoRef.current.play();
  }, [isIsbnCameraOpen]);

  useEffect(() => {
    return () => {
      isbnStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function handleReset() {
    closeIsbnCamera();
    setForm(initialForm);
    setSubmitted(false);
    setIsbnCameraError("");
    setIsbnPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return "";
    });
  }

  async function openIsbnCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsbnCameraError("Browser ini belum mendukung akses kamera langsung.");
      return;
    }

    setIsbnCameraError("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
        },
      });

      isbnStreamRef.current = stream;
      setIsIsbnCameraOpen(true);
    } catch {
      setIsbnCameraError(
        "Kamera tidak bisa dibuka. Pastikan izin kamera sudah diberikan.",
      );
    }
  }

  function closeIsbnCamera() {
    isbnStreamRef.current?.getTracks().forEach((track) => track.stop());
    isbnStreamRef.current = null;

    if (isbnVideoRef.current) {
      isbnVideoRef.current.srcObject = null;
    }

    setIsIsbnCameraOpen(false);
  }

  function captureIsbnBarcode() {
    const video = isbnVideoRef.current;
    const canvas = isbnCanvasRef.current;

    if (!video || !canvas) {
      setIsbnCameraError("Kamera belum siap. Coba buka ulang kamera.");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const context = canvas.getContext("2d");

    if (!context) {
      setIsbnCameraError("Foto barcode belum bisa diproses di browser ini.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(video, 0, 0, width, height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setIsbnCameraError("Foto barcode gagal diambil. Coba ulangi.");
          return;
        }

        const file = new File([blob], `isbn-barcode-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        const previewUrl = URL.createObjectURL(file);

        setForm((currentForm) => ({
          ...currentForm,
          isbnBarcodePhoto: file,
        }));
        setSubmitted(false);
        setIsbnPreviewUrl((currentUrl) => {
          if (currentUrl) {
            URL.revokeObjectURL(currentUrl);
          }

          return previewUrl;
        });
        closeIsbnCamera();
      },
      "image/jpeg",
      0.9,
    );
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
              Foto buku
              <input
                accept="image/png,image/jpeg,image/webp"
                name="bookPhoto"
                onChange={handleChange}
                type="file"
              />
            </label>

            <div className="lend-camera-field">
              <span>Foto barcode ISBN</span>
              <div className="lend-camera-box">
                {isIsbnCameraOpen ? (
                  <>
                    <video
                      className="lend-camera-preview"
                      muted
                      playsInline
                      ref={isbnVideoRef}
                    />
                    <div className="lend-camera-actions">
                      <button type="button" onClick={captureIsbnBarcode}>
                        Ambil Foto
                      </button>
                      <button type="button" onClick={closeIsbnCamera}>
                        Tutup Kamera
                      </button>
                    </div>
                  </>
                ) : isbnPreviewUrl ? (
                  <>
                    <img
                      alt="Hasil foto barcode ISBN"
                      className="lend-camera-preview"
                      src={isbnPreviewUrl}
                    />
                    <div className="lend-camera-actions">
                      <button type="button" onClick={openIsbnCamera}>
                        Foto Ulang Barcode
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    className="lend-camera-open"
                    type="button"
                    onClick={openIsbnCamera}
                  >
                    Buka Kamera Barcode ISBN
                  </button>
                )}
                <small>Barcode ISBN harus difoto langsung dari kamera.</small>
                {isbnCameraError ? (
                  <p className="lend-camera-error">{isbnCameraError}</p>
                ) : null}
                <canvas
                  aria-hidden="true"
                  className="lend-camera-canvas"
                  ref={isbnCanvasRef}
                />
              </div>
            </div>
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

          {submitted ? (
            <div className="lend-submit-note" role="status">
              Listing awal berhasil disimulasikan. Data buku dan foto yang kamu
              pilih sudah masuk ke form.
            </div>
          ) : null}

          <div className="lend-form-actions">
            <button className="btn-primary" type="submit">
              Kirim Listing Buku
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
