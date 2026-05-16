const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

const paymentLabel: Record<number, string> = {
  1: "Žirano",
  2: "Gotovinsko",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = String(value).split("T")[0];
  const [year, month, day] = d.split("-");
  if (!year || !month || !day) return "—";
  return `${day}.${month}.${year}`;
}

function formatQty(n: number | string) {
  const num = Number(n);
  if (isNaN(num)) return "—";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

export interface PrintOrderItem {
  id: number;
  line_number: number;
  product_id: number;
  product_name: string;
  product_uom: string;
  product_group: string | null;
  quantity: number;
  vpc: number;
  mpc: number;
}

export interface PrintOrder {
  id: number;
  order_number: string;
  partner_name: string;
  branch_name: string | null;
  vrsta_placanja: number;
  order_date: string | null;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface PartnerSection {
  id: number;
  name: string;
  orders: PrintOrder[];
}

interface Props {
  partners: PartnerSection[];
  itemsByOrder: Record<number, PrintOrderItem[]>;
}

export function ZavrseneLokalnoTemplate({ partners, itemsByOrder }: Props) {
  const datumStampe = new Date().toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const totalOrders = partners.reduce((s, p) => s + p.orders.length, 0);
  const totalItems = partners.reduce(
    (s, p) =>
      s + p.orders.reduce((rs, o) => rs + (itemsByOrder[o.id]?.length ?? 0), 0),
    0,
  );

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        fontSize: 10,
        color: "#1a1a1a",
        padding: "12mm 10mm",
        boxSizing: "border-box",
      }}
    >
      {/* Dokument header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: `3px solid ${PRIMARY}`,
          paddingBottom: 10,
          marginBottom: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY }}>
            Karpas Ambalaže
          </div>
          <div style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
            Kancelarija — sistem za upravljanje
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: PRIMARY,
              textTransform: "uppercase",
            }}
          >
            Završene lokalne narudžbe
          </div>
          <div style={{ fontSize: 9, color: "#999", marginTop: 4 }}>
            Datum štampe: {datumStampe}
          </div>
          <div style={{ fontSize: 9, color: "#999" }}>
            Partnera: {partners.length}&nbsp;&nbsp;|&nbsp;&nbsp;
            Narudžbi: {totalOrders}&nbsp;&nbsp;|&nbsp;&nbsp;
            Stavki: {totalItems}
          </div>
        </div>
      </div>

      {/* Partneri */}
      {partners.map((partner, pi) => {
        const partnerTotalItems = partner.orders.reduce(
          (s, o) => s + (itemsByOrder[o.id]?.length ?? 0),
          0,
        );
        const partnerTotalQty = partner.orders.reduce(
          (s, o) =>
            s +
            (itemsByOrder[o.id] ?? []).reduce(
              (rs, i) => rs + Number(i.quantity || 0),
              0,
            ),
          0,
        );

        return (
          <div
            key={partner.id}
            style={{
              marginBottom: pi < partners.length - 1 ? 24 : 0,
            }}
          >
            {/* Partner header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: PRIMARY,
                color: "white",
                padding: "6px 10px",
                borderRadius: 4,
                marginBottom: 10,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 11 }}>
                {partner.name}
              </span>
              <span style={{ fontSize: 9, opacity: 0.85 }}>
                {partner.orders.length} narudžbi&nbsp;&nbsp;|&nbsp;&nbsp;
                {partnerTotalItems} stavki&nbsp;&nbsp;|&nbsp;&nbsp;
                Ukupno kol.: {formatQty(partnerTotalQty)}
              </span>
            </div>

            {/* Narudžbe partnera */}
            {partner.orders.map((order, oi) => {
              const items = itemsByOrder[order.id] ?? [];
              const totalQty = items.reduce(
                (s, i) => s + Number(i.quantity || 0),
                0,
              );

              return (
                <div
                  key={order.id}
                  style={{
                    marginBottom: oi < partner.orders.length - 1 ? 14 : 0,
                    pageBreakInside: "avoid",
                  }}
                >
                  {/* Narudžba sub-header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      background: "#f5f3fa",
                      borderLeft: `4px solid ${ACCENT}`,
                      padding: "4px 10px",
                      marginBottom: 3,
                      borderRadius: "0 4px 4px 0",
                    }}
                  >
                    <span
                      style={{ fontWeight: 700, fontSize: 10, color: PRIMARY }}
                    >
                      {order.order_number}
                    </span>
                    {order.branch_name && (
                      <span
                        style={{
                          fontSize: 9,
                          color: "#6f5598",
                          fontWeight: 600,
                        }}
                      >
                        PJ: {order.branch_name}
                      </span>
                    )}
                    <span style={{ fontSize: 9, color: "#666" }}>
                      Datum: {formatDate(order.order_date)}
                    </span>
                    <span style={{ fontSize: 9, color: "#666" }}>
                      Isporuka:{" "}
                      {formatDate(
                        order.confirmed_delivery_date ||
                          order.requested_delivery_date,
                      )}
                    </span>
                    <span style={{ fontSize: 9, color: "#666" }}>
                      Plaćanje: {paymentLabel[order.vrsta_placanja] ?? "—"}
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 9, color: "#666" }}>
                      Ažurirano:{" "}
                      {formatDate(order.updated_at || order.created_at)}
                    </span>
                  </div>

                  {order.notes && (
                    <div
                      style={{
                        fontSize: 9,
                        color: "#888",
                        paddingLeft: 10,
                        marginBottom: 3,
                        fontStyle: "italic",
                      }}
                    >
                      Napomena: {order.notes}
                    </div>
                  )}

                  {/* Tabela stavki */}
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#ede8f6" }}>
                        {[
                          { label: "#", right: false },
                          { label: "Šifra", right: false },
                          { label: "Naziv proizvoda", right: false },
                          { label: "Grupa", right: false },
                          { label: "Količina", right: true },
                          { label: "JM", right: false },
                          { label: "VPC", right: true },
                          { label: "MPC", right: true },
                        ].map(({ label, right }) => (
                          <th
                            key={label}
                            style={{
                              color: PRIMARY,
                              fontWeight: 700,
                              fontSize: 8,
                              padding: "3px 5px",
                              textAlign: right ? "right" : "left",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                            }}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            style={{
                              padding: "5px",
                              fontSize: 9,
                              color: "#aaa",
                              textAlign: "center",
                            }}
                          >
                            Nema stavki
                          </td>
                        </tr>
                      ) : (
                        items.map((item, i) => (
                          <tr
                            key={item.id}
                            style={{
                              background: i % 2 === 0 ? "#faf9fc" : "white",
                            }}
                          >
                            <td style={cell}>{item.line_number}</td>
                            <td style={cell}>{item.product_id}</td>
                            <td style={{ ...cell, fontWeight: 600 }}>
                              {item.product_name}
                            </td>
                            <td style={cell}>{item.product_group || "—"}</td>
                            <td
                              style={{
                                ...cell,
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {formatQty(item.quantity)}
                            </td>
                            <td style={cell}>{item.product_uom}</td>
                            <td style={{ ...cell, textAlign: "right" }}>
                              {Number(item.vpc).toFixed(2)}
                            </td>
                            <td
                              style={{
                                ...cell,
                                textAlign: "right",
                                fontWeight: 600,
                              }}
                            >
                              {Number(item.mpc).toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {items.length > 0 && (
                      <tfoot>
                        <tr style={{ borderTop: `1px solid ${PRIMARY}` }}>
                          <td
                            colSpan={4}
                            style={{
                              ...cell,
                              fontWeight: 700,
                              fontSize: 9,
                              color: PRIMARY,
                            }}
                          >
                            Stavki: {items.length}
                          </td>
                          <td
                            style={{
                              ...cell,
                              textAlign: "right",
                              fontWeight: 700,
                              fontSize: 9,
                              color: PRIMARY,
                            }}
                          >
                            {formatQty(totalQty)}
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              );
            })}

            {/* Partner summary */}
            <div
              style={{
                marginTop: 8,
                background: "#f0edf8",
                borderTop: `2px solid ${PRIMARY}`,
                padding: "4px 10px",
                display: "flex",
                gap: 20,
                fontSize: 9,
                fontWeight: 700,
                color: PRIMARY,
              }}
            >
              <span>Ukupno narudžbi: {partner.orders.length}</span>
              <span>Ukupno stavki: {partnerTotalItems}</span>
              <span>Ukupna količina: {formatQty(partnerTotalQty)}</span>
            </div>
          </div>
        );
      })}

      {/* Footer */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 6,
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          fontSize: 9,
          color: "#aaa",
        }}
      >
        <span>Karpas Ambalaže — Kancelarija</span>
        <span>{datumStampe}</span>
      </div>
    </div>
  );
}

const cell: React.CSSProperties = {
  padding: "3px 5px",
  fontSize: 9,
  borderBottom: "1px solid #f0edf8",
  verticalAlign: "middle",
};
