/**
 * Keyboard input. Desktop only, by design - there is no touch or pointer path.
 *
 * Keys are tracked by `KeyboardEvent.code`, which is layout independent, so WASD
 * stays in the same physical place on an AZERTY keyboard.
 */

const heldKeys = new Set();
const pressedThisFrame = new Set();
const releasedThisFrame = new Set();

/** Keys the browser would otherwise use to scroll the page. */
const KEYS_TO_SWALLOW = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab']);

export const MOVE_LEFT_KEYS = ['ArrowLeft', 'KeyA'];
export const MOVE_RIGHT_KEYS = ['ArrowRight', 'KeyD'];
export const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW'];
export const DIVE_KEYS = ['ArrowDown', 'KeyS'];
export const PAINT_KEYS = ['ShiftLeft', 'ShiftRight', 'KeyJ'];
export const CONFIRM_KEYS = ['Enter', 'Space', 'KeyE'];
export const BACK_KEYS = ['Escape', 'Backspace'];
export const MENU_UP_KEYS = ['ArrowUp', 'KeyW'];
export const MENU_DOWN_KEYS = ['ArrowDown', 'KeyS'];

export function initialiseInput() {
    addEventListener('keydown', (event) => {
        if (KEYS_TO_SWALLOW.has(event.code)) event.preventDefault();
        if (event.repeat) return;
        heldKeys.add(event.code);
        pressedThisFrame.add(event.code);
    });

    addEventListener('keyup', (event) => {
        heldKeys.delete(event.code);
        releasedThisFrame.add(event.code);
    });

    // Held keys would otherwise stick down forever if the window loses focus mid-press.
    addEventListener('blur', () => {
        for (const code of heldKeys) releasedThisFrame.add(code);
        heldKeys.clear();
    });
}

/** True for every frame the key is held. */
export function isKeyDown(keyCodes) {
    return keyCodes.some((code) => heldKeys.has(code));
}

/** True only on the frame the key went down. */
export function wasKeyPressed(keyCodes) {
    return keyCodes.some((code) => pressedThisFrame.has(code));
}

/** True only on the frame the key came up. */
export function wasKeyReleased(keyCodes) {
    return keyCodes.some((code) => releasedThisFrame.has(code));
}

/** True if anything at all is currently held, used to gate menu auto-repeat. */
export function isAnyKeyDown() {
    return heldKeys.size > 0;
}

/** Called at the end of every frame by the game loop. */
export function clearFrameInput() {
    pressedThisFrame.clear();
    releasedThisFrame.clear();
}
