PKG = hashboard.s9pk
IMAGE = ghcr.io/heatpunk/hashboard:0.1.1

.PHONY: all pack inspect clean sdk-deps

all: pack

# Build SDK JavaScript from TypeScript
sdk-build/javascript/index.js: $(shell find startos -name '*.ts' 2>/dev/null) sdk-build/package.json sdk-build/tsconfig.json sdk-build/node_modules
	cd sdk-build && npm run build

sdk-build/node_modules: sdk-build/package.json
	npm --prefix sdk-build ci

# Pack the s9pk (requires SDK javascript built and GHCR image available)
pack: sdk-build/javascript/index.js
	start-cli s9pk pack \
		--javascript $(CURDIR)/sdk-build/javascript \
		--icon startos/icon.png \
		--instructions startos/instructions.md \
		--license LICENSE \
		--no-assets \
		-o $(PKG)

inspect:
	start-cli s9pk inspect manifest $(PKG)

clean:
	rm -f $(PKG)
	rm -rf sdk-build/javascript sdk-build/node_modules
