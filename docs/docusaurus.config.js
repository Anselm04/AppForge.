const { themes } = require('prism-react');

const config = {
  title: 'AppForge',
  tagline: 'Build Multi-Agent Apps Faster',
  favicon: 'img/favicon.ico',
  url: 'https://appforge.dev',
  baseUrl: '/',
  organizationName: 'Anselm04',
  projectName: 'AppForge',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    ['classic', {
      docs: {
        sidebarPath: require.resolve('./sidebars.js'),
        editUrl: 'https://github.com/Anselm04/AppForge/tree/main/docs',
        routeBasePath: '/',
      },
      blog: { showReadingTime: true },
      theme: { customCss: require.resolve('./src/css/custom.css') },
    }],
  ],
  themeConfig: {
    navbar: {
      title: 'AppForge',
      logo: { alt: 'AppForge Logo', src: 'img/logo.svg' },
      items: [
        { type: 'docSidebar', sidebarId: 'tutorialSidebar', position: 'left', label: 'Docs' },
        { to: '/blog', label: 'Blog', position: 'left' },
        { href: 'https://github.com/Anselm04/AppForge', label: 'GitHub', position: 'right' },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        { title: 'Docs', items: [{ label: 'Getting Started', to: '/docs/intro' }, { label: 'API Reference', to: '/docs/api/overview' }] },
        { title: 'Community', items: [{ label: 'GitHub', href: 'https://github.com/Anselm04/AppForge' }] },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AppForge. Built with Docusaurus.`,
    },
    prism: { theme: themes.github, darkTheme: themes.dracula, additionalLanguages: ['typescript', 'javascript', 'bash', 'json'] },
  },
};

module.exports = config;
