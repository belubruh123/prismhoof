/**
 * The audio context and its two output buses.
 *
 * Nothing is created until the first key press, because browsers refuse to
 * start an AudioContext without a user gesture, and a game that throws on load
 * is worse than a game that is briefly silent.
 *
 * Music and sound effects have separate buses so each can be muted and mixed on
 * its own from the settings screen.
 */

import { saveData } from '../core/storage.js';

let audioContext = null;
let musicBus = null;
let soundBus = null;

/** Keeps the mix well under clipping when several effects overlap. */
const MASTER_HEADROOM = 0.45;

export function initialiseAudio() {
    if (audioContext) return audioContext;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    audioContext = new AudioContextClass();

    musicBus = audioContext.createGain();
    soundBus = audioContext.createGain();
    musicBus.connect(audioContext.destination);
    soundBus.connect(audioContext.destination);

    applyVolumeSettings();
    return audioContext;
}

/** True once audio is usable. Every play function checks this and gives up quietly. */
export function isAudioReady() {
    return Boolean(audioContext) && audioContext.state !== 'suspended';
}

export function getAudioContext() {
    return audioContext;
}

export function getMusicBus() {
    return musicBus;
}

export function getSoundBus() {
    return soundBus;
}

export function audioTime() {
    return audioContext ? audioContext.currentTime : 0;
}

/** Re-reads the saved settings. Called whenever a toggle or slider changes. */
export function applyVolumeSettings() {
    if (!audioContext) return;
    musicBus.gain.value = saveData.musicEnabled ? saveData.musicVolume * MASTER_HEADROOM : 0;
    soundBus.gain.value = saveData.soundEnabled ? saveData.soundVolume * MASTER_HEADROOM : 0;
}

/**
 * Browsers suspend the context when a tab loses focus and sometimes on the
 * first gesture, so resuming is attempted whenever the player presses a key.
 */
export function resumeAudio() {
    if (!audioContext) initialiseAudio();
    if (audioContext && audioContext.state === 'suspended') audioContext.resume();
}

/** Shared band-limited noise, built once and reused by every percussive sound. */
let noiseBuffer = null;

export function getNoiseBuffer() {
    if (noiseBuffer || !audioContext) return noiseBuffer;

    const sampleCount = audioContext.sampleRate * 0.6;
    noiseBuffer = audioContext.createBuffer(1, sampleCount, audioContext.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index++) samples[index] = Math.random() * 2 - 1;

    return noiseBuffer;
}

/** MIDI note number to frequency in hertz. */
export function noteToFrequency(midiNote) {
    return 440 * 2 ** ((midiNote - 69) / 12);
}
