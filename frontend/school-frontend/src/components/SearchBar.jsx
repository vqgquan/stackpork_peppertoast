import { useState, useRef, useEffect } from "react"

/**
 * SearchBar — reusable multi-attribute search component
 *
 * Props:
 *   fields  — array of { key, label } defining which attributes are searchable
 *   onSearch(filters) — called whenever filters change
 *                       filters = { field1: "value", field2: "value", ... }
 *
 * Usage example (Students page):
 *   <SearchBar
 *     fields={[
 *       { key: "name",   label: "Name" },
 *       { key: "phone",  label: "Phone" },
 *       { key: "gender", label: "Gender" },
 *       { key: "email",  label: "Email" },
 *     ]}
 *     onSearch={setFilters}
 *   />
 */
export default function SearchBar({ fields = [], onSearch }) {
  // Active field being typed into — default to first field
  const [activeField, setActiveField] = useState(fields[0]?.key ?? "")
  const [filters, setFilters] = useState({})
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  // Notify parent whenever filters change
  useEffect(() => {
    onSearch(filters)
  }, [filters])

  function handleFieldSelect(key) {
    setActiveField(key)
    setInputValue(filters[key] ?? "")
    setDropdownOpen(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function handleInputChange(e) {
    const val = e.target.value
    setInputValue(val)
    const updated = { ...filters }
    if (val.trim() === "") {
      delete updated[activeField]
    } else {
      updated[activeField] = val.trim()
    }
    setFilters(updated)
  }

  function removeFilter(key) {
    const updated = { ...filters }
    delete updated[key]
    setFilters(updated)
    if (activeField === key) setInputValue("")
  }

  function clearAll() {
    setFilters({})
    setInputValue("")
    inputRef.current?.focus()
  }

  const activeLabel = fields.find(f => f.key === activeField)?.label ?? ""
  const activeFilters = Object.entries(filters)

  return (
    <div className="mb-6">
      {/* Search input row */}
      <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 transition-all">

        {/* Field selector dropdown */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            {activeLabel}
            <svg className={`w-3 h-3 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
              {fields.map(f => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => handleFieldSelect(f.key)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50 transition-colors ${
                    activeField === f.key ? "text-blue-700 font-medium bg-blue-50" : "text-slate-700"
                  }`}
                >
                  {f.label}
                  {filters[f.key] && (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <span className="w-px h-4 bg-slate-200 flex-shrink-0" />

        {/* Text input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setDropdownOpen(false)}
          placeholder={`Search by ${activeLabel.toLowerCase()}…`}
          className="flex-1 text-sm text-slate-800 placeholder-slate-400 bg-transparent outline-none min-w-0"
        />

        {/* Clear all button */}
        {activeFilters.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
            title="Clear all filters"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2.5">
          {activeFilters.map(([key, value]) => {
            const label = fields.find(f => f.key === key)?.label ?? key
            return (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium"
              >
                <span className="text-blue-400">{label}:</span>
                {value}
                <button
                  type="button"
                  onClick={() => removeFilter(key)}
                  className="text-blue-400 hover:text-blue-700 ml-0.5 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </span>
            )
          })}
          <span className="text-xs text-slate-400 self-center">
            {activeFilters.length} filter{activeFilters.length > 1 ? "s" : ""} active
          </span>
        </div>
      )}
    </div>
  )
}
