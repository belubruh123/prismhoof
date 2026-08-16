/**
 * The music: a four-bar loop in D major, scheduled ahead of the audio clock.
 *
 * Only the melody is written out note by note. The pad, bass and arpeggio are
 * derived from the chord progression at schedule time, which is both far
 * smaller than storing four more patterns and much easier to keep in tune.
 *
 * Two arrangements share the same loop: the menu plays pad and melody only,
 * and gameplay adds bass and arpeggio on top. Moving between them is a single
 * number, so the music never has to stop and restart.
 */

import { audioTime, getAudioContext, getMusicBus, isAudioReady, noteToFrequency } from './audio.js';

const BEATS_PER_MINUTE = 128;
const STEPS_PER_BEAT = 4;
const SECONDS_PER_STEP = 60 / BEATS_PER_MINUTE / STEPS_PER_BEAT;

const STEPS_PER_BAR = STEPS_PER_BEAT * 4;
const LOOP_STEPS = STEPS_PER_BAR * 8;

/**
 * Eight bars in D major. The first four are the hopeful I - V - vi - IV; the
 * second four drop to the relative minor and climb back out, so the loop has
 * somewhere to go and does not wear through in thirty seconds.
 */
const CHORDS = [
    { root: 50, intervals: [0, 4, 7] },  // D
    { root: 45, intervals: [0, 4, 7] },  // A
    { root: 47, intervals: [0, 3, 7] },  // B minor
    { root: 43, intervals: [0, 4, 7] },  // G
    { root: 47, intervals: [0, 3, 7] },  // B minor
    { root: 45, intervals: [0, 3, 7] },  // A minor
    { root: 43, intervals: [0, 4, 7] },  // G
    { root: 45, intervals: [0, 4, 7] },  // A
];

/**
 * The tune, one entry per sixteenth. A note number starts a note, and zero
 * holds whatever came before, so note lengths fall out of the spacing.
 *
 * Two bars long against a four-bar chord loop, so the same phrase lands over
 * two different harmonies and the loop takes twice as long to feel repetitive.
 */
const MELODY = [
    69, 0, 0, 0, 66, 0, 69, 0, 71, 0, 0, 0, 74, 0, 0, 0,
    73, 0, 0, 0, 71, 0, 0, 0, 69, 0, 71, 0, 73, 0, 0, 0,
];

/** Which sixteenths the bass plays on, within a bar. */
const BASS_STEPS = [0, 6, 8, 14];
/** And which the kick lands on. Four on the floor, with a push before the turnaround. */
const KICK_STEPS = [0, 4, 8, 12, 14];

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

/** A kick drum: one sine whose pitch falls off a cliff. */
function playKick(startTime) {
    const context = getAudioContext();
    const oscillator = context.createOscillator();
    const envelope = context.createGain();

    oscillator.frequency.setValueAtTime(150, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(42, startTime + 0.09);

    envelope.gain.setValueAtTime(0.32, startTime);
    envelope.gain.exponentialRampToValueAtTime(0.0005, startTime + 0.19);

    oscillator.connect(envelope).connect(getMusicBus());
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.24);
}

/** How long the melody note starting at `step` should ring for. */
function melodyNoteLength(step) {
    let length = 1;
    while (length < 8 && !MELODY[(step + length) % MELODY.length]) length++;
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

    const melodyNote = MELODY[step % MELODY.length];
    if (melodyNote) {
        const length = SECONDS_PER_STEP * melodyNoteLength(step) * 0.95;
        // Two oscillators a whisker apart. The beating between them is what
        // turns one thin triangle wave into something with a bit of width.
        playVoice(melodyNote, startTime, length, 'triangle', 0.12, 0.02, 2600);
        playVoice(melodyNote + 0.06, startTime, length, 'triangle', 0.07, 0.03, 2000);
    }

    if (!arrangement) return;

    // Kick: a sine dropped hard from a click to a thud, which is the whole drum.
    if (KICK_STEPS.includes(stepInBar)) playKick(startTime);

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
