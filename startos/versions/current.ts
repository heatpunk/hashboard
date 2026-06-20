import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.1.7:0',
  releaseNotes: {
    en_US: 'Fix board ratio scaling: use CGMiner physical board count as total and gRPC enabled count as active, so target and range scale correctly for miners with inactive hashboards.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
