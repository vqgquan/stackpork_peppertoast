import { useEffect, useMemo, useState } from "react";
import { getInventoryHistory, getInventory } from "../api";

const SELECT_CLS =
  "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700";

function formatDateVN(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

// Shared with Inventory.jsx / InventoryHistory.jsx so prices read the same
// way everywhere in the app.
const formatPrice = (value) =>
  value == null ? "—" : `${value.toLocaleString("vi-VN")}đ`;

function pad(n) {
  return String(n).padStart(2, "0");
}
function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// Monday-start week containing `today`.
function weekRange(today) {
  const day = today.getDay(); // 0 = Sun .. 6 = Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toISODate(monday), end: toISODate(sunday) };
}
function monthRange(today) {
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

// One row per inventory item: current stock value plus Sold/Gifted/Profit
// totals bounded by a period the person picks (this week, this month, or a
// custom range). Self-contained — fetches its own data via getInventory /
// getInventoryHistory — so it can be dropped into any page (Inventory
// History, Dashboard, etc.) without the parent needing to supply data.
export default function InventoryItemSummary() {
  const [entries, setEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Bounds the dynamic columns (Sold / Gifted / Profit).
  const [periodPreset, setPeriodPreset] = useState("week"); // "week" | "month" | "custom"
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([getInventoryHistory(), getInventory()])
      .then(([historyData, itemsData]) => {
        setEntries(historyData);
        setItems(itemsData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const periodRange = useMemo(() => {
    const today = new Date();
    if (periodPreset === "week") return weekRange(today);
    if (periodPreset === "month") return monthRange(today);
    if (customFrom && customTo) return { start: customFrom, end: customTo };
    return null; // custom preset chosen but range not fully picked yet
  }, [periodPreset, customFrom, customTo]);

  const periodLabel = useMemo(() => {
    if (periodPreset === "week") return "This Week";
    if (periodPreset === "month") return "This Month";
    if (periodRange) return `${formatDateVN(periodRange.start)} – ${formatDateVN(periodRange.end)}`;
    return "Select a range";
  }, [periodPreset, periodRange]);

  const summaryRows = useMemo(() => {
    const rows = items.map((item) => {
      let sold = 0;
      let gifted = 0;
      let profit = 0;
      if (periodRange) {
        for (const e of entries) {
          if (e.inventory_item_id !== item.id) continue;
          if (e.date < periodRange.start || e.date > periodRange.end) continue;
          if (e.kind === "sale") {
            sold += Math.abs(e.quantity_delta);
            if (e.profit != null) profit += e.profit;
          } else if (e.kind === "gift") {
            gifted += Math.abs(e.quantity_delta);
          }
        }
      }
      const totalValue =
        item.cost_price != null ? item.available_quantity * item.cost_price : null;
      return {
        id: item.id,
        name: item.name,
        available: item.available_quantity,
        costPrice: item.cost_price,
        totalValue,
        salePrice: item.sale_price,
        sold,
        gifted,
        profit,
      };
    });

    return rows.sort((a, b) => a.id - b.id);
  }, [items, entries, periodRange]);

  // Column sort: click a header to cycle asc -> desc -> back to the
  // default (alphabetical by name, same as summaryRows' own base order).
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState(null); // "asc" | "desc" | null

  function handleSort(key) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  }

  function sortIndicator(key) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  const sortedRows = useMemo(() => {
    if (!sortKey) return summaryRows;
    const dir = sortDir === "desc" ? -1 : 1;
    return [...summaryRows].sort((a, b) => {
      if (sortKey === "name") return dir * a.name.localeCompare(b.name);
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last regardless of direction
      if (bv == null) return -1;
      return dir * (av - bv);
    });
  }, [summaryRows, sortKey, sortDir]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">Item Summary</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          One row per item — current stock value, plus Sold/Gifted/Profit for the selected period.
        </p>
      </div>

      {/* Period control */}
      <div className="flex flex-wrap items-center gap-2 mb-4 justify-end">
        <span className="text-xs text-slate-400">Sold / Gifted / Profit period:</span>
        <select
          value={periodPreset}
          onChange={(e) => setPeriodPreset(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom Range</option>
        </select>
        {periodPreset === "custom" && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
            />
          </>
        )}
      </div>

      {periodPreset === "custom" && !periodRange && (
        <p className="text-xs text-amber-600 mb-3">
          Pick both a start and end date to see Sold / Gifted / Profit for a custom range.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 py-8 text-center">Loading summary…</p>
      ) : error ? (
        <p className="text-sm text-red-500 py-8 text-center">{error}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg table-fixed">
            <colgroup>
              <col className="w-[6%]" />
              <col className="w-[17%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
              <col className="w-[11%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th
                  onClick={() => handleSort("id")}
                  className="px-3 py-2 cursor-pointer select-none hover:bg-slate-100"
                >
                  Item ID{sortIndicator("id")}
                </th>
                <th
                  onClick={() => handleSort("name")}
                  className="px-3 py-2 cursor-pointer select-none hover:bg-slate-100"
                >
                  Item{sortIndicator("name")}
                </th>
                <th
                  onClick={() => handleSort("available")}
                  className="px-3 py-2 text-right cursor-pointer select-none hover:bg-slate-100"
                >
                  Available{sortIndicator("available")}
                </th>
                <th
                  onClick={() => handleSort("costPrice")}
                  className="px-3 py-2 text-right cursor-pointer select-none hover:bg-slate-100"
                >
                  Purchase Price{sortIndicator("costPrice")}
                </th>
                <th
                  onClick={() => handleSort("totalValue")}
                  className="px-3 py-2 text-right cursor-pointer select-none hover:bg-slate-100"
                >
                  Total Value{sortIndicator("totalValue")}
                </th>
                <th
                  onClick={() => handleSort("salePrice")}
                  className="px-3 py-2 text-right cursor-pointer select-none hover:bg-slate-100"
                >
                  Selling Price{sortIndicator("salePrice")}
                </th>
                <th
                  onClick={() => handleSort("sold")}
                  className="px-3 py-2 text-right cursor-pointer select-none hover:bg-slate-100"
                >
                  Sold ({periodLabel}){sortIndicator("sold")}
                </th>
                <th
                  onClick={() => handleSort("gifted")}
                  className="px-3 py-2 text-right cursor-pointer select-none hover:bg-slate-100"
                >
                  Gifted ({periodLabel}){sortIndicator("gifted")}
                </th>
                <th
                  onClick={() => handleSort("profit")}
                  className="px-3 py-2 text-right cursor-pointer select-none hover:bg-slate-100"
                >
                  Profit ({periodLabel}){sortIndicator("profit")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-slate-400 text-sm">
                    {items.length === 0
                      ? "No items in inventory yet."
                      : "No items match the current filters."}
                  </td>
                </tr>
              ) : (
                sortedRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                    <td className="px-3 py-2 text-xs text-slate-500">{r.id}</td>
                    <td className="px-3 py-2 text-slate-800 font-medium text-xs truncate">
                      {r.name}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                      {r.available}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-600">
                      {formatPrice(r.costPrice)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-medium text-slate-700">
                      {formatPrice(r.totalValue)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-slate-600">
                      {formatPrice(r.salePrice)}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                      {periodRange ? r.sold : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                      {periodRange ? r.gifted : "—"}
                    </td>
                    <td
                      className={`px-3 py-2 text-right text-xs font-semibold ${
                        !periodRange
                          ? "text-slate-400"
                          : r.profit >= 0
                            ? "text-green-600"
                            : "text-red-500"
                      }`}
                    >
                      {periodRange
                        ? `${r.profit >= 0 ? "+" : ""}${formatPrice(r.profit)}`
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
