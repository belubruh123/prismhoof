/**
 * The levels, drawn as pictures.
 *
 *   '.' empty        '#' solid        '=' one-way platform
 *   'P' start        'G' rainbow gate
 *   'M' murk         'W' wisp         '!' sign
 *
 * Each level is authored from its topmost interesting row downwards, and every
 * row is padded out to the width of the widest one, so nothing is written that
 * is not there: the empty sky above a level is added by `parseLevel`, trailing
 * empty tiles are simply left off the end of a row, and a row with nothing in
 * it at all is written as ''. The last row here is always the level's floor.
 *
 * A '!' marks where a sign stands; the level's `signs` list holds what they
 * read, in the order they are walked past. The signs are the only text the game
 * puts in front of the player during a run - there is no tutorial screen in the
 * way, and nothing to dismiss.
 *
 * **Most of a level is empty sky, and falling into it kills you.** That is the
 * whole design. Ground you can stand on is scarce and comes as islands, ledges
 * and pillars; the rainbow is how you get from one to the next. A level laid out
 * as a long flat corridor asks nothing of the one verb the game has, so there
 * are none of those here after the first.
 *
 * Numbers that matter when reading these. A tile is 40 units.
 *
 *   a jump          rises 3 tiles, and carries 6 across at a full gallop
 *   a pour          reaches 10 tiles from a standstill, 12 at a gallop
 *   a pour + a jump climbs 5 tiles over about 10 across
 *
 * So: gaps of 6 to 10 tiles need a bridge, climbs of 4 tiles need a ramp, and
 * anything under 5 across or 3 up is a plain jump. Every stretch below is built
 * out of those three numbers.
 *
 * Thirteen levels, for thirteen kilobytes. The first four each introduce one
 * idea - the rainbow as a weapon, as a bridge, as a ramp, and as a line through
 * several targets - by making that idea the only way through.
 */

export const LEVELS = [
    {
        name: 'FIRST LIGHT',
        signs: [
            'HOLD SHIFT TO POUR A RAINBOW',
            'IT BURNS THE GLOOM AWAY',
        ],
        rows: [
            '.......!.......................!',
            '',
            '..P.......................M............G',
            '##########################################',
            '##########################################',
            '##########################################',
        ],
    },
    {
        // Two islands, then a third. Nothing under either gap.
        name: 'THE SPAN',
        signs: ['AT THE EDGE OF A DROP IT ARCS ACROSS'],
        rows: [
            '.........!',
            '',
            '..P.....M.........M...............M....G',
            '##########.......########.......##########',
            '##########.......########.......##########',
            '##########.......########.......##########',
        ],
    },
    {
        // A staircase of one-way platforms, each four tiles above the last and
        // far enough out that only a rainbow poured on the way up will reach.
        name: 'UPWARD',
        signs: ['POUR AS YOU RISE AND IT CLIMBS TOO'],
        rows: [
            '..................................G',
            '................................##########',
            '',
            '..........................W',
            '...........................M',
            '.........................=====',
            '',
            '',
            '................M',
            '...............=====',
            '',
            '.........!',
            '..P',
            '#########',
            '#########',
        ],
    },
    {
        name: 'THE PATROL',
        signs: ['LINE THEM UP - ONE POUR TAKES ALL THREE'],
        rows: [
            '.......................................G',
            '......................................####',
            '.........!',
            '',
            '..P........M.......M.........M',
            '##############################',
            '##############################',
            '##############################',
        ],
    },
    {
        // Four stones and three voids. The rainbows fade behind you.
        name: 'STEPPING STONES',
        signs: ['YOUR RAINBOWS FADE - KEEP MOVING'],
        rows: [
            '.........!',
            '',
            '.P............M...........M..........M..G',
            '#####.......#####.......#####.......######',
            '#####.......#####.......#####.......######',
        ],
    },
    {
        // Drop in, clear it out, then ride your own paint back into the light.
        name: 'THE HOLLOW',
        signs: ['YOU CAN LAND ON YOUR OWN RAINBOW'],
        rows: [
            '..P',
            '#####',
            '.........!',
            '',
            '.....................................G',
            '..................................######',
            '',
            '..........W',
            '.......M.....................M',
            '##########################################',
            '##########################################',
            '##########################################',
        ],
    },
    {
        // A ceiling low enough that jumping is off the table, and a gap in the
        // floor that therefore has to be poured across flat.
        name: 'THE LOW ROAD',
        rows: [
            '#############################',
            '',
            '',
            '..P.....M.........M.........M..........G',
            '####################.....#################',
            '####################.....#################',
            '####################.....#################',
        ],
    },
    {
        // One small island and a long way up. Everything else is sky.
        name: 'THE CLIMB',
        rows: [
            '.....................................G',
            '..................................########',
            '',
            '.............................W',
            '...........................======',
            '',
            '',
            '..................M',
            '.................=====',
            '',
            '',
            '..P.....M',
            '#########',
        ],
    },
    {
        // Two voids and one stone between them, barely wide enough to stand on.
        name: 'THE LONG DARK',
        rows: [
            '.....................W',
            '',
            '',
            '..P...........................M.....M..G',
            '########........##........################',
            '########........##........################',
            '########........##........################',
        ],
    },
    {
        // Three wisps, and nowhere to back away to.
        name: 'THE GAUNTLET',
        rows: [
            '..........W.............W........W',
            '',
            '',
            '..P..............M.............M....M...G',
            '########.......#######.......#############',
            '########.......#######.......#############',
            '########.......#######.......#############',
        ],
    },
    {
        // A tight zigzag: up and to the right, up and back to the left, up again.
        name: 'THE SPIRE',
        rows: [
            '....................G',
            '.................########',
            '',
            '......W',
            '',
            '....======',
            '',
            '',
            '..................M',
            '................======',
            '',
            '',
            '..P.....M',
            '#########',
        ],
    },
    {
        // The Gloom is on both roads, so both roads have to be walked.
        name: 'TWO SKIES',
        rows: [
            '.....................W',
            '........M................M',
            '....========.......========',
            '',
            '',
            '..P.............................M......G',
            '###################.......################',
            '###################.......################',
            '###################.......################',
        ],
    },
    {
        // Everything at once, over nothing at all.
        name: 'LAST LIGHT',
        signs: ['THE LAST OF THE GLOOM'],
        rows: [
            '......................................G',
            '....................................######',
            '',
            '............................M.W',
            '...........................======',
            '',
            '',
            '.................W.M',
            '................======',
            '......!',
            '',
            '..P.....M',
            '##########',
        ],
    },
];
