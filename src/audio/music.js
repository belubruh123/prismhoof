/**
 * The music: a four-bar loop in D major, scheduled ahead of the audio clock.
 *
 * Only the melody is written out note by note. The pad, bass and arpeggio are
 * derived from the chord progression at schedule time, which is both far
 * smaller than storing four more patterns and much easier to keep in tune.
 *
 * Two arrangements share the same loop: the menu plays pad and melody only,
 * and gameplay adds bass, arpeggio and percussion on top. Moving between them
 * is a single number, so the music never has to stop and restart.
 */

import { audioTime, getAudioContext, getMusicBus, getNoiseBuffer, isAudioReady, noteToFrequency } from './audio.js';

const BEATS_PER_MINUTE = 106;
const STEPS_PER_BEAT = 4;
const SECONDS_PER_STEP = 60 / BEATS_PER_MINUTE / STEPS_PER_BEAT;

const STEPS_PER_BAR = STEPS_PER_BEAT * 4;
const LOOP_STEPS = STEPS_PER_BAR * 4;

/** I - V - vi - IV in D major: the most hopeful four chords there are. */
const CHORDS = [
    { root: 50, intervals: [0, 4, 7] }, // D
    { root: 45, intervals: [0, 4, 7] }, // A
    { root: 47, intervals: [0, 3, 7] }, // B minor
    { root: 43, intervals: [0, 4, 7] }, // G
];

/**
 * The tune, one entry per sixteenth. A note number starts a note, and zero
 * holds whatever came before, so note lengths fall out of the spacing.
 */
const MELODY = [
    69, 0, 0, 0, 66, 0, 69, 0, 71, 0, 0, 0, 74, 0, 0, 0,
    73, 0, 0, 0, 71, 0, 0, 0, 69, 0, 71, 0, 73, 0, 0, 0,
    71, 0, 0, 0, 74, 0, 0, 0, 73, 0, 71, 0, 69, 0, 0, 0,
    67, 0, 0, 0, 69, 0, 71, 0, 74, 0, 0, 0, 0, 0, 0, 0,
];

/** Which sixteenths the bass plays on, within a bar. */
const BASS_STEPS = [0, 6, 8, 14];

/** How far ahead of the audio clock notes are queued, and how often we top up. */
const LOOKAHEAD_SECONDS = 0.15;
const TICK_MILLISECONDS = 25;

let schedulerTimer = null;
let nextStepTime = 0;
let currentStep = 0;
/** 0 = menu arrangement, 1 = full gameplay arrangement. */
let arrangement = 0;

/**
 * One voice. `filterFrequency` of 0 skips the filter node entirely, which
 * matters because the pad plays three notes every bar.
 */
function playVoice(midiNote, startTime, duration, waveType, volume, attack, filterFrequency) {
    const context = getAudioContext();

    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.type = waveType;
    oscillator.frequency.value = noteToFrequency(midiNote);

    envelope.gain.setValueAtTime(0, startTime);
    envelope.gain.linearRampToValueAtTime(volume, startTime + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    let output = oscillator.connect(envelope);

    if (filterFrequency) {
        const filter = context.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFrequency;
        output = output.connect(filter);
    }

    output.connect(getMusicBus());
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.05);
}

/** A soft noise tick, used for both the kick and the hat. */
function playPercussion(startTime, isAccent) {
    const context = getAudioContext();

    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer();

    const filter = context.createBiquadFilter();
    filter.type = isAccent ? 'lowpass' : 'highpass';
    filter.frequency.value = isAccent ? 260 : 6000;

    const envelope = context.createGain();
    const duration = isAccent ? 0.16 : 0.05;
    envelope.gain.setValueAtTime(isAccent ? 0.4 : 0.09, startTime);
    envelope.gain.exponentialRampToValueAtTime(0.0005, startTime + duration);

    source.connect(filter).connect(envelope).connect(getMusicBus());
    source.start(startTime);
    source.stop(startTime + duration + 0.02);
}

/** How long the melody note starting at `step` should ring for. */
function melodyNoteLength(step) {
    let length = 1;
    while (length < 8 && !MELODY[(step + length) % LOOP_STEPS]) length++;
    return length;
}

function scheduleStep(step, startTime) {
    const bar = (step / STEPS_PER_BAR) | 0;
    const stepInBar = step % STEPS_PER_BAR;
    const chord = CHORDS[bar];

    // Pad: the whole chord, once a bar, breathing underneath everything.
    if (stepInBar === 0) {
        for (const interval of chord.intervals) {
            playVoice(chord.root + 12 + interval, startTime, SECONDS_PER_STEP * 15, 'triangle', 0.075, 0.4, 900);
        }
    }

    const melodyNote = MELODY[step];
    if (melodyNote) {
        playVoice(melodyNote, startTime, SECONDS_PER_STEP * melodyNoteLength(step) * 0.95, 'triangle', 0.13, 0.02, 2600);
    }

    if (!arrangement) return;

    if (BASS_STEPS.includes(stepInBar)) {
        playVoice(chord.root - 12, startTime, SECONDS_PER_STEP * 2.6, 'sawtooth', 0.1, 0.01, 420);
    }

    // Arpeggio: chord tones climbing through two octaves on every other step.
    if (stepInBar % 2 === 0) {
        const toneIndex = (step / 2) % (chord.intervals.length * 2);
        const octave = toneIndex >= chord.intervals.length ? 12 : 0;
        const interval = chord.intervals[toneIndex % chord.intervals.length];
        playVoice(chord.root + 24 + octave + interval, startTime, SECONDS_PER_STEP * 1.6, 'square', 0.032, 0.005, 3200);
    }

    if (stepInBar % 8 === 0) playPercussion(startTime, true);
    else if (stepInBar % 4 === 2) playPercussion(startTime, false);
}

function tick() {
    if (!isAudioReady()) return;

    const horizon = audioTime() + LOOKAHEAD_SECONDS;
    while (nextStepTime < horizon) {
        scheduleStep(currentStep % LOOP_STEPS, nextStepTime);
        nextStepTime += SECONDS_PER_STEP;
        currentStep++;
    }
}

/** Starts the loop, or switches arrangement if it is already running. */
export function startMusic(fullArrangement) {
    arrangement = fullArrangement ? 1 : 0;
    if (schedulerTimer || !isAudioReady()) return;

    nextStepTime = audioTime() + 0.1;
    currentStep = 0;
    schedulerTimer = setInterval(tick, TICK_MILLISECONDS);
}

export function stopMusic() {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
}

export function isMusicRunning() {
    return Boolean(schedulerTimer);
}
