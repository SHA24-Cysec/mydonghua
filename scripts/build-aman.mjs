// Build yang tidak meninggalkan assets/main.css setengah jadi.
// Alur: cadangkan CSS terlacak, validasi konten, bangun CSS, jalankan Hugo.
// Bila Hugo gagal, CSS dikembalikan ke isi semula sebelum keluar dengan kode galat.
import { spawnSync } from 'node:child_process';
import { copyFileSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const cssPath = resolve('assets/main.css');
const cadangan = join(tmpdir(), `main-css-${process.pid}.bak`);

const jalankan = (script) => spawnSync('npm', ['run', script], { stdio: 'inherit', shell: false });

copyFileSync(cssPath, cadangan);
const isiSemula = readFileSync(cadangan);

for (const langkah of ['check:content', 'build:css']) {
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

for (const langkah of ['audit:pwa', 'audit:build']) {
  const r = jalankan(langkah);
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log('Build selesai: konten, CSS, Hugo, dan audit keluaran lulus.');
