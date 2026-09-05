.PHONY: all install dev debug verify build check zip pages clean

all: build zip

install:
	npm install

# Watch + serve the unminified debug build on http://localhost:8013.
# The course editor is in it, at /debug.html#screen=editor
dev:
	npm run dev

# Prove the editor's level format still round-trips every level unchanged
check:
	npm run check

# One-off unminified build with DEBUG on -> build/debug.html
debug:
	npm run build:debug

# Fully minified and mangled, but with DEBUG on -> build/verify.html.
# The only build that can catch a property-mangling bug.
verify:
	npm run build:verify

# Minified, packed release build -> build/index.html. Takes a few minutes.
# Roadroller runs its thorough search (--opt=2) twice and keeps the smaller of
# the two. That is not a luxury: the margin is 25 bytes, and the quick search
# lands over the limit about as often as under it.
build:
	npm run build

# Zip the release build and check it against the 13312 byte limit
zip:
	npm run zip

# Director's cut -> docs/index.html, served by GitHub Pages. No size limit, and
# no Roadroller: packing buys bytes at the cost of a pause before the first
# frame, which is a bad trade when there is no limit to meet.
pages:
	npm run pages

clean:
	rm -rf build
