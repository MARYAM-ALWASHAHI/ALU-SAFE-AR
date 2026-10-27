// Boot: capability checks, menus and settings. The 3D code is loaded only after WebGL is confirmed.
import { t, tx, setLang, getLang, applyI18n } from "./i18n.js";
import { $, showScreen, openModal, closeModal, icon, fmtTime } from "./ui.js";
import { store } from "./storage.js";

const settings = store.getSettings();
if (!settings.quality) settings.quality = matchMedia("(pointer:coarse)").matches ? "medium" : "high";
setLang(settings.lang || "ar");

let game = null;
let booted = false;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch (_) { return false; }
}

function showError(err) {
  console.error(err);
  showScreen("s-error");
  $("#hud").hidden = true;
}
addEventListener("error", (e) => { if (!booted) showError(e.error || e.message); });
addEventListener("unhandledrejection", (e) => { if (!booted) showError(e.reason); });

function save() { store.saveSettings(settings); }

function renderHome() {
  document.querySelectorAll("[data-diff]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.diff === settings.difficulty));
  $("#diff-desc").textContent = t(settings.difficulty + "D");
  const best = store.getBest(settings.difficulty);
  $("#best").textContent = best != null ? t("best", { n: best }) : "";
  $("#lang-toggle span").textContent = getLang() === "ar" ? "English" : "العربية";
}

function wireHome() {
  document.querySelectorAll("[data-diff]").forEach((b) => b.addEventListener("click", () => { settings.difficulty = b.dataset.diff; save(); renderHome(); }));
  $("#lang-toggle").addEventListener("click", () => { settings.lang = getLang() === "ar" ? "en" : "ar"; setLang(settings.lang); save(); renderHome(); });
  $("#btn-play").addEventListener("click", async () => {
    const { unlockAudio, setMuted } = await import("./audio.js");
    unlockAudio(); setMuted(settings.muted);
    showScreen(null);
    game.start(settings.difficulty);
  });
  $("#btn-howto").addEventListener("click", openHowTo);
  $("#btn-settings").addEventListener("click", openSettings);
  $("#btn-ar").addEventListener("click", openAR);
}

function openHowTo() {
  openModal({
    title: t("howto"),
    body: `<ul class="howto">
      <li>${icon("shield")}<span>${t("howGoal")}</span></li>
      <li>${icon("warn")}<span>${t("howRules")}</span></li>
      <li>${icon("help")}<span>${t("howChoice")}</span></li>
      <li>${icon("hand")}<span>${t("howTouch")}</span></li>
      <li>${icon("gear")}<span>${t("howDesk")}</span></li></ul>`,
    actions: [{ label: t("close"), primary: true, onClick: () => closeModal() }],
  });
}

function seg(name, values, current) {
  return `<div class="seg-ctl" role="group" aria-label="${t(name)}">${values.map((v) => `<button data-${name}="${v}" aria-pressed="${v === current}">${t(v)}</button>`).join("")}</div>`;
}

function openSettings() {
  const box = openModal({
    title: t("settings"),
    body: `
      <label class="field">${t("language")}</label>
      <div class="seg-ctl" role="group"><button data-language="ar" aria-pressed="${getLang() === "ar"}">العربية</button><button data-language="en" aria-pressed="${getLang() === "en"}">English</button></div>
      <label class="field">${t("difficulty")}</label>${seg("difficulty", ["easy", "normal", "hard"], settings.difficulty)}
      <label class="field">${t("quality")}</label>${seg("quality", ["low", "medium", "high"], settings.quality)}
      <p class="note">${t("qualityD")}</p>
      <label class="field">${t("audio")}</label>
      <div class="seg-ctl" role="group"><button data-muted="0" aria-pressed="${!settings.muted}">${icon("sound")}</button><button data-muted="1" aria-pressed="${settings.muted}">${icon("mute")}</button></div>`,
    actions: [{ label: t("done"), primary: true, onClick: () => closeModal() }],
    onClose: () => { renderHome(); },
  });
  box.querySelectorAll("[data-language]").forEach((b) => b.addEventListener("click", () => { settings.lang = b.dataset.language; setLang(settings.lang); save(); closeModal(); openSettings(); }));
  box.querySelectorAll("[data-difficulty]").forEach((b) => b.addEventListener("click", () => { settings.difficulty = b.dataset.difficulty; save(); mark(box, "difficulty", b); }));
  box.querySelectorAll("[data-quality]").forEach((b) => b.addEventListener("click", () => { settings.quality = b.dataset.quality; save(); mark(box, "quality", b); game && game.applyQuality(); }));
  box.querySelectorAll("[data-muted]").forEach((b) => b.addEventListener("click", async () => { settings.muted = b.dataset.muted === "1"; save(); mark(box, "muted", b); const a = await import("./audio.js"); a.setMuted(settings.muted); }));
}
function mark(box, name, btn) { box.querySelectorAll(`[data-${name}]`).forEach((x) => x.setAttribute("aria-pressed", x === btn)); }

async function openAR() {
  openModal({ title: t("arMode"), body: `<p class="muted">${t("arChecking")}</p>` });
  let supported = false;
  try { supported = !!(navigator.xr && await navigator.xr.isSessionSupported("immersive-ar")); } catch (_) { supported = false; }
  const framed = window.self !== window.top;
  openModal({
    tone: supported ? "good" : "",
    tag: icon("cube") + " " + t("arMode"),
    title: supported ? t("arYesT") : t("arNoT"),
    body: `<p>${supported ? t("arYes") : t("arNo")}</p>${framed ? `<p class="note">${t("arFrame")}</p>` : ""}`,
    actions: [{ label: t("close"), primary: true, onClick: () => closeModal() }],
  });
}

function showResults({ total, results, elapsed, diff }) {
  import("./content.js").then(({ MISSIONS }) => {
    const max = MISSIONS.length * 100;
    const pct = total / max;
    const rate = pct >= .85 ? "rateA" : pct >= .6 ? "rateB" : "rateC";
    const viol = results.reduce((s, r) => s + r.violations, 0);
    $("#results").innerHTML = `
      <div class="res-head">
        <p class="eyebrow">${t("resultsT")} · ${t(diff)}</p>
        <div class="big-score"><b>${total}</b><span>/ ${max}</span></div>
        <p class="rate ${rate}">${t(rate)}</p>
      </div>
      <div class="stats">
        <div><span>${t("totalTime")}</span><b>${fmtTime(elapsed)}</b></div>
        <div><span>${t("violations")}</span><b>${viol}</b></div>
      </div>
      <ol class="rows">${MISSIONS.map((m, i) => {
        const r = results[i];
        const detail = [m.type === "reach" ? "" : (r.tries <= 1 ? t("firstTry") : t("tries", { n: r.tries })), r.violations ? (r.violations === 1 ? t("viol1") : t("violN", { n: r.violations })) : "", r.timeout ? t("timeUpT") : ""].filter(Boolean).join(" · ");
        return `<li><div><b>${tx(m.name)}</b><small>${detail}</small></div><span class="pts">${r.score}</span></li>`;
      }).join("")}</ol>
      <h3>${t("lessons")}</h3>
      <ul class="lessons">${MISSIONS.map((m) => `<li>${tx(m.learn)}</li>`).join("")}</ul>
      <div class="row-btns">
        <button class="btn primary" id="btn-again">${icon("restart")}<span>${t("playAgain")}</span></button>
        <button class="btn secondary" id="btn-home">${icon("home")}<span>${t("menu")}</span></button>
      </div>
      <p class="note">${t("sample")}</p>`;
    showScreen("s-results");
    $("#s-results").scrollTop = 0;
    $("#btn-again").addEventListener("click", () => { showScreen(null); game.start(settings.difficulty = diff); });
    $("#btn-home").addEventListener("click", () => { game.exitToMenu(); });
  });
}

async function boot() {
  showScreen("s-loading");
  if (!hasWebGL()) { showScreen("s-unsupported"); return; }
  try {
    const { Game } = await import("./game.js");
    game = new Game($("#view"), settings);
    if (new URLSearchParams(location.search).has("test")) window.__game = game; // automated tests only
    game.onExit = () => { renderHome(); showScreen("s-home"); };
    game.onFinish = (res) => showResults(res);
    game.onContextLost = () => showError(new Error("WebGL context lost"));
    wireHome();
    renderHome();
    booted = true;
    showScreen("s-home");
  } catch (err) {
    showError(err);
  }
}

$("#btn-reload").addEventListener("click", () => location.reload());
applyI18n();
boot();
