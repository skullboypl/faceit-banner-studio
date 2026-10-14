import { createServer } from 'node:http';
import { createPresenceMiddleware } from './presence.mjs';
import { createAuthMiddleware } from './auth.mjs';

const port = Number(process.env.PRESENCE_PORT) || 3001;
const presence = createPresenceMiddleware();

const auth = createAuthMiddleware();

const server = createServer((req, res) => {
  presence(req, res, () => {
    auth(req, res, () => {
      res.statusCode = 404;
      res.end();
    });
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`presence and auth listening on 127.0.0.1:${port}`);
});

// A failed login store must not take the live counter down with it.
process.on('uncaughtException', (error) => {
  console.error('presence service kept running after an error:', error);
});
process.on('unhandledRejection', (error) => {
  console.error('presence service kept running after a rejection:', error);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
