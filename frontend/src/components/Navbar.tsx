import type { MouseEvent } from "react";

type NavbarProps = {
  isLoggedIn: boolean;
  activePage?: "home" | "catalog";
  onLoginClick?: () => void;
  onNavigate?: (path: string) => void;
};

function Navbar({
  isLoggedIn,
  activePage = "home",
  onLoginClick,
  onNavigate,
}: NavbarProps) {
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
    <nav>
      <a href="/" className="nav-logo" onClick={handleNavigate("/")}>
        <div className="logo-mark"></div>
        <span className="logo-text">UniLibra</span>
      </a>

      <ul className="nav-links">
        <li>
          <a
            className={activePage === "home" ? "is-active" : undefined}
            href="/"
            onClick={handleNavigate("/")}
          >
            Beranda
          </a>
        </li>
        <li>
          <a
            className={activePage === "catalog" ? "is-active" : undefined}
            href="/katalog"
            onClick={handleNavigate("/katalog")}
          >
            Katalog Buku
          </a>
        </li>
        <li>
          <a href="/#pinjamkan" onClick={handleNavigate("/#pinjamkan")}>
            Pinjamkan Buku
          </a>
        </li>
        <li>
          <a href="/#tentang" onClick={handleNavigate("/#tentang")}>
            Tentang Kami
          </a>
        </li>
        <li>
          <a href="/#blog" onClick={handleNavigate("/#blog")}>
            Blog
          </a>
        </li>
        <li>
          <a href="/#kontak" onClick={handleNavigate("/#kontak")}>
            Kontak
          </a>
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
