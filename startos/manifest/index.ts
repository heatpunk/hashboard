import { setupManifest } from '@start9labs/start-sdk'
import { long, short } from './i18n'

export const manifest = setupManifest({
  id: 'hashboard',
  title: 'Hashboard',
  license: 'MIT',
  packageRepo: 'https://github.com/heatpunk/hashboard',
  upstreamRepo: 'https://github.com/heatpunk/hashboard',
  marketingUrl: 'https://github.com/heatpunk/hashboard',
  donationUrl: null,
  description: { short, long },
  volumes: ['main'],
  images: {
    hashboard: {
      source: { dockerTag: 'ghcr.io/heatpunk/hashboard:0.1.7' },
      arch: ['x86_64'],
    },
  },
  alerts: {
    install: null,
    update: null,
    uninstall: null,
    restore: null,
    start: null,
    stop: null,
  },
  dependencies: {},
})
