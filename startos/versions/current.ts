import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.3.0:0',
  releaseNotes: {
    en_US:
      'Target and the left-hand scale now both show the active boards’ share of the machine power limit, rounded to 50 W (machine target ÷ 3 × active boards; e.g. 2 of 3 boards at 1718 W → 1150 W). The scale tops out exactly there — never a watt above the active-board limit. Power target and board count are read over the open CGMiner API — no password — in a single connection, so a slower miner no longer shows a blank or wrong target. Each miner’s status dot and ON/PAUSED/OFFLINE label reflect its own live state, not which one is selected.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
