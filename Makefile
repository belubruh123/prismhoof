.PHONY: all install dev debug verify build zip clean

all: build zip

install:
	npm install

# Watch + serve the unminified debug build on http://localhost:8013
dev:
	npm run dev

# One-off unminified build with DEBUG on -> build/debug.html
debug:
	npm run build:debug

# Fully minified and mangled, but with DEBUG on -> build/verify.html.
# The only build that can catch a property-mangling bug.
verify:
	npm run build:verify

# Minified, packed release build -> build/index.html.
# Packs five times and keeps the smallest, because Roadroller's optimiser is
# randomised and a single unlucky pack is worth more than the margin.
build:
	npm run build

# Zip the release build and check it against the 13312 byte limit
zip:
	npm run zip

clean:
	rm -rf build
