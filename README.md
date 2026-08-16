# PRISMHOOF

**PRISMHOOF** is my entry for [js13kGames 2026](https://js13kgames.com/). The theme for the
competition was **Unicorns and Rainbows**.

It is a 2D precision momentum platformer. Desktop, keyboard only, everything drawn on a
single canvas — there is no DOM UI anywhere in the game, and no image, audio or font
assets. Every pixel is generated at runtime.

> The Gloom has drained the color from the Skyward Meadows. You are the last unicorn, and
> your horn still holds the seven colors. Paint the sky, purify the Gloom, bring back the
> rainbow.

## The mechanic

**One verb, four uses.** Hold the paint key and your horn hoses out a rainbow. The bright
head of the stream flies forward, falls under its own gravity, and lays a **solid rainbow**
behind it until it splashes against the scenery. Where you fire from decides what you get:

| Fired from | What you get |
| --- | --- |
| Flat ground | the stream sweeps down through the Gloom standing there — **a weapon** |
| The lip of a chasm | the ground falls away and the same shot arcs over the gap — **a bridge** |
| The way up out of a jump | it inherits your lift and climbs — **a ramp** |
| Anywhere in mid-air | the stream shoves back hard enough to catch a fall and hold a climb — **a way to fly** |

That fourth one is what makes the meter matter: in the air, paint *is* flight time. The
recoil is capped, so it is a glide and a step of height rather than a jetpack, and you can
only stop to refill by landing on something — including a rainbow you painted yourself.

Rainbows are one-way floors: you always pass up through your own paint and land on it
coming down, and you can run back along an arc you have already crossed. Paint is a limited
meter that only refills when your hooves are on something solid — a rainbow counts — so
every level is a question of *where* to spend your arcs. Purify all the Gloom and the
Rainbow Gate opens. As the Gloom clears, the color bleeds back into the world — the theme
is literally the win condition.

Wisps drink any finished rainbow they reach, so a bridge is not safe just because you
built it — that is the reason to spend a shot on one rather than outrun it.

**Thirteen levels**, for thirteen kilobytes. Most of a level is empty sky and falling into
it kills you: solid ground comes as islands, ledges and pillars, and the rainbow is how you
get from one to the next. They teach themselves, with signposts standing in the meadow
rather than a tutorial screen, and after that the geometry does the talking.

Each level is a chamber cut out of the world rather than a strip of ground in an open sky —
beyond its edges is solid rock, and the sky you can see is the sky inside the chamber.

> The stream fires *ahead* of the unicorn rather than trailing behind it, and that is a
> mechanical necessity rather than a flourish. A ribbon emitted at the horn sits
> permanently above the hooves, so a unicorn could never land on an arc it painted during
> the same jump and the core loop would never close. Testing the first version is what
> surfaced this.

## Controls

| Key | Action |
| --- | --- |
| `←` `→` / `A` `D` | Gallop |
| `Space` / `W` / `↑` | Jump (hold for height) |
| `↓` / `S` | Dive |
| `Shift` (hold) | Pour rainbow |
| `R` | Retry level |
| `P` / `Esc` | Pause |

Music and sound have independent on/off switches and volume sliders under **Settings**,
reachable from the title screen and from the pause menu.

## Build

Requires Node 20+.

```sh
make install     # npm install (4 dev dependencies)
make dev         # watch + serve the debug build on http://localhost:8013
make verify      # fully squeezed but with DEBUG on -> build/verify.html
make build       # minified, Roadroller-packed build/index.html
make zip         # build/game.zip, checked against the 13312 byte limit
make all         # build + zip
```

`make zip` will use [advancecomp](https://github.com/amadvance/advancecomp)'s `advzip` or
[ECT](https://github.com/fhanau/Efficient-Compression-Tool) to recompress the archive if
either is installed, and says so if neither is.

## How the source stays readable

The competition asks for readable source, and 13kB asks for the opposite. Every
byte-saving step therefore lives in `tools/`, and nothing under `src/` is written for
size — full descriptive identifiers, one concept per file, no abbreviations.

`tools/build.mjs` runs the whole squeeze:

1. **esbuild** bundles the ES modules into one IIFE, with `DEBUG` as a compile-time
   constant so every debug branch — and the entire `src/debug.js` module — is eliminated
   rather than shipped.
2. **terser** compresses and mangles, including our own property names.
3. **Roadroller** packs the result into a self-extracting payload.
4. The packed script and the minified CSS are inlined into `src/index.html`.

It prints a per-module byte table on every build, so the size budget stays visible while
the game is being written rather than becoming a crisis at the end.

Property mangling is worth about 8% of the final zip, and it only stays safe because the
source never reaches a property through a string built at runtime — the palette assigns
its colours by name, the level character table is a `Map`, and the settings screen names
every field it writes. `make verify` exists for exactly this: it applies the full release
squeeze with `DEBUG` still on, so a mangled build can be driven by the debug hooks. A
debug build cannot catch a mangling bug and a release build cannot be driven, so neither
one alone is enough. It caught two real ones.

## Layout

```
src/
  core/       canvas, loop, input, storage, maths, geometry   (no game knowledge)
  engine/     entity, world, camera, particles                (no game knowledge)
  graphics/   palette, textures, sky, hair, typography, ui
  entities/   unicorn, unicorn art, rainbow ribbon, terrain, gloom, gate, signs
  screens/    title, how to play, settings, gameplay, pause
  levels/     level format, level builder, level data
  audio/      context, sound effects, music
  debug.js    headless-testing hooks, dropped from the release build
tools/        build, zip and dev server
```

Two files are worth reading first: `src/entities/rainbow-ribbon.js` is the whole game in
one class, and `src/entities/unicorn-art.js` is the entire character performance — flat
vector only, with legs solved by two-bone IK from a hoof target so they stay planted, and
a mane and tail built from angular spring chains.

`src/levels/levels.js` is worth a look too: every level is drawn as a picture, one string
per row, with `!` marking where a signpost stands and the level's `signs` list supplying
what it reads.

## Credits

Everything — art, music, sound synthesis, engine, levels — is original to this entry. No
libraries ship in the build; the four dev dependencies are build tooling only.

Structure and build approach are indebted to [CLAWSTRIKE](https://github.com/remvst/clawstrike)
by Rémi Vansteelandt, the js13kGames 2025 winner, whose source is a great read.
