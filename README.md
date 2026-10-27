# ALU-SAFE AR: industrial safety training game (prototype)

A browser-based 3D safety training game set in a **fictional** aluminium smelter potroom.
It does not represent any real company, facility or procedure. All training content is
sample content and must be reviewed and approved by qualified HSE personnel before real use.

Status: Phase 1 (interface) and Phase 2 (3D environment and missions) are built and tested,
including scoring, progress tracking and results. A camera mode for iPhone, iPad and Android
shows hazards over the live camera (see below). Surface-detecting AR is not built yet.

## What is in the game

Six missions, played in order in a first-person 3D hall:

1. **PPE check**: choose the right PPE set at the PPE station (two unsuitable items are included).
2. **Blocked walkway**: decide what to do about a hose and cables across the walkway.
3. **Overhead crane**: cross the crane aisle without walking under the moving load.
4. **Molten metal and water**: a leaking hose near a crucible. Choose the safe action.
5. **Restricted area**: reach the control room without entering the marked restricted area.
6. **Emergency evacuation**: respond to the alarm, then reach the outdoor assembly point before the timer runs out, keeping away from the fire.

Rules apply everywhere in the hall: walking under the crane load, entering the restricted area or
going near the fire counts as a violation (−25 points), shows what happened and steps you back.
Unsafe choices show their consequence and let you try again. Scores: 100 for the first try,
50 for the second, 20 after that; maximum 600.

Difficulty: **Guided** (markers, guidance arrow, visible crane danger zone, 150 s to evacuate),
**Standard** (markers and arrow, faster crane, 110 s), **Expert** (no arrow or danger zone,
fastest crane, 80 s). Graphics quality: Low, Medium or High (High adds shadows).

## Controls

| Device | Move | Look | Interact | Pause |
|---|---|---|---|---|
| Computer | W A S D or arrow keys, Shift to walk faster | Drag, or click to lock the mouse | E or Enter | Esc or the pause button |
| Phone and tablet | Joystick, bottom left | Drag anywhere else | Interact button (appears near a task) | Pause button |

## Project files

```
index.html            page shell and all screens
css/app.css           styles, responsive layout, RTL support
js/main.js            boot, WebGL check, menus, settings, results
js/ar.js              camera mode: live camera, orientation sensors, step counter, 4 hazards
js/game.js            game loop, missions, rules, scoring, HUD
js/world.js           procedural 3D potroom (no external models or textures)
js/player.js          first-person movement, collisions, keyboard, mouse and touch input
js/content.js         ALL training content, difficulty and scoring (the file HSE reviews)
js/i18n.js            English and Arabic interface text
js/ui.js              dialogs, toasts, icons
js/audio.js           synthesised sound cues (no audio files)
js/storage.js         settings and best score; swap point for a future server
js/vendor/three.module.min.js   three.js r160 (MIT licence, included so no CDN is needed)
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

Tested in Chromium (Playwright, software WebGL) with device emulation for a desktop screen
(1366×800), iPhone 13 (portrait, touch), iPad (landscape, touch) and Pixel 7 (touch). On each, a
script played the full game: joystick or keyboard movement, drag-to-look, PPE selection with a
wrong attempt, wrong and right answers for every choice mission, a crane violation, a restricted
area violation, the emergency choice, the evacuation, the results screen, return to the menu, and
the How to play, Settings and AR dialogs. Camera mode was tested on the iPhone size with a
simulated camera and simulated orientation events: camera feed, walking closer, tapping a hazard,
a wrong and a right choice, turning to the next hazard and exiting. No script errors and no
horizontal scrolling were found.

**Not yet tested on physical devices.** Emulation checks layout, touch input and logic, but not
real Safari, real GPU performance, or real WebXR. Before a pilot, test on at least one real iPhone,
iPad, Android phone, Windows PC and Mac.

## Camera mode and AR: what works where

**Camera mode** (the "AR mode" button on the home screen) works in Safari on iPhone and iPad,
and in Chrome on Android:

- The rear camera shows live behind four 3D hazards placed around you: a fire, molten metal near
  water, a hose across the walkway, and a suspended crane load.
- The view follows the device's orientation sensors. Each step counted by the motion sensor, or
  each press of **Step forward**, moves you closer to the hazard in front of you.
- When you are close, tap the hazard and choose an action. Wrong choices show what happens (the
  fire grows, steam bursts, the load drops), then you try again.
- Requirements: the page must be opened over HTTPS (for example the GitHub Pages link), and the
  trainee must allow camera and motion access. Inside the claude.ai preview the camera is blocked,
  so the mode falls back to a virtual floor and drag-to-look.

This is labelled **camera simulation** in the game, not AR. It does not detect floors, walls or
real objects; hazards stay fixed in a direction around you, and distance comes from steps, not tracking.

**True AR with surface detection** (WebXR `immersive-ar` with `hit-test`) currently works only in
Chrome on ARCore-supported Android phones. Safari on iPhone and iPad has no WebXR AR. To get
surface-anchored AR on Apple devices, the options are a native app (ARKit), Apple Quick Look with
USDZ models (view only, no game logic), or a commercial WebAR engine with its own tracking.

## Roadmap

**Phase 4b: surface-anchored AR (next).** "Place a hazard": the trainee scans a floor, places a virtual
crucible, crane load or spill on it with WebXR hit-test, walks around it and answers the same
choice cards. Android Chrome first; a clear fallback to the 3D game everywhere else.

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

three.js is MIT licensed (see `js/vendor/three.LICENSE.txt`). Fonts: Inter and IBM Plex Sans
Arabic from Google Fonts (SIL Open Font Licence). All other code and graphics were written for
this prototype.
