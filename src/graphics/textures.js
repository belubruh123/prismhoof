/**
 * The soft radial glow used behind the horn, the gate and anything else that
 * needs to look lit rather than merely coloured.
 */



/** A soft radial glow, for the horn, pickups and the gate. */
export function drawRadialGlow(context, x, y, radius, color, alpha = 1) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'transparent');
    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = gradient;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.restore();
}
