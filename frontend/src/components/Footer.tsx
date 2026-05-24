type FooterProps = {
  onNavigate?: (path: string) => void;
};

function Footer(_props: FooterProps) {
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
