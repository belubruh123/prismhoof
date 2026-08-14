# PRISMHOOF

**PRISMHOOF** is my entry for [js13kGames 2026](https://js13kgames.com/). The theme for the
competition was **Unicorns and Rainbows**.

It is a 2D precision momentum platformer. Desktop, keyboard only, everything drawn on a
single canvas with no image, audio or font assets.

> The Gloom has drained the color from the Skyward Meadows. You are the last unicorn, and
> your horn still holds the seven colors. Paint the sky, purify the Gloom, bring back the
> rainbow.

## The mechanic

**One verb, two uses.** Hold the paint key and your horn hoses out a rainbow. The bright
head of the stream flies forward, falls under its own gravity, and lays a **solid rainbow
bridge** behind it until it splashes against the scenery. Jump onto what you just made and
run across. That same flowing stream **purifies any Gloom it passes through**, so
traversal and combat are the same action.

Paint is a limited meter that refills when your hooves are on something solid, so every
level is a question of *where* to spend your arcs. Purify all the Gloom and the Rainbow
Gate opens. As the Gloom clears, the color bleeds back into the world.

> The stream fires *ahead* of the unicorn rather than trailing behind it, and that is a
> mechanical necessity rather than a flourish. A ribbon emitted at the horn sits
> permanently above the hooves, so a unicorn could never land on an arc it painted during
> the same jump and the core loop would never close. A head that outruns the unicorn and
> falls lays the ramp ahead and below, where it can actually be used.

## Controls

| Key | Action |
| --- | --- |
| `←` `→` / `A` `D` | Gallop |
| `Space` / `W` / `↑` | Jump (hold for height) |
| `↓` / `S` | Dive |
| `Shift` (hold) | Paint rainbow |
| `R` | Retry level |
| `P` / `Esc` | Pause |
| `M` | Toggle music |

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
   constant so every debug branch is eliminated rather than shipped.
2. **terser** compresses and mangles, including our own property names.
3. **Roadroller** packs the result into a self-extracting payload.
4. The packed script and the minified CSS are inlined into `src/index.html`.

It also prints a per-module byte table on every build, so the size budget stays visible
while the game is being written rather than becoming a crisis at the end.

Property mangling is worth about 8% of the final zip, and it only stays safe because the
source never reaches a property through a string built at runtime — the palette assigns
its colours by name and the level character table is a `Map`. `make verify` exists for
exactly this: it applies the full release squeeze with `DEBUG` still on, so a mangled
build can be driven by the debug hooks. A debug build cannot catch a mangling bug and a
release build cannot be driven, so neither one alone is enough.

## Layout

```
src/
  core/       canvas, loop, input, storage, maths      (no game knowledge)
  engine/     entity, world, camera, particles, tween  (no game knowledge)
  graphics/   palette, textures, sky, typography, ui
  entities/   unicorn, rainbow ribbon, terrain, gloom, gate, hud
  screens/    title, how to play, settings, gameplay, pause, results
  levels/     level format and level data
  audio/      zzfx, sound effects, synth, song
tools/        build, zip and dev server
```

## Credits

- Sound effects use [ZzFX](https://github.com/KilledByAPixel/ZzFX) by Frank Force (MIT).
- Everything else — art, music synthesis, engine, levels — is original to this entry.

Structure and build approach are indebted to [CLAWSTRIKE](https://github.com/remvst/clawstrike)
by Rémi Vansteelandt, the js13kGames 2025 winner, whose source is a great read.
