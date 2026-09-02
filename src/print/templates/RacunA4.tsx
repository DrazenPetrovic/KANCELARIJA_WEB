import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

// Štampač je mrežni monochrome (crno-bijeli) — boje se pretvaraju u blijedi
// sivi raster i slabo se vide na papiru, pa su obje "boje" ovdje čisto crne.
// Nazivi su zadržani (PRIMARY/ACCENT) da se ne mijenja ostatak fajla.
const PRIMARY = "#000000";
const ACCENT = "#000000";

// Sjedište firme — fiksno, ide u "Mjesto izdavanja" na svakom žiralnom računu.
const MJESTO_IZDAVANJA = "Ložionička bb, 78000 Banja Luka";

export interface RacunA4PoslovnaJedinica {
  naziv: string;
  adresa?: string | null;
  grad?: string | null;
  jib?: string | null;
}

export interface RacunA4Zaglavlje {
  broj_racuna: string;
  datum_izdavanja: string;
  datum_isporuke: string;
  // Datum do kada račun treba biti plaćen ("Valuta računa" u formi).
  valuta: string;
  // Šifra tabele (interni ključ zapisa) — kodira se u barkod 128 radi kasnijeg
  // skeniranja u modulu za praćenje kretanja dokumenata.
  sifra_tabele?: number | string | null;
  naziv_partnera: string;
  adresa_partnera?: string | null;
  naziv_grada?: string | null;
  jib?: string | null;
  pib?: string | null;
  poslovna_jedinica?: RacunA4PoslovnaJedinica | null;
  slovima?: string | null;
  napomena?: string | null;
  br_fiskalnog?: string | number | null;
  // Datum i vrijeme fiskalizacije (ESIR invoiceResponse.sdcDateTime).
  datum_vreme_fiskalnog?: string | null;
  // Base64 GIF slika QR koda (ESIR invoiceResponse.verificationQRCode) — samo
  // za fiskalizovane račune.
  verifikacioni_qr?: string | null;
  // Trenutni dug partnera (erp.partneri_trenutni_dug_pregled) — prikazan uz
  // "Trenutna dugovanja partnera iznose" u dnu računa.
  dug_partnera?: number | string | null;
}

export interface RacunA4Stavka {
  sifra_proizvoda: string | number;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number | string;
  vpc: number | string;
  vpc1: number | string;
  rab1: number | string;
  vpc2: number | string;
  rab2: number | string;
  vpc3: number | string;
  rab3: number | string;
  osnova: number | string;
  vrednost: number | string;
  pdv: number | string;
  ukupno: number | string;
}

interface Props {
  racun: RacunA4Zaglavlje;
  stavke: RacunA4Stavka[];
}

function formatDatum(dt: string | undefined | null) {
  if (!dt) return "-";
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function formatDatumVrijeme(dt: string | undefined | null) {
  if (!dt) return null;
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${yyyy}. ${hh}:${min}:${ss}`;
}

function broj(v: number | string | null | undefined) {
  const n = Number(v);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

function brojN(v: number | string | null | undefined) {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

export function RacunA4({ racun, stavke }: Props) {
  const barkodRef = useRef<HTMLCanvasElement>(null);
  // Dimenzije nacrtanog barkoda (prije rotacije) — potrebne da omotač oko
  // canvasa rezerviše zamijenjen (širina/visina) prostor za uspravan barkod.
  const [barkodDim, setBarkodDim] = useState<{
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    const vrijednost =
      racun.sifra_tabele !== undefined &&
      racun.sifra_tabele !== null &&
      racun.sifra_tabele !== ""
        ? String(racun.sifra_tabele)
        : null;
    if (!vrijednost || !barkodRef.current) return;
    JsBarcode(barkodRef.current, vrijednost, {
      format: "CODE128",
      width: 1.6,
      height: 40,
      displayValue: true,
      fontSize: 10,
      margin: 0,
    });
    setBarkodDim({
      w: barkodRef.current.width,
      h: barkodRef.current.height,
    });
  }, [racun.sifra_tabele]);

  // SALDO cifra — font-size (ne CSS transform, da se ne deformiše) izračunat
  // tako da tekst maksimalno ispuni raspoloživu širinu okvira, bez obzira na
  // broj cifara.
  const saldoWrapRef = useRef<HTMLDivElement>(null);
  const [saldoFontSize, setSaldoFontSize] = useState(16);

  useEffect(() => {
    if (
      racun.dug_partnera === undefined ||
      racun.dug_partnera === null ||
      !saldoWrapRef.current
    )
      return;
    const dostupnaSirina = saldoWrapRef.current.clientWidth;
    if (!dostupnaSirina) return;
    const tekst = `${broj(racun.dug_partnera)} KM`;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const referentnaVelicina = 100;
    ctx.font = `800 ${referentnaVelicina}px Arial`;
    const sirinaPriReferenci = ctx.measureText(tekst).width;
    if (!sirinaPriReferenci) return;
    const izracunato =
      (dostupnaSirina / sirinaPriReferenci) * referentnaVelicina;
    setSaldoFontSize(Math.max(14, Math.min(42, izracunato)));
  }, [racun.dug_partnera]);

  // Rekapitulacija — sve u KM, sabrano preko svih stavki.
  const rVrednost = stavke.reduce(
    (s, r) => s + brojN(r.vpc) * brojN(r.kolicina),
    0,
  );
  // Rabat po nivou se računa kaskadno IZ PROCENATA (rab1/rab2/rab3), ne iz
  // apsolutnih vpc1/vpc2/vpc3 polja — ona nisu pouzdana kad neki nivo rabata
  // nije korišten (npr. vpc2 zna doći kao 0 umjesto da ostane jednako vpc1,
  // što bi oduzimanjem dalo lažan Rabat 2 = cijela vrijednost i Rabat 3 u minus).
  let rRab1 = 0;
  let rRab2 = 0;
  let rRab3 = 0;
  stavke.forEach((r) => {
    const kolicina = brojN(r.kolicina);
    const poslijeRab1 = brojN(r.vpc) * (1 - brojN(r.rab1) / 100);
    const poslijeRab2 = poslijeRab1 * (1 - brojN(r.rab2) / 100);
    const poslijeRab3 = poslijeRab2 * (1 - brojN(r.rab3) / 100);
    rRab1 += (brojN(r.vpc) - poslijeRab1) * kolicina;
    rRab2 += (poslijeRab1 - poslijeRab2) * kolicina;
    rRab3 += (poslijeRab2 - poslijeRab3) * kolicina;
  });
  const rOsnova = stavke.reduce((s, r) => s + brojN(r.vrednost), 0);
  const rPdv = stavke.reduce((s, r) => s + brojN(r.pdv), 0);
  const rUkupno = stavke.reduce((s, r) => s + brojN(r.ukupno), 0);

  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        fontSize: 13,
        color: "#1a1a1a",
        background: "white",
      }}
    >
      {/* ── Memorandum (zaglavlje firme) ── */}
      <img
        src={`${import.meta.env.BASE_URL}foto/MEMORANDUM.jpg`}
        alt="Memorandum"
        style={{
          display: "block",
          width: "calc(100% - 18px)",
          marginTop: "10px",
          marginLeft: "9px",
          marginRight: "9px",
        }}
      />

      <div style={{ padding: "8mm 9px", boxSizing: "border-box" }}>
        {/* ── Header: lijevo 50% (partner + račun/otpremnica) | vertikalna
            linija | desno 50% (datumi + PFR podaci + QR) ── */}
        <div style={{ display: "flex", alignItems: "stretch", marginBottom: 12 }}>
          {/* Lijevo 50% — partner (+ poslovna jedinica) + račun/otpremnica */}
          <div style={{ width: "50%", boxSizing: "border-box", paddingRight: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: PRIMARY }}>
              {racun.naziv_partnera}
            </div>
            {(racun.adresa_partnera || racun.naziv_grada) && (
              <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
                {[racun.adresa_partnera, racun.naziv_grada]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
            <div style={{ fontSize: 11, color: "#444", marginTop: 2 }}>
              {racun.jib && <>JIB: {racun.jib} </>}
              {racun.pib && <>&nbsp;&nbsp;PIB: {racun.pib}</>}
            </div>

            {racun.poslovna_jedinica && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: ACCENT,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Poslovna jedinica
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2 }}>
                  {racun.poslovna_jedinica.naziv}
                </div>
                {(racun.poslovna_jedinica.adresa ||
                  racun.poslovna_jedinica.grad) && (
                  <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>
                    {[
                      racun.poslovna_jedinica.adresa,
                      racun.poslovna_jedinica.grad,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                {racun.poslovna_jedinica.jib && (
                  <div style={{ fontSize: 11, color: "#444", marginTop: 1 }}>
                    JIB: {racun.poslovna_jedinica.jib}
                  </div>
                )}
              </div>
            )}

            <div style={{ fontSize: 18, fontWeight: 800, color: PRIMARY, marginTop: 14 }}>
              Račun/Otpremnica: {racun.broj_racuna}
            </div>
          </div>

          {/* Vertikalna linija */}
          <div style={{ width: 0, borderLeft: `2px solid ${PRIMARY}`, margin: "0 16px" }} />

          {/* Desno 50% — datumi + PFR broj/datum (lijevo) i QR kod (desno) */}
          <div
            style={{
              width: "50%",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <div style={{ fontSize: 11, color: "#444" }}>
              <div style={{ marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: PRIMARY }}>
                  Datum izdavanja:{" "}
                </span>
                {formatDatum(racun.datum_izdavanja)}
              </div>
              <div style={{ marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: PRIMARY }}>
                  Mjesto izdavanja:{" "}
                </span>
                {MJESTO_IZDAVANJA}
              </div>
              <div style={{ marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: PRIMARY }}>
                  Valuta računa:{" "}
                </span>
                {formatDatum(racun.valuta)}
              </div>
              <div style={{ marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: PRIMARY }}>
                  Datum isporuke:{" "}
                </span>
                {formatDatum(racun.datum_isporuke)}
              </div>
              {racun.br_fiskalnog !== undefined &&
                racun.br_fiskalnog !== null &&
                racun.br_fiskalnog !== "" && (
                  <div style={{ marginBottom: 3 }}>
                    <span style={{ fontWeight: 700, color: PRIMARY }}>
                      PFR broj:{" "}
                    </span>
                    {racun.br_fiskalnog}
                  </div>
                )}
              {formatDatumVrijeme(racun.datum_vreme_fiskalnog) && (
                <div style={{ marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, color: PRIMARY }}>
                    PFR datum:{" "}
                  </span>
                  {formatDatumVrijeme(racun.datum_vreme_fiskalnog)}
                </div>
              )}
            </div>

            {racun.verifikacioni_qr && (
              <img
                src={`data:image/gif;base64,${racun.verifikacioni_qr}`}
                alt="QR kod za verifikaciju"
                style={{ width: 140, height: 140, flexShrink: 0 }}
              />
            )}
          </div>
        </div>

        <div style={{ borderTop: `2px solid ${PRIMARY}`, marginBottom: 12 }} />

        {/* ── Tabela stavki ── */}
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: PRIMARY }}>
                {[
                  { label: "Artikal", right: false, w: "31%" },
                  { label: "JM", right: false, w: "5%" },
                  { label: "Kol.", right: true, w: "7%" },
                  { label: "VPC", right: true, w: "8%" },
                  { label: "VPC 1 / Rab.1", right: true, w: "9%" },
                  { label: "VPC 2 / Rab.2", right: true, w: "9%" },
                  { label: "Osnova", right: true, w: "9%" },
                  { label: "Vrijednost", right: true, w: "9%" },
                  { label: "PDV", right: true, w: "7%" },
                  { label: "Ukupno", right: true, w: "9%" },
                ].map(({ label, right, w }) => (
                  <th
                    key={label}
                    style={{
                      color: "white",
                      fontWeight: 700,
                      fontSize: 9,
                      padding: "4px 4px",
                      textAlign: right ? "right" : "left",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                      width: w,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stavke.map((s, i) => (
                <tr
                  key={`${s.sifra_proizvoda}-${i}`}
                  style={{ background: i % 2 === 0 ? "#f2f2f2" : "white" }}
                >
                  <td style={{ ...cell, fontWeight: 600, color: PRIMARY }}>
                    {s.naziv_proizvoda}
                  </td>
                  <td style={cell}>{s.jm}</td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {Number(s.kolicina).toLocaleString("bs-BA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 3,
                    })}
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {broj(s.vpc)}
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {broj(s.vpc1)}
                    <div style={{ fontSize: 9, color: "#888" }}>
                      {broj(s.rab1)}%
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {broj(s.vpc2)}
                    <div style={{ fontSize: 9, color: "#888" }}>
                      {broj(s.rab2)}%
                    </div>
                  </td>
                  <td
                    style={{
                      ...cell,
                      textAlign: "right",
                      fontWeight: 700,
                      color: PRIMARY,
                    }}
                  >
                    {broj(s.osnova)}
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {broj(s.vrednost)}
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {broj(s.pdv)}
                  </td>
                  <td
                    style={{
                      ...cell,
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: 13,
                      color: "#000",
                      background: "#e3e3e3",
                    }}
                  >
                    {broj(s.ukupno)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Dno: slovima/napomena/fiskalni podaci (lijevo) + rekapitulacija (desno) ── */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {racun.slovima && (
              <div style={{ fontSize: 11, color: "#444", fontStyle: "italic" }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: PRIMARY,
                    fontStyle: "normal",
                    textTransform: "uppercase",
                    fontSize: 10,
                    letterSpacing: "0.06em",
                  }}
                >
                  Slovima:{" "}
                </span>
                {racun.slovima}
              </div>
            )}

            <div style={{ display: "flex", gap: 5, alignItems: "stretch" }}>
              <div
                style={{
                  flex: 6,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  border: "1px solid #999",
                  borderRadius: 6,
                  paddingTop: 2,
                  paddingLeft: 5,
                  paddingRight: 12,
                  paddingBottom: 9,
                  minHeight: 90,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: ACCENT,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "left",
                  }}
                >
                  Napomena:
                </div>
                {racun.napomena && (
                  <div
                    style={{
                      fontSize: 13,
                      color: "#222",
                      fontWeight: 600,
                      whiteSpace: "pre-line",
                      marginTop: 4,
                    }}
                  >
                    {racun.napomena}
                  </div>
                )}
              </div>

              {/* SALDO na dan — cifra dinamički skalirana (font-size, ne
                  transform) da maksimalno ispuni širinu okvira bez deformacije. */}
              <div
                style={{
                  flex: 4,
                  boxSizing: "border-box",
                  background: "#ffffff",
                  border: "1px solid #999",
                  borderRadius: 6,
                  paddingTop: 2,
                  paddingLeft: 5,
                  paddingRight: 12,
                  paddingBottom: 9,
                  minHeight: 90,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: ACCENT,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "left",
                  }}
                >
                  SALDO NA DAN {formatDatum(new Date().toISOString())}:
                </div>
                {racun.dug_partnera !== undefined &&
                  racun.dug_partnera !== null && (
                    <div ref={saldoWrapRef} style={{ marginTop: 4 }}>
                      <span
                        style={{
                          display: "inline-block",
                          color: "#000",
                          fontWeight: 800,
                          fontSize: saldoFontSize,
                          lineHeight: 1,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {broj(racun.dug_partnera)} KM
                      </span>
                    </div>
                  )}
              </div>

              {/* Barkod (šifra tabele) — vraćen iz zaglavlja, sada u dnu pored napomene,
                  okrenut uspravno (rotate -90°) tako da tekst (koji je kod
                  horizontalnog barkoda ispod) završi uz desnu ivicu, odn. uz
                  lijevu ivicu rekapitulacije. */}
              <div
                style={{
                  flexShrink: 0,
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {racun.sifra_tabele !== undefined &&
                  racun.sifra_tabele !== null &&
                  racun.sifra_tabele !== "" && (
                    <div
                      style={{
                        width: barkodDim ? barkodDim.h : undefined,
                        height: barkodDim ? barkodDim.w : undefined,
                        position: "relative",
                      }}
                    >
                      <canvas
                        ref={barkodRef}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          transformOrigin: "top left",
                          transform: "rotate(-90deg) translateX(-100%)",
                        }}
                      />
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div style={{ width: "62mm", flexShrink: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <tbody>
                {[
                  { label: "Vrijednost", value: rVrednost },
                  { label: "Rabat 1", value: rRab1 },
                  { label: "Rabat 2", value: rRab2 },
                  { label: "Osnova", value: rOsnova },
                  { label: "PDV (17%)", value: rPdv },
                ].map(({ label, value }, i, arr) => {
                  const padding = i === arr.length - 1 ? "2px 0 4px" : "2px 0";
                  return (
                    <tr key={label}>
                      <td style={{ padding, color: "#666" }}>{label}</td>
                      <td style={{ padding, textAlign: "right", color: "#333" }}>
                        {broj(value)} KM
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: `2px solid ${PRIMARY}` }}>
                  <td
                    style={{
                      padding: "5px 0 0",
                      fontWeight: 800,
                      fontSize: 13,
                      color: "#333",
                    }}
                  >
                    Ukupno sa PDV
                  </td>
                  <td
                    style={{
                      padding: "5px 0 0",
                      textAlign: "right",
                      fontWeight: 800,
                      fontSize: 14,
                      color: ACCENT,
                    }}
                  >
                    {broj(rUkupno)} KM
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Potpisi: red 1 - naslovi, red 2 - linije, red 3 - M.P. na sredini ── */}
        <div style={{ marginTop: 40 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div
              style={{
                width: "35%",
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                color: PRIMARY,
              }}
            >
              Fakturisao
            </div>
            <div
              style={{
                width: "35%",
                textAlign: "center",
                fontSize: 11,
                fontWeight: 700,
                color: PRIMARY,
              }}
            >
              Racun primio
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 28,
            }}
          >
            <div style={{ width: "35%", borderTop: "1px solid #333" }} />
            <div style={{ width: "35%", borderTop: "1px solid #333" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div
              style={{
                width: "35%",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#444",
                marginTop: 6,
              }}
            >
              M.P.
            </div>
            <div
              style={{
                width: "35%",
                textAlign: "center",
                fontSize: 12,
                fontWeight: 700,
                color: "#444",
                marginTop: 6,
              }}
            >
              M.P.
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer (podnožje firme) ── */}
      <img
        src={`${import.meta.env.BASE_URL}foto/MEMORANDUM_1.jpg`}
        alt="Footer"
        style={{
          display: "block",
          width: "calc(100% - 18px)",
          marginTop: "10px",
          marginLeft: "9px",
          marginRight: "9px",
        }}
      />
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "4px 4px",
  fontSize: 12,
  borderBottom: "1px solid #dddddd",
  verticalAlign: "middle",
};
