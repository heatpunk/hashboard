import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.1.4:0',
  releaseNotes: {
    en_US: 'Improve PowerLimit detection: check spaced field names (Braiins BOS) and PowerTarget; add /rawdata debug endpoint.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
