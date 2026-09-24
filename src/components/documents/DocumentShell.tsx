'use client';

export function DocumentShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="no-print flex justify-end mb-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="text-xs border border-border text-gray-300 hover:bg-surface px-3 py-1.5 rounded-lg"
        >
          🖨 Imprimir / Exportar PDF
        </button>
      </div>
      <div className="print-area bg-white text-gray-900 rounded-xl border border-gray-300 p-8 shadow-lg space-y-6 text-sm leading-relaxed">
        <header className="text-center border-b border-gray-300 pb-4">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide">Universidad Nacional de La Rioja — DACEFyN</p>
          <h2 className="text-lg font-semibold mt-1">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </header>
        {children}
      </div>
    </div>
  );
}

export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500 border-b border-gray-200 pb-1">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function DocField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-sm">
      <dt className="text-gray-500 col-span-1">{label}</dt>
      <dd className="col-span-2 text-gray-900">{value || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export function DocTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((h) => (
              <th key={h} className="border border-gray-300 px-2 py-1 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border border-gray-300 px-2 py-1 align-top">
                  {cell ?? '—'}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="border border-gray-300 px-2 py-2 text-gray-400 text-center">
                Sin datos cargados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
