import { createServer } from 'node:http';
import { createPresenceMiddleware } from './presence.mjs';

const port = Number(process.env.PRESENCE_PORT) || 3001;
const presence = createPresenceMiddleware();

const server = createServer((req, res) => {
  presence(req, res, () => {
    res.statusCode = 404;
    res.end();
  });
});

server.listen(port, '127.0.0.1');

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
