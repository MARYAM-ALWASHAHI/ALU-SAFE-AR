// DOM helpers: screens, modal dialog, toasts and icons.
import { t } from "./i18n.js";

export const $ = (sel) => document.querySelector(sel);

export function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => (s.hidden = s.id !== id));
}

const ICONS = {
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M5.2 18.8l2.1-2.1M16.7 7.3l2.1-2.1"/>',
  help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.3 9.3a2.8 2.8 0 1 1 3.9 2.6c-.8.4-1.2 1-1.2 1.9v.6"/><path d="M12 17.2v.1"/>',
  cube: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>',
  globe: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c3 3.2 3 15.8 0 19M12 2.5c-3 3.2-3 15.8 0 19"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.1"/>',
  hand: '<path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V10m0-1.5a1.5 1.5 0 0 1 3 0V11m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.6-2.4 6.5-6 6.5-2.5 0-4-1.2-5.2-3.2L4.5 13.5a1.5 1.5 0 0 1 2.4-1.8L9 14"/>',
  expand: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  sound: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
  arrow: '<path d="M12 3l7 9h-4.5v9h-5v-9H5z" fill="currentColor" stroke="none"/>',
  restart: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9"/><path d="M4.5 4v5h5"/>',
  home: '<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>',
  shield: '<path d="M12 2.8l7.5 3v6c0 4.6-3.2 8.2-7.5 9.4-4.3-1.2-7.5-4.8-7.5-9.4v-6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
};
export function icon(name, cls = "") {
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ""}</svg>`;
}

// PPE pictograms, drawn as simple line art.
const PPE_ART = {
  helmet: '<path d="M8 32a16 16 0 0 1 32 0"/><path d="M5 32h38v4H5z"/><path d="M24 16v8"/>',
  glasses: '<rect x="6" y="18" width="15" height="11" rx="4"/><rect x="27" y="18" width="15" height="11" rx="4"/><path d="M21 22h6M6 21L3 17M42 21l3-4"/>',
  fr: '<path d="M16 8l-9 6 4 7 4-2v21h18V19l4 2 4-7-9-6c-1 3-4 5-8 5s-7-2-8-5z"/><path d="M22 26c0-3 4-4 2-8 4 2 5 6 3 9"/>',
  boots: '<path d="M12 8h12v18l14 6v8H12z"/><path d="M12 34h26M12 14h12"/>',
  gloves: '<path d="M14 40V22l-4-8a2 2 0 0 1 4-2l4 7V8a2 2 0 0 1 4 0v10V6a2 2 0 0 1 4 0v12V8a2 2 0 0 1 4 0v12l2-5a2 2 0 0 1 4 1l-4 12v12z"/>',
  ears: '<path d="M10 28a14 14 0 0 1 28 0"/><rect x="6" y="26" width="8" height="12" rx="3"/><rect x="34" y="26" width="8" height="12" rx="3"/>',
  fleece: '<path d="M16 8l-9 6 4 7 4-2v21h18V19l4 2 4-7-9-6c-1 3-4 5-8 5s-7-2-8-5z"/><path d="M24 13v27M19 24h2M27 24h2M19 31h2M27 31h2"/>',
  trainers: '<path d="M6 30c4 0 6-10 10-12l6 6c3 2 8 3 14 4 4 1 6 3 6 6v4H6z"/><path d="M6 34h36M18 22l3 3M22 19l3 3"/>',
};
export function ppeArt(id) {
  return `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PPE_ART[id] || ""}</svg>`;
}

// ---------- modal ----------
let onModalClose = null;
export function openModal({ tag = "", title = "", body = "", actions = [], tone = "", wide = false, onClose = null }) {
  const m = $("#modal");
  const box = m.querySelector(".dialog");
  box.className = "dialog" + (tone ? " " + tone : "") + (wide ? " wide" : "");
  box.innerHTML = `
    ${tag ? `<div class="dtag">${tag}</div>` : ""}
    ${title ? `<h2 id="dlg-title">${title}</h2>` : ""}
    <div class="dbody">${body}</div>
    ${actions.length ? `<div class="dactions">${actions.map((a, i) => `<button class="btn ${a.primary ? "primary" : "secondary"}" data-act="${i}">${a.icon ? icon(a.icon) : ""}<span>${a.label}</span></button>`).join("")}</div>` : ""}`;
  actions.forEach((a, i) => box.querySelector(`[data-act="${i}"]`).addEventListener("click", () => a.onClick && a.onClick()));
  onModalClose = onClose;
  m.hidden = false;
  box.scrollTop = 0;
  requestAnimationFrame(() => { const f = box.querySelector(".btn.primary, .opt, .btn"); f && f.focus({ preventScroll: true }); });
  return box;
}
export function closeModal() {
  $("#modal").hidden = true;
  const cb = onModalClose; onModalClose = null;
  cb && cb();
}
export const modalOpen = () => !$("#modal").hidden;

let toastTimer = 0;
export function toast(msg, ms = 2600) {
  const el = $("#toast");
  el.textContent = msg; el.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("on"), ms);
}

export function flash(kind, ms = 1200) {
  const el = $("#flash");
  el.className = ""; void el.offsetWidth; el.className = "on " + kind;
  setTimeout(() => (el.className = ""), ms);
}

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
export { t };
