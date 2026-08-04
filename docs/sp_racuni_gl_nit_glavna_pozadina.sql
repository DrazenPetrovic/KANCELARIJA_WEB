-- Dvofazno ucitavanje "Pregled racuna" (racuniPregled.tsx) radi brzine sa velikom
-- kolicinom podataka. Koncept:
--   1) Aplikacija zove sp_racuni_gl_stats() -> dobije max_sifra.
--   2) granica = max_sifra - 200
--   3) Glavna nit (UI, blokira formu) zove sp_racuni_gl_nit_glavna(granica)
--      -> vraca ~200 najnovijih racuna (sifra_tabele > granica), forma se odmah otvara.
--   4) Pozadinska nit paralelno zove sp_racuni_gl_nit_pozadina(granica)
--      -> vraca SVE starije racune (sifra_tabele <= granica); kad zavrsi, frontend
--         dopisuje te redove u vec prikazanu tabelu.
--
-- Obje procedure koriste ISTU temp-tabelu strukturu (38 kolona) i ISTI izvor
-- (ziralni.q_racun_gl) kao postojeca erp.sp_racuni_gl_pregled() i postojeca
-- erp.sp_racuni_gl_stats() — razlika je samo WHERE uslov na sifra_tabele umjesto
-- fiksnog "ORDER BY sifra_tabele DESC LIMIT 200".

DROP PROCEDURE IF EXISTS erp.sp_racuni_gl_nit_glavna;
DELIMITER $$
CREATE PROCEDURE erp.sp_racuni_gl_nit_glavna(
    IN p_granica INT
)
BEGIN
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_racuni_glavna (
        sifra_tabele            INT UNSIGNED,
        sifra_radnika           INT UNSIGNED,
        naziv_radnika           VARCHAR(45),
        broj_racuna             INT,
        vrsta_racuna            VARCHAR(10),
        vrsta_racuna_novi       TINYINT(4),
        vrsta_racuna_pod        INT,
        vrsta_racuna_novo       VARCHAR(100),
        sifra_knjizenja         INT,
        racun_roba              SMALLINT(6),
        sifra_terena            INT,
        datum_racuna            DATE,
        valuta                  DATE,
        vreme                   DATETIME,
        datum_isporuke          DATE,
        sifra_partnera          INT UNSIGNED,
        naziv_partnera          VARCHAR(254),
        adresa_partnera         VARCHAR(254),
        naziv_grada             VARCHAR(100),
        entitet                 VARCHAR(50),
        ptt                     VARCHAR(20),
        jib                     VARCHAR(50),
        pib                     VARCHAR(50),
        napomena                VARCHAR(254),
        vrednost                DECIMAL(10,2),
        vp1                     DECIMAL(10,2),
        rab1                    DECIMAL(10,2),
        vp2                     DECIMAL(10,2),
        rab2                    DECIMAL(10,2),
        rab3                    DECIMAL(10,2),
        osnova_za_obracun_pdv   DECIMAL(10,2),
        pdv                     DECIMAL(10,2),
        ukupno                  DECIMAL(10,2),
        rabat_km                DECIMAL(10,2),
        slovima                 VARCHAR(254),
        br_fiskalnog            VARCHAR(50),
        datum_vreme_fiskalnog   VARCHAR(100),
        storniran_racun         TINYINT(1),
        racun_placen            VARCHAR(2)
    );

    TRUNCATE TABLE tmp_racuni_glavna;

    INSERT INTO tmp_racuni_glavna
    SELECT
        v.sifra_tabele,
        v.sifra_radnika,
        v.Naziv_radnika,
        v.broj_racuna,
        v.vrsta_racuna,
        v.vrsta_racuna_novi,
        v.vrsta_racuna_pod,
        v.vrsta_racuna_novo,
        v.sifra_knjizenja,
        v.racun_roba,
        v.sifra_terena,
        v.datum_racuna,
        v.valuta,
        v.vreme,
        v.datum_isporuke,
        v.sifra_partnera,
        v.naziv_partnera,
        v.adresa_partnera,
        v.Naziv_grada,
        v.Entitet,
        v.PTT,
        v.JIB,
        v.PIB,
        v.Napomena,
        v.vrednost,
        v.VP1,
        v.RAB1,
        v.VP2,
        v.RAB2,
        v.RAB3,
        v.Osnova_za_obracun_pdv,
        v.PDV,
        v.ukupno,
        v.rabat_km,
        v.slovima,
        v.br_fiskalnog,
        v.datum_vreme_fiskalnog,
        v.storniran_racun,
        v.racun_placen
    FROM ziralni.q_racun_gl v
    WHERE v.sifra_tabele > p_granica
    ORDER BY v.sifra_tabele DESC;

    SELECT * FROM tmp_racuni_glavna ORDER BY sifra_tabele DESC;
END$$
DELIMITER ;


DROP PROCEDURE IF EXISTS erp.sp_racuni_gl_nit_pozadina;
DELIMITER $$
CREATE PROCEDURE erp.sp_racuni_gl_nit_pozadina(
    IN p_granica INT
)
BEGIN
    CREATE TEMPORARY TABLE IF NOT EXISTS tmp_racuni_pozadina (
        sifra_tabele            INT UNSIGNED,
        sifra_radnika           INT UNSIGNED,
        naziv_radnika           VARCHAR(45),
        broj_racuna             INT,
        vrsta_racuna            VARCHAR(10),
        vrsta_racuna_novi       TINYINT(4),
        vrsta_racuna_pod        INT,
        vrsta_racuna_novo       VARCHAR(100),
        sifra_knjizenja         INT,
        racun_roba              SMALLINT(6),
        sifra_terena            INT,
        datum_racuna            DATE,
        valuta                  DATE,
        vreme                   DATETIME,
        datum_isporuke          DATE,
        sifra_partnera          INT UNSIGNED,
        naziv_partnera          VARCHAR(254),
        adresa_partnera         VARCHAR(254),
        naziv_grada             VARCHAR(100),
        entitet                 VARCHAR(50),
        ptt                     VARCHAR(20),
        jib                     VARCHAR(50),
        pib                     VARCHAR(50),
        napomena                VARCHAR(254),
        vrednost                DECIMAL(10,2),
        vp1                     DECIMAL(10,2),
        rab1                    DECIMAL(10,2),
        vp2                     DECIMAL(10,2),
        rab2                    DECIMAL(10,2),
        rab3                    DECIMAL(10,2),
        osnova_za_obracun_pdv   DECIMAL(10,2),
        pdv                     DECIMAL(10,2),
        ukupno                  DECIMAL(10,2),
        rabat_km                DECIMAL(10,2),
        slovima                 VARCHAR(254),
        br_fiskalnog            VARCHAR(50),
        datum_vreme_fiskalnog   VARCHAR(100),
        storniran_racun         TINYINT(1),
        racun_placen            VARCHAR(2)
    );

    TRUNCATE TABLE tmp_racuni_pozadina;

    INSERT INTO tmp_racuni_pozadina
    SELECT
        v.sifra_tabele,
        v.sifra_radnika,
        v.Naziv_radnika,
        v.broj_racuna,
        v.vrsta_racuna,
        v.vrsta_racuna_novi,
        v.vrsta_racuna_pod,
        v.vrsta_racuna_novo,
        v.sifra_knjizenja,
        v.racun_roba,
        v.sifra_terena,
        v.datum_racuna,
        v.valuta,
        v.vreme,
        v.datum_isporuke,
        v.sifra_partnera,
        v.naziv_partnera,
        v.adresa_partnera,
        v.Naziv_grada,
        v.Entitet,
        v.PTT,
        v.JIB,
        v.PIB,
        v.Napomena,
        v.vrednost,
        v.VP1,
        v.RAB1,
        v.VP2,
        v.RAB2,
        v.RAB3,
        v.Osnova_za_obracun_pdv,
        v.PDV,
        v.ukupno,
        v.rabat_km,
        v.slovima,
        v.br_fiskalnog,
        v.datum_vreme_fiskalnog,
        v.storniran_racun,
        v.racun_placen
    FROM ziralni.q_racun_gl v
    WHERE v.sifra_tabele <= p_granica
    ORDER BY v.sifra_tabele DESC;

    SELECT * FROM tmp_racuni_pozadina ORDER BY sifra_tabele DESC;
END$$
DELIMITER ;
