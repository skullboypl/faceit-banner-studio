import { defineConfig, loadEnv, Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react-swc';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPresenceMiddleware, startOnlineHistory } from './server/presence.mjs';
import { createAuthMiddleware } from './server/auth.mjs';
import { createDevPreviewMiddleware } from './server/dev-preview.mjs';

function presenceDevPlugin(): Plugin {
  return {
    name: 'presence-dev-api',
    configureServer(server) {
      server.middlewares.use(createDevPreviewMiddleware());
      server.middlewares.use(createPresenceMiddleware());
      server.middlewares.use(createAuthMiddleware());
      startOnlineHistory();
    },
    configurePreviewServer(server) {
      server.middlewares.use(createPresenceMiddleware());
      server.middlewares.use(createAuthMiddleware());
    },
  };
}

function wikiDevRewritePlugin(): Plugin {
  const publicDir = fileURLToPath(new URL('./public', import.meta.url));

  const rewrite = (url: string): string => {
    const [pathname, query] = url.split('?');
    const suffix = query ? `?${query}` : '';

    const section = ['/wiki', '/docs', '/en/docs', '/de/docs', '/uk/docs', '/ru/docs', '/tr/docs', '/pt/docs', '/es/docs', '/fr/docs', '/cs/docs', '/terms', '/privacy'].find(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
    if (!section) {
      return url;
    }

    if (pathname === section || pathname === `${section}/`) {
      return `${section}/index.html${suffix}`;
    }

    if (path.extname(pathname)) {
      return url;
    }

    const cleanPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const candidate = path.join(publicDir, cleanPath, 'index.html');

    if (existsSync(candidate)) {
      return `${cleanPath}/index.html${suffix}`;
    }

    return url;
  };

  return {
    name: 'wiki-dev-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          req.url = rewrite(req.url);
        }
        next();
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url) {
          req.url = rewrite(req.url);
        }
        next();
      });
    },
  };
}

/** Backend keys (DATABASE_URL, REDIS_URL, FACEIT_OAUTH_*) live in .env but are not VITE_-prefixed. */
function loadServerEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
/** `vite --mode https` serves the generator over https (FACEIT only accepts https redirect URIs). */
const mode = process.argv.includes('--mode') ? process.argv[process.argv.indexOf('--mode') + 1] : 'development';
loadServerEnv(mode);

const buildStamp = String(process.env.SOURCE_COMMIT || process.env.VITE_BUILD_ID || 'dev')
  .replace(/[^a-zA-Z0-9]/g, '')
  .slice(0, 16) || 'dev';

// https://vitejs.dev/config/
export default defineConfig(({ isSsrBuild }) => ({
  // Accounts, saved banners and cloud sync live in the Next.js app (web/, port 3100).
  server: {
    proxy: {
      '/api/me': 'http://127.0.0.1:3100',
      '/api/catalog/banners': 'http://127.0.0.1:3100',
      '/api/posts': 'http://127.0.0.1:3100',
      '/api/admin/posts': 'http://127.0.0.1:3100',
      '/api/admin/publications': 'http://127.0.0.1:3100',
      '/api/admin/comments': 'http://127.0.0.1:3100',
      '/api/admin/profile-images': 'http://127.0.0.1:3100',
      '/api/profiles': 'http://127.0.0.1:3100',
      '/api/admin/attachments': 'http://127.0.0.1:3100',
      '/api/attachments': 'http://127.0.0.1:3100',
    },
  },
  plugins: [react(), presenceDevPlugin(), wikiDevRewritePlugin(), ...(mode === 'https' ? [basicSsl()] : [])],
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(process.env.SOURCE_COMMIT || process.env.VITE_BUILD_ID || 'dev'),
  },
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        widget: './widget/index.html',
      },
      // Docs SSR must stay at .ssr/render.js. Stamped names are only for the public assets.
      ...(isSsrBuild
        ? {}
        : {
            output: {
              entryFileNames: `assets/[name]-${buildStamp}-[hash].js`,
              chunkFileNames: `assets/[name]-${buildStamp}-[hash].js`,
              assetFileNames: `assets/[name]-${buildStamp}-[hash][extname]`,
            },
          }),
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
}));
