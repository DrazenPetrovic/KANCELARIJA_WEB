const PRIMARY = "#785E9E";

function formatDatumStampe(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function formatQty(n: number | string | null | undefined) {
  const num = Number(n);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export interface DostavaTereniProizvodiRow {
  sifra_tabele: number;
  sifra_partnera: number;
  sifra_proizvoda: number;
  naziv_proizvoda: string;
  jm: string;
  kolicina_proizvoda: number | string;
  napomena: string | null;
  referentni_broj: string | null;
  spremljena_kolicina: number | string;
  verifikovano: number;
  verifikovano_ts: string | null;
  naziv_partnera: string;
}

interface PartnerGroup {
  key: string;
  sifra_partnera: number;
  naziv_partnera: string;
  referentni_broj: string | null;
  rows: DostavaTereniProizvodiRow[];
}

interface Props {
  rows: DostavaTereniProizvodiRow[];
  terenLabel?: string;
}

function groupRows(rows: DostavaTereniProizvodiRow[]): PartnerGroup[] {
  const groups = new Map<string, PartnerGroup>();

  rows.forEach((row) => {
    const referentniBroj = (row.referentni_broj || "").trim() || null;
    const key = `${row.sifra_partnera}::${referentniBroj || ""}`;

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        sifra_partnera: row.sifra_partnera,
        naziv_partnera: row.naziv_partnera,
        referentni_broj: referentniBroj,
        rows: [],
      });
    }

    groups.get(key)!.rows.push(row);
  });

  return Array.from(groups.values());
}

export function DostavaTereniProizvodiTemplate({ rows, terenLabel }: Props) {
  const datumStampe = formatDatumStampe(new Date());

  const groups = groupRows(rows);
  const totalStavki = rows.length;

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
            Dostava — narudžbe na terenu{terenLabel ? ` (${terenLabel})` : ""}
          </div>
          <div style={{ fontSize: 9, color: "#999", marginTop: 4 }}>
            Datum štampe: {datumStampe}
          </div>
          <div style={{ fontSize: 9, color: "#999" }}>
            Partnera: {groups.length}&nbsp;&nbsp;|&nbsp;&nbsp;
            Stavki: {totalStavki}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div style={{ textAlign: "center", color: "#aaa", padding: 20 }}>
          Nema podataka za štampu
        </div>
      ) : (
        groups.map((group, gi) => {
          return (
            <div
              key={group.key}
              style={{
                marginBottom: gi < groups.length - 1 ? 20 : 0,
                pageBreakInside: "avoid",
              }}
            >
              {/* Partner header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: PRIMARY,
                  color: "white",
                  padding: "6px 10px",
                  borderRadius: 4,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 11 }}>
                  {group.sifra_partnera} — {group.naziv_partnera}
                  {group.sifra_partnera >= 10000 && " (RAZNI KUPAC)"}
                </span>
                {group.referentni_broj && (
                  <span style={{ fontSize: 9, opacity: 0.85 }}>
                    Ref. broj: {group.referentni_broj}
                  </span>
                )}
              </div>

              {/* Tabela stavki */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                }}
              >
                <colgroup>
                  <col style={{ width: "7%" }} />
                  <col style={{ width: "45%" }} />
                  <col style={{ width: "8%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "#ede8f6" }}>
                    {[
                      { label: "Šifra", right: false },
                      { label: "Naziv proizvoda", right: false },
                      { label: "JM", right: false },
                      { label: "Napomena", right: false },
                      { label: "Spremljena količina", right: true },
                    ].map(({ label, right }) => (
                      <th
                        key={label}
                        style={{
                          color: PRIMARY,
                          fontWeight: 700,
                          fontSize: 8,
                          padding: "3px 5px",
                          textAlign: right ? "right" : "left",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row, i) => (
                    <tr
                      key={`${group.key}-${row.sifra_proizvoda}-${i}`}
                      style={{
                        background: i % 2 === 0 ? "#faf9fc" : "white",
                      }}
                    >
                      <td style={cell}>{row.sifra_proizvoda}</td>
                      <td style={{ ...cell, fontWeight: 600, wordBreak: "break-word" }}>
                        {row.naziv_proizvoda}
                      </td>
                      <td style={cell}>{row.jm}</td>
                      <td style={{ ...cell, wordBreak: "break-word" }}>
                        {row.napomena || "—"}
                      </td>
                      <td
                        style={{
                          ...cell,
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {formatQty(row.spremljena_kolicina)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}

      {/* Footer */}
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
  padding: "3px 5px",
  fontSize: 9,
  borderBottom: "1px solid #f0edf8",
  verticalAlign: "middle",
};
