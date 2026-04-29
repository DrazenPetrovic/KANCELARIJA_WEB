import { Router } from "express";
import { verifyToken } from "../middleware/auth.js";
import * as NarudzbeController from "../controllers/aktivneNarudzbe.controller.js";

const router = Router();

router.get(
  "/narudzbe-grupisane",
  verifyToken,
  NarudzbeController.getAktivneNarudzbeGrupisano,
);
router.get(
  "/narudzbe-aktivne",
  verifyToken,
  NarudzbeController.getAktivneNarudzbe,
);
router.get("/ranije-uzimano", verifyToken, NarudzbeController.getRanijeUzimano);
router.get(
  "/zadnji-dan-narudzbe",
  verifyToken,
  NarudzbeController.getZadnjiDanNarudzbe,
);
router.post("/create", verifyToken, NarudzbeController.createNarudzba);
router.post(
  "/obrisi-partnera",
  verifyToken,
  NarudzbeController.narudzbaBrisanjePartnera,
);
router.post(
  "/obrisi-stavku",
  verifyToken,
  NarudzbeController.narudzbaBrisanjePartneraProizvoda,
);

export default router;
