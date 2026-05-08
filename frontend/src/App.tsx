import { useEffect, useState } from "react";
import "./App.css";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import CatalogPage from "./pages/Catalog";
import HomePage from "./pages/Home";
import Login from "./pages/login";
import Register from "./pages/register";

type AppPage = "home" | "catalog" | "login" | "register";

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

  return (
    <>
      <Navbar
        activePage={page === "catalog" ? "catalog" : "home"}
        isLoggedIn={isLoggedIn}
        onLoginClick={openLogin}
        onNavigate={navigateTo}
      />

      {page === "catalog" ? (
        <CatalogPage />
      ) : (
        <HomePage onExploreCatalog={() => navigateTo("/katalog")} />
      )}

      <Footer />
    </>
  );
}

export default App;
