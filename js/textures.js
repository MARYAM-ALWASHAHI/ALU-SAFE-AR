// Procedural canvas textures: concrete, metal, paint, hazard stripes and bilingual signs.
// Drawn once at start-up, so the game needs no image files.
import * as THREE from "./vendor/three.module.min.js";

const cache = new Map();
let rnd = mulberry(7);
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  return tex;
}

function once(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }
export function disposeTextures() { cache.forEach((t) => t.dispose && t.dispose()); cache.clear(); rnd = mulberry(7); }

// Worn industrial concrete: speckle, oil stains, hairline cracks and saw-cut joints.
export function concrete(repeat = [16, 6]) {
  const tex = once("concrete", () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = "#7d8184"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const v = 95 + rnd() * 70 | 0;
      g.fillStyle = `rgba(${v},${v},${v + 3},${rnd() * .28})`;
      g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
    }
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 70;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(30,28,24,${.12 + rnd() * .2})`); gr.addColorStop(1, "rgba(30,28,24,0)");
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    g.strokeStyle = "rgba(35,35,35,.35)"; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      let x = rnd() * w, y = rnd() * h; g.beginPath(); g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (rnd() - .5) * 40; y += (rnd() - .3) * 30; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = "rgba(25,25,25,.55)"; g.lineWidth = 3; g.strokeRect(0, 0, w, h);
  }));
  const t = tex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// Painted steel with edge wear and grime collecting towards the bottom.
export function painted(hex) {
  return once("paint" + hex, () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "rgba(255,255,255,.06)"); gr.addColorStop(.6, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(20,16,10,.35)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .12})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(120,110,100,${rnd() * .35})`; g.fillRect(rnd() < .5 ? 0 : w - 6, rnd() * h, 6, 2 + rnd() * 10); }
    g.strokeStyle = "rgba(0,0,0,.25)"; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
  }));
}

// Brushed metal (aluminium, stainless).
export function brushed(hex = "#b8bec4") {
  return once("brushed" + hex, () => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = hex; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) { g.fillStyle = `rgba(${rnd() < .5 ? "255,255,255" : "0,0,0"},${rnd() * .07})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .08})`; g.fillRect(rnd() * w, rnd() * h, 20 + rnd() * 80, 1); }
  }));
}

// Diamond-plate steel for platforms and stair treads.
export function treadPlate() {
  const tex = once("tread", () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#6f777e"; g.fillRect(0, 0, w, h);
    g.fillStyle = "rgba(220,225,230,.35)";
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) { g.save(); g.translate(x + 4, y + 4); g.rotate(y / 16 % 2 ? .7 : -.7); g.fillRect(-5, -1.2, 10, 2.4); g.restore(); }
  }, [1, 1]));
  return tex;
}

export function grating() {
  return once("grating", () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = "#1a1d20"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#8a9299";
    for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h);
    for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 2);
  }, [1, 1]));
}

export function stripes(a, b, repeat = [1, 1]) {
  const tex = once("stripe" + a + b, () => canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = a; g.fillRect(0, 0, w, h);
    g.fillStyle = b;
    for (let i = -h; i < w + h; i += 48) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 24, 0); g.lineTo(i + 24 - h, h); g.lineTo(i - h, h); g.fill(); }
    for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .15})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }, [1, 1]));
  const t = tex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  return t;
}

export function glowSprite() {
  return once("glow", () => canvasTex(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); }));
}

// Soft vertical light shaft for the clerestory windows.
export function shaftTex() {
  return once("shaft", () => canvasTex(64, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(255,244,220,.55)"); gr.addColorStop(1, "rgba(255,244,220,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sx = g.createLinearGradient(0, 0, w, 0); sx.addColorStop(0, "rgba(0,0,0,1)"); sx.addColorStop(.5, "rgba(0,0,0,0)"); sx.addColorStop(1, "rgba(0,0,0,1)");
    g.globalCompositeOperation = "destination-out"; g.fillStyle = sx; g.fillRect(0, 0, w, h);
  }));
}

// Bilingual safety sign: ISO-style pictogram plus English and Arabic text.
export function signTex({ bg, fg, en, ar, icon }) {
  return once("sign" + en + bg, () => canvasTex(512, 256, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
    g.fillStyle = fg; g.strokeStyle = fg; g.lineWidth = 10; g.lineCap = "round"; g.lineJoin = "round";
    const cx = 110, cy = 128;
    drawPicto(g, icon, cx, cy);
    const tx = icon ? 210 : 40, maxW = icon ? 280 : 430;
    g.fillStyle = fg; g.textBaseline = "middle";
    g.direction = "ltr"; g.textAlign = "left";
    g.font = "700 34px Arial, sans-serif"; wrapText(g, en, tx, 82, maxW, 38);
    g.direction = "rtl"; g.textAlign = "right";
    g.font = "700 32px Arial, Tahoma, sans-serif"; g.fillText(ar, 490, 196);
    // light wear
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * .08})`; g.fillRect(rnd() * w, rnd() * h, 2, 2); }
  }));
}

function drawPicto(g, icon, cx, cy) {
  if (icon === "warn") { g.beginPath(); g.moveTo(cx, cy - 70); g.lineTo(cx + 78, cy + 60); g.lineTo(cx - 78, cy + 60); g.closePath(); g.stroke(); g.fillRect(cx - 6, cy - 25, 12, 50); g.fillRect(cx - 6, cy + 35, 12, 12); }
  if (icon === "stop") { g.beginPath(); g.arc(cx, cy, 70, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(cx - 48, cy + 48); g.lineTo(cx + 48, cy - 48); g.stroke(); }
  if (icon === "exit") { g.beginPath(); g.arc(cx - 20, cy - 52, 13, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx - 24, cy - 30); g.lineTo(cx - 32, cy + 10); g.lineTo(cx - 60, cy + 55); g.moveTo(cx - 32, cy + 10); g.lineTo(cx, cy + 30); g.lineTo(cx + 5, cy + 60); g.moveTo(cx - 26, cy - 22); g.lineTo(cx + 10, cy - 10); g.moveTo(cx - 26, cy - 22); g.lineTo(cx - 60, cy - 6); g.stroke(); g.beginPath(); g.moveTo(cx + 30, cy); g.lineTo(cx + 80, cy); g.moveTo(cx + 60, cy - 20); g.lineTo(cx + 80, cy); g.lineTo(cx + 60, cy + 20); g.stroke(); }
  if (icon === "ppe") { g.beginPath(); g.arc(cx, cy + 10, 60, Math.PI, 0); g.closePath(); g.fill(); g.fillRect(cx - 80, cy + 8, 160, 14); }
  if (icon === "load") { g.beginPath(); g.moveTo(cx, cy - 75); g.lineTo(cx, cy - 20); g.stroke(); g.beginPath(); g.arc(cx, cy - 10, 12, Math.PI, 0); g.stroke(); g.fillRect(cx - 45, cy, 90, 50); g.beginPath(); g.moveTo(cx, cy + 58); g.lineTo(cx, cy + 75); g.stroke(); }
  if (icon === "assembly") { for (const [x, y] of [[-40, -30], [40, -30], [-40, 40], [40, 40]]) { g.beginPath(); g.arc(cx + x * .8, cy + y * .8 - 12, 10, 0, 7); g.fill(); g.fillRect(cx + x * .8 - 9, cy + y * .8, 18, 26); } }
  if (icon === "fire") { g.beginPath(); g.moveTo(cx, cy - 70); g.bezierCurveTo(cx + 70, cy - 10, cx + 50, cy + 60, cx, cy + 60); g.bezierCurveTo(cx - 50, cy + 60, cx - 70, cy - 10, cx - 20, cy - 40); g.bezierCurveTo(cx - 15, cy - 10, cx, cy - 20, cx, cy - 70); g.fill(); }
  if (icon === "eye") { g.beginPath(); g.ellipse(cx, cy, 70, 38, 0, 0, 7); g.stroke(); g.beginPath(); g.arc(cx, cy, 20, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx - 40, cy - 70); g.lineTo(cx - 30, cy - 52); g.moveTo(cx, cy - 76); g.lineTo(cx, cy - 56); g.moveTo(cx + 40, cy - 70); g.lineTo(cx + 30, cy - 52); g.stroke(); }
  if (icon === "lock") { g.beginPath(); g.arc(cx, cy - 20, 32, Math.PI, 0); g.stroke(); g.fillRect(cx - 50, cy - 20, 100, 80); }
  if (icon === "harness") { g.beginPath(); g.arc(cx, cy - 56, 14, 0, 7); g.fill(); g.beginPath(); g.moveTo(cx, cy - 40); g.lineTo(cx, cy + 20); g.lineTo(cx - 30, cy + 70); g.moveTo(cx, cy + 20); g.lineTo(cx + 30, cy + 70); g.moveTo(cx - 40, cy - 20); g.lineTo(cx + 40, cy - 20); g.moveTo(cx, cy - 30); g.lineTo(cx + 60, cy - 76); g.stroke(); }
  if (icon === "forklift") { g.fillRect(cx - 60, cy, 80, 40); g.fillRect(cx - 40, cy - 50, 10, 50); g.fillRect(cx + 20, cy - 60, 8, 100); g.fillRect(cx + 28, cy + 30, 40, 8); g.beginPath(); g.arc(cx - 40, cy + 50, 14, 0, 7); g.arc(cx + 6, cy + 50, 14, 0, 7); g.fill(); }
  if (icon === "info") { g.beginPath(); g.arc(cx, cy, 70, 0, 7); g.stroke(); g.fillRect(cx - 7, cy - 10, 14, 50); g.beginPath(); g.arc(cx, cy - 32, 9, 0, 7); g.fill(); }
}

function wrapText(g, text, x, y, maxW, lh) {
  const words = text.split(" "); let line = ""; let yy = y;
  for (const w of words) { const test = line ? line + " " + w : w; if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); line = w; yy += lh; } else line = test; }
  g.fillText(line, x, yy);
}

// Notice board with a heading and short bilingual lines.
export function boardTex(title, lines) {
  return once("board" + title, () => canvasTex(512, 384, (g, w, h) => {
    g.fillStyle = "#f4f5f2"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#0b2d4a"; g.fillRect(0, 0, w, 64);
    g.fillStyle = "#ffffff"; g.font = "700 30px Arial, sans-serif"; g.textBaseline = "middle"; g.fillText(title, 20, 33);
    g.font = "500 22px Arial, Tahoma, sans-serif"; g.fillStyle = "#1a2530";
    lines.forEach((l, i) => { g.fillStyle = "#00a8a8"; g.fillRect(20, 92 + i * 46, 10, 10); g.fillStyle = "#1a2530"; g.fillText(l, 42, 97 + i * 46); });
    g.strokeStyle = "#0b2d4a"; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8);
  }));
}
