/**
 * Keyboard input. Desktop only, by design - there is no touch or pointer path.
 *
 * Keys are tracked by `KeyboardEvent.code`, which is layout independent, so WASD
 * stays in the same physical place on an AZERTY keyboard.
 */

const heldKeys = new Set();
const pressedThisFrame = new Set();

/** Keys the browser would otherwise use to scroll the page. */
const KEYS_TO_SWALLOW = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

export const MOVE_LEFT_KEYS = ['ArrowLeft', 'KeyA'];
export const MOVE_RIGHT_KEYS = ['ArrowRight', 'KeyD'];
export const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
export const DIVE_KEYS = ['ArrowDown', 'KeyS'];
export const DASH_KEYS = ['KeyK', 'KeyX'];
export const PAINT_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyJ'];
/** Toggles between chasing the unicorn and framing the whole course. */
export const VIEW_KEYS = ['KeyC'];
export const CONFIRM_KEYS = ['Enter', 'Space', 'KeyE'];
export const BACK_KEYS = ['Escape', 'Backspace'];
export const MENU_UP_KEYS = ['ArrowUp', 'KeyW'];
export const MENU_DOWN_KEYS = ['ArrowDown', 'KeyS'];

/**
 * Called on every key press, not just the first.
 *
 * Starting audio needs a trusted user gesture, and a browser may refuse the
 * first few, so the audio setup is retried on each press until it takes. The
 * callback is written to be safely repeatable.
 */
let keyGestureCallback = null;

export function onKeyGesture(callback) {
    keyGestureCallback = callback;
}

export function initialiseInput() {
    addEventListener('keydown', (event) => {
        if (KEYS_TO_SWALLOW.has(event.code)) event.preventDefault();

        keyGestureCallback?.();

        if (event.repeat) return;
        heldKeys.add(event.code);
        pressedThisFrame.add(event.code);
    });

    addEventListener('keyup', (event) => heldKeys.delete(event.code));

    // Held keys would otherwise stick down forever if the window loses focus mid-press.
    addEventListener('blur', () => heldKeys.clear());
}

/** True for every frame the key is held. */
export function isKeyDown(keyCodes) {
    return keyCodes.some((code) => heldKeys.has(code));
}

/** True on any frame a key went down. The opening waits on this. */
export function wasAnyKeyPressed() {
    return pressedThisFrame.size > 0;
}

/** True only on the frame the key went down. */
export function wasKeyPressed(keyCodes) {
    return keyCodes.some((code) => pressedThisFrame.has(code));
}

/** Called at the end of every frame by the game loop. */
export function clearFrameInput() {
    pressedThisFrame.clear();
}
