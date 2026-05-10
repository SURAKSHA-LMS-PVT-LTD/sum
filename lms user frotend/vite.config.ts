import react from '@vitejs/plugin-react-swc';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig(({mode}) => {
  // env is resolved for any future server-side build steps; do NOT inject secrets into the browser bundle
  void loadEnv(mode, '.', '');
  const buildTime = new Date().toISOString();
  const appMajor = parseInt(String(pkg.version).split('.')[0] || '1', 10);
  const buildHash = `${pkg.version}-${buildTime}`;

  const versionManifestPlugin: Plugin = {
    name: 'version-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({
          hash: buildHash,
          semver: pkg.version,
          major: appMajor,
          buildTime,
        }, null, 2),
      });
    },
  };

  return {
    plugins: [react(), versionManifestPlugin],
    // No secret keys are injected here — GEMINI_API_KEY must stay server-side only
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_NAME__: JSON.stringify(pkg.name),
      __APP_BUILD_DATE__: JSON.stringify(buildTime),
      __APP_BUILD_HASH__: JSON.stringify(buildHash),
      __APP_MAJOR__: JSON.stringify(appMajor),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    logLevel: mode === 'production' ? 'error' : 'info',
    // Top-level esbuild config — production strips every console.* call and debugger
    esbuild: mode === 'production' ? {
      drop: ['console', 'debugger'],
      pure: ['console.log', 'console.info', 'console.debug', 'console.warn', 'console.trace', 'console.dir'],
      legalComments: 'none',
    } : undefined,
    build: {
      target: 'es2020',
      minify: 'esbuild',
      sourcemap: false,
      emptyOutDir: false, // we pre-clean dist ourselves to avoid EBUSY on Windows
      reportCompressedSize: false,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // MUI + recharts/d3 must share one chunk — recharts has a circular
            // dependency on @mui/@emotion that causes "Cannot access before
            // initialization" crashes in the Android WebView if split apart.
            if (
              id.includes('node_modules/@mui') ||
              id.includes('node_modules/@emotion') ||
              id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3')
            ) {
              return 'vendor-mui';
            }
            // React core + router
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react-router') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            // Data fetching
            if (id.includes('node_modules/@tanstack')) {
              return 'vendor-query';
            }
            // Icons
            if (id.includes('node_modules/lucide-react')) {
              return 'vendor-icons';
            }
            // Forms + validation
            if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/zod') || id.includes('node_modules/@hookform')) {
              return 'vendor-forms';
            }
            // Date utilities
            if (id.includes('node_modules/date-fns')) {
              return 'vendor-datefns';
            }
          },
        },
      },
    },
    optimizeDeps: {
      include: ['papaparse', 'xlsx'],
    },
    server: {
      port: 3000,
      host: '127.0.0.1',
      allowedHosts: ['.suraksha.lk', '.localhost'],
      hmr: process.env.DISABLE_HMR !== 'true',
      headers: {
        // Content Security Policy — tighten per-environment at the CDN/reverse-proxy in production
        'Content-Security-Policy': [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://*.google.com https://*.googleapis.com https://*.gstatic.com",
          "style-src 'self' 'unsafe-inline' https://*.googleapis.com https://*.gstatic.com",
          "connect-src 'self' https: wss: http://localhost:*",
          "img-src 'self' data: blob: https: http://translate.google.com",
          "font-src 'self' data: https://*.gstatic.com https://*.googleapis.com",
          "frame-src 'self' https://*.google.com https://*.googleapis.com",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=*, microphone=(), geolocation=*',
      },
    },
  };
});
