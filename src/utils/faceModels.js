// Lazily loads the face-api.js models used for landmark-based warping.
// Loaded once (module-level cached promise) and reused across uploads —
// these are the model weight files in public/models/, served as static
// assets at /models/ by Vite (both dev server and production build).
import * as faceapi from 'face-api.js';

let loadPromise = null;

/**
 * Why face-api.js over @mediapipe/tasks-vision:
 * - face-api.js is pure JS + tfjs; its model weights are plain JSON
 *   manifests + binary shards that work as ordinary static files dropped
 *   in public/models/ — no bundler-specific handling required.
 * - @mediapipe/tasks-vision ships its inference engine as WASM plus a
 *   .task model blob, which needs extra Vite config (e.g.
 *   vite-plugin-static-copy) to land those assets at the right place in
 *   both dev and a production build. That's real integration risk for a
 *   project with no prior asset-pipeline work, and it wasn't worth
 *   taking on given face-api.js does everything this feature needs
 *   (68-point landmarks covering mouth corners + eyebrows).
 * - Trade-off accepted: face-api.js is unmaintained upstream. It still
 *   runs fine in a modern browser for this use case, and `npm audit`
 *   flags vulnerabilities only in its transitive node-fetch dependency,
 *   which is a Node.js-only code path face-api.js falls back to when no
 *   native `fetch` exists — irrelevant here since this is a browser-only
 *   app and every supported browser has native fetch.
 */
export function loadFaceModels() {
  if (!loadPromise) {
    // Use Vite's configured BASE_URL (this project builds with a relative
    // `base: './'` so it can be dropped in any subfolder on a static
    // host) rather than a hardcoded absolute "/models" — otherwise model
    // loading breaks the moment this isn't served from a domain root.
    const modelsUrl = `${import.meta.env.BASE_URL}models`;
    loadPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl),
      faceapi.nets.faceLandmark68Net.loadFromUri(modelsUrl),
    ]);
  }
  return loadPromise;
}

/**
 * Detect a single face with 68-point landmarks in an image element.
 * Returns null if no face was found (caller is expected to fall back
 * gracefully, not treat this as an error).
 */
export async function detectFaceLandmarks(image) {
  await loadFaceModels();
  const result = await faceapi
    .detectSingleFace(image, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();
  return result ?? null;
}
