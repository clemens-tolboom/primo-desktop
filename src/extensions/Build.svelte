<script>
  import axios from 'axios'
  import { flattenDeep, uniqBy } from 'lodash-es'
  import JSZip from 'jszip'
  import { saveAs } from 'file-saver'
  import { html as beautifyHTML } from 'js-beautify'
  import Hosting from '$lib/components/Hosting.svelte'
  import PrimaryButton from '$lib/ui/PrimaryButton.svelte'
  import { site, modal } from '@primo-app/primo'
  import { buildStaticPage } from '@primo-app/primo/src/stores/helpers'
  import hosts from '../stores/hosts'
  import ModalHeader from '@primo-app/primo/src/views/modal/ModalHeader.svelte'
  import { page } from '$app/stores'

  // TimeAgo.addDefaultLocale(en)
  // const timeAgo = new TimeAgo('en-US')

  const siteID = $page.params.site

  let loading = false

  async function downloadSite() {
    loading = true
    const zip = new JSZip()
    const files = await buildSiteBundle($site, siteID)
    files.forEach((file) => {
      zip.file(file.path, file.content)
    })
    const toDownload = await zip.generateAsync({ type: 'blob' })
    saveAs(toDownload, `${siteID}.zip`)
    modal.hide()
  }

  let deployment
  async function publishToHosts() {
    loading = true

    // const name = window.location.pathname.split('/')[2]
    const files = (await buildSiteBundle($site, siteID)).map((file) => {
      return {
        file: file.path,
        data: file.content,
      }
    })
    const uniqueFiles = uniqBy(files, 'file') // modules are duplicated

    await Promise.allSettled(
      $hosts.map(async ({ token, type }) => {
        if (type === 'vercel') {
          const { data } = await axios
            .post(
              'https://api.vercel.com/v12/now/deployments',
              {
                name: siteID,
                files: uniqueFiles,
                projectSettings: {
                  framework: null,
                },
                target: 'production',
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              }
            )
            .catch((e) => ({ data: null }))

          deployment = data
        }
      })
    )

    loading = false

    pages = []
  }

  async function buildSiteBundle(site, siteName) {
    const primoPage = `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>

          <body class="primo-page">   
            <iframe allow="clipboard-read; clipboard-write self https://its.primo.af" border="0" src="https://its.primo.af/${siteName}" style="height:100vh;width:100vw;position:absolute;top:0;left:0;border:0;"></iframe>
          </body>
        </html>
      `

    const pages = await Promise.all([
      ...site.pages.map((page) => buildPageTree({ page, site })),
      {
        path: `primo.json`,
        content: JSON.stringify(site),
      },
      // [
      //   {
      //     path: `primo/index.html`,
      //     content: primoPage,
      //   },
      //   // {
      //   //   path: 'robots.txt',
      //   //   content: `
      //   //   # Example 3: Block all but AdsBot crawlers
      //   //   User-agent: *
      //   //   Disallow: /`
      //   // },
      // ],
    ])

    return buildSiteTree(pages, site)

    async function buildPageTree({ page, site, isChild = false }) {
      const { id } = page
      const { html, modules } = await buildStaticPage({
        page,
        site,
        separateModules: true,
      })
      const formattedHTML = await beautifyHTML(html)

      return await Promise.all([
        {
          path: `${id === 'index' ? `index.html` : `${id}/index.html`}`,
          content: formattedHTML,
        },
        ...modules.map((module) => ({
          path: `_modules/${module.symbol}.js`,
          content: module.content,
        })),
        ...(page.pages
          ? page.pages.map((subpage) =>
              buildPageTree({ page: subpage, site, isChild: true })
            )
          : []),
      ])
    }

    async function buildSiteTree(pages, site) {
      const json = JSON.stringify(site)

      return [
        ...flattenDeep(pages),
        // {
        //   path: `styles.css`,
        //   content: styles
        // },
        // {
        //   path: `primo.json`,
        //   content: json,
        // },
        // {
        //   path: 'README.md',
        //   content: `# Built with [primo](https://primo.af)`,
        // },
      ]

      function getSiteHTML(site) {
        const symbolHTML = site.symbols
          .map((symbol) => symbol.value.html)
          .join(' ')
        const componentHTML = flattenDeep(
          site.pages.map((page) =>
            page.content
              .filter((block) => block.type === 'component' && !block.symbolID)
              .map((block) => block.value.html)
          )
        ).join(' ')
        return symbolHTML + componentHTML
      }
    }
  }

  let pages = []
</script>

<ModalHeader icon="fas fa-globe" title="Publish" variants="mb-4" />

<main class="primo-reset">
  <div class="publish">
    <div>
      <Hosting
        buttons={[
          {
            label: 'Download Site',
            onclick: downloadSite,
          },
        ]}
      />
    </div>
    <div>
      {#if deployment}
        <div class="boxes">
          <div class="box">
            <div class="deployment">
              Published to
              <a
                href="https://{deployment.alias[0]}"
                rel="external"
                target="blank">{deployment.alias[0]}</a
              >
              <!-- <span>{timeAgo.format(deployment.createdAt)}</span> -->
            </div>
          </div>
        </div>
      {/if}
      <header class="review">
        <div>
          {#if pages.length > 0 && !deployment}
            <p class="title">Review and Publish</p>
            <p class="subtitle">
              Here are the changes that you're making to your site
            </p>
            <PrimaryButton
              on:click={publishToHosts}
              label="Save and Publish"
              {loading}
            />
          {:else if $hosts.length > 0 && !deployment}
            <p class="title">Publish Changes</p>
            <PrimaryButton
              on:click={publishToHosts}
              label="Save and Publish"
              {loading}
            />
          {:else if !deployment}
            <p class="title">Download your website</p>
            <p class="subtitle">
              You can connect a web host to publish your website directly from
              primo, or download it to publish it manually
            </p>
            <PrimaryButton
              on:click={downloadSite}
              label="Download your site"
              {loading}
            />
          {/if}
        </div>
      </header>
    </div>
  </div>
</main>

<style lang="postcss">
  .title {
    margin-bottom: 0.5rem;
    color: var(--color-gray-1);
    font-weight: 600;
    transition: color 0.1s;
    a {
      text-decoration: underline;
    }
  }

  .subtitle {
    color: var(--color-gray-2);
    margin-bottom: 1rem;
    font-size: var(--font-size-2);
    line-height: 1.5;
  }

  main {
    background: var(--primo-color-black);
    color: var(--color-gray-1);
    padding: 1rem;

    .publish {
      display: grid;
      gap: 1rem;
      place-items: flex-start normal;

      .boxes {
        margin-bottom: 1rem;
      }

      .box {
        padding: 1rem;
        background: var(--color-gray-9);
        color: var(--color-gray-2);
        display: flex;
        flex-direction: column;

        &:not(:last-child) {
          border-bottom: 1px solid var(--color-gray-8);
        }

        .deployment {
          padding: 0.5rem 0;
          display: flex;
          flex-direction: column;

          a {
            text-decoration: underline;
            transition: color 0.1s;
            &:hover {
              color: var(--color-primored);
            }
          }

          &:not(:last-child) {
            border-bottom: 1px solid var(--color-gray-8);
          }
        }
      }
    }
  }

  @media (max-width: 600px) {
    main {
      .publish {
        grid-template-columns: auto;
      }
    }
  }
</style>
