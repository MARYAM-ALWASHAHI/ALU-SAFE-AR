// Cinematic post-processing, written for this game (no extra libraries):
// HDR scene buffer -> two-level bloom -> filmic tone mapping, colour grade, vignette and grain.
// It also drives the incident-replay look (desaturation, red danger edge, rewind lines).
// On "Low" quality it is switched off and the scene renders straight to the screen.
import * as THREE from "./vendor/three.module.min.js?v=6";

const VERT = `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const BRIGHT = `
uniform sampler2D tIn; uniform float threshold; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tIn, vUv).rgb;
  float l = dot(c, vec3(.2126, .7152, .0722));
  gl_FragColor = vec4(c * smoothstep(threshold, threshold + .8, l), 1.0);
}`;

const BLUR = `
uniform sampler2D tIn; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec3 s = texture2D(tIn, vUv).rgb * .227027;
  s += texture2D(tIn, vUv + dir * 1.3846).rgb * .316216;
  s += texture2D(tIn, vUv - dir * 1.3846).rgb * .316216;
  s += texture2D(tIn, vUv + dir * 3.2308).rgb * .070270;
  s += texture2D(tIn, vUv - dir * 3.2308).rgb * .070270;
  gl_FragColor = vec4(s, 1.0);
}`;

const COMPOSITE = `
uniform sampler2D tScene, tB1, tB2; uniform vec2 res;
uniform float exposure, bloom, danger, desat, rewind, time, aberr, grain, vig;
uniform vec3 dangerCol; uniform vec2 dangerDir;
varying vec2 vUv;
vec3 RRTAndODTFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081; return a / b; }
vec3 aces(vec3 c) {
  const mat3 IM = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
  const mat3 OM = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
  c *= exposure / 0.6; c = IM * c; c = RRTAndODTFit(c); c = OM * c; return clamp(c, 0.0, 1.0);
}
vec3 srgb(vec3 c) { return mix(pow(c, vec3(0.41666)) * 1.055 - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308)))); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 uv = vUv;
  // rewind: horizontal tearing bands
  if (rewind > 0.0) {
    float band = step(.92, fract(uv.y * 7.0 + time * 3.1));
    uv.x += (band * .02 + sin(uv.y * 90.0 + time * 40.0) * .0015) * rewind;
  }
  vec2 off = (uv - .5) * aberr * .012;
  vec3 c;
  c.r = texture2D(tScene, uv + off).r;
  c.g = texture2D(tScene, uv).g;
  c.b = texture2D(tScene, uv - off).b;
  c += (texture2D(tB1, uv).rgb * .9 + texture2D(tB2, uv).rgb * 1.2) * bloom;
  c = aces(c);
  // grade: cool shadows, warm highlights, a touch of contrast
  float l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(c * vec3(.94, 1.0, 1.06), c * vec3(1.05, 1.0, .93), smoothstep(.25, .8, l));
  c = mix(vec3(l), c, 1.08);
  c = (c - .5) * 1.05 + .5;
  // incident replay look
  l = dot(c, vec3(.2126, .7152, .0722));
  c = mix(c, vec3(l) * vec3(1.06, .98, .92), desat);
  vec2 q = vUv - .5;
  float r = length(q * vec2(res.x / res.y, 1.0));
  c *= 1.0 - smoothstep(.45, 1.15, r) * vig;
  // danger edge: stronger on the side the hazard is on
  float side = .55 + .45 * dot(normalize(q + 1e-4), dangerDir);
  float edge = smoothstep(.35, .95, r) * danger * mix(1.0, side, step(.01, length(dangerDir)));
  c = mix(c, dangerCol, clamp(edge, 0.0, .75));
  if (rewind > 0.0) {
    c = mix(c, c * vec3(.8, .95, 1.1) + .04, rewind);
    c *= 1.0 - .18 * rewind * step(.5, fract(gl_FragCoord.y * .5));
  }
  c = srgb(c);
  c += (hash(gl_FragCoord.xy + fract(time) * 100.0) - .5) * grain;
  gl_FragColor = vec4(c, 1.0);
}`;

export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = false;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));
    this.quad = new THREE.Mesh(geo, null); this.quad.frustumCulled = false;
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    const mk = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });
    this.mBright = mk(BRIGHT, { tIn: { value: null }, threshold: { value: 1.35 } });
    this.mBlur = mk(BLUR, { tIn: { value: null }, dir: { value: new THREE.Vector2() } });
    this.u = {
      tScene: { value: null }, tB1: { value: null }, tB2: { value: null }, res: { value: new THREE.Vector2(1, 1) },
      exposure: { value: 1.0 }, bloom: { value: .8 }, danger: { value: 0 }, desat: { value: 0 }, rewind: { value: 0 },
      time: { value: 0 }, aberr: { value: 0 }, grain: { value: .035 }, vig: { value: .55 },
      dangerCol: { value: new THREE.Color(0.75, 0.06, 0.04) }, dangerDir: { value: new THREE.Vector2() },
    };
    this.mComp = mk(COMPOSITE, this.u);
    this.rt = null;
  }

  // quality: "low" (off), "medium" (bloom at low resolution), "high" (sharper bloom, MSAA)
  configure(quality) {
    this.quality = quality;
    this.enabled = quality !== "low";
    this.dispose();
    this.resize();
  }

  resize() {
    if (!this.enabled) return;
    const r = this.renderer, s = r.getDrawingBufferSize(new THREE.Vector2());
    const w = Math.max(2, s.x), h = Math.max(2, s.y);
    this.u.res.value.set(w, h);
    const msaa = r.capabilities.isWebGL2 && this.quality === "high" ? 4 : 0;
    const opt = { type: THREE.HalfFloatType, depthBuffer: false, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter };
    if (!this.rt) {
      this.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: msaa });
      const d1 = this.quality === "high" ? 3 : 4;
      this.b1a = new THREE.WebGLRenderTarget(1, 1, opt); this.b1b = new THREE.WebGLRenderTarget(1, 1, opt);
      this.b2a = new THREE.WebGLRenderTarget(1, 1, opt); this.b2b = new THREE.WebGLRenderTarget(1, 1, opt);
      this.d1 = d1;
    }
    this.rt.setSize(w, h);
    const w1 = Math.max(2, w / this.d1 | 0), h1 = Math.max(2, h / this.d1 | 0);
    this.b1a.setSize(w1, h1); this.b1b.setSize(w1, h1);
    this.b2a.setSize(Math.max(2, w1 / 2 | 0), Math.max(2, h1 / 2 | 0)); this.b2b.setSize(Math.max(2, w1 / 2 | 0), Math.max(2, h1 / 2 | 0));
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qscene, this.cam);
  }

  blur(src, tmp, w, h, radius) {
    this.mBlur.uniforms.tIn.value = src.texture; this.mBlur.uniforms.dir.value.set(radius / w, 0); this.pass(this.mBlur, tmp);
    this.mBlur.uniforms.tIn.value = tmp.texture; this.mBlur.uniforms.dir.value.set(0, radius / h); this.pass(this.mBlur, src);
  }

  render(scene, camera, dt) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    this.u.time.value += dt;
    r.setRenderTarget(this.rt);
    r.render(scene, camera);
    // bloom level 1
    this.mBright.uniforms.tIn.value = this.rt.texture; this.pass(this.mBright, this.b1a);
    this.blur(this.b1a, this.b1b, this.b1a.width, this.b1a.height, 1.2);
    // bloom level 2 (wider)
    this.mBlur.uniforms.tIn.value = this.b1a.texture; this.mBlur.uniforms.dir.value.set(0, 0); this.pass(this.mBlur, this.b2a);
    this.blur(this.b2a, this.b2b, this.b2a.width, this.b2a.height, 1.6);
    this.blur(this.b2a, this.b2b, this.b2a.width, this.b2a.height, 2.4);
    this.u.tScene.value = this.rt.texture; this.u.tB1.value = this.b1a.texture; this.u.tB2.value = this.b2a.texture;
    this.pass(this.mComp, null);
  }

  dispose() {
    for (const k of ["rt", "b1a", "b1b", "b2a", "b2b"]) { if (this[k]) this[k].dispose(); this[k] = null; }
  }
}
