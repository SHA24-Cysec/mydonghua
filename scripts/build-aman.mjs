import { spawnSync } from 'node:child_process';
import { copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cssPath = resolve('assets/main.css');
const cadangan = join(tmpdir(), `main-css-${process.pid}.bak`);
const polaSha = /^[0-9a-f]{7,64}$/i;

const jalankan = (script) => spawnSync('npm', ['run', script], { stdio: 'inherit', shell: false });

function periksaShallow() {
  const cek = spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
    encoding: 'utf8',
    shell: false
  });
  if (cek.status !== 0) {
    console.error('Metadata git (.git) tidak ditemukan atau tidak valid. Build membutuhkan riwayat git untuk enableGitInfo.');
    process.exit(1);
  }
  return cek.stdout.trim() === 'true';
}

function pastikanRiwayatGitPenuh() {
  if (!periksaShallow()) return;

  console.log('Riwayat git dangkal (shallow) terdeteksi. Mengambil riwayat commit penuh...');
  spawnSync('git', ['fetch', '--unshallow'], {
    stdio: 'inherit',
    shell: false,
    timeout: 120000
  });

  if (periksaShallow()) {
    const kandidatSha = (process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA || '').trim();
    const targetRef = polaSha.test(kandidatSha) ? kandidatSha : 'HEAD';
    spawnSync('git', ['fetch', '--unshallow', 'origin', targetRef], {
      stdio: 'inherit',
      shell: false,
      timeout: 120000
    });
  }

  if (periksaShallow()) {
    console.error('Gagal mengambil riwayat git penuh (repository masih shallow). Build dihentikan agar tanggal update tidak seragam.');
    process.exit(1);
  }
}

pastikanRiwayatGitPenuh();

copyFileSync(cssPath, cadangan);
const isiSemula = readFileSync(cadangan);

for (const langkah of ['sync:tanggal', 'check:content', 'build:css']) {
  const r = jalankan(langkah);
  if (r.status !== 0) {
    rmSync(cadangan, { force: true });
    process.exit(r.status ?? 1);
  }
}

const hugo = jalankan('build:hugo');
if (hugo.status !== 0) {
  writeFileSync(cssPath, isiSemula);
  rmSync(cadangan, { force: true });
  console.error('Hugo gagal. assets/main.css dikembalikan ke isi semula, tidak ada berkas setengah jadi.');
  process.exit(hugo.status ?? 1);
}
rmSync(cadangan, { force: true });

for (const langkah of ['audit:pwa', 'audit:build', 'audit:password', 'audit:tanggal']) {
  const r = jalankan(langkah);
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log('Build selesai: riwayat git, konten, CSS, Hugo, dan seluruh audit keluaran lulus.');
