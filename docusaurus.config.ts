import type * as Preset from '@docusaurus/preset-classic';
import type { Config } from '@docusaurus/types';
import { themes as prismThemes } from 'prism-react-renderer';

const config: Config = {
  title: 'CarlJi',
  tagline: '知行合一 务实进取',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://carlji.netlify.app',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'CarlJi', // Usually your GitHub org/user name.
  projectName: 'website', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'zh-Hans',
    locales: ['zh-Hans'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/Carlji/website',
        },
        blog: {
          showReadingTime: true,
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl:
            'https://github.com/Carlji/website',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // Replace with your project's social card
    image: 'img/docusaurus-social-card.jpg',
    navbar: {
      title: 'CarlJi',
      logo: {
        alt: 'My Site Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          position: 'left',
          label: '云原生工程效率实践',
          sidebarId: 'cnee',
        },
        {
          type: 'docSidebar',
          sidebarId: 'gtc',
          position: 'left',
          label: 'Go测试覆盖率技术',
        },
        { to: '/blog', label: '博客', position: 'left' },
        {
          href: 'https://github.com/CarlJi',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: '关注公众号',
          items: [
            {
              html: `
              <a target="_blank" rel="noreferrer noopener" aria-label="wechat">
                <img src="/img/image.png" alt="Wechat" />
              </a>
            `,
            },
          ],
        },
        {},
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/CarlJi',
            },
            {
              label: 'InfoQ',
              href: 'https://www.infoq.cn/u/carlji/publish',
            },
            {
              label: '博客园',
              href: 'https://www.cnblogs.com/jinsdu',
            },
            {
              label: '知乎',
              href: 'https://www.zhihu.com/people/jinsdu/posts',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} CarlJi, Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
