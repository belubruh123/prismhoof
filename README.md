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
the sky inside the chamber.

## The camera

**Every level opens on the whole course.** The view holds the entire chamber in frame for a
beat, then moves in on the unicorn. That is not a flourish: the one verb is a commitment —
you spend paint deciding where to go and you cannot take it back — so a player who has seen
the shape of a chamber is making a decision, and a player discovering it a screen at a time
is guessing. **`C` toggles between the two framings** at any point, and the choice is
remembered, so anyone who wants the whole course all the time can have it.

The establishing shot plays when a course is *reached*, never on a retry. In a game built
around dying, replaying a wide hold on every death would be the single most irritating thing
in it.

Once it has moved in, the view chases the unicorn. Two things stop that feeling like a
bracket bolted to the character's back.

**It only pulls once you leave a window in the middle of the frame.** Inside that window
the pull is exactly zero, so hops, turns and landings move the unicorn *across the picture*
and leave the world still; only real travel drags the view along behind you.

**And what is drawn is not the camera's position.** It is a second, softer spring hung off
it, deliberately left under-damped — about two thirds of the damping it would take to stop
it overshooting. The frame leans into every start and stop by around forty pixels and rocks
back over half a second. That is the wobble a camera held in a hand has.

That second stage has to be a separate spring, and finding out why was the whole problem.
A spring that is only ever pulled from *outside* a window switches off the instant it
arrives, so it can never swing past its own mark — at any damping value whatsoever. A dead
zone and an overshoot cannot live on the same spring. The first version had no wobble at
all and no amount of tuning was ever going to produce one.

**Sight range sets the zoom, not the character.** The focused view is half again the
whole-course framing rather than double it: enough for the gait, the blink and the mane to
read, while still showing nearly seventeen tiles ahead against a rainbow that reaches twelve.
A closer view made the unicorn look better and the game play worse, which is the wrong trade
in a game where pouring a bridge into ground you cannot see is the mistake that kills you.

The story is told in a short opening rather than buried in a menu, and the colour floods
back into the sky as the last line lands — the screen states the premise and demonstrates
the win condition in the same gesture. It is skippable, and only shown to a save file that
has never finished a level.

> The stream fires *ahead* of the unicorn rather than trailing behind it, and that is a
> mechanical necessity rather than a flourish. A ribbon emitted at the horn sits
> permanently above the hooves, so a unicorn could never land on an arc it painted during
> the same jump and the core loop would never close. Testing the first version is what
> surfaced this.

## Making a hit land

Purifying a Gloom is the thing the whole game is built around, so four things happen on the
same frame:

- the world **stops dead** for four frames, while the camera keeps shaking over the frozen
  picture
- a hard white **shockwave** snaps outwards, thinning as it grows
- the colour the Gloom was hoarding **sprays out of it** in every direction
- the view **kicks**

The freeze is what makes the other three read as an impact. Without it the burst is only
confetti arriving in a world that never noticed, which is the difference between a kill
that lands and a kill that merely happens. It is assigned rather than added, so clearing
three in one stroke freezes once instead of stuttering.

## The gate

The level exit is the one thing in a chamber you are trying to reach, so it is built to be
read from across the level and out of the corner of an eye: two posts on the floor carrying
an arch, a hole punched through the world between them, and a keystone over the top.

Shut, the whole thing is dead violet stone and the doorway is black — it reads as masonry,
not as a target. When the last Gloom goes, the hole fills **from the floor upwards** with
rainbow, on a rippling edge, and the keystone lights at the same moment. A rising line says
*go* at any size, which a door swinging open does not.

The masonry is the colour of the unicorn's own horn, which ties the gate to the thing that
opens it. Neither of its two colours comes from the palette: like the lava, the gate has to
read identically in a fully drained chamber and a fully restored one.

## Everything the game says

There is not one HTML element anywhere in PRISMHOOF. The page is a `<canvas>` tag and
nothing else, so the whole interface letterboxes, scales and screenshots with the game and
looks identical in every browser.

The rule the HUD follows is that **a number is a fact, and a fact is not the same as
knowing what to do**. So the Gloom count reads `8 GLOOM LEFT` rather than `GLOOM 8` and
carries its instruction underneath it, the clock
carries the price of dying beside it, and the air dash — the one piece of the unicorn's
state that is invisible on the character itself — gets a word rather than an icon nobody
can decode. Clearing a level reports what that level cost, because a single running clock
is unreadable without splits: it is the only way to know which chamber is worth practising.

## Controls

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
make install     # npm install (6 dev dependencies)
make dev         # watch + serve the debug build and the editor on port 8013
make verify      # fully squeezed but with DEBUG on -> build/verify.html
make build       # minified, Roadroller-packed build/index.html
make check       # prove the course editor round-trips every level unchanged
make zip         # build/game.zip, checked against the 13312 byte limit
make pages       # director's cut -> docs/index.html, no size limit
make all         # build + zip
```

## The cover

`tools/cover.html` draws it. Serve the project root and open `/tools/cover.html` — the page
imports from `../src/`, which a `file://` page may not do.

It is a poster, and almost none of it is in the game. Cover art is allowed that: box art puts
a castle on the front without promising you can walk into it. What it owes the player is the
feeling and the character, so the unicorn is the real one — the game's vector art, posed
mid-leap by the game's own physics — and the world around it is built to sell the one idea
the game is about: a rainbow you can stand on.

Everything else is illustration written for this page. Flat sky bands, a sun disc with rays,
comic halftone, a fat rainbow arc, cloud discs, sparkles, and a burst where the horn fires.

Three rules it is built to:

- **Hard edges, no gradients.** Flat bands, discs and dots hold their shape when the listing
  shrinks the image to a 160x160 thumbnail. Soft light at that size is just haze — the game's
  own soft horn glow had to be switched off and replaced with a hard burst for exactly that
  reason.
- **A sticker outline.** The unicorn is drawn black in a ring around itself before it is drawn
  properly, which is what lifts a white character off a bright sky. The outline comes from the
  same art through a `brightness(0)` filter, so it can never drift from the thing it outlines.
- **No text.** The listing prints the name beside the thumbnail already, and a title inside the
  image is 160 pixels of space that could have been picture.

`#steps=22&zoom=6.1` in the URL picks the frame and the framing. Output: `docs/cover.png`
(1024 square, the one to upload), `cover-wide.png` (1920x1080) and `cover-thumb160.png`,
which is what the listing will actually show.

## The director's cut

js13kGames takes an optional URL for a post-compo version, shown to nobody until voting
closes. `make pages` builds one into `docs/`, which GitHub Pages serves from the repository —
no hosting to set up, nothing to keep running.

It is the same game with the ceiling lifted, and it skips Roadroller: packing exists to buy
bytes and charges a moment of decoding before the first frame, which is a bad trade once
there is no limit to meet. It builds in four seconds rather than two minutes, so it is also
the sane place to put anything that would not fit in 13kB.

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

`make zip` needs nothing installed beyond `npm install`. It compresses with **Zopfli**, which
ships as a dev dependency, because the entry only fits at Zopfli's ratio: zlib level 9 gives
13,290 bytes of deflate stream against Zopfli's 13,152, and the whole remaining margin is 42.
This used to be an optional pass with [advzip](https://github.com/amadvance/advancecomp) if
you happened to have it, which meant the game fit on one machine and blew the limit by 247
bytes on another. If `advzip` or [ECT](https://github.com/fhanau/Efficient-Compression-Tool)
are installed they still get a turn afterwards, but they find nothing Zopfli missed.

## Squeezing it into 13kB

The game is 13,260 of 13,312 bytes, so nearly every technique below was worth the trouble.
The numbers are all measured on the real zip, one change at a time — none are estimates, and
several ideas that sounded certain turned out to be worth nothing at all.

`tools/build.mjs` runs the whole squeeze:

1. **esbuild** bundles the ES modules into one IIFE, with `DEBUG` as a compile-time constant
   so every debug branch — and the entire `src/debug.js` module — is eliminated rather than
   shipped. A plugin (`tools/levels-plugin.mjs`) swaps the level pictures for a run-length
   encoding on the way past.
2. **Google Closure Compiler**, ADVANCED. Whole-program optimisation: inlining across module
   boundaries, collapsing namespaces, dropping code no path reaches, renaming properties
   globally.
3. **terser**, compressing and mangling what Closure leaves, including our own property
   names.
4. **Roadroller**, packing the result into a self-extracting payload.
5. The packed script and the minified CSS are inlined into `src/index.html`, which is zipped
   by hand — the deflate stream compressed with **Zopfli**, worth 138 bytes over zlib level 9
   and therefore the difference between fitting and not.

### What each step is worth

| Technique | Bytes |
| --- | --- |
| Property mangling (terser, `builtins: false`) | ~1,830 packed, about 8% of the zip |
| **Closure ADVANCED, run before terser** | **243** |
| **Run-length encoding the level pictures** | **78** |
| **Property names chosen to dodge the mangler's shield list** | **74 + 60** |
| **Golfing the stylesheet, which Roadroller never sees** | **64** |
| Dropping the wrapper element, unquoted HTML attributes | 40 |
| Dropping the text drop-shadow, and one darkest ink instead of three | ~55 |
| **Deleting `drawRadialGlow` — a whole gradient built per frame for one caller** | **~95** |
| Roadroller `allowFreeVars` (its `--dirty` mode) | ~35 |
| Best-of-N packing | ~16 |
| Roadroller `--opt=2` | 10 |
| `maxMemoryMB` 150 → 320 | ~9 |

Two of those need explaining, because both are counter-intuitive.

**Closure only pays as a pair with terser.** On its own it packs *worse* than terser alone —
17,833 against 17,792 — because its output is regular in ways Roadroller does not reward.
Run first, it restructures the program in ways terser structurally cannot; terser then
re-minifies the result. Tested the obvious way, this technique looks useless.

**Property names in `src/` avoid anything a browser API also calls itself** — `inkColor`
rather than `color`, `typeSize` rather than `size`, `velocityAcross` rather than `velocityX`,
`levelTitle` rather than `name`. Terser's `builtins: false` refuses to touch any name it
recognises from a JS or DOM API, which is what makes property mangling safe — but that list
is long enough to catch a dozen of ours by accident. `size`, `color`, `weight`, `label`,
`items`, `name`, `rows`, `target` and `update` are all real DOM properties somewhere, and
`velocityX` is shielded because IE's `MSGestureEvent` had one. They were shipping in full,
hundreds of times over.

This is worth auditing rather than guessing at, and the audit is mechanical: pull every
property name `src/` defines, pull every name that survived into `build/packme.js`, and
intersect. A second pass found nine more — `zoom` and `columnCount` and `direction` are CSS
properties, `commit` is on `IDBTransaction`, `remove` and `reset` and `text` and `type` and
`scale` all belong to something — and renaming them was worth another 60 bytes.

**The stylesheet is the one part of the entry Roadroller never sees.** It is inlined raw and
only deflated, so a character there costs several times what a character of JavaScript does.
Rewriting `top/left/transform` centring as `inset: 0; margin: auto` and dropping the
redundant declarations took it from 193 characters to 91, and bought 64 bytes — four times
what the same effort is worth anywhere else in the source.

### What was measured and thrown away

Worth as much as the list above, because each of these looks like it should work:

| Idea | Result |
| --- | --- |
| Deduplicating similar code into shared helpers | **6 bytes** for 112 minified bytes removed |
| A shared dictionary of repeated level rows | 7 bytes — less than its own decoder costs |
| Splitting entities out of the terrain grid | **168 bytes worse** |
| ECT or advzip *after* Zopfli | 0–2 bytes — Zopfli already found it |
| Zopfli beyond 256 iterations | nothing, tested to 1000 |
| Roadroller `precision` and `recipLearningRate` sweeps | nothing — its optimiser already tunes both |
| `maxMemoryMB` above 320 | nothing, and the player's browser has to allocate it |
| Closure's `assume_function_wrapper`, `use_types_for_optimization` | nothing |
| Packing the CSS as a second Roadroller input | impossible — this version takes exactly one |
| Disabling terser's toplevel mangling | inside the noise |
| Roadroller `numAbbreviations` sweep, 0 to 128 | nothing — the default 64 is already the floor |
| Sharing one path or one code branch between two draw calls | **0 bytes** for 201 minified bytes removed |

The first line is the important one, and this round produced the cleanest demonstration of
it yet. **Roadroller's context mixing already compresses repeated call patterns almost
perfectly**, so collapsing duplicate code buys nothing; only *distinct* content moves the
number. Three consecutive measurements, all on the same payload:

| Removed | Minified | Zip |
| --- | --- | --- |
| Structural dedup — one shared path, one merged branch, dead exports | −181 | **−28** |
| More of the same — dead parameters, a spare curve, a spare fill | −201 | **0** |
| One duplicated hex string, and one ten-line branch that drew a shut eye | −113 | **−39** |

The third change removed the *least* code and saved the most, because a hex string that
appears nowhere else in the payload is information the compressor has never seen. The same
rule caught the biggest single cut of the lot from the other direction: deleting
`drawRadialGlow`, one soft halo behind the horn, was worth around 95 bytes — a radial
gradient built from scratch every frame is nothing like anything else in the payload, so
every byte of it was being paid for in full. The
practical rule that falls out: before cutting anything for size, ask whether the payload
already contains something very like it. If it does, cutting it is free of charge to the
compressor and free of benefit to you. The same logic explains the level data: run-length
encoding removed 4,302 characters, 61% of it, and bought 78 bytes, because the compressor was
already predicting those runs. Once a payload is at its entropy floor, re-encoding it — as
rectangles, dictionaries, bit-packing — cannot help. The information has to actually go away.

### Making the measurements trustworthy

Roadroller's optimiser searches randomly, so identical source packs to results about 30 bytes
apart. A 20-byte experiment is invisible against that. `--repeat=N` packs N times and keeps
the smallest, which is both a real saving and the instrument that makes everything else
measurable. Release builds run the thorough search (`--opt=2`) twice and take a few minutes:
the margin is 52 bytes, and a single quick search swings by more than that on its own. The
last round is a fair warning about trusting one pack: the same source measured 13,321 bytes
at `--opt=1 --repeat=1` and 13,311 at `--opt=2 --repeat=4`, and a change that genuinely
removed distinct content measured four bytes *worse* on a single quick pack.

The build writes `build/packme.js`, the exact bytes handed to Roadroller, so the same input
can be dropped into [the Roadroller page](https://lifthrasiir.github.io/roadroller/) and
tried by hand against what the build gets. It also prints a per-module byte table on every
build, so the budget stays visible while the game is being written rather than becoming a
crisis at the end.

## How the source stays readable

The competition asks for readable source, and 13kB asks for the opposite. Almost every
byte-saving step therefore lives in `tools/`: the pictures in `src/levels/levels.js` are
pictures, the identifiers are full words, and there is no golfed code anywhere under `src/`.

**Comments are free** — esbuild and terser strip every one of them before the payload is
built — so the two places where the source does bend towards the compiler are commented
rather than left to be puzzled over. Those are the property names above, and the level
encoding, which is why `make check` exists.

Both bends are also checked rather than trusted:

- `make check` reads every level through the course editor's loader and prints it back
  through its formatter, failing unless the result is byte-for-byte the file it came from,
  then encodes and expands every row and fails unless each one survives exactly.
- `make verify` applies the full release squeeze with `DEBUG` still on, so a fully mangled,
  Closure-compiled, Roadroller-packed build can be driven by the debug hooks. A debug build
  cannot catch a mangling bug and a release build cannot be driven, so neither alone is
  enough. It has caught four real ones.

Property mangling only stays safe because the source never reaches a property through a
string built at runtime — the palette assigns its colours by name, the level character table
is a `Map`, and the settings screen names every field it writes.

## Layout

```
src/
  core/       canvas, loop, input, storage, maths, geometry   (no game knowledge)
  engine/     entity, world, camera, particles                (no game knowledge)
  graphics/   palette, sky, hair, typography, ui
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
Yes — **13,260 of 13,312 bytes**. The whole game is one `index.html`, zipped, everything included, checked by
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
Yes, all of it, for anything. It is CC0 — public domain, no attribution required. If any of
it is useful to you, that is the best outcome I could ask for.

**Mobile? Gamepad?**
Desktop, keyboard only, on purpose. The whole game is aimed at precision on a keyboard.

**Why thirteen levels?**
Thirteen kilobytes.

## Credits

Everything — art, music, sound synthesis, engine, levels — is original to this entry. No
libraries ship in the build; the six dev dependencies are build tooling only.

Structure and build approach are indebted to [CLAWSTRIKE](https://github.com/remvst/clawstrike)
by Rémi Vansteelandt, the js13kGames 2025 winner, whose source is a great read.

## License

**[CC0 1.0 Universal](LICENSE) — public domain. No copyright, free to use.**

Take it. Read it, copy it, learn from it, ship a game built on it, sell that game — no
permission needed, no attribution required, no strings. Everything here is original to this
entry, so there is nothing in it I am not free to give away.

That is on purpose. Working this out in the open is the point: the byte-by-byte notes in
[Squeezing it into 13kB](#squeezing-it-into-13kb) are worth more to somebody else if the
code they describe can actually be used, and js13kGames mirrors every entry's repository as
a learning resource anyway.
