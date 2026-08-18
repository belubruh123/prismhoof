/**
 * Sound effects, built from oscillators and one shared noise buffer.
 *
 * Two primitives cover everything: a swept tone and a filtered noise burst.
 * Every named effect below is a handful of numbers on top of those, which keeps
 * the whole sound design readable and costs very little.
 */

import { audioTime, getAudioContext, getNoiseBuffer, getSoundBus, isAudioReady } from './audio.js';

/**
 * A tone that sweeps from one pitch to another with a percussive envelope.
 * `endFrequency` of 0 holds the starting pitch.
 */
export function playTone(startFrequency, endFrequency, duration, volume = 0.4, waveType = 'square') {
    if (!isAudioReady()) return;

    const context = getAudioContext();
    const startTime = audioTime();

    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    if (endFrequency) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startTime + duration);
    }

    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    oscillator.connect(envelope).connect(getSoundBus());
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.02);
}

/** A noise burst through a sweeping low-pass, for impacts and dust. */
export function playNoise(duration, volume, filterStart, filterEnd) {
    if (!isAudioReady()) return;

    const context = getAudioContext();
    const startTime = audioTime();

    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer();

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterStart, startTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterEnd), startTime + duration);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(volume, startTime);
    envelope.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    source.connect(filter).connect(envelope).connect(getSoundBus());
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
}

/** A short run of notes, used for chimes. `gap` is seconds between each. */
function playArpeggio(frequencies, duration, volume, waveType, gap) {
    frequencies.forEach((frequency, index) => {
        setTimeout(() => playTone(frequency, 0, duration, volume, waveType), index * gap * 1000);
    });
}

// --- the sound design ------------------------------------------------------

/** `pitch` multiplies both ends of the sweep: the dash reuses it, an octave up. */
export const playJumpSound = (pitch = 1) => playTone(260 * pitch, 560 * pitch, 0.16, 0.3, 'square');

export function playLandSound(impact) {
    playNoise(0.12, 0.15 + impact * 0.2, 1400, 260);
    playTone(150, 70, 0.1, 0.15 + impact * 0.15, 'sine');
}

/** A rising shimmer as the horn charges and the stream leaves it. */
export const playPaintSound = () => playTone(420, 1150, 0.22, 0.16, 'triangle');

/** Three notes up a major chord: the sound of colour coming back. */
export const playPurifySound = () => playArpeggio([660, 880, 1320], 0.3, 0.22, 'triangle', 0.055);

export function playDeathSound() {
    playTone(420, 60, 0.5, 0.3, 'sawtooth');
    playNoise(0.4, 0.2, 900, 120);
}

export const playGateSound = () => playArpeggio([523, 659, 784, 1047], 0.5, 0.2, 'triangle', 0.09);

export const playMenuMoveSound = () => playTone(620, 780, 0.07, 0.16, 'square');
export const playMenuSelectSound = () => playArpeggio([780, 1170], 0.14, 0.2, 'square', 0.05);
