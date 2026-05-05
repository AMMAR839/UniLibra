type NavbarProps = {
  isLoggedIn: boolean;
  onLoginClick?: () => void;
};

function Navbar({ isLoggedIn, onLoginClick }: NavbarProps) {
  return (
    <nav>
      <a href="#" className="nav-logo">
        <div className="logo-mark"></div>
        <span className="logo-text">UniLibra</span>
      </a>

      <ul className="nav-links">
        <li>
          <a href="#">Beranda</a>
        </li>
        <li>
          <a href="#">Katalog Buku</a>
        </li>
        <li>
          <a href="#">Pinjamkan Buku</a>
        </li>
        <li>
          <a href="#">Tentang Kami</a>
        </li>
        <li>
          <a href="#">Blog</a>
        </li>
        <li>
          <a href="#">Kontak</a>
        </li>
      </ul>

      <div className="nav-actions">
        {isLoggedIn ? (
          <div className="avatar-chip">
            <div className="avatar">NS</div>
            <span>Nicholas S.</span>
          </div>
        ) : (
          <button className="btn-ghost" type="button" onClick={onLoginClick}>
            Masuk / Daftar
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar;
