import { useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import LoginCharacterArt from "../components/LoginCharacterArt";
import { API_URL, setToken } from "../lib/api";
import "../styles/login.css";

const GOOGLE_LOGIN_URL =
  import.meta.env.VITE_GOOGLE_LOGIN_URL || `${API_URL}/api/auth/google`;

type LoginProps = {
  onRegisterClick?: () => void;
};

export default function Login({ onRegisterClick }: LoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login gagal");
      }

      const data = await response.json();

      if (data.token) {
        setToken(data.token);
      }

      window.location.href = "/";
    } catch (error) {
      console.error(error);
      alert("Email atau password salah");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogleLogin() {
    window.location.href = GOOGLE_LOGIN_URL;
  }

  return (
    <main className="login-page">
      <section className="login-layout">
        <HeroLeft />
        <LoginRight
          email={email}
          password={password}
          remember={remember}
          loading={loading}
          setEmail={setEmail}
          setPassword={setPassword}
          setRemember={setRemember}
          onSubmit={handleSubmit}
          onGoogleLogin={handleGoogleLogin}
          onRegisterClick={onRegisterClick}
        />
      </section>
    </main>
  );
}

function HeroLeft() {
  return (
    <section className="login-visual" aria-label="Ilustrasi UniLibra">

      <motion.div
        className="login-visual-copy"
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <span>Komunitas Baca Indonesia</span>
        <h1>Masuk dan lanjutkan bacamu.</h1>
        <p>
          Simpan wishlist, kelola riwayat peminjaman, dan temukan koleksi buku
          terdekat dari satu akun.
        </p>
        <LoginCharacterArt />
      </motion.div>
    </section>
  );
}

function LoginRight({
  email,
  password,
  remember,
  loading,
  setEmail,
  setPassword,
  setRemember,
  onSubmit,
  onGoogleLogin,
  onRegisterClick,
}: {
  email: string;
  password: string;
  remember: boolean;
  loading: boolean;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setRemember: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onGoogleLogin: () => void;
  onRegisterClick?: () => void;
}) {
  return (
    <section className="login-panel-wrap">
      <motion.div
        className="login-panel"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
      >
        <span>Selamat datang SAHABAT</span>
        <h2>UniLibra</h2>

        <form className="login-form" onSubmit={onSubmit}>
          <InputField
            label="Email"
            type="email"
            placeholder="nama@email.com"
            autoComplete="email"
            value={email}
            onChange={setEmail}
          />

          <InputField
            label="Password"
            type="password"
            placeholder="Masukkan password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />

          <div className="login-options">
            <label>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Ingat saya
            </label>

            <a href="/login">Lupa password?</a>
          </div>

          <motion.button
            className="login-submit"
            whileHover={{ scale: 1.012, y: -1 }}
            whileTap={{ scale: 0.985 }}
            type="submit"
            disabled={loading}
          >
            {loading ? "Memproses..." : "Masuk Sekarang"}
          </motion.button>
        </form>

        <div className="login-separator">atau masuk dengan</div>

        <button
          className="google-login-btn"
          type="button"
          onClick={onGoogleLogin}
        >
          <GoogleIcon />
          Google
        </button>

        <p className="login-register">
          Belum punya akun?{" "}
          <a
            href="/register"
            onClick={(event) => {
              if (!onRegisterClick) {
                return;
              }

              event.preventDefault();
              onRegisterClick();
            }}
          >
            Daftar di sini
          </a>
        </p>
      </motion.div>
    </section>
  );
}

function InputField({
  label,
  type,
  placeholder,
  autoComplete,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="login-field">
      {label}
      <input
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        fill="#4285f4"
        d="M21.6 12.23c0-.8-.07-1.56-.2-2.3H12v4.35h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.89-1.74 2.98-4.31 2.98-7.58z"
      />
      <path
        fill="#34a853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.51c-.9.6-2.04.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.05v2.6A9.99 9.99 0 0 0 12 22z"
      />
      <path
        fill="#fbbc05"
        d="M6.4 13.9a6.01 6.01 0 0 1 0-3.8V7.5H3.05a10.01 10.01 0 0 0 0 9l3.35-2.6z"
      />
      <path
        fill="#ea4335"
        d="M12 5.98c1.47 0 2.78.5 3.82 1.5l2.87-2.87C16.95 2.99 14.69 2 12 2a9.99 9.99 0 0 0-8.95 5.5l3.35 2.6C7.19 7.74 9.4 5.98 12 5.98z"
      />
    </svg>
  );
}
