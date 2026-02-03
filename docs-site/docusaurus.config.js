const lightCodeTheme = require("prism-react-renderer/themes/github");
const darkCodeTheme = require("prism-react-renderer/themes/dracula");

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "PSScript Documentation",
  tagline: "PowerShell script analysis platform with agentic AI capabilities",
  favicon: "img/logo.svg",
  url: "https://morlock52.github.io",
  baseUrl: "/psscript/",
  organizationName: "Morlock52",
  projectName: "psscript",
  trailingSlash: false,
  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",
  i18n: {
    defaultLocale: "en",
    locales: ["en"]
  },
  presets: [
    [
      "classic",
      {
        docs: {
          path: "docs",
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: "https://github.com/Morlock52/psscript/tree/main/docs-site/"
        },
        blog: false,
        theme: {
          customCss: require.resolve("./src/css/custom.css")
        }
      }
    ]
  ],
  themeConfig: {
    navbar: {
      title: "PSScript",
      logo: {
        alt: "PSScript logo",
        src: "img/logo.svg"
      },
      items: [
        {
          type: "doc",
          docId: "index",
          position: "left",
          label: "Docs"
        },
        {
          href: "https://github.com/Morlock52/psscript",
          label: "GitHub",
          position: "right"
        }
      ]
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            { label: "Tutorials", to: "/tutorials" },
            { label: "How-to Guides", to: "/how-to" },
            { label: "Reference", to: "/reference" },
            { label: "Explanation", to: "/explanation" }
          ]
        },
        {
          title: "More",
          items: [
            { label: "Reports", to: "/reports" },
            { label: "GitHub", href: "https://github.com/Morlock52/psscript" }
          ]
        }
      ],
      copyright:
        `Copyright © ${new Date().getFullYear()} PSScript`
    },
    prism: {
      theme: lightCodeTheme,
      darkTheme: darkCodeTheme
    }
  }
};

module.exports = config;
