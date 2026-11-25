// Face compositing: detects real facial landmarks on the user's uploaded
// photo once, then WARPS the photo's own pixels per mood (mouth corners
// pulled up for happy, pushed down for sad, eyebrows pulled down/together
// for angry) using an inverse-mapped, Gaussian-falloff displacement field.
//
// This replaced an earlier version that drew tinted overlays + canvas
// shapes ON TOP of the photo. The user was explicit they wanted the
// actual photo pixels manipulated ("like 'make me smile'"), not a sticker
// layered over it — so this version never draws anything; it only moves
// existing pixels around.
//
// Everything still runs once per upload, producing 4 pre-rendered data
// URLs; the game swaps between them with zero per-frame canvas work.

export const EXPRESSION_LIST = ['neutral', 'happy', 'sad', 'angry'];

const OUTPUT_SIZE = 480; // square canvas, px

/**
 * Load a File/Blob into an HTMLImageElement.
 */
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image file. Try a different photo.'));
    };
    img.src = url;
  });
}

/**
 * "Cover" style crop parameters: fills the size x size square without
 * distortion, cropping whichever source dimension is longer (same
 * behavior as CSS background-size: cover / object-fit: cover). Returned
 * (not just applied) because face landmarks are detected on the
 * *original* image and need the exact same mapping applied to line up
 * with the cropped/scaled canvas.
 */
function computeCoverCropParams(image, size) {
  const { naturalWidth: width, naturalHeight: height } = image;
  const scale = Math.max(size / width, size / height);
  const sw = size / scale;
  const sh = size / scale;
  const sx = (width - sw) / 2;
  const sy = (height - sh) / 2;
  return { scale, sx, sy, sw, sh };
}

function drawCoverCropped(ctx, image, size, cropParams) {
  const { sx, sy, sw, sh } = cropParams;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, size, size);
}

/** Map a landmark point from original-photo pixel space into output-canvas space. */
function mapPointToOutput(point, cropParams) {
  return {
    x: (point.x - cropParams.sx) * cropParams.scale,
    y: (point.y - cropParams.sy) * cropParams.scale,
  };
}

function averagePoints(points) {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Build the control points (landmark position + displacement vector +
 * Gaussian falloff radius) for a given mood, from the 68 face-api.js
 * landmarks already mapped into output-canvas space.
 *
 * Standard ibug/dlib 68-point layout: 0-16 jaw, 17-21 + 22-26 eyebrows
 * (21 and 22 are each eyebrow's innermost, nose-side point regardless of
 * image mirroring), 36-41 + 42-47 eyes, 48-67 mouth (48/54 are the two
 * mouth corners, 51/57 the outer lip top/bottom center).
 *
 * Displacement magnitudes are scaled by interocular distance so the warp
 * looks proportionally similar regardless of the photo's resolution or
 * how close-up the face is.
 */
function buildControlPoints(points, mood) {
  const eyeA = averagePoints(points.slice(36, 42));
  const eyeB = averagePoints(points.slice(42, 48));
  const interocular = distance(eyeA, eyeB);
  const faceCenterX = (eyeA.x + eyeB.x) / 2;
  const sigma = interocular * 0.55;

  // Mouth-corner control points (happy/sad/angry) get an ANISOTROPIC
  // vertical falloff instead of a single symmetric sigma. Two competing
  // problems forced this:
  //  1. Pushing displacement harder with a narrow symmetric sigma
  //     concentrates the pull tightly right on the mouth, which is
  //     exactly where facial hair (mustache/beard) lives — reads as a
  //     smear rather than a moved feature. Widening sigma fixes this.
  //  2. But widening sigma symmetrically also widens reach UPWARD toward
  //     the eyes. On faces where the mouth corners sit close to the eyes
  //     (an already-open mouth, or a short midface), that drags eye
  //     pixels along with the mouth-corner displacement and produces a
  //     "melting eyes" artifact — confirmed against a wide-open-mouth
  //     reference photo where a symmetric sigma of 0.62-0.75 visibly
  //     bulged/stretched the eyes even though the same settings looked
  //     fine on a closed-mouth reference face. Worse than the smear it
  //     was meant to fix.
  // Fix: keep the falloff tight toward the eyes (upward) but wide toward
  // the jaw/chin (downward) — smooths exactly the region with facial
  // hair without ever reaching far enough up to touch the eyes.
  const mouthSigmaUp = interocular * 0.38;
  const mouthSigmaDown = interocular * 0.68;
  // Horizontal falloff for mouth-corner points is kept narrower than the
  // corner-to-corner distance on purpose. With the wider general `sigma`
  // here, the left and right corner's Gaussians overlap enough that their
  // SUMMED weight at the midpoint between them (philtrum/chin center)
  // exceeds the weight at either corner alone — stretching the center of
  // the mouth/chin MORE than the corners themselves, which is backwards
  // (a real smile/frown moves the corners the most, the center the
  // least) and showed up as a visible vertical seam down the middle of
  // the face on `sad`. A tighter horizontal sigma keeps each corner's
  // influence local enough that they don't constructively overlap.
  const mouthSigmaX = interocular * 0.35;

  const cornerA = points[48];
  const cornerB = points[54];
  const [leftCorner, rightCorner] = cornerA.x <= cornerB.x ? [cornerA, cornerB] : [cornerB, cornerA];

  const browInnerLeft = points[21];
  const browInnerRight = points[22];
  // Push each inner eyebrow point toward the face's vertical midline,
  // regardless of which side of the photo it happens to land on.
  const inward = (p) => (faceCenterX - p.x >= 0 ? 1 : -1);

  switch (mood) {
    case 'happy': {
      // Intensities roughly 2.3x the original subtle pass, by explicit
      // user request: at actual in-game size (~185px, visible <1.6s)
      // "subtle but real" was indistinguishable from neutral. Legibility
      // during fast gameplay beats photorealism here — some cartoonish
      // exaggeration is intentional, not a bug.
      const lift = interocular * 0.5;
      const spread = interocular * 0.22;
      return [
        { x: leftCorner.x, y: leftCorner.y, dx: -spread, dy: -lift, sigma: mouthSigmaX, sigmaUp: mouthSigmaUp, sigmaDown: mouthSigmaDown },
        { x: rightCorner.x, y: rightCorner.y, dx: spread, dy: -lift, sigma: mouthSigmaX, sigmaUp: mouthSigmaUp, sigmaDown: mouthSigmaDown },
      ];
    }
    case 'sad': {
      const drop = interocular * 0.42;
      return [
        { x: leftCorner.x, y: leftCorner.y, dx: 0, dy: drop, sigma: mouthSigmaX, sigmaUp: mouthSigmaUp, sigmaDown: mouthSigmaDown },
        { x: rightCorner.x, y: rightCorner.y, dx: 0, dy: drop, sigma: mouthSigmaX, sigmaUp: mouthSigmaUp, sigmaDown: mouthSigmaDown },
      ];
    }
    case 'angry': {
      const browDrop = interocular * 0.3;
      const browIn = interocular * 0.12;
      const mouthDrop = interocular * 0.2;
      const browSigma = sigma * 0.75;
      return [
        { x: browInnerLeft.x, y: browInnerLeft.y, dx: inward(browInnerLeft) * browIn, dy: browDrop, sigma: browSigma },
        { x: browInnerRight.x, y: browInnerRight.y, dx: inward(browInnerRight) * browIn, dy: browDrop, sigma: browSigma },
        { x: leftCorner.x, y: leftCorner.y, dx: 0, dy: mouthDrop, sigma: mouthSigmaX, sigmaUp: mouthSigmaUp, sigmaDown: mouthSigmaDown },
        { x: rightCorner.x, y: rightCorner.y, dx: 0, dy: mouthDrop, sigma: mouthSigmaX, sigmaUp: mouthSigmaUp, sigmaDown: mouthSigmaDown },
      ];
    }
    default:
      return []; // neutral: no control points, no displacement, untouched
  }
}

/** Bilinear-sample an RGBA Uint8ClampedArray at a (possibly fractional) coordinate, clamped to bounds. */
function sampleBilinear(data, width, height, x, y) {
  const cx = Math.min(Math.max(x, 0), width - 1);
  const cy = Math.min(Math.max(y, 0), height - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const idx = (xx, yy) => (yy * width + xx) * 4;

  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const top = data[idx(x0, y0) + c] * (1 - fx) + data[idx(x1, y0) + c] * fx;
    const bottom = data[idx(x0, y1) + c] * (1 - fx) + data[idx(x1, y1) + c] * fx;
    out[c] = top * (1 - fy) + bottom * fy;
  }
  return out;
}

/**
 * The actual warp: for every destination pixel, sum the Gaussian-falloff
 * weighted displacement contributed by each control point, then sample
 * the SOURCE photo at (pixel - total_displacement). This is a real
 * geometric warp of the photo's own pixels — nothing is drawn on top.
 */
function warpImageData(sourceImageData, size, controlPoints) {
  if (controlPoints.length === 0) {
    // No-op mood (neutral): return an identical copy rather than looping.
    return new ImageData(new Uint8ClampedArray(sourceImageData.data), size, size);
  }

  const srcData = sourceImageData.data;
  const dest = new ImageData(size, size);
  const destData = dest.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const cp of controlPoints) {
        const ddx = x - cp.x;
        const ddy = y - cp.y;
        // Control points may define an anisotropic vertical falloff
        // (sigmaUp/sigmaDown) instead of a single symmetric sigma — see
        // buildControlPoints() for why (keeps mouth-corner displacement
        // from bleeding up into the eyes while still spreading wide
        // toward the jaw/chin to avoid smearing facial hair). Points
        // without those set (eyebrows) fall back to plain symmetric sigma.
        const verticalSigma = ddy < 0 ? (cp.sigmaUp ?? cp.sigma) : (cp.sigmaDown ?? cp.sigma);
        const weight = Math.exp(-(ddx * ddx) / (2 * cp.sigma * cp.sigma) - (ddy * ddy) / (2 * verticalSigma * verticalSigma));
        dx += weight * cp.dx;
        dy += weight * cp.dy;
      }

      const [r, g, b, a] = sampleBilinear(srcData, size, size, x - dx, y - dy);
      const destIdx = (y * size + x) * 4;
      destData[destIdx] = r;
      destData[destIdx + 1] = g;
      destData[destIdx + 2] = b;
      destData[destIdx + 3] = a;
    }
  }
  return dest;
}

/**
 * Given an uploaded photo File, produce one pre-rendered data URL per
 * expression by warping the photo's real pixels around detected facial
 * landmarks.
 *
 * @param {File} file
 * @returns {Promise<{variants: Record<string,string>, facesDetected: boolean}>}
 */
export async function composeExpressionVariants(file) {
  const image = await loadImage(file);
  const size = OUTPUT_SIZE;
  const cropParams = computeCoverCropParams(image, size);

  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = size;
  baseCanvas.height = size;
  const baseCtx = baseCanvas.getContext('2d');
  if (!baseCtx) {
    throw new Error('Canvas 2D is not supported in this browser.');
  }
  drawCoverCropped(baseCtx, image, size, cropParams);
  const neutralDataUrl = baseCanvas.toDataURL('image/png');

  let detection = null;
  try {
    // face-api.js + tfjs is a hefty dependency (~750KB) — loaded as a
    // separate chunk only once a photo is actually uploaded, not on
    // initial page load.
    const { detectFaceLandmarks } = await import('./faceModels');
    detection = await detectFaceLandmarks(image);
  } catch (err) {
    // Model failed to load or run (offline, blocked asset, etc). Degrade
    // to the no-face fallback below instead of crashing the upload.
    console.warn('Face landmark detection unavailable, using static photo:', err);
    detection = null;
  }

  if (!detection) {
    // No face found (or detection unavailable) — every mood falls back
    // to the same unmodified photo. The game is still fully playable,
    // it just won't show changing expressions this round.
    const samePhoto = {
      neutral: neutralDataUrl,
      happy: neutralDataUrl,
      sad: neutralDataUrl,
      angry: neutralDataUrl,
    };
    return { variants: samePhoto, facesDetected: false };
  }

  const mappedPoints = detection.landmarks.positions.map((p) => mapPointToOutput(p, cropParams));
  const sourceImageData = baseCtx.getImageData(0, 0, size, size);

  const variants = { neutral: neutralDataUrl };
  for (const mood of ['happy', 'sad', 'angry']) {
    const controlPoints = buildControlPoints(mappedPoints, mood);
    const warped = warpImageData(sourceImageData, size, controlPoints);
    const moodCanvas = document.createElement('canvas');
    moodCanvas.width = size;
    moodCanvas.height = size;
    moodCanvas.getContext('2d').putImageData(warped, 0, 0);
    variants[mood] = moodCanvas.toDataURL('image/png');
  }

  return { variants, facesDetected: true };
}
