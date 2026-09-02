# PRISMHOOF

**PRISMHOOF** is my entry for [js13kGames 2026](https://js13kgames.com/), whose theme was
**Unicorns and Rainbows**. It is a 2D precision platformer: desktop, keyboard only, one
canvas, **13,270 of the 13,312 bytes allowed** — everything zipped, nothing streamed in.
There is no DOM UI anywhere in it and no image, audio or font assets. Every pixel and every
sound is generated at runtime.

> The Gloom has drained the colour from the Skyward Meadows. You are the last unicorn, and
> your horn still holds the seven colours.

## Play

Hold the paint key and your horn hoses out a rainbow. The head of the stream flies forward,
falls under its own gravity, and leaves a **solid rainbow** behind it until it hits
something. Where you fire from is what decides what you get:

| Fired from | What you get |
| --- | --- |
| Flat ground | A sweep that purifies the Gloom in front of you |
| The edge of a drop | An arc across the gap — a bridge |
| A rising jump | A climbing ramp |
| Mid-air | Lift, because the stream pushes back |

Purify every Gloom to open the Rainbow Gate, then run through it. Thirteen courses, one
clock that never stops, and a fall into the lava costs you time rather than lives. Finish all
thirteen and the meadow you were shown at the start comes back, in colour, with your time
under it.

### Controls

| Key | Action |
| --- | --- |
| `←` `→` / `A` `D` | Gallop |
| `Space` / `W` / `↑` | Jump (hold for height) |
| `↓` / `S` | Dive |
| `K` / `X` | Air dash (once per jump) |
| `Shift` (hold) | Pour rainbow |
| `C` | Whole-course view (toggle) |
| `R` | Retry level |
| `P` / `Esc` | Pause |

Music and sound have separate switches and volume sliders under **Settings**.

## Build

Requires Node 20+.

```sh
make install     # npm install (6 dev dependencies, all build tooling)
make dev         # watch + serve the debug build and the course editor on :8013
make build       # minified, Roadroller-packed -> build/index.html
make zip         # build/game.zip, checked against the 13312 byte limit
make all         # build + zip
make verify      # fully squeezed but with DEBUG on -> build/verify.html
make check       # prove the course editor round-trips every level unchanged
make pages       # the same game with the limit lifted -> docs/index.html
```

`make dev` also serves `tools/editor.html`, a grid editor that speaks the level format and
can launch the game straight onto a course you just drew. It is outside the zip, so it costs
the entry nothing.

`make verify` is the one that matters before shipping: it applies the full release squeeze
but leaves the debug hooks in, so a mangled build can actually be driven. A plain debug build
cannot catch a property-mangling bug and a plain release build cannot be tested.

## Under 13kB

Every number below is measured on the real zip, one change at a time. Several ideas that
sounded certain turned out to be worth nothing.

`tools/build.mjs` runs the whole squeeze: **esbuild** bundles the modules into one IIFE with
`DEBUG` as a compile-time constant (so `src/debug.js` is eliminated, not shipped, and a build
plugin run-length encodes the level pictures on the way past) → **Google Closure Compiler**
in ADVANCED mode → **terser** to compress and mangle what Closure leaves → **Roadroller** to
pack it into a self-extracting payload → inlined into `index.html` with the minified CSS and
zipped by hand, the deflate stream compressed with **Zopfli**.

| Technique | Bytes |
| --- | --- |
| Property mangling (terser, `builtins: false`) | ~1,830 packed, about 8% of the zip |
| Closure ADVANCED, run *before* terser | 243 |
| Zopfli instead of zlib level 9 | 138 |
| Deleting `drawRadialGlow` — a per-frame gradient for one caller | ~95 |
| Run-length encoding the level pictures | 78 |
| Property names chosen to dodge the mangler's shield list | 74 + 60 |
| Golfing the stylesheet, which Roadroller never sees | 64 |
| Dropping the wrapper element, unquoted HTML attributes | 40 |
| Roadroller `allowFreeVars` (its `--dirty` mode) | ~35 |
| Writing the title/ending meadow in the level format's run-length form | 18 |
| Best-of-N packing | ~16 |
| Eight-digit hex instead of `rgba()`, for two colours Closure inlines 24× each | 19 |
| Roadroller `--opt=2` | 10 |

And what was measured and thrown away, which is worth as much:

| Idea | Result |
| --- | --- |
| Deduplicating similar code into shared helpers | **6 bytes** for 112 minified bytes removed |
| Building that same meadow with `'#'.repeat(44)` instead | **5 bytes worse** — the loop compresses the repetition better than the code costs |
| Shortening a colour literal that appears 21 times | ~4 bytes — repeated strings are already nearly free |
| Sharing one path or one branch between two draw calls | **0 bytes** for 201 minified bytes removed |
| Splitting entities out of the terrain grid | **168 bytes worse** |
| A shared dictionary of repeated level rows | 7 bytes — less than its own decoder |
| ECT or advzip *after* Zopfli | 0–2 bytes; Zopfli already found it |
| Zopfli beyond 256 iterations | nothing, tested to 1000 |
| Roadroller `precision`, `recipLearningRate`, `numAbbreviations` sweeps | nothing — its own optimiser already tunes them |
| `maxMemoryMB` above 320 | nothing, and the player's browser has to allocate it |
| Nine terser configurations, and Closure's `assume_function_wrapper` | all inside the noise |
| Packing the CSS, or the levels, as a second Roadroller input | impossible — this version takes exactly one |

Four things worth knowing, because none of them is obvious:

**Closure only pays as a pair with terser.** Alone it packs *worse* than terser alone —
17,833 against 17,792 — because its output is regular in ways Roadroller does not reward.
Run first, it restructures the program in ways terser cannot; terser then re-minifies the
result. Tested the obvious way, this technique looks useless.

**Roadroller's context mixing already compresses repeated call patterns almost perfectly**,
so removing duplicate code buys nothing — only *distinct* content moves the number. The
corollary is that everything in the payload costs about **0.28 zip bytes per minified byte**,
whether it is a screen, a physics system or a paragraph of English. There is no fat to find;
a finished feature can be kept or dropped, not trimmed.

**Property names in `src/` avoid anything a browser API also calls itself** — `inkColor`
rather than `color`, `typeSize` rather than `size`, `levelTitle` rather than `name`. Terser's
`builtins: false` refuses to touch any name it recognises from a JS or DOM API, which is what
makes property mangling safe, but that list is long enough to shield a dozen of ours by
accident (`velocityX` survives because IE's `MSGestureEvent` had one). Audit it rather than
guess: pull every property name `src/` defines, pull every name that survived into
`build/packme.js`, and intersect.

**The stylesheet is the one part of the entry Roadroller never sees.** It is inlined raw and
only deflated, so a character there costs several times what a character of JavaScript does.
Golfing it from 193 characters to 91 bought 64 bytes.

Roadroller's optimiser is randomised, so identical source packs about 30 bytes apart.
Release builds run the thorough search five times and keep the smallest, which takes eight
minutes — with a margin this thin, a single quick search lands over the limit about as often
as under it.

## Layout

```
src/
  core/       canvas, loop, input, storage, maths, geometry   (no game knowledge)
  engine/     entity, world, camera, particles                (no game knowledge)
  graphics/   palette, sky, hair, typography, wordmark, ui
  entities/   unicorn, unicorn art, rainbow ribbon, terrain, lava, gloom, gate, signs
  screens/    title, premise, how to play, settings, gameplay, pause
  levels/     level format, level builder, level data
  audio/      context, sound effects, music
  debug.js    headless-testing hooks, dropped from the release build
tools/        build, zip, dev server, and the course editor
```

Three files are worth reading first. `src/entities/rainbow-ribbon.js` is the whole game in
one class. `src/entities/unicorn-art.js` is the entire character performance — flat vector
only, legs solved by two-bone IK from a hoof target so they stay planted, mane and tail built
from angular spring chains. And `src/levels/levels.js` draws every level as a picture, one
string per row, with `!` marking where a signpost stands.

## Q&A

**Do you use AI?**
Yes. I build this with [Claude Code](https://claude.com/claude-code). I make the design, art
direction and gameplay calls; Claude Code writes and refactors the code against them.

**Is it really under 13kB?**
Yes — 13,270 of 13,312 bytes, checked by `make zip` on every build. No network requests, no
external assets, nothing streamed in at runtime.

**Why no game library?**
Because I measured one. A tree-shaken [Kontra](https://straker.github.io/kontra/) build of
just `init` + `GameLoop` + keyboard is 1,928 minified bytes against the 1,323 of hand-written
code it would replace; adding `Sprite` takes it to 7,516, and the full `kontra.min.js` is
33,089. At this size, a library you use a tenth of is a tax.

**Why not ZzFX, or a tracker, or a WAV?**
Measured those too. The [ZzFX](https://github.com/KilledByAPixel/ZzFX) engine is 1,024
minified bytes and the [ZzFXM](https://github.com/keithclark/ZzFXM) player 623 — *engines
only*, before one sound or one pattern. `audio/sfx.js` and `audio/music.js` together are
3,485 for the engine and all the content, because the music derives its pad, bass, arpeggio
and drums from a chord table rather than storing patterns. A WAV is out by two orders of
magnitude: 8kHz 8-bit mono is 8,000 bytes *per second*, and PCM is noise-like, so neither
Roadroller nor deflate dents it. Runtime synthesis is not a compromise here — it *is* the
compressed form of the music.

**Mobile? Gamepad?**
Desktop, keyboard only, on purpose.

**Why thirteen levels?**
Thirteen kilobytes.

**Can I use the code?**
Yes, all of it, for anything.

## Credits

Everything — art, music, sound synthesis, engine, levels — is original to this entry. No
libraries ship in the build; the six dev dependencies are build tooling only.

Structure and build approach are indebted to [CLAWSTRIKE](https://github.com/remvst/clawstrike)
by Rémi Vansteelandt, the js13kGames 2025 winner, whose source is a great read.

## License

**[CC0 1.0 Universal](LICENSE) — public domain.** No attribution required. Read it, copy it,
ship a game built on it. Everything here is original to this entry, so there is nothing in it
I am not free to give away.
