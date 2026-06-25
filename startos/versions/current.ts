import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.4.1:0',
  releaseNotes: {
    en_US:
      'The power slider now actually sets the miner’s power target (written when you release the slider), via the open asic-rs library from the 256 Foundation. The machine’s power target at first connect is captured as a locked ceiling — you can’t raise above it; to change it, remove the miner, adjust it in the miner’s own UI, and add it back. The shown number is scaled to the active hashboards while the whole-machine value is sent to and read from the miner. Builds on 0.4.x asic-rs support (Antminer/stock, Whatsminer, Avalon, BraiinsOS, LuxOS, Vnish, ePIC, Marathon, Bitaxe and more).',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
