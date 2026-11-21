// Cinematic camera work: the mission opening shot and the incident replay.
// The incident replay is the heart of v6: when the trainee breaks a rule, time slows, the
// camera leaves their eyes, shows them from outside and plays what was about to happen. It
// freezes just before the moment of harm (nothing graphic is shown), then rewinds to safety.
import * as THREE from "./vendor/three.module.min.js?v=6";
import * as A from "./assets.js?v=6";
import { $ } from "./ui.js?v=6";
import { sfx, setMuffle } from "./audio.js?v=6";
import { t, tx } from "./i18n.js?v=6";
import { VIOLATIONS, REPLAY_TEXT } from "./content.js?v=6";

const ease = (k) => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
const clamp01 = (k) => Math.max(0, Math.min(1, k));
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _look = new THREE.Vector3();

export class Cinema {
  constructor(game) {
    this.g = game;
    this.shot = null;
    const skip = (e) => { if (this.shot && this.shot.skippable && this.shot.t > .35) { e && e.preventDefault && e.preventDefault(); this.finish(); } };
    $("#cine").addEventListener("pointerup", skip);
    addEventListener("keydown", (e) => { if (this.shot && (e.code === "Space" || e.code === "Enter" || e.code === "Escape" || e.code === "KeyE")) skip(e); });
  }
  get active() { return !!this.shot; }

  bars(on, { tag = "", title = "", sub = "", tone = "" } = {}) {
    const c = $("#cine");
    document.body.classList.toggle("cine", on);
    if (on) {
      c.hidden = false; c.className = tone;
      c.querySelector("small").textContent = tag; c.querySelector("b").textContent = title; c.querySelector("p").textContent = sub;
      c.querySelector(".cap").classList.remove("in");
      requestAnimationFrame(() => c.classList.add("on"));
    } else { c.classList.remove("on"); setTimeout(() => { if (!this.shot) c.hidden = true; }, 450); }
  }
  caption(on) { $("#cine .cap").classList.toggle("in", on); }

  // Opening shot: a sweeping move from high above the mission area down into the trainee's eyes.
  intro({ x, z, yaw, focus, num, name, onDone }) {
    const g = this.g, eyeY = 1.65;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const fp = focus || { x: x + fx * 10, z: z + fz * 10 };
    // start behind and above, offset to the side, kept inside the hall
    const sx = Math.max(-38, Math.min(38, x - fx * 9 + fz * 7)), sz = Math.max(-13, Math.min(13, z - fz * 9 - fx * 7));
    const from = new THREE.Vector3(sx, 9.5, sz), to = new THREE.Vector3(x, eyeY, z);
    const lookFrom = new THREE.Vector3(fp.x, 1.2, fp.z), lookTo = new THREE.Vector3(x + fx * 10, eyeY - .5, z + fz * 10);
    this.bars(true, { tag: num, title: name, sub: t("cineSkip") });
    setTimeout(() => this.shot && this.caption(true), 350);
    sfx.whoosh();
    this.shot = {
      kind: "intro", t: 0, dur: 3.6, skippable: true, onDone,
      update: (dt, s) => {
        const k = ease(clamp01(s.t / s.dur));
        _a.lerpVectors(from, to, k);
        _a.y += Math.sin(k * Math.PI) * 1.2;
        _look.lerpVectors(lookFrom, lookTo, clamp01((s.t / s.dur - .25) / .75));
        g.camera.position.copy(_a); g.camera.lookAt(_look);
        if (g.post) g.post.u.vig.value = .55 + (1 - k) * .3;
        if (s.t > s.dur - .7) this.caption(false);
        return s.t >= s.dur;
      },
    };
  }

  // Incident replay. `focus` is where the hazard is; `kind` picks the consequence shown.
  replay(kind, { focus, onDone }) {
    const g = this.g, p = g.player, M = g.world.materials;
    const objs = [];
    const add = (o) => { g.scene.add(o); objs.push(o); return o; };
    const ax = p.x, az = p.z, feet = p.feet, yaw = p.yaw;
    const eye = new THREE.Vector3(ax, feet + 1.65, az);
    // "you": a worker model standing where the trainee was
    const me = add(A.worker(M));
    me.position.set(ax, feet, az); me.rotation.y = yaw + Math.PI;
    const ring = add(new THREE.Mesh(new THREE.RingGeometry(.55, .7, 40), new THREE.MeshBasicMaterial({ color: 0xff3b2f, transparent: true, opacity: .9, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2; ring.position.set(ax, feet + .03, az);
    const hz = focus ? new THREE.Vector3(focus.x, focus.y ?? 1.2, focus.z) : new THREE.Vector3(ax - Math.sin(yaw) * 3, 1.2, az - Math.cos(yaw) * 3);
    // camera: to the side of the line between hazard and trainee, so both are in frame
    let ang = Math.atan2(ax - hz.x, az - hz.z);
    if (!isFinite(ang) || (Math.abs(ax - hz.x) + Math.abs(az - hz.z)) < .2) ang = yaw;
    const R = kind === "fall" ? 5 : 6.2, H = kind === "fall" ? feet + 1.2 : feet + 3.1;
    // pick a camera side with nothing solid between the camera and the trainee
    const blocked = (a) => {
      const cx = ax + Math.sin(a) * R, cz = az + Math.cos(a) * R;
      if (cx < -39.2 || cx > 39.2 || cz < -14.2 || cz > 14.2) return true;
      for (const c of g.world.colliders) {
        if ((c.top ?? 99) < 1.4 || c.minX > 900) continue;
        for (let k = .12; k < .9; k += .08) { const x = cx + (ax - cx) * k, z = cz + (az - cz) * k; if (x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ) return true; }
      }
      return false;
    };
    const side = ang + ([1.15, -1.15, .7, -.7, 1.7, -1.7, 2.4, -2.4].find((o) => !blocked(o + ang) && !blocked(o + ang + .35)) ?? 1.15);
    const camAt = (k) => {
      const a = side + k * .35;
      return _b.set(Math.max(-39.2, Math.min(39.2, ax + Math.sin(a) * R)), H, Math.max(-14.2, Math.min(14.2, az + Math.cos(a) * R)));
    };
    const mid = new THREE.Vector3().lerpVectors(new THREE.Vector3(ax, feet + 1, az), hz, .38);

    // the consequence
    let anim = () => 1, hold = .0;
    if (kind === "crane") {
      const load = add(new THREE.Mesh(new THREE.BoxGeometry(1.6, .7, 3), M.carbon));
      const y0 = feet + 3.4; load.position.set(ax, y0, az);
      const cable = add(new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, 6, 6), M.rubber)); cable.position.set(ax, y0 + 3.4, az);
      anim = (k) => {           // swings, slips, drops: freezes just above the head
        const sw = Math.sin(k * 14) * .12 * (1 - k);
        const drop = k < .45 ? 0 : Math.pow((k - .45) / .55, 2) * (y0 - (feet + 2.15));
        load.position.set(ax + sw, y0 - drop, az); load.rotation.z = sw * .6 + (k > .45 ? (k - .45) * .5 : 0);
        cable.visible = k < .45;
        return k;
      };
    } else if (kind === "forklift" || kind === "noLook" || kind === "aisle") {
      const fk = add(A.forklift(M));
      const dir = (focus && focus.dirX) || (ax > 0 ? -1 : 1);
      const start = ax - dir * 11, stop = ax - dir * 2.25;
      fk.rotation.y = dir > 0 ? 0 : Math.PI; fk.position.set(start, 0, az);
      anim = (k) => { fk.position.x = start + (stop - start) * (1 - Math.pow(1 - k, 1.6)); return k; };
    } else if (kind === "fire") {
      const balls = [];
      for (let i = 0; i < 9; i++) {
        const m = add(new THREE.Mesh(new THREE.SphereGeometry(.6 + Math.random() * .5, 12, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff6a10 : 0xffb030, transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false })));
        m.userData.o = new THREE.Vector3((Math.random() - .5) * 1.4, Math.random() * 1.2, (Math.random() - .5) * 1.4); balls.push(m);
      }
      anim = (k) => {
        balls.forEach((m, i) => {
          const kk = clamp01(k * 1.15 - i * .02);
          m.position.lerpVectors(hz, _a.set(ax, feet + 1, az), kk * .72).add(m.userData.o);
          m.scale.setScalar(.35 + kk * .9);
        });
        return k;
      };
    } else if (kind === "fall") {
      anim = (k) => { me.rotation.order = "YXZ"; me.rotation.x = -k * .55; me.position.z = az - k * .3; return k; };
    } else {
      // restricted area: heat and magnetic field rings closing in
      const rings = [];
      for (let i = 0; i < 4; i++) {
        const r = add(new THREE.Mesh(new THREE.TorusGeometry(1.6, .03, 6, 48), new THREE.MeshBasicMaterial({ color: 0xff7a2a, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false })));
        r.rotation.x = Math.PI / 2; rings.push(r);
      }
      anim = (k) => {
        rings.forEach((r, i) => { const f = (k * 2 + i / 4) % 1; r.position.set(ax, feet + .2 + f * 1.8, az); r.scale.setScalar(2.2 - f * 1.5); r.material.opacity = .9 * (1 - f); });
        me.traverse((o) => { if (o.material && o.material.emissive && !o.userData.hot) { o.material = o.material.clone(); o.userData.hot = 1; } if (o.userData.hot) o.material.emissive.setRGB(k * .9, k * .2, 0); });
        return k;
      };
      hold = .2;
    }

    const v = VIOLATIONS[kind] || {};
    const rt = REPLAY_TEXT[kind] || REPLAY_TEXT.default;
    this.bars(true, { tag: t("replayTag"), title: tx(v.t) || "", sub: tx(rt), tone: "bad" });
    setMuffle(.55); sfx.whoosh();
    if (g.canvas && !(g.post && g.post.enabled)) g.canvas.classList.add("replay");
    const T_OUT = .8, T_PLAY = 2.0, T_FREEZE = 1.5 + hold, T_REW = .9;
    let froze = false, rewound = false;
    this.shot = {
      kind: "replay", t: 0, dur: T_OUT + T_PLAY + T_FREEZE + T_REW, skippable: true, onDone, objs,
      update: (dt, s) => {
        const tt = s.t, post = g.post && g.post.enabled ? g.post.u : null;
        ring.material.opacity = .5 + Math.sin(tt * 8) * .4;
        if (tt < T_OUT) {                                      // pull out of the eyes
          const k = ease(tt / T_OUT);
          g.camera.position.lerpVectors(eye, camAt(0), k);
          _look.lerpVectors(_a.set(ax - Math.sin(yaw) * 4, eye.y - .2, az - Math.cos(yaw) * 4), mid, k);
          g.camera.lookAt(_look);
          if (post) { post.desat.value = k * .75; post.vig.value = .55 + k * .35; }
        } else if (tt < T_OUT + T_PLAY) {                      // play the consequence
          const k = (tt - T_OUT) / T_PLAY;
          anim(k);
          g.camera.position.copy(camAt(k)); g.camera.lookAt(mid);
        } else if (tt < T_OUT + T_PLAY + T_FREEZE) {           // freeze before harm
          if (!froze) { froze = true; anim(1); sfx.freeze(); this.caption(true); g.shake = .25; }
          g.camera.position.copy(camAt(1)); g.camera.lookAt(mid);
          if (post) post.aberr.value = Math.min(1, post.aberr.value + dt * 3);
        } else {                                               // rewind back to the eyes
          if (!rewound) { rewound = true; sfx.rewind(); this.caption(false); }
          const k = ease((tt - T_OUT - T_PLAY - T_FREEZE) / T_REW);
          anim(1 - k);
          g.camera.position.lerpVectors(camAt(1).clone(), eye, k);
          _look.lerpVectors(mid, _a.set(ax - Math.sin(yaw) * 4, eye.y - .2, az - Math.cos(yaw) * 4), k);
          g.camera.lookAt(_look);
          if (post) { post.rewind.value = 1 - k * .6; post.desat.value = .75 * (1 - k); post.aberr.value = 1 - k; }
        }
        return tt >= s.dur;
      },
      cleanup: () => {
        objs.forEach((o) => { g.scene.remove(o); o.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); });
        if (g.post) { const u = g.post.u; u.desat.value = 0; u.rewind.value = 0; u.aberr.value = 0; u.vig.value = .55; }
        setMuffle(0);
        if (g.canvas) g.canvas.classList.remove("replay");
      },
    };
  }

  update(dt) {
    const s = this.shot;
    if (!s) return false;
    s.t += dt;
    if (s.update(dt, s)) this.finish();
    return true;
  }

  finish() {
    const s = this.shot;
    if (!s) return;
    this.shot = null;
    s.cleanup && s.cleanup();
    if (this.g.post) this.g.post.u.vig.value = .55;
    this.bars(false);
    s.onDone && s.onDone();
  }

  // Abort without running the callback (mission restarted or exited).
  cancel() { const s = this.shot; if (!s) return; this.shot = null; s.cleanup && s.cleanup(); this.bars(false); }
}
