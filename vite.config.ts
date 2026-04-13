import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') {
    return '/'
  }

  const trimmed = value.trim()
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_DEV_API_TARGET || 'http://localhost:8001'
  const host = env.VITE_HOST || '127.0.0.1'
  const port = Number(env.VITE_PORT || 5173)
  const usePolling = env.CHOKIDAR_USEPOLLING === 'true'
  const publicBasePath = normalizeBasePath(env.VITE_PUBLIC_BASE_PATH)

  return {
    base: publicBasePath,
    server: {
      host,
      port,
      strictPort: true,
      watch: usePolling
        ? {
            usePolling: true,
            interval: 300,
          }
        : undefined,
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
