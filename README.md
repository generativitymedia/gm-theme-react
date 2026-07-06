# gm-theme-react

**React bindings for the WrapMind theme engine.** ThemeProvider, hooks, registry, CSS variable application.

## Install

```bash
npm install github:WrapMind/theme-core#v1.0.0 github:WrapMind/theme-react#v1.0.0
```

## Usage

```jsx
import { ThemeProvider, useTheme } from 'gm-theme-react';
import { validateThemeBundle } from 'gm-theme-core';

// Load your theme bundles (import at build time — no import.meta.glob needed)
import defaultTheme from './themes/default.json';
import darkTheme from './themes/dark.json';

function App({ orgId }) {
  return (
    <ThemeProvider
      codeBundles={[defaultTheme, darkTheme]}
      defaultBundleId="myapp/2026.07.05/default"
      orgId={orgId}
      cssPrefix="--wm"         // CSS variable prefix
      storagePrefix="wm"       // localStorage key prefix
    >
      <Main />
    </ThemeProvider>
  );
}

function Main() {
  const { mode, setMode, effectiveThemeBundle } = useTheme();
  return (
    <button onClick={() => setMode(mode === 'dark' ? 'light' : 'dark')}>
      Toggle {mode}
    </button>
  );
}
```

## API

### `<ThemeProvider>`

| Prop | Type | Default | Description |
|---|---|---|---|
| `codeBundles` | `array` | `[]` | Theme bundle objects (loaded at build time) |
| `defaultBundleId` | `string` | — | Fallback bundle ID |
| `orgId` | `string\|null` | `null` | Org context for per-org selection |
| `cssPrefix` | `string` | `'--wm'` | Prefix for all CSS custom properties |
| `storagePrefix` | `string` | `'wm'` | Prefix for localStorage keys |
| `fontFamilyMap` | `object` | *(defaults)* | Font family presets |
| `densityOptions` | `object` | *(defaults)* | Density presets |
| `radiusOptions` | `object` | *(defaults)* | Radius presets |

### `useTheme()` returns

| Field | Type | Description |
|---|---|---|
| `mode` | `string` | `'light' | 'dark' | 'system'` |
| `setMode` | `function` |  |
| `fontSize` | `string` |  |
| `effectiveThemeBundle` | `object\|null` | The resolved theme bundle |
| `themeBundles` | `array` | All available bundles |
| `setThemeBundleId` | `function` | Select a theme by ID |
| `density` | `string` | Density level |
| `borderRadius` | `string` | Radius preset key |
| `cardStyle` | `string` | Card style: `'flat' | 'bordered' | 'elevated'` |
| *(plus accessors for colorBlindMode, reduceMotion, highContrast, focusMode, moduleGap)* | | |

## Architecture

- **`gm-theme-core`** — Pure data: schema, validation, contrast math, ramp generation. Zero dependencies.
- **`gm-theme-react`** — React bindings: context, hooks, CSS var application. Peer dep on React + theme-core.

The ThemeProvider replaces all `--wm-*` CSS variables on `document.documentElement` in response to theme bundle changes, mode toggles, and user preference settings (density, radius, font size, etc.).