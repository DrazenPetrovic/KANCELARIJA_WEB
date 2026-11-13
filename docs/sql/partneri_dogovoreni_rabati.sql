-- Dogovoreni rabati partner-proizvod (nova tabela, vodi se paralelno sa
-- erp.partneri_dogovorene_cijene).
--
-- Cijena za kupca se NE čuva, nego se računa pri unosu računa:
--   VPC1 = trenutni VPC * (1 - rabat_1_proc / 100), ali nikad ispod nabavne.
-- orijentaciona_cijena_vpc / vpc_pri_dogovoru su samo informativni (šta je
-- dogovoreno i po kom VPC-u u tom trenutku).
--
-- Jedan red po paru partner+proizvod (UNIQUE) — upis ide preko
-- INSERT ... ON DUPLICATE KEY UPDATE, pa nema duplikata ni dvoumljenja
-- koji red je važeći. Negativan rabat i rabat >= 100 odbija sama baza (CHECK).

CREATE TABLE IF NOT EXISTS erp.partneri_dogovoreni_rabati
(
    sifra_tbl                INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    partner_id               INT UNSIGNED  NOT NULL,
    proizvod_id              INT UNSIGNED  NOT NULL,
    rabat_1_proc             DECIMAL(5,2)  NOT NULL DEFAULT 0.00
                             COMMENT 'Rabat na trenutni VPC, 0-99.99',
    orijentaciona_cijena_vpc DECIMAL(10,3) NULL
                             COMMENT 'VPC1 koji je dobijen pri dogovoru - informativno',
    vpc_pri_dogovoru         DECIMAL(10,3) NULL
                             COMMENT 'Kataloški VPC u trenutku dogovora - informativno',
    aktivno                  TINYINT       NOT NULL DEFAULT 1
                             COMMENT '1 aktivno, 0 neaktivno',
    sinhronizovano           TINYINT       NOT NULL DEFAULT 0,
    vreme_kreiranja          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vreme_izmjene            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                           ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (sifra_tbl),
    UNIQUE KEY uq_partner_proizvod (partner_id, proizvod_id),
    KEY idx_proizvod (proizvod_id),
    CONSTRAINT chk_pdr_rabat CHECK (rabat_1_proc >= 0 AND rabat_1_proc < 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
