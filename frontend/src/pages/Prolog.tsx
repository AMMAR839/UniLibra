import { useEffect, useMemo, useRef, useState } from "react";

type PrologPageProps = {
  onDone: () => void;
};

const prologPages = [
  {
    title: "UNI\nLIBRA",
    italic: "platform",
    bold: "PINJAM BUKU",
  },
  {
    title: "BUKU\nVIRAL",
    italic: "sedang ramai di",
    bold: "SEKITARMU",
  },
  {
    title: "BACA\nMURAH",
    italic: "hemat tanpa",
    bold: "BELI BARU",
  },
  {
    title: "PINTU\nBACA",
    italic: "jadikan rakmu",
    bold: "PINTU BACA",
  },
];

const bookPoses = [
  { tx: "0vw", ry: -35, rx: 10, rz: -3, sc: 1.05 },
  { tx: "-24vw", ry: 40, rx: -5, rz: 3, sc: 0.95 },
  { tx: "24vw", ry: -55, rx: 15, rz: -6, sc: 0.9 },
  { tx: "0vw", ry: 180, rx: 5, rz: 2, sc: 1.1 },
];

function PrologPage({ onDone }: PrologPageProps) {
  const [current, setCurrent] = useState(0);
  const [animating, setAnimating] = useState(false);
  const wheelAcc = useRef(0);
  const touchStartY = useRef(0);
  const doneRef = useRef(onDone);
  const currentRef = useRef(current);
  const animatingRef = useRef(animating);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    currentRef.current = current;
  }, [current]);

  useEffect(() => {
    animatingRef.current = animating;
  }, [animating]);

  function goTo(next: number) {
    if (next === currentRef.current || animatingRef.current) {
      return;
    }

    setAnimating(true);
    currentRef.current = next;
    setCurrent(next);

    window.setTimeout(() => {
      animatingRef.current = false;
      setAnimating(false);
    }, 900);
  }

  function continueForward() {
    if (animatingRef.current) {
      return;
    }

    if (currentRef.current >= prologPages.length - 1) {
      doneRef.current();
      return;
    }

    goTo(currentRef.current + 1);
  }

  function continueBackward() {
    if (animatingRef.current || currentRef.current <= 0) {
      return;
    }

    goTo(currentRef.current - 1);
  }

  useEffect(() => {
    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      wheelAcc.current += event.deltaY;

      if (wheelAcc.current > 80) {
        wheelAcc.current = 0;
        continueForward();
      }

      if (wheelAcc.current < -80) {
        wheelAcc.current = 0;
        continueBackward();
      }
    }

    function handleTouchStart(event: TouchEvent) {
      touchStartY.current = event.touches[0]?.clientY ?? 0;
    }

    function handleTouchEnd(event: TouchEvent) {
      const endY = event.changedTouches[0]?.clientY ?? touchStartY.current;
      const distance = touchStartY.current - endY;

      if (distance > 50) {
        continueForward();
      }

      if (distance < -50) {
        continueBackward();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (["ArrowDown", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        continueForward();
      }

      if (["ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        continueBackward();
      }
    }

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const bookTransform = useMemo(() => {
    const pose = bookPoses[current];

    return `translateX(${pose.tx}) rotateX(${pose.rx}deg) rotateY(${pose.ry}deg) rotateZ(${pose.rz}deg) scale(${pose.sc})`;
  }, [current]);

  const shadowTransform = useMemo(() => {
    const pose = bookPoses[current];

    return `translate(-50%, 190px) translateX(${pose.tx}) scaleX(${pose.sc * 0.95})`;
  }, [current]);

  return (
    <main className="prolog-page" aria-label="Pembuka UniLibra">
      <div className="prolog-grain" aria-hidden="true" />

      <div className="prolog-dots" aria-label="Navigasi prolog">
        {prologPages.map((page, index) => (
          <button
            aria-label={`Buka bagian ${index + 1}: ${page.bold}`}
            aria-pressed={index === current}
            className={`prolog-dot ${index === current ? "active" : ""}`}
            key={page.bold}
            onClick={() => goTo(index)}
            type="button"
          />
        ))}
      </div>

      <div className="prolog-book-stage" aria-hidden="true">
        <div className="prolog-shadow-anchor" style={{ transform: shadowTransform }}>
          <div className="prolog-shadow-pulse" />
        </div>

        <div className="prolog-book-wrapper">
          <div className="prolog-book-3d" style={{ transform: bookTransform }}>
            <div className="prolog-face prolog-face-front">
              <img src="/cover.png" alt="" draggable="false" />
            </div>
            <div className="prolog-face prolog-face-back">
              <img src="/cover.png" alt="" draggable="false" />
            </div>
            <div className="prolog-face prolog-face-spine">
              <img src="/cover.png" alt="" draggable="false" />
            </div>
            <div className="prolog-face prolog-face-pages-r" />
            <div className="prolog-face prolog-face-pages-t" />
            <div className="prolog-face prolog-face-pages-b" />
          </div>
        </div>
      </div>

      <div className="prolog-pages">
        {prologPages.map((page, index) => {
          const pageState =
            index === current ? "active" : index < current ? "above" : "";

          return (
            <section
              className={`prolog-panel prolog-panel-${index + 1} ${pageState}`}
              key={page.bold}
            >
              <h1 className="prolog-giant-text">
                {page.title.split("\n").map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </h1>
              <div className="prolog-foreground">
                <div className="prolog-kicker">
                  <span className="prolog-kicker-italic">{page.italic}</span>
                  <span className="prolog-kicker-bold">{page.bold}</span>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

export default PrologPage;
