import { spawnSync } from 'node:child_process';

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (process.env.VERCEL_ENV === 'preview' && process.env.GENKS_CINEMATIC_SANDBOX === 'true') {
  const studio = 'genks-virtual-studio';
  // Preview builds may inherit npm's production-only install settings.
  run('npm', ['ci', '--include=dev', '--no-audit', '--no-fund'], studio);
  run('node', ['node_modules/vite/bin/vite.js', 'build', '--base=/qa-studio/', '--outDir=../public/qa-studio'], studio);
}
run('node', ['--experimental-strip-types', 'scripts/check-cinematic-quote.mjs']);
run('npm', ['exec', '--', 'next', 'build']);
