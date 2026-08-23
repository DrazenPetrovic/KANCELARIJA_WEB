// Štampač je mrežni monochrome (crno-bijeli) — boje se pretvaraju u blijedi
// sivi raster i slabo se vide na papiru, pa je ovdje sve čisto crno.
const PRIMARY = "#000000";
const STOPA_PDV = 0.17;

// Isti oblik reda kao PrihodRed u MjesecniPrihodi.tsx (nema zajedničkog tipova
// fajla, pa se ovdje ponavlja minimalni presjek polja koja se koriste u štampi).
export interface MjesecniPrihodiPregledRed {
  kategorija: string;
  nacin_placanja: string;
  storno: number;
  ukupno: number;
  pdv: number;
  rabat: number;
  veleprodajna_vrednost: number;
}

interface IzvozInfo {
  broj_racuna: number;
  osnovica: number;
  ukupno: number;
}

interface Props {
  redovi: MjesecniPrihodiPregledRed[];
  datumOd?: string | null;
  datumDo?: string | null;
  izvoz?: IzvozInfo | null;
}

interface CelijaVrijednosti {
  ukupno: number;
  pdv: number;
  rabat: number;
  vpc: number;
}

const praznaCelija: CelijaVrijednosti = { ukupno: 0, pdv: 0, rabat: 0, vpc: 0 };

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

const jeStorno = (v: number) => Number(v) === 1;
const jeProizvod = (kategorija: string) =>
  kategorija.toLowerCase().includes("proizv");
const jeRoba = (kategorija: string) => kategorija.toLowerCase().includes("rob");

const pronadjiCeliju = (
  stavke: MjesecniPrihodiPregledRed[],
  test: (kategorija: string) => boolean,
  storno: boolean,
): CelijaVrijednosti => {
  const red = stavke.find(
    (r) => test(r.kategorija) && jeStorno(r.storno) === storno,
  );
  if (!red) return praznaCelija;
  return {
    ukupno: Number(red.ukupno || 0),
    pdv: Number(red.pdv || 0),
    rabat: Number(red.rabat || 0),
    vpc: Number(red.veleprodajna_vrednost || 0),
  };
};

const prioritetGrupe = (naziv: string) => {
  const n = naziv.toLowerCase();
  if (n.includes("gotov")) return 0;
  if (n.includes("žiral") || n.includes("ziral") || n.includes("virman"))
    return 1;
  return 2;
};

export function MjesecniPrihodiTemplate({
  redovi,
  datumOd,
  datumDo,
  izvoz,
}: Props) {
  const datumStampe = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // Erp.mjesecni_prihodi_pregled već vraća storno redove sa negativnim
  // iznosima — običan zbir preko svih redova je dovoljan za neto vrijednosti.
  const sumKol = (kolona: "ukupno" | "veleprodajna_vrednost" | "rabat" | "pdv") =>
    redovi.reduce((s, r) => s + Number(r[kolona] || 0), 0);
  const ukupnoNeto = sumKol("ukupno");
  const vpNeto = sumKol("veleprodajna_vrednost");
  const rabatNeto = sumKol("rabat");
  const osnovicaNeto = vpNeto - rabatNeto;
  const pdvNeto = sumKol("pdv");
  const osnovicaPdv17 = osnovicaNeto * STOPA_PDV;

  const grupeMap = new Map<string, MjesecniPrihodiPregledRed[]>();
  for (const r of redovi) {
    const kljuc = r.nacin_placanja || "Ostalo";
    const lista = grupeMap.get(kljuc) ?? [];
    lista.push(r);
    grupeMap.set(kljuc, lista);
  }
  const grupe = [...grupeMap.entries()]
    .map(([naziv, stavke]) => ({ naziv, stavke }))
    .sort(
      (a, b) =>
        prioritetGrupe(a.naziv) - prioritetGrupe(b.naziv) ||
        a.naziv.localeCompare(b.naziv, "bs"),
    );

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
            Mjesečni prihodi
          </div>
          <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
            za period: {formatDatumDMY(datumOd)} — {formatDatumDMY(datumDo)}
          </div>
          <div style={{ fontSize: 8, color: "#999", marginTop: 4 }}>
            Datum štampe: {datumStampe}
          </div>
        </div>
      </div>

      {/* Rekapitulacija — isti raspored kao na ekranu: Ukupno, Veleprodajna
          vrijednost, Rabat, Osnovica, PDV. */}
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
                { label: "Ukupno:", vrijednost: ukupnoNeto },
                { label: "Veleprodajna vrijednost:", vrijednost: vpNeto },
                { label: "Rabat:", vrijednost: rabatNeto },
                {
                  label: "Osnovica (17% = " + formatBroj(osnovicaPdv17) + "):",
                  vrijednost: osnovicaNeto,
                },
                { label: "PDV:", vrijednost: pdvNeto },
              ].map(({ label, vrijednost }) => (
                <tr key={label}>
                  <td style={rekapLabelStyle}>{label}</td>
                  <td style={rekapVrijednostStyle}>{formatBroj(vrijednost)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {izvoz && izvoz.broj_racuna > 0 && (
            <div
              style={{
                marginTop: 8,
                border: `1px solid ${PRIMARY}`,
                padding: "5px 8px",
                fontSize: 8,
                color: "#333",
                lineHeight: 1.4,
              }}
            >
              Napomena: u periodu ima {izvoz.broj_racuna} izvozn
              {izvoz.broj_racuna === 1 ? "a" : "ih"} računa (0% PDV) u iznosu
              od {formatBroj(izvoz.osnovica)} — ušli su u Veleprodajnu
              vrijednost i Osnovicu, ali ne i u PDV, zato Osnovica × 17% ne
              odgovara stvarnom PDV-u za ovaj period.
            </div>
          )}
        </div>
      </div>

      {/* Tabele po načinu plaćanja */}
      {grupe.map((g) => {
        const proizvodNormal = pronadjiCeliju(g.stavke, jeProizvod, false);
        const robaNormal = pronadjiCeliju(g.stavke, jeRoba, false);
        const proizvodStorno = pronadjiCeliju(g.stavke, jeProizvod, true);
        const robaStorno = pronadjiCeliju(g.stavke, jeRoba, true);

        return (
          <div
            key={g.naziv}
            style={{ marginBottom: 14, pageBreakInside: "avoid" }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                borderBottom: `1.5px solid ${PRIMARY}`,
                paddingBottom: 3,
                marginBottom: 4,
              }}
            >
              {g.naziv}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: PRIMARY }}>
                  <th style={{ ...thStyle, width: "10%" }}></th>
                  {["Ukupno", "VP", "Rabat", "PDV"].map((label) => (
                    <th
                      key={label}
                      style={{ ...thStyle, width: "11.25%", textAlign: "right" }}
                    >
                      {label}
                    </th>
                  ))}
                  <th style={{ ...thStyle, width: "10%" }}></th>
                  {["Ukupno", "VP", "Rabat", "PDV"].map((label) => (
                    <th
                      key={`${label}-2`}
                      style={{ ...thStyle, width: "11.25%", textAlign: "right" }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>Proizvod</td>
                  <RedCelije v={proizvodNormal} />
                  <td style={{ ...cellStyle, fontWeight: 700 }}>Roba</td>
                  <RedCelije v={robaNormal} />
                </tr>
                <tr>
                  <td style={{ ...cellStyle, fontWeight: 700, color: "#666" }}>
                    Proizvod — storno
                  </td>
                  <RedCelije v={proizvodStorno} storno />
                  <td style={{ ...cellStyle, fontWeight: 700, color: "#666" }}>
                    Roba — storno
                  </td>
                  <RedCelije v={robaStorno} storno />
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}

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

function RedCelije({ v, storno }: { v: CelijaVrijednosti; storno?: boolean }) {
  const boja = storno ? "#666" : "#1a1a1a";
  return (
    <>
      <td style={{ ...cellStyle, textAlign: "right", color: boja }}>
        {formatBroj(v.ukupno)}
      </td>
      <td style={{ ...cellStyle, textAlign: "right", color: boja }}>
        {formatBroj(v.vpc)}
      </td>
      <td style={{ ...cellStyle, textAlign: "right", color: boja }}>
        {formatBroj(v.rabat)}
      </td>
      <td style={{ ...cellStyle, textAlign: "right", color: boja }}>
        {formatBroj(v.pdv)}
      </td>
    </>
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
