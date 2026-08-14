/**
 * Persisted settings and best time.
 *
 * Everything lives under one localStorage key as one JSON blob. Browsers can
 * refuse localStorage entirely when a page is opened from file://, which is
 * exactly how a judge might play the entry, so every access is guarded.
 */

const STORAGE_KEY = 'prismhoof';

const DEFAULT_SAVE_DATA = {
    /** Best completed run, in seconds. 0 means "no run finished yet". */
    bestRunSeconds: 0,
    /** Highest level index reached, so a run can be resumed from the title screen. */
    furthestLevelIndex: 0,
    musicEnabled: true,
    soundEnabled: true,
    musicVolume: 0.6,
    soundVolume: 0.7,
    screenShakeEnabled: true,
};

function loadSaveData() {
    try {
        return { ...DEFAULT_SAVE_DATA, ...JSON.parse(localStorage[STORAGE_KEY]) };
    } catch {
        return { ...DEFAULT_SAVE_DATA };
    }
}

export const saveData = loadSaveData();

export function persistSaveData() {
    try {
        localStorage[STORAGE_KEY] = JSON.stringify(saveData);
    } catch {
        // Storage is unavailable. The session still works, it just will not be remembered.
    }
}
