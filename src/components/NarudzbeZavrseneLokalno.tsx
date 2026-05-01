import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  Loader2,
  PackageSearch,
  Search,
  Store,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";
const PRIMARY = "#785E9E";

const paymentLabel: Record<number, string> = {
  1: "Žirano",
  2: "Gotovinsko",
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "—";

  const datePart = String(value).split("T")[0];
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) {
    return "—";
  }

  return `${day}.${month}.${year}`;
};

const formatDateTime = (value: string | null | undefined) => {
  return formatDate(value);
};

interface ZavrsenaOrder {
  id: number;
  order_number: string;
  partner_id: number;
  partner_name: string;
  branch_id: number | null;
  branch_name: string | null;
  order_type: string | null;
  radnik_id: number | null;
  vrsta_placanja: number;
  created_by: number | null;
  order_date: string | null;
  requested_delivery_date: string | null;
  confirmed_delivery_date: string | null;
  status_id: number;
  priority: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

interface OrderItem {
  id: number;
  order_id: number;
  line_number: number;
  product_id: number;
  product_name: string;
  product_uom: string;
  product_group: string | null;
  quantity: number;
  vpc: number;
  mpc: number;
  created_at: string | null;
  updated_at: string | null;
}

export function NarudzbeZavrseneLokalno() {
  const [orders, setOrders] = useState<ZavrsenaOrder[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<number, OrderItem[]>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [itemsIndexing, setItemsIndexing] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadOrders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/api/trade-orders/finished`, {
          credentials: "include",
        });
        const json = await response.json();

        if (!json.success) {
          throw new Error(json.error || "Greška pri dohvatu narudžbi");
        }

        if (!cancelled) {
          setOrders(Array.isArray(json.data) ? json.data : []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nema veze sa serverom",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadOrders();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (orders.length === 0) {
      setItemsByOrder({});
      setItemsError(null);
      return;
    }

    let cancelled = false;

    const loadItems = async () => {
      setItemsIndexing(true);
      setItemsError(null);

      try {
        const response = await fetch(
          `${API_URL}/api/trade-orders/finished/items`,
          {
            credentials: "include",
          },
        );
        const json = await response.json();

        if (!json.success) {
          throw new Error(json.error || "Greška pri dohvatu stavki");
        }

        if (cancelled) {
          return;
        }

        const items = Array.isArray(json.data) ? json.data : [];
        const nextItemsByOrder: Record<number, OrderItem[]> = {};

        for (const item of items) {
          const orderId = Number(item.order_id);

          if (!nextItemsByOrder[orderId]) {
            nextItemsByOrder[orderId] = [];
          }

          nextItemsByOrder[orderId].push(item);
        }

        for (const order of orders) {
          if (!nextItemsByOrder[order.id]) {
            nextItemsByOrder[order.id] = [];
          }
        }

        setItemsByOrder(nextItemsByOrder);
      } catch (loadError) {
        if (!cancelled) {
          setItemsError(
            loadError instanceof Error
              ? loadError.message
              : "Greška pri dohvatu stavki",
          );
        }
      } finally {
        if (!cancelled) {
          setItemsIndexing(false);
        }
      }
    };

    loadItems();

    return () => {
      cancelled = true;
    };
  }, [orders]);

  const handleToggleOrder = (orderId: number) => {
    setExpandedId((current) => (current === orderId ? null : orderId));
  };

  const normalizedPartnerQuery = partnerQuery.trim().toLowerCase();
  const normalizedProductQuery = productQuery.trim().toLowerCase();

  const filteredOrders = orders.filter((order) => {
    const matchesPartner =
      normalizedPartnerQuery.length === 0 ||
      order.partner_name.toLowerCase().includes(normalizedPartnerQuery) ||
      String(order.partner_id).includes(normalizedPartnerQuery) ||
      (order.branch_name || "").toLowerCase().includes(normalizedPartnerQuery);

    const orderItems = itemsByOrder[order.id] ?? [];
    const matchesProduct =
      normalizedProductQuery.length === 0 ||
      orderItems.some(
        (item) =>
          item.product_name.toLowerCase().includes(normalizedProductQuery) ||
          String(item.product_id).includes(normalizedProductQuery) ||
          (item.product_group || "")
            .toLowerCase()
            .includes(normalizedProductQuery),
      );

    return matchesPartner && matchesProduct;
  });

  const sortedOrders = [...filteredOrders].sort(
    (left, right) =>
      new Date(right.created_at).getTime() -
      new Date(left.created_at).getTime(),
  );

  const activeFilters =
    normalizedPartnerQuery.length > 0 || normalizedProductQuery.length > 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: PRIMARY }}
          >
            <CheckCheck size={18} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-[#ede9f6]">
              Završene lokalne narudžbe
            </h2>
            <p className="text-xs text-gray-400 dark:text-[#5f5878]">
              Hronološki pregled završenih narudžbi bez spajanja različitih
              naloga.
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:min-w-[720px] lg:max-w-[760px] lg:flex-1">
          <label className="relative block">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              value={partnerQuery}
              onChange={(event) => setPartnerQuery(event.target.value)}
              placeholder="Pretraga po partneru, PJ ili šifri partnera"
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-700 outline-none transition-all focus:border-[color:var(--primary)] dark:border-[#3a3158] dark:bg-[#1e1a2d] dark:text-[#ede9f6]"
              style={{ ["--primary" as string]: PRIMARY }}
            />
          </label>

          <label className="relative block">
            <PackageSearch
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-[#5f5878]"
            />
            <input
              value={productQuery}
              onChange={(event) => setProductQuery(event.target.value)}
              placeholder="Pretraga po proizvodu, grupi ili šifri artikla"
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-700 outline-none transition-all focus:border-[color:var(--primary)] dark:border-[#3a3158] dark:bg-[#1e1a2d] dark:text-[#ede9f6]"
              style={{ ["--primary" as string]: PRIMARY }}
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-[#3a3158] dark:bg-[#1e1a2d]">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-[#5f5878]">
            Ukupno narudžbi
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-800 dark:text-[#ede9f6]">
            {orders.length}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-[#3a3158] dark:bg-[#1e1a2d]">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-[#5f5878]">
            Prikazano
          </div>
          <div className="mt-1 text-2xl font-bold text-gray-800 dark:text-[#ede9f6]">
            {sortedOrders.length}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 dark:border-[#3a3158] dark:bg-[#1e1a2d]">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-[#5f5878]">
            Indeks proizvoda
          </div>
          <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-[#c5bfd8]">
            {itemsIndexing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Store size={16} />
            )}
            {itemsIndexing
              ? "Učitavanje stavki za pretragu"
              : "Spreman za filtriranje"}
          </div>
          {itemsError && (
            <div className="mt-2 text-xs text-red-600 dark:text-red-400">
              {itemsError}
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-gray-400 dark:text-[#5f5878]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm">Učitavanje...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle size={15} />
          {error}
        </div>
      ) : sortedOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-gray-400 dark:text-[#5f5878]">
          <CheckCheck size={28} className="text-gray-300 dark:text-[#3a3158]" />
          <span className="text-sm">
            {activeFilters
              ? "Nema rezultata za zadatu pretragu"
              : "Nema završenih narudžbi"}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedOrders.map((order) => {
            const isExpanded = expandedId === order.id;
            const orderItems = itemsByOrder[order.id] ?? [];
            const totalQuantity = orderItems.reduce(
              (sum, item) => sum + Number(item.quantity || 0),
              0,
            );

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-[#3a3158] dark:bg-[#1e1a2d]"
              >
                <button
                  onClick={() => handleToggleOrder(order.id)}
                  className="w-full px-4 py-4 text-left transition-all hover:bg-[#f8f6fc] dark:hover:bg-[#2d2648]"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-bold text-gray-800 dark:text-[#ede9f6]">
                          {order.partner_name}
                        </span>
                        {order.branch_name && (
                          <span className="rounded-full bg-[#f2edf8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6f5598] dark:bg-[#312a50] dark:text-[#cabbef]">
                            {order.branch_name}
                          </span>
                        )}
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Završeno
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-[#7d7498]">
                        <span className="font-mono font-semibold text-gray-700 dark:text-[#c5bfd8]">
                          {order.order_number}
                        </span>
                        <span>
                          Kreirano: {formatDateTime(order.created_at)}
                        </span>
                        <span>Narudžba: {formatDate(order.order_date)}</span>
                        <span>
                          Isporuka:{" "}
                          {formatDate(
                            order.confirmed_delivery_date ||
                              order.requested_delivery_date,
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
                      <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-[#7d7498] sm:grid-cols-4">
                        <span>Artikala: {orderItems.length}</span>
                        <span>
                          Količina:{" "}
                          {Number.isInteger(totalQuantity)
                            ? totalQuantity
                            : totalQuantity.toFixed(2)}
                        </span>
                        <span>
                          Plaćanje: {paymentLabel[order.vrsta_placanja] ?? "—"}
                        </span>
                        <span>Prioritet: {order.priority ?? "—"}</span>
                      </div>

                      <ChevronDown
                        size={16}
                        className={`text-gray-400 transition-transform dark:text-[#5f5878] ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </div>
                  </div>

                  {order.notes && (
                    <div className="mt-3 rounded-xl bg-[#faf8fd] px-3 py-2 text-xs text-gray-500 dark:bg-[#16122a] dark:text-[#9389b1]">
                      {order.notes}
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-[#fcfbfe] px-4 py-4 dark:border-[#2d2648] dark:bg-[#16122a]">
                    {orderItems.length === 0 ? (
                      <div className="py-4 text-center text-xs text-gray-400 dark:text-[#5f5878]">
                        Nema stavki za ovu narudžbu.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[780px] text-xs">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-[#2d2648]">
                              <th className="px-4 py-2 text-left font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                                #
                              </th>
                              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                                Proizvod
                              </th>
                              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                                Grupa
                              </th>
                              <th className="px-2 py-2 text-right font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                                Kol.
                              </th>
                              <th className="px-2 py-2 text-left font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                                JM
                              </th>
                              <th className="px-2 py-2 text-right font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                                VPC
                              </th>
                              <th className="px-4 py-2 text-right font-bold uppercase tracking-wider text-gray-400 dark:text-[#5f5878]">
                                MPC
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {orderItems.map((item) => (
                              <tr
                                key={item.id}
                                className="border-b border-gray-100 last:border-b-0 dark:border-[#1e1a2d]"
                              >
                                <td className="px-4 py-2 text-gray-400 dark:text-[#5f5878]">
                                  {item.line_number}
                                </td>
                                <td className="px-2 py-2">
                                  <div className="font-medium text-gray-800 dark:text-[#ede9f6]">
                                    {item.product_name}
                                  </div>
                                  <div className="text-[11px] text-gray-400 dark:text-[#5f5878]">
                                    Šifra: {item.product_id}
                                  </div>
                                </td>
                                <td className="px-2 py-2 text-gray-500 dark:text-[#7d7498]">
                                  {item.product_group || "—"}
                                </td>
                                <td className="px-2 py-2 text-right font-semibold text-gray-700 dark:text-[#c5bfd8]">
                                  {Number(item.quantity) % 1 === 0
                                    ? Number(item.quantity).toFixed(0)
                                    : Number(item.quantity).toFixed(3)}
                                </td>
                                <td className="px-2 py-2 text-gray-500 dark:text-[#7d7498]">
                                  {item.product_uom}
                                </td>
                                <td className="px-2 py-2 text-right text-gray-500 dark:text-[#7d7498]">
                                  {Number(item.vpc).toFixed(2)}
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-[#ede9f6]">
                                  {Number(item.mpc).toFixed(2)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
