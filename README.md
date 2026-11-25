# Whac-O-Molever

Whac-A-Mole, but the mole is your face. Upload a photo, pick a difficulty, and
whack it before it ducks back into the hole.

Fully client-side — no backend, no API, deployable as static files.

## Run it

```bash
npm install
npm run dev      # dev server, http://localhost:5173
npm run build    # production build -> dist/
npm run preview  # serve the production build locally
```

## How it works

1. **Upload screen** — pick a photo (ideally a face). It's drawn once onto an
   offscreen `<canvas>` (480x480), cropped to a square. A face-landmark model
   ([face-api.js](https://github.com/justadudewhohacks/face-api.js), running
   fully in-browser) finds the mouth corners and eyebrow points, and the
   photo's own pixels are **warped** around them — mouth corners pulled
   up-and-out for `happy`, pulled down for `sad`, eyebrows pulled down/together
   plus a smaller mouth-corner drop for `angry`. `neutral` is the untouched
   original. See `src/utils/faceCompositor.js` for the warp and
   `src/utils/faceModels.js` for model loading. This all happens once per
   upload, producing 4 pre-rendered data URLs — the game itself never touches
   canvas again during play, it just swaps which `<img>` is shown. If no face
   is detected, every mood falls back to the plain unmodified photo and the
   upload screen shows a quiet heads-up instead of erroring.
2. **Difficulty screen** — Easy / Medium / Hard, each tuning spawn interval,
   how long a mole stays up, and how many can be up at once (see table
   below).
3. **Game screen** — 12 holes across a 3-row x 4-column board (`HOLE_POSITIONS`
   in `src/constants/gameConfig.js`), positioned with absolute CSS
   percentages, popping up/down via CSS transitions — not canvas-rendered.
   The pop-up is a classic arcade snap: a fast (~100ms) `translateY` straight
   up with a slight bounce-overshoot, and an equally fast plain `translateY`
   back down — no tilt, no rotation, no perspective. (An earlier pass added a
   3D perspective/rotateX hinge for a more "emerging from a hole" look; it
   got reverted after the user compared it to a reference classic
   whack-a-mole game and wanted the plain vertical snap instead.) A hammer
   emoji follows the mouse cursor and "swings" on tap, per the spec's "hover
   a hammer" framing. Hit detection is a pointerdown on the mole image while
   its hole is active.
4. Game ends after 20 moles have spawned and the last one has resolved
   (hit or expired). **Win condition: strictly more than 15 hits** (16+).
5. **Result screen** — final score, win/lose, replay with same photo or
   upload a new one.

## Decisions made where the spec was silent

- **Difficulty numbers** (spec said "3 levels," no numbers):

  | Difficulty | Mole up time | Spawn interval | Max concurrent moles |
  |---|---|---|---|
  | Easy   | 1600ms | 1200ms | 1 |
  | Medium | 1100ms | 850ms  | 2 |
  | Hard   | 750ms  | 550ms  | 3 |

  Reasoning: difficulty should ramp on *both* reaction time and multitasking
  load, not just speed — hence increasing concurrent moles alongside shorter
  windows, so Hard genuinely requires scanning the whole board instead of
  just clicking faster in one spot.

- **Expression technique — real pixel warping, not overlays** (history: the
  first version drew tinted color washes + canvas-primitive shapes on top
  of the photo; the user was explicit they wanted the actual photo pixels
  manipulated, "like 'make me smile,'" not a sticker layered over it).
  Given a choice between an AI image-generation API (cost, latency, needs a
  backend — breaks "fully client-side") and free client-side face-landmark
  warping, the user chose landmark warping.

  **Library: [face-api.js](https://github.com/justadudewhohacks/face-api.js)
  over `@mediapipe/tasks-vision`.** Both were considered. face-api.js is
  pure JS/tfjs — its model weights are plain JSON manifests + binary shards
  that work as ordinary static files (`public/models/`), no bundler-specific
  handling needed. `@mediapipe/tasks-vision` ships its inference engine as
  WASM plus a `.task` model blob, which needs extra Vite config (e.g.
  `vite-plugin-static-copy`) to land those assets correctly in both dev and
  a production build — real integration risk that wasn't worth taking on
  for a feature this scoped. Trade-off accepted: face-api.js is unmaintained
  upstream, and `npm audit` flags vulnerabilities in its tfjs dependency's
  transitive `node-fetch` — but that's a Node-only fallback path tfjs uses
  when no native `fetch` exists, irrelevant for a browser-only app. It's
  lazy-loaded (`import('./faceModels')`) so the ~640KB tfjs+face-api chunk
  only downloads once a photo is actually uploaded, not on initial page load.

  **How the warp works** (`src/utils/faceCompositor.js`): detect 68 face
  landmarks once per upload, map them into the same cropped-canvas
  coordinate space the photo is drawn in, then for each mood define a
  handful of control points (mouth corners, inner eyebrow points) with a
  target displacement. For every destination pixel, sum each control
  point's displacement weighted by Gaussian falloff (closer = more
  influence), and sample the *original* photo at `pixel - totalDisplacement`
  (bilinear-interpolated). Pixels far from every control point get ~zero
  displacement and are unchanged — only the mouth/eyebrow region actually
  moves. `neutral` has zero control points and is a pixel-identical copy.

  **Known rough edges**: this is a sparse-landmark warp, not a full mesh
  deformation — real warping libraries in motion-graphics tools track far
  more points and handle discontinuities like facial hair much better. On
  photos with mustaches/beards near the mouth, the warp can visibly smear
  that hair texture rather than cleanly moving it (see `happy`/`sad` test
  renders). The effect is also *intentionally* subtle rather than cartoonish
  — it scales with interocular distance so it looks like a real, if small,
  expression shift rather than a distortion. The three displacement
  magnitudes (0.22 / 0.2 / 0.08 × interocular distance, in `buildControlPoints`)
  are the knob to turn if a more exaggerated effect is wanted. Very tightly
  cropped headshots (face fills the entire frame edge-to-edge, no
  hair/neck/background context) failed detection entirely in testing — the
  no-face fallback handles that case, but it's worth knowing the detector
  wants at least a little context around the face.

- **Hole layout and size**: originally a loosely-staggered "organic" scatter
  at 11% (desktop) / 15% (mobile) hole diameter. After a real-photo test the
  faces read as too small, so hole size went up to **17% desktop / 20%
  mobile** (bigger on mobile on purpose — smaller screen, same finger size,
  so touch targets need to be relatively bigger, not just bigger in
  absolute px). That size bump meant the original scattered layout's
  tightest gap (~17% between two holes) would have overlapped, so
  `HOLE_POSITIONS` is now a plain 3x4 grid (uniform columns at 10/37/63/90%,
  rows at 18/50/82%) with a verified ~27%-of-width minimum gap between
  neighbors — comfortably bigger than even the 20% mobile hole size. Traded
  a bit of "organic scatter" look for headroom that's actually load-bearing
  now. `.board` was also switched from independently-capped width/height to
  a locked `aspect-ratio: 1100/640`, so this gap math holds at every
  viewport shape instead of just the reference 1100x640 case (an
  independently-capped board could flip which axis was tightest on a
  short/landscape viewport and let holes run past the board edge).

- **Win threshold**: spec says "success if hit more than 15" — implemented
  as strictly greater than 15, i.e. 16 or more of 20.

- **Square photo crop**: uploaded photos are center-cropped to a square
  (cover-fit) so every mole face renders consistently regardless of the
  original photo's aspect ratio.

## Tech stack

Vite + React 18, plain CSS (no component library). Canvas + face-api.js
(client-side face-landmark detection) used only for the one-time face-warp
step at upload; the live game board is DOM+CSS, not canvas-rendered. No
router, no backend — a single top-level screen state machine in
`src/App.jsx`. See `specification.md` for the original brief and the
agreed stack rationale.

Face-landmark model weights live in `public/models/` (downloaded from
face-api.js's own repo, ~550KB total: a tiny face detector + a 68-point
landmark model) and are served as plain static files, copied verbatim into
`dist/models/` on build.
