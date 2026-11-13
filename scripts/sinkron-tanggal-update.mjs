import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const polaSha = /^[0-9a-f]{7,40}$/i;
const kataKunciBawaan = [
  'url error',
  'tautan rusak',
  'link download',
  'audit link',
  'stop slop',
  'edit stop',
  'perapian',
  'normalisasi',
  'migrasi',
  'salah ketik',
  'typo',
  'field streaming',
  'field rating',
  'downloadgroups',
  'layout'
];

export function frontMatter(sumber) {
  const cocok = sumber.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  return cocok ? cocok[1] : '';
}

export function skalarFrontMatter(front, namaField) {
  const cocok = front.match(new RegExp(`^${namaField}\\s*:\\s*(.*)$`, 'im'));
  if (!cocok) return '';
  const mentah = cocok[1].trim();
  if (!mentah || mentah.startsWith('#')) return '';
  return mentah.replace(/^['"]|['"]$/g, '').trim();
}

export function parseTanggalValid(teks) {
  if (!teks) return null;
  const tanggal = new Date(teks);
  return Number.isNaN(tanggal.getTime()) ? null : tanggal;
}

export function bacaKonfigurasiAbaikan(akar = process.cwd()) {
  const jalur = resolve(akar, 'abaikan-commit.json');
  if (!existsSync(jalur)) {
    throw new Error('Berkas konfigurasi abaikan-commit.json tidak ditemukan.');
  }

  let mentah;
  try {
    mentah = JSON.parse(readFileSync(jalur, 'utf8'));
  } catch (error) {
    throw new Error(`abaikan-commit.json bukan JSON valid: ${error.message}`);
  }

  if (!mentah || typeof mentah !== 'object' || Array.isArray(mentah)) {
    throw new Error('abaikan-commit.json harus berupa objek JSON.');
  }

  if (typeof mentah.abaikanCommitAwal !== 'boolean') {
    throw new Error('abaikan-commit.json: field abaikanCommitAwal harus bertipe boolean.');
  }

  if (!Array.isArray(mentah.penandaPesanCommit)) {
    throw new Error('abaikan-commit.json: field penandaPesanCommit harus berupa array string.');
  }

  const penandaPesanCommit = mentah.penandaPesanCommit.map((item, indeks) => {
    if (typeof item !== 'string' || !item.trim()) {
      throw new Error(`abaikan-commit.json: penandaPesanCommit[${indeks}] harus berupa string tidak kosong.`);
    }
    return item.trim().toLowerCase();
  });

  if (!Array.isArray(mentah.abaikanCommit)) {
    throw new Error('abaikan-commit.json: field abaikanCommit harus berupa array.');
  }

  const daftarSha = [];
  const unik = new Set();

  mentah.abaikanCommit.forEach((entri, indeks) => {
    const nilaiSha = typeof entri === 'string'
      ? entri.trim()
      : (entri && typeof entri === 'object' && !Array.isArray(entri) && typeof entri.sha === 'string' ? entri.sha.trim() : '');

    if (!polaSha.test(nilaiSha)) {
      throw new Error(`abaikan-commit.json: abaikanCommit[${indeks}] harus memiliki SHA heksadesimal 7-40 karakter.`);
    }

    const kecil = nilaiSha.toLowerCase();
    if (unik.has(kecil)) {
      throw new Error(`abaikan-commit.json: duplikasi SHA commit pada abaikanCommit (${kecil}).`);
    }
    unik.add(kecil);
    daftarSha.push(kecil);
  });

  let ambangOtomatis = 15;
  if (mentah.ambangOtomatis !== undefined) {
    if (typeof mentah.ambangOtomatis !== 'number' || !Number.isInteger(mentah.ambangOtomatis) || mentah.ambangOtomatis < 1 || mentah.ambangOtomatis > 1000) {
      throw new Error('abaikan-commit.json: ambangOtomatis harus berupa angka bulat 1 sampai 1000.');
    }
    ambangOtomatis = mentah.ambangOtomatis;
  }

  let kataKunciOtomatis = [...kataKunciBawaan];
  if (mentah.kataKunciOtomatis !== undefined) {
    if (!Array.isArray(mentah.kataKunciOtomatis)) {
      throw new Error('abaikan-commit.json: kataKunciOtomatis harus berupa array string.');
    }
    kataKunciOtomatis = mentah.kataKunciOtomatis.map((item, indeks) => {
      if (typeof item !== 'string' || !item.trim()) {
        throw new Error(`abaikan-commit.json: kataKunciOtomatis[${indeks}] harus berupa string tidak kosong.`);
      }
      return item.trim().toLowerCase();
    });
  }

  return {
    abaikanCommitAwal: mentah.abaikanCommitAwal,
    penandaPesanCommit,
    ambangOtomatis,
    kataKunciOtomatis,
    daftarSha
  };
}

function apakahCommitDiabaikan(sha, pesan, jumlahBerkas, konfigurasi) {
  const shaKecil = sha.toLowerCase();
  for (const pola of konfigurasi.daftarSha) {
    if (shaKecil === pola || shaKecil.startsWith(pola)) return true;
  }
  const pesanKecil = pesan.toLowerCase();
  for (const penanda of konfigurasi.penandaPesanCommit) {
    if (pesanKecil.includes(penanda)) return true;
  }
  if (typeof jumlahBerkas === 'number' && jumlahBerkas >= konfigurasi.ambangOtomatis) return true;
  for (const kunci of konfigurasi.kataKunciOtomatis) {
    if (pesanKecil.includes(kunci)) return true;
  }
  return false;
}

function kumpulkanBerkasMarkdown(direktori, akarKonten, hasil = []) {
  if (!existsSync(direktori)) return hasil;
  for (const entri of readdirSync(direktori, { withFileTypes: true })) {
    const jalurPenuh = join(direktori, entri.name);
    if (entri.isDirectory()) {
      kumpulkanBerkasMarkdown(jalurPenuh, akarKonten, hasil);
    } else if (entri.isFile() && entri.name.endsWith('.md')) {
      hasil.push(relative(akarKonten, jalurPenuh).split(sep).join('/'));
    }
  }
  return hasil;
}

export function hitungRiwayatGitKonten(akar = process.cwd(), konfigurasi = bacaKonfigurasiAbaikan(akar)) {
  const cekShallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
    cwd: akar,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();

  const keluaran = execFileSync(
    'git',
    ['log', '-z', '--format=COMMIT%x00%H%x00%aI%x00%B%x00ENDMSG', '--name-status', '--', 'content'],
    {
      cwd: akar,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024
    }
  );

  const token = keluaran.split('\0');
  const alias = new Map();
  const updateTerakhir = new Map();
  let indeks = 0;
  let jumlahCommit = 0;
  let jumlahCommitDiabaikan = 0;

  while (indeks < token.length) {
    const kepala = token[indeks];
    if (!kepala) {
      indeks += 1;
      continue;
    }

    if (kepala === 'COMMIT' || kepala.endsWith('\nCOMMIT')) {
      const sha = (token[indeks + 1] || '').trim();
      const isoTanggal = (token[indeks + 2] || '').trim();
      const pesan = token[indeks + 3] || '';
      indeks += 5;
      jumlahCommit += 1;

      const daftarBerkas = [];
      while (indeks < token.length && token[indeks] !== 'COMMIT' && !token[indeks].endsWith('\nCOMMIT')) {
        const status = token[indeks].replace(/^\r?\n+/, '').trim();
        if (!status) {
          indeks += 1;
          continue;
        }
        if (status.startsWith('R') || status.startsWith('C')) {
          const jalurLama = token[indeks + 1] || '';
          const jalurBaru = token[indeks + 2] || '';
          daftarBerkas.push({ status, jalurLama, jalurBaru });
          indeks += 3;
        } else {
          const jalurBaru = token[indeks + 1] || '';
          daftarBerkas.push({ status, jalurLama: '', jalurBaru });
          indeks += 2;
        }
      }

      const tanggalValid = parseTanggalValid(isoTanggal);
      if (!tanggalValid) continue;

      const diabaikan = apakahCommitDiabaikan(sha, pesan, daftarBerkas.length, konfigurasi);
      if (diabaikan) jumlahCommitDiabaikan += 1;

      for (const berkas of daftarBerkas) {
        if (!berkas.jalurBaru.startsWith('content/')) continue;
        const relBaru = berkas.jalurBaru.slice('content/'.length);
        const relLama = berkas.jalurLama.startsWith('content/') ? berkas.jalurLama.slice('content/'.length) : '';
        const kanonik = alias.get(relBaru) || relBaru;
        if (relLama && berkas.status.startsWith('R')) {
          alias.set(relLama, kanonik);
        }

        if (diabaikan) continue;
        if (updateTerakhir.has(kanonik)) continue;

        if (konfigurasi.abaikanCommitAwal && berkas.status.startsWith('A')) {
          updateTerakhir.set(kanonik, null);
        } else {
          updateTerakhir.set(kanonik, {
            iso: isoTanggal,
            tanggal: tanggalValid,
            sha
          });
        }
      }
    } else {
      indeks += 1;
    }
  }

  return {
    shallow: cekShallow === 'true',
    jumlahCommit,
    jumlahCommitDiabaikan,
    updateTerakhir
  };
}

export function bangunPetaTanggalUpdate(akar = process.cwd()) {
  const konfigurasi = bacaKonfigurasiAbaikan(akar);
  const riwayat = hitungRiwayatGitKonten(akar, konfigurasi);
  const akarKonten = resolve(akar, 'content');
  const daftarMarkdown = kumpulkanBerkasMarkdown(akarKonten, akarKonten).sort();
  const peta = {};

  for (const relJalur of daftarMarkdown) {
    const isi = readFileSync(join(akarKonten, relJalur), 'utf8');
    const front = frontMatter(isi);
    const manualRaw = skalarFrontMatter(front, 'updated') || skalarFrontMatter(front, 'lastmod');
    const terbitRaw = skalarFrontMatter(front, 'date') || skalarFrontMatter(front, 'publishDate');
    const tanggalManual = parseTanggalValid(manualRaw);
    const tanggalTerbit = parseTanggalValid(terbitRaw);
    const catatanGit = riwayat.updateTerakhir.get(relJalur) ?? null;

    let hasilIso = '';
    if (tanggalManual) {
      hasilIso = manualRaw;
    } else if (catatanGit) {
      if (tanggalTerbit && catatanGit.tanggal.getTime() < tanggalTerbit.getTime()) {
        hasilIso = terbitRaw;
      } else {
        hasilIso = catatanGit.iso;
      }
    } else if (tanggalTerbit) {
      hasilIso = terbitRaw;
    }

    if (hasilIso) {
      peta[relJalur] = hasilIso;
    }
  }

  return { konfigurasi, riwayat, peta };
}

export function tulisPetaTanggalUpdate(akar = process.cwd()) {
  const { konfigurasi, riwayat, peta } = bangunPetaTanggalUpdate(akar);
  const jalurKeluaran = resolve(akar, 'assets/data/tanggal-update.json');
  mkdirSync(dirname(jalurKeluaran), { recursive: true });
  writeFileSync(jalurKeluaran, `${JSON.stringify(peta, null, 2)}\n`, 'utf8');
  return { konfigurasi, riwayat, peta, jalurKeluaran };
}

const jalurSkripIni = resolve(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === jalurSkripIni) {
  try {
    const { riwayat, peta } = tulisPetaTanggalUpdate(process.cwd());
    if (riwayat.shallow) {
      console.warn('Peringatan: repository berstatus shallow clone; tanggal update mungkin belum mencerminkan riwayat penuh.');
    }
    console.log(
      `Sinkronisasi tanggal update selesai: ${Object.keys(peta).length} berkas konten dipetakan (${riwayat.jumlahCommitDiabaikan} commit perapian massal diabaikan dari ${riwayat.jumlahCommit} commit konten).`
    );
  } catch (error) {
    console.error(`Sinkronisasi tanggal update gagal: ${error.message}`);
    process.exit(1);
  }
}
