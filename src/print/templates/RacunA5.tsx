const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

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
  // Base64 GIF slika QR koda (ESIR invoiceResponse.verificationQRCode) — samo
  // za fiskalizovane račune.
  verifikacioni_qr?: string | null;
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

function broj(v: number | string | null | undefined) {
  const n = Number(v);
  return isNaN(n) ? "0.00" : n.toFixed(2);
}

export function RacunA5({ racun, stavke }: Props) {
  const ukupno = Number(racun.ukupno) || 0;

  return (
    <div
      style={{
        width: "148mm",
        minHeight: "210mm",
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
        }}
      />

      <div
        style={{
          padding: "8mm 10mm",
          boxSizing: "border-box",
        }}
      >
        {/* ── Zaglavlje dokumenta ── */}
        <div
          style={{
            textAlign: "center",
            borderBottom: `2px solid ${PRIMARY}`,
            paddingBottom: 8,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: PRIMARY,
              letterSpacing: "normal",
            }}
          >
            {racun.broj_racuna}
          </div>
          <div style={{ fontSize: 9, color: "#666", marginTop: 3 }}>
            Datum izdavanja: {formatDatum(racun.datum_racuna)}
          </div>
        </div>

        {/* ── Podaci o partneru ── */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            background: `${PRIMARY}0a`,
            border: `1px solid ${PRIMARY}30`,
            borderRadius: 6,
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>
            {racun.naziv_partnera}
          </div>
          <div style={{ fontSize: 8, color: "#666", marginTop: 2 }}>
            Šifra partnera: {racun.sifra_partnera}
          </div>
          {(racun.adresa_partnera || racun.naziv_grada) && (
            <div style={{ fontSize: 8, color: "#666", marginTop: 1 }}>
              {[racun.adresa_partnera, racun.naziv_grada]
                .filter(Boolean)
                .join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabela stavki ── */}
      <div style={{ marginBottom: 14 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: PRIMARY }}>
              {[
                { label: "#", right: false, w: "4%" },
                { label: "Artikal", right: false, w: "25%" },
                { label: "JM", right: false, w: "9%" },
                { label: "Količina", right: true, w: "14%" },
                { label: "Cijena (KM)", right: true, w: "18%" },
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
                style={{ background: i % 2 === 0 ? "#f4f1f9" : "white" }}
              >
                <td style={cell}>{i + 1}</td>
                <td style={{ ...cell, fontWeight: 600, color: PRIMARY }}>
                  {s.naziv_proizvoda}
                </td>
                <td style={cell}>{s.jm}</td>
                <td style={{ ...cell, textAlign: "right" }}>
                  {Number(s.kolicina).toLocaleString("bs-BA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
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
                  fontWeight: 700,
                  fontSize: 10,
                  textAlign: "right",
                  color: "#333",
                }}
              >
                UKUPNO:
              </td>
              <td
                style={{
                  ...cell,
                  fontWeight: 800,
                  fontSize: 12,
                  textAlign: "right",
                  color: ACCENT,
                }}
              >
                {ukupno.toLocaleString("bs-BA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                KM
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Broj fiskalnog računa + QR kod za verifikaciju ── */}
      {racun.br_fiskalnog !== undefined &&
        racun.br_fiskalnog !== null &&
        racun.br_fiskalnog !== "" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <div style={{ fontSize: 9, color: "#444" }}>
              <span style={{ fontWeight: 700, color: PRIMARY }}>
                Br. fiskalnog računa:{" "}
              </span>
              {racun.br_fiskalnog}
            </div>
            {racun.verifikacioni_qr && (
              <img
                src={`data:image/gif;base64,${racun.verifikacioni_qr}`}
                alt="QR kod za verifikaciju"
                style={{ width: 60, height: 60, flexShrink: 0 }}
              />
            )}
          </div>
        )}

      {/* ── Napomena ── */}
      {racun.napomena && (
        <div
          style={{
            background: `${ACCENT}0d`,
            border: `1px solid ${ACCENT}40`,
            borderRadius: 6,
            padding: "7px 10px",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: ACCENT,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Napomena:{" "}
          </span>
          <span style={{ fontSize: 9, color: "#444", fontStyle: "italic" }}>
            {racun.napomena}
          </span>
        </div>
      )}
      </div>
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "4px 6px",
  fontSize: 9,
  borderBottom: "1px solid #ede8f6",
  verticalAlign: "middle",
};
