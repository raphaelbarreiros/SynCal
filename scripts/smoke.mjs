#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const HEALTH_URL = process.env.SMOKE_HEALTH_URL ?? 'http://localhost:3001/healthz';
const MAX_WAIT_MS = Number(process.env.SMOKE_TIMEOUT_MS ?? 5000);
const POLL_INTERVAL_MS = 500;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

async function pollHealth(url, deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // retry until timeout
    }

    await delay(POLL_INTERVAL_MS);
  }

  return false;
}

async function main() {
  const skipUp = process.argv.includes('--skip-up');
  const composeArgs = ['compose', 'up', '--build', '-d'];

  if (!skipUp) {
    await run('docker', composeArgs);
  }

  const ready = await pollHealth(HEALTH_URL, Date.now() + MAX_WAIT_MS);

  if (!ready) {
    throw new Error(`API health check did not succeed within ${MAX_WAIT_MS}ms at ${HEALTH_URL}`);
  }

  console.log(`✅ Stack healthy at ${HEALTH_URL}`);
}

main().catch((error) => {
  console.error(`❌ Smoke check failed: ${error.message}`);
  process.exit(1);
});
