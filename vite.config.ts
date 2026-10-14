import { defineConfig, loadEnv, Plugin } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react-swc';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPresenceMiddleware } from './server/presence.mjs';
import { createAuthMiddleware } from './server/auth.mjs';

function presenceDevPlugin(): Plugin {
  return {
    name: 'presence-dev-api',
    configureServer(server) {
      server.middlewares.use(createPresenceMiddleware());
      server.middlewares.use(createAuthMiddleware());
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

    const section = ['/wiki', '/docs', '/en/docs'].find(
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

// https://vitejs.dev/config/
export default defineConfig({
  // Accounts, saved banners and cloud sync live in the Next.js app (web/, port 3100).
  server: {
    proxy: {
      '/api/me': 'http://127.0.0.1:3100',
      '/api/posts': 'http://127.0.0.1:3100',
      '/api/admin/posts': 'http://127.0.0.1:3100',
      '/api/admin/comments': 'http://127.0.0.1:3100',
    },
  },
  plugins: [react(), presenceDevPlugin(), wikiDevRewritePlugin(), ...(mode === 'https' ? [basicSsl()] : [])],
  build: {
    rollupOptions: {
      input: {
        main: './index.html',
        widget: './widget/index.html',
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
});
