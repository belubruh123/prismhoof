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
 * Useful measurements when reading these: a tile is 40 units, the unicorn is
 * about one tile wide and a little over one tall, a jump clears three tiles of
 * height, and one rainbow stroke reaches roughly ten tiles across and can climb
 * about five if it is poured on the way up out of a jump.
 *
 * Thirteen levels for thirteen kilobytes. The curve is carried by the geometry:
 * the first four each introduce exactly one idea - the rainbow as a weapon, as
 * a bridge, as a ramp, and as a line through several targets - by making that
 * idea the only way through.
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
        name: 'THE SPAN',
        signs: ['AT THE EDGE OF A DROP IT ARCS ACROSS'],
        rows: [
            '..........!',
            '',
            '..P........M.....................M.....G',
            '###############.........##################',
            '###############.........##################',
            '###############.........##################',
        ],
    },
    {
        name: 'UPWARD',
        signs: ['POUR AS YOU RISE AND IT CLIMBS TOO'],
        rows: [
            '.......................................G',
            '.....................................#####',
            '',
            '',
            '.....................W',
            '',
            '..............====',
            '',
            '.....!',
            '.......M',
            '..P',
            '#########',
            '#########',
            '#########',
        ],
    },
    {
        name: 'THE PATROL',
        signs: ['LINE THEM UP - ONE POUR TAKES ALL THREE'],
        rows: [
            '.........!',
            '',
            '..P........M.......M.........M.........G',
            '##########################################',
            '##########################################',
            '##########################################',
        ],
    },
    {
        name: 'THE HOLLOW',
        signs: ['YOU CAN LAND ON YOUR OWN RAINBOW'],
        rows: [
            '..P.....................................G',
            '#####...............................######',
            '.........!',
            '',
            '..........W',
            '',
            '',
            '',
            '.......M.....................M',
            '##########################################',
            '##########################################',
            '##########################################',
        ],
    },
    {
        name: 'THE LONG DARK',
        rows: [
            '',
            '',
            '.....................W',
            '',
            '',
            '..P..M.............................M...G',
            '########................##################',
            '########................##################',
            '########................##################',
        ],
    },
    {
        name: 'STEPPING STONES',
        signs: ['PAINT ONLY REFILLS ON SOLID GROUND'],
        rows: [
            '..........!',
            '',
            '.P.M............M...............M......G',
            '######........######........##############',
            '######........######........##############',
            '######........######........##############',
        ],
    },
    {
        name: 'THE CLIMB',
        rows: [
            '..................................G',
            '................................##########',
            '',
            '',
            '.......................W',
            '......................=====',
            '',
            '',
            '',
            '',
            '............=====',
            '..........W',
            '',
            '',
            '..P.....M',
            '##########################################',
        ],
    },
    {
        name: 'THE LOW ROAD',
        rows: [
            '',
            '#############################',
            '',
            '',
            '..P.....M.........M.........M..........G',
            '##########################################',
            '##########################################',
        ],
    },
    {
        name: 'THE GAUNTLET',
        rows: [
            '.............W...................W',
            '',
            '',
            '..P...M.........M................M.....G',
            '#########....#########....################',
            '#########....#########....################',
            '#########....#########....################',
        ],
    },
    {
        name: 'THE SPIRE',
        rows: [
            '.....................G',
            '....................#####',
            '',
            '.................W',
            '',
            '',
            '............====..............====',
            '',
            '',
            '',
            '..P..M.........................M',
            '##########################################',
            '##########################################',
        ],
    },
    {
        name: 'TWO SKIES',
        rows: [
            '',
            '.....................W',
            '..............M',
            '..........===============',
            '',
            '',
            '..P....M.........................M.....G',
            '####################.......###############',
            '####################.......###############',
            '####################.......###############',
        ],
    },
    {
        name: 'LAST LIGHT',
        signs: ['THE LAST OF THE GLOOM'],
        rows: [
            '...............W',
            '',
            '',
            '',
            '.....................W',
            '',
            '',
            '......!',
            '',
            '..P....M................M.........M....G',
            '##########################################',
            '##########################################',
            '##########################################',
        ],
    },
];
