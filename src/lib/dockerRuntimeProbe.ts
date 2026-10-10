/** Runs as the container's controller, outside customer files and scripts. */
export const NODE_RUNTIME_PROBE = String.raw`
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const script = pkg.scripts?.start ? 'start' : 'preview';
const port = Number(process.env.APPFORGE_VALIDATION_PORT || 3000);
const limit = Number(process.env.APPFORGE_RUNTIME_TIMEOUT_MS || 30000);
const args = ['run', script];
if (script === 'preview') args.push('--', '--host', '0.0.0.0', '--port', String(port), '--strictPort');
const child = spawn('npm', args, {
  stdio: 'ignore',
  env: { ...process.env, NODE_ENV: 'production', CI: 'true', PORT: String(port) },
});
let stopped = false;
child.on('error', () => { stopped = true; });
child.on('exit', () => { stopped = true; });
(async () => {
  const deadline = Date.now() + limit;
  while (Date.now() < deadline && !stopped) {
    for (const path of ['/api/health', '/health', '/']) {
      try {
        const response = await fetch('http://127.0.0.1:' + port + path, { signal: AbortSignal.timeout(1500), redirect: 'manual' });
        const passed = response.status >= 200 && response.status < 300;
        await response.body?.cancel();
        if (passed && !stopped) {
          console.log('Runtime produced a successful HTTP response');
          child.kill('SIGTERM');
          process.exit(0);
        }
      } catch {}
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.error('Runtime did not produce a successful HTTP response before stopping or timing out');
  child.kill('SIGTERM');
  process.exit(1);
})().catch(() => { child.kill('SIGTERM'); process.exit(1); });
`;
