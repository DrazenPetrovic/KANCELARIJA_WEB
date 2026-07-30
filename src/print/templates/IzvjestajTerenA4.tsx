const PRIMARY = "#785E9E";

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

export interface IzvjestajTerenRed {
  sifra_tabele: number | string;
  broj_racuna_prikaz: string;
  naziv_partnera: string;
  ukupno: number | string;
  napomena?: string | null;
}

interface Props {
  terenLabel: string;
  redovi: IzvjestajTerenRed[];
}

export function IzvjestajTerenA4({ terenLabel, redovi }: Props) {
  const datumStampe = formatDatumStampe(new Date());
  const ukupnoSvi = redovi.reduce((s, r) => s + (Number(r.ukupno) || 0), 0);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: 10,
        color: "#1a1a1a",
        padding: "12mm 10mm",
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
          paddingBottom: 10,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>
            Karpas Ambalaže
          </div>
          <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
            Kancelarija — sistem za upravljanje
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
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
          <div style={{ fontSize: 9, color: "#999" }}>
            Broj računa: {redovi.length}
          </div>
        </div>
      </div>

      {redovi.length === 0 ? (
        <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>
          Nema računa za štampu
        </div>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <colgroup>
            <col style={{ width: "16%" }} />
            <col style={{ width: "34%" }} />
            <col style={{ width: "36%" }} />
            <col style={{ width: "14%" }} />
          </colgroup>
          <thead>
            <tr style={{ background: "#ede8f6" }}>
              {[
                { label: "Broj računa", right: false },
                { label: "Naziv partnera", right: false },
                { label: "Napomena", right: false },
                { label: "Ukupno", right: true },
              ].map(({ label, right }) => (
                <th
                  key={label}
                  style={{
                    color: PRIMARY,
                    fontWeight: 700,
                    fontSize: 9,
                    padding: "5px 6px",
                    textAlign: right ? "right" : "left",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    borderBottom: `1px solid ${PRIMARY}`,
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {redovi.map((red, i) => (
              <tr
                key={`${red.sifra_tabele}-${i}`}
                style={{ background: i % 2 === 0 ? "#faf9fc" : "white" }}
              >
                <td style={cell}>{red.broj_racuna_prikaz}</td>
                <td style={{ ...cell, wordBreak: "break-word" }}>
                  {red.naziv_partnera}
                </td>
                <td
                  style={{
                    ...cell,
                    wordBreak: "break-word",
                    fontStyle: "italic",
                    color: "#666",
                  }}
                >
                  {red.napomena?.trim() || "—"}
                </td>
                <td style={{ ...cell, textAlign: "right", fontWeight: 600 }}>
                  {broj(red.ukupno)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                colSpan={3}
                style={{
                  ...cell,
                  fontWeight: 700,
                  textAlign: "right",
                  borderTop: `2px solid ${PRIMARY}`,
                  borderBottom: "none",
                }}
              >
                UKUPNO
              </td>
              <td
                style={{
                  ...cell,
                  fontWeight: 700,
                  textAlign: "right",
                  color: PRIMARY,
                  fontSize: 12,
                  borderTop: `2px solid ${PRIMARY}`,
                  borderBottom: "none",
                }}
              >
                {broj(ukupnoSvi)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}

      <div
        style={{
          marginTop: 16,
          paddingTop: 6,
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

const cell: React.CSSProperties = {
  padding: "5px 6px",
  fontSize: 13,
  borderBottom: "1px solid #f0edf8",
  verticalAlign: "middle",
};
