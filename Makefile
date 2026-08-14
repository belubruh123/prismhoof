.PHONY: all install dev debug build zip clean

all: build zip

install:
	npm install

# Watch + serve the unminified debug build on http://localhost:8013
dev:
	npm run dev

# One-off unminified build with DEBUG on -> build/debug.html
debug:
	npm run build:debug

# Minified, packed release build -> build/index.html
build:
	npm run build

# Zip the release build and check it against the 13312 byte limit
zip:
	npm run zip

clean:
	rm -rf build
