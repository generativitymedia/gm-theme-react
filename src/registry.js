/**
 * Registry utilities — bundle management, persistence, selection, fallback.
 * Uses a configurable storage adapter (defaults to localStorage).
 *
 * Unlike the WrapMind in-repo version, this does NOT use import.meta.glob.
 * Consumers pass bundles explicitly.
 */

import { validateThemeBundle, migrateThemeBundleToLatest, deepClone } from '@wrapmind/theme-core';

/**
 * Create a registry instance.
 * @param {object} options
 * @param {string} [options.storageKeyPrefix='wm-theme'] - Prefix for localStorage keys.
 * @param {function} [options.storage={ getItem, setItem, removeItem }] - Storage adapter.
 * @param {function} [options.onChange] - Called when registry state changes.
 * @returns {object} Registry API
 */
export function createRegistry({
  storageKeyPrefix = 'wm-theme',
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  onChange,
} = {}) {
  const REGISTRY_KEY = `${storageKeyPrefix}-registry-v1`;
  const RUNTIME_KEY = `${storageKeyPrefix}-runtime-v1`;
  const EVENT_NAME = `${storageKeyPrefix}-registry-changed`;

  function safeRead(key, fallback) {
    if (!storage) return fallback;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch { return fallback; }
  }

  function safeWrite(key, value) {
    if (!storage) return;
    try { storage.setItem(key, JSON.stringify(value)); } catch {}
  }

  function cloneBundle(bundle) { return deepClone(bundle); }

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function isBundleSelectable(bundle) {
    return !!bundle?.metadata?.id && bundle.metadata.status === 'active';
  }

  function normalizeSelectionMap(map) { return map && typeof map === 'object' ? map : {}; }

  function normalizeAllowlistMap(map) { return map && typeof map === 'object' ? map : {}; }

  function emitChange(detail = {}) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
    }
    if (onChange) onChange(detail);
  }

  function readRegistryState(codeBundles) {
    const runtimeBundles = safeRead(RUNTIME_KEY, []);
    const stored = safeRead(REGISTRY_KEY, {});
    const selectionMap = normalizeSelectionMap(stored.selectedThemeIdByOrg);
    const allowlistMap = normalizeAllowlistMap(stored.allowedThemeIdsByOrg);

    const byId = new Map();
    for (const bundle of [...(codeBundles || []), ...runtimeBundles]) {
      if (!bundle?.metadata?.id) continue;
      byId.set(bundle.metadata.id, migrateThemeBundleToLatest(cloneBundle(bundle)));
    }

    return {
      bundles: Array.from(byId.values()),
      selectedThemeIdByOrg: selectionMap,
      allowedThemeIdsByOrg: allowlistMap,
    };
  }

  function writeRegistryState(state) {
    safeWrite(REGISTRY_KEY, {
      selectedThemeIdByOrg: state.selectedThemeIdByOrg || {},
      allowedThemeIdsByOrg: state.allowedThemeIdsByOrg || {},
    });
    emitChange({ state });
  }

  function upsertRuntimeBundle(bundle) {
    const stored = safeRead(RUNTIME_KEY, []);
    const next = [
      ...stored.filter((b) => b.metadata?.id !== bundle.metadata?.id),
      bundle,
    ];
    safeWrite(RUNTIME_KEY, next);
  }

  return {
    /** Get all bundles (code + runtime, deduplicated, migrated). */
    listBundles(codeBundles) {
      return readRegistryState(codeBundles).bundles.map(cloneBundle);
    },

    /** Get a bundle by ID. */
    getBundleById(codeBundles, id) {
      if (!id) return null;
      return this.listBundles(codeBundles).find((b) => b.metadata?.id === id) || null;
    },

    /** Get allowed bundle IDs for an org (falls back to all active). */
    getAllowedIds(codeBundles, orgId) {
      if (!orgId) return [];
      const state = readRegistryState(codeBundles);
      const allowlist = normalizeAllowlistMap(state.allowedThemeIdsByOrg);
      const ids = allowlist[orgId];
      if (Array.isArray(ids) && ids.length > 0) return ids.slice();
      return state.bundles.filter(isBundleSelectable).map((b) => b.metadata.id);
    },

    /** Set allowed bundle IDs for an org. */
    setAllowedIds(orgId, ids) {
      if (!orgId) return [];
      const state = readRegistryState();
      const allowlist = normalizeAllowlistMap(state.allowedThemeIdsByOrg);
      allowlist[orgId] = Array.isArray(ids) ? [...new Set(ids.filter(Boolean))] : [];
      writeRegistryState({ ...state, allowedThemeIdsByOrg: allowlist });
      return allowlist[orgId];
    },

    /** Get the selected theme bundle ID for an org. */
    getSelectedId(codeBundles, orgId) {
      if (!orgId) return null;
      const state = readRegistryState(codeBundles);
      const selected = normalizeSelectionMap(state.selectedThemeIdByOrg);
      return selected[orgId] || null;
    },

    /** Set the selected theme bundle ID for an org. */
    setSelectedId(orgId, id, codeBundles) {
      if (!orgId) return null;
      const state = readRegistryState(codeBundles);
      const selected = normalizeSelectionMap(state.selectedThemeIdByOrg);
      selected[orgId] = id || null;
      writeRegistryState({ ...state, selectedThemeIdByOrg: selected });
      return selected[orgId];
    },

    /** Resolve the effective theme bundle for an org with fallback. */
    resolveForOrg({ orgId = null, selectedId = null, codeBundles = [], defaultBundle = null } = {}) {
      const state = readRegistryState(codeBundles);
      const bundles = state.bundles;
      const allowedIds = orgId ? new Set(this.getAllowedIds(codeBundles, orgId)) : null;
      const selectedBundle = selectedId
        ? bundles.find((b) => b.metadata?.id === selectedId)
        : orgId
          ? bundles.find((b) => b.metadata?.id === this.getSelectedId(codeBundles, orgId))
          : null;

      if (selectedBundle && isBundleSelectable(selectedBundle)) {
        if (!allowedIds || allowedIds.size === 0 || allowedIds.has(selectedBundle.metadata.id)) {
          return cloneBundle(selectedBundle);
        }
      }

      // Fallback: defaultBundle → first active → first bundle → null
      return cloneBundle(
        defaultBundle
        || bundles.find(isBundleSelectable)
        || bundles[0]
        || null
      );
    },

    /** Publish (add + validate) a runtime bundle. */
    publishBundle(bundle, options = {}) {
      const { activate = true, persist = true } = options;
      const migrated = migrateThemeBundleToLatest(bundle);
      const result = validateThemeBundle(migrated);
      if (!result.valid) {
        const error = new Error(`Theme bundle validation failed: ${result.errors.join('; ')}`);
        error.validationErrors = result.errors;
        throw error;
      }
      const nextBundle = cloneBundle(migrated);
      if (!nextBundle.metadata.status) {
        nextBundle.metadata.status = activate ? 'active' : 'draft';
      } else if (activate) {
        nextBundle.metadata.status = 'active';
      }
      if (persist) upsertRuntimeBundle(nextBundle);
      emitChange({ bundle: nextBundle });
      return cloneBundle(nextBundle);
    },
  };
}