import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'mydonghua-css-'));
const temporaryOutput = join(temporaryDirectory, 'main.css');
const tailwindCli = resolve('node_modules/tailwindcss/lib/cli.js');

try {
  const result = spawnSync(
    process.execPath,
    [tailwindCli, '-i', './assets/input.css', '-o', temporaryOutput],
    { cwd: process.cwd(), stdio: 'inherit' }
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  const committed = readFileSync(resolve('assets/main.css'));
  const generated = readFileSync(temporaryOutput);

  if (!committed.equals(generated)) {
    console.error('assets/main.css tidak sinkron dengan assets/input.css.');
    console.error('Jalankan: npm run build:css');
    process.exit(1);
  }

  console.log('CSS check lulus: assets/main.css sinkron.');
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
