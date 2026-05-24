import { useState } from "react";

const supportPhone = "+62 812-3456-7890";
const whatsappNumber = "6281234567890";

const contactChannels = [
  {
    label: "Telepon",
    icon: "phone",
    value: supportPhone,
    note: "Respons cepat",
    href: "tel:+6281234567890",
    tone: "contact-tone-dark",
  },
  {
    label: "WhatsApp",
    icon: "whatsapp",
    value: "wa.me/6281234567890",
    note: "Paling disarankan",
    href: `https://wa.me/${whatsappNumber}`,
    tone: "contact-tone-green",
  },
  {
    label: "Instagram",
    icon: "instagram",
    value: "@unilibra.id",
    note: "Info umum",
    href: "https://instagram.com/unilibra.id",
    tone: "contact-tone-amber",
  },
  {
    label: "Facebook",
    icon: "facebook",
    value: "UniLibra Indonesia",
    note: "Komunitas",
    href: "https://facebook.com/unilibra.id",
    tone: "contact-tone-blue",
  },
  {
    label: "LinkedIn",
    icon: "linkedin",
    value: "UniLibra",
    note: "Kerja sama",
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
        <header className="contact-simple-head">
          <span>Kontak</span>
          <h1>Hubungi UniLibra</h1>
          <strong>09.00 - 21.00 WIB</strong>
        </header>

        <section className="contact-channel-grid" aria-label="Kanal kontak UniLibra">
          {contactChannels.map((channel) => (
            <a
              className={`contact-channel ${channel.tone}`}
              href={channel.href}
              key={channel.label}
              rel="noreferrer"
              target={channel.href.startsWith("http") ? "_blank" : undefined}
            >
              <i aria-hidden="true">
                <ContactIcon name={channel.icon} />
              </i>
              <span>
                {channel.label}
                <strong>{channel.value}</strong>
                <small>{channel.note}</small>
              </span>
            </a>
          ))}
        </section>

        <section className="contact-layout" aria-label="Kontak dan bantuan">
          <div className="contact-faq" aria-label="Pertanyaan umum">
            <div className="contact-section-head">
              <span>Pertanyaan umum</span>
              <h2>Sebelum menghubungi kami</h2>
            </div>
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
        </section>
      </section>
    </main>
  );
}

function ContactIcon({ name }: { name: string }) {
  switch (name) {
    case "phone":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6.6 10.8c1.7 3.3 3.3 4.9 6.6 6.6l2.2-2.2c.3-.3.8-.4 1.2-.3 1.3.4 2.6.6 4 .6.7 0 1.2.5 1.2 1.2v3.5c0 .7-.5 1.2-1.2 1.2C10.3 22 2 13.7 2 3.4 2 2.7 2.5 2.2 3.2 2.2h3.6c.7 0 1.2.5 1.2 1.2 0 1.4.2 2.7.6 4 .1.4 0 .9-.3 1.2l-1.7 2.2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M5.2 19.1 6 16.2A8 8 0 1 1 9 19l-3.8.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9.2 8.7c.2-.5.4-.5.7-.5h.5c.2 0 .4.1.5.4l.7 1.6c.1.3.1.5-.1.7l-.4.5c.6 1 1.4 1.8 2.5 2.4l.6-.5c.2-.2.4-.2.7-.1l1.5.7c.3.1.4.3.4.6v.4c0 .4-.2.7-.5.9-.6.4-1.4.5-2.4.2-2.5-.7-5-3.1-5.8-5.6-.3-.8-.2-1.4.1-1.7Z" fill="currentColor" />
        </svg>
      );
    case "instagram":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="4" y="4" width="16" height="16" rx="5" stroke="currentColor" strokeWidth="1.8" />
          <path d="M15.5 11.7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z" stroke="currentColor" strokeWidth="1.8" />
          <path d="M16.8 7.4h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M14 8.3h2.1V4.7c-.4-.1-1.6-.2-3-.2-3 0-5 1.8-5 5.2v3H4.8v4h3.3V22h4.1v-5.3h3.2l.5-4h-3.7v-2.6c0-1.1.3-1.8 1.8-1.8Z" fill="currentColor" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M6.5 9.2H3.3V20h3.2V9.2ZM4.9 7.7a1.8 1.8 0 1 0 0-3.7 1.8 1.8 0 0 0 0 3.7ZM20.7 20h-3.2v-5.2c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20h-3.2V9.2h3.1v1.5h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.2 3.9 5V20Z" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

export default ContactPage;
