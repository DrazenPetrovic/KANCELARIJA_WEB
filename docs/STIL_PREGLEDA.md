# Stil pregleda — referenca

Referenca: **tabela stavki u Pregledu kalkulacija** (`src/components/KalkulacijePregled.tsx`,
komponente `TH` / `TD` i tabela stavki koja se otvara ispod kliknutog reda).
Kad se radi novi pregled (ili sređuje postojeći), držati se vrijednosti iz ovog fajla.

## Boje

| Namjena | Vrijednost |
|---|---|
| Primarna (zaglavlje tabele, akcenti) | `#785E9E` (`PRIMARY`) |
| Akcent / uplate / pozitivno | `#8FC74A` (`ACCENT`) |
| Isplate / greška / negativno | `#ef4444` (`text-red-500`) |
| Sekundarni tekst | `text-gray-400` / dark `#5f5878` |
| Osnovni tekst ćelije | `text-gray-600` / dark `#c5bfd8` |
| Naglašen tekst (bold) | `text-gray-800` / dark `#ede9f6` |

## Veličine fonta

| Element | Klasa | px |
|---|---|---|
| Tekst u ćelijama (cijela tabela) | `text-sm` (na `<table>`) | 14px |
| Zaglavlje kolone (`th`) | `text-[10px] font-bold uppercase tracking-wide` | 10px |
| Sekundarni podatak u ćeliji (šifra, JM, adresa, datum ispod) | `text-[10px]` | 10px |
| Značka / badge (PLAĆEN, PDV, ...) | `text-[9px] font-bold` | 9px |

## Visina reda i padding

| Element | Padding | Napomena |
|---|---|---|
| Zaglavlje (`th`) | `px-3 py-2` | 12px lijevo/desno, 8px gore/dolje |
| **Stavke (items) — kompaktno** | `px-3 py-1` | 12px lijevo/desno, **4px gore/dolje** |
| Glavna tabela (redovi dokumenata) | `px-3 py-2.5` | 10px gore/dolje — samo za glavni spisak, ne za stavke |
| Prazno stanje ("Nema stavki") | `px-3 py-8 text-center text-sm` | |

Pravila za kompaktne redove stavki:
- Jedan red = jedna linija teksta. Sekundarni podatak ide **u istom redu** (`<span className="ml-2 text-[10px] ...">`), ne u novom `div`-u ispod.
- Ćelije sa iznosima/datumima: `whitespace-nowrap`.
- Iznosi i brojevi: `text-right`; tekst: `text-left`.

U kalkulacijama se kompaktnost stavki postiže na `<tr>`: `className="[&>td]:py-1"`
(TD komponenta ima `py-2.5`, red ga pregazi na `py-1`).

## Kolone i razmak između kolona

- Razmak između kolona = horizontalni padding ćelije: `px-3` (12px sa svake strane → 24px između sadržaja susjednih kolona).
- Tabela stavki u Kalkulacijama: `w-full` (puna širina).
- Kad tabela ima malo kolona i ne treba da se razvlači (Izvodi, Blagajna): `table-auto` na tabeli + omotač `w-fit max-w-full mx-auto` → kolone su uske koliko sadržaj traži, a tabela je centrirana.

## Omotač tabele stavki (kad se red otvori)

```tsx
{/* Crveni okvir oko otvorenih detalja reda */}
<div className="rounded-xl border-2 border-red-500 overflow-hidden">
  <div className="rounded-xl border border-gray-100 dark:border-[#2d2648] overflow-x-auto">
    <table className="w-full text-sm">...</table>
  </div>
</div>
```

Ćelija u kojoj stoji tabela detalja: `px-4 py-3 bg-[#faf9fc] dark:bg-[#1e1a2d]`.

## Linije između redova

- Red stavke: `border-b border-gray-200 dark:border-[#3a3158]`
- Red ukupno (`tfoot`): `border-t-2 border-gray-200 dark:border-[#3a3158] bg-[#faf9fc] dark:bg-[#1e1a2d]`, ćelije bold.

## Gotove komponente (kopirati u novi pregled)

```tsx
const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th
    className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide whitespace-nowrap text-white ${right ? "text-right" : "text-left"}`}
    style={{ background: PRIMARY }}
  >
    {children}
  </th>
);

const TD = ({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) => (
  <td
    className={`px-3 py-2.5 whitespace-nowrap ${right ? "text-right" : "text-left"} ${bold ? "font-bold text-gray-800 dark:text-[#ede9f6]" : "text-gray-600 dark:text-[#c5bfd8]"}`}
  >
    {children}
  </td>
);

// Red stavke (kompaktno):
<tr className="border-b border-gray-200 dark:border-[#3a3158] [&>td]:py-1">...</tr>
```

## Obojeni redovi po tipu (Izvodi, Blagajna)

Kad red ima smjer novca, cijeli red se boji (naizmjenično svjetlije/tamnije):

| Tip | Parni red | Neparni red |
|---|---|---|
| Uplata | `bg-green-50` | `bg-green-100/70` |
| Isplata | `bg-red-100` | `bg-red-200/70` |
| Transfer | `bg-blue-50` | `bg-blue-100/70` |

Redoslijed: prvo uplate, pa isplate (pa transferi) — unutar grupe od najvećeg iznosa ka najmanjem.

## Raspored stranice pregleda

- Spoljni kontejner: `space-y-4` (Izvodi/Blagajna: `w-[90%] mx-auto`).
- Lista dokumenata (Izvodi/Blagajna): `w-[80%] mx-auto`, kartica `bg-white dark:bg-[#261f38] rounded-2xl border border-gray-100 dark:border-[#2d2648] shadow-sm`.
- Datumi se prikazuju kao `dd.MM.yyyy.`.
