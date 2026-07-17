import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getInventoryHistory, getInventory } from "../api";
import InventoryItemSummary from "../components/InventoryItemSummary";

const SELECT_CLS =
  "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700";
const inputClass =
  "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white";

function formatDateVN(iso) {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const KIND_CONFIG = {
  adjustment: { label: "Adjustment", badge: "bg-slate-100 text-slate-600" },
  gift: { label: "Gift", badge: "bg-purple-50 text-purple-700" },
};

export default function InventoryHistory() {
  const [entries, setEntries] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Which of the two tables is on screen.
  const [view, setView] = useState("transactions"); // "transactions" | "summary"

  const [search, setSearch] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [filterDirection, setFilterDirection] = useState(""); // "in" | "out" | ""

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

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (filterItem && String(e.inventory_item_id) !== filterItem) return false;
      if (filterKind && e.kind !== filterKind) return false;
      if (filterDirection === "in" && e.quantity_delta <= 0) return false;
      if (filterDirection === "out" && e.quantity_delta >= 0) return false;
      if (
        term &&
        !e.item_name.toLowerCase().includes(term) &&
        !(e.student_name ?? "").toLowerCase().includes(term) &&
        !(e.class_name ?? "").toLowerCase().includes(term) &&
        !(e.reason ?? "").toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [entries, search, filterItem, filterKind, filterDirection]);

  const totals = useMemo(() => {
    let stockIn = 0,
      stockOut = 0;
    for (const e of filtered) {
      if (e.quantity_delta > 0) stockIn += e.quantity_delta;
      else stockOut += -e.quantity_delta;
    }
    return { stockIn, stockOut };
  }, [filtered]);

  const clearFilters = () => {
    setSearch("");
    setFilterItem("");
    setFilterKind("");
    setFilterDirection("");
  };
  const hasFilters = search || filterItem || filterKind || filterDirection;

  return (
    <div className="p-8 w-full">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-semibold text-slate-900">Inventory History</h1>

        <Link
          to="/inventory"
          className="text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg inline-flex items-center gap-1.5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Inventory
        </Link>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Every item entering or leaving stock — restocks, corrections, and gifts given to students.
      </p>

      {/* View toggle */}
      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 mb-6">
        <button
          onClick={() => setView("transactions")}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
            view === "transactions"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Transactions
        </button>
        <button
          onClick={() => setView("summary")}
          className={`text-sm px-3 py-1.5 rounded-md font-medium transition-colors ${
            view === "summary"
              ? "bg-white text-slate-800 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Item Summary
        </button>
      </div>

      {view === "transactions" ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-400">Stock In</p>
              <p className="text-2xl font-bold text-green-600 mt-1">+{totals.stockIn}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-400">Stock Out</p>
              <p className="text-2xl font-bold text-red-500 mt-1">-{totals.stockOut}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-400">Net Change</p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  totals.stockIn - totals.stockOut >= 0 ? "text-slate-800" : "text-red-500"
                }`}
              >
                {totals.stockIn - totals.stockOut >= 0 ? "+" : ""}
                {totals.stockIn - totals.stockOut}
              </p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <input
                type="text"
                placeholder="Search item, student, class, reason..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`${inputClass} max-w-xs`}
              />
              <select
                value={filterItem}
                onChange={(e) => setFilterItem(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">All items</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              <select
                value={filterKind}
                onChange={(e) => setFilterKind(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">All types</option>
                <option value="adjustment">Adjustments</option>
                <option value="gift">Gifts</option>
              </select>
              <select
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
                className={SELECT_CLS}
              >
                <option value="">In & Out</option>
                <option value="in">In only</option>
                <option value="out">Out only</option>
              </select>
              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-slate-400 hover:text-slate-600 underline"
                >
                  Clear filters
                </button>
              )}
              <span className="text-xs text-slate-400 ml-auto">
                {filtered.length === entries.length
                  ? `${entries.length} entries`
                  : `${filtered.length} of ${entries.length} entries`}
              </span>
            </div>

            {/* Table */}
            {loading ? (
              <p className="text-sm text-slate-400 py-8 text-center">Loading history…</p>
            ) : error ? (
              <p className="text-sm text-red-500 py-8 text-center">{error}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-lg table-fixed">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[18%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[9%]" />
                    <col className="w-[44%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2">Direction</th>
                      <th className="px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-sm">
                          {entries.length === 0
                            ? "No stock movements recorded yet."
                            : "No entries match the current filters."}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((e) => {
                        const isIn = e.quantity_delta > 0;
                        const kindCfg = KIND_CONFIG[e.kind] ?? KIND_CONFIG.adjustment;
                        return (
                          <tr key={e.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                            <td className="px-3 py-2 text-slate-600 text-xs whitespace-nowrap">
                              {formatDateVN(e.date)}
                            </td>
                            <td className="px-3 py-2 text-slate-800 font-medium text-xs truncate">
                              {e.item_name}
                              {e.category && (
                                <span className="block text-[11px] font-normal text-slate-400">
                                  {e.category}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${kindCfg.badge}`}
                              >
                                {kindCfg.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-semibold text-slate-700">
                              {Math.abs(e.quantity_delta)}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  isIn ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                                }`}
                              >
                                {isIn ? "In" : "Out"}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-600 leading-relaxed">
                              {e.kind === "gift" ? (
                                <>
                                  Gifted to{" "}
                                  <Link
                                    to={`/students/${e.student_id}`}
                                    className="text-blue-600 hover:underline font-medium"
                                  >
                                    {e.student_name}
                                  </Link>
                                  {e.class_name && <> — {e.class_name}</>}
                                  {e.schedule_label && (
                                    <span className="text-slate-400"> ({e.schedule_label})</span>
                                  )}
                                </>
                              ) : (
                                e.reason || <span className="text-slate-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <InventoryItemSummary />
      )}
    </div>
  );
}
