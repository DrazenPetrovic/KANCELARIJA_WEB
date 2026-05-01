import { withConnection } from "./db.service.js";

export const getActiveOrders = async () => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute("CALL erp.sp_get_active_orders()");
    return rows[0];
  });
};

export const getActiveOrderItems = async (orderId) => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute("CALL erp.sp_get_active_order_items(?)", [
      Number(orderId),
    ]);
    return rows[0];
  });
};

export const getFinishedOrders = async () => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute("CALL erp.sp_get_finished_orders()");
    return rows[0];
  });
};

export const getFinishedOrderItems = async () => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute("CALL erp.sp_get_finished_order_items()");
    return rows[0];
  });
};

export const getZavrseneLokalneNarudzbe = async () => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(
      `SELECT id, order_number, referent_number, partner_id, partner_name,
              vrsta_placanja, order_date, requested_delivery_date,
              confirmed_delivery_date, priority, notes, created_at
       FROM erp.trade_orders
       WHERE order_type = 'local'
         AND status_id = 2
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 200`,
    );
    return rows;
  });
};

export const getPartnerOrderHistory = async (partnerId, partnerName) => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(
      "CALL erp.sp_get_partner_order_history(?, ?)",
      [Number(partnerId) || 0, String(partnerName || "")],
    );
    return rows[0];
  });
};

export const createTradeOrder = async ({
  partnerId,
  partnerName,
  radnikId,
  createdBy,
  vrstaPlacanja,
  datumIsporuke,
  prioritet,
  napomena,
  referentNumber,
  stavke,
}) => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(
      "CALL erp.sp_create_trade_order(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        Number(partnerId),
        String(partnerName),
        Number(radnikId),
        Number(createdBy),
        Number(vrstaPlacanja) || null,
        datumIsporuke || null,
        Number(prioritet) || null,
        napomena || null,
        referentNumber || null,
        JSON.stringify(stavke),
      ],
    );
    return rows[0][0];
  });
};
