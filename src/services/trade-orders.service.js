import { withConnection } from "./db.service.js";

export const getActiveOrders = async () => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute("CALL erp.sp_get_active_orders()");
    return rows[0];
  });
};

export const getActiveOrderItems = async (orderId) => {
  return withConnection(async (conn) => {
    const [rows] = await conn.execute(
      "CALL erp.sp_get_active_order_items(?)",
      [Number(orderId)],
    );
    return rows[0];
  });
};

const pad = (n) => String(n).padStart(2, "0");

const generateOrderNumber = () => {
  const now = new Date();
  return `LOK-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
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
  stavke,
}) => {
  return withConnection(async (conn) => {
    try {
      await conn.beginTransaction();

      const orderNumber = generateOrderNumber();

      const [result] = await conn.execute(
        `INSERT INTO erp.trade_orders
           (order_number, partner_id, partner_name, order_type, radnik_id,
            vrsta_placanja, created_by, order_date, requested_delivery_date,
            priority, notes, status_id)
         VALUES (?, ?, ?, 'local', ?, ?, ?, CURDATE(), ?, ?, ?, 1)`,
        [
          orderNumber,
          Number(partnerId),
          String(partnerName),
          Number(radnikId),
          Number(vrstaPlacanja),
          Number(createdBy),
          datumIsporuke || null,
          Number(prioritet) || 1,
          napomena || null,
        ],
      );

      const orderId = result.insertId;

      for (let i = 0; i < stavke.length; i++) {
        const s = stavke[i];
        await conn.execute(
          `INSERT INTO erp.trade_order_items
             (order_id, line_number, product_id, product_name, product_uom,
              product_group, quantity, vpc, mpc)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            orderId,
            i + 1,
            Number(s.sifraProizvoda),
            String(s.nazivProizvoda),
            String(s.jm),
            s.grupaProizvoda || null,
            parseFloat(s.kolicina),
            parseFloat(s.vpc) || 0,
            parseFloat(s.mpc) || 0,
          ],
        );
      }

      await conn.commit();

      return {
        orderId,
        orderNumber,
        partnerId,
        brojStavki: stavke.length,
        datumUnosa: new Date(),
      };
    } catch (error) {
      await conn.rollback();
      throw new Error("Greška pri snimanju narudžbe: " + error.message);
    }
  });
};
