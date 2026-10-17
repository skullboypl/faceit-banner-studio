import { createServer } from 'node:http';
import { createPresenceMiddleware, hydratePresence, startOnlineHistory } from './presence.mjs';
import { createAuthMiddleware } from './auth.mjs';
import { faceitKeySource } from './faceit-gate.mjs';
import { fail, log, startSummary } from './log.mjs';

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

void hydratePresence();
startOnlineHistory();
startSummary(60);
server.listen(port, '127.0.0.1', () => {
  log('boot', `presence + auth on 127.0.0.1:${port} | FACEIT server key: ${faceitKeySource()} | redis: ${process.env.REDIS_URL ? 'set' : 'off'} | postgres: ${process.env.DATABASE_URL ? 'set' : 'off'}`);
});

// A failed login store must not take the live counter down with it.
process.on('uncaughtException', (error) => {
  fail('error', `kept running after an error: ${error?.stack || error}`);
});
process.on('unhandledRejection', (error) => {
  fail('error', `kept running after a rejection: ${error?.stack || error}`);
});

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
