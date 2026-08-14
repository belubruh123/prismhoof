/**
 * The screen stack.
 *
 * Screens are pushed on top of one another. Everything on the stack is drawn,
 * bottom first, so the pause menu can sit over a still-visible level. Only the
 * topmost screen is updated unless it opts into letting the one below keep
 * running.
 */

import { wrap } from '../core/canvas.js';
import {
    BACK_KEYS,
    CONFIRM_KEYS,
    MENU_DOWN_KEYS,
    MENU_UP_KEYS,
    wasKeyPressed,
} from '../core/input.js';
import { playMenuBackSound, playMenuMoveSound, playMenuSelectSound } from '../audio/sfx.js';

export class Screen {
    age = 0;

    /** When true, the screen below this one keeps updating as well. */
    updatesBelow = false;

    update(elapsedSeconds) {
        this.age += elapsedSeconds;
    }

    render() {}

    /** Called when this screen becomes the top of the stack again. */
    onResume() {}
}

const stack = [];

export function pushScreen(screen) {
    stack.push(screen);
    return screen;
}

export function popScreen() {
    stack.pop();
    stack[stack.length - 1]?.onResume();
}

/** Replaces the whole stack. Used when leaving a run for the title screen. */
export function resetScreens(screen) {
    stack.length = 0;
    stack.push(screen);
}

export function topScreen() {
    return stack[stack.length - 1];
}

export function updateScreens(elapsedSeconds) {
    for (let index = stack.length - 1; index >= 0; index--) {
        stack[index].update(elapsedSeconds);
        if (!stack[index].updatesBelow) break;
    }
}

export function renderScreens() {
    for (const screen of stack) wrap(() => screen.render());
}

/**
 * A screen driven by a vertical list of choices.
 *
 * Subclasses fill in `items`, each `{ label, detail?, onSelect?, onAdjust? }`.
 * `onAdjust(direction)` makes a row into a left/right control, which is how the
 * settings sliders work without needing a second widget type.
 */
export class MenuScreen extends Screen {
    items = [];
    selectedIndex = 0;

    update(elapsedSeconds) {
        super.update(elapsedSeconds);

        if (wasKeyPressed(MENU_UP_KEYS)) this.moveSelection(-1);
        if (wasKeyPressed(MENU_DOWN_KEYS)) this.moveSelection(1);

        const item = this.items[this.selectedIndex];

        if (item?.onAdjust) {
            if (wasKeyPressed(['ArrowLeft', 'KeyA'])) this.adjust(item, -1);
            if (wasKeyPressed(['ArrowRight', 'KeyD'])) this.adjust(item, 1);
        }

        if (wasKeyPressed(CONFIRM_KEYS) && item?.onSelect) {
            playMenuSelectSound();
            item.onSelect();
        }

        if (wasKeyPressed(BACK_KEYS) && this.onBack) {
            playMenuBackSound();
            this.onBack();
        }
    }

    moveSelection(direction) {
        this.selectedIndex = (this.selectedIndex + direction + this.items.length) % this.items.length;
        playMenuMoveSound();
    }

    adjust(item, direction) {
        playMenuMoveSound();
        item.onAdjust(direction);
    }
}
