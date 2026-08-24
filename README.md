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

**Thirteen levels**, for thirteen kilobytes. Solid ground is scarce and comes as islands,
ledges and pillars; under all of it is a lake of lava, and the rainbow is how you get from
one piece of ground to the next. They teach themselves, with signposts standing in the
meadow rather than a tutorial screen, and after that the geometry does the talking.

Each level is a **chamber cut out of the world** rather than a strip of ground under an
open sky — beyond its edges is solid rock, below it is the lava, and the sky you can see is
the sky inside the chamber. The whole chamber is scaled to fit the screen, so the view
never moves: you can read the shape of a course and plan a route before you commit to it.
That makes the unicorn small and costs some of the character animation up close, which is a
trade made on purpose.

The story is told in a short opening rather than buried in a menu, and the colour floods
back into the sky as the last line lands — the screen states the premise and demonstrates
the win condition in the same gesture. It is skippable, and only shown to a save file that
has never finished a level.

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
| `K` / `X` | Air dash (once per jump) |
| `Shift` (hold) | Pour rainbow |
| `R` | Retry level |
| `P` / `Esc` | Pause |

The air dash is a short flat burst that only the ground gives back — the same rule the paint
meter runs on. It is deliberately worth about **1.8 tiles** of extra reach, measured: a plain
jump carries 6 tiles and the gaps that ask for a bridge are 7, so a dash rescues a jump that
was going to come up short without ever turning a bridge into a choice. Gravity is skipped
for its duration but the vertical axis is left alone, so a pour fired mid-dash still lifts —
dash for distance, paint for height, and using both at once is the interesting thing to do
with them.

Music and sound have independent on/off switches and volume sliders under **Settings**,
reachable from the title screen and from the pause menu.

## Build

Requires Node 20+.

```sh
make install     # npm install (4 dev dependencies)
make dev         # watch + serve the debug build and the editor on port 8013
make verify      # fully squeezed but with DEBUG on -> build/verify.html
make build       # minified, Roadroller-packed build/index.html
make check       # prove the course editor round-trips every level unchanged
make zip         # build/game.zip, checked against the 13312 byte limit
make all         # build + zip
```

## The course editor

`make dev` starts a local server on **port 8013** and puts a course editor next to the game
there, at the path `/editor.html` — open it from your own browser once the server is running.
It is a dev tool, not part of the entry: nothing in `tools/` ships, so it costs zero bytes of
the budget. It looks like a form because that is what it is — the only things on the page
allowed any colour are the grid and the game running under it.

It has to be served rather than opened from disk: a `file://` page cannot import the module
it shares with `make check`, and the test run could not reach the game. Opened that way it
says so at the top instead of sitting there looking functional.

Paint terrain with the mouse, `1`–`8` to pick a tile, and it prints the level literal ready
to paste into `src/levels/levels.js` — trailing empty tiles trimmed and empty sky rows
dropped, which `parseLevel` pads back in and which would otherwise be bytes the build carries
for nothing. It opens any of the thirteen courses to start from (`#level=4` deep-links to
one).

**Test run** plays the course without leaving the editor. The stage under the grid is the
real debug build in a frame: what is on the grid is handed over through `localStorage`,
picked up by the `#level=edit` hook in `src/debug.js`, and appended to `LEVELS`, so an edited
course loads down exactly the path a shipped one takes — a preview that could disagree with
the real game would be worse than useless for judging a jump. Click the stage to give it the
keyboard, **Stop** to hand it back. There is an **Open in a new tab** button for playing at
full size, and `#play=1` starts a run on arrival, so `#level=4&play=1` is a deep link
straight into playing the fourth course.

It also draws the three distances a course is built out of — a jump, a pour, and a pour
ridden into a jump — from whichever tile the mouse is over, because laying out a level is
mostly checking a gap against those three numbers.

`make check` reads every level in the game through the editor's own loader, prints it back
out through the editor's own formatter, and fails unless the result is byte-for-byte what is
already in the file. Without that, the first course opened in the editor would come back
quietly reformatted.

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
3. **Roadroller** packs the result into a self-extracting payload, five times over, keeping
   the smallest. Its optimiser searches randomly, so identical source packs to results about
   30 bytes apart; taking the best of five is worth real bytes and, more usefully, makes a 20
   byte experiment anywhere else in the source measurable at all. It runs with `allowFreeVars`
   (Roadroller's `--dirty`), which lets the decoder keep its working variables on the global
   object instead of declaring them — worth 50 bytes of packed payload, and safe because the
   page holds one script and one element.
4. The packed script and the minified CSS are inlined into `src/index.html`.

The build also writes `build/packme.js`, the exact bytes handed to Roadroller, so the same
input can be dropped into [the Roadroller page](https://lifthrasiir.github.io/roadroller/) to
try settings by hand and compare them against what the build gets.

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
  entities/   unicorn, unicorn art, rainbow ribbon, terrain, lava, gloom, gate, signs
  screens/    opening, title, how to play, settings, gameplay, pause
  levels/     level format, level builder, level data
  audio/      context, sound effects, music
  debug.js    headless-testing hooks, dropped from the release build
tools/        build, zip, dev server, and the course editor
```

Two files are worth reading first: `src/entities/rainbow-ribbon.js` is the whole game in
one class, and `src/entities/unicorn-art.js` is the entire character performance — flat
vector only, with legs solved by two-bone IK from a hoof target so they stay planted, and
a mane and tail built from angular spring chains.

`src/levels/levels.js` is worth a look too: every level is drawn as a picture, one string
per row, with `!` marking where a signpost stands and the level's `signs` list supplying
what it reads.

## Q&A

**Do you use AI?**
Yes. I build this with [Claude Code](https://claude.com/claude-code). I make the design, art
direction and gameplay calls, and Claude Code writes and refactors the code against them.

**Is it really under 13kB?**
Yes — **13,293 of 13,312 bytes**, and that is the worst of several builds rather than the
luckiest. The whole game is one `index.html`, zipped, everything included, checked by
`make zip` on every build. No network requests, no external assets,
nothing streamed in at runtime.

**Why no game library?**
Because I measured one. A tree-shaken [Kontra](https://straker.github.io/kontra/) build of
just `init` + `GameLoop` + keyboard is **1,928 minified bytes**, against the **1,323** of
hand-written code in `core/loop.js`, `core/input.js` and `core/canvas.js` that it would
replace. Adding `Sprite` takes it to **7,516**, and the full `kontra.min.js` is 33,089 bytes —
12.1kB gzipped, 91% of the entire budget. Kontra is a good library, and at this size a
library you use a tenth of is a tax. The same is true of every other engine I checked.

**Why not ZzFX, or a tracker, or just a WAV?**
Measured those too. The [ZzFX](https://github.com/KilledByAPixel/ZzFX) micro engine is 1,024
minified bytes and the [ZzFXM](https://github.com/keithclark/ZzFXM) player 623 — *engines
only*, before a single sound array or song pattern. `audio/sfx.js` and `audio/music.js`
together are 3,106 bytes for the engine **and** all the content, because the music derives its
pad, bass and arpeggio from a chord table instead of storing patterns.

A WAV is out by two orders of magnitude. 8kHz 8-bit mono is 8,000 bytes *per second*, so the
entire 13,312-byte budget buys 1.6 seconds of the worst-sounding audio you can make — and PCM
is noise-like, so neither Roadroller nor deflate makes a dent in it. Runtime synthesis is not
a compromise here, it *is* the compressed form of the music. Same reason every pixel is drawn
from code rather than stored.

**Can I use the code?**
No — see the copyright below.

**Mobile? Gamepad?**
Desktop, keyboard only, on purpose. The whole game is aimed at precision on a keyboard.

**Why thirteen levels?**
Thirteen kilobytes.

## Credits

Everything — art, music, sound synthesis, engine, levels — is original to this entry. No
libraries ship in the build; the four dev dependencies are build tooling only.

Structure and build approach are indebted to [CLAWSTRIKE](https://github.com/remvst/clawstrike)
by Rémi Vansteelandt, the js13kGames 2025 winner, whose source is a great read.

## Copyright

Copyright (c) 2026

All rights reserved. It is not allowed to take the code or game and publish it anywhere. I
reserve all rights.
