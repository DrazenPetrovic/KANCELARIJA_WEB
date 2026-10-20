// Štampa lager liste na A4 sa memorandumom. Štampač je monochrome, pa je sve
// crno (vidi KifPregledTemplate). Kolone i redovi stižu već formatirani iz
// LagerListe.tsx, jer svaki lager ima svoje kolone.
const PRIMARY = "#000000";

export interface LagerListaKolona {
  naslov: string;
  right?: boolean;
  bold?: boolean;
}

interface Props {
  naziv: string;
  // Datum stanja, već formatiran (dd.MM.yyyy.).
  datum: string;
  // Opis primijenjenih filtera (pretraga, grupa) — prazno ako ih nema.
  filter?: string;
  kolone: LagerListaKolona[];
  redovi: string[][];
  // Red Ukupno — isti broj ćelija kao kolone.
  ukupno: string[];
}

export function LagerListaTemplate({
  naziv,
  datum,
  filter,
  kolone,
  redovi,
  ukupno,
}: Props) {
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
        {/* Naslov: naziv lagera + datum stanja */}
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
          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {naziv}
            </div>
            {filter && (
              <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
                {filter}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, fontWeight: 700 }}>
              Stanje na dan: {datum}
            </div>
            <div style={{ fontSize: 8, color: "#666", marginTop: 2 }}>
              Broj stavki: {redovi.length}
            </div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: PRIMARY }}>
              <th style={{ ...thStyle, textAlign: "right", width: 22 }}>RB</th>
              {kolone.map((k) => (
                <th
                  key={k.naslov}
                  style={{ ...thStyle, textAlign: k.right ? "right" : "left" }}
                >
                  {k.naslov}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {redovi.map((red, i) => (
              <tr key={i}>
                <td style={{ ...cellStyle, textAlign: "right", color: "#666" }}>
                  {i + 1}
                </td>
                {red.map((v, j) => (
                  <td
                    key={j}
                    style={{
                      ...cellStyle,
                      textAlign: kolone[j]?.right ? "right" : "left",
                      fontWeight: kolone[j]?.bold ? 700 : 400,
                      // Brojevi u jednom redu, tekst (naziv) smije da se prelomi.
                      whiteSpace: kolone[j]?.right ? "nowrap" : "normal",
                    }}
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {redovi.length > 0 && (
            <tfoot>
              <tr>
                <td style={footStyle}>{""}</td>
                {ukupno.map((v, j) => (
                  <td
                    key={j}
                    style={{
                      ...footStyle,
                      textAlign: kolone[j]?.right ? "right" : "left",
                    }}
                  >
                    {v}
                  </td>
                ))}
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
            Nema stavki.
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
