import * as TradeOrdersService from "../services/trade-orders.service.js";

export const getActiveOrders = async (req, res) => {
  try {
    const data = await TradeOrdersService.getActiveOrders();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Greška pri dohvatu aktivnih narudžbi:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getActiveOrderItems = async (req, res) => {
  try {
    const { orderId } = req.params;
    const data = await TradeOrdersService.getActiveOrderItems(orderId);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Greška pri dohvatu stavki narudžbe:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getFinishedOrders = async (req, res) => {
  try {
    const data = await TradeOrdersService.getFinishedOrders();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Greška pri dohvatu završenih narudžbi:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getFinishedOrderItems = async (req, res) => {
  try {
    const data = await TradeOrdersService.getFinishedOrderItems();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Greška pri dohvatu stavki završene narudžbe:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getZavrseneLokalneNarudzbe = async (req, res) => {
  try {
    const data = await TradeOrdersService.getZavrseneLokalneNarudzbe();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Greška pri dohvatu završenih narudžbi:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const getPartnerOrderHistory = async (req, res) => {
  try {
    const { partnerId, partnerName } = req.query;
    const data = await TradeOrdersService.getPartnerOrderHistory(
      partnerId ?? 0,
      partnerName ?? "",
    );
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Greška pri dohvatu istorije partnera:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const createTradeOrder = async (req, res) => {
  try {
    const {
      partnerId,
      partnerName,
      vrstaPlacanja,
      datumIsporuke,
      prioritet,
      napomena,
      referentNumber,
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
      referentNumber,
      stavke,
    });

    return res.json({
      success: true,
      message: "Narudžba uspješno snimljena",
      data,
    });
  } catch (error) {
    console.error("Greška pri kreiranju trade narudžbe:", error);
    return res.status(500).json({
      success: false,
      error: "Greška pri snimanju narudžbe: " + error.message,
    });
  }
};
