const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

export interface KliseRow {
  sifra: string;
  naziv_klisea: string;
  lokacija_partnera: string;
  dimenzija_za_stampu: string;
  povrsina_klisea: string;
  cijena_klisea: string;
  datum_narcucivanja: string;
  napomena: string;
  primljen_u_proizvodnju: number;
  dobavljac_klisea: string;
}

interface Props {
  data: KliseRow[];
  naslov?: string;
  godina?: string | null;
}

function formatDatum(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("bs-BA");
}

function formatCijena(v: string | null | undefined) {
  if (!v || v === "0") return "—";
  return `${parseFloat(v).toFixed(2)} KM`;
}

export function KlisePregledTemplate({ data, naslov = "Pregled klišea", godina }: Props) {
  const datumStampe = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: 11,
        color: "#1a1a1a",
        padding: "14mm 12mm",
        boxSizing: "border-box",
        minHeight: "100%",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: `3px solid ${PRIMARY}`,
          paddingBottom: 10,
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: PRIMARY }}>
            Karpas Ambalaže
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>
            Kancelarija — sistem za upravljanje
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: PRIMARY,
              textTransform: "uppercase",
            }}
          >
            {naslov}
          </div>
          {godina && (
            <div
              style={{
                fontSize: 10,
                color: "white",
                background: ACCENT,
                display: "inline-block",
                padding: "1px 8px",
                borderRadius: 10,
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              ARHIVA {godina}
            </div>
          )}
          <div style={{ fontSize: 9, color: "#999", marginTop: 4 }}>
            Datum štampe: {datumStampe}
          </div>
          <div style={{ fontSize: 9, color: "#999" }}>
            Broj zapisa: {data.length}
          </div>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: PRIMARY }}>
            {["Šifra", "Naziv klišea", "Partner", "Dimenzija", "Površina", "Cijena", "Datum naručivanja", "Status"].map(
              (h) => (
                <th
                  key={h}
                  style={{
                    color: "white",
                    fontWeight: 600,
                    fontSize: 9,
                    padding: "5px 6px",
                    textAlign: "left",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.sifra}
              style={{ background: i % 2 === 0 ? "#faf9fc" : "white" }}
            >
              <td style={cellStyle}>{row.sifra}</td>
              <td style={{ ...cellStyle, fontWeight: 600 }}>{row.naziv_klisea}</td>
              <td style={cellStyle}>{row.lokacija_partnera || "—"}</td>
              <td style={cellStyle}>{row.dimenzija_za_stampu || "—"}</td>
              <td style={cellStyle}>{row.povrsina_klisea ? `${row.povrsina_klisea} cm²` : "—"}</td>
              <td style={cellStyle}>{formatCijena(row.cijena_klisea)}</td>
              <td style={cellStyle}>{formatDatum(row.datum_narcucivanja)}</td>
              <td style={cellStyle}>
                <span
                  style={{
                    background: row.primljen_u_proizvodnju ? "#dcfce7" : "#fef9c3",
                    color: row.primljen_u_proizvodnju ? "#166534" : "#854d0e",
                    padding: "1px 6px",
                    borderRadius: 8,
                    fontSize: 9,
                    fontWeight: 600,
                  }}
                >
                  {row.primljen_u_proizvodnju ? "Primljen" : "Na čekanju"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.length === 0 && (
        <div style={{ textAlign: "center", color: "#aaa", padding: 30, fontSize: 11 }}>
          Nema podataka za prikaz.
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 8,
          borderTop: `1px solid #e5e7eb`,
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

const cellStyle: React.CSSProperties = {
  padding: "4px 6px",
  fontSize: 10,
  borderBottom: "1px solid #f0edf8",
  verticalAlign: "middle",
};
