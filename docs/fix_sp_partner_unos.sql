-- Fix: "Illegal mix of collations" u erp.sp_partner_unos
-- Uzrok 1: NULLIF(json->>'$.x', 'null') poredi utf8mb4_0900_ai_ci (JSON ->>) sa
--          utf8mb4_unicode_ci (literal 'null') -> dodat COLLATE utf8mb4_unicode_ci
-- Uzrok 2: tmp_pos_map.sifra nije imao eksplicitnu kolaciju pa je naslijedio
--          default kolaciju seme erp (utf8mb4_0900_ai_ci) umjesto utf8mb4_unicode_ci

DROP PROCEDURE IF EXISTS erp.sp_partner_unos;
DELIMITER $$
CREATE PROCEDURE erp.sp_partner_unos(
    IN p_json JSON
)
proc: BEGIN
    DECLARE v_partner_id     INT UNSIGNED;
    DECLARE v_naziv          VARCHAR(200);
    DECLARE v_jib            VARCHAR(13);
    DECLARE v_pib            VARCHAR(12);

    DECLARE v_i              INT DEFAULT 0;
    DECLARE v_cnt            INT DEFAULT 0;
    DECLARE v_item           JSON;

    DECLARE v_broj_orig      VARCHAR(30);
    DECLARE v_broj_norm      VARCHAR(20);
    DECLARE v_pos_sifra      VARCHAR(20);
    DECLARE v_pos_id         INT UNSIGNED;
    DECLARE v_kon_index      INT;
    DECLARE v_kon_id         INT UNSIGNED;

    DECLARE v_err_msg        VARCHAR(500);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        GET DIAGNOSTICS CONDITION 1 v_err_msg = MESSAGE_TEXT;
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_pos_map;
        DROP TEMPORARY TABLE IF EXISTS tmp_kon_map;
        SELECT 0 AS status,
               CONCAT('Greska: ', v_err_msg) AS poruka,
               NULL AS partner_id;
    END;

    IF p_json IS NULL THEN
        SELECT 0 AS status, 'JSON parametar je obavezan.' AS poruka, NULL AS partner_id;
        LEAVE proc;
    END IF;

    SET v_naziv      = NULLIF(p_json->>'$.naziv' COLLATE utf8mb4_unicode_ci, 'null');
    SET v_jib        = NULLIF(p_json->>'$.jib'   COLLATE utf8mb4_unicode_ci, 'null');
    SET v_pib        = NULLIF(p_json->>'$.pib'   COLLATE utf8mb4_unicode_ci, 'null');
    SET v_partner_id = NULLIF(p_json->>'$.partner_id' COLLATE utf8mb4_unicode_ci, 'null');

    IF v_naziv IS NULL OR v_naziv = '' THEN
        SELECT 0 AS status, 'Naziv partnera je obavezan.' AS poruka, NULL AS partner_id;
        LEAVE proc;
    END IF;

    IF v_partner_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM erp.partneri WHERE partner_id = v_partner_id) THEN
        SELECT 0 AS status,
               CONCAT('Partner sa ID-om ', v_partner_id, ' vec postoji.') AS poruka,
               NULL AS partner_id;
        LEAVE proc;
    END IF;

    IF v_jib IS NOT NULL AND v_jib <> ''
       AND EXISTS (SELECT 1 FROM erp.partneri WHERE jib = v_jib) THEN
        SELECT 0 AS status,
               CONCAT('Partner sa JIB-om "', v_jib, '" vec postoji.') AS poruka,
               NULL AS partner_id;
        LEAVE proc;
    END IF;

    START TRANSACTION;

    IF v_partner_id IS NULL THEN
        SELECT IFNULL(MAX(partner_id), 0) + 1
          INTO v_partner_id
          FROM erp.partneri
         FOR UPDATE;
    END IF;

    INSERT INTO erp.partneri (
        partner_id, naziv, skraceni_naziv, jib, pib, pdv_obveznik,
        maticni_broj, tip_partnera, adresa, grad, postanski_broj,
        drzava, valuta_placanja, limit_duga, rabat_procenat,
        napomena, kreirao
    ) VALUES (
        v_partner_id,
        v_naziv,
        NULLIF(p_json->>'$.skraceni_naziv' COLLATE utf8mb4_unicode_ci, 'null'),
        v_jib,
        v_pib,
        IFNULL(NULLIF(p_json->>'$.pdv_obveznik' COLLATE utf8mb4_unicode_ci, 'null'), 0),
        NULLIF(p_json->>'$.maticni_broj' COLLATE utf8mb4_unicode_ci, 'null'),
        IFNULL(NULLIF(p_json->>'$.tip_partnera' COLLATE utf8mb4_unicode_ci, 'null'), 'kupac'),
        NULLIF(p_json->>'$.adresa' COLLATE utf8mb4_unicode_ci, 'null'),
        NULLIF(p_json->>'$.grad' COLLATE utf8mb4_unicode_ci, 'null'),
        NULLIF(p_json->>'$.postanski_broj' COLLATE utf8mb4_unicode_ci, 'null'),
        IFNULL(NULLIF(p_json->>'$.drzava' COLLATE utf8mb4_unicode_ci, 'null'), 'BiH'),
        IFNULL(NULLIF(p_json->>'$.valuta_placanja' COLLATE utf8mb4_unicode_ci, 'null'), 0),
        NULLIF(p_json->>'$.limit_duga' COLLATE utf8mb4_unicode_ci, 'null'),
        IFNULL(NULLIF(p_json->>'$.rabat_procenat' COLLATE utf8mb4_unicode_ci, 'null'), 0.00),
        NULLIF(p_json->>'$.napomena' COLLATE utf8mb4_unicode_ci, 'null'),
        NULLIF(p_json->>'$.kreirao' COLLATE utf8mb4_unicode_ci, 'null')
    );

    DROP TEMPORARY TABLE IF EXISTS tmp_pos_map;
    CREATE TEMPORARY TABLE tmp_pos_map (
        sifra VARCHAR(20) COLLATE utf8mb4_unicode_ci PRIMARY KEY,
        poslovnica_id INT UNSIGNED
    ) ENGINE=MEMORY;

    DROP TEMPORARY TABLE IF EXISTS tmp_kon_map;
    CREATE TEMPORARY TABLE tmp_kon_map (
        idx INT PRIMARY KEY,
        kontakt_id INT UNSIGNED
    ) ENGINE=MEMORY;

    SET v_cnt = IFNULL(JSON_LENGTH(p_json, '$.poslovnice'), 0);
    SET v_i = 0;

    WHILE v_i < v_cnt DO
        SET v_item = JSON_EXTRACT(p_json, CONCAT('$.poslovnice[', v_i, ']'));

        INSERT INTO erp.partneri_poslovnice (
            partner_id, sifra, naziv, jib, adresa, grad,
            postanski_broj, glavna, napomena
        ) VALUES (
            v_partner_id,
            v_item->>'$.sifra',
            v_item->>'$.naziv',
            NULLIF(v_item->>'$.jib' COLLATE utf8mb4_unicode_ci, 'null'),
            NULLIF(v_item->>'$.adresa' COLLATE utf8mb4_unicode_ci, 'null'),
            NULLIF(v_item->>'$.grad' COLLATE utf8mb4_unicode_ci, 'null'),
            NULLIF(v_item->>'$.postanski_broj' COLLATE utf8mb4_unicode_ci, 'null'),
            IFNULL(NULLIF(v_item->>'$.glavna' COLLATE utf8mb4_unicode_ci, 'null'), 0),
            NULLIF(v_item->>'$.napomena' COLLATE utf8mb4_unicode_ci, 'null')
        );

        INSERT INTO tmp_pos_map (sifra, poslovnica_id)
        VALUES (v_item->>'$.sifra', LAST_INSERT_ID());

        SET v_i = v_i + 1;
    END WHILE;

    SET v_cnt = IFNULL(JSON_LENGTH(p_json, '$.kontakti'), 0);
    SET v_i = 0;

    WHILE v_i < v_cnt DO
        SET v_item = JSON_EXTRACT(p_json, CONCAT('$.kontakti[', v_i, ']'));

        SET v_pos_sifra = NULLIF(v_item->>'$.poslovnica_sifra' COLLATE utf8mb4_unicode_ci, 'null');
        SET v_pos_id = NULL;
        IF v_pos_sifra IS NOT NULL THEN
            SELECT poslovnica_id INTO v_pos_id
            FROM tmp_pos_map WHERE sifra = v_pos_sifra LIMIT 1;
        END IF;

        INSERT INTO erp.partneri_kontakti (
            partner_id, poslovnica_id, ime, prezime, funkcija, napomena
        ) VALUES (
            v_partner_id,
            v_pos_id,
            v_item->>'$.ime',
            NULLIF(v_item->>'$.prezime' COLLATE utf8mb4_unicode_ci, 'null'),
            NULLIF(v_item->>'$.funkcija' COLLATE utf8mb4_unicode_ci, 'null'),
            NULLIF(v_item->>'$.napomena' COLLATE utf8mb4_unicode_ci, 'null')
        );

        INSERT INTO tmp_kon_map (idx, kontakt_id)
        VALUES (v_i, LAST_INSERT_ID());

        SET v_i = v_i + 1;
    END WHILE;

    SET v_cnt = IFNULL(JSON_LENGTH(p_json, '$.telefoni'), 0);
    SET v_i = 0;

    WHILE v_i < v_cnt DO
        SET v_item = JSON_EXTRACT(p_json, CONCAT('$.telefoni[', v_i, ']'));

        SET v_broj_orig = v_item->>'$.broj';
        SET v_broj_norm = REGEXP_REPLACE(v_broj_orig, '[^0-9]', '');

        IF LEFT(v_broj_norm, 1) = '0' AND LEFT(v_broj_norm, 2) <> '00' THEN
            SET v_broj_norm = CONCAT('387', SUBSTRING(v_broj_norm, 2));
        END IF;
        IF LEFT(v_broj_norm, 2) = '00' THEN
            SET v_broj_norm = SUBSTRING(v_broj_norm, 3);
        END IF;

        IF EXISTS (SELECT 1 FROM erp.partneri_telefoni
                   WHERE broj_normalizovan = v_broj_norm) THEN
            ROLLBACK;
            DROP TEMPORARY TABLE IF EXISTS tmp_pos_map;
            DROP TEMPORARY TABLE IF EXISTS tmp_kon_map;
            SELECT 0 AS status,
                   CONCAT('Broj telefona "', v_broj_orig,
                          '" vec postoji kod drugog partnera.') AS poruka,
                   NULL AS partner_id;
            LEAVE proc;
        END IF;

        SET v_pos_sifra = NULLIF(v_item->>'$.poslovnica_sifra' COLLATE utf8mb4_unicode_ci, 'null');
        SET v_pos_id = NULL;
        IF v_pos_sifra IS NOT NULL THEN
            SELECT poslovnica_id INTO v_pos_id
            FROM tmp_pos_map WHERE sifra = v_pos_sifra LIMIT 1;
        END IF;

        SET v_kon_index = NULLIF(v_item->>'$.kontakt_index' COLLATE utf8mb4_unicode_ci, 'null');
        SET v_kon_id = NULL;
        IF v_kon_index IS NOT NULL THEN
            SELECT kontakt_id INTO v_kon_id
            FROM tmp_kon_map WHERE idx = v_kon_index LIMIT 1;
        END IF;

        INSERT INTO erp.partneri_telefoni (
            partner_id, poslovnica_id, kontakt_id,
            broj_original, broj_normalizovan, tip, primarni, napomena
        ) VALUES (
            v_partner_id,
            v_pos_id,
            v_kon_id,
            v_broj_orig,
            v_broj_norm,
            IFNULL(NULLIF(v_item->>'$.tip' COLLATE utf8mb4_unicode_ci, 'null'), 'fiksni'),
            IFNULL(NULLIF(v_item->>'$.primarni' COLLATE utf8mb4_unicode_ci, 'null'), 0),
            NULLIF(v_item->>'$.napomena' COLLATE utf8mb4_unicode_ci, 'null')
        );

        SET v_i = v_i + 1;
    END WHILE;

    COMMIT;

    DROP TEMPORARY TABLE IF EXISTS tmp_pos_map;
    DROP TEMPORARY TABLE IF EXISTS tmp_kon_map;

    SELECT 1 AS status,
           CONCAT('Partner "', v_naziv, '" uspjesno unesen.') AS poruka,
           v_partner_id AS partner_id;

END$$
DELIMITER ;
