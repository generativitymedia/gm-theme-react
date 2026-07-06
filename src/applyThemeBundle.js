/**
 * Browser DOM utilities — apply theme chrome (meta tags, color scheme).
 * Only runs in browser environments (checks typeof document).
 */

export function resolveIsDark(mode, prefersDark = false) {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return prefersDark;
}

function setMetaContent(name, content) {
  if (typeof document === 'undefined') return;
  let meta = document.head.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

export function applyThemeChrome({ themeColor, statusBarStyle, colorScheme }) {
  if (typeof document === 'undefined') return;
  if (themeColor) setMetaContent('theme-color', themeColor);
  if (statusBarStyle) setMetaContent('apple-mobile-web-app-status-bar-style', statusBarStyle);
  if (colorScheme) {
    document.documentElement.style.colorScheme = colorScheme;
  }
}

/**
 * Set derived spacing CSS variables on the root element.
 * Prefix is applied to each CSS variable name.
 */
export function setDerivedSpacingVars(root, spacing = {}, prefix = '--wm') {
  const xs = parsePxValue(spacing.xs, 4);
  const sm = parsePxValue(spacing.sm, 8);
  const md = parsePxValue(spacing.md, 12);
  const lg = parsePxValue(spacing.lg, 16);
  const xl = parsePxValue(spacing.xl, 24);
  const xxl = parsePxValue(spacing['2xl'], 32);

  const p = prefix;
  const vars = {
    [`${p}-space-0_5`]: `${xs / 2}px`,
    [`${p}-space-1`]: `${xs}px`,
    [`${p}-space-1_5`]: `${sm / 2}px`,
    [`${p}-space-2`]: `${sm}px`,
    [`${p}-space-2_5`]: `${md / 2}px`,
    [`${p}-space-3`]: `${md}px`,
    [`${p}-space-4`]: `${lg}px`,
    [`${p}-space-5`]: `${(lg + xl) / 2}px`,
    [`${p}-space-6`]: `${xl}px`,
    [`${p}-space-8`]: `${xxl}px`,
    [`${p}-space-10`]: `${xxl * 1.25}px`,
    [`${p}-space-12`]: `${xxl * 1.5}px`,
    [`${p}-space-16`]: `${xxl * 2}px`,
  };
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
}

/**
 * Set derived typography CSS variables on the root element.
 */
export function setDerivedTypographyVars(root, typography = {}, prefix = '--wm') {
  const wrapping = typography.wrapping || {};
  const lineHeight = typography.lineHeight || {};
  const p = prefix;
  root.style.setProperty(`${p}-wrap-default`, wrapping.default || 'balance');
  root.style.setProperty(`${p}-wrap-table`, wrapping.tables || 'nowrap');
  root.style.setProperty(`${p}-wrap-card`, wrapping.cards || 'wrap');
  root.style.setProperty(`${p}-wrap-label`, wrapping.labels || 'nowrap');
  root.style.setProperty(`${p}-line-height-tight`, lineHeight.tight ? String(lineHeight.tight) : '1.2');
  root.style.setProperty(`${p}-line-height-normal`, lineHeight.normal ? String(lineHeight.normal) : '1.45');
  root.style.setProperty(`${p}-line-height-relaxed`, lineHeight.relaxed ? String(lineHeight.relaxed) : '1.6');
}

function parsePxValue(value, fallback) {
  if (typeof value !== 'string') return fallback;
  const match = value.trim().match(/^(\d+(?:\.\d+)?)px$/);
  if (!match) return fallback;
  return Number(match[1]);
}

/**
 * Color-blind simulation SVG filter definitions.
 * Returns the SVG element innerHTML for the filter, or null if mode is 'none'.
 */
export function getColorBlindFilterSvg(colorBlindMode) {
  if (colorBlindMode === 'none') return null;
  const matrices = {
    deuteranopia: '0.367 0.861 -0.228 0 0  0.280 0.673 0.047 0 0  -0.012 0.043 0.969 0 0  0 0 0 1 0',
    protanopia:   '0.152 1.053 -0.205 0 0  0.115 0.786 0.099 0 0  -0.004 -0.048 1.052 0 0  0 0 0 1 0',
    tritanopia:   '1.256 -0.077 -0.179 0 0  -0.078 0.931 0.148 0 0  0.005 0.691 0.304 0 0  0 0 0 1 0',
  };
  const matrix = matrices[colorBlindMode];
  if (!matrix) return null;
  return `<defs><filter id="cb-filter"><feColorMatrix type="matrix" values="${matrix}"/></filter></defs>`;
}