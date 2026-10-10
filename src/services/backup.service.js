import fs from "fs/promises";
import path from "path";

// Backup se radi sh skriptama iz crona (/home/korisnik/BACKUP_SKRIPTE/*.sh),
// svaka baza u svoj folder: <BACKUP_DIR>/<baza>/<baza>_YYYY-MM-DD_HH-MM-SS.sql.gz
// + <BACKUP_DIR>/<baza>/backup.log. Raspored mora odgovarati crontab-u.
const BACKUP_DIR = process.env.BACKUP_DIR || "/backup/mysql";

const BAZE = [
  { baza: "erp_prodaja", cron: "23:00" },
  { baza: "erp", cron: "23:15" },
  { baza: "erp_proizvodnja", cron: "23:25" },
  { baza: "ziralni", cron: "23:35" },
  { baza: "aplikacija_kese", cron: "23:45" },
];

// Koliko minuta poslije zakazanog vremena se backup smatra zakasnjelim.
const TOLERANCIJA_MIN = 30;
const BROJ_ZADNJIH = 10;
const LOG_TAIL_BYTES = 64 * 1024;

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Zadnji trenutak kad je backup po crontab-u trebao krenuti (danas ili juče).
const zadnjeZakazano = (cron, sada) => {
  const [h, m] = cron.split(":").map(Number);
  const t = new Date(sada);
  t.setHours(h, m, 0, 0);
  if (t > sada) t.setDate(t.getDate() - 1);
  return t;
};

const procitajLog = async (logPath) => {
  let fh;
  try {
    fh = await fs.open(logPath, "r");
    const { size } = await fh.stat();
    const start = Math.max(0, size - LOG_TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    await fh.read(buf, 0, buf.length, start);
    const linije = buf.toString("utf8").split(/\r?\n/).filter(Boolean);
    const idx = linije.map((l) => l.includes("POCETAK BACKUPA")).lastIndexOf(true);
    const blok = idx >= 0 ? linije.slice(idx) : linije.slice(-10);
    const greska = blok.find((l) => l.includes("GRESKA"));
    return {
      dostupan: true,
      linije: blok.filter((l) => !/^\[[^\]]+\]\s*-+$/.test(l)),
      rezultat: greska
        ? "greska"
        : blok.some((l) => l.includes("BACKUP USPJESNO"))
          ? "ok"
          : "nepoznato",
      greska: greska ?? null,
    };
  } catch (error) {
    return {
      dostupan: false,
      linije: [],
      rezultat: "nepoznato",
      greska: null,
      razlog: error.code === "EACCES" ? "nema dozvole za čitanje" : error.code,
    };
  } finally {
    await fh?.close();
  }
};

const statusBaze = async ({ baza, cron }, sada) => {
  const dir = path.join(BACKUP_DIR, baza);
  const sablon = new RegExp(
    `^${escapeRegex(baza)}_(\\d{4})-(\\d{2})-(\\d{2})_(\\d{2})-(\\d{2})-(\\d{2})\\.sql\\.gz$`,
  );

  let imena;
  try {
    imena = await fs.readdir(dir);
  } catch (error) {
    return {
      baza,
      cron,
      folder: dir,
      status: "greska",
      poruka:
        error.code === "ENOENT"
          ? "Folder ne postoji"
          : error.code === "EACCES"
            ? "Nema dozvole za čitanje foldera"
            : `Greška pri čitanju foldera (${error.code})`,
      zadnji: null,
      prethodni: null,
      brojFajlova: 0,
      ukupnaVelicina: 0,
      zadnjiFajlovi: [],
      tmpUToku: false,
      log: null,
    };
  }

  const fajlovi = [];
  for (const ime of imena) {
    const m = ime.match(sablon);
    if (!m) continue;
    try {
      const st = await fs.stat(path.join(dir, ime));
      fajlovi.push({
        fajl: ime,
        // Datum iz imena fajla = vrijeme početka backupa po vremenu servera.
        datum: new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).toISOString(),
        izmijenjen: st.mtime.toISOString(),
        velicina: st.size,
      });
    } catch {
      // fajl obrisan između readdir i stat — preskoči
    }
  }
  fajlovi.sort((a, b) => (a.fajl < b.fajl ? 1 : -1));

  const tmpUToku = imena.some((i) => i.startsWith(`${baza}_`) && i.endsWith(".tmp"));
  const log = await procitajLog(path.join(dir, "backup.log"));

  const zadnji = fajlovi[0] ?? null;
  const prethodni = fajlovi[1] ?? null;
  const zakazano = zadnjeZakazano(cron, sada);
  const rok = new Date(zakazano.getTime() + TOLERANCIJA_MIN * 60000);

  let status = "ok";
  let poruka = "Backup je uredan";
  if (!zadnji) {
    status = "greska";
    poruka = "Nema nijednog backup fajla";
  } else if (log.rezultat === "greska" && new Date(zadnji.datum) < zakazano) {
    status = "greska";
    poruka = log.greska.replace(/^\[[^\]]+\]\s*/, "");
  } else if (new Date(zadnji.datum) < zakazano && sada > rok) {
    status = "greska";
    poruka = "Zadnji zakazani backup nije napravljen";
  } else if (tmpUToku) {
    status = "upozorenje";
    poruka = "Backup je u toku (postoji .tmp fajl)";
  } else if (prethodni && zadnji.velicina < prethodni.velicina * 0.5) {
    status = "upozorenje";
    poruka = "Zadnji backup je duplo manji od prethodnog";
  } else if (zadnji.velicina < 1024) {
    status = "upozorenje";
    poruka = "Backup fajl je sumnjivo mali";
  }

  return {
    baza,
    cron,
    folder: dir,
    status,
    poruka,
    zadnji,
    prethodni,
    brojFajlova: fajlovi.length,
    ukupnaVelicina: fajlovi.reduce((s, f) => s + f.velicina, 0),
    zadnjiFajlovi: fajlovi.slice(0, BROJ_ZADNJIH),
    tmpUToku,
    log,
  };
};

const disk = async () => {
  try {
    const s = await fs.statfs(BACKUP_DIR);
    return { ukupno: s.blocks * s.bsize, slobodno: s.bavail * s.bsize };
  } catch {
    return null;
  }
};

export const getBackupStatus = async () => {
  const sada = new Date();
  const [baze, prostor] = await Promise.all([
    Promise.all(BAZE.map((b) => statusBaze(b, sada))),
    disk(),
  ]);
  return {
    backupDir: BACKUP_DIR,
    vrijemeProvjere: sada.toISOString(),
    disk: prostor,
    baze,
  };
};
