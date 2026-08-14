/**
 * PRISMHOOF - entry point.
 *
 * Boots the canvas, wires up input and audio, and runs the screen stack.
 */

import { initialiseAudio, resumeAudio } from './audio/audio.js';
import { startMusic } from './audio/music.js';
import { initialiseCanvas } from './core/canvas.js';
import { initialiseInput, onKeyGesture } from './core/input.js';
import { startGameLoop } from './core/loop.js';
import { saveData } from './core/storage.js';
import { renderScreens, resetScreens, updateScreens } from './screens/screen.js';
import { TitleScreen } from './screens/title-screen.js';
import { renderDebugOverlay, runDebugWarmUp } from './debug.js';

initialiseCanvas();
initialiseInput();

// Browsers will not start an AudioContext without a trusted gesture, so audio
// setup is attempted on every key press until one of them is accepted.
onKeyGesture(() => {
    initialiseAudio();
    resumeAudio();
    if (saveData.musicEnabled) startMusic(false);
});

resetScreens(new TitleScreen());

if (DEBUG) runDebugWarmUp();

startGameLoop((elapsedSeconds) => {
    updateScreens(elapsedSeconds);
    renderScreens();

    if (DEBUG) renderDebugOverlay(elapsedSeconds);
});
