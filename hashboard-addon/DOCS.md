# Hashboard

A dead-simple UI for running a Bitcoin ASIC miner as a space heater.

## Which Home Assistant installs does this work on?

Add-ons are a feature of **Home Assistant OS** and **Home Assistant
Supervised** only. If your Home Assistant runs as a container — for example
**on StartOS**, on Umbrel, or in plain Docker — there is no add-on store and
this add-on cannot be installed.

**Running Home Assistant on StartOS?** You don't need this add-on: install
the native **Hashboard app on the same StartOS server** instead, and
(optionally) show it inside a Home Assistant dashboard with a **Webpage
card** pointing at Hashboard's LAN address. Same app, nothing duplicated.

## Installation (Home Assistant OS / Supervised)

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store**.
2. Open the **⋮ menu → Repositories** and add:
   `https://github.com/heatpunk/hashboard`
3. Install **Hashboard** from the list and start it.
4. Open the Web UI (port `8099` by default), then tap **Scan LAN** in the
   menu — or add your miner's IP manually in Settings.

## How it works

One slider sets the miner's power (and heat). The maximum is captured from
the miner's own power target on first connect and locked — nobody can push
the machine harder than it was set up for. Pause/resume with one tap and
watch live hashrate, wattage, chip temperature and fan speed.

Miner communication is handled by the 256 Foundation's open
[asic-rs](https://github.com/256foundation/asic-rs) library: monitoring works
across Antminer (stock), Whatsminer, Avalon, BraiinsOS+, LuxOS, Vnish, ePIC,
Marathon, Bitaxe and more, with power control wherever the firmware exposes it.

## Requirements

- The add-on must be able to reach your miner on the local network.
- x86-64 (amd64) Home Assistant installations only, for now.

## Support

Issues and questions: https://github.com/heatpunk/hashboard/issues
