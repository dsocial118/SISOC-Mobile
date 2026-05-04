import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function normalizeBasePath(value: string): string {
  const withLeadingSlash = value.startsWith('/') ? value : `/${value}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:8001'
  const publicBasePath = normalizeBasePath(
    env.VITE_PUBLIC_BASE_PATH || (mode === 'production' ? '/mobile/' : '/'),
  )
  const now = new Date()
  const appBuildDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(-2)}`

  return {
    base: publicBasePath,
    define: {
      __APP_BUILD_DATE__: JSON.stringify(appBuildDate),
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['sisoc_ico_192.png', 'sisoc_ico_512.png'],
        manifest: {
          id: publicBasePath,
          name: 'SiSOC Mobil',
          short_name: 'SiSOC Mobil',
          description: 'SiSOC Mobil',
          theme_color: '#232D4F',
          background_color: '#232D4F',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone'],
          start_url: publicBasePath,
          scope: publicBasePath,
          icons: [
            {
              src: 'sisoc_ico_192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'sisoc_ico_512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
  }
})
