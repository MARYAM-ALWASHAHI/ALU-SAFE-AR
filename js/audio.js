// Synthesised sound (no audio files): short cues, a smelter ambience bed and 3D positional
// sources for the forklift, crane, crucible and fire, plus a heartbeat that speeds up as danger
// gets closer. Audio starts only after a user gesture (browser rule).
let ctx = null, master = null, muffle = null, noiseBuf = null;
let alarmTimer = null;
export let muted = false;

export function unlockAudio() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 4;
      muffle = ctx.createBiquadFilter(); muffle.type = "lowpass"; muffle.frequency.value = 20000;
      master = ctx.createGain(); master.gain.value = muted ? 0 : 1;
      master.connect(muffle).connect(comp).connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch (_) { ctx = null; }
}

export function setMuted(m) {
  muted = m;
  if (m) stopAlarm();
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, .05);
}

// Muffle everything (used during incident replays) — 0 = normal, 1 = heavily muffled.
export function setMuffle(k) { if (muffle) muffle.frequency.setTargetAtTime(k > 0 ? 20000 * Math.pow(.02, k) : 20000, ctx.currentTime, .08); }

function tone(freq, dur, type = "sine", vol = 0.12, when = 0, dest = master, slide = 0) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(dest); o.start(t0); o.stop(t0 + dur + 0.05);
}
function noise(dur, { type = "lowpass", freq = 1000, q = .7, vol = .2, when = 0, dest = master, attack = .01 } = {}) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime + when;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f).connect(g).connect(dest); s.start(t0, Math.random()); s.stop(t0 + dur + .05);
}

export const sfx = {
  good() { tone(660, .18, "triangle"); tone(880, .3, "triangle", .12, .12); tone(1320, .35, "sine", .05, .22); },
  bad() { tone(220, .35, "sawtooth", .07); tone(165, .45, "sawtooth", .07, .14); },
  horn() { tone(330, .6, "square", .06); tone(392, .6, "square", .045); },
  click() { tone(520, .06, "triangle", .06); },
  tick() { tone(900, .04, "sine", .03); },
  radio() { noise(.12, { type: "bandpass", freq: 2200, q: 2, vol: .12 }); tone(1800, .05, "square", .03, .1); },
  impact() { tone(70, .6, "sine", .35, 0, master, .4); noise(.5, { freq: 500, vol: .35 }); },
  whoosh() { noise(.7, { type: "bandpass", freq: 600, q: .8, vol: .16, attack: .3 }); },
  rewind() { for (let i = 0; i < 6; i++) tone(1400 - i * 160, .09, "sawtooth", .025, i * .07); noise(.5, { type: "highpass", freq: 3000, vol: .05 }); },
  freeze() { tone(110, 1.2, "sine", .18, 0, master, .5); noise(.25, { type: "highpass", freq: 5000, vol: .08 }); },
  fireBurst() { noise(1.4, { freq: 900, vol: .4, attack: .05 }); tone(60, .9, "sine", .3, 0, master, .5); },
  spray() { noise(1.6, { type: "highpass", freq: 1800, vol: .14, attack: .05 }); },
  grind(sec = 2.5) { if (!ctx || muted) return; noise(sec, { type: "bandpass", freq: 3200, q: 3, vol: .18, attack: .1 }); tone(2900, sec, "sawtooth", .02); },
  step() { noise(.08, { freq: 420 + Math.random() * 120, vol: .05 }); },
  type() { tone(1200 + Math.random() * 300, .02, "square", .012); },
  countdown() { tone(980, .07, "square", .035); },
};

export function startAlarm() {
  stopAlarm();
  if (!ctx || muted) return;
  let hi = false;
  alarmTimer = setInterval(() => { hi = !hi; tone(hi ? 880 : 660, .45, "square", .05); }, 500);
}
export function stopAlarm() { if (alarmTimer) clearInterval(alarmTimer); alarmTimer = null; }

// ---------------------------------------------------------------------------------------
// Ambience and positional sources
// ---------------------------------------------------------------------------------------
function panner(ref = 3, roll = 1.1) {
  const p = ctx.createPanner();
  p.panningModel = "HRTF"; p.distanceModel = "inverse"; p.refDistance = ref; p.rolloffFactor = roll; p.maxDistance = 80;
  p.connect(master);
  return p;
}
function setPos(p, x, y, z) {
  if (p.positionX) { p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; } else p.setPosition(x, y, z);
}
function loopNoise(type, freq, q, dest) {
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  s.connect(f).connect(g).connect(dest); s.start(0, Math.random() * 2);
  return { s, f, g };
}
function loopOsc(type, freq, dest, filt) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
  const g = ctx.createGain(); g.gain.value = 0;
  if (filt) { const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = filt; o.connect(f).connect(g); } else o.connect(g);
  g.connect(dest); o.start();
  return { o, g };
}

let amb = null;
export const ambience = {
  start() {
    if (!ctx || amb) return;
    const bed = ctx.createGain(); bed.gain.value = 0; bed.connect(master);
    bed.gain.setTargetAtTime(1, ctx.currentTime, 1.2);
    const rumble = loopNoise("lowpass", 160, .5, bed); rumble.g.gain.value = .22;
    const hiss = loopNoise("highpass", 5000, .5, bed); hiss.g.gain.value = .012;
    const hum1 = loopOsc("sine", 100, bed); hum1.g.gain.value = .035;
    const hum2 = loopOsc("triangle", 200, bed); hum2.g.gain.value = .008;
    // forklift: engine + reverse/travel beeper
    const fp = panner(2.5, 1.2);
    const engine = loopOsc("sawtooth", 48, fp, 380);
    // crane: motor whine
    const cp = panner(4, 1);
    const whine = loopOsc("sawtooth", 130, cp, 900);
    // crucible crackle and the potline heat roar
    const kp = panner(2, 1.4); setPos(kp, -9.4, 2.4, -6.1);
    const crackle = loopNoise("bandpass", 2600, 1.5, kp);
    // fire
    const firep = panner(4, 1);
    const roar = loopNoise("lowpass", 650, .6, firep);
    // heartbeat (not positional)
    const heart = ctx.createGain(); heart.gain.value = 0; heart.connect(master);
    amb = { bed, rumble, hiss, hum1, hum2, fp, engine, cp, whine, kp, crackle, firep, roar, heart, beep: 0, bell: 0, beat: 0, crk: 0 };
  },
  stop() {
    if (!amb) return;
    const a = amb; amb = null;
    a.bed.gain.setTargetAtTime(0, ctx.currentTime, .2);
    for (const g of [a.engine.g, a.whine.g, a.crackle.g, a.roar.g, a.heart]) g.gain.setTargetAtTime(0, ctx.currentTime, .1);
    setTimeout(() => {
      for (const n of [a.rumble.s, a.hiss.s, a.hum1.o, a.hum2.o, a.engine.o, a.whine.o, a.crackle.s, a.roar.s]) { try { n.stop(); } catch (_) {} }
    }, 800);
  },
  // s: { cam, fork: {on, x, z}, crane: {moving, x}, fire: {on, x, y, z}, danger: 0..1, slow: bool }
  update(dt, s) {
    if (!amb || !ctx) return;
    const now = ctx.currentTime, L = ctx.listener, c = s.cam;
    // listener follows the camera
    const fx = -Math.sin(c.yaw) * Math.cos(c.pitch), fy = Math.sin(c.pitch), fz = -Math.cos(c.yaw) * Math.cos(c.pitch);
    if (L.positionX) {
      L.positionX.value = c.x; L.positionY.value = c.y; L.positionZ.value = c.z;
      L.forwardX.value = fx; L.forwardY.value = fy; L.forwardZ.value = fz; L.upX.value = 0; L.upY.value = 1; L.upZ.value = 0;
    } else { L.setPosition(c.x, c.y, c.z); L.setOrientation(fx, fy, fz, 0, 1, 0); }
    // forklift
    setPos(amb.fp, s.fork.x, 1, s.fork.z);
    amb.engine.g.gain.setTargetAtTime(s.fork.on ? .14 : .02, now, .2);
    amb.engine.o.frequency.setTargetAtTime(s.fork.on ? 58 : 40, now, .3);
    if (s.fork.on && (amb.beep -= dt) <= 0) { amb.beep = .7; tone(1250, .18, "square", .05, 0, amb.fp); }
    // crane
    setPos(amb.cp, s.crane.x, 9, 0);
    amb.whine.g.gain.setTargetAtTime(s.crane.moving ? .05 : 0, now, .3);
    if (s.crane.moving && (amb.bell -= dt) <= 0) { amb.bell = 1.8; tone(1560, .5, "triangle", .07, 0, amb.cp); tone(2340, .3, "sine", .02, 0, amb.cp); }
    // crucible crackle: random spikes
    if ((amb.crk -= dt) <= 0) { amb.crk = .04 + Math.random() * .25; amb.crackle.g.gain.setTargetAtTime(Math.random() < .3 ? .18 : .02, now, .01); }
    // fire
    setPos(amb.firep, s.fire.x, s.fire.y, s.fire.z);
    amb.roar.g.gain.setTargetAtTime(s.fire.on ? .5 : 0, now, .4);
    // heartbeat
    const d = Math.max(0, Math.min(1, s.danger));
    if (d > .08 && (amb.beat -= dt) <= 0) {
      amb.beat = 1.05 - d * .6;
      const v = .12 + d * .3;
      tone(58, .16, "sine", v, 0, amb.heart); tone(52, .18, "sine", v * .75, .17, amb.heart);
      amb.heart.gain.setTargetAtTime(1, now, .05);
    }
  },
};
