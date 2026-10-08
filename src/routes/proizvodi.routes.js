import { Router } from "express";
import * as ProizvodiController from "../controllers/proizvodi.controller.js";

const router = Router();

router.get("/normativi", ProizvodiController.getNormativiZaProizvod);
router.post("/normativi/izmjena", ProizvodiController.izmjenaNormativa);
router.post("/normativi/unos", ProizvodiController.unosNormativa);
router.delete(
  "/normativi/:sifraTabele",
  ProizvodiController.brisanjeStavkeNormativa,
);

export default router;
