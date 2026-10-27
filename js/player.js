// First-person player: keyboard + mouse on desktop, joystick + drag on touch screens.
export const EYE_HEIGHT = 1.65;
const RADIUS = 0.35;
const WALK = 3.2, RUN = 5.2;

export class Player {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.x = 0; this.z = 0; this.yaw = 0; this.pitch = 0;
    this.enabled = false;
    this.keys = new Set();
    this.stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
    this.look = { id: null, x: 0, y: 0 };
    this.onInteract = null;
    this.onPause = null;
    this._bind();
  }

  place(x, z, yaw) { this.x = x; this.z = z; this.yaw = yaw; this.pitch = -0.05; this._apply(); }

  _bind() {
    addEventListener("keydown", (e) => {
      if (!this.enabled) { if (e.key === "Escape" && this.onPause) this.onPause(); return; }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "KeyE" || e.code === "Enter") this.onInteract && this.onInteract();
      if (e.code === "Escape") this.onPause && this.onPause();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());

    const el = this.dom;
    el.addEventListener("click", (e) => {
      // mouse users: lock the pointer for comfortable look-around where supported
      if (this.enabled && this._lastPointer === "mouse" && el.requestPointerLock && !document.pointerLockElement) {
        try { const p = el.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) {}
      }
    });
    addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === el && this.enabled) this._turn(e.movementX * 0.0022, e.movementY * 0.0022);
    });
    el.addEventListener("pointerdown", (e) => {
      this._lastPointer = e.pointerType;
      if (!this.enabled || document.pointerLockElement === el) return;
      if (this.look.id === null) { this.look.id = e.pointerId; this.look.x = e.clientX; this.look.y = e.clientY; }
    });
    addEventListener("pointermove", (e) => {
      if (e.pointerId === this.look.id && this.enabled) {
        const k = e.pointerType === "touch" ? 0.0055 : 0.004;
        this._turn((e.clientX - this.look.x) * k, (e.clientY - this.look.y) * k);
        this.look.x = e.clientX; this.look.y = e.clientY;
      }
    });
    const endLook = (e) => { if (e.pointerId === this.look.id) this.look.id = null; };
    addEventListener("pointerup", endLook);
    addEventListener("pointercancel", endLook);
  }

  // Virtual joystick lives in the DOM; game.js wires it here.
  bindStick(base, knob) {
    const max = 46;
    const move = (e) => {
      if (e.pointerId !== this.stick.id) return;
      let dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      this.stick.x = dx / max; this.stick.y = dy / max;
    };
    const end = (e) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick.id = null; this.stick.x = this.stick.y = 0; knob.style.transform = "";
    };
    base.addEventListener("pointerdown", (e) => {
      e.preventDefault(); e.stopPropagation();
      const r = base.getBoundingClientRect();
      this.stick.id = e.pointerId; this.stick.ox = r.left + r.width / 2; this.stick.oy = r.top + r.height / 2;
      base.setPointerCapture && base.setPointerCapture(e.pointerId);
      move(e);
    });
    base.addEventListener("pointermove", move);
    base.addEventListener("pointerup", end);
    base.addEventListener("pointercancel", end);
  }

  releaseInput() {
    this.keys.clear(); this.look.id = null; this.stick.id = null; this.stick.x = this.stick.y = 0;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  _turn(dx, dy) {
    this.yaw -= dx;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dy));
  }

  update(dt, colliders) {
    if (!this.enabled) { this._apply(); return; }
    const k = this.keys;
    let f = 0, s = 0;
    if (k.has("KeyW") || k.has("ArrowUp")) f += 1;
    if (k.has("KeyS") || k.has("ArrowDown")) f -= 1;
    if (k.has("KeyD") || k.has("ArrowRight")) s += 1;
    if (k.has("KeyA") || k.has("ArrowLeft")) s -= 1;
    f -= this.stick.y; s += this.stick.x;
    const mag = Math.min(1, Math.hypot(f, s));
    if (mag > 0.05) {
      const speed = (k.has("ShiftLeft") || k.has("ShiftRight") || Math.hypot(this.stick.x, this.stick.y) > .92 ? RUN : WALK) * mag;
      const len = Math.hypot(f, s); f /= len; s /= len;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const vx = (-sin * f + cos * s) * speed * dt;
      const vz = (-cos * f - sin * s) * speed * dt;
      this._tryMove(vx, 0, colliders);
      this._tryMove(0, vz, colliders);
    }
    this._apply();
  }

  _tryMove(dx, dz, colliders) {
    const nx = this.x + dx, nz = this.z + dz;
    for (const c of colliders) {
      if (nx > c.minX - RADIUS && nx < c.maxX + RADIUS && nz > c.minZ - RADIUS && nz < c.maxZ + RADIUS) return;
    }
    this.x = nx; this.z = nz;
  }

  _apply() {
    this.camera.position.set(this.x, EYE_HEIGHT, this.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
}
