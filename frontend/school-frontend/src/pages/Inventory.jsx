import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  getInventory,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  adjustInventoryItem,
  purchaseInventoryItem,
  sellInventoryItem,
} from "../api";

// Vietnamese-dong formatter shared by every price display in this file, so
// "latest price" always reads the same way wherever it's shown.
const formatPrice = (value) =>
  value == null ? "—" : `${value.toLocaleString("vi-VN")}đ`;

const SELECT_CLS =
  "text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700";
const LOW_STOCK_THRESHOLD = 3;

// ─── Add / Edit item modal ─────────────────────────────────────────────────
function ItemModal({ item, onClose, onSaved }) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name ?? "");
  const [category, setCategory] = useState(item?.category ?? "");
  const [totalQuantity, setTotalQuantity] = useState(
    item?.total_quantity ?? 0,
  );
  const [inUseQuantity, setInUseQuantity] = useState(
    item?.in_use_quantity ?? 0,
  );
  const [costPrice, setCostPrice] = useState(item?.cost_price ?? "");
  const [salePrice, setSalePrice] = useState(item?.sale_price ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [imageData, setImageData] = useState(item?.image_data ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result); // base64 data URI
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      total_quantity: Number(totalQuantity) || 0,
      in_use_quantity: Number(inUseQuantity) || 0,
      cost_price: costPrice === "" ? null : Number(costPrice),
      sale_price: salePrice === "" ? null : Number(salePrice),
      notes: notes.trim() || null,
      image_data: imageData,
    };
    try {
      if (isEdit) await updateInventoryItem(item.id, payload);
      else await createInventoryItem(payload);
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            {isEdit ? "Edit Item" : "Add Item"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Guitar strings (steel)"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Category
            </label>
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Accessories"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Quantity
              </label>
              <input
                type="number"
                min="0"
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                In Use
              </label>
              <input
                type="number"
                min="0"
                value={inUseQuantity}
                onChange={(e) => setInUseQuantity(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cost Price
              </label>
              <input
                type="number"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Sale Price
              </label>
              <input
                type="number"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 -mt-2">
            These are the item's latest prices. Use "Purchase" / "Sell" in
            the Manage window to record a batch at a different price — past
            prices stay visible in the item's history.
          </p>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Image
            </label>
            <div className="flex items-center gap-3 mt-1">
              {imageData ? (
                <img
                  src={imageData}
                  alt="Item preview"
                  className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2 1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v12H4V6z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg cursor-pointer w-fit">
                  {imageData ? "Change" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {imageData && (
                  <button
                    onClick={() => setImageData(null)}
                    className="text-xs text-slate-400 hover:text-red-600 text-left"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Optional"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg"
            >
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Add Item"}
            </button>
            <button
              onClick={onClose}
              className="text-sm px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Add/Remove control for a single quantity field ─────────────────────────
// Defined at module scope (not inside ManageModal) so it isn't recreated on
// every parent render — nesting a component definition inside another
// component's function body causes React to treat it as a brand-new
// component type on each render and remount it, silently resetting any
// local state (the typed amount) and making the control feel broken.
function AdjustRow({ label, value, otherValue, isTotalField, busy, onApply }) {
  const [action, setAction] = useState("add");
  const [amount, setAmount] = useState("");
  const [localError, setLocalError] = useState(null);

  function handleApply() {
    const amt = Number(amount);
    if (!amount || !Number.isInteger(amt) || amt <= 0) {
      setLocalError("Enter a whole number greater than 0.");
      return;
    }
    if (action === "remove" && amt > value) {
      setLocalError(`Can't remove more than the current amount (${value}).`);
      return;
    }
    if (isTotalField && action === "remove" && value - amt < otherValue) {
      setLocalError("Total can't drop below the quantity currently in use.");
      return;
    }
    if (!isTotalField && action === "add" && value + amt > otherValue) {
      setLocalError("In-use can't exceed total quantity.");
      return;
    }
    setLocalError(null);
    onApply(action === "add" ? amt : -amt);
    setAmount("");
  }

  return (
    <div className="border border-slate-100 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-base font-semibold text-slate-800">{value}</span>
      </div>
      <div className="flex items-center gap-2">
        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setLocalError(null);
          }}
          className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
        >
          <option value="add">Add</option>
          <option value="remove">Remove</option>
        </select>
        <input
          type="number"
          min="1"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setLocalError(null);
          }}
          placeholder="Amount"
          className="w-24 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleApply}
          disabled={busy}
          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg"
        >
          {busy ? "Applying..." : "Apply"}
        </button>
      </div>
      {localError && <p className="text-xs text-red-600 mt-1.5">{localError}</p>}
    </div>
  );
}

// ─── Restock at a known price ───────────────────────────────────────────────
// Same module-scope reasoning as AdjustRow above — kept out of ManageModal's
// body so its typed-in-progress amount/cost survive re-renders.
function PurchaseRow({ currentCostPrice, busy, onApply }) {
  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState(currentCostPrice ?? "");
  const [localError, setLocalError] = useState(null);

  async function handleApply() {
    const qty = Number(quantity);
    const cost = Number(unitCost);
    if (!quantity || !Number.isInteger(qty) || qty <= 0) {
      setLocalError("Enter a whole number greater than 0.");
      return;
    }
    if (unitCost === "" || Number.isNaN(cost) || cost < 0) {
      setLocalError("Enter a valid unit cost.");
      return;
    }
    try {
      await onApply(qty, cost);
      setLocalError(null);
      setQuantity("");
    } catch (e) {
      setLocalError(e.message);
    }
  }

  return (
    <div className="border border-slate-100 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">Purchase (restock)</span>
        <span className="text-xs text-slate-400">
          Latest cost: {formatPrice(currentCostPrice)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setLocalError(null);
          }}
          placeholder="Qty"
          className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          min="0"
          value={unitCost}
          onChange={(e) => {
            setUnitCost(e.target.value);
            setLocalError(null);
          }}
          placeholder="Unit cost"
          className="w-28 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleApply}
          disabled={busy}
          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg"
        >
          {busy ? "Recording..." : "Record Purchase"}
        </button>
      </div>
      {localError && <p className="text-xs text-red-600 mt-1.5">{localError}</p>}
    </div>
  );
}

// ─── Sell to a customer at a known price ────────────────────────────────────
function SellRow({ currentSalePrice, available, busy, onApply }) {
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState(currentSalePrice ?? "");
  const [buyerName, setBuyerName] = useState("");
  const [localError, setLocalError] = useState(null);

  async function handleApply() {
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!quantity || !Number.isInteger(qty) || qty <= 0) {
      setLocalError("Enter a whole number greater than 0.");
      return;
    }
    if (qty > available) {
      setLocalError(`Only ${available} available to sell.`);
      return;
    }
    if (unitPrice === "" || Number.isNaN(price) || price < 0) {
      setLocalError("Enter a valid sale price.");
      return;
    }
    try {
      await onApply(qty, price, buyerName.trim() || null);
      setLocalError(null);
      setQuantity("");
      setBuyerName("");
    } catch (e) {
      setLocalError(e.message);
    }
  }

  return (
    <div className="border border-slate-100 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-slate-600">Sell</span>
        <span className="text-xs text-slate-400">
          Latest price: {formatPrice(currentSalePrice)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => {
            setQuantity(e.target.value);
            setLocalError(null);
          }}
          placeholder="Qty"
          className="w-20 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          min="0"
          value={unitPrice}
          onChange={(e) => {
            setUnitPrice(e.target.value);
            setLocalError(null);
          }}
          placeholder="Sale price"
          className="w-28 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          value={buyerName}
          onChange={(e) => setBuyerName(e.target.value)}
          placeholder="Buyer (optional)"
          className="w-36 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleApply}
          disabled={busy}
          className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg"
        >
          {busy ? "Recording..." : "Record Sale"}
        </button>
      </div>
      {localError && <p className="text-xs text-red-600 mt-1.5">{localError}</p>}
    </div>
  );
}

// ─── Manage item modal (increase / decrease / delete) ──────────────────────
function ManageModal({ item, onClose, onChanged }) {
  const [totalQuantity, setTotalQuantity] = useState(item.total_quantity);
  const [inUseQuantity, setInUseQuantity] = useState(item.in_use_quantity);
  const [busyField, setBusyField] = useState(null);
  const [error, setError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Image editing — kept separate from the quantity fields above since it
  // saves via updateInventoryItem (full item payload) rather than the
  // /adjust endpoint used for quantities.
  const [imageData, setImageData] = useState(item.image_data ?? null);
  const [savingImage, setSavingImage] = useState(false);
  const [imageError, setImageError] = useState(null);
  const imageDirty = imageData !== (item.image_data ?? null);

  const available = totalQuantity - inUseQuantity;

  async function adjust(field, delta) {
    setBusyField(field);
    setError(null);
    try {
      const updated = await adjustInventoryItem(item.id, field, delta);
      setTotalQuantity(updated.total_quantity);
      setInUseQuantity(updated.in_use_quantity);
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyField(null);
    }
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setImageError("Please choose an image file.");
      return;
    }
    setImageError(null);
    const reader = new FileReader();
    reader.onload = () => setImageData(reader.result); // base64 data URI
    reader.readAsDataURL(file);
  }

  async function handleSaveImage() {
    setSavingImage(true);
    setImageError(null);
    try {
      await updateInventoryItem(item.id, {
        name: item.name,
        category: item.category,
        total_quantity: totalQuantity,
        in_use_quantity: inUseQuantity,
        notes: item.notes,
        image_data: imageData,
      });
      item.image_data = imageData; // keep local copy of the prop in sync
      onChanged();
    } catch (e) {
      setImageError(e.message);
    } finally {
      setSavingImage(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteInventoryItem(item.id);
      onChanged();
      onClose();
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-sm w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-100 flex items-start justify-between">
          <div className="flex items-center gap-3">
            {item.image_data ? (
              <img
                src={item.image_data}
                alt={item.name}
                className="w-12 h-12 object-contain rounded-lg border border-slate-200 bg-slate-50"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100" />
            )}
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {item.name}
              </h3>
              <p className="text-xs text-slate-400">
                {item.category || "Uncategorized"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 flex-shrink-0"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-3">
          <div className="border border-slate-100 rounded-lg px-4 py-3">
            <span className="text-sm text-slate-600 block mb-2">Image</span>
            <div className="flex items-center gap-3">
              {imageData ? (
                <img
                  src={imageData}
                  alt={item.name}
                  className="w-16 h-16 object-contain rounded-lg border border-slate-200 bg-slate-50"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4 16l4.5-4.5a2 2 0 012.8 0L16 16m-2-2 1.5-1.5a2 2 0 012.8 0L20 14M4 6h16v12H4V6z" />
                  </svg>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <label className="text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg cursor-pointer w-fit">
                  {imageData ? "Change" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {imageData && (
                  <button
                    onClick={() => setImageData(null)}
                    className="text-xs text-slate-400 hover:text-red-600 text-left"
                  >
                    Remove image
                  </button>
                )}
              </div>
            </div>
            {imageDirty && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleSaveImage}
                  disabled={savingImage}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg"
                >
                  {savingImage ? "Saving..." : "Save Image"}
                </button>
                <button
                  onClick={() => setImageData(item.image_data ?? null)}
                  disabled={savingImage}
                  className="text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg"
                >
                  Cancel
                </button>
              </div>
            )}
            {imageError && (
              <p className="text-xs text-red-600 mt-1.5">{imageError}</p>
            )}
          </div>

          <AdjustRow
            label="Total Quantity"
            value={totalQuantity}
            otherValue={inUseQuantity}
            isTotalField
            busy={busyField === "total_quantity"}
            onApply={(delta) => adjust("total_quantity", delta)}
          />
          <AdjustRow
            label="In Use"
            value={inUseQuantity}
            otherValue={totalQuantity}
            isTotalField={false}
            busy={busyField === "in_use_quantity"}
            onApply={(delta) => adjust("in_use_quantity", delta)}
          />
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs text-slate-400 uppercase tracking-wide">
              Available
            </span>
            <span
              className={`text-sm font-semibold ${available <= LOW_STOCK_THRESHOLD ? "text-red-600" : "text-slate-700"}`}
            >
              {available}
            </span>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="pt-3 border-t border-slate-100">
            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-slate-400 hover:text-red-600 font-medium"
              >
                Delete this item
              </button>
            ) : (
              <div className="bg-red-50 border border-red-100 rounded-lg p-3">
                <p className="text-xs text-red-700 mb-2">
                  Delete "{item.name}" permanently? This can't be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-md"
                  >
                    {deleting ? "Deleting..." : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="text-xs px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────
export default function Inventory() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [modalItem, setModalItem] = useState(null); // null = closed, {} = add new, item = edit
  const [manageItem, setManageItem] = useState(null); // item currently open in the manage window
  const [expandedItemId, setExpandedItemId] = useState(null); // row whose Purchase/Sell dropdown is open
  const [purchaseBusyId, setPurchaseBusyId] = useState(null);
  const [sellBusyId, setSellBusyId] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getInventory();
      setItems(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Silent refresh — updates the background items list without touching
  // `loading`, so it never triggers the page's full-screen loading state.
  // That matters because the ManageModal is a child of this component's
  // main render tree: if `loading` flips true, the "Loading..." early
  // return unmounts the modal entirely (wiping its in-progress quantity
  // state) until the fetch finishes and everything remounts from scratch.
  // Used after quantity adjustments so the modal can stay open and keep
  // showing the value it just received from the server.
  async function refreshItemsSilently() {
    try {
      const data = await getInventory();
      setItems(data);
    } catch (e) {
      console.error("Failed to refresh inventory list:", e);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Purchase/Sell act directly on an item from its row dropdown — both use
  // the silent refresh (not `load`) for the same reason ManageModal does:
  // flipping `loading` would unmount the expanded row and close the
  // dropdown before the person can see the result.
  async function handlePurchase(item, quantity, unitCost) {
    setPurchaseBusyId(item.id);
    try {
      await purchaseInventoryItem(item.id, { quantity, unit_cost: unitCost });
      await refreshItemsSilently();
    } finally {
      setPurchaseBusyId(null);
    }
  }

  async function handleSell(item, quantity, unitPrice, buyerName) {
    setSellBusyId(item.id);
    try {
      await sellInventoryItem(item.id, {
        quantity,
        unit_price: unitPrice,
        buyer_name: buyerName,
      });
      await refreshItemsSilently();
    } finally {
      setSellBusyId(null);
    }
  }

  const categoryOptions = useMemo(
    () => [...new Set(items.map((i) => i.category).filter(Boolean))].sort(),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items
        .filter((i) => !filterCategory || i.category === filterCategory)
        .filter(
          (i) =>
            !search.trim() ||
            i.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .filter((i) => !lowStockOnly || i.available_quantity <= LOW_STOCK_THRESHOLD)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [items, filterCategory, search, lowStockOnly],
  );

  const totals = useMemo(
    () => ({
      items: items.length,
      totalUnits: items.reduce((s, i) => s + i.total_quantity, 0),
      lowStock: items.filter((i) => i.available_quantity <= LOW_STOCK_THRESHOLD)
        .length,
    }),
    [items],
  );

  if (loading) return <p className="p-8 text-slate-400">Loading...</p>;
  if (error) return <p className="p-8 text-red-500">{error}</p>;

  return (
    <div className="p-8 w-full">
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-xl font-semibold text-slate-900">Inventory</h1>

        <Link
          to="/inventory/history"
          className="text-sm px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg inline-flex items-center gap-1.5"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          History
        </Link>
      </div>

      <p className="text-sm text-slate-400 mb-6">
        Track what's in stock and what's currently in use.
      </p>

      {/* ── Summary ── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-2xl font-semibold text-slate-900">
            {totals.items}
          </p>
          <p className="text-xs text-slate-400">Items tracked</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-2xl font-semibold text-slate-900">
            {totals.totalUnits}
          </p>
          <p className="text-xs text-slate-400">Total units</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p
            className={`text-2xl font-semibold ${totals.lowStock > 0 ? "text-red-600" : "text-slate-900"}`}
          >
            {totals.lowStock}
          </p>
          <p className="text-xs text-slate-400">
            Low stock (≤ {LOW_STOCK_THRESHOLD} available)
          </p>
        </div>
      </div>

      {/* ── Items table ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Items</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {filteredItems.length} of {items.length} items
            </p>
          </div>
          <button
            onClick={() => setModalItem({})}
            className="text-sm px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg"
          >
            + Add Item
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
            className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 w-56"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All categories</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => setLowStockOnly((v) => !v)}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium border ${
              lowStockOnly
                ? "bg-red-50 border-red-200 text-red-700"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            Low stock only
            {totals.lowStock > 0 && (
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${lowStockOnly ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}`}
              >
                {totals.lowStock}
              </span>
            )}
          </button>
          {(filterCategory || search || lowStockOnly) && (
            <button
              onClick={() => {
                setFilterCategory("");
                setSearch("");
                setLowStockOnly(false);
              }}
              className="text-xs text-slate-400 hover:text-slate-600 underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-slate-200 rounded-lg">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2 text-center">Total</th>
                <th className="px-3 py-2 text-center">In Use</th>
                <th className="px-3 py-2 text-center">Available</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Sale Price</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-8 text-center text-slate-400 text-sm"
                  >
                    {items.length === 0
                      ? "No items in inventory yet."
                      : "No items match the current filters."}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const lowStock = item.available_quantity <= LOW_STOCK_THRESHOLD;
                  const isExpanded = expandedItemId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() =>
                          setExpandedItemId((id) => (id === item.id ? null : item.id))
                        }
                        className="border-t border-slate-100 hover:bg-slate-50/60 align-top cursor-pointer"
                      >
                        <td className="px-3 py-2">
                          {item.image_data && (
                            <img
                              src={item.image_data}
                              alt={item.name}
                              className="w-28 h-28 object-contain rounded-md border border-slate-200 bg-slate-50 mb-2"
                            />
                          )}
                          <div className="flex items-center gap-1.5">
                            <svg
                              className={`w-3.5 h-3.5 text-slate-300 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path d="M9 6l6 6-6 6" />
                            </svg>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalItem(item);
                              }}
                              className="block text-sm font-medium text-slate-800 hover:text-blue-600 hover:underline text-left"
                            >
                              {item.name}
                            </button>
                          </div>
                          {item.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 pl-5">
                              {item.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {item.category || "—"}
                        </td>
                        <td className="px-3 py-2 text-center text-sm font-semibold text-slate-700">
                          {item.total_quantity}
                        </td>
                        <td className="px-3 py-2 text-center text-sm font-semibold text-slate-700">
                          {item.in_use_quantity}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`text-sm font-semibold px-2 py-0.5 rounded-full ${lowStock ? "bg-red-50 text-red-600" : "text-slate-700"}`}
                          >
                            {item.available_quantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500">
                          {formatPrice(item.cost_price)}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-slate-500">
                          {formatPrice(item.sale_price)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setManageItem(item);
                            }}
                            className="text-xs px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-t border-slate-100 bg-slate-50/60">
                          <td colSpan={8} className="px-3 py-4">
                            <div
                              className="flex flex-col gap-3 max-w-xl"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <PurchaseRow
                                currentCostPrice={item.cost_price}
                                busy={purchaseBusyId === item.id}
                                onApply={(qty, cost) => handlePurchase(item, qty, cost)}
                              />
                              <SellRow
                                currentSalePrice={item.sale_price}
                                available={item.available_quantity}
                                busy={sellBusyId === item.id}
                                onApply={(qty, price, buyer) =>
                                  handleSell(item, qty, price, buyer)
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalItem !== null && (
        <ItemModal
          item={modalItem.id ? modalItem : null}
          onClose={() => setModalItem(null)}
          onSaved={load}
        />
      )}

      {manageItem && (
        <ManageModal
          item={manageItem}
          onClose={() => setManageItem(null)}
          onChanged={refreshItemsSilently}
        />
      )}
    </div>
  );
}
