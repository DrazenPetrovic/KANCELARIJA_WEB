// Štampač je mrežni monochrome (crno-bijeli) — boje se pretvaraju u blijedi
// sivi raster i slabo se vide na papiru, pa je ovdje sve čisto crno.
const PRIMARY = "#000000";

// Isti oblik reda kao KufRed u Kuf.tsx (nema zajedničkog tipova fajla, pa se
// ovdje ponavlja minimalni presjek polja koja se koriste u štampi).
export interface KufPregledRed {
  sifra: number;
  broj_dokumenta: string;
  datum_dokumenta: string;
  naziv_partnera: string;
  adresa_partnera: string;
  PIB: string;
  opis: string;
  vrednost_bez_pdv: number;
  iskazani_pdv: number;
  ulazni_pdv: number;
  ulazni_pdv_uvoz: number;
  grad_partnera: string;
}

interface Props {
  redovi: KufPregledRed[];
  datumOd?: string | null;
  datumDo?: string | null;
}

const formatBroj = (v: number | null | undefined) =>
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

export function KufPregledTemplate({ redovi, datumOd, datumDo }: Props) {
  const datumStampe = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let vrednostBezPdv = 0;
  let iskazaniPdv = 0;
  let ulazniPdv = 0;
  let ulazniPdvUvoz = 0;

  redovi.forEach((r) => {
    vrednostBezPdv += Number(r.vrednost_bez_pdv || 0);
    iskazaniPdv += Number(r.iskazani_pdv || 0);
    ulazniPdv += Number(r.ulazni_pdv || 0);
    ulazniPdvUvoz += Number(r.ulazni_pdv_uvoz || 0);
  });
  const ukupno = vrednostBezPdv + iskazaniPdv;

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: 9,
        color: "#1a1a1a",
        padding: "10mm 10mm",
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
          paddingBottom: 8,
          marginBottom: 10,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>
            Karpas Ambalaže
          </div>
          <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
            Ložionička bb, 78000 Banja Luka
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
            Knjiga ulaznih faktura
          </div>
          <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
            za period: {formatDatumDMY(datumOd)} — {formatDatumDMY(datumDo)}
          </div>
          <div style={{ fontSize: 8, color: "#999", marginTop: 4 }}>
            Datum štampe: {datumStampe}
          </div>
          <div style={{ fontSize: 8, color: "#999" }}>
            Broj zapisa: {redovi.length}
          </div>
        </div>
      </div>

      {/* Rekapitulacija */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 14,
          pageBreakInside: "avoid",
        }}
      >
        <div style={{ width: "130mm" }}>
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            REKAPITULACIJA
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {[
                { label: "Ukupno:", vrijednost: ukupno },
                { label: "Vrijednost bez PDV:", vrijednost: vrednostBezPdv },
                { label: "Iskazani PDV:", vrijednost: iskazaniPdv },
                { label: "Ulazni PDV:", vrijednost: ulazniPdv },
                { label: "Ulazni PDV (uvoz):", vrijednost: ulazniPdvUvoz },
              ].map(({ label, vrijednost }) => (
                <tr key={label}>
                  <td style={rekapLabelStyle}>{label}</td>
                  <td style={rekapVrijednostStyle}>{formatBroj(vrijednost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: PRIMARY }}>
            {[
              { label: "RB", w: "4%" },
              { label: "Dokument", w: "12%" },
              { label: "Partner", w: "32%" },
              { label: "Opis", w: "18%" },
              { label: "Osnovica", w: "10%", right: true },
              { label: "Iskaz. PDV", w: "8%", right: true },
              { label: "Ulazni PDV", w: "8%", right: true },
              { label: "Ukupno", w: "8%", right: true },
            ].map(({ label, w, right }) => (
              <th
                key={label}
                style={{
                  ...thStyle,
                  width: w,
                  textAlign: right ? "right" : "left",
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {redovi.map((r) => (
            <tr key={r.sifra} style={{ background: "white" }}>
              <td style={cellStyle}>{r.sifra}</td>
              <td style={cellStyle}>
                <div style={{ fontWeight: 700 }}>{r.broj_dokumenta}</div>
                <div style={{ fontSize: 8, color: "#888", marginTop: 1 }}>
                  {formatDatumDMY(r.datum_dokumenta)}
                </div>
              </td>
              <td style={cellStyle}>
                <div style={{ fontWeight: 600 }}>{r.naziv_partnera}</div>
                <div style={{ fontSize: 8, color: "#888", marginTop: 1 }}>
                  {[r.adresa_partnera, r.grad_partnera]
                    .filter(Boolean)
                    .join(", ") || "—"}
                  {r.PIB && r.PIB !== "0" && (
                    <span
                      style={{
                        paddingLeft: 5,
                        fontWeight: 800,
                        textDecoration: "underline",
                        color: "#1a1a1a",
                      }}
                    >
                      PIB: {r.PIB}
                    </span>
                  )}
                </div>
              </td>
              <td style={cellStyle}>{r.opis || "—"}</td>
              <td style={{ ...cellStyle, textAlign: "right" }}>
                {formatBroj(r.vrednost_bez_pdv)}
              </td>
              <td style={{ ...cellStyle, textAlign: "right" }}>
                {formatBroj(r.iskazani_pdv)}
              </td>
              <td style={{ ...cellStyle, textAlign: "right" }}>
                {formatBroj(r.ulazni_pdv)}
              </td>
              <td style={{ ...cellStyle, textAlign: "right", fontWeight: 700 }}>
                {formatBroj(
                  Number(r.vrednost_bez_pdv || 0) + Number(r.iskazani_pdv || 0),
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {redovi.length === 0 && (
        <div style={{ textAlign: "center", color: "#aaa", padding: 30, fontSize: 11 }}>
          Nema podataka za izabrani period.
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 6,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 8,
          color: "#aaa",
        }}
      >
        <span>Karpas Ambalaže — Kancelarija</span>
        <span>{datumStampe}</span>
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
};

const cellStyle: React.CSSProperties = {
  padding: "3px 4px",
  fontSize: 8.5,
  borderBottom: "1px solid #dddddd",
  verticalAlign: "middle",
};

const rekapLabelStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "4px 10px",
  fontSize: 10,
  fontWeight: 700,
  textAlign: "left",
  background: "#ffffff",
};

const rekapVrijednostStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "4px 10px",
  fontSize: 10,
  fontWeight: 700,
  textAlign: "center",
  background: "#d9d9d9",
};
