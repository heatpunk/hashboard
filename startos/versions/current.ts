import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.2.0:0',
  releaseNotes: {
    en_US: 'Fix power floor (Min): now read from the miner via gRPC so the slider shows the real allowed range. Clear stale demo data from previous versions on first launch.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
