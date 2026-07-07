type Rod = "m" | "z";

const JEDINICE_M = ["", "jedan", "dva", "tri", "četiri", "pet", "šest", "sedam", "osam", "devet"];
const JEDINICE_Z = ["", "jedna", "dvije", "tri", "četiri", "pet", "šest", "sedam", "osam", "devet"];
const NAEST = ["deset", "jedanaest", "dvanaest", "trinaest", "četrnaest", "petnaest", "šesnaest", "sedamnaest", "osamnaest", "devetnaest"];
const DESETICE = ["", "", "dvadeset", "trideset", "četrdeset", "pedeset", "šezdeset", "sedamdeset", "osamdeset", "devedeset"];
const STOTINE = ["", "sto", "dvjesta", "trista", "četiristo", "petsto", "šesto", "sedamsto", "osamsto", "devetsto"];

// Oblici imenice u zavisnosti od zadnje cifre broja: [jedan, dva-tri-četiri, pet-...-nula/naest].
type Oblici3 = [string, string, string];

const GRUPE_OBLICI: Oblici3[] = [
  ["milijarda", "milijarde", "milijardi"],
  ["milion", "miliona", "miliona"],
  ["hiljada", "hiljade", "hiljada"],
  ["", "", ""],
];
const GRUPE_RODOVI: Rod[] = ["z", "m", "z", "z"];

function trocifreno(broj: number, rod: Rod): string {
  const rijeci: string[] = [];
  const stotice = Math.floor(broj / 100);
  const ostatak = broj % 100;
  if (stotice > 0) rijeci.push(STOTINE[stotice]);
  if (ostatak >= 10 && ostatak < 20) {
    rijeci.push(NAEST[ostatak - 10]);
  } else {
    const desetice = Math.floor(ostatak / 10);
    const jedinice = ostatak % 10;
    if (desetice > 0) rijeci.push(DESETICE[desetice]);
    if (jedinice > 0) rijeci.push(rod === "z" ? JEDINICE_Z[jedinice] : JEDINICE_M[jedinice]);
  }
  return rijeci.join(" ");
}

function oblik(broj: number, oblici: Oblici3): string {
  const [jedan, malo, mnogo] = oblici;
  const zadnjeDvije = broj % 100;
  const zadnja = broj % 10;
  if (zadnjeDvije > 10 && zadnjeDvije < 20) return mnogo;
  if (zadnja === 1) return jedan;
  if (zadnja >= 2 && zadnja <= 4) return malo;
  return mnogo;
}

function cijeliBrojUSlovima(broj: number, rodJedinica: Rod): string {
  if (broj === 0) return "nula";
  const grupe: number[] = [];
  let n = broj;
  for (let i = 0; i < 4; i++) {
    grupe.unshift(n % 1000);
    n = Math.floor(n / 1000);
  }
  const rodovi = [...GRUPE_RODOVI.slice(0, 3), rodJedinica];
  const dijelovi: string[] = [];
  grupe.forEach((vrijednost, i) => {
    if (vrijednost === 0) return;
    dijelovi.push(trocifreno(vrijednost, rodovi[i]));
    if (GRUPE_OBLICI[i][0]) dijelovi.push(oblik(vrijednost, GRUPE_OBLICI[i]));
  });
  return dijelovi.join(" ");
}

const MARKA_OBLICI: Oblici3 = ["konvertibilna marka", "konvertibilne marke", "konvertibilnih maraka"];
const FENING_OBLICI: Oblici3 = ["fening", "feninga", "feninga"];

// Pretvara novčani iznos u tekst za KM (konvertibilna marka), npr. 1234.5 ->
// "hiljada dvjesta trideset četiri konvertibilne marke i pedeset feninga".
export function brojUSlovima(iznos: number): string {
  const zaokruzeno = Math.round((Math.abs(iznos) + Number.EPSILON) * 100) / 100;
  const cijeliDio = Math.floor(zaokruzeno);
  const feninzi = Math.round((zaokruzeno - cijeliDio) * 100);

  const dijelovi = [`${cijeliBrojUSlovima(cijeliDio, "z")} ${oblik(cijeliDio, MARKA_OBLICI)}`];

  if (feninzi > 0) {
    dijelovi.push(`i ${cijeliBrojUSlovima(feninzi, "m")} ${oblik(feninzi, FENING_OBLICI)}`);
  }

  const tekst = dijelovi.join(" ");
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}
