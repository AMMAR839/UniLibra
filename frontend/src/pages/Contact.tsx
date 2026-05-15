import { useState } from "react";

const supportPhone = "+62 812-3456-7890";
const whatsappNumber = "6281234567890";

const contactChannels = [
  {
    label: "Telepon",
    mark: "T",
    value: supportPhone,
    href: "tel:+6281234567890",
    tone: "contact-tone-dark",
  },
  {
    label: "WhatsApp",
    mark: "WA",
    value: "wa.me/6281234567890",
    href: `https://wa.me/${whatsappNumber}`,
    tone: "contact-tone-green",
  },
  {
    label: "Instagram",
    mark: "IG",
    value: "@unilibra.id",
    href: "https://instagram.com/unilibra.id",
    tone: "contact-tone-amber",
  },
  {
    label: "Facebook",
    mark: "FB",
    value: "UniLibra Indonesia",
    href: "https://facebook.com/unilibra.id",
    tone: "contact-tone-blue",
  },
  {
    label: "LinkedIn",
    mark: "IN",
    value: "UniLibra",
    href: "https://linkedin.com/company/unilibra",
    tone: "contact-tone-sage",
  },
];

const contactQuestions = [
  {
    question: "Bagaimana cara menghubungi UniLibra paling cepat?",
    answer:
      "Gunakan WhatsApp untuk pertanyaan cepat seputar akun, katalog buku, atau kendala peminjaman. Tim akan membalas sesuai jam operasional.",
  },
  {
    question: "Kalau ada masalah transaksi, harus lewat mana?",
    answer:
      "Kirim detail transaksi melalui WhatsApp atau telepon. Sertakan judul buku, nama pemilik atau peminjam, dan ringkasan masalahnya.",
  },
  {
    question: "Apakah bisa bekerja sama dengan komunitas kampus?",
    answer:
      "Bisa. Hubungi kami lewat LinkedIn atau WhatsApp agar tim bisa mencatat kebutuhan komunitas, lokasi, dan jenis koleksi yang ingin dikelola.",
  },
  {
    question: "Apakah kontak media sosial bisa dipakai untuk bantuan?",
    answer:
      "Instagram dan Facebook cocok untuk pertanyaan umum. Untuk kasus yang membutuhkan data akun atau transaksi, WhatsApp tetap lebih disarankan.",
  },
];

function ContactPage() {
  const [openQuestion, setOpenQuestion] = useState(0);

  return (
    <main className="contact-page">
      <section className="contact-shell">
        <div className="contact-hero">
          <div className="contact-head">
            <span>Kontak UniLibra</span>
            <h1>Pusat bantuan dan kontak resmi.</h1>
            <p>
              Pilih pertanyaan dasar di bawah, atau hubungi UniLibra langsung
              melalui nomor, WhatsApp, dan media sosial resmi.
            </p>
            <div className="contact-hero-actions">
              <a className="btn-primary" href={`https://wa.me/${whatsappNumber}`}>
                Hubungi WhatsApp
              </a>
              <a className="btn-ghost" href="tel:+6281234567890">
                Telepon
              </a>
            </div>
          </div>

          <aside className="contact-hero-card" aria-label="Jam layanan kontak">
            <span>Respon bantuan</span>
            <strong>09.00 - 21.00 WIB</strong>
            <p>WhatsApp menjadi jalur tercepat untuk bantuan akun dan transaksi.</p>
          </aside>
        </div>

        <section className="contact-layout" aria-label="Kontak dan bantuan">
          <div className="contact-faq">
            {contactQuestions.map((item, index) => (
              <article className="contact-question" key={item.question}>
                <button
                  aria-expanded={openQuestion === index}
                  onClick={() =>
                    setOpenQuestion(openQuestion === index ? -1 : index)
                  }
                  type="button"
                >
                  <span>{item.question}</span>
                  <strong aria-hidden="true">
                    {openQuestion === index ? "-" : "+"}
                  </strong>
                </button>
                {openQuestion === index ? <p>{item.answer}</p> : null}
              </article>
            ))}
          </div>

          <aside className="contact-panel" aria-label="Kontak yang bisa dihubungi">
            <div className="contact-panel-head">
              <span>Nomor utama</span>
              <a className="contact-phone" href="tel:+6281234567890">
                {supportPhone}
              </a>
              <p>Gunakan nomor ini untuk bantuan yang butuh respons langsung.</p>
            </div>

            <div className="contact-channel-list">
              {contactChannels.map((channel) => (
                <a
                  className={`contact-channel ${channel.tone}`}
                  href={channel.href}
                  key={channel.label}
                  rel="noreferrer"
                  target={channel.href.startsWith("http") ? "_blank" : undefined}
                >
                  <i aria-hidden="true">{channel.mark}</i>
                  <span>
                    {channel.label}
                    <strong>{channel.value}</strong>
                  </span>
                </a>
              ))}
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

export default ContactPage;
