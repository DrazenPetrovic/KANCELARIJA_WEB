import * as TradeOrdersService from "../services/trade-orders.service.js";

export const createTradeOrder = async (req, res) => {
  try {
    const {
      partnerId,
      partnerName,
      vrstaPlacanja,
      datumIsporuke,
      prioritet,
      napomena,
      stavke,
    } = req.body;

    if (!partnerId || !vrstaPlacanja || !stavke || stavke.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Nedostaju obavezni podaci (partnerId, vrstaPlacanja, stavke)",
      });
    }

    const createdBy = req.user.sifraRadnika;

    const data = await TradeOrdersService.createTradeOrder({
      partnerId,
      partnerName,
      radnikId: -1,
      createdBy,
      vrstaPlacanja,
      datumIsporuke,
      prioritet,
      napomena,
      stavke,
    });

    return res.json({
      success: true,
      message: "Narudžba uspješno snimljena",
      data,
    });
  } catch (error) {
    console.error("Greška pri kreiranju trade narudžbe:", error);
    return res
      .status(500)
      .json({
        success: false,
        error: "Greška pri snimanju narudžbe: " + error.message,
      });
  }
};
