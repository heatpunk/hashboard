import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.1.8:0',
  releaseNotes: {
    en_US: 'Add gRPC diagnostics logging to proxy; remove guessed simulation values for new miners.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
