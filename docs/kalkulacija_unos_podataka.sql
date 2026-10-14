-- erp.kalkulacija_unos_podataka(p_json)
--
-- Upis kalkulacije sa ekrana "Ulazi -> Unos kalkulacija" (KalkulacijaUnos.tsx).
--
-- Glavna (noseća) kalkulacija -> jedan red u ziralni.kalkulacija_gl
--   (vrsta_kalkulacije 'KALK') + stavke u ziralni.kalkulacija_po.
-- Svaki račun vezanih troškova (jedan partner = jedan račun) -> jedan red u
--   ziralni.kalkulacija_gl (vrsta_kalkulacije 'ZT'), a stavke tog računa ->
--   redovi u ziralni.zavisan_trosak vezani preko sifra_zavisnog_troska.
--
-- JSON zavisni_troskovi (po računu):
--   { sifra_dobavljaca, broj_racuna, datum, tip_dokumenta_el_kuf,
--     ukupno_km, ukupno_pdv, duzi_se_za_iznos,
--     stavke: [ { sifra_vrste_troska, naziv_troska, napomena, iznos,
--                 obracun_pdv, ino_pdv, iznos_pdv, samo_pdv,
--                 duzi_se_za_iznos } ] }

DROP PROCEDURE IF EXISTS erp.kalkulacija_unos_podataka;

DELIMITER $$

CREATE DEFINER=`root`@`%` PROCEDURE erp.kalkulacija_unos_podataka(
    IN p_json JSON
)
BEGIN
    DECLARE v_glavna INT;
    DECLARE v_naredna INT;
    DECLARE v_zt_sifra INT;
    DECLARE v_lock INT DEFAULT 0;

    DECLARE v_i INT DEFAULT 0;
    DECLARE v_j INT DEFAULT 0;
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_broj_zt INT DEFAULT 0;
    DECLARE v_zt_broj_stavki INT DEFAULT 0;
    DECLARE v_put VARCHAR(100);
    DECLARE v_put_s VARCHAR(150);

    DECLARE v_sifra_proizvoda INT UNSIGNED;
    DECLARE v_kolicina DECIMAL(10,3);
    DECLARE v_cijena DECIMAL(13,5);
    DECLARE v_rabat DECIMAL(10,3);
    DECLARE v_fakturisana DECIMAL(13,5);
    DECLARE v_nabavna DECIMAL(13,5);
    DECLARE v_vpc DECIMAL(10,2);
    DECLARE v_akcijski_rabat DECIMAL(10,3);
    DECLARE v_stornirano INT;

    DECLARE v_datum DATE;
    DECLARE v_dobavljac INT;
    DECLARE v_broj_racuna VARCHAR(254);
    DECLARE v_ukupno DECIMAL(13,2);
    DECLARE v_ukupno_rab DECIMAL(10,3);
    DECLARE v_valuta DATE;
    DECLARE v_kalk_robe SMALLINT;
    DECLARE v_pdv TINYINT;
    DECLARE v_vp_vrednost DECIMAL(10,2);
    DECLARE v_duzi_se DECIMAL(13,2);

    -- ZT račun (kalkulacija_gl)
    DECLARE v_zt_iznos DECIMAL(13,2);
    DECLARE v_zt_datum DATE;
    DECLARE v_zt_dobavljac INT;
    DECLARE v_zt_broj VARCHAR(254);
    DECLARE v_zt_tip VARCHAR(4);
    DECLARE v_zt_duzi_se DECIMAL(13,2);

    -- ZT stavka (zavisan_trosak)
    DECLARE v_zt_st_iznos DECIMAL(13,2);
    DECLARE v_zt_pdv DECIMAL(10,3);
    DECLARE v_zt_naziv VARCHAR(254);
    DECLARE v_zt_vrsta_pdv INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;

        IF v_lock = 1 THEN
            DO RELEASE_LOCK('ziralni_kalkulacija_unos');
        END IF;

        RESIGNAL;
    END;

    -- VALIDACIJA
    IF p_json IS NULL
       OR JSON_TYPE(p_json) <> 'OBJECT' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Neispravan JSON';
    END IF;

    IF COALESCE(
        JSON_TYPE(JSON_EXTRACT(p_json, '$.stavke')),
        ''
    ) <> 'ARRAY' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Stavke moraju biti JSON niz';
    END IF;

    IF JSON_CONTAINS_PATH(
        p_json, 'one', '$.zavisni_troskovi'
    ) = 1
       AND COALESCE(
            JSON_TYPE(JSON_EXTRACT(
                p_json, '$.zavisni_troskovi')),
            ''
       ) <> 'ARRAY' THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Neispravan niz zavisnih troskova';
    END IF;

    -- ZASTITA OD PARALELNIH UNOSA
    SELECT GET_LOCK('ziralni_kalkulacija_unos', 10)
    INTO v_lock;

    IF COALESCE(v_lock,0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Kalkulacija je zauzeta';
    END IF;

    START TRANSACTION;

    -- NOVA SIFRA KALKULACIJE
    SELECT COALESCE(MAX(sifra_kalkulacije),0) + 1
    INTO v_glavna
    FROM ziralni.kalkulacija_gl;

    SET v_naredna = v_glavna;

    -- ZAGLAVLJE
    SET v_datum = JSON_UNQUOTE(
        JSON_EXTRACT(p_json,'$.datum_kalkulacije'));

    SET v_dobavljac = COALESCE(
        JSON_EXTRACT(p_json,'$.sifra_dobavljaca'),-1);

    SET v_broj_racuna = COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(
            p_json,'$.broj_racuna')),'0');

    SET v_ukupno = COALESCE(
        JSON_EXTRACT(p_json,'$.ukupno_km'),0);

    SET v_ukupno_rab = COALESCE(
        JSON_EXTRACT(p_json,'$.ukupno_rab'),0);

    SET v_valuta = JSON_UNQUOTE(
        JSON_EXTRACT(p_json,'$.valuta'));

    SET v_kalk_robe = COALESCE(
        JSON_EXTRACT(p_json,'$.kalkulacija_robe'),0);

    SET v_pdv = COALESCE(
        JSON_EXTRACT(p_json,'$.u_sistemu_pdv'),1);

    SET v_vp_vrednost = COALESCE(
        JSON_EXTRACT(p_json,'$.vp_vrednost'),0);

    -- Iznos zaduženja sa PDV-om (fallback na v_ukupno)
    SET v_duzi_se = COALESCE(
        JSON_EXTRACT(p_json,'$.duzi_se_za_iznos'), v_ukupno);

    IF v_datum IS NULL OR v_dobavljac IS NULL THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Nedostaju podaci zaglavlja';
    END IF;

    -- GLAVNA (NOSECA) KALKULACIJA — vrsta_kalkulacije 'KALK'
    INSERT INTO ziralni.kalkulacija_gl
    (
        sifra_kalkulacije,
        datum_kalkulacije,
        sifra_dobavljaca,
        broj_racuna,
        ukupno_km,
        ukupno_rab,
        datum_unosa_kalkulacije,
        duzi_se_za_iznos,
        racun_placen,
        vreme,
        vrsta_kalkulacije,
        valuta,
        veza,
        kalkulacija_robe,
        vp_vrednost,
        u_sistemu_pdv,
        sifra_knjizenja,
        sinhronizovano,
        tip_dokumenta_el_kuf
    )
    VALUES
    (
        v_glavna,
        v_datum,
        v_dobavljac,
        v_broj_racuna,
        v_ukupno,
        v_ukupno_rab,
        CURRENT_DATE(),
        v_duzi_se,
        0,
        NOW(),
        'KALK',
        v_valuta,
        '0',
        v_kalk_robe,
        v_vp_vrednost,
        v_pdv,
        0,
        0,
        '01'
    );

    -- ========================================
    -- STAVKE KALKULACIJE
    -- ========================================

    SET v_count = JSON_LENGTH(p_json,'$.stavke');
    SET v_i = 0;

    WHILE v_i < v_count DO

        SET v_sifra_proizvoda = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[',v_i,'].sifra_proizvoda'));

        SET v_kolicina = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[',v_i,'].kolicina'));

        SET v_cijena = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[',v_i,'].cijena'));

        SET v_rabat = COALESCE(
            JSON_EXTRACT(p_json,
            CONCAT('$.stavke[',v_i,'].rabat')),0);

        SET v_fakturisana = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[',v_i,'].fakturisana_cijena'));

        SET v_nabavna = COALESCE(
            JSON_EXTRACT(p_json,
            CONCAT('$.stavke[',v_i,'].nasa_ulazna_cijena')),
            v_fakturisana
        );

        SET v_vpc = COALESCE(
            JSON_EXTRACT(p_json,
            CONCAT('$.stavke[',v_i,'].vpc')),0);

        SET v_akcijski_rabat = COALESCE(
            JSON_EXTRACT(p_json,
            CONCAT('$.stavke[',v_i,'].akcijski_rabat')),0);

        SET v_stornirano = COALESCE(
            JSON_EXTRACT(p_json,
            CONCAT('$.stavke[',v_i,'].stornirano')),0);

        IF v_sifra_proizvoda IS NULL
           OR v_kolicina IS NULL
           OR v_kolicina <= 0
           OR v_fakturisana IS NULL
           OR v_fakturisana < 0
           OR v_vpc < 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Neispravna stavka kalkulacije';
        END IF;

        -- UPIS STAVKE
        INSERT INTO ziralni.kalkulacija_po
        (
            sifra_kalkulacije,
            sifra_proizvoda,
            kolicina,
            cijena,
            rabat,
            fakturisana_cijena,
            vpc,
            nasa_ulazna_cijena,
            akcijski_rabat,
            stornirano,
            sinhronizovano
        )
        VALUES
        (
            v_glavna,
            v_sifra_proizvoda,
            v_kolicina,
            v_cijena,
            v_rabat,
            v_fakturisana,
            v_vpc,
            v_nabavna,
            v_akcijski_rabat,
            v_stornirano,
            0
        );

        -- ERP ARTIKLI - PONDERISANJE (preko v_nabavna)
        UPDATE erp.artikli
        SET
            cijena_bez = CASE
                WHEN COALESCE(kolicina_proizvoda,0) <= 0
                    THEN v_nabavna
                ELSE
                    (
                        kolicina_proizvoda
                        * COALESCE(cijena_bez,0)
                        + v_kolicina * v_nabavna
                    )
                    /
                    (kolicina_proizvoda + v_kolicina)
            END,

            kolicina_proizvoda =
                COALESCE(kolicina_proizvoda,0)
                + v_kolicina,

            vpc = CASE WHEN v_kalk_robe = 2 THEN v_vpc ELSE vpc END

        WHERE sifra_proizvoda = v_sifra_proizvoda;

        IF ROW_COUNT() <> 1 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Artikal ne postoji u ERP';
        END IF;

        -- ZIRALNI PROIZVODI - PONDERISANJE (preko v_nabavna)
        UPDATE ziralni.proizvodi
        SET
            cijena_bez = CASE
                WHEN COALESCE(kolicina_proizvoda,0) <= 0
                    THEN v_nabavna
                ELSE
                    (
                        kolicina_proizvoda
                        * COALESCE(cijena_bez,0)
                        + v_kolicina * v_nabavna
                    )
                    /
                    (kolicina_proizvoda + v_kolicina)
            END,

            kolicina_proizvoda =
                COALESCE(kolicina_proizvoda,0)
                + v_kolicina,

            VPC = CASE WHEN v_kalk_robe = 2 THEN v_vpc ELSE VPC END

        WHERE sifra_proizvoda = v_sifra_proizvoda;

        IF ROW_COUNT() <> 1 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Artikal ne postoji u ziralni';
        END IF;

        SET v_i = v_i + 1;

    END WHILE;

    -- ========================================
    -- ZAVISNI TROSKOVI — jedan račun (partner) = jedan red 'ZT' u
    -- kalkulacija_gl, stavke računa = redovi u zavisan_trosak
    -- ========================================

    SET v_broj_zt = COALESCE(
        JSON_LENGTH(p_json,'$.zavisni_troskovi'),0);

    SET v_i = 0;

    WHILE v_i < v_broj_zt DO

        SET v_naredna = v_naredna + 1;
        SET v_zt_sifra = v_naredna;
        SET v_put = CONCAT('$.zavisni_troskovi[',v_i,']');

        SET v_zt_iznos = COALESCE(
            JSON_EXTRACT(p_json, CONCAT(v_put,'.ukupno_km')),0);

        SET v_zt_duzi_se = COALESCE(
            JSON_EXTRACT(p_json, CONCAT(v_put,'.duzi_se_za_iznos')),
            v_zt_iznos);

        SET v_zt_datum = JSON_UNQUOTE(
            JSON_EXTRACT(p_json, CONCAT(v_put,'.datum')));

        SET v_zt_dobavljac = JSON_EXTRACT(
            p_json, CONCAT(v_put,'.sifra_dobavljaca'));

        SET v_zt_broj = JSON_UNQUOTE(
            JSON_EXTRACT(p_json, CONCAT(v_put,'.broj_racuna')));

        SET v_zt_tip = JSON_UNQUOTE(
            JSON_EXTRACT(p_json, CONCAT(v_put,'.tip_dokumenta_el_kuf')));

        SET v_zt_broj_stavki = COALESCE(
            JSON_LENGTH(p_json, CONCAT(v_put,'.stavke')),0);

        IF v_zt_dobavljac IS NULL
           OR v_zt_broj_stavki = 0
           OR v_zt_iznos < 0 THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Neispravan zavisan trosak';
        END IF;

        -- RAČUN ZAVISNOG TROŠKA — vrsta_kalkulacije 'ZT'
        INSERT INTO ziralni.kalkulacija_gl
        (
            sifra_kalkulacije,
            datum_kalkulacije,
            sifra_dobavljaca,
            broj_racuna,
            ukupno_km,
            ukupno_rab,
            datum_unosa_kalkulacije,
            duzi_se_za_iznos,
            racun_placen,
            vreme,
            vrsta_kalkulacije,
            valuta,
            veza,
            kalkulacija_robe,
            vp_vrednost,
            u_sistemu_pdv,
            sifra_knjizenja,
            sinhronizovano,
            tip_dokumenta_el_kuf
        )
        VALUES
        (
            v_zt_sifra,
            COALESCE(v_zt_datum,v_datum),
            v_zt_dobavljac,
            COALESCE(v_zt_broj,'0'),
            v_zt_iznos,
            0,
            CURRENT_DATE(),
            v_zt_duzi_se,
            0,
            NOW(),
            'ZT',
            v_valuta,
            '0',
            0,
            0,
            v_pdv,
            0,
            0,
            COALESCE(v_zt_tip,'01')
        );

        -- STAVKE RAČUNA -> zavisan_trosak
        SET v_j = 0;

        WHILE v_j < v_zt_broj_stavki DO

            SET v_put_s = CONCAT(v_put,'.stavke[',v_j,']');

            SET v_zt_st_iznos = COALESCE(
                JSON_EXTRACT(p_json, CONCAT(v_put_s,'.iznos')),0);

            SET v_zt_pdv = COALESCE(
                JSON_EXTRACT(p_json, CONCAT(v_put_s,'.iznos_pdv')),0);

            SET v_zt_naziv = COALESCE(
                NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p_json,
                    CONCAT(v_put_s,'.naziv_troska'))), ''),
                'Zavisan trosak'
            );

            SET v_zt_vrsta_pdv = COALESCE(
                JSON_EXTRACT(p_json, CONCAT(v_put_s,'.ino_pdv')),0);

            IF v_zt_st_iznos < 0 OR v_zt_pdv < 0 THEN
                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Neispravna stavka zavisnog troska';
            END IF;

            INSERT INTO ziralni.zavisan_trosak
            (
                sifra_kalkulacije,
                naziv_troska,
                ukupno_km,
                ukupno_pdv,
                sifra_zavisnog_troska,
                vrsta_pdv,
                sinhronizovano
            )
            VALUES
            (
                v_glavna,
                v_zt_naziv,
                v_zt_st_iznos,
                v_zt_pdv,
                v_zt_sifra,
                v_zt_vrsta_pdv,
                0
            );

            SET v_j = v_j + 1;

        END WHILE;

        SET v_i = v_i + 1;

    END WHILE;

    COMMIT;

    DO RELEASE_LOCK('ziralni_kalkulacija_unos');
    SET v_lock = 0;

    SELECT
        1 AS success,
        v_glavna AS sifra_kalkulacije,
        v_count AS broj_stavki,
        v_broj_zt AS broj_zavisnih_troskova,
        v_naredna AS posljednja_sifra_kalkulacije;

END$$

DELIMITER ;
