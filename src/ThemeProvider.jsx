import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { resolveNavigationTokens } from '@wrapmind/theme-core';
import { applyThemeChrome, resolveIsDark, setDerivedSpacingVars, setDerivedTypographyVars, getColorBlindFilterSvg } from './applyThemeBundle.js';
import { darkenHex, getContrastText, toRgba, darken, parsePxValue } from './color-utils.js';
import { createRegistry } from './registry.js';

const ThemeContext = createContext(null);

// ── Default option maps (can be overridden via provider config) ────────────

const DEFAULT_FONT_SIZE_STEPS = ['xs', 'sm', 'base', 'lg', 'xl'];
const DEFAULT_FONT_SIZE_MAP = { xs: '11px', sm: '12px', base: '14px', lg: '16px', xl: '18px' };
const DEFAULT_FONT_SIZE_LABELS = { xs: 'Tiny', sm: 'Small', base: 'Default', lg: 'Large', xl: 'X-Large' };

const DEFAULT_FONT_FAMILY_MAP = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  serif: "'Lora', Georgia, 'Times New Roman', serif",
  display: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  mono: "'JetBrains Mono', 'Courier New', monospace",
};

const DEFAULT_DENSITY_OPTIONS = {
  compact:     { label: 'Compact',     cardPx: '0.875rem', cardPy: '0.625rem', rowPy: '0.375rem', listGap: '0.375rem' },
  default:     { label: 'Default',     cardPx: '1.25rem',  cardPy: '0.875rem', rowPy: '0.5rem',   listGap: '0.625rem' },
  comfortable: { label: 'Comfortable', cardPx: '1.5rem',   cardPy: '1.125rem', rowPy: '0.75rem',  listGap: '0.875rem' },
};

const DEFAULT_RADIUS_OPTIONS = {
  sharp:   { sm: '0px', md: '0px', lg: '0px', xl: '0px' },
  rounded: { sm: '4px', md: '6px', lg: '8px', xl: '10px' },
  soft:    { sm: '6px', md: '8px', lg: '12px', xl: '16px' },
  pill:    { sm: '9999px', md: '16px', lg: '20px', xl: '24px' },
};

const DEFAULT_CARD_STYLE_OPTIONS = ['flat', 'bordered', 'elevated'];
const DEFAULT_MODULE_GAP_OPTIONS = ['compact', 'default', 'comfortable'];

// ── Props ──────────────────────────────────────────────────────────────────
//
// Required:
//   codeBundles       — Array of theme bundle objects (loaded at build time)
//   defaultBundleId   — ID of the bundle to fall back to
//
// Optional:
//   orgId             — Current organization ID for per-org selection
//   cssPrefix         — CSS variable prefix (default: '--wm')
//   storagePrefix     — localStorage key prefix (default: 'wm')
//   fontFamilyMap     — Override DEFAULT_FONT_FAMILY_MAP
//   densityOptions    — Override DEFAULT_DENSITY_OPTIONS
//   radiusOptions     — Override DEFAULT_RADIUS_OPTIONS
//   cardStyleOptions  — Override DEFAULT_CARD_STYLE_OPTIONS
//   moduleGapOptions  — Override DEFAULT_MODULE_GAP_OPTIONS
//   fontSizeSteps     — Override DEFAULT_FONT_SIZE_STEPS
//   fontSizeMap       — Override DEFAULT_FONT_SIZE_MAP
//   storage           — Custom storage adapter (default: window.localStorage)

export function ThemeProvider({
  children,
  codeBundles = [],
  defaultBundleId,
  orgId = null,
  cssPrefix = '--wm',
  storagePrefix = 'wm',
  fontFamilyMap = DEFAULT_FONT_FAMILY_MAP,
  densityOptions = DEFAULT_DENSITY_OPTIONS,
  radiusOptions = DEFAULT_RADIUS_OPTIONS,
  cardStyleOptions = DEFAULT_CARD_STYLE_OPTIONS,
  moduleGapOptions = DEFAULT_MODULE_GAP_OPTIONS,
  fontSizeSteps = DEFAULT_FONT_SIZE_STEPS,
  fontSizeMap = DEFAULT_FONT_SIZE_MAP,
  storage = typeof window !== 'undefined' ? window.localStorage : null,
}) {
  const p = cssPrefix;
  const sp = storagePrefix;

  const registry = useMemo(() => createRegistry({
    storageKeyPrefix: sp,
    storage,
  }), [sp, storage]);

  const readStorage = useCallback((key, fallback) => {
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      if (raw === null || raw === undefined) return fallback;
      // Handle booleans stored as strings
      if (fallback === true || fallback === false) return raw === 'true';
      return raw;
    } catch { return fallback; }
  }, [storage]);

  const writeStorage = useCallback((key, value) => {
    if (!storage) return;
    try { storage.setItem(key, String(value)); } catch {}
  }, [storage]);

  // ── State ────────────────────────────────────────────────────────────────
  const [mode, setModeState] = useState(() => readStorage(`${sp}-theme-mode`, 'dark'));
  const [fontSize, setFontSizeState] = useState(() => readStorage(`${sp}-font-size`, 'base'));
  const [fontFamily, setFontFamilyState] = useState(() => readStorage(`${sp}-font-family`, 'sans'));
  const [density, setDensityState]           = useState(() => readStorage(`${sp}-density`, 'default'));
  const [borderRadius, setBorderRadiusState] = useState(() => readStorage(`${sp}-border-radius`, 'soft'));
  const [reduceMotion, setReduceMotionState] = useState(() => readStorage(`${sp}-reduce-motion`, false));
  const [cardStyle, setCardStyleState]       = useState(() => readStorage(`${sp}-card-style`, 'bordered'));
  const [highContrast, setHighContrastState] = useState(() => readStorage(`${sp}-high-contrast`, false));
  const [colorBlindMode, setColorBlindModeState] = useState(() => readStorage(`${sp}-colorblind`, 'none'));
  const [moduleGap, setModuleGapState] = useState(() => readStorage(`${sp}-module-gap`, 'default'));
  const [focusMode, setFocusModeState] = useState(() => readStorage(`${sp}-focus-mode`, false));
  const [, setThemeBundleNonce] = useState(0);

  // ── Theme bundle resolution ───────────────────────────────────────────────
  const themeSelectionKey = orgId ? `${sp}-theme-selected:${orgId}` : `${sp}-theme-selected:global`;
  const selectedBundleId = (() => {
    if (!storage) return null;
    try { return storage.getItem(themeSelectionKey); } catch { return null; }
  })();
  const effectiveThemeBundle = registry.resolveForOrg({
    orgId,
    selectedId: selectedBundleId,
    codeBundles,
    defaultBundle: codeBundles.find((b) => b.metadata?.id === defaultBundleId),
  });
  const selectedThemeIsFallback = !!selectedBundleId && effectiveThemeBundle?.metadata?.id !== selectedBundleId;

  const setThemeBundleId = useCallback((bundleId) => {
    const selected = bundleId || null;
    if (!storage) return;
    try {
      if (selected) storage.setItem(themeSelectionKey, selected);
      else storage.removeItem(themeSelectionKey);
    } catch {}
    if (orgId) {
      registry.setSelectedId(orgId, selected || effectiveThemeBundle?.metadata?.id, codeBundles);
    }
    setThemeBundleNonce((v) => v + 1);
  }, [effectiveThemeBundle?.metadata?.id, orgId, themeSelectionKey, registry, storage, codeBundles]);

  // ── Setters ───────────────────────────────────────────────────────────────
  const setMode = (v) => { setModeState(v); writeStorage(`${sp}-theme-mode`, v); };
  const setFontSize = (v) => { setFontSizeState(v); writeStorage(`${sp}-font-size`, v); };
  const setFontFamily = (v) => { setFontFamilyState(v); writeStorage(`${sp}-font-family`, v); };
  const setDensity = (v) => { setDensityState(v); writeStorage(`${sp}-density`, v); };
  const setBorderRadius = (v) => { setBorderRadiusState(v); writeStorage(`${sp}-border-radius`, v); };
  const setReduceMotion = (v) => { setReduceMotionState(v); writeStorage(`${sp}-reduce-motion`, v); };
  const setCardStyle = (v) => { setCardStyleState(v); writeStorage(`${sp}-card-style`, v); };
  const setHighContrast = (v) => { setHighContrastState(v); writeStorage(`${sp}-high-contrast`, v); };
  const setColorBlindMode = (v) => { setColorBlindModeState(v); writeStorage(`${sp}-colorblind`, v); };
  const setModuleGap = useCallback((v) => { setModuleGapState(v); writeStorage(`${sp}-module-gap`, v); }, [writeStorage, sp]);
  const setFocusMode = useCallback((v) => { setFocusModeState(v); writeStorage(`${sp}-focus-mode`, v); }, [writeStorage, sp]);

  // ── Effect: dark class ────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolveIsDark(mode, window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.dataset.themeMode = mode;
    root.classList.toggle('dark', isDark);
    root.style.colorScheme = isDark ? 'dark' : 'light';
  }, [mode]);

  // ── Effect: nav + surface + scrollbar CSS vars ────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const isDark = resolveIsDark(mode, window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (!effectiveThemeBundle) return;

    const bundleColor = effectiveThemeBundle.tokens?.color || {};
    const bundleColorModes = effectiveThemeBundle.tokens?.colorModes || {};
    const bundleSurface = bundleColor.surface || {};
    const bundleText = bundleColor.text || {};
    const bundleBorder = bundleColor.border || {};
    const bundleChart = bundleColor.chart || {};
    const resolvedMode = mode === 'system' ? (isDark ? 'dark' : 'light') : mode;
    const navTokens = resolveNavigationTokens(effectiveThemeBundle, resolvedMode);
    const lightModeOverrides = bundleColorModes.light || {};
    const lightSurface = lightModeOverrides.surface || {};
    const lightText = lightModeOverrides.text || {};
    const lightBorder = lightModeOverrides.border || {};

    root.dataset.themeBundleId = effectiveThemeBundle.metadata?.id || 'unknown';

    const modeOverrides = bundleColorModes[mode] || bundleColorModes[resolvedMode] || {};
    const modeSurface = modeOverrides.surface || {};
    const modeText = modeOverrides.text || {};
    const modeBorder = modeOverrides.border || {};
    const modeNav = modeOverrides.navigation || {};

    const navBg = modeNav.bg || navTokens.bg;
    const navBorder = modeNav.border || navTokens.border;
    const navText = modeNav.text || navTokens.text;
    const navTextActive = modeNav.textActive || navTokens.textActive;
    const navHoverBg = modeNav.hoverBg || navTokens.hoverBg;
    const navActiveBg = modeNav.activeBg || navTokens.activeBg;
    const navAccent = modeNav.accent || navTokens.accent;

    root.style.setProperty(`${p}-nav-bg`, navBg);
    root.style.setProperty(`${p}-nav-border`, navBorder);
    root.style.setProperty(`${p}-nav-text`, navText);
    root.style.setProperty(`${p}-nav-text-active`, navTextActive);
    root.style.setProperty(`${p}-nav-hover-bg`, navHoverBg);
    root.style.setProperty(`${p}-nav-active-bg`, navActiveBg);
    root.style.setProperty(`${p}-nav-accent`, navAccent);

    const setProp = (key, value) => root.style.setProperty(key, value);

    if (isDark) {
      setProp(`${p}-bg-primary`,   modeSurface.base || bundleSurface.base || darkenHex(navBg, 0.68));
      setProp(`${p}-bg-secondary`, modeSurface.elevated || bundleSurface.elevated || navBg);
      setProp(`${p}-bg-border`,    modeBorder.default || bundleBorder.default || navBorder);
      setProp(`${p}-surface-base`,     modeSurface.base || bundleSurface.base || darkenHex(navBg, 0.68));
      setProp(`${p}-surface-elevated`,  modeSurface.elevated || bundleSurface.elevated || navBg);
      setProp(`${p}-surface-muted`,     modeSurface.muted || bundleSurface.muted || `color-mix(in srgb, var(${p}-surface-elevated) 82%, var(${p}-surface-base))`);
      setProp(`${p}-text-primary`,      modeText.primary || bundleText.primary || `var(${p}-text-inverse)`);
      setProp(`${p}-text-secondary`,    modeText.secondary || bundleText.secondary || navText);
      setProp(`${p}-text-muted`,        modeText.muted || bundleText.muted || `color-mix(in srgb, var(${p}-text-secondary) 72%, transparent)`);
      setProp(`${p}-border-default`,    modeBorder.default || bundleBorder.default || navBorder);
      setProp(`${p}-border-strong`,     modeBorder.strong || bundleBorder.strong || `color-mix(in srgb, var(${p}-border-default) 55%, var(${p}-text-secondary))`);
      setProp(`${p}-focus-ring`,        `color-mix(in srgb, var(${p}-status-info-text) 35%, transparent)`);
    } else {
      setProp(`${p}-bg-primary`,   modeSurface.base || lightSurface.base || bundleSurface.base || `var(${p}-surface-base)`);
      setProp(`${p}-bg-secondary`, modeSurface.elevated || lightSurface.elevated || bundleSurface.elevated || `var(${p}-surface-elevated)`);
      setProp(`${p}-bg-border`,    modeBorder.default || lightBorder.default || bundleBorder.default || `var(${p}-border-default)`);
      setProp(`${p}-surface-base`,     modeSurface.base || lightSurface.base || bundleSurface.base || `var(${p}-surface-base)`);
      setProp(`${p}-surface-elevated`,  modeSurface.elevated || lightSurface.elevated || bundleSurface.elevated || `var(${p}-surface-elevated)`);
      setProp(`${p}-surface-muted`,     modeSurface.muted || lightSurface.muted || bundleSurface.muted || `var(${p}-surface-muted)`);
      setProp(`${p}-text-primary`,      modeText.primary || lightText.primary || bundleText.primary || `var(${p}-text-primary)`);
      setProp(`${p}-text-secondary`,    modeText.secondary || lightText.secondary || bundleText.secondary || `var(${p}-text-secondary)`);
      setProp(`${p}-text-muted`,        modeText.muted || lightText.muted || bundleText.muted || `var(${p}-text-muted)`);
      setProp(`${p}-border-default`,    modeBorder.default || lightBorder.default || bundleBorder.default || `var(${p}-border-default)`);
      setProp(`${p}-border-strong`,     modeBorder.strong || lightBorder.strong || bundleBorder.strong || `var(${p}-border-strong)`);
      setProp(`${p}-focus-ring`,        `color-mix(in srgb, var(${p}-status-info-text) 35%, transparent)`);
    }

    // Chart palette
    setProp(`${p}-chart-series1`, bundleChart.series1 || `var(${p}-status-info-text)`);
    setProp(`${p}-chart-series2`, bundleChart.series2 || `var(${p}-status-success-text)`);
    setProp(`${p}-chart-series3`, bundleChart.series3 || `var(${p}-status-warning-text)`);
    setProp(`${p}-chart-1`, bundleChart.series1 || `var(${p}-chart-series1)`);
    setProp(`${p}-chart-2`, bundleChart.series2 || `var(${p}-chart-series2)`);
    setProp(`${p}-chart-3`, bundleChart.series3 || `var(${p}-chart-series3)`);

    // Scrollbar
    setProp(`${p}-scrollbar-thumb`, navBorder);
    setProp(`${p}-scrollbar-hover`, navText);

    // Legacy aliases
    setProp('--bg-primary', root.style.getPropertyValue(`${p}-surface-base`));
    setProp('--bg-secondary', root.style.getPropertyValue(`${p}-surface-elevated`));
    setProp('--border-color', root.style.getPropertyValue(`${p}-border-default`));
    setProp('--text-primary', root.style.getPropertyValue(`${p}-text-primary`));
    setProp('--text-muted', root.style.getPropertyValue(`${p}-text-muted`));

    applyThemeChrome({
      themeColor: effectiveThemeBundle?.pwaChrome?.themeColor || navBg,
      statusBarStyle: 'black-translucent',
      colorScheme: isDark ? 'dark' : 'light',
    });
  }, [mode, effectiveThemeBundle, p]);

  // ── Effect: accent / action / semantic status CSS vars ────────────────────
  useEffect(() => {
    if (!effectiveThemeBundle) return;
    const bundleColors = effectiveThemeBundle.tokens?.color || {};
    const bundlePrimary = bundleColors.brand?.primary;
    const bundleAction = bundleColors.action || {};
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');

    const pAction = bundleAction.primary || bundlePrimary || bundleColors.navigation?.accent || `var(${p}-status-info-text)`;
    const actionHover = bundleAction.hover || darken(pAction, 0.82);
    const infoBg = bundleAction.soft || (isDark ? toRgba(pAction, 0.12) : toRgba(pAction, 0.08));
    const infoBorder = bundleAction.ring || (isDark ? toRgba(pAction, 0.35) : toRgba(pAction, 0.28));

    const set = (key, value) => root.style.setProperty(key, value);
    set(`${p}-status-info-text`,  pAction);
    set(`${p}-status-info-bg`,    infoBg);
    set(`${p}-status-info-border`, infoBorder);
    set(`${p}-action-primary`,    pAction);
    set(`${p}-action-primary-hover`, actionHover);
    set(`${p}-action-primary-soft`, infoBg);
    set(`${p}-action-primary-ring`, infoBorder);
    set('--color-signal', pAction);
    set('--color-accent', pAction);
    set('--accent-primary', pAction);
    set('--accent-hover', actionHover);
    set('--accent-subtle', infoBg);
    set('--accent-text-on-dark', '#ffffff');
    set('--accent-light', infoBg);
    set('--accent-ring', infoBorder);
    set('--btn-primary-bg', pAction);
    set('--btn-primary-hover', actionHover);
    const ct = getContrastText(pAction);
    set('--btn-primary-text', ct);
    set(`${p}-action-primary-text`, ct);
    set('--btn-outline-border', isDark ? infoBorder : toRgba(pAction, 0.3));
    set('--btn-outline-text', pAction);
    set('--btn-outline-hover-bg', isDark ? toRgba(pAction, 0.12) : toRgba(pAction, 0.06));
    set('--btn-ghost-hover-bg', isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)');
    set('--btn-danger-bg', `var(${p}-status-danger-text)`);
    set('--btn-danger-hover', `color-mix(in srgb, var(${p}-status-danger-text) 82%, black)`);
  }, [effectiveThemeBundle, mode, p]);

  // ── Effect: font size ─────────────────────────────────────────────────────
  useEffect(() => {
    const size = fontSizeMap[fontSize] || '14px';
    document.documentElement.style.setProperty(`${p}-font-size-base`, size);
    document.documentElement.style.fontSize = size;
  }, [fontSize, fontSizeMap, p]);

  // ── Effect: theme typography defaults (font-family from bundle) ──────────
  useEffect(() => {
    const root = document.documentElement;
    const themeTypography = effectiveThemeBundle?.tokens?.typography?.fontFamily || {};
    root.style.setProperty(`${p}-font-family-body`, themeTypography.body || fontFamilyMap.sans);
    root.style.setProperty(`${p}-font-family-display`, themeTypography.display || themeTypography.body || fontFamilyMap.display);
    root.style.setProperty(`${p}-font-family-mono`, themeTypography.mono || fontFamilyMap.mono);
  }, [effectiveThemeBundle, fontFamilyMap, p]);

  // ── Effect: spacing + wrapping tokens ───────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (!effectiveThemeBundle) return;
    setDerivedSpacingVars(root, effectiveThemeBundle.tokens?.spacing, p);
    setDerivedTypographyVars(root, effectiveThemeBundle.tokens?.typography, p);
  }, [effectiveThemeBundle, p]);

  // ── Effect: font family (user override vs bundle-owned) ──────────────────
  useEffect(() => {
    const themeTypography = effectiveThemeBundle?.tokens?.typography?.fontFamily || {};
    const bodyFamily = themeTypography.body || fontFamilyMap.sans;
    const root = document.documentElement;
    const userFamily = fontFamily === 'serif' ? fontFamilyMap.serif : bodyFamily;
    root.style.setProperty(`${p}-font-family`, userFamily);
    document.body.style.fontFamily = userFamily;
    root.style.setProperty(`${p}-font-family-body`, bodyFamily);
  }, [fontFamily, effectiveThemeBundle, fontFamilyMap, p]);

  // ── Effect: density ───────────────────────────────────────────────────
  useEffect(() => {
    const opts = densityOptions[density] || densityOptions.default;
    const root = document.documentElement;
    if (!opts) return;
    root.style.setProperty(`${p}-card-px`, opts.cardPx || '1.25rem');
    root.style.setProperty(`${p}-card-py`, opts.cardPy || '0.875rem');
    root.style.setProperty(`${p}-row-py`, opts.rowPy || '0.5rem');
    root.style.setProperty(`${p}-list-gap`, opts.listGap || '0.625rem');
  }, [density, densityOptions, p]);

  // ── Effect: border radius ─────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const bundleRadius = effectiveThemeBundle?.tokens?.radius || {};
    const preset = radiusOptions[borderRadius] || radiusOptions.soft;
    const sm = bundleRadius.sm || preset.sm;
    const md = bundleRadius.md || preset.md || sm;
    const lg = bundleRadius.lg || preset.lg || md;
    const xl = bundleRadius.xl || preset.xl || lg;
    const pill = bundleRadius.pill || (borderRadius === 'sharp' ? '0px' : '9999px');
    root.style.setProperty(`${p}-radius-sm`, sm);
    root.style.setProperty(`${p}-radius-md`, md);
    root.style.setProperty(`${p}-radius-lg`, lg);
    root.style.setProperty(`${p}-radius-xl`, xl);
    root.style.setProperty(`${p}-radius-control`, sm);
    root.style.setProperty(`${p}-radius-card`, md);
    root.style.setProperty(`${p}-radius-modal`, lg);
    root.style.setProperty(`${p}-radius-pill`, pill);
  }, [borderRadius, effectiveThemeBundle, radiusOptions, p]);

  // ── Effect: reduce motion ─────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (reduceMotion) root.classList.add(`${storagePrefix}-reduce-motion`);
    else root.classList.remove(`${storagePrefix}-reduce-motion`);
  }, [reduceMotion, storagePrefix]);

  // ── Effect: high contrast ─────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) root.classList.add(`${storagePrefix}-high-contrast`);
    else root.classList.remove(`${storagePrefix}-high-contrast`);
  }, [highContrast, storagePrefix]);

  // ── Effect: color-blind mode ──────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const svgId = `${storagePrefix}-cb-svg`;
    const old = document.getElementById(svgId);
    if (old) old.remove();
    root.style.filter = '';
    if (colorBlindMode === 'none') return;
    const svgContent = getColorBlindFilterSvg(colorBlindMode);
    if (!svgContent) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = svgId;
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
    svg.innerHTML = svgContent;
    document.body.appendChild(svg);
    root.style.filter = 'url(#cb-filter)';
    return () => {
      root.style.filter = '';
      const el = document.getElementById(svgId);
      if (el) el.remove();
    };
  }, [colorBlindMode, storagePrefix]);

  // ── Effect: card style ────────────────────────────────────────────────────
  useEffect(() => {
    const root = document.documentElement;
    const isDark = root.classList.contains('dark');
    const shadowTokens = effectiveThemeBundle?.tokens?.shadow || {};
    const set = (k, v) => root.style.setProperty(k, v);
    if (cardStyle === 'flat') {
      set(`${p}-card-shadow`, 'none');
      set(`${p}-overlay-shadow`, 'none');
      set(`${p}-card-border-width`, '0px');
      set(`${p}-card-border-color`, 'transparent');
    } else if (cardStyle === 'elevated') {
      set(`${p}-card-shadow`, isDark
        ? shadowTokens.elevated || '0 4px 20px -4px rgba(0,0,0,0.45), 0 1px 6px -1px rgba(0,0,0,0.3)'
        : shadowTokens.elevated || '0 4px 16px -4px rgba(0,0,0,0.14), 0 1px 4px -1px rgba(0,0,0,0.07)');
      set(`${p}-overlay-shadow`, shadowTokens.overlay || '0 12px 32px rgba(0,0,0,0.24)');
      set(`${p}-card-border-width`, '1px');
      set(`${p}-card-border-color`, isDark
        ? shadowTokens.border || 'rgba(255,255,255,0.05)'
        : shadowTokens.border || 'rgba(0,0,0,0.06)');
    } else {
      set(`${p}-card-shadow`, shadowTokens.card || 'none');
      set(`${p}-overlay-shadow`, shadowTokens.overlay || '0 12px 32px rgba(0,0,0,0.24)');
      set(`${p}-card-border-width`, '1px');
      set(`${p}-card-border-color`, isDark
        ? shadowTokens.border || `var(${p}-border-default)`
        : shadowTokens.border || `var(${p}-border-default)`);
    }
  }, [cardStyle, mode, effectiveThemeBundle, p]);

  // ── Render ────────────────────────────────────────────────────────────────
  const contextValue = {
    // Core state
    mode, setMode,
    fontSize, setFontSize,
    fontFamily, setFontFamily,
    density, setDensity,
    borderRadius, setBorderRadius,
    reduceMotion, setReduceMotion,
    cardStyle, setCardStyle,
    highContrast, setHighContrast,
    colorBlindMode, setColorBlindMode,
    moduleGap, setModuleGap,
    focusMode, setFocusMode,

    // Theme bundle
    themeBundles: registry.listBundles(codeBundles),
    themeBundleId: selectedBundleId,
    selectedThemeIsFallback,
    effectiveThemeBundle,
    setThemeBundleId,

    // Config exposed for consumers
    cssPrefix: p,
    storagePrefix: sp,
    fontSizeSteps,
    fontSizeMap,
    fontSizeLabels: DEFAULT_FONT_SIZE_LABELS,
    fontFamilyMap,
    densityOptions,
    radiusOptions,
    cardStyleOptions,
    moduleGapOptions,

    // Registry
    registry,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}