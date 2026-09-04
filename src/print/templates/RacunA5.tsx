import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// Monohromatska (crno-bijela) paleta — nazivi PRIMARY/ACCENT su zadržani (koriste
// se posvuda u fajlu preko alfa-suffiksa, npr. `${PRIMARY}30`) da se ne bi morala
// mijenjati svaka pojedinačna upotreba.
const PRIMARY = "#000000";
const ACCENT = "#595959";

// Sjedište firme — fiksno, ide u "Mjesto izdavanja" na svakom gotovinskom računu
// (ista vrijednost kao na žiralnom, vidi RacunA4.tsx).
const MJESTO_IZDAVANJA = "Ložionička bb, 78000 Banja Luka";

export interface RacunA5Zaglavlje {
  broj_racuna: string;
  datum_racuna: string;
  naziv_partnera: string;
  sifra_partnera: string | number;
  adresa_partnera?: string | null;
  naziv_grada?: string | null;
  napomena?: string | null;
  osnova_za_obracun_pdv?: number | string | null;
  pdv?: number | string | null;
  ukupno: number | string;
  rabat_km?: number | string | null;
  slovima?: string | null;
  br_fiskalnog?: string | number | null;
  // Datum i vrijeme fiskalizacije (ESIR invoiceResponse.sdcDateTime).
  datum_vreme_fiskalnog?: string | null;
  // Base64 GIF slika QR koda (ESIR invoiceResponse.verificationQRCode) — samo
  // za fiskalizovane račune.
  verifikacioni_qr?: string | null;
  // Šifra tabele (interni ključ zapisa) — kodira se u barkod 128 radi kasnijeg
  // skeniranja u modulu za praćenje kretanja dokumenata.
  sifra_tabele?: number | string | null;
}

export interface RacunA5Stavka {
  sifra_proizvoda: string | number;
  naziv_proizvoda: string;
  jm: string;
  kolicina: number | string;
  prodajna_cijena: number | string;
  prodajna_vrednost: number | string;
}

interface Props {
  racun: RacunA5Zaglavlje;
  stavke: RacunA5Stavka[];
}

function formatDatum(dt: string) {
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

export function RacunA5({ racun, stavke }: Props) {
  const ukupno = Number(racun.ukupno) || 0;
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
      height: 32,
      displayValue: true,
      fontSize: 10,
      margin: 0,
    });
  }, [racun.sifra_tabele]);

  return (
    <div
      style={{
        width: "148mm",
        minHeight: "210mm",
        position: "relative",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        fontSize: 11,
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
          width: "calc(100% - 10px)",
          marginTop: "10px",
          marginLeft: "5px",
          marginRight: "5px",
          filter: "grayscale(100%)",
        }}
      />

      <div
        style={{
          padding: "8mm 10mm",
          boxSizing: "border-box",
        }}
      >
        {/* ── Header: lijevo 50% (partner + broj računa) | vertikalna linija |
            desno 50% (datum + PFR broj + QR) — ista šema kao na A4/žiralnom. ── */}
        <div style={{ display: "flex", alignItems: "stretch", marginBottom: 12 }}>
          {/* Lijevo 30% — partner + broj računa */}
          <div style={{ width: "30%", boxSizing: "border-box", paddingRight: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: PRIMARY }}>
              {racun.naziv_partnera}
            </div>
            <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
              Šifra partnera: {racun.sifra_partnera}
            </div>
            {(racun.adresa_partnera || racun.naziv_grada) && (
              <div style={{ fontSize: 9, color: "#444", marginTop: 1 }}>
                {[racun.adresa_partnera, racun.naziv_grada]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}

            <div style={{ fontSize: 16, fontWeight: 800, color: PRIMARY, marginTop: 12 }}>
              {racun.broj_racuna}
            </div>
          </div>

          {/* Vertikalna linija */}
          <div style={{ width: 0, borderLeft: `2px solid ${PRIMARY}`, margin: "0 12px" }} />

          {/* Desno 70% — datum + PFR broj (lijevo) i QR kod (desno) */}
          <div
            style={{
              width: "70%",
              boxSizing: "border-box",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 9, color: "#444" }}>
              <div style={{ marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: PRIMARY }}>
                  Datum izdavanja:{" "}
                </span>
                {formatDatum(racun.datum_racuna)}
              </div>
              <div style={{ marginBottom: 3 }}>
                <span style={{ fontWeight: 700, color: PRIMARY }}>
                  Mjesto izdavanja:{" "}
                </span>
                {MJESTO_IZDAVANJA}
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
      <div style={{ marginBottom: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: PRIMARY }}>
              {[
                { label: "Artikal", right: false, w: "43.3%" },
                { label: "JM", right: true, w: "5%" },
                { label: "Količina", right: true, w: "10%" },
                { label: "Cijena (KM)", right: true, w: "11.7%" },
                { label: "Ukupno (KM)", right: true, w: "18%" },
              ].map(({ label, right, w }) => (
                <th
                  key={label}
                  style={{
                    color: "white",
                    fontWeight: 700,
                    fontSize: 7,
                    padding: "4px 6px",
                    textAlign: right ? "right" : "left",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
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
                <td style={{ ...cell, textAlign: "right" }}>{s.jm}</td>
                <td style={{ ...cell, textAlign: "right", paddingRight: 2 }}>
                  {Number(s.kolicina).toLocaleString("bs-BA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td style={{ ...cell, textAlign: "right", paddingLeft: 2 }}>
                  {broj(s.prodajna_cijena)}
                </td>
                <td
                  style={{
                    ...cell,
                    textAlign: "right",
                    fontWeight: 700,
                    color: ACCENT,
                  }}
                >
                  {broj(s.prodajna_vrednost)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: `2px solid ${PRIMARY}` }}>
              <td
                colSpan={5}
                style={{
                  ...cell,
                  fontWeight: 800,
                  textAlign: "right",
                  color: PRIMARY,
                }}
              >
                <span style={{ fontSize: 18, marginRight: 12 }}>UKUPNO:</span>
                <span style={{ fontSize: 18 }}>
                  {ukupno.toLocaleString("bs-BA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  KM
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Napomena (okvir uvijek prikazan) + barkod (šifra tabele, pozicioniran desno) ── */}
      <div style={{ display: "flex", gap: 5, alignItems: "stretch", marginBottom: 14 }}>
        <div
          style={{
            flex: 1,
            boxSizing: "border-box",
            background: "#ffffff",
            border: "1px solid #999",
            borderRadius: 6,
            padding: "7px 10px",
          }}
        >
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: ACCENT,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Napomena:
          </div>
          {racun.napomena && (
            <div
              style={{
                fontSize: 9,
                color: "#444",
                fontStyle: "italic",
                marginTop: 3,
              }}
            >
              {racun.napomena}
            </div>
          )}
        </div>

        {racun.sifra_tabele !== undefined &&
          racun.sifra_tabele !== null &&
          racun.sifra_tabele !== "" && (
            <div
              style={{
                flexShrink: 0,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <canvas ref={barkodRef} />
            </div>
          )}
      </div>
      </div>

      {/* ── Footer — fiksiran na dnu stranice (zadnja 2cm), centriran,
          bez obzira na dužinu sadržaja iznad. ── */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: "2cm",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: "85%",
            height: 2,
            background: `linear-gradient(to right, transparent, ${PRIMARY}, transparent)`,
          }}
        />
        <span style={{ fontSize: 9, fontWeight: 600, color: "#444" }}>
          www.karpasambalaze.com
        </span>
      </div>
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "4px 6px",
  fontSize: 9,
  borderBottom: "1px solid #ccc",
  verticalAlign: "middle",
};
