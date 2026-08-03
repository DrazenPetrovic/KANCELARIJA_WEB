import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

// Štampač je mrežni monochrome (crno-bijeli) — boje se pretvaraju u blijedi
// sivi raster i slabo se vide na papiru (isti razlog kao u RacunA4.tsx), pa su
// obje "boje" ovdje čisto crne. Nazivi su zadržani (PRIMARY/ACCENT) da se ne
// mijenja ostatak fajla — MP/VP grupe se razlikuju preko naslova iznad svake
// tabele, ne boje.
const PRIMARY = "#000000";
const ACCENT = "#000000";

// Isti barkod (CODE128 preko sifra_tabele) kao na RacunA4/RacunA5 — ovdje jedan
// po redu MP tabele, pa svaki red ima svoj <canvas> i sopstveni useEffect.
// Canvas je stretchovan na 100% širine ćelije (kolona joj daje najviše prostora
// koliko ima između Radnik i Ukupno) da bude dovoljno velik za skeniranje.
function BarkodCelija({ vrijednost }: { vrijednost: number | string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, String(vrijednost), {
      format: "CODE128",
      width: 2,
      height: 22,
      displayValue: false,
      margin: 0,
    });
  }, [vrijednost]);

  return <canvas ref={ref} style={{ width: "100%" }} />;
}

function formatDatumStampe(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function broj(v: number | string | null | undefined) {
  const n = Number(v);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

// Naziv radnika dolazi u formatu "Prezime Ime" (vidi sp_partneri_pregled_komercijalista) —
// za štampu se skraćuje na "Prezime I." da stane u usku kolonu.
function formatRadnik(naziv: string) {
  const dijelovi = naziv.trim().split(/\s+/);
  if (dijelovi.length < 2) return naziv.trim();
  const prezime = dijelovi[0];
  const inicijal = dijelovi[1].charAt(0).toUpperCase();
  return `${prezime} ${inicijal}.`;
}

export interface IzvjestajTerenRed {
  sifra_tabele: number | string;
  broj_racuna_prikaz: string;
  naziv_partnera: string;
  ukupno: number | string;
  napomena?: string | null;
  radnik?: string | null;
  // true -> MP (gotovinski), false/nedostaje -> VP (žiralni) — MP tabela ide
  // prva, kompletnija (partner/napomena/radnik/ukupno/naplaćeno); VP tabela je
  // svedena na minimum (broj računa, partner, O/P kućice) da stane na stranicu.
  jeMp?: boolean;
}

interface Props {
  terenLabel: string;
  redovi: IzvjestajTerenRed[];
}

// Zajednički stil ćelije — kompaktan (mali vertikalni padding) da što više
// redova stane na jednu A4 stranicu.
const cell: React.CSSProperties = {
  padding: "2px 3px",
  fontSize: 12,
  borderBottom: "1px solid #dddddd",
  verticalAlign: "middle",
};

const nazivGrupe: React.CSSProperties = {
  background: PRIMARY,
  color: "white",
  fontWeight: 700,
  fontSize: 10,
  padding: "2px 3px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const zaglavljeCelije: React.CSSProperties = {
  color: PRIMARY,
  fontWeight: 700,
  fontSize: 9,
  padding: "3px 3px",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: `1px solid ${PRIMARY}`,
};

export function IzvjestajTerenA4({ terenLabel, redovi }: Props) {
  const datumStampe = formatDatumStampe(new Date());
  const mpRedovi = redovi.filter((r) => r.jeMp);
  const vpRedovi = redovi.filter((r) => !r.jeMp);
  const ukupnoMp = mpRedovi.reduce((s, r) => s + (Number(r.ukupno) || 0), 0);
  const ukupnoVp = vpRedovi.reduce((s, r) => s + (Number(r.ukupno) || 0), 0);
  const ukupnoSvi = ukupnoMp + ukupnoVp;

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: 10,
        color: "#1a1a1a",
        padding: "8mm 3mm",
        boxSizing: "border-box",
      }}
    >
      {/* Dokument header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: `3px solid ${PRIMARY}`,
          paddingBottom: 6,
          marginBottom: 8,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>
            Karpas Ambalaže
          </div>
          <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
            Kancelarija — sistem za upravljanje
          </div>
        </div>

        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: PRIMARY }}>
            MP: {mpRedovi.length} ({broj(ukupnoMp)} KM)
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: ACCENT,
              marginTop: 3,
            }}
          >
            VP: {vpRedovi.length} ({broj(ukupnoVp)} KM)
          </div>
        </div>

        <div style={{ flex: 1, textAlign: "right" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: PRIMARY,
              textTransform: "uppercase",
            }}
          >
            Izvještaj teren — {terenLabel}
          </div>
          <div style={{ fontSize: 9, color: "#999", marginTop: 4 }}>
            Datum štampe: {datumStampe}
          </div>
        </div>
      </div>

      {redovi.length === 0 ? (
        <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>
          Nema računa za štampu
        </div>
      ) : (
        <>
          {/* ── MP tabela — Broj računa, Partner (+ napomena u istom redu),
              Radnik, Ukupno, Naplaćeno (prazno, vozač upisuje) ── */}
          {mpRedovi.length > 0 && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
                marginBottom: 10,
              }}
            >
              <colgroup>
                <col style={{ width: "12%" }} />
                <col style={{ width: "40%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "7%" }} />
              </colgroup>
              <thead>
                <tr>
                  <td colSpan={6} style={nazivGrupe}>
                    MP RAČUNI ({mpRedovi.length})
                  </td>
                </tr>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={zaglavljeCelije}>Broj računa</th>
                  <th style={zaglavljeCelije}>Partner / Napomena</th>
                  <th style={zaglavljeCelije}>Radnik</th>
                  <th style={{ ...zaglavljeCelije, textAlign: "center" }}>
                    Barkod
                  </th>
                  <th style={{ ...zaglavljeCelije, textAlign: "right" }}>
                    Ukupno
                  </th>
                  <th style={zaglavljeCelije}>Napl:</th>
                </tr>
              </thead>
              <tbody>
                {mpRedovi.map((red, i) => (
                  <tr
                    key={`${red.sifra_tabele}-${i}`}
                    style={{ background: i % 2 === 0 ? "#f2f2f2" : "white" }}
                  >
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>
                      {red.broj_racuna_prikaz}
                    </td>
                    <td style={{ ...cell, wordBreak: "break-word" }}>
                      <span style={{ fontWeight: 600 }}>
                        {red.naziv_partnera}
                      </span>
                      {red.napomena?.trim() && (
                        <span style={{ fontStyle: "italic", color: "#666" }}>
                          {" "}
                          — {red.napomena.trim()}
                        </span>
                      )}
                    </td>
                    <td style={{ ...cell, wordBreak: "break-word" }}>
                      {red.radnik?.trim() ? formatRadnik(red.radnik) : "—"}
                    </td>
                    <td style={{ ...cell, textAlign: "center" }}>
                      <BarkodCelija vrijednost={red.sifra_tabele} />
                    </td>
                    <td
                      style={{ ...cell, textAlign: "right", fontWeight: 600 }}
                    >
                      {broj(red.ukupno)}
                    </td>
                    {/* Prazno — vozač ovdje rukom upisuje stvarno naplaćen iznos */}
                    <td style={{ ...cell, borderLeft: "1px dashed #ccc" }} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      ...cell,
                      fontWeight: 700,
                      textAlign: "right",
                      borderTop: `1px solid ${PRIMARY}`,
                      borderBottom: "none",
                    }}
                  >
                    Ukupno MP
                  </td>
                  <td
                    style={{
                      ...cell,
                      fontWeight: 700,
                      textAlign: "right",
                      borderTop: `1px solid ${PRIMARY}`,
                      borderBottom: "none",
                    }}
                  >
                    {broj(ukupnoMp)}
                  </td>
                  <td
                    style={{
                      ...cell,
                      borderTop: `1px solid ${PRIMARY}`,
                      borderBottom: "none",
                    }}
                  />
                </tr>
              </tfoot>
            </table>
          )}

          {/* ── VP tabela — svedeno na minimum: Broj računa, Naziv partnera,
              i dvije uske kućice (O / P) gdje operater upiše "x" u jednu ── */}
          {vpRedovi.length > 0 && (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                tableLayout: "fixed",
              }}
            >
              <colgroup>
                <col style={{ width: "18%" }} />
                <col style={{ width: "66%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "8%" }} />
              </colgroup>
              <thead>
                <tr>
                  <td colSpan={4} style={nazivGrupe}>
                    VP RAČUNI ({vpRedovi.length})
                  </td>
                </tr>
                <tr style={{ background: "#f0f0f0" }}>
                  <th style={zaglavljeCelije}>Broj računa</th>
                  <th style={zaglavljeCelije}>Naziv partnera</th>
                  <th style={{ ...zaglavljeCelije, textAlign: "center" }}>
                    O
                  </th>
                  <th style={{ ...zaglavljeCelije, textAlign: "center" }}>
                    P
                  </th>
                </tr>
              </thead>
              <tbody>
                {vpRedovi.map((red, i) => (
                  <tr
                    key={`${red.sifra_tabele}-${i}`}
                    style={{ background: i % 2 === 0 ? "#f2f2f2" : "white" }}
                  >
                    <td style={{ ...cell, whiteSpace: "nowrap" }}>
                      {red.broj_racuna_prikaz}
                    </td>
                    <td style={{ ...cell, wordBreak: "break-word" }}>
                      {red.naziv_partnera}
                    </td>
                    <td
                      style={{
                        ...cell,
                        textAlign: "center",
                        borderLeft: "1px dashed #ccc",
                      }}
                    />
                    <td
                      style={{
                        ...cell,
                        textAlign: "center",
                        borderLeft: "1px dashed #ccc",
                      }}
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div
            style={{
              textAlign: "right",
              fontWeight: 800,
              fontSize: 12,
              color: PRIMARY,
              marginTop: 8,
              paddingTop: 4,
              borderTop: `2px solid ${PRIMARY}`,
            }}
          >
            UKUPNO SVE: {broj(ukupnoSvi)} KM
          </div>
        </>
      )}

      <div
        style={{
          marginTop: 10,
          paddingTop: 4,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "#aaa",
        }}
      >
        <span>Karpas Ambalaže — Kancelarija</span>
        <span>{datumStampe}</span>
      </div>
    </div>
  );
}
