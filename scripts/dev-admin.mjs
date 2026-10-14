/**
 * Local studio with a fake admin session, plus the Next API that serves the ticket queue.
 * DEV_ADMIN is honored only outside production and only on localhost.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env') });

const env = { ...process.env, DEV_ADMIN: '1', NODE_ENV: 'development' };
const nextBin = path.join(root, 'web', 'node_modules', 'next', 'dist', 'bin', 'next');
const viteBin = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');

const children = [
  spawn(process.execPath, [nextBin, 'dev', '-p', '3100', '-H', '127.0.0.1'], {
    cwd: path.join(root, 'web'),
    stdio: 'inherit',
    env,
  }),
  spawn(process.execPath, [viteBin, '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'inherit',
    env,
  }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exit(code ?? 0);
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else stop(code);
  });
}
