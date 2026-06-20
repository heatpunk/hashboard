import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.1.5:0',
  releaseNotes: {
    en_US: 'Read the real power target from the Braiins OS gRPC API (GetTunerState) and the real board count from GetHashboards, instead of the open CGMiner API which does not expose the target. Requires the miner API password.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
