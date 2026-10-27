# ALU-SAFE AR: industrial safety training game (prototype)

A browser-based 3D safety training game set in a **fictional** aluminium smelter potroom.
It does not represent any real company, facility or procedure. All training content is
sample content and must be reviewed and approved by qualified HSE personnel before real use.

Status: eight playable missions with a mission-select screen and saved progress, a detailed
procedural 3D hall, a camera simulation mode for iPhone, iPad and Android, and a real WebXR AR mode
for Android phones that support it. All logic is tested in emulation; nothing is tested on real
devices yet (see "What was tested").

## What is in the game

Missions unlock one after another. Each has its own objectives, a briefing, checkpoints, a score
out of 100, success and failure conditions, and Replay / Next mission buttons. Progress (completed,
best score, stars) is saved in the browser.

| # | Mission | What you do | How it can go wrong |
|---|---|---|---|
| 1 | Safety Induction | Read the induction board, find the emergency exit, a fire alarm call point and the eyewash, then walk out to the assembly point | Walking in the vehicle aisle outside a crossing, or under the crane load |
| 2 | PPE Challenge | Choose the PPE set, then inspect five 3D items on a bench and use or tag out each one (defects are random), then pass the checkpoint barrier | Wrong PPE set, using damaged PPE, tagging out good PPE |
| 3 | Hazard Hunter | Against the clock, inspect ten spots along the walkway and in the workshop and classify each one. Which spots are hazards changes every run | Wrong category, false alarms, missed hazards; the mission fails when time runs out |
| 4 | Moving Machinery | Carry a toolbox across a live aisle with a moving forklift and crane: stop at the line, look left and right, cross on the zebra, hand over, and come back the same way | Crossing without looking, being struck by the forklift, walking under the load |
| 5 | Molten Metal Safety | Make the tapping bay safe before a crucible moves: close the water valve, take the wet tool to the drying rack, get the worker out of the line of fire, put on the face shield, then give the ready signal | Signalling early causes a steam explosion and fails the mission |
| 6 | High-Risk Work | Permit, isolate the right conveyor (two isolators, positions swap each run), lock and tag, test start, climb the platform, clip on, clear the jam | Wrong isolator, no lock, skipping the test, going near the open edge unclipped; some of these fail the mission |
| 7 | Emergency Response | A fire starts in a random place. Find and use the nearest call point, evacuate within the time while a smoke-exposure meter rises near the smoke, then report a missing colleague to the warden | Approaching the fire, too much smoke, running out of time |
| 8 | Final Safety Mission | A full shift: PPE, collect a permit and take it to the control room through live traffic, report hazards on the way, then an emergency evacuation | All of the above |

Rules that apply in every mission where they are switched on: walking under the crane load,
entering the restricted area, walking in the vehicle aisle outside a crossing, getting in the
forklift's path and going too close to a fire. Each costs 20 points, shows what happened and steps
you back to the last safe position.

Difficulty: **Guided** (markers, guidance arrow, visible crane danger zone, most time),
**Standard** (markers and arrow, faster crane and forklift), **Expert** (no markers or arrow,
fastest vehicles, least time, more hazards). Graphics quality: Low, Medium or High (High adds
shadows). Low also turns off light shafts.

## Controls

| Device | Move | Look | Interact | Pause |
|---|---|---|---|---|
| Computer | W A S D or arrow keys, Shift to walk faster | Drag, or click to lock the mouse | E or Enter | Esc or the pause button |
| Phone and tablet | Joystick, bottom left | Drag anywhere else | Interact button (appears near a task), or tap the object | Pause button |

Objects you can use carry a small teal diamond (Guided and Standard). When you look at one
nearby, its name appears above it and the Interact button shows the action.

## Project files

```
index.html            page shell and all screens
css/app.css           styles, responsive layout, RTL support
js/main.js            boot, WebGL check, menus, mission select, settings, AR mode picker
js/game.js            engine: loop, safety rules, interaction, HUD, scoring, mission runner
js/missions.js        the eight missions (setup and per-frame logic)
js/content.js         ALL training text, hazards, difficulty and scoring (the file HSE reviews)
js/world.js           procedural 3D potroom layout, crane, forklift, fire, lighting
js/assets.js          procedural industrial models (pots, platform, rails, panels, workers…)
js/textures.js        procedural textures (concrete, painted steel, signs, boards)
js/player.js          first-person movement, height-aware collisions, keyboard, mouse, touch
js/xr.js              real AR with WebXR (hit-test and dom-overlay)
js/ar.js              camera simulation: live camera, orientation sensors, step counter
js/i18n.js            English and Arabic interface text
js/ui.js              dialogs, toasts, icons
js/audio.js           synthesised sound cues (no audio files)
js/storage.js         settings and mission progress; swap point for a future server
js/vendor/            three.js r160, RoomEnvironment, BufferGeometryUtils (MIT)
```

No build step and no dependencies to install. Everything is plain HTML, CSS and JavaScript modules.

## Run it locally

ES modules do not load from `file://`, so serve the folder over HTTP:

```bash
cd alu-safe-ar
python3 -m http.server 8080
# then open http://localhost:8080
```

Any static server works (`npx serve`, IIS, nginx, Apache).

## Deploy over HTTPS

The game is a static site. Upload the whole folder to any static host with HTTPS:

- **Internal web server** (IIS, nginx, Apache): copy the folder into the web root, serve it under an HTTPS virtual host with your organisation's certificate. Set `Content-Type: text/javascript` for `.js` files (the default on all three).
- **Cloud static hosting** (for example Azure Static Web Apps, AWS S3 with CloudFront, Netlify, GitHub Pages): upload the folder as-is; HTTPS is provided by the host.

Recommended response headers:

```
Strict-Transport-Security: max-age=31536000
Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; script-src 'self'
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(self), xr-spatial-tracking=(self)
```

For a fully offline or locked-down network, download the two Google Fonts and serve them locally, then remove `fonts.googleapis.com` from the page and the policy. The game falls back to system fonts if they are blocked.

HTTPS matters for later phases: camera access and WebXR only work on secure (HTTPS) pages.

## Browser support

| Platform | Browser | 3D game | AR (WebXR) |
|---|---|---|---|
| iPhone, iPad (iOS / iPadOS 16+) | Safari, Chrome, Edge (all use WebKit) | Yes | No: WebKit has no WebXR AR |
| Android phones and tablets | Chrome, Edge | Yes | Chrome on ARCore-supported devices |
| Windows | Chrome, Edge, Firefox | Yes | No (no AR camera) |
| macOS | Safari, Chrome, Edge | Yes | No |

If WebGL is missing, the game shows an "unsupported device" screen instead of failing silently.
If loading fails, it shows an error screen with a reload button.

## What was tested

Tested in Chromium (Playwright, software WebGL, so frame rates in testing are not meaningful):

- **Every mission played to completion by script**, including the failure and violation paths:
  aisle violation (1), wrong PPE set and the inspection bench (2), all ten hazard spots (3),
  crossing without looking and a forklift strike (4), signalling early and failing, then the full
  safe sequence (5), wrong isolator found by the test, the unclipped-edge rule and walking up the
  stairs (6), raising the alarm and evacuating with the timer (7), and the full shift (8).
- Screenshots and layout checks at desktop (1280×760), iPhone 13 portrait and landscape, and the
  mission-select screen in Arabic and English. No script errors and no horizontal scrolling.
- Camera simulation on the iPhone size with a simulated camera and orientation events.
- Real AR: only the support check was tested (Chromium reports no `immersive-ar`, so the option is
  shown as unavailable). **The WebXR session itself has not been run**, because it needs a real
  ARCore phone.

**Not yet tested on physical devices.** Emulation checks layout, touch input and logic, but not
real Safari, real GPU performance, or real WebXR. Before a pilot, test on at least one real iPhone,
iPad, Android phone, Windows PC and Mac.

## AR modes: what works where

The **AR mode** button opens a picker with two modes. The picker checks
`navigator.xr.isSessionSupported("immersive-ar")` and only enables real AR when it returns true.

**Real AR (WebXR)**: Chrome on ARCore-supported Android phones, opened directly over HTTPS.

- The phone detects real surfaces (`hit-test`). A ring shows where a surface was found; tap to
  place a 2.4 m training area on the floor or a table.
- Four virtual hazards stand on that surface: a fire, molten metal with leaking water, a hose
  across a walkway and a suspended load. Walk around them and tap one to choose an action. Wrong
  choices show a consequence on the object; right choices make it safe.
- Choice cards use `dom-overlay`. Not available on iPhone or iPad: Safari has no WebXR AR.

**Camera simulation**: Safari on iPhone and iPad, and Chrome on Android.

- The rear camera shows live behind four 3D hazards placed around you, following the device's
  orientation. Steps (or the Step forward button) move you closer.
- It does not detect floors or objects, so the game labels it **camera simulation**, not AR.
- Needs HTTPS and camera and motion permission. Inside a preview window the camera is blocked and
  a virtual floor is shown instead.

For surface-anchored AR on Apple devices the options are a native app (ARKit), Apple Quick Look
with USDZ models (view only, no game logic), or a commercial WebAR engine with its own tracking.

## Roadmap

**Next: real-device check of the WebXR mode** on an ARCore Android phone, then more AR
scenarios (for example placing barriers around a spill).

**Phase 5: device testing.** Real-device test matrix (iPhone, iPad, Android phone and tablet,
Windows, Mac), performance tuning (target 30+ fps on mid-range phones), accessibility review
(screen reader labels, contrast, captions for sound cues).

**Phase 6: internal deployment.** Host on the organisation's HTTPS web server or cloud tenant,
behind single sign-on if required. Load `content.js` from an HSE-approved content file so trainers
can update scenarios without code changes, with version and approval fields shown in the game.

**Later: accounts, progress reports and admin dashboard.**

- Sign-in through the organisation's identity provider (OpenID Connect / SAML), so no new passwords.
- A small API (for example `POST /attempts`, `GET /me/progress`) storing attempt results on the server. `js/storage.js` is the single place to swap from browser storage to that API.
- Admin dashboard: completion by team, average score per mission, most common violations, export to the LMS (SCORM or xAPI).
- Privacy: store only what training records need, keep it server-side, define retention, and never put personal data in browser storage or client code.

## Licences

three.js, RoomEnvironment and BufferGeometryUtils are MIT licensed (see `js/vendor/three.LICENSE.txt`). Fonts: Inter and IBM Plex Sans
Arabic from Google Fonts (SIL Open Font Licence). All other code and graphics were written for
this prototype.
