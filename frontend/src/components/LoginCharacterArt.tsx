import { memo, useEffect, useRef } from "react";
import designHtml from "../../Desaign Akhir.html?raw";
import "./LoginCharacterArt.css";

const INTERACTIVE_ART_MARKUP = designHtml.match(/<svg[\s\S]*<\/svg>/)?.[0] ?? "";

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

    const stageElement = stage;
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
      const rect = stageElement.getBoundingClientRect();
      const viewBox = svgElement.viewBox.baseVal;

      if (!rect.width || !rect.height || !viewBox.width || !viewBox.height) {
        return { x: pointer.x, y: pointer.y };
      }

      return {
        x: viewBox.x + ((clientX - rect.left) / rect.width) * viewBox.width,
        y: viewBox.y + ((clientY - rect.top) / rect.height) * viewBox.height,
      };
    }

    function setPointerFromEvent(event: PointerEvent) {
      const pos = clientToSvg(event.clientX, event.clientY);
      pointer.x = pos.x;
      pointer.y = pos.y;
      characters.forEach(updateCharacter);
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
      const dx = pointer.x - item.cx;
      const dy = pointer.y - item.cy;
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
    animate();

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

export default memo(LoginCharacterArt);
