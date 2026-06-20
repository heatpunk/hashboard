import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.1.9:0',
  releaseNotes: {
    en_US: 'Fix power-scale labels: the axis ticks now bracket the real range, so the Target reading no longer sits above the top tick and the floor no longer sits below the bottom tick.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
