/**
 * Pure color utility functions — DOM-free, for use in ThemeProvider effects.
 */

/** Darken a hex color by a factor (0-1). */
export function darkenHex(hex, factor = 0.68) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const d = (v) => Math.max(0, Math.round(v * factor)).toString(16).padStart(2, '0');
  return `#${d(r)}${d(g)}${d(b)}`;
}

/** Choose white or near-black text for a given background hex. */
export function getContrastText(hex) {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return '#ffffff';
  const clean = hex.slice(1);
  const value = clean.length === 3
    ? clean.split('').map((ch) => ch + ch).join('')
    : clean.slice(0, 6);
  if (value.length !== 6) return '#ffffff';
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const toLinear = (channel) => (
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4
  );
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  return luminance > 0.62 ? '#0B0B12' : '#ffffff';
}

/** Parse a px value string to a number. */
export function parsePxValue(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
  if (!match) return fallback;
  return Number(match[1]);
}

/** Hex string → [r, g, b] array. */
export function hexToRgbArray(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/** Derive an rgba string from a hex color. */
export function toRgba(hex, alpha) {
  const [r, g, b] = hexToRgbArray(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Darken a hex color toward near-black. */
export function darken(hex, factor = 0.82) {
  const [r, g, b] = hexToRgbArray(hex);
  const d = (v) => Math.max(0, Math.round(v * factor)).toString(16).padStart(2, '0');
  return `#${d(r)}${d(g)}${d(b)}`;
}