/**
 * Persistence that works in a browser and inside a Capacitor WebView.
 *
 * On native we go through @capacitor/preferences (UserDefaults / SharedPrefs),
 * which survives the OS reclaiming WebView storage. On the web we use
 * localStorage. The Capacitor module is imported lazily so the web bundle never
 * pays for it.
 */

const STORAGE_KEY = 'advancedOffsetCalcState';

interface PreferencesApi {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
}

let preferences: PreferencesApi | null | undefined;

function isNative(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

async function getPreferences(): Promise<PreferencesApi | null> {
  if (preferences !== undefined) return preferences;
  if (!isNative()) {
    preferences = null;
    return null;
  }
  try {
    const mod = await import('@capacitor/preferences');
    preferences = mod.Preferences as PreferencesApi;
  } catch {
    preferences = null;
  }
  return preferences;
}

export async function loadState<T>(): Promise<T | null> {
  let raw: string | null = null;
  try {
    const prefs = await getPreferences();
    raw = prefs
      ? (await prefs.get({ key: STORAGE_KEY })).value
      : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt payload — start clean rather than crashing on boot.
    return null;
  }
}

export async function saveState(state: unknown): Promise<void> {
  const raw = JSON.stringify(state);
  try {
    const prefs = await getPreferences();
    if (prefs) await prefs.set({ key: STORAGE_KEY, value: raw });
    else localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Storage full or blocked (private mode) — the app still works in-session.
  }
}
