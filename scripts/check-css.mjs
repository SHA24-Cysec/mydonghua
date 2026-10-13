import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// CLI Tailwind v4 ada di paket @tailwindcss/cli (bin "tailwindcss").
const tailwindCli = resolve('node_modules/@tailwindcss/cli/dist/index.mjs');

if (!existsSync(tailwindCli)) {
  console.error('CLI Tailwind v4 (@tailwindcss/cli) tidak ditemukan.');
  console.error('Jalankan: npm ci');
  process.exit(1);
}

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'mydonghua-css-'));
const temporaryOutput = join(temporaryDirectory, 'main.css');

// Pakai process.exitCode, bukan process.exit(), supaya blok finally tetap
// jalan dan folder sementara selalu terhapus walau pengecekan gagal.
try {
  const result = spawnSync(
    process.execPath,
    [tailwindCli, '-i', './assets/input.css', '-o', temporaryOutput],
    { cwd: process.cwd(), stdio: 'inherit' }
  );

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
  } else {
    const committed = readFileSync(resolve('assets/main.css'));
    const generated = readFileSync(temporaryOutput);

    if (committed.equals(generated)) {
      console.log('CSS check lulus: assets/main.css sinkron.');
    } else {
      console.error('assets/main.css tidak sinkron dengan assets/input.css.');
      console.error('Jalankan: npm run build:css');
      process.exitCode = 1;
    }
  }
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
