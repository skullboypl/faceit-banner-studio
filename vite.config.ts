import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), wikiDevRewritePlugin()],
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
