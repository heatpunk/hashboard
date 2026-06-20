import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.1.8:0',
  releaseNotes: {
    en_US: 'Remove guessed simulation values: new miners start at 0 W until real data arrives, and mining miners no longer show fake hashrate/temp when the proxy is unreachable.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
