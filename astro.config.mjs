// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

import react from '@astrojs/react'

// https://astro.build/config
export default defineConfig({
  site: 'https://yokecd.github.io',
  base: 'docs',
  integrations: [
    starlight({
      title: 'Yoke',
      social: {
        github: 'https://github.com/yokecd/yoke',
      },
    }),
    react(),
  ],
})
