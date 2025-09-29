import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import svgr from 'vite-plugin-svgr'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
	return {
		plugins: [
			tailwindcss(),
			react({
				babel: {
					plugins: [['babel-plugin-react-compiler', {}]],
				},
			}),
			svgr({
				svgrOptions: {
					memo: true,
					icon: true,
					exportType: 'named',
				},
				include: '**/*.svg',
			}),
			VitePWA({
				registerType: 'autoUpdate',
				includeAssets: ['favicon.svg'],
				workbox: {
					globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
					navigateFallback: 'index.html',
				},
				devOptions: {
					enabled: true,
					suppressWarnings: true,
				},
				manifest: {
					name: 'XCStrings Editor',
					short_name: 'XCStrings',
					description: 'Offline-ready editor for Apple XCStrings localization catalogs.',
					scope: '/',
					start_url: '/',
					display: 'standalone',
					background_color: '#ffffff',
					theme_color: '#111111',
					icons: [
						{
							src: '/icons/icon-192.png',
							sizes: '192x192',
							type: 'image/png',
						},
						{
							src: '/icons/icon-512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'any maskable',
						},
					],
				},
			}),
			tsconfigPaths(),
		],
		root: __dirname,
		css: {
			devSourcemap: mode === 'development',
			modules: {
				generateScopedName: mode === 'production' ? '[local]__[hash:base64:6]' : '[hash:base64:8]',
			},
		},
		resolve: {
			alias: {
				'@': path.resolve(__dirname, 'src'),
			},
		},
		build: {
			rollupOptions: {
				output: {
					manualChunks: {
						vendor: ['react', 'react-dom'],
					},
				},
			},
		},
	}
})
