// @ts-check
// Note: type annotations allow type checking and IDEs autocompletion

const lightCodeTheme = require('prism-react-renderer').themes.github;
const darkCodeTheme = require('prism-react-renderer').themes.dracula;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Autoparts API Documentation',
  tagline: 'Documentation complète de l\'API E-commerce Pièces Auto',
  favicon: 'img/favicon.ico',

  // Set the production url of your site here
  url: 'https://docs.autoparts.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  baseUrl: '/',

  // GitHub pages deployment config
  organizationName: 'ak125', // GitHub org/user name
  projectName: 'nestjs-remix-monorepo', // Repo name
  deploymentBranch: 'gh-pages',
  trailingSlash: false,

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  // Internationalization
  i18n: {
    defaultLocale: 'fr',
    locales: ['fr', 'en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/', // Docs as home page
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/ak125/nestjs-remix-monorepo/tree/main/.spec/docs/',
          remarkPlugins: [],
          rehypePlugins: [],
        },
        blog: false, // Disable blog
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  // Plugin OpenAPI temporairement désactivé (problèmes de dépendances)
  // plugins: [
  //   [
  //     'docusaurus-plugin-openapi-docs',
  //     {
  //       id: 'openapi',
  //       docsPluginId: 'classic',
  //       config: {
  //         autoparts: {
  //           specPath: '../openapi.yaml',
  //           outputDir: 'docs/api',
  //           sidebarOptions: {
  //             groupPathsBy: 'tag',
  //             categoryLinkSource: 'tag',
  //           },
  //         },
  //       },
  //     },
  //   ],
  // ],

  // themes: ['docusaurus-theme-openapi-docs'],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: 'img/autoparts-social-card.jpg',
      
      navbar: {
        title: 'Autoparts Docs',
        logo: {
          alt: 'Autoparts Logo',
          src: 'img/logo.svg',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'tutorialSidebar',
            position: 'left',
            label: 'Documentation',
          },
          {
            to: '/api',
            label: 'API Reference',
            position: 'left',
          },
          {
            to: '/architecture',
            label: 'Architecture',
            position: 'left',
          },
          {
            to: '/webhooks',
            label: 'Webhooks',
            position: 'left',
          },
          {
            type: 'localeDropdown',
            position: 'right',
          },
          {
            href: 'https://github.com/ak125/nestjs-remix-monorepo',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      
      footer: {
        style: 'dark',
        links: [
          {
            title: 'Documentation',
            items: [
              {
                label: 'Getting Started',
                to: '/getting-started',
              },
              {
                label: 'API Reference',
                to: '/api',
              },
              {
                label: 'Architecture',
                to: '/architecture',
              },
            ],
          },
          {
            title: 'Ressources',
            items: [
              {
                label: 'Webhooks',
                to: '/webhooks',
              },
              {
                label: 'Examples',
                to: '/examples',
              },
              {
                label: 'Changelog',
                to: '/changelog',
              },
            ],
          },
          {
            title: 'Support',
            items: [
              {
                label: 'GitHub Issues',
                href: 'https://github.com/ak125/nestjs-remix-monorepo/issues',
              },
              {
                label: 'Contact Support',
                href: 'mailto:support@autoparts.com',
              },
            ],
          },
          {
            title: 'Legal',
            items: [
              {
                label: 'Terms of Service',
                to: '/terms',
              },
              {
                label: 'Privacy Policy',
                to: '/privacy',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Autoparts E-commerce Platform. Built with Docusaurus.`,
      },
      
      prism: {
        theme: lightCodeTheme,
        darkTheme: darkCodeTheme,
        additionalLanguages: ['bash', 'diff', 'json', 'yaml', 'typescript', 'javascript', 'tsx', 'jsx'],
      },
      
      algolia: {
        // Algolia configuration (optional, à configurer plus tard)
        appId: 'YOUR_APP_ID',
        apiKey: 'YOUR_API_KEY',
        indexName: 'autoparts-docs',
        contextualSearch: true,
      },
      
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      
      docs: {
        sidebar: {
          hideable: true,
          autoCollapseCategories: true,
        },
      },
      
      tableOfContents: {
        minHeadingLevel: 2,
        maxHeadingLevel: 5,
      },
    }),
};

module.exports = config;
