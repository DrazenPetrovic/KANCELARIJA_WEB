-- erp.racuni_unos_storno — storno CIJELOG racuna (poziva POST /api/racuni/storno).
-- Preuzeto sa baze; izmjena: u stavkama (racun_po) kolicina, rabat_proc i
-- rabat_km idu NEGATIVNO, sve ostalo (cijene, vpc, rabat_*_2/_3, pdv_po_artiklu)
-- ostaje pozitivno kao na originalu.

DROP PROCEDURE IF EXISTS erp.racuni_unos_storno;
DELIMITER $$
CREATE DEFINER=`root`@`%` PROCEDURE erp.racuni_unos_storno( IN p_sifra_tabele INT)
BEGIN
  DECLARE v_sifra_tabele_novi INT DEFAULT 0;
    DECLARE v_broj_racuna_novi INT DEFAULT 0;
    DECLARE v_vrsta_racuna_novi TINYINT DEFAULT 0;
    DECLARE v_vrsta_racuna_storno TINYINT DEFAULT 0;
    DECLARE v_vrsta_racuna_pod INT DEFAULT 10;
    DECLARE v_broj_racuna_org INT DEFAULT 0;
    DECLARE v_postoji INT DEFAULT 0;
    DECLARE v_storniran INT DEFAULT 0;
    DECLARE v_lock_ok INT DEFAULT 0;
 
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DO RELEASE_LOCK('lock_sp_racun_unos_json');
        RESIGNAL;
    END;
 
    -- Isti lock kao kod unosa: storno i unos se serijalizuju medjusobno
    -- jer oba racunaju MAX(sifra_tabele) / MAX(broj_racuna) i diraju lager.
    SELECT GET_LOCK('lock_sp_racun_unos_json', 10)
    INTO v_lock_ok;
 
    IF v_lock_ok <> 1 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'procedura nije dobila lock za storniranje racuna';
    END IF;
 
    START TRANSACTION;
 
    -- ------------------------------------------------------------------
    -- 1. Validacija originala (FOR UPDATE = zakljucaj red do kraja transakcije)
    -- ------------------------------------------------------------------
    SELECT
        COUNT(*),
        IFNULL(MAX(storniran_racun), 0),
        IFNULL(MAX(broj_racuna), 0),
        IFNULL(MAX(vrsta_racuna_novi), 0),
        IFNULL(MAX(vrsta_racuna_pod), 10)
    INTO
        v_postoji,
        v_storniran,
        v_broj_racuna_org,
        v_vrsta_racuna_novi,
        v_vrsta_racuna_pod
    FROM ziralni.racun_gl
    WHERE sifra_tabele = p_sifra_tabele
    FOR UPDATE;
 
    IF v_postoji = 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Racun sa datom sifrom tabele ne postoji.';
    END IF;
 
    IF v_storniran <> 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Racun je vec storniran.';
    END IF;
 
    -- ------------------------------------------------------------------
    -- 1a. Mapiranje vrste racuna na vrstu storno (KO) racuna:
    --     1 MP -> 3 KO MP, 2 VP -> 4 KO VP, 5 USLUGA -> 6 KO USLUGA.
    --     KO racuni (3, 4, 6) se ne mogu stornirati.
    -- ------------------------------------------------------------------
    SET v_vrsta_racuna_storno =
        CASE v_vrsta_racuna_novi
            WHEN 1 THEN 3
            WHEN 2 THEN 4
            WHEN 5 THEN 6
            ELSE NULL
        END;
 
    IF v_vrsta_racuna_storno IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Racun ove vrste se ne moze stornirati (KO ili nepoznata vrsta).';
    END IF;
 
    -- ------------------------------------------------------------------
    -- 2. Novi kljucevi (isti pattern kao u sp_racuni_unos)
    -- ------------------------------------------------------------------
    SELECT IFNULL(MAX(sifra_tabele), 0) + 1
    INTO v_sifra_tabele_novi
    FROM ziralni.racun_gl;
 
    SELECT IFNULL(MAX(broj_racuna), 0) + 1
    INTO v_broj_racuna_novi
    FROM ziralni.racun_gl
    WHERE vrsta_racuna_novi = v_vrsta_racuna_storno
      AND vrsta_racuna_pod = v_vrsta_racuna_pod;
 
    -- ------------------------------------------------------------------
    -- 3. Storno header: kopija originala, iznosi u minus
    -- ------------------------------------------------------------------
    INSERT INTO ziralni.racun_gl
    (
        sifra_tabele,
        broj_racuna,
        vrsta_racuna,
        sifra_kupca,
        datum_racuna,
        ukupno,
        sifra_radnika,
        slovima,
        valuta,
        datum_isporuke,
        napomena,
        br_fiskalnog,
        rabat_km,
        racun_placen,
        vreme,
        vp_vrednost,
        racun_roba,
        storniran_racun,
        vp_vrednost_original,
        vrsta_racuna_novi,
        vrsta_racuna_pod,
        vp_1,
        vp_2,
        sifra_knjizenja,
        sinhronizovano,
        sifra_terena,
        datum_vreme_fiskalnog
    )
    SELECT
        v_sifra_tabele_novi,
        v_broj_racuna_novi,
        gl.vrsta_racuna,
        gl.sifra_kupca,
        CURDATE(),                                   -- datum storniranja
        gl.ukupno * -1,
        gl.sifra_radnika,                            -- komercijalista sa originala
        gl.slovima,
        gl.valuta,
        gl.datum_isporuke,
        CONCAT('STORNO racuna br. ', gl.broj_racuna,
               ' (sifra_tabele ', gl.sifra_tabele, ')'),
        NULL,
        gl.rabat_km * -1,
        0,
        NOW(),
        gl.vp_vrednost * -1,
        gl.racun_roba,
        1,                                           -- i storno red je oznacen kao storniran
        gl.vp_vrednost_original * -1,
        v_vrsta_racuna_storno,                       -- KO vrsta (1->3, 2->4, 5->6)
        gl.vrsta_racuna_pod,
        gl.vp_1 * -1,
        gl.vp_2 * -1,
        0,
        0,
        gl.sifra_terena,
        '-'
    FROM ziralni.racun_gl gl
    WHERE gl.sifra_tabele = p_sifra_tabele;
 
    -- ------------------------------------------------------------------
    -- 4. Storno stavke: kopija originalnih stavki, kolicina u minus
    --    (kolicina, rabat_proc i rabat_km u minus; cijene i ostalo pozitivno)
    -- ------------------------------------------------------------------
    INSERT INTO ziralni.racun_po
    (
        sifra_tabele,
        sifra_proizvoda,
        cijena_proizvoda,
        prodajna_cijena,
        kolicina,
        fiskalni_racun,
        rabat_proc,
        rabat_km,
        vpc,
        stornirano,
        otvoreno,
        vpc_bez_rabata,
        rabat_proc_2,
        rabat_km_2,
        vpc_sa_rab_2,
        rab_proc_3,
        rabat_km_3,
        vpc_rabat_1,
        pdv_po_artiklu,
        sinhronizovano,
        nabavna_cijena_proizvoda
    )
    SELECT
        v_sifra_tabele_novi,
        po.sifra_proizvoda,
        po.cijena_proizvoda,
        po.prodajna_cijena,
        po.kolicina * -1,
        NULL,
        po.rabat_proc * -1,
        po.rabat_km * -1,
        po.vpc,
        0,
        0,
        po.vpc_bez_rabata,
        po.rabat_proc_2,
        po.rabat_km_2,
        po.vpc_sa_rab_2,
        po.rab_proc_3,
        po.rabat_km_3,
        po.vpc_rabat_1,
        po.pdv_po_artiklu,
        0,
        po.nabavna_cijena_proizvoda
    FROM ziralni.racun_po po
    WHERE po.sifra_tabele = p_sifra_tabele;
 
    -- ------------------------------------------------------------------
    -- 5. Vracanje kolicina na lager
    --    Original je skinuo kolicinu sa stanja, storno je vraca:
    --    kolicina_proizvoda = kolicina_proizvoda + SUM(kolicina sa originala).
    --    SUM + GROUP BY zbog mogucih duplih stavki istog proizvoda.
    -- ------------------------------------------------------------------
    UPDATE ziralni.proizvodi p
    JOIN
    (
        SELECT
            po.sifra_proizvoda,
            SUM(po.kolicina) AS ukupna_kolicina
        FROM ziralni.racun_po po
        WHERE po.sifra_tabele = p_sifra_tabele
        GROUP BY po.sifra_proizvoda
    ) s ON s.sifra_proizvoda = p.sifra_proizvoda
    SET
        p.kolicina_proizvoda = IFNULL(p.kolicina_proizvoda, 0) + s.ukupna_kolicina;
 
    -- ------------------------------------------------------------------
    -- 6. Oznaci ORIGINALNI racun kao storniran (ERP ga tretira kao zatvoren)
    --    Namjerno se ne dira sinhronizovano.
    -- ------------------------------------------------------------------
    UPDATE ziralni.racun_gl
    SET storniran_racun = 1
    WHERE sifra_tabele = p_sifra_tabele;
 
    COMMIT;
 
    DO RELEASE_LOCK('lock_sp_racun_unos_json');
 
    SELECT
        0 AS kod,
        CONCAT('Racun br. ', v_broj_racuna_org, ' je uspjesno storniran.') AS poruka,
        v_sifra_tabele_novi AS sifra_tabele,
        v_broj_racuna_novi AS broj_racuna,
        p_sifra_tabele AS sifra_tabele_original;


END$$
DELIMITER ;
