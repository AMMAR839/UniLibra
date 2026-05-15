import type { MouseEvent } from "react";

type FooterProps = {
  onNavigate?: (path: string) => void;
};

function Footer({ onNavigate }: FooterProps) {
  function handleNavigate(path: string) {
    return (event: MouseEvent<HTMLAnchorElement>) => {
      if (!onNavigate) {
        return;
      }

      event.preventDefault();
      onNavigate(path);
    };
  }

  return (
    <footer>
      <div className="footer-top">
        <div className="footer-brand">
          <span className="logo-text">UniLibra</span>
          <p>
            Platform pinjam buku fisik berbasis komunitas. Membaca lebih
            terjangkau, koleksi lebih termanfaatkan.
          </p>
        </div>

        <div className="footer-col">
          <h4>Hubungi Kami</h4>
          <ul>
            <li>
              <a href="#">Dinara&ndash;Tana</a>
            </li>
            <li>
              <a href="#">Katalog Privat</a>
            </li>
            <li>
              <a href="/kontak" onClick={handleNavigate("/kontak")}>
                Hubungi Kami
              </a>
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Karir</h4>
          <ul>
            <li>
              <a href="#">Lowongan</a>
            </li>
            <li>
              <a href="/katalog" onClick={handleNavigate("/katalog")}>
                Katalog Buku
              </a>
            </li>
            <li>
              <a href="#">Petunjuk Buku</a>
            </li>
          </ul>
        </div>

        <div className="footer-col">
          <h4>Kebijakan</h4>
          <ul>
            <li>
              <a href="#">Privasi</a>
            </li>
            <li>
              <a href="#">Blog</a>
            </li>
            <li>
              <a href="/kontak" onClick={handleNavigate("/kontak")}>
                Kontak
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>Hak Cipta &copy; 2026 UniLibra. Dibuat dengan &hearts; di Yogyakarta.</p>
        <div className="social-row">
          <a className="social-btn" href="https://facebook.com/unilibra.id" rel="noreferrer" target="_blank">
            f
          </a>
          <a className="social-btn" href="https://instagram.com/unilibra.id" rel="noreferrer" target="_blank">
            ig
          </a>
          <a className="social-btn" href="https://linkedin.com/company/unilibra" rel="noreferrer" target="_blank">
            in
          </a>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
