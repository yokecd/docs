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
      customCss: ['./src/styles/custom.css'],
      logo: {
        dark: './src/assets/logo/SVG/Logo_Yoke_White__Logo_Yoke_.svg',
        light: './src/assets/logo/SVG/Logo_Yoke_.svg',
        replacesTitle: true,
      },
      social: [
        {
          href: 'https://github.com/yokecd/yoke',
          icon: 'seti:github',
          label: 'github',
        },
        {
          href: 'https://discord.com/invite/tHCRKg6s7Z',
          icon: 'discord',
          label: 'discord',
        },
      ],
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
            {
              slug: 'concepts/resource-limits',
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
          items: [
            { slug: 'airtrafficcontroller/atc' },
            { slug: 'airtrafficcontroller/modes' },
            { slug: 'airtrafficcontroller/orchestration' },
          ],
        },
        { slug: 'yokecd' },
        { slug: 'video' },
      ],
    }),
    react(),
  ],
})
