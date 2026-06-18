# StartOS packaging - requires start-cli (StartOS 0.4.0.x SDK)
PKG = hashboard.s9pk

.PHONY: pack inspect publish clean
pack:
	start-cli s9pk pack . -o $(PKG) --icon startos/icon.png
inspect:
	start-cli s9pk inspect manifest $(PKG)
publish:
	start-cli s9pk publish $(PKG)
clean:
	rm -f $(PKG)
