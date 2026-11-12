-- Promjena partnera na uplati izvoda — dozvoljeno za bilo kojeg partnera
-- (ne samo -1). Izmjene gdje stari partner nije -1 server bilježi u
-- logs/izvodi_promjena_partnera.log.
-- JSON: { "sifra_uplate": 12548, "sifra_partnera": 325 }

DROP PROCEDURE IF EXISTS erp.izvodi_uplate_partneri_promjena;

DELIMITER $$

CREATE DEFINER=`root`@`%` PROCEDURE erp.izvodi_uplate_partneri_promjena(
    IN p_json JSON
)
BEGIN
    DECLARE v_sifra_uplate BIGINT;
    DECLARE v_sifra_partnera INT;
    DECLARE v_trenutni_partner INT;
    DECLARE v_postoji_partner INT DEFAULT 0;

    SET v_sifra_uplate = CAST(
        JSON_UNQUOTE(JSON_EXTRACT(p_json, '$.sifra_uplate'))
        AS UNSIGNED
    );

    SET v_sifra_partnera = CAST(
        JSON_UNQUOTE(JSON_EXTRACT(p_json, '$.sifra_partnera'))
        AS SIGNED
    );

    IF v_sifra_uplate IS NULL
       OR v_sifra_partnera IS NULL
       OR v_sifra_partnera <= 0 THEN

        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Neispravna sifra uplate ili partnera';

    END IF;

    SELECT sifra_partnera
    INTO v_trenutni_partner
    FROM ziralni.uplate
    WHERE sifra_uplate = v_sifra_uplate
    LIMIT 1;

    IF v_trenutni_partner IS NULL THEN

        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Uplata ne postoji ili nema dodijeljenog partnera';

    END IF;

    SELECT COUNT(*)
    INTO v_postoji_partner
    FROM ziralni.partneri
    WHERE sifra_partnera = v_sifra_partnera;

    IF v_postoji_partner = 0 THEN

        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Izabrani partner ne postoji';

    END IF;

    UPDATE ziralni.uplate
    SET sifra_partnera = v_sifra_partnera,
        sinhronizovano = 0
    WHERE sifra_uplate = v_sifra_uplate;

    SELECT
        'Partner uspjesno promijenjen' AS poruka,
        v_sifra_uplate AS sifra_uplate,
        v_trenutni_partner AS stari_partner,
        v_sifra_partnera AS sifra_partnera;

END$$

DELIMITER ;
