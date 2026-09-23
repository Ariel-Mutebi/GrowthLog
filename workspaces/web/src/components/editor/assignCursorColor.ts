const COLOR_COUNT = 10;

const LIGHT_COLORS = [
  '#032e15',
  '#002c22',
  '#022f2e',
  '#053345',
  '#052f4a',
  '#162456',
  '#1e1a4d',
  '#020618',
  '#0c0a09',
];

const DARK_COLORS = [
  '#dcfce7',
  '#d0fae5',
  '#cbfbf1',
  '#cefafe',
  '#dff2fe',
  '#dbeafe',
  '#e0e7ff',
  '#f1f5f9',
  '#f5f5f4',
];

/**
 * Deterministically assigns a cursor color to a user for collaborative editing.
 * Colors are green, emerald, teal, cyan, sky, blue, indigo, slate, and stone.
 * The shade used in light-mode is 950, and the shade used in dark mode is 100.
 */
export function assignCursorColor(userId: string) {
  let hash = 0;

  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) % COLOR_COUNT;
  }

  if (document.documentElement.classList.contains('dark')) {
    return DARK_COLORS[hash];
  }

  return LIGHT_COLORS[hash];
}
