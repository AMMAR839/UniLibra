import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { motion } from "framer-motion";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

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
        localStorage.setItem("token", data.token);
      }

      window.location.href = "/";
    } catch (error) {
      console.error(error);
      alert("Email atau password salah");
    } finally {
      setLoading(false);
    }
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
        />
      </section>
    </main>
  );
}

function HeroLeft() {
  return (
    <section className="login-hero">
      <div className="login-character" aria-hidden="true">
        <span className="character-base" />
        <span className="character-book" />
        <span className="character-book two" />
        <span className="character-book three" />
      </div>

      <motion.div
        className="login-hero-content"
        initial={{ opacity: 0, x: -28 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
      >
        <div className="login-eyebrow">Komunitas Baca Indonesia</div>
        <h1>
          Masuk dan
          <br />
          lanjutkan
          <br />
          <em>petualangan</em>
          <br />
          bacamu.
        </h1>

        <p>
          Akses koleksi buku terdekat, simpan wishlist, kelola riwayat
          peminjaman, dan temukan rekomendasi yang terasa personal.
        </p>

        <div className="login-pills">
          <Pill>12.400+ buku tersedia</Pill>
          <Pill>3.200+ peminjam aktif</Pill>
          <Pill>Aman & mudah digunakan</Pill>
        </div>

        <div className="login-metrics">
          <Metric value="4.8/5" label="Rata-rata ulasan" />
          <Metric value="94%" label="Tepat waktu" />
          <Metric value="17 kota" label="Komunitas aktif" />
        </div>
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
}: {
  email: string;
  password: string;
  remember: boolean;
  loading: boolean;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setRemember: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="login-panel-wrap">
      <motion.div
        className="login-panel"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
      >
        <span>Welcome Back</span>
        <h2>Login ke UniLibra</h2>
        <p>Masuk untuk mulai meminjam, mengelola koleksi, dan melihat aktivitas bacamu.</p>

        <div className="social-login-row">
          <button type="button">Google</button>
          <button type="button">Apple</button>
        </div>

        <div className="login-separator">atau gunakan email</div>

        <form className="login-form" onSubmit={onSubmit}>
          <InputField
            label="Email"
            type="email"
            placeholder="nama@email.com"
            value={email}
            onChange={setEmail}
          />

          <InputField
            label="Password"
            type="password"
            placeholder="Masukkan password"
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

        <p className="login-register">
          Belum punya akun? <a href="/register">Daftar di sini</a>
        </p>
      </motion.div>
    </section>
  );
}

function InputField({
  label,
  type,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="login-field">
      {label}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </label>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span>{children}</span>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
