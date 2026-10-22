// Štampa jedne kalkulacije (KALK) na A4 sa memorandumom — stavke i, ako postoje, vezani
// zavisni troškovi (ZT). Štampač je mrežni monochrome, pa je sve crno/sivo
// (isto kao KufPregledTemplate).
import { Fragment } from "react";

const PRIMARY = "#000000";

// Stopa ulaznog PDV-a za domaćeg dobavljača u sistemu PDV-a.
const PDV_STOPA = 0.17;

// Minimalni presjek polja iz KalkulacijePregled.tsx koja se koriste u štampi.
export interface KalkulacijaStampaZaglavlje {
  sifra_kalkulacije: number;
  datum_kalkulacije: string;
  datum_unosa_kalkulacije: string | null;
  sifra_dobavljaca: number;
  naziv_dobavljaca: string | null;
  adresa_dobavljaca: string | null;
  grad_dobavljaca: string | null;
  jib_dobavljaca: string | null;
  pib_dobavljaca: string | null;
  broj_racuna: string | null;
  // Datum valute (rok plaćanja) — datum fakture + valuta partnera.
  valuta: string | null;
  ukupno_km: number;
  ukupno_rab: number;
  vp_vrednost: number;
  vrsta_kalkulacije: string | null;
}

export interface KalkulacijaStampaStavka {
  sifra_tbl: number;
  sifra_proizvoda: number;
  naziv_proizvoda: string | null;
  jm: string | null;
  kolicina: number;
  cijena: number;
  rabat: number;
  fakturisana_cijena: number;
  vpc: number;
  nasa_ulazna_cijena: number;
  akcijski_rabat: number;
  stornirano: string | number | null;
}

export interface KalkulacijaStampaTrosak {
  naziv_troska: string | null;
  ukupno_km: number;
  ukupno_pdv: number;
  vrsta_pdv: string | number | null;
}

export interface KalkulacijaStampaZt {
  zaglavlje: KalkulacijaStampaZaglavlje;
  troskovi: KalkulacijaStampaTrosak[];
}

interface Props {
  kalkulacija: KalkulacijaStampaZaglavlje;
  stavke: KalkulacijaStampaStavka[];
  zt: KalkulacijaStampaZt[];
  // Obračunava se ulazni PDV (domaći dobavljač u sistemu PDV-a).
  obracunPdv: boolean;
}

const formatBroj = (v: number | null | undefined, decimale = 2) =>
  Number(v ?? 0).toLocaleString("en-US", {
    minimumFractionDigits: decimale,
    maximumFractionDigits: decimale,
  });

const formatDatumDMY = (v: string | null | undefined): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
};

const formatSifru = (v: string | number | null | undefined): string =>
  v && String(v) !== "0" ? String(v) : "—";

const jeDa = (v: string | number | null | undefined): boolean => {
  if (v === null || v === undefined) return false;
  const s = String(v).trim().toUpperCase();
  return s === "1" || s === "DA" || s === "D" || s === "TRUE";
};


export function KalkulacijaA4Template({
  kalkulacija: k,
  stavke,
  zt,
  obracunPdv,
}: Props) {
  const datumStampe = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const iznosStavke = (s: KalkulacijaStampaStavka) =>
    Number(s.kolicina || 0) * Number(s.fakturisana_cijena || 0);
  const ukupnoStavke = stavke
    .filter((s) => !jeDa(s.stornirano))
    .reduce((sum, s) => sum + iznosStavke(s), 0);

  const ztRedovi = zt.flatMap((z) =>
    z.troskovi.map((t) => ({ zaglavlje: z.zaglavlje, trosak: t })),
  );
  const ztBezPdv = ztRedovi.reduce(
    (s, r) => s + Number(r.trosak.ukupno_km || 0),
    0,
  );
  const ztPdv = ztRedovi.reduce(
    (s, r) => s + Number(r.trosak.ukupno_pdv || 0),
    0,
  );

  // Rekapitulacija: Fakturisano (sama kalkulacija) + Zavisan trošak (ZT bez
  // PDV-a) = Svega; PDV 17% na Fakturisano samo kad je obracunPdv (domaći
  // dobavljač u sistemu PDV-a — određuje pozivalac); UKUPNO = Svega + PDV.
  const fakturisano = Number(k.ukupno_km || 0);
  const svega = fakturisano + ztBezPdv;
  const pdvKalk = obracunPdv ? fakturisano * PDV_STOPA : 0;

  return (
    <div
      style={{
        width: "210mm",
        minHeight: "297mm",
        // Kolona preko cijele visine A4 — footer se gura na dno lista.
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        fontSize: 9,
        color: "#1a1a1a",
        background: "white",
      }}
    >
      {/* Memorandum (zaglavlje firme) — isto kao LagerListaTemplate/RacunA4. */}
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

      <div
        style={{
          padding: "6mm 10mm",
          boxSizing: "border-box",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
      {/* Naslov */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          borderBottom: `2px solid ${PRIMARY}`,
          paddingBottom: 6,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: PRIMARY,
            textTransform: "uppercase",
          }}
        >
          Kalkulacija br. {k.sifra_kalkulacije}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 10, fontWeight: 700 }}>
            Datum kalkulacije: {formatDatumDMY(k.datum_kalkulacije)}
          </div>
          <div style={{ fontSize: 8, color: "#666", marginTop: 2 }}>
            Datum unosa: {formatDatumDMY(k.datum_unosa_kalkulacije)} · Datum
            štampe: {datumStampe}
          </div>
        </div>
      </div>

      {/* Dobavljač i dokument */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={okvirStyle}>
          <div style={okvirNaslovStyle}>Dobavljač</div>
          <div style={{ fontSize: 11, fontWeight: 700 }}>
            {k.naziv_dobavljaca || "—"}
          </div>
          <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
            {[k.adresa_dobavljaca, k.grad_dobavljaca]
              .filter(Boolean)
              .join(", ") || "—"}
          </div>
          <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>
            JIB: {formatSifru(k.jib_dobavljaca)} · PIB:{" "}
            {formatSifru(k.pib_dobavljaca)}
          </div>
        </div>
        <div style={{ ...okvirStyle, width: "75mm", flex: "none" }}>
          <div style={okvirNaslovStyle}>Dokument</div>
          <div style={{ fontSize: 9 }}>
            Broj fakture dobavljača: <b>{k.broj_racuna || "—"}</b>
          </div>
          {/* datum_kalkulacije je datum fakture dobavljača (vidi KalkulacijaUnos). */}
          <div style={{ fontSize: 9, marginTop: 2 }}>
            Datum fakture dobavljača:{" "}
            <b>{formatDatumDMY(k.datum_kalkulacije)}</b>
          </div>
          <div style={{ fontSize: 9, marginTop: 2 }}>
            Valuta: <b>{formatDatumDMY(k.valuta)}</b>
          </div>
        </div>
      </div>

      {/* Stavke */}
      <div style={sekcijaNaslovStyle}>Stavke kalkulacije</div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: PRIMARY }}>
            {[
              { label: "RB", w: "4%" },
              { label: "Proizvod", w: "36%" },
              { label: "JM", w: "5%" },
              { label: "Količina", w: "8%", right: true },
              { label: "Cijena", w: "8%", right: true },
              { label: "Rab. %", w: "6%", right: true },
              { label: "Akc. %", w: "6%", right: true },
              { label: "Fakt. cij.", w: "8%", right: true },
              { label: "VPC", w: "8%", right: true },
              { label: "Iznos", w: "11%", right: true },
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
          {stavke.map((s, i) => {
            const storno = jeDa(s.stornirano);
            const td = (extra?: React.CSSProperties): React.CSSProperties => ({
              ...cellStyle,
              ...(storno ? { color: "#999", textDecoration: "line-through" } : {}),
              ...extra,
            });
            return (
              <tr key={s.sifra_tbl}>
                <td style={td()}>{i + 1}</td>
                <td style={td()}>
                  <span style={{ fontWeight: 600 }}>
                    {s.naziv_proizvoda || "—"}
                  </span>
                  <span style={{ fontSize: 7.5, color: "#888", marginLeft: 4 }}>
                    šifra {s.sifra_proizvoda}
                    {storno ? " · STORNO" : ""}
                  </span>
                </td>
                <td style={td()}>{s.jm || "—"}</td>
                <td style={td({ textAlign: "right" })}>
                  {formatBroj(s.kolicina, 3)}
                </td>
                <td style={td({ textAlign: "right" })}>
                  {formatBroj(s.cijena, 3)}
                </td>
                <td style={td({ textAlign: "right" })}>
                  {formatBroj(s.rabat)}
                </td>
                <td style={td({ textAlign: "right" })}>
                  {formatBroj(s.akcijski_rabat)}
                </td>
                <td style={td({ textAlign: "right" })}>
                  {formatBroj(s.fakturisana_cijena, 3)}
                </td>
                <td style={td({ textAlign: "right" })}>
                  {formatBroj(s.vpc)}
                </td>
                <td style={td({ textAlign: "right", fontWeight: 700 })}>
                  {formatBroj(iznosStavke(s))}
                </td>
              </tr>
            );
          })}
          {stavke.length === 0 && (
            <tr>
              <td
                colSpan={10}
                style={{ ...cellStyle, textAlign: "center", color: "#999" }}
              >
                Kalkulacija nema stavki.
              </td>
            </tr>
          )}
        </tbody>
        {stavke.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={9} style={ukupnoLabelStyle}>
                Ukupno stavke:
              </td>
              <td style={ukupnoVrijednostStyle}>{formatBroj(ukupnoStavke)}</td>
            </tr>
          </tfoot>
        )}
      </table>

      {/* Donji dio: ZT u lijevoj polovini papira, rekapitulacija u desnoj. */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "6mm",
          marginTop: 14,
          pageBreakInside: "avoid",
        }}
      >
      {/* Zavisni troškovi (lijeva polovina; prazna ako nema ZT) */}
      <div style={{ width: "50%", flex: "none" }}>
      {ztRedovi.length > 0 && (
        <>
          <div style={sekcijaNaslovStyle}>Zavisni troškovi (ZT)</div>
          {/* Svaki ZT jedan ispod drugog: dobavljač, datum i račun, njegovi
              troškovi (bez PDV | PDV) i međuzbir; na kraju ukupno u okviru.
              tableLayout fixed — ne smije izaći iz svoje polovine. */}
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              wordBreak: "break-word",
            }}
          >
            <colgroup>
              <col style={{ width: "58%" }} />
              <col style={{ width: "21%" }} />
              <col style={{ width: "21%" }} />
            </colgroup>
            <tbody>
              {zt.map(({ zaglavlje: z, troskovi }) => {
                const bezPdv = troskovi.reduce(
                  (s, t) => s + Number(t.ukupno_km || 0),
                  0,
                );
                const pdv = troskovi.reduce(
                  (s, t) => s + Number(t.ukupno_pdv || 0),
                  0,
                );
                return (
                  <Fragment key={z.sifra_kalkulacije}>
                    {/* Zaglavlje ZT-a u jednom redu: naziv, broj računa,
                        a datum računa skroz desno. */}
                    <tr>
                      <td
                        colSpan={3}
                        style={{
                          padding: "4px 4px 3px",
                          borderTop: "1.5px solid #000",
                          borderBottom: "1px solid #000",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                          }}
                        >
                          {/* Naziv partnera jedini bold i veći; račun i
                              datum sitniji, normalni i sivi. */}
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: "#000",
                              textTransform: "uppercase",
                            }}
                          >
                            {z.naziv_dobavljaca || "—"}
                          </span>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 400,
                              fontStyle: "italic",
                              color: "#555",
                            }}
                          >
                            {z.broj_racuna || "—"}
                          </span>
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: 8,
                              fontWeight: 400,
                              fontStyle: "italic",
                              color: "#555",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDatumDMY(z.datum_kalkulacije)}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {troskovi.map((t, i) => (
                      <tr key={i}>
                        <td style={ztCelija}>{t.naziv_troska || "—"}</td>
                        <td style={{ ...ztCelija, textAlign: "right" }}>
                          {formatBroj(t.ukupno_km)}
                        </td>
                        <td style={{ ...ztCelija, textAlign: "right" }}>
                          {formatBroj(t.ukupno_pdv)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td />
                      <td style={ztMedjuzbir}>{formatBroj(bezPdv)}</td>
                      <td style={ztMedjuzbir}>{formatBroj(pdv)}</td>
                    </tr>
                  </Fragment>
                );
              })}
              <tr>
                <td />
                <td colSpan={2} style={{ paddingTop: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      border: "1px solid #000",
                      borderRadius: 8,
                      padding: "6px 4px",
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    <span style={{ flex: 1, textAlign: "right" }}>
                      {formatBroj(ztBezPdv)}
                    </span>
                    <span style={{ flex: 1, textAlign: "right" }}>
                      {formatBroj(ztPdv)}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </>
      )}
      </div>

      {/* Rekapitulacija (desna polovina) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            REKAPITULACIJA
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
            }}
          >
            <tbody>
              {[
                { label: "Fakturisano:", vrijednost: fakturisano },
                { label: "Zavisan trošak:", vrijednost: ztBezPdv },
                { label: "Svega:", vrijednost: svega },
                { label: "PDV:", vrijednost: pdvKalk },
                { label: "UKUPNO:", vrijednost: svega + pdvKalk, jako: true },
                { label: "VP vrijednost:", vrijednost: k.vp_vrednost },
              ].map(({ label, vrijednost, jako }) => (
                <tr key={label}>
                  <td
                    style={{
                      ...rekapLabelStyle,
                      ...(jako ? { fontSize: 9.5 } : {}),
                    }}
                  >
                    {label}
                  </td>
                  <td
                    style={{
                      ...rekapVrijednostStyle,
                      ...(jako ? { fontSize: 10.5 } : {}),
                    }}
                  >
                    {formatBroj(vrijednost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Potpisi */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 30,
          fontSize: 9,
          pageBreakInside: "avoid",
        }}
      >
        <div style={potpisStyle}>Sastavio</div>
        <div style={potpisStyle}>Kontrolisao</div>
      </div>

      {/* Footer — na dnu A4 lista (marginTop auto u flex koloni). */}
      <div
        style={{
          marginTop: "auto",
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
    </div>
  );
}

const thStyle: React.CSSProperties = {
  color: "white",
  fontWeight: 600,
  fontSize: 7.5,
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

// Red troška unutar ZT bloka (isprekidana linija ispod).
const ztCelija: React.CSSProperties = {
  padding: "2px 4px",
  fontSize: 8.5,
  borderBottom: "1px dotted #999",
};

// Međuzbir jednog ZT-a (bez PDV | PDV).
const ztMedjuzbir: React.CSSProperties = {
  padding: "3px 4px 6px",
  fontSize: 9.5,
  fontWeight: 700,
  textAlign: "right",
  borderTop: "1px solid #000",
};

const okvirStyle: React.CSSProperties = {
  flex: 1,
  border: "1px solid #999",
  padding: "6px 8px",
};

const okvirNaslovStyle: React.CSSProperties = {
  fontSize: 7.5,
  fontWeight: 700,
  textTransform: "uppercase",
  color: "#666",
  letterSpacing: "0.05em",
  marginBottom: 3,
};

const sekcijaNaslovStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 4,
};

const ukupnoLabelStyle: React.CSSProperties = {
  padding: "4px 4px",
  fontSize: 9,
  fontWeight: 700,
  textAlign: "right",
  borderTop: "2px solid #000",
};

const ukupnoVrijednostStyle: React.CSSProperties = {
  padding: "4px 4px",
  fontSize: 9,
  fontWeight: 700,
  textAlign: "right",
  borderTop: "2px solid #000",
};

const rekapLabelStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "3px 5px",
  fontSize: 8,
  // Opis i iznos dijele rekapitulaciju na pola — linija je na sredini.
  width: "50%",
  whiteSpace: "nowrap",
  fontWeight: 700,
  textAlign: "left",
  background: "#ffffff",
};

const rekapVrijednostStyle: React.CSSProperties = {
  border: "1px solid #999",
  padding: "3px 8px",
  fontSize: 9,
  fontWeight: 700,
  textAlign: "right",
  background: "#d9d9d9",
};

const potpisStyle: React.CSSProperties = {
  width: "60mm",
  borderTop: "1px solid #000",
  paddingTop: 3,
  textAlign: "center",
};
