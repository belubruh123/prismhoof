/**
 * PRISMHOOF - entry point.
 *
 * Boots the canvas, wires up input, and starts the game loop on the title screen.
 */

import { canvasContext, initialiseCanvas } from './core/canvas.js';
import { startGameLoop } from './core/loop.js';
import { initialiseInput } from './core/input.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH } from './config.js';

initialiseCanvas();
initialiseInput();

startGameLoop(() => {
    canvasContext.fillStyle = '#150f2b';
    canvasContext.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
});
