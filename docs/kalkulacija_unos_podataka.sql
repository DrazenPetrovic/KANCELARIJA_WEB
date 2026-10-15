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
--   { kalkulacija_robe, sifra_dobavljaca, broj_racuna, datum,
--     tip_dokumenta_el_kuf, ukupno_km, ukupno_pdv, duzi_se_za_iznos,
--     stavke: [ { sifra_vrste_troska, naziv_troska, napomena, iznos,
--                 obracun_pdv, ino_pdv, iznos_pdv, samo_pdv,
--                 duzi_se_za_iznos } ] }
--
-- UIO (samo_pdv = 1): uplaćeni PDV ide u iznos / ukupno_km i duzi_se_za_iznos,
--   a iznos_pdv / ukupno_pdv je 0 (na PDV se ne obračunava PDV).
-- Zbir stavki (iznos) mora odgovarati ukupno_km računa (tolerancija 0.02).

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
    DECLARE v_broj_stavki_zt INT DEFAULT 0;

    -- GLAVNA KALKULACIJA
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

    -- ARTIKLI
    DECLARE v_sifra_proizvoda INT UNSIGNED;
    DECLARE v_kolicina DECIMAL(10,3);
    DECLARE v_cijena DECIMAL(13,5);
    DECLARE v_rabat DECIMAL(10,3);
    DECLARE v_fakturisana DECIMAL(13,5);
    DECLARE v_nabavna DECIMAL(13,5);
    DECLARE v_vpc DECIMAL(10,2);
    DECLARE v_akcijski_rabat DECIMAL(10,3);
    DECLARE v_stornirano INT;

    -- DOKUMENT ZAVISNOG TROSKA
    DECLARE v_zt_iznos DECIMAL(13,2);
    DECLARE v_zt_pdv DECIMAL(13,2);
    DECLARE v_zt_datum DATE;
    DECLARE v_zt_dobavljac INT;
    DECLARE v_zt_broj VARCHAR(254);
    DECLARE v_zt_tip VARCHAR(4);
    DECLARE v_zt_duzi_se DECIMAL(13,2);
    DECLARE v_zt_kalk_robe SMALLINT;

    -- STAVKE ZAVISNOG TROSKA
    DECLARE v_zt_naziv VARCHAR(254);
    DECLARE v_stavka_iznos DECIMAL(13,2);
    DECLARE v_stavka_pdv DECIMAL(13,3);
    DECLARE v_stavka_ino_pdv INT;
    DECLARE v_zbir_stavki DECIMAL(15,2);

    DECLARE v_ukupno_stavki_zt INT DEFAULT 0;

    -- OBRADA GRESAKA
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN

        ROLLBACK;

        IF v_lock = 1 THEN
            DO RELEASE_LOCK('ziralni_kalkulacija_unos');
        END IF;

        RESIGNAL;

    END;

    -- ==========================================
    -- 1. VALIDACIJA JSON-a
    -- ==========================================

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
        p_json,
        'one',
        '$.zavisni_troskovi'
    ) = 1
    AND COALESCE(
        JSON_TYPE(
            JSON_EXTRACT(p_json, '$.zavisni_troskovi')
        ),
        ''
    ) <> 'ARRAY' THEN

        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Neispravan niz zavisnih troskova';

    END IF;

    -- ==========================================
    -- 2. ZASTITA OD PARALELNIH UNOSA
    -- ==========================================

    SELECT GET_LOCK('ziralni_kalkulacija_unos', 10)
    INTO v_lock;

    IF COALESCE(v_lock, 0) <> 1 THEN

        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Kalkulacija je zauzeta';

    END IF;

    START TRANSACTION;

    -- ==========================================
    -- 3. NOVA SIFRA KALKULACIJE
    -- ==========================================

    SELECT COALESCE(MAX(sifra_kalkulacije), 0) + 1
    INTO v_glavna
    FROM ziralni.kalkulacija_gl;

    SET v_naredna = v_glavna;

    -- ==========================================
    -- 4. PODACI GLAVNE KALKULACIJE
    -- ==========================================

    SET v_datum = JSON_UNQUOTE(
        JSON_EXTRACT(p_json, '$.datum_kalkulacije')
    );

    SET v_dobavljac = JSON_EXTRACT(
        p_json, '$.sifra_dobavljaca'
    );

    SET v_broj_racuna = COALESCE(
        JSON_UNQUOTE(
            JSON_EXTRACT(p_json, '$.broj_racuna')
        ),
        '0'
    );

    SET v_ukupno = COALESCE(
        JSON_EXTRACT(p_json, '$.ukupno_km'), 0
    );

    SET v_ukupno_rab = COALESCE(
        JSON_EXTRACT(p_json, '$.ukupno_rab'), 0
    );

    SET v_valuta = JSON_UNQUOTE(
        JSON_EXTRACT(p_json, '$.valuta')
    );

    SET v_kalk_robe = COALESCE(
        JSON_EXTRACT(p_json, '$.kalkulacija_robe'), 0
    );

    SET v_pdv = COALESCE(
        JSON_EXTRACT(p_json, '$.u_sistemu_pdv'), 1
    );

    SET v_vp_vrednost = COALESCE(
        JSON_EXTRACT(p_json, '$.vp_vrednost'), 0
    );

    SET v_duzi_se = COALESCE(
        JSON_EXTRACT(p_json, '$.duzi_se_za_iznos'),
        v_ukupno
    );

    IF v_datum IS NULL
       OR v_dobavljac IS NULL THEN

        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Nedostaju podaci zaglavlja';

    END IF;

    -- ==========================================
    -- 5. UPIS GLAVNE KALKULACIJE
    -- ==========================================

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

    -- ==========================================
    -- 6. STAVKE GLAVNE KALKULACIJE
    -- ==========================================

    SET v_count = JSON_LENGTH(p_json, '$.stavke');
    SET v_i = 0;

    WHILE v_i < v_count DO

        SET v_sifra_proizvoda = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[', v_i, '].sifra_proizvoda')
        );

        SET v_kolicina = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[', v_i, '].kolicina')
        );

        SET v_cijena = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[', v_i, '].cijena')
        );

        SET v_rabat = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT('$.stavke[', v_i, '].rabat')
            ), 0
        );

        SET v_fakturisana = JSON_EXTRACT(
            p_json,
            CONCAT('$.stavke[', v_i, '].fakturisana_cijena')
        );

        SET v_nabavna = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT('$.stavke[', v_i, '].nasa_ulazna_cijena')
            ),
            v_fakturisana
        );

        SET v_vpc = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT('$.stavke[', v_i, '].vpc')
            ), 0
        );

        SET v_akcijski_rabat = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT('$.stavke[', v_i, '].akcijski_rabat')
            ), 0
        );

        SET v_stornirano = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT('$.stavke[', v_i, '].stornirano')
            ), 0
        );

        IF v_sifra_proizvoda IS NULL
           OR v_kolicina IS NULL
           OR v_kolicina <= 0
           OR v_fakturisana IS NULL
           OR v_fakturisana < 0
           OR v_nabavna IS NULL
           OR v_nabavna < 0
           OR v_vpc < 0 THEN

            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Neispravna stavka kalkulacije';

        END IF;

        -- UPIS STAVKE ROBE

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

        -- ======================================
        -- ERP ARTIKLI - PONDERISANJE
        -- SAMO ZA GLAVNU KALKULACIJU ROBE
        -- ======================================

        UPDATE erp.artikli
        SET
            cijena_bez = CASE
                WHEN COALESCE(kolicina_proizvoda, 0) <= 0
                    THEN v_nabavna
                ELSE
                    (
                        kolicina_proizvoda
                        * COALESCE(cijena_bez, 0)
                        + v_kolicina * v_nabavna
                    )
                    /
                    (kolicina_proizvoda + v_kolicina)
            END,

            kolicina_proizvoda =
                COALESCE(kolicina_proizvoda, 0)
                + v_kolicina,

            vpc = CASE
                WHEN v_kalk_robe = 2
                    THEN v_vpc
                ELSE vpc
            END

        WHERE sifra_proizvoda = v_sifra_proizvoda;

        IF ROW_COUNT() <> 1 THEN

            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Artikal ne postoji u ERP';

        END IF;

        -- ======================================
        -- ZIRALNI PROIZVODI - PONDERISANJE
        -- SAMO ZA GLAVNU KALKULACIJU ROBE
        -- ======================================

        UPDATE ziralni.proizvodi
        SET
            cijena_bez = CASE
                WHEN COALESCE(kolicina_proizvoda, 0) <= 0
                    THEN v_nabavna
                ELSE
                    (
                        kolicina_proizvoda
                        * COALESCE(cijena_bez, 0)
                        + v_kolicina * v_nabavna
                    )
                    /
                    (kolicina_proizvoda + v_kolicina)
            END,

            kolicina_proizvoda =
                COALESCE(kolicina_proizvoda, 0)
                + v_kolicina,

            VPC = CASE
                WHEN v_kalk_robe = 2
                    THEN v_vpc
                ELSE VPC
            END

        WHERE sifra_proizvoda = v_sifra_proizvoda;

        IF ROW_COUNT() <> 1 THEN

            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Artikal ne postoji u ziralni';

        END IF;

        SET v_i = v_i + 1;

    END WHILE;

    -- ==========================================
    -- 7. ZAVISNI TROSKOVI
    -- ISKLJUCIVO KNJIGOVODSTVENI UNOS
    -- ==========================================

    SET v_broj_zt = COALESCE(
        JSON_LENGTH(p_json, '$.zavisni_troskovi'), 0
    );

    SET v_i = 0;

    WHILE v_i < v_broj_zt DO

        -- JEDAN DOKUMENT ZAVISNOG TROSKA
        -- DOBIJA JEDNU SIFRU KALKULACIJE

        SET v_naredna = v_naredna + 1;
        SET v_zt_sifra = v_naredna;

        -- UKUPAN IZNOS FAKTURE

        SET v_zt_iznos = JSON_EXTRACT(
            p_json,
            CONCAT(
                '$.zavisni_troskovi[',
                v_i,
                '].ukupno_km'
            )
        );

        SET v_zt_pdv = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT(
                    '$.zavisni_troskovi[',
                    v_i,
                    '].ukupno_pdv'
                )
            ), 0
        );

        SET v_zt_datum = JSON_UNQUOTE(
            JSON_EXTRACT(
                p_json,
                CONCAT(
                    '$.zavisni_troskovi[',
                    v_i,
                    '].datum'
                )
            )
        );

        SET v_zt_dobavljac = JSON_EXTRACT(
            p_json,
            CONCAT(
                '$.zavisni_troskovi[',
                v_i,
                '].sifra_dobavljaca'
            )
        );

        SET v_zt_broj = JSON_UNQUOTE(
            JSON_EXTRACT(
                p_json,
                CONCAT(
                    '$.zavisni_troskovi[',
                    v_i,
                    '].broj_racuna'
                )
            )
        );

        SET v_zt_tip = JSON_UNQUOTE(
            JSON_EXTRACT(
                p_json,
                CONCAT(
                    '$.zavisni_troskovi[',
                    v_i,
                    '].tip_dokumenta_el_kuf'
                )
            )
        );

        SET v_zt_duzi_se = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT(
                    '$.zavisni_troskovi[',
                    v_i,
                    '].duzi_se_za_iznos'
                )
            ),
            v_zt_iznos
        );

        SET v_zt_kalk_robe = COALESCE(
            JSON_EXTRACT(
                p_json,
                CONCAT(
                    '$.zavisni_troskovi[',
                    v_i,
                    '].kalkulacija_robe'
                )
            ), 0
        );

        -- VALIDACIJA DOKUMENTA

        IF v_zt_iznos IS NULL
           OR v_zt_iznos < 0
           OR v_zt_dobavljac IS NULL
           OR v_zt_broj IS NULL
           OR v_zt_duzi_se < 0 THEN

            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Neispravan zavisan trosak';

        END IF;

        -- PROVJERA DA STAVKE POSTOJE

        IF COALESCE(
            JSON_TYPE(
                JSON_EXTRACT(
                    p_json,
                    CONCAT(
                        '$.zavisni_troskovi[',
                        v_i,
                        '].stavke'
                    )
                )
            ),
            ''
        ) <> 'ARRAY' THEN

            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Nedostaju stavke zavisnog troska';

        END IF;

        SET v_broj_stavki_zt = JSON_LENGTH(
            p_json,
            CONCAT(
                '$.zavisni_troskovi[',
                v_i,
                '].stavke'
            )
        );

        IF v_broj_stavki_zt = 0 THEN

            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Prazna faktura zavisnog troska';

        END IF;

        -- ======================================
        -- 8. UPIS JEDNE FAKTURE DOBAVLJACA
        -- ======================================

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
            COALESCE(v_zt_datum, v_datum),
            v_zt_dobavljac,
            v_zt_broj,
            v_zt_iznos,
            0,
            CURRENT_DATE(),
            v_zt_duzi_se,
            0,
            NOW(),
            'ZT',
            v_valuta,
            '0',
            v_zt_kalk_robe,
            0,
            v_pdv,
            0,
            0,
            COALESCE(v_zt_tip, '01')
        );

        -- ======================================
        -- 9. POJEDINACNE STAVKE FAKTURE
        -- ======================================

        SET v_j = 0;
        SET v_zbir_stavki = 0;

        WHILE v_j < v_broj_stavki_zt DO

            SET v_zt_naziv = JSON_UNQUOTE(
                JSON_EXTRACT(
                    p_json,
                    CONCAT(
                        '$.zavisni_troskovi[',
                        v_i,
                        '].stavke[',
                        v_j,
                        '].naziv_troska'
                    )
                )
            );

            SET v_stavka_iznos = JSON_EXTRACT(
                p_json,
                CONCAT(
                    '$.zavisni_troskovi[',
                    v_i,
                    '].stavke[',
                    v_j,
                    '].iznos'
                )
            );

            SET v_stavka_pdv = COALESCE(
                JSON_EXTRACT(
                    p_json,
                    CONCAT(
                        '$.zavisni_troskovi[',
                        v_i,
                        '].stavke[',
                        v_j,
                        '].iznos_pdv'
                    )
                ), 0
            );

            SET v_stavka_ino_pdv = COALESCE(
                JSON_EXTRACT(
                    p_json,
                    CONCAT(
                        '$.zavisni_troskovi[',
                        v_i,
                        '].stavke[',
                        v_j,
                        '].ino_pdv'
                    )
                ), 0
            );

            -- VALIDACIJA POJEDINACNE STAVKE

            IF v_stavka_iznos IS NULL
               OR v_stavka_iznos < 0
               OR v_zt_naziv IS NULL
               OR TRIM(v_zt_naziv) = '' THEN

                SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT =
                    'Neispravna stavka zavisnog troska';

            END IF;

            SET v_zbir_stavki =
                v_zbir_stavki + v_stavka_iznos;

            -- UPIS POJEDINACNE STAVKE

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
                v_stavka_iznos,
                v_stavka_pdv,
                v_zt_sifra,
                v_stavka_ino_pdv,
                0
            );

            SET v_ukupno_stavki_zt =
                v_ukupno_stavki_zt + 1;

            SET v_j = v_j + 1;

        END WHILE;

        -- ======================================
        -- 10. KONTROLA UKUPNOG IZNOSA FAKTURE
        -- ======================================

        IF ABS(v_zbir_stavki - v_zt_iznos) > 0.02 THEN

            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT =
                'Zbir stavki zavisnog troska ne odgovara fakturi';

        END IF;

        SET v_i = v_i + 1;

    END WHILE;

    -- ==========================================
    -- 11. POTVRDA TRANSAKCIJE
    -- ==========================================

    COMMIT;

    DO RELEASE_LOCK('ziralni_kalkulacija_unos');
    SET v_lock = 0;

    -- ==========================================
    -- 12. POVRATNI PODACI
    -- ==========================================

    SELECT
        1 AS success,
        v_glavna AS sifra_kalkulacije,
        v_count AS broj_stavki,
        v_broj_zt AS broj_zavisnih_troskova,
        v_ukupno_stavki_zt AS broj_stavki_zavisnih_troskova,
        v_naredna AS posljednja_sifra_kalkulacije;

END$$

DELIMITER ;
