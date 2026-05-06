import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { motion } from "framer-motion";
import designHtml from "../../Desaign Akhir.html?raw";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const GOOGLE_LOGIN_URL =
  import.meta.env.VITE_GOOGLE_LOGIN_URL || `${API_URL}/api/auth/google`;
const INTERACTIVE_ART_MARKUP = designHtml.match(/<svg[\s\S]*<\/svg>/)?.[0] ?? "";

export default function Login() {
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
        />
      </section>
    </main>
  );
}

function HeroLeft() {
  return (
    <section className="login-visual" aria-label="Ilustrasi UniLibra">
      <div className="login-visual-top">
        <span className="login-brand-mark">UL</span>
        <span>UniLibra</span>
      </div>

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
}) {
  return (
    <section className="login-panel-wrap">
      <motion.div
        className="login-panel"
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, delay: 0.1, ease: "easeOut" }}
      >
        <span>Selamat datang kembali</span>
        <h2>Login ke UniLibra</h2>
        <p className="login-panel-copy">
          Masuk untuk mulai meminjam, mengelola koleksi, dan melihat aktivitas
          bacamu.
        </p>

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

type CharacterState = {
  body: SVGElement | null;
  face: SVGElement | null;
  cheeks: SVGElement | null;
  mouth: SVGElement | null;
  pupils: SVGElement[];
  smileEyes: SVGElement[];
  cx: number;
  cy: number;
  originX: number;
  originY: number;
  radius: number;
  eyeMax: number;
  faceX: number;
  faceY: number;
  tiltMax: number;
  mouthX: number;
  mouthY: number;
  stateX: number;
  stateY: number;
  statePower: number;
};

function LoginCharacterArt() {
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const svg = stage?.querySelector<SVGSVGElement>(".art");

    if (!stage || !svg) {
      return;
    }

    const svgElement = svg;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const pointer = {
      x: 115.5,
      y: 93,
    };

    const clamp = (value: number, min: number, max: number) =>
      Math.min(max, Math.max(min, value));
    const lerp = (current: number, target: number, amount: number) =>
      current + (target - current) * amount;
    const fixed = (value: number) =>
      Number(value).toFixed(4).replace(/\.0+$/, "");
    const number = (element: SVGElement, name: string, fallback = 0) => {
      const value = Number(element.dataset[name]);
      return Number.isFinite(value) ? value : fallback;
    };

    function clientToSvg(clientX: number, clientY: number) {
      const matrix = svgElement.getScreenCTM();

      if (!matrix) {
        return { x: pointer.x, y: pointer.y };
      }

      const point = svgElement.createSVGPoint();
      point.x = clientX;
      point.y = clientY;

      return point.matrixTransform(matrix.inverse());
    }

    function setPointerFromEvent(event: PointerEvent) {
      const pos = clientToSvg(event.clientX, event.clientY);
      pointer.x = pos.x;
      pointer.y = pos.y;
    }

    function setTranslate(element: SVGElement, x: number, y: number) {
      element.setAttribute("transform", `translate(${fixed(x)} ${fixed(y)})`);
    }

    function setAround(
      element: SVGElement | null,
      originX: number,
      originY: number,
      angleDeg: number,
      scaleX = 1,
      scaleY = 1,
      moveX = 0,
      moveY = 0,
    ) {
      if (!element) {
        return;
      }

      const angle = (angleDeg * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const a = cos * scaleX;
      const b = sin * scaleX;
      const c = -sin * scaleY;
      const d = cos * scaleY;
      const e = moveX + originX - a * originX - c * originY;
      const f = moveY + originY - b * originX - d * originY;

      element.setAttribute(
        "transform",
        `matrix(${fixed(a)} ${fixed(b)} ${fixed(c)} ${fixed(d)} ${fixed(e)} ${fixed(f)})`,
      );
    }

    const characters: CharacterState[] = [
      ...stage.querySelectorAll<SVGElement>(".character"),
    ].map((character) => {
      const cx = number(character, "centerX");
      const cy = number(character, "centerY");

      return {
        body: character.querySelector<SVGElement>(".body-motion"),
        face: character.querySelector<SVGElement>(".face-motion"),
        cheeks: character.querySelector<SVGElement>(".cheeks-motion"),
        mouth: character.querySelector<SVGElement>(".mouth-motion"),
        pupils: [...character.querySelectorAll<SVGElement>(".pupil")],
        smileEyes: [
          ...character.querySelectorAll<SVGElement>(".smile-eye-follow"),
        ],
        cx,
        cy,
        originX: number(character, "originX", cx),
        originY: number(character, "originY", cy),
        radius: number(character, "radius", 90),
        eyeMax: number(character, "eyeMax", 3),
        faceX: number(character, "faceX", 1.4),
        faceY: number(character, "faceY", 0.9),
        tiltMax: number(character, "tilt", 5),
        mouthX: number(character, "mouthX", cx),
        mouthY: number(character, "mouthY", cy),
        stateX: 0,
        stateY: 0,
        statePower: 0,
      };
    });

    function updateCharacter(item: CharacterState) {
      const targetX = pointer.x;
      const targetY = pointer.y;
      const dx = targetX - item.cx;
      const dy = targetY - item.cy;
      const distance = Math.hypot(dx, dy) || 1;
      const power = clamp(distance / item.radius, 0, 1);
      const nx = (dx / distance) * power;
      const ny = (dy / distance) * power;
      const followSpeed = prefersReducedMotion ? 1 : 0.14;

      item.stateX = lerp(item.stateX, nx, followSpeed);
      item.stateY = lerp(item.stateY, ny, followSpeed);
      item.statePower = lerp(item.statePower, power, followSpeed);

      const sx = item.stateX;
      const sy = item.stateY;
      const absX = Math.abs(sx);
      const absY = Math.abs(sy);
      const tilt = sx * item.tiltMax * 0.35;
      const stretchFromLookingUp = -sy;
      const scaleY = clamp(
        1 + stretchFromLookingUp * 0.02 - absX * 0.01,
        0.97,
        1.03,
      );
      const scaleX = clamp(
        1 - stretchFromLookingUp * 0.01 + absX * 0.02,
        0.97,
        1.03,
      );
      const faceMoveX = sx * item.faceX * 6.5;
      const faceMoveY = sy * item.faceY * 4.5;
      const eyeX = sx * item.eyeMax * 0.8;
      const eyeY = sy * item.eyeMax * 0.6;

      setAround(item.body, item.originX, item.originY, tilt, scaleX, scaleY);
      setAround(
        item.face,
        item.cx,
        item.cy,
        tilt * 0.5,
        1,
        1,
        faceMoveX,
        faceMoveY,
      );
      item.pupils.forEach((pupil) => setTranslate(pupil, eyeX, eyeY));
      item.smileEyes.forEach((eye) => {
        const turn = Number(eye.dataset.turn || 1);
        const rotate = (sx * 6 + sy * 2) * turn;
        setAround(
          eye,
          number(eye, "originX", item.cx),
          number(eye, "originY", item.cy),
          rotate,
          1,
          1,
          eyeX * 0.5,
          eyeY * 0.3,
        );
      });

      if (item.mouth) {
        const mouthWide = clamp(1 + absX * 0.15, 0.95, 1.2);
        const mouthTall = clamp(
          1 + Math.max(0, sy) * 0.18 - Math.max(0, -sy) * 0.05 + absY * 0.02,
          0.9,
          1.15,
        );
        setAround(
          item.mouth,
          item.mouthX,
          item.mouthY,
          sx * 3,
          mouthWide,
          mouthTall,
          sx * 1.5,
          sy * 1.5,
        );
      }

      setAround(
        item.cheeks,
        item.cx,
        item.cy,
        0,
        clamp(1 + item.statePower * 0.025, 1, 1.03),
        clamp(1 + item.statePower * 0.025, 1, 1.03),
        sx * 0.45,
        sy * 0.22,
      );
    }

    let frameId = 0;
    function animate() {
      characters.forEach(updateCharacter);
      frameId = window.requestAnimationFrame(animate);
    }

    window.addEventListener("pointermove", setPointerFromEvent, {
      passive: true,
    });
    window.addEventListener("pointerdown", setPointerFromEvent, {
      passive: true,
    });
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("pointermove", setPointerFromEvent);
      window.removeEventListener("pointerdown", setPointerFromEvent);
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <div
      className="login-art-stage"
      ref={stageRef}
      dangerouslySetInnerHTML={{ __html: INTERACTIVE_ART_MARKUP }}
    />
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
