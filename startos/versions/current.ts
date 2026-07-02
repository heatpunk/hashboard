import { IMPOSSIBLE, VersionInfo } from '@start9labs/start-sdk'

export const current = VersionInfo.of({
  version: '0.5.1:0',
  releaseNotes: {
    en_US:
      'The real Hashboard icon now shows everywhere (StartOS, Home Assistant, Umbrel) instead of the old placeholder. Clearer start-screen instruction. Board count no longer flickers during the cool-down after a power-target change.',
  },
  migrations: {
    up: async ({ effects }) => {},
    down: IMPOSSIBLE,
  },
})
