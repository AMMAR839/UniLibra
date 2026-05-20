import { useEffect, useState } from "react";
import "./App.css";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import AdminPage from "./pages/Admin";
import BorrowBookPage from "./pages/BorrowBook";
import CatalogPage from "./pages/Catalog";
import ContactPage from "./pages/Contact";
import HomePage from "./pages/Home";
import LendBookPage from "./pages/LendBook";
import Login from "./pages/login";
import NotificationPage from "./pages/Notification";
import ProfilePage from "./pages/Profile";
import Register from "./pages/register";

type AppPage =
  | "home"
  | "catalog"
  | "lend"
  | "borrow"
  | "contact"
  | "notification"
  | "profile"
  | "admin"
  | "login"
  | "register";

function pageFromPath(pathname: string): AppPage {
  if (pathname === "/login") {
    return "login";
  }

  if (pathname === "/register") {
    return "register";
  }

  if (pathname === "/katalog" || pathname === "/catalog") {
    return "catalog";
  }

  if (pathname === "/pinjamkan") {
    return "lend";
  }

  if (pathname === "/meminjam" || pathname === "/pinjam-buku") {
    return "borrow";
  }

  if (pathname === "/riwayat" || pathname === "/history") {
    return "profile";
  }

  if (pathname === "/kontak" || pathname === "/contact") {
    return "contact";
  }

  if (
    pathname === "/notifikasi" ||
    pathname === "/notification" ||
    pathname === "/notifications"
  ) {
    return "notification";
  }

  if (pathname === "/profil" || pathname === "/profile") {
    return "profile";
  }

  if (pathname === "/admin") {
    return "admin";
  }

  return "home";
}

function App() {
  const [page, setPage] = useState<AppPage>(() =>
    pageFromPath(window.location.pathname),
  );
  const isLoggedIn = Boolean(localStorage.getItem("token"));

  useEffect(() => {
    function syncPageWithUrl() {
      setPage(pageFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", syncPageWithUrl);

    return () => window.removeEventListener("popstate", syncPageWithUrl);
  }, []);

  function navigateTo(target: string) {
    const nextUrl = new URL(target, window.location.origin);
    const nextPath = nextUrl.pathname;
    const nextHash = nextUrl.hash;

    setPage(pageFromPath(nextPath));
    window.history.pushState({}, "", `${nextPath}${nextHash}`);

    window.setTimeout(() => {
      if (nextHash) {
        document.querySelector(nextHash)?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 0);
  }

  function openLogin() {
    navigateTo("/login");
  }

  if (page === "login") {
    return <Login onRegisterClick={() => navigateTo("/register")} />;
  }

  if (page === "register") {
    return <Register onLoginClick={() => navigateTo("/login")} />;
  }

  if (page === "admin") {
    return <AdminPage />;
  }

  return (
    <>
      <Navbar
        activePage={
          page === "catalog" || page === "borrow"
            ? "catalog"
            : page === "lend"
              ? "lend"
              : page === "contact"
                ? "contact"
                : page === "notification"
                  ? "notification"
                  : page === "profile"
                    ? "profile"
                    : "home"
        }
        isLoggedIn={isLoggedIn}
        onLoginClick={openLogin}
        onNavigate={navigateTo}
      />

      {page === "catalog" ? (
        <CatalogPage
          onBorrowBook={() => navigateTo("/meminjam")}
          onLendBook={() => navigateTo("/pinjamkan")}
        />
      ) : page === "lend" ? (
        <LendBookPage />
      ) : page === "borrow" ? (
        <BorrowBookPage onBackToCatalog={() => navigateTo("/katalog")} />
      ) : page === "contact" ? (
        <ContactPage />
      ) : page === "notification" ? (
        <NotificationPage />
      ) : page === "profile" ? (
        <ProfilePage onBorrowBook={() => navigateTo("/meminjam")} />
      ) : (
        <HomePage onExploreCatalog={() => navigateTo("/katalog")} />
      )}

      <Footer onNavigate={navigateTo} />
    </>
  );
}

export default App;
