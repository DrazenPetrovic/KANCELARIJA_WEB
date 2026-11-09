// Štampa sintetike partnera na A4 sa memorandumom. Štampač je monochrome, pa je
// sve crno (vidi LagerListaTemplate). Vrijednosti stižu već formatirane iz
// SintetikaPartnera.tsx. U proširenoj varijanti ispod svakog partnera idu
// njegovi računi (kalkulacije/KUF) i uplate.
const PRIMARY = "#000000";

export interface SintetikaPrintStavka {
  datum: string;
  vrsta: string;
  opis: string;
  iznos: string;
  placen?: boolean;
}

export interface SintetikaPrintDetalji {
  naslovDokumenata: string;
  dokumenti: SintetikaPrintStavka[];
  ukupnoDokumenti: string;
  uplate: SintetikaPrintStavka[];
  ukupnoUplate: string;
}

export interface SintetikaPrintRed {
  kljuc: string;
  sifra: number;
  naziv: string;
  adresa: string;
  grad: string;
  racuni: string;
  uplate: string;
  saldo: string;
  // "K" kupac, "D" dobavljač
  konto: string;
  detalji?: SintetikaPrintDetalji | null;
}

export interface SintetikaPrintUkupno {
  naziv: string;
  racuni: string;
  uplate: string;
  saldo: string;
}

interface Props {
  // Datum stanja, već formatiran (dd.MM.yyyy.).
  datum: string;
  // Opis primijenjenih filtera — prazno ako ih nema.
  filter?: string;
  prosireno: boolean;
  redovi: SintetikaPrintRed[];
  ukupno: SintetikaPrintUkupno[];
}

const KOLONE = 8;

export function SintetikaPartneraTemplate({
  datum,
  filter,
  prosireno,
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
              style={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase" }}
            >
              Sintetika partnera{prosireno ? " — prošireni pregled" : ""}
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
              Broj partnera: {redovi.length}
            </div>
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: PRIMARY }}>
              <th style={{ ...thStyle, textAlign: "right", width: 34 }}>Šifra</th>
              <th style={thStyle}>Naziv</th>
              <th style={thStyle}>Adresa</th>
              <th style={thStyle}>Grad</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Računi</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Uplate</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Saldo</th>
              <th style={{ ...thStyle, textAlign: "center", width: 22 }}>K/D</th>
            </tr>
          </thead>
          <tbody>
            {redovi.map((r) => (
              <PartnerRedovi key={r.kljuc} r={r} prosireno={prosireno} />
            ))}
          </tbody>
          {redovi.length > 0 && (
            <tfoot>
              {ukupno.map((u) => (
                <tr key={u.naziv}>
                  <td colSpan={4} style={footStyle}>
                    {u.naziv}
                  </td>
                  <td style={{ ...footStyle, textAlign: "right" }}>{u.racuni}</td>
                  <td style={{ ...footStyle, textAlign: "right" }}>{u.uplate}</td>
                  <td style={{ ...footStyle, textAlign: "right" }}>{u.saldo}</td>
                  <td style={footStyle}>{""}</td>
                </tr>
              ))}
            </tfoot>
          )}
        </table>

        {redovi.length === 0 && (
          <div
            style={{ textAlign: "center", color: "#888", padding: 30, fontSize: 11 }}
          >
            Nema partnera za prikaz.
          </div>
        )}
      </div>
    </div>
  );
}

function PartnerRedovi({
  r,
  prosireno,
}: {
  r: SintetikaPrintRed;
  prosireno: boolean;
}) {
  const osnovni = prosireno
    ? { ...cellStyle, fontWeight: 700, borderBottom: "1px solid #999", background: "#eeeeee" }
    : cellStyle;
  return (
    <>
      <tr style={{ pageBreakInside: "avoid" }}>
        <td style={{ ...osnovni, textAlign: "right" }}>{r.sifra}</td>
        <td style={{ ...osnovni, fontWeight: 700 }}>{r.naziv}</td>
        <td style={osnovni}>{r.adresa}</td>
        <td style={osnovni}>{r.grad}</td>
        <td style={{ ...osnovni, textAlign: "right", whiteSpace: "nowrap" }}>
          {r.racuni}
        </td>
        <td style={{ ...osnovni, textAlign: "right", whiteSpace: "nowrap" }}>
          {r.uplate}
        </td>
        <td
          style={{ ...osnovni, textAlign: "right", whiteSpace: "nowrap", fontWeight: 700 }}
        >
          {r.saldo}
        </td>
        <td style={{ ...osnovni, textAlign: "center" }}>{r.konto}</td>
      </tr>
      {prosireno && (
        <tr>
          <td
            colSpan={KOLONE}
            style={{ padding: "3px 0 10px 12px", borderBottom: `1px solid ${PRIMARY}` }}
          >
            {r.detalji ? (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <PodTabela
                  naslov={r.detalji.naslovDokumenata}
                  stavke={r.detalji.dokumenti}
                  ukupno={r.detalji.ukupnoDokumenti}
                />
                <PodTabela
                  naslov="Uplate"
                  stavke={r.detalji.uplate}
                  ukupno={r.detalji.ukupnoUplate}
                />
              </div>
            ) : (
              <div style={{ fontSize: 8, color: "#888" }}>
                Dokumenti nisu učitani.
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function PodTabela({
  naslov,
  stavke,
  ukupno,
}: {
  naslov: string;
  stavke: SintetikaPrintStavka[];
  ukupno: string;
}) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          textTransform: "uppercase",
          marginBottom: 2,
        }}
      >
        {naslov}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={podThStyle}>Datum</th>
            <th style={podThStyle}>Vrsta</th>
            <th style={podThStyle}>Opis</th>
            <th style={{ ...podThStyle, textAlign: "right" }}>Iznos</th>
          </tr>
        </thead>
        <tbody>
          {stavke.length === 0 && (
            <tr>
              <td colSpan={4} style={{ ...podCellStyle, color: "#888" }}>
                Nema stavki
              </td>
            </tr>
          )}
          {stavke.map((s, i) => (
            <tr key={i} style={{ background: s.placen ? "#e5e5e5" : "white" }}>
              <td style={{ ...podCellStyle, whiteSpace: "nowrap" }}>{s.datum}</td>
              <td style={podCellStyle}>{s.vrsta}</td>
              <td style={podCellStyle}>
                {s.opis}
                {s.placen ? " ✓" : ""}
              </td>
              <td style={{ ...podCellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                {s.iznos}
              </td>
            </tr>
          ))}
        </tbody>
        {stavke.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={3} style={{ ...podCellStyle, fontWeight: 700, borderTop: "1px solid #000" }}>
                Ukupno
              </td>
              <td
                style={{
                  ...podCellStyle,
                  fontWeight: 700,
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  borderTop: "1px solid #000",
                }}
              >
                {ukupno}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
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

// Donji padding je veći jer html2canvas iscrtava tekst niže nego browser, pa
// bi linija ispod reda inače dodirivala tekst.
const cellStyle: React.CSSProperties = {
  padding: "2px 4px 5px",
  fontSize: 8.5,
  borderBottom: "1px solid #dddddd",
  verticalAlign: "middle",
};

const footStyle: React.CSSProperties = {
  padding: "4px 4px 6px",
  fontSize: 9,
  fontWeight: 700,
  borderTop: `2px solid ${PRIMARY}`,
  whiteSpace: "nowrap",
};

const podThStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: 7,
  padding: "2px 3px 4px",
  textAlign: "left",
  textTransform: "uppercase",
  borderBottom: "1px solid #000",
};

const podCellStyle: React.CSSProperties = {
  padding: "1px 3px 4px",
  fontSize: 7.5,
  borderBottom: "1px solid #e0e0e0",
  verticalAlign: "top",
};
