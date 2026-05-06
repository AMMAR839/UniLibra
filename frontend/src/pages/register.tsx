import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import LoginCharacterArt from "../components/LoginCharacterArt";
import "../styles/register.css";

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  city: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
};

const initialForm: RegisterForm = {
  firstName: "",
  lastName: "",
  email: "",
  city: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

const VISUAL_SLIDE_SECONDS = 0.92;
const REGISTER_FORM_DELAY_SECONDS = VISUAL_SLIDE_SECONDS + 0.1;
const VISUAL_LOGIN_START_X = "-85.2%";

type RegisterProps = {
  onLoginClick?: () => void;
};

export default function Register({ onLoginClick }: RegisterProps) {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [visualMode, setVisualMode] = useState<"login" | "register">("login");
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(
      () => setVisualMode("register"),
      prefersReducedMotion ? 0 : VISUAL_SLIDE_SECONDS * 1000,
    );

    return () => window.clearTimeout(timer);
  }, [prefersReducedMotion]);

  function updateForm<Key extends keyof RegisterForm>(
    key: Key,
    value: RegisterForm[Key],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      alert("Konfirmasi password belum sama");
      return;
    }

    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      alert("Akun berhasil disiapkan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="register-page">
      <section className="register-layout">
        <RegisterFormPanel
          form={form}
          loading={loading}
          updateForm={updateForm}
          onSubmit={handleSubmit}
          onLoginClick={onLoginClick}
          reducedMotion={prefersReducedMotion}
        />
        <RegisterVisual mode={visualMode} reducedMotion={prefersReducedMotion} />
        <LoginFormGhost reducedMotion={prefersReducedMotion} />
      </section>
    </main>
  );
}

function RegisterFormPanel({
  form,
  loading,
  updateForm,
  onSubmit,
  onLoginClick,
  reducedMotion,
}: {
  form: RegisterForm;
  loading: boolean;
  updateForm: <Key extends keyof RegisterForm>(
    key: Key,
    value: RegisterForm[Key],
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLoginClick?: () => void;
  reducedMotion: boolean | null;
}) {
  return (
    <section className="register-form-side" aria-label="Form daftar UniLibra">
      <motion.form
        className="register-form"
        onSubmit={onSubmit}
        initial={{ opacity: 1, x: -36, scale: 0.985 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 72,
          damping: 24,
          mass: 0.92,
          delay: reducedMotion ? 0 : REGISTER_FORM_DELAY_SECONDS,
        }}
      >
        <span className="register-eyebrow">Create Account</span>
        <h1>Daftar ke UniLibra</h1>

        <div className="register-field-grid">
          <RegisterField
            label="Nama depan"
            name="firstName"
            placeholder="Ammar"
            value={form.firstName}
            onChange={(value) => updateForm("firstName", value)}
          />
          <RegisterField
            label="Nama belakang"
            name="lastName"
            placeholder="Ali"
            value={form.lastName}
            onChange={(value) => updateForm("lastName", value)}
          />
        </div>

        <RegisterField
          label="Email"
          name="email"
          type="email"
          placeholder="nama@email.com"
          value={form.email}
          onChange={(value) => updateForm("email", value)}
        />

        <RegisterField
          label="Kota"
          name="city"
          placeholder="Yogyakarta"
          value={form.city}
          onChange={(value) => updateForm("city", value)}
        />

        <div className="register-field-grid">
          <RegisterField
            label="Password"
            name="password"
            type="password"
            placeholder="Minimal 8 karakter"
            value={form.password}
            minLength={8}
            onChange={(value) => updateForm("password", value)}
          />
          <RegisterField
            label="Konfirmasi password"
            name="confirmPassword"
            type="password"
            placeholder="Ulangi password"
            value={form.confirmPassword}
            minLength={8}
            onChange={(value) => updateForm("confirmPassword", value)}
          />
        </div>

        <div className="register-separator">atau daftar dengan</div>

        <button className="register-google" type="button">
          <GoogleIcon />
          Daftar dengan Google
        </button>

        <div className="register-helper">
          Gunakan kombinasi huruf, angka, dan simbol.
          <br />
          Minimal 8 karakter.
        </div>

        <label className="register-agreement">
          <input
            type="checkbox"
            checked={form.acceptedTerms}
            onChange={(event) =>
              updateForm("acceptedTerms", event.target.checked)
            }
            required
          />
          <span>
            Saya setuju dengan syarat penggunaan dan kebijakan privasi UniLibra.
          </span>
        </label>

        <motion.button
          className="register-submit"
          whileHover={{ scale: 1.01, y: -1 }}
          whileTap={{ scale: 0.985 }}
          type="submit"
          disabled={loading}
        >
          {loading ? "Membuat akun..." : "Buat Akun Sekarang"}
        </motion.button>

        <p className="register-login-link">
          Sudah punya akun?{" "}
          <a
            href="/login"
            onClick={(event) => {
              if (!onLoginClick) {
                return;
              }

              event.preventDefault();
              onLoginClick();
            }}
          >
            Masuk di sini
          </a>
        </p>
      </motion.form>
    </section>
  );
}

function LoginFormGhost({
  reducedMotion,
}: {
  reducedMotion: boolean | null;
}) {
  return (
    <motion.div
      className="register-login-ghost"
      initial={{ opacity: reducedMotion ? 0 : 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: "easeOut" }}
      aria-hidden="true"
    >
      <span>Selamat datang sahabat</span>
      <strong>UniLibra</strong>
      <div />
      <div />
      <button type="button">Masuk Sekarang</button>
    </motion.div>
  );
}

function RegisterVisual({
  mode,
  reducedMotion,
}: {
  mode: "login" | "register";
  reducedMotion: boolean | null;
}) {
  return (
    <motion.section
      className={`register-visual login-visual register-visual-${mode}`}
      aria-label="Keuntungan bergabung dengan UniLibra"
      initial={{
        opacity: 1,
        x: reducedMotion ? 0 : VISUAL_LOGIN_START_X,
      }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: reducedMotion ? 0 : VISUAL_SLIDE_SECONDS,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {mode === "login" ? (
        <motion.div
          className="register-transition-login"
          key="login-visual-copy"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
        >
          <span>Komunitas Baca Indonesia</span>
          <h2>Masuk dan lanjutkan bacamu.</h2>
          <p>
            Simpan wishlist, kelola riwayat peminjaman, dan temukan koleksi
            buku terdekat dari satu akun.
          </p>
        </motion.div>
      ) : (
        <motion.div
          className="register-visual-content"
          key="register-visual-copy"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="register-visual-copy-block">
            <span className="register-visual-eyebrow">
              Register UniLibra
            </span>
            <h2>
              Buat akun dan mulai <em>berbagi</em> koleksi bukumu.
            </h2>
            <p>
              Temukan cara baru untuk membaca lebih hemat dan membuat rak
              bukumu lebih hidup.
            </p>
          </div>
        </motion.div>
      )}
      <motion.div
        className="register-persistent-character"
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.25, ease: "easeOut" }}
        aria-hidden="true"
      >
        <LoginCharacterArt />
      </motion.div>
    </motion.section>
  );
}

function RegisterField({
  label,
  name,
  type = "text",
  placeholder,
  value,
  minLength,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder: string;
  value: string;
  minLength?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="register-field">
      {label}
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        value={value}
        minLength={minLength}
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
