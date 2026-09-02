/**
 * The music: an eight-bar loop in D major, scheduled ahead of the audio clock.
 *
 * Only the melody is written out note by note. The pad, bass, arpeggio and
 * drums are derived from the chord progression and a handful of step lists at
 * schedule time, which is both far smaller than storing five more patterns and
 * much easier to keep in tune.
 *
 * Two arrangements share the same loop: the menu plays pad and melody only,
 * and gameplay adds bass, arpeggio and drums on top. Moving between them is a
 * single number, so the music never has to stop and restart.
 *
 * Three things keep a loop this short from wearing through. The tune is four
 * bars against eight of harmony, so each phrase is heard twice over different
 * chords and never lands the same way. Notes with room after them are echoed an
 * octave up an eighth later, which is one extra oscillator standing in for a
 * second player. And the offbeats are late - a sixth of a step - so the hats
 * swing instead of marching.
 *
 * Clearing a course hands the whole thing over to `playCourseCleared` for a
 * second and a half, and finishing the run to `playFanfare`: the loop keeps
 * counting underneath but plays nothing, because two pieces of music over one
 * another is neither of them.
 */

import { audioTime, getAudioContext, getMusicBus, getNoiseBuffer, isAudioReady, noteToFrequency } from './audio.js';

const BEATS_PER_MINUTE = 128;
const STEPS_PER_BEAT = 4;
const SECONDS_PER_STEP = 60 / BEATS_PER_MINUTE / STEPS_PER_BEAT;

const STEPS_PER_BAR = STEPS_PER_BEAT * 4;
const LOOP_STEPS = STEPS_PER_BAR * 8;

/**
 * Eight bars in D major: I - V - vi - IV, then vi - iii - IV - V, so the loop
 * has somewhere to go and does not wear through in thirty seconds. The second
 * half used to reach for an A minor, which is a borrowed chord in this key -
 * its C natural sat a semitone under the tune's C# four times a loop, and the
 * arpeggio spelled the clash out. F# minor does the same darkening job with
 * every note inside the key.
 */
const CHORDS = [
    { chordRoot: 50, intervals: [0, 4, 7] },  // D
    { chordRoot: 45, intervals: [0, 4, 7] },  // A
    { chordRoot: 47, intervals: [0, 3, 7] },  // B minor
    { chordRoot: 43, intervals: [0, 4, 7] },  // G
    { chordRoot: 47, intervals: [0, 3, 7] },  // B minor
    { chordRoot: 42, intervals: [0, 3, 7] },  // F# minor
    { chordRoot: 43, intervals: [0, 4, 7] },  // G
    { chordRoot: 45, intervals: [0, 4, 7] },  // A
];

/**
 * The tune, one entry per sixteenth. A note number starts a note, and zero
 * holds whatever came before, so note lengths fall out of the spacing.
 *
 * Four bars against eight of harmony, in two halves that answer each other.
 * The first states the phrase square on the beat; the second comes in a beat
 * late and hangs its notes off the offbeats, where the swing is.
 *
 * Every note is checked against both of the chords it has to sit over, because
 * a four-bar tune over eight bars of harmony means each one is heard twice and
 * a note that works the first time can be a semitone out the second. Three were:
 * a C# ending the second bar rang on into a B minor, and the last bar climbed
 * through a C# and an F# that both landed a semitone off the G underneath.
 */
const MELODY = [
    69, 0, 0, 0, 66, 0, 69, 0, 71, 0, 0, 0, 74, 0, 0, 0,
    73, 0, 0, 0, 71, 0, 0, 0, 69, 0, 71, 0, 69, 0, 0, 0,
    0, 0, 76, 0, 0, 74, 0, 71, 0, 0, 69, 0, 0, 71, 0, 0,
    71, 0, 0, 0, 0, 69, 0, 76, 0, 0, 79, 0, 0, 76, 0, 0,
];

/** Which sixteenths the bass plays on, within a bar. */
const BASS_STEPS = [0, 6, 8, 14];
/** And which the kick lands on. Four on the floor, with a push before the turnaround. */
const KICK_STEPS = [0, 4, 8, 12, 14];
/** The backbeat, where a snare has always gone. */
const SNARE_STEPS = [4, 12];

/** How late an offbeat sixteenth is played. This is the whole of the groove. */
const SWING_SECONDS = SECONDS_PER_STEP / 6;

/** How far ahead of the audio clock notes are queued, and how often we top up. */
const LOOKAHEAD_SECONDS = 0.15;
const TICK_MILLISECONDS = 25;

let schedulerTimer = null;
let nextStepTime = 0;
let currentStep = 0;
/** The loop keeps counting but plays nothing until the audio clock passes this. */
let quietUntil = 0;
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

/**
 * A noise hit through a high-pass. The hats and the snare differ only in
 * volume, cutoff and decay, so they are one voice rather than two.
 */
function playNoiseHit(startTime, volume, filterFrequency, decay) {
    const context = getAudioContext();

    const source = context.createBufferSource();
    source.buffer = getNoiseBuffer();

    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = filterFrequency;

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(volume, startTime);
    envelope.gain.exponentialRampToValueAtTime(0.0005, startTime + decay);

    source.connect(filter).connect(envelope).connect(getMusicBus());
    source.start(startTime);
    source.stop(startTime + decay + 0.02);
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

    // Everything on an offbeat sixteenth is played late, drums included.
    if (stepInBar % 2) startTime += SWING_SECONDS;

    // Pad: the whole chord, once a bar, breathing underneath everything.
    if (stepInBar === 0) {
        for (const interval of chord.intervals) {
            playVoice(chord.chordRoot + 12 + interval, startTime, SECONDS_PER_STEP * 15, 'triangle', 0.075, 0.4, 900);
        }
    }

    const melodyNote = MELODY[step % MELODY.length];
    if (melodyNote) {
        const ringSteps = melodyNoteLength(step);
        playVoice(melodyNote, startTime, SECONDS_PER_STEP * ringSteps * 0.95, 'triangle', 0.14, 0.02, 2600);

        // And the same note again, quietly, an octave up and an eighth behind:
        // one oscillator doing the work of a second player.
        //
        // Two sixteenths rather than three, and only where the tune has left
        // four clear ones after the note. Both of those are the difference
        // between an echo and a mistake. An odd delay lands every tap on the
        // opposite side of the swing from the note that cast it - twenty
        // milliseconds out, in the wrong direction, twenty times a phrase - and
        // a tap arriving on top of the next note of the tune, or a sixteenth
        // before it, is heard as sloppy doubling rather than as a delay. This
        // leaves seven of them in a four-bar phrase, all in the gaps.
        if (ringSteps > 3) {
            playVoice(melodyNote + 12, startTime + SECONDS_PER_STEP * 2, 0.18, 'triangle', 0.04, 0.02, 5000);
        }
    }

    if (!arrangement) return;

    // Kick: a sine dropped hard from a click to a thud, which is the whole drum.
    if (KICK_STEPS.includes(stepInBar)) playKick(startTime);
    if (SNARE_STEPS.includes(stepInBar)) playNoiseHit(startTime, 0.11, 1100, 0.16);
    // Hats on every offbeat, where the swing has just moved them.
    if (stepInBar % 2) playNoiseHit(startTime, 0.04, 8000, 0.05);

    // Two steps exactly, so the last bass note of a bar has stopped before the
    // next chord's arrives. Two roots a semitone apart overlapping down here is
    // a growl, not a chord change.
    if (BASS_STEPS.includes(stepInBar)) {
        playVoice(chord.chordRoot - 12, startTime, SECONDS_PER_STEP * 2, 'sawtooth', 0.1, 0.01, 420);
    }

    // Arpeggio: chord tones climbing through two octaves on every other step.
    if (stepInBar % 2 === 0) {
        const toneIndex = (step / 2) % (chord.intervals.length * 2);
        const octave = toneIndex >= chord.intervals.length ? 12 : 0;
        const interval = chord.intervals[toneIndex % chord.intervals.length];
        playVoice(chord.chordRoot + 24 + octave + interval, startTime, SECONDS_PER_STEP * 1.6, 'square', 0.032, 0.005, 3200);
    }
}

function tick() {
    if (!isAudioReady()) return;

    const horizon = audioTime() + LOOKAHEAD_SECONDS;
    while (nextStepTime < horizon) {
        if (nextStepTime > quietUntil) scheduleStep(currentStep % LOOP_STEPS, nextStepTime);
        nextStepTime += SECONDS_PER_STEP;
        currentStep++;
    }
}

/**
 * Starts the loop again in whatever arrangement was last asked for.
 *
 * Every key press ends up here, because a key press is the only thing a browser
 * will start an AudioContext for - so this must not be what decides how the
 * music is scored. The screens decide that, and this leaves their decision
 * alone. Calling `startMusic(false)` on every keystroke instead is what used to
 * mean the bass, the arpeggio and the drums were only ever heard for the one
 * frame after unpausing.
 */
export const resumeMusic = () => startMusic(arrangement);

/** Starts the loop, or switches arrangement if it is already running. */
export function startMusic(fullArrangement) {
    arrangement = fullArrangement ? 1 : 0;
    if (schedulerTimer || !isAudioReady()) return;

    nextStepTime = audioTime() + 0.1;
    currentStep = 0;
    schedulerTimer = setInterval(tick, TICK_MILLISECONDS);
}

/**
 * The end of one course: three notes stepping up onto the tonic, with the chord
 * swelling in underneath rather than being struck.
 *
 * It is a comma, not a full stop. Twelve of the thirteen courses are followed by
 * another one, and a fanfare after every single one of them is a fanfare that
 * has stopped meaning anything by the fourth. Same triangle as the tune, no
 * drums, and quieter than the melody it interrupts.
 */
export function playCourseCleared() {
    if (!isAudioReady()) return;

    const startTime = audioTime() + 0.04;
    quietUntil = startTime + 1.8;

    [71, 73, 74].forEach((midiNote, index) => {
        playVoice(midiNote, startTime + index * 0.17, 0.6, 'triangle', 0.13, 0.02, 2600);
    });

    // A long attack, so the chord arrives under the last note instead of hitting.
    for (const interval of [0, 4, 7, 12]) {
        playVoice(50 + interval, startTime + 0.34, 1.5, 'triangle', 0.055, 0.25, 1600);
    }
}

/**
 * The end of the whole run, and the only place this plays: a rising D major
 * arpeggio doubled two octaves down, landing on the chord with a kick under it.
 * Thirteen courses have been waiting for it.
 */
const FANFARE = [74, 78, 81, 86];
/** How long the loop holds off for. The chord is still ringing at the end of it. */
const FANFARE_SECONDS = 2.3;

export function playFanfare() {
    if (!isAudioReady()) return;

    const startTime = audioTime() + 0.04;

    // The loop steps on in silence underneath rather than stopping: there is
    // nothing to restart afterwards, and no key press can bring it back in over
    // the top of the flourish.
    quietUntil = startTime + FANFARE_SECONDS;

    FANFARE.forEach((midiNote, index) => {
        playVoice(midiNote, startTime + index * 0.13, 0.4, 'triangle', 0.2, 0.01, 5000);
        playVoice(midiNote - 24, startTime + index * 0.13, 0.4, 'sawtooth', 0.07, 0.01, 500);
    });

    // The landing: the chord spread across two octaves under the note the run
    // ended on, a kick beneath it and a cymbal over the top, held long enough
    // to still be ringing when the banner goes.
    for (const interval of [0, 4, 7, 12, 16]) {
        playVoice(62 + interval, startTime + 0.52, 1.9, 'triangle', 0.08, 0.03, 3000);
    }
    playKick(startTime + 0.52);
    playNoiseHit(startTime + 0.52, 0.12, 6000, 0.6);
}

export function stopMusic() {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
}

export function isMusicRunning() {
    return Boolean(schedulerTimer);
}
