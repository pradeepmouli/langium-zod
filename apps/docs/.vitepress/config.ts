import { defineConfig } from 'vitepress';
import typedocSidebar from '../api/typedoc-sidebar.json' with { type: 'json' };

export default defineConfig({
  title: 'langium-zod',
  description: 'Zod v4 schema generation from Langium grammars',
  base: '/langium-zod/',
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ['meta', { property: 'og:title', content: 'langium-zod' }],
    ['meta', { property: 'og:description', content: 'Zod v4 schema generation from Langium grammars' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:url', content: 'https://pradeepmouli.github.io/langium-zod/' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
    ['meta', { name: 'twitter:title', content: 'langium-zod' }],
    ['meta', { name: 'twitter:description', content: 'Zod v4 schema generation from Langium grammars' }],
  ],
  sitemap: {
    hostname: 'https://pradeepmouli.github.io/langium-zod'
  },
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/' },
      { text: 'GitHub', link: 'https://github.com/pradeepmouli/langium-zod' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/getting-started' },
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Usage', link: '/guide/usage' }
          ]
        }
      ],
      '/api/': [
        { text: 'API Reference', items: typedocSidebar }
      ]
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/pradeepmouli/langium-zod' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Pradeep Mouli'
    },
    search: { provider: 'local' }
  }
});
