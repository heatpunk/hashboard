import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.4.0:0',
  releaseNotes: {
    en_US:
      'Hashboard now talks to miners through the open asic-rs library from the 256 Foundation, replacing the previous BraiinsOS/CGMiner-specific bridge. This brings support for many more miner makes and firmwares — Antminer (stock), Whatsminer, Avalon, BraiinsOS, LuxOS, Vnish, ePIC, Marathon, Bitaxe and more — while pause/resume keeps working through each firmware’s native control. The web UI is unchanged.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
