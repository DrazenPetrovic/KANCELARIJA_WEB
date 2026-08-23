// Štampač je mrežni monochrome (crno-bijeli) — boje se pretvaraju u blijedi
// sivi raster i slabo se vide na papiru, pa je ovdje sve čisto crno.
const PRIMARY = "#000000";

// Vertikalne linije koje ograničavaju blok "PDV obveznici" — bijele u
// zaglavlju (vidljive na crnoj pozadini thStyle-a), crne u tijelu tabele
// (vidljive na bijeloj pozadini reda). Iste linije se vuku kroz oba reda
// zaglavlja i kroz svaki red podataka, pa vizuelno idu neprekidno odozgo.
const obvBorderHeader = "#ffffff";
const obvBorderBody = "#000000";

// Isti oblik reda kao KifRed u Kif.tsx (nema zajedničkog tipova fajla, pa se
// ovdje ponavlja minimalni presjek polja koja se koriste u štampi).
export interface KifPregledRed {
  sifra_kif: number;
  broj_racuna: string;
  vrsta_racuna: string;
  vrsta_racuna_pod: string;
  datum_racuna: string;
  sifra_partnera: number;
  naziv_partnera: string;
  adresa_partnera: string;
  naziv_grada: string;
  entitet: string;
  pib: string;
  ukupno: number;
  osnova_za_obracun_pdv: number;
  pdv: number;
}

interface Props {
  redovi: KifPregledRed[];
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

// Puna oznaka fakture — isti obrazac kao formatBrojRacuna u racuniGotovinski.tsx
// / racuniZiralni.tsx: <prefiks vrste>-<podgrupa>-<redni broj> (npr. MP-10-3871,
// VP-10-6988, KOVP-10-154 — vrsta_racuna već stiže kao gotov prefiks iz sp_kif).
const formatBrojFakture = (r: KifPregledRed) =>
  [r.vrsta_racuna, r.vrsta_racuna_pod, r.broj_racuna]
    .filter((dio) => dio !== null && dio !== undefined && dio !== "")
    .join("-");

// PDV obveznik = partner ima upisan (nenulti) PIB; u suprotnom se osnovica/PDV
// za taj red knjiže u kolone "PDV neobveznici" (i dalje razvrstano RS/FBiH
// prema entitetu partnera), isto kao u štampanoj Knjizi izlaznih faktura.
const jeObveznik = (r: KifPregledRed) =>
  !!r.pib && String(r.pib).trim() !== "0" && String(r.pib).trim() !== "";

export function KifPregledTemplate({ redovi, datumOd, datumDo }: Props) {
  const datumStampe = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  let ukupnoFakturisano = 0;
  let veleprodajnaVrednost = 0;
  let pdvUkupno = 0;
  let obvVeleprodaja = 0;
  let obvPdv = 0;
  let neobvVeleprodaja = 0;
  let neobvPdv = 0;
  let rsPdv = 0;

  redovi.forEach((r) => {
    const osnova = Number(r.osnova_za_obracun_pdv || 0);
    const pdv = Number(r.pdv || 0);
    ukupnoFakturisano += Number(r.ukupno || 0);
    veleprodajnaVrednost += osnova;
    pdvUkupno += pdv;
    if (jeObveznik(r)) {
      obvVeleprodaja += osnova;
      obvPdv += pdv;
    } else {
      neobvVeleprodaja += osnova;
      neobvPdv += pdv;
      if (r.entitet === "RS") rsPdv += pdv;
    }
  });

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
      {/* Header — desna ivica nastavlja krajnju vertikalnu liniju kolone FBIH
          (tabela ispod), tako da linija ide neprekidno od samog vrha stranice. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: `3px solid ${PRIMARY}`,
          borderRight: `1.5px solid ${obvBorderBody}`,
          paddingBottom: 8,
          paddingRight: 4,
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
            Knjiga izlaznih faktura
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

      {/* Rekapitulacija — na početku stranice, prije tabele stavki. */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: 14,
          pageBreakInside: "avoid",
        }}
      >
        <div style={{ width: "140mm" }}>
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
                { label: "Ukupno fakturisano:", vrijednost: ukupnoFakturisano },
                { label: "Veleprodajna vrijednost:", vrijednost: veleprodajnaVrednost },
                { label: "PDV:", vrijednost: pdvUkupno },
              ].map(({ label, vrijednost }) => (
                <tr key={label}>
                  <td style={rekapLabelStyle}>{label}</td>
                  <td style={rekapVrijednostStyle}>{formatBroj(vrijednost)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={rekapNaslovStyle}>PDV OBVEZNICI</div>
          <RekapRed naziv="Veleprodajna vrijednost:" iznos={obvVeleprodaja} />
          <RekapRed naziv="PDV:" iznos={obvPdv} />

          <div style={rekapNaslovStyle}>PDV NEOBVEZNICI</div>
          <RekapRed naziv="Veleprodajna vrijednost:" iznos={neobvVeleprodaja} />
          <RekapRed naziv="PDV:" iznos={neobvPdv} />
          <RekapRed naziv="RS:" iznos={rsPdv} />
        </div>
      </div>

      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: PRIMARY }}>
            {[
              { label: "RB", w: "4%" },
              { label: "Faktura", w: "13%" },
              { label: "Partner", w: "43%" },
              { label: "Ukupno", w: "7%", right: true },
            ].map(({ label, w, right }) => (
              <th
                key={label}
                rowSpan={2}
                style={{
                  ...thStyle,
                  width: w,
                  textAlign: right ? "right" : "left",
                  verticalAlign: "bottom",
                  paddingRight: right ? 14 : 4,
                }}
              >
                {label}
              </th>
            ))}
            <th
              colSpan={2}
              style={{
                ...thStyle,
                textAlign: "center",
                borderLeft: `1.5px solid ${obvBorderHeader}`,
                borderRight: `1.5px solid ${obvBorderHeader}`,
              }}
            >
              PDV obveznici
            </th>
            <th
              colSpan={4}
              style={{
                ...thStyle,
                textAlign: "center",
                borderLeft: `1.5px solid ${obvBorderHeader}`,
                borderRight: `1.5px solid ${obvBorderHeader}`,
              }}
            >
              PDV neobveznici
            </th>
          </tr>
          <tr style={{ background: PRIMARY }}>
            {["OSNOVA", "PDV", "OSNOVA", "PDV", "RS", "FBIH"].map(
              (label, i) => (
                <th
                  key={`${label}-${i}`}
                  style={{
                    ...thStyle,
                    width: "6%",
                    textAlign: i >= 2 ? "center" : "right",
                    borderLeft:
                      i === 0 || i === 2
                        ? `1.5px solid ${obvBorderHeader}`
                        : undefined,
                    borderRight: i !== 0 ? `1.5px solid ${obvBorderHeader}` : undefined,
                  }}
                >
                  {label}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {redovi.map((r) => {
            const obveznik = jeObveznik(r);
            const osnova = Number(r.osnova_za_obracun_pdv || 0);
            const pdv = Number(r.pdv || 0);
            return (
              <tr key={r.sifra_kif} style={{ background: "white" }}>
                <td style={cellStyle}>{r.sifra_kif}</td>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 700 }}>{formatBrojFakture(r)}</div>
                  <div style={{ fontSize: 8, color: "#888", marginTop: 1 }}>
                    {formatDatumDMY(r.datum_racuna)}
                  </div>
                </td>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600 }}>
                    {r.sifra_partnera} — {r.naziv_partnera}
                  </div>
                  <div style={{ fontSize: 8, color: "#888", marginTop: 1 }}>
                    {[r.adresa_partnera, r.naziv_grada]
                      .filter(Boolean)
                      .join(", ") || "—"}
                    {r.pib && r.pib !== "0" && (
                      <span
                        style={{
                          paddingLeft: 5,
                          fontWeight: 800,
                          textDecoration: "underline",
                          color: "#1a1a1a",
                        }}
                      >
                        PIB: {r.pib}
                      </span>
                    )}
                  </div>
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    fontWeight: 700,
                    paddingRight: 14,
                  }}
                >
                  {formatBroj(r.ukupno)}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    borderLeft: `1.5px solid ${obvBorderBody}`,
                  }}
                >
                  {obveznik ? formatBroj(osnova) : "0.00"}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    borderRight: `1.5px solid ${obvBorderBody}`,
                  }}
                >
                  {obveznik ? formatBroj(pdv) : "0.00"}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    borderLeft: `1.5px solid ${obvBorderBody}`,
                    borderRight: `1.5px solid ${obvBorderBody}`,
                  }}
                >
                  {!obveznik ? formatBroj(osnova) : "0.00"}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    borderRight: `1.5px solid ${obvBorderBody}`,
                  }}
                >
                  {!obveznik ? formatBroj(pdv) : "0.00"}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    borderRight: `1.5px solid ${obvBorderBody}`,
                  }}
                >
                  {!obveznik && r.entitet === "RS" ? formatBroj(pdv) : "0.00"}
                </td>
                <td
                  style={{
                    ...cellStyle,
                    textAlign: "right",
                    borderRight: `1.5px solid ${obvBorderBody}`,
                  }}
                >
                  {!obveznik && r.entitet === "FBiH" ? formatBroj(pdv) : "0.00"}
                </td>
              </tr>
            );
          })}
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

function RekapRed({ naziv, iznos }: { naziv: string; iznos: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 10,
        color: "#333",
        padding: "2px 0",
      }}
    >
      <span>{naziv}</span>
      <span>{formatBroj(iznos)}</span>
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

// Gornja 3 reda rekapitulacije (Ukupno fakturisano / Veleprodajna vrijednost /
// PDV) — mala tabela sa sivom pozadinom kolone vrijednosti, po uzoru na
// rekapitulaciju u originalnoj štampanoj Knjizi izlaznih faktura.
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

const rekapNaslovStyle: React.CSSProperties = {
  textAlign: "center",
  fontSize: 10,
  fontWeight: 700,
  marginTop: 8,
  marginBottom: 3,
};
