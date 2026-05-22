import { useEffect, useState } from "react";
import "./App.css";
import FloatingAIButton from "./components/FloatingAIButton";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import AIPage from "./pages/AIPage";
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
import { getToken, setToken } from "./lib/api";

type AppPage =
  | "home"
  | "catalog"
  | "lend"
  | "borrow"
  | "contact"
  | "notification"
  | "profile"
  | "admin"
  | "ai"
  | "login"
  | "register"
  | "auth-callback";

const protectedPages = new Set<AppPage>([
  "lend",
  "borrow",
  "notification",
  "profile",
  "admin",
]);

function pageFromPath(pathname: string): AppPage {
  if (pathname === "/login") {
    return "login";
  }

  if (pathname === "/register") {
    return "register";
  }

  if (pathname === "/auth/callback") {
    return "auth-callback";
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

  if (pathname === "/ai" || pathname === "/unibot") {
    return "ai";
  }

  return "home";
}

function App() {
  const [page, setPage] = useState<AppPage>(() =>
    pageFromPath(window.location.pathname),
  );
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getToken()));

  useEffect(() => {
    function syncPageWithUrl() {
      setPage(pageFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", syncPageWithUrl);
    window.addEventListener("unilibra:auth-changed", syncPageWithUrl);

    return () => {
      window.removeEventListener("popstate", syncPageWithUrl);
      window.removeEventListener("unilibra:auth-changed", syncPageWithUrl);
    };
  }, []);

  useEffect(() => {
    function syncAuth() {
      setIsLoggedIn(Boolean(getToken()));
    }

    window.addEventListener("storage", syncAuth);
    window.addEventListener("unilibra:auth-changed", syncAuth);

    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener("unilibra:auth-changed", syncAuth);
    };
  }, []);

  function navigateTo(target: string) {
    const nextUrl = new URL(target, window.location.origin);
    const nextPath = nextUrl.pathname;
    const nextSearch = nextUrl.search;
    const nextHash = nextUrl.hash;

    setPage(pageFromPath(nextPath));
    window.history.pushState({}, "", `${nextPath}${nextSearch}${nextHash}`);

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

  const aiButton = (
    <FloatingAIButton isActive={page === "ai"} onOpen={() => navigateTo("/ai")} />
  );

  if (page === "login") {
    return (
      <>
        <Login onRegisterClick={() => navigateTo("/register")} />
        {aiButton}
      </>
    );
  }

  if (page === "register") {
    return (
      <>
        <Register onLoginClick={() => navigateTo("/login")} />
        {aiButton}
      </>
    );
  }

  if (page === "auth-callback") {
    return (
      <>
        <OAuthCallback onDone={() => navigateTo("/")} />
        {aiButton}
      </>
    );
  }

  if (!isLoggedIn && protectedPages.has(page)) {
    return (
      <>
        <LoginRedirect onRedirect={openLogin} />
        {aiButton}
      </>
    );
  }

  if (page === "admin") {
    return (
      <>
        <AdminPage />
        {aiButton}
      </>
    );
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
          onBorrowBook={(bookID) => navigateTo(`/meminjam?book=${bookID}`)}
          onLendBook={() => navigateTo("/pinjamkan")}
        />
      ) : page === "lend" ? (
        <LendBookPage />
      ) : page === "borrow" ? (
        <BorrowBookPage
          onBackToCatalog={() => navigateTo("/katalog")}
          onBorrowBook={(bookID) => navigateTo(`/meminjam?book=${bookID}`)}
        />
      ) : page === "contact" ? (
        <ContactPage />
      ) : page === "notification" ? (
        <NotificationPage />
      ) : page === "profile" ? (
        <ProfilePage onBorrowBook={() => navigateTo("/katalog")} />
      ) : page === "ai" ? (
        <AIPage onBorrowBook={(bookID) => navigateTo(`/meminjam?book=${bookID}`)} />
      ) : (
        <HomePage
          onExploreCatalog={() => navigateTo("/katalog")}
          onBorrowBook={(bookID) => navigateTo(`/meminjam?book=${bookID}`)}
        />
      )}

      <Footer onNavigate={navigateTo} />
      {aiButton}
    </>
  );
}

export default App;

function LoginRedirect({ onRedirect }: { onRedirect: () => void }) {
  useEffect(() => {
    onRedirect();
  }, [onRedirect]);

  return (
    <main className="auth-callback-page">
      <p>Mengarahkan ke halaman masuk...</p>
    </main>
  );
}

function OAuthCallback({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (token) {
      setToken(token);
    }
    onDone();
  }, [onDone]);

  return (
    <main className="auth-callback-page">
      <p>Memproses login Google...</p>
    </main>
  );
}
