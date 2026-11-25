// Game-wide tuning constants. The spec mandated 12 holes, 20 total moles,
// and "success if hit more than 15" but left difficulty numbers to us.
// Documented reasoning for the numbers below lives in README.md.

export const HOLE_COUNT = 12;
export const TOTAL_MOLES = 20;
export const SUCCESS_THRESHOLD = 15; // must be STRICTLY greater than this to win

export const DIFFICULTIES = {
  easy: {
    key: 'easy',
    label: 'Easy',
    description: 'Moles linger ~1.6s and only one shows up at a time.',
    moleUpDurationMs: 1600,
    spawnIntervalMs: 1200,
    maxConcurrentMoles: 1,
  },
  medium: {
    key: 'medium',
    label: 'Medium',
    description: 'Moles linger ~1.1s, sometimes two pop up together.',
    moleUpDurationMs: 1100,
    spawnIntervalMs: 850,
    maxConcurrentMoles: 2,
  },
  hard: {
    key: 'hard',
    label: 'Hard',
    description: 'Moles linger ~0.75s, up to three at once. Good luck.',
    moleUpDurationMs: 750,
    spawnIntervalMs: 550,
    maxConcurrentMoles: 3,
  },
};

export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

// Positions as percent of board width/height, 3 rows x 4 columns, laid out
// to leave generous breathing room once holes got bigger (17-20% diameter,
// up from the original 11%). Each hole centers on its (left, top) point via
// a CSS translate(-50%, -50%).
//
// Math (board is aspect-ratio-locked to 1100:640, see styles.css, so these
// percentages are safe at any viewport size, not just the 1100x640 case
// used to compute them):
//   - Columns are evenly spaced at 10/37/63/90 in EVERY row (no per-row
//     offset). Min column gap = 27% (~297px @1100 wide) — comfortably
//     bigger than even the largest hole diameter in play (20% mobile).
//   - Rows sit at 18/50/82 (32% apart, ~205px @640 tall). Cross-row
//     distance is always >= the row gap alone (diagonal distance can only
//     be larger), so it was never the binding constraint.
//   - Desktop hole width is 17% -> min edge-to-edge gap ≈ 220px - 187px =
//     ~33px. Mobile bumps to 20% for touch targets -> gap still positive
//     because 20% < 27% column spacing with room to spare.
// Previous attempt used per-row offsets ("zigzag") for a less grid-like
// look, but that squeezed one column gap down to ~17%, which overlapped
// once hole size grew past ~16%. Uniform columns traded a bit of visual
// variety for headroom that's actually needed now.
export const HOLE_POSITIONS = [
  { top: 18, left: 10 },
  { top: 18, left: 37 },
  { top: 18, left: 63 },
  { top: 18, left: 90 },
  { top: 50, left: 10 },
  { top: 50, left: 37 },
  { top: 50, left: 63 },
  { top: 50, left: 90 },
  { top: 82, left: 10 },
  { top: 82, left: 37 },
  { top: 82, left: 63 },
  { top: 82, left: 90 },
];
