const book = document.getElementById("book");
const scene = document.getElementById("scene");
const resetBtn = document.getElementById("resetBtn");
const viewButtons = document.querySelectorAll("[data-view]");

let rotateX = -12;
let rotateY = -28;
let scale = 1;

let isDragging = false;
let startX = 0;
let startY = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function updateBook() {
  book.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
}

updateBook();

book.addEventListener("pointerdown", (e) => {
  isDragging = true;
  startX = e.clientX;
  startY = e.clientY;
  book.classList.add("dragging");
  book.setPointerCapture(e.pointerId);
});

book.addEventListener("pointermove", (e) => {
  if (!isDragging) return;

  const dx = e.clientX - startX;
  const dy = e.clientY - startY;

  rotateY += dx * 0.45;
  rotateX -= dy * 0.30;

  rotateX = clamp(rotateX, -75, 75);

  startX = e.clientX;
  startY = e.clientY;

  updateBook();
});

function stopDrag(e) {
  isDragging = false;
  book.classList.remove("dragging");
  try {
    book.releasePointerCapture(e.pointerId);
  } catch (err) {}
}

book.addEventListener("pointerup", stopDrag);
book.addEventListener("pointercancel", stopDrag);
book.addEventListener("pointerleave", (e) => {
  if (isDragging) stopDrag(e);
});

scene.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    scale += e.deltaY * -0.001;
    scale = clamp(scale, 0.7, 1.6);
    updateBook();
  },
  { passive: false }
);

viewButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const view = btn.dataset.view;

    if (view === "front") {
      rotateX = -8;
      rotateY = 0;
    } else if (view === "spine") {
      rotateX = -8;
      rotateY = -90;
    } else if (view === "back") {
      rotateX = -8;
      rotateY = 180;
    } else if (view === "three") {
      rotateX = -18;
      rotateY = -35;
    }

    updateBook();
  });
});

resetBtn.addEventListener("click", () => {
  rotateX = -12;
  rotateY = -28;
  scale = 1;
  updateBook();
});