import { useEffect, useRef, useState } from "react";

export default function TimeSelect({ value, onChange, className = "", buttonClassName = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const [h, m] = value ? value.split(":") : ["", ""];

  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function pick(newH, newM) {
    onChange(`${newH}:${newM}`);
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`.trim()} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-left ${buttonClassName}`.trim()}
      >
        {value || "--:--"}
      </button>

      {open && (
        <div className="absolute z-10 mt-1 flex border border-slate-200 rounded-lg bg-white shadow-lg overflow-hidden">
          <div className="w-20 max-h-64 overflow-y-auto border-r border-slate-100">
            {hours.map((hh) => (
              <button
                key={hh}
                type="button"
                onClick={() => pick(hh, m || "00")}
                className={`w-full px-3 py-2.5 text-base text-center hover:bg-slate-50 ${
                  hh === h ? "bg-blue-100 font-semibold text-blue-700" : ""
                }`}
              >
                {hh}
              </button>
            ))}
          </div>
          <div className="w-20 max-h-64 overflow-y-auto">
            {minutes.map((mm) => (
              <button
                key={mm}
                type="button"
                onClick={() => pick(h || "00", mm)}
                className={`w-full px-3 py-2.5 text-base text-center hover:bg-slate-50 ${
                  mm === m ? "bg-blue-100 font-semibold text-blue-700" : ""
                }`}
              >
                {mm}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
