# Hashboard

A dead-simple UI for running a Bitcoin ASIC miner as a space heater.

## Installation

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
