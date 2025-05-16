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
      title: 'yoke',
      logo: {
        dark: './src/assets/logo/SVG/Logo_Yoke_White__Logo_Yoke_.svg',
        light: './src/assets/logo/SVG/Logo_Yoke_.svg',
        replacesTitle: true,
      },
      social: {
        github: 'https://github.com/yokecd/yoke',
        discord: 'https://discord.com/invite/tHCRKg6s7Z',
      },
      sidebar: [
        {
          label: 'Concepts',
          items: [
            {
              slug: 'concepts/flights',
            },
            {
              slug: 'concepts/wasm',
            },
            {
              slug: 'concepts/publishing',
            },
            {
              slug: 'concepts/cluster-access',
            },
          ],
        },
        {
          label: 'Examples',
          items: [{ slug: 'examples/basics' }, { slug: 'examples/configuration' }],
        },
        {
          slug: 'helm-compatibility',
        },
        {
          label: 'Air Traffic Controller',
          items: [{ slug: 'airtrafficcontroller/atc' }, { slug: 'airtrafficcontroller/modes' }],
        },
        { slug: 'yokecd' },
        { slug: 'video' },
      ],
    }),
    react(),
  ],
})
