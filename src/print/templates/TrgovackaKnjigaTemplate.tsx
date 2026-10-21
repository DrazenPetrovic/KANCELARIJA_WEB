// Štampa trgovačke knjige (veleprodaja/maloprodaja) na A4 sa memorandumom.
// Štampač je monochrome, pa je sve crno (vidi LagerListaTemplate).
const PRIMARY = "#000000";

// Isti oblik reda kao TrgovackaKnjigaRed u TrgovackaKnjigaVeleprodaja.tsx (nema
// zajedničkog tipova fajla, pa se ovdje ponavlja minimalni presjek polja).
export interface TrgovackaKnjigaStampaRed {
  rb: number;
  datum: string;
  broj_racuna: string | number;
  podaci_o_partneru: string | null;
  zaduzenje: number | string | null;
  razduzenje: number | string | null;
  rabat: number | string | null;
}

interface Props {
  naslov: string;
  datumOd?: string | null;
  datumDo?: string | null;
  redovi: TrgovackaKnjigaStampaRed[];
}

const formatBroj = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const formatDatumDMY = (v: string | null | undefined): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

export function TrgovackaKnjigaTemplate({
  naslov,
  datumOd,
  datumDo,
  redovi,
}: Props) {
  const datumStampe = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const ukupnoZaduzenje = redovi.reduce(
    (s, r) => s + Number(r.zaduzenje || 0),
    0,
  );
  const ukupnoRazduzenje = redovi.reduce(
    (s, r) => s + Number(r.razduzenje || 0),
    0,
  );
  const ukupnoRabat = redovi.reduce((s, r) => s + Number(r.rabat || 0), 0);

  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        color: "#1a1a1a",
        background: "white",
      }}
    >
      {/* Memorandum (zaglavlje firme) */}
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

      <div style={{ padding: "6mm 10mm", boxSizing: "border-box" }}>
        {/* Naslov + period */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderBottom: `2px solid ${PRIMARY}`,
            paddingBottom: 6,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {naslov}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>
              Period: {formatDatumDMY(datumOd)} — {formatDatumDMY(datumDo)}
            </div>
            <div style={{ fontSize: 8, color: "#666", marginTop: 2 }}>
              Datum štampe: {datumStampe} · Broj stavki: {redovi.length}
            </div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: PRIMARY }}>
              <th style={{ ...thStyle, textAlign: "right", width: "5%" }}>
                RB
              </th>
              <th style={{ ...thStyle, width: "10%" }}>Datum</th>
              <th style={{ ...thStyle, width: "13%" }}>Broj računa</th>
              <th style={{ ...thStyle }}>Partner</th>
              <th style={{ ...thStyle, textAlign: "right", width: "13%" }}>
                Zaduženje
              </th>
              <th style={{ ...thStyle, textAlign: "right", width: "13%" }}>
                Razduženje
              </th>
              <th style={{ ...thStyle, textAlign: "right", width: "11%" }}>
                Rabat
              </th>
            </tr>
          </thead>
          <tbody>
            {redovi.map((r) => (
              <tr key={r.rb}>
                <td style={{ ...cellStyle, textAlign: "right", color: "#666" }}>
                  {r.rb}
                </td>
                <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                  {formatDatumDMY(r.datum)}
                </td>
                <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                  {r.broj_racuna}
                </td>
                <td style={cellStyle}>{r.podaci_o_partneru ?? "—"}</td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {Number(r.zaduzenje) ? formatBroj(r.zaduzenje) : ""}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {Number(r.razduzenje) ? formatBroj(r.razduzenje) : ""}
                </td>
                <td style={{ ...cellStyle, textAlign: "right" }}>
                  {Number(r.rabat) ? formatBroj(r.rabat) : ""}
                </td>
              </tr>
            ))}
          </tbody>
          {redovi.length > 0 && (
            <tfoot>
              <tr>
                <td style={footStyle} colSpan={4}>
                  Ukupno
                </td>
                <td style={{ ...footStyle, textAlign: "right" }}>
                  {formatBroj(ukupnoZaduzenje)}
                </td>
                <td style={{ ...footStyle, textAlign: "right" }}>
                  {formatBroj(ukupnoRazduzenje)}
                </td>
                <td style={{ ...footStyle, textAlign: "right" }}>
                  {formatBroj(ukupnoRabat)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {redovi.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "#888",
              padding: 30,
              fontSize: 11,
            }}
          >
            Nema podataka za izabrani period.
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  color: "white",
  fontWeight: 600,
  fontSize: 8,
  padding: "4px 4px",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  whiteSpace: "nowrap",
};

const cellStyle: React.CSSProperties = {
  padding: "2px 4px",
  fontSize: 8.5,
  borderBottom: "1px solid #dddddd",
  verticalAlign: "middle",
};

const footStyle: React.CSSProperties = {
  padding: "4px 4px",
  fontSize: 9,
  fontWeight: 700,
  borderTop: `2px solid ${PRIMARY}`,
  whiteSpace: "nowrap",
};
