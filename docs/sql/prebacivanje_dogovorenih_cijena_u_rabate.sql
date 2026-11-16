-- Jednokratno prebacivanje iz erp.partneri_dogovorene_cijene (stara, cijene)
-- u erp.partneri_dogovoreni_rabati (nova, rabati).
--
-- Rabat = ROUND((trenutni VPC iz erp.artikli - dogovorena_cijena_vpc) / VPC * 100, 2)
--
-- Ne prenosi se:
--   - aktivno = 0
--   - partner_id = 0
--   - vreme_izmjene NULL ili starije od 01.01.2024.
--   - dogovorena cijena >= VPC (rabat <= 0), VPC ili cijena <= 0
--   - par partner+proizvod koji već postoji u novoj tabeli (tamo je noviji podatak)
-- Ako u staroj ima više redova za isti par, uzima se onaj sa najnovijim vreme_izmjene.

-- ============================================================
-- 1) PREGLED — pokrenuti prvo, provjeriti šta će ući
-- ============================================================
WITH izvor AS
(
    SELECT
        s.partner_id,
        s.proizvod_id,
        s.dogovorena_cijena_vpc,
        a.vpc,
        s.vreme_izmjene,
        ROUND((a.vpc - s.dogovorena_cijena_vpc) / a.vpc * 100, 2) AS rabat,
        ROW_NUMBER() OVER (PARTITION BY s.partner_id, s.proizvod_id
                           ORDER BY s.vreme_izmjene DESC, s.sifra_tbl DESC) AS rb
    FROM erp.partneri_dogovorene_cijene s
    JOIN erp.artikli a ON a.sifra_proizvoda = s.proizvod_id
    WHERE s.aktivno = 1
      AND s.partner_id <> 0
      AND s.vreme_izmjene >= '2024-01-01'
      AND a.vpc > 0
      AND s.dogovorena_cijena_vpc > 0
      AND s.dogovorena_cijena_vpc < a.vpc
)
SELECT i.*
FROM izvor i
LEFT JOIN erp.partneri_dogovoreni_rabati n
       ON n.partner_id = i.partner_id AND n.proizvod_id = i.proizvod_id
WHERE i.rb = 1
  AND i.rabat > 0 AND i.rabat < 100
  AND n.sifra_tbl IS NULL
ORDER BY i.partner_id, i.proizvod_id;

-- ============================================================
-- 2) PREBACIVANJE
-- ============================================================
START TRANSACTION;

INSERT INTO erp.partneri_dogovoreni_rabati
(
    partner_id,
    proizvod_id,
    rabat_1_proc,
    orijentaciona_cijena_vpc,
    vpc_pri_dogovoru,
    aktivno,
    sinhronizovano,
    vreme_kreiranja,
    vreme_izmjene
)
WITH izvor AS
(
    SELECT
        s.partner_id,
        s.proizvod_id,
        s.dogovorena_cijena_vpc,
        a.vpc,
        s.vreme_izmjene,
        ROUND((a.vpc - s.dogovorena_cijena_vpc) / a.vpc * 100, 2) AS rabat,
        ROW_NUMBER() OVER (PARTITION BY s.partner_id, s.proizvod_id
                           ORDER BY s.vreme_izmjene DESC, s.sifra_tbl DESC) AS rb
    FROM erp.partneri_dogovorene_cijene s
    JOIN erp.artikli a ON a.sifra_proizvoda = s.proizvod_id
    WHERE s.aktivno = 1
      AND s.partner_id <> 0
      AND s.vreme_izmjene >= '2024-01-01'
      AND a.vpc > 0
      AND s.dogovorena_cijena_vpc > 0
      AND s.dogovorena_cijena_vpc < a.vpc
)
SELECT
    i.partner_id,
    i.proizvod_id,
    i.rabat,
    i.dogovorena_cijena_vpc,
    i.vpc,
    1,
    0,
    i.vreme_izmjene,
    i.vreme_izmjene
FROM izvor i
LEFT JOIN erp.partneri_dogovoreni_rabati n
       ON n.partner_id = i.partner_id AND n.proizvod_id = i.proizvod_id
WHERE i.rb = 1
  AND i.rabat > 0 AND i.rabat < 100
  AND n.sifra_tbl IS NULL;

SELECT ROW_COUNT() AS prebaceno;

-- Ako je broj u redu: COMMIT;   inače: ROLLBACK;
