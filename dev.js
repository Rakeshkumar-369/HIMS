// Starts the API and the web app together (no extra dependencies). Ctrl+C stops both.
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';
// `npm run dev:lan` also exposes the web app on your Wi-Fi so the doctor's phone can open it.
const lan = process.argv.includes('--lan');
const procs = [
  ['api', '\x1b[32m', 'server'],
  ['web', '\x1b[35m', 'client'],
].map(([name, color, dir]) => {
  const args = ['run', 'dev', '--prefix', dir, ...(lan && dir === 'client' ? ['--', '--host'] : [])];
  const p = spawn(isWin ? 'npm.cmd' : 'npm', args, { shell: isWin });
  const tag = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => stream.on('data', (d) => out.write(d.toString().split('\n').filter(Boolean).map((l) => tag + l).join('\n') + '\n'));
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);
  p.on('exit', (code) => { console.log(`${tag}exited (${code})`); stopAll(); });
  return p;
});

function stopAll() {
  for (const p of procs) if (!p.killed) p.kill();
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
