-- Upis dogovorenih rabata u erp.partneri_dogovoreni_rabati (paralelno sa
-- erp.artikli_dogovorene_cijene_unos, koja i dalje puni staru tabelu).
--
-- Ulaz: {"stavke":[{"partner_id":..,"proizvod_id":..,"vpc":..,"dogovorena_cijena_vpc":..}]}
--   vpc                   = kataloški VPC u trenutku računa
--   dogovorena_cijena_vpc = VPC1 sa računa
-- Rabat se računa ovdje: ROUND((vpc - vpc1) / vpc * 100, 2).
-- Upisuju se samo stavke sa rabatom > 0 i < 100 — negativan rabat (VPC1 veći
-- od VPC-a), nula i neispravni podaci se preskaču, bez greške.
-- Postojeći par partner+proizvod se ažurira (jedan red po paru).

DROP PROCEDURE IF EXISTS erp.artikli_dogovoreni_rabati_unos;

CREATE PROCEDURE erp.artikli_dogovoreni_rabati_unos(IN p_podaci JSON)
BEGIN
    DECLARE v_broj_stavki INT DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_podaci IS NULL OR JSON_VALID(p_podaci) = 0 THEN
        CALL erp.sp_signal_greska(2001, 'Dostavljeni JSON nije ispravan.');
    END IF;

    START TRANSACTION;

    INSERT INTO erp.partneri_dogovoreni_rabati
    (
        partner_id,
        proizvod_id,
        rabat_1_proc,
        orijentaciona_cijena_vpc,
        vpc_pri_dogovoru,
        aktivno,
        sinhronizovano
    )
    SELECT
        x.partner_id,
        x.proizvod_id,
        x.rabat,
        x.vpc1,
        x.vpc,
        1,
        0
    FROM
    (
        SELECT
            jt.partner_id,
            jt.proizvod_id,
            jt.vpc,
            jt.vpc1,
            ROUND((jt.vpc - jt.vpc1) / jt.vpc * 100, 2) AS rabat
        FROM JSON_TABLE
        (
            p_podaci,
            '$.stavke[*]'
            COLUMNS
            (
                partner_id  INT           PATH '$.partner_id',
                proizvod_id INT           PATH '$.proizvod_id',
                vpc         DECIMAL(10,3) PATH '$.vpc',
                vpc1        DECIMAL(10,3) PATH '$.dogovorena_cijena_vpc'
            )
        ) jt
        WHERE jt.partner_id IS NOT NULL
          AND jt.proizvod_id IS NOT NULL
          AND jt.vpc  > 0
          AND jt.vpc1 > 0
          AND jt.vpc1 < jt.vpc
    ) x
    WHERE x.rabat > 0 AND x.rabat < 100
    -- Postojeći red se mijenja SAMO ako se promijenio procenat rabata —
    -- promjena cijene (poskupljenje/pojeftinjenje VPC-a) uz isti rabat ne
    -- dira red. rabat_1_proc MORA biti zadnji: MySQL dodjele izvršava redom,
    -- pa bi uslovi iznad inače vidjeli već novi rabat.
    ON DUPLICATE KEY UPDATE
        orijentaciona_cijena_vpc = IF(rabat_1_proc <> VALUES(rabat_1_proc), VALUES(orijentaciona_cijena_vpc), orijentaciona_cijena_vpc),
        vpc_pri_dogovoru         = IF(rabat_1_proc <> VALUES(rabat_1_proc), VALUES(vpc_pri_dogovoru), vpc_pri_dogovoru),
        aktivno                  = IF(rabat_1_proc <> VALUES(rabat_1_proc), 1, aktivno),
        sinhronizovano           = IF(rabat_1_proc <> VALUES(rabat_1_proc), 0, sinhronizovano),
        rabat_1_proc             = VALUES(rabat_1_proc);

    SET v_broj_stavki = ROW_COUNT();

    COMMIT;

    SELECT
        0 AS kod,
        'Dogovoreni rabati su sačuvani.' AS poruka,
        v_broj_stavki AS broj_stavki;
END
