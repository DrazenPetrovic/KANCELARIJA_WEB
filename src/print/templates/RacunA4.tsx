import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

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
  // Base64 GIF slika QR koda (ESIR invoiceResponse.verificationQRCode) — samo
  // za fiskalizovane račune.
  verifikacioni_qr?: string | null;
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
      height: 34,
      displayValue: true,
      fontSize: 10,
      margin: 0,
    });
  }, [racun.sifra_tabele]);

  // Rekapitulacija — sve u KM, sabrano preko svih stavki.
  const rVrednost = stavke.reduce(
    (s, r) => s + brojN(r.vpc) * brojN(r.kolicina),
    0,
  );
  const rRab1 = stavke.reduce(
    (s, r) => s + (brojN(r.vpc) - brojN(r.osnova)) * brojN(r.kolicina),
    0,
  );
  const rRab2 = stavke.reduce(
    (s, r) => s + (brojN(r.vpc1) - brojN(r.vpc2)) * brojN(r.kolicina),
    0,
  );
  const rRab3 = stavke.reduce(
    (s, r) => s + (brojN(r.vpc2) - brojN(r.vpc3)) * brojN(r.kolicina),
    0,
  );
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
        {/* ── Osnovni podaci (partner + PJ lijevo, datumi desno) ── */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 24,
            marginBottom: 10,
          }}
        >
          {/* Lijevo — partner (+ poslovna jedinica) */}
          <div style={{ flex: 1 }}>
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
          </div>

          {/* Desno — datumi */}
          <div style={{ flex: 1, fontSize: 11, color: "#444" }}>
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
            <div>
              <span style={{ fontWeight: 700, color: PRIMARY }}>
                Datum isporuke:{" "}
              </span>
              {formatDatum(racun.datum_isporuke)}
            </div>
          </div>
        </div>

        <div style={{ borderTop: `2px solid ${PRIMARY}`, marginBottom: 10 }} />

        {/* ── Broj računa/otpremnice + barkod (šifra tabele) ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: PRIMARY }}>
            Račun/Otpremnica: {racun.broj_racuna}
          </div>
          {racun.sifra_tabele !== undefined &&
            racun.sifra_tabele !== null &&
            racun.sifra_tabele !== "" && (
              <canvas ref={barkodRef} style={{ flexShrink: 0 }} />
            )}
        </div>

        <div style={{ borderTop: `2px solid ${PRIMARY}`, marginBottom: 12 }} />

        {/* ── Tabela stavki ── */}
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: PRIMARY }}>
                {[
                  { label: "Artikal", right: false, w: "22%" },
                  { label: "JM", right: false, w: "5%" },
                  { label: "Kol.", right: true, w: "7%" },
                  { label: "VPC", right: true, w: "8%" },
                  { label: "VPC 1 / Rab.1", right: true, w: "9%" },
                  { label: "VPC 2 / Rab.2", right: true, w: "9%" },
                  { label: "VPC 3 / Rab.3", right: true, w: "9%" },
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
                      fontSize: 8,
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
                  style={{ background: i % 2 === 0 ? "#f4f1f9" : "white" }}
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
                    <div style={{ fontSize: 8, color: "#888" }}>
                      {broj(s.rab1)}%
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {broj(s.vpc2)}
                    <div style={{ fontSize: 8, color: "#888" }}>
                      {broj(s.rab2)}%
                    </div>
                  </td>
                  <td style={{ ...cell, textAlign: "right" }}>
                    {broj(s.vpc3)}
                    <div style={{ fontSize: 8, color: "#888" }}>
                      {broj(s.rab3)}%
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
                      fontSize: 11,
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
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20 }}>
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

            {racun.napomena && (
              <div
                style={{
                  background: `${ACCENT}0d`,
                  border: `1px solid ${ACCENT}40`,
                  borderRadius: 6,
                  padding: "7px 10px",
                }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: ACCENT,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                  }}
                >
                  Napomena:{" "}
                </span>
                <span style={{ fontSize: 10, color: "#444", fontStyle: "italic" }}>
                  {racun.napomena}
                </span>
              </div>
            )}

            {racun.br_fiskalnog !== undefined &&
              racun.br_fiskalnog !== null &&
              racun.br_fiskalnog !== "" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {racun.verifikacioni_qr && (
                    <img
                      src={`data:image/gif;base64,${racun.verifikacioni_qr}`}
                      alt="QR kod za verifikaciju"
                      style={{ width: 60, height: 60, flexShrink: 0 }}
                    />
                  )}
                  <div style={{ fontSize: 10, color: "#444" }}>
                    <span style={{ fontWeight: 700, color: PRIMARY }}>
                      Br. fiskalnog računa:{" "}
                    </span>
                    {racun.br_fiskalnog}
                  </div>
                </div>
              )}
          </div>

          <div style={{ width: "62mm", flexShrink: 0 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <tbody>
                {[
                  { label: "Vrijednost", value: rVrednost },
                  { label: "Rabat 1", value: rRab1 },
                  { label: "Rabat 2", value: rRab2 },
                  { label: "Rabat 3", value: rRab3 },
                  { label: "Osnova", value: rOsnova },
                  { label: "PDV", value: rPdv },
                ].map(({ label, value }) => (
                  <tr key={label}>
                    <td style={{ padding: "2px 0", color: "#666" }}>{label}</td>
                    <td style={{ padding: "2px 0", textAlign: "right", color: "#333" }}>
                      {broj(value)} KM
                    </td>
                  </tr>
                ))}
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
      </div>
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "4px 4px",
  fontSize: 10,
  borderBottom: "1px solid #ede8f6",
  verticalAlign: "middle",
};
