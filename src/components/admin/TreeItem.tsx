'use client';

import { Children, useState } from 'react';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ease-out ${open ? 'rotate-90' : ''}`}
    >
      <path d="M7 4.5L13 10L7 15.5" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TreeItem({
  label,
  badge,
  children,
  defaultOpen = false,
  onClick,
  active,
}: {
  label: string;
  badge?: string;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  onClick?: () => void;
  active?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;
  const childCount = hasChildren ? Children.count(children) : 0;

  function handleClick() {
    if (hasChildren) setOpen((v) => !v);
    onClick?.();
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        aria-expanded={hasChildren ? open : undefined}
        className={`group flex items-center gap-2 w-full text-left text-sm px-2.5 py-1.5 rounded-lg border transition-colors duration-150 ${
          active
            ? 'bg-primary/15 border-primary/40 text-primary font-medium'
            : hasChildren
              ? 'bg-white/[0.03] border-border/60 hover:bg-primary/10 hover:border-primary/40 text-gray-200 font-medium'
              : 'border-transparent text-gray-400 hover:bg-background/60 hover:text-gray-200'
        }`}
      >
        {hasChildren ? (
          <span className={`shrink-0 ${active ? 'text-primary' : 'text-primary/80 group-hover:text-primary'}`}>
            <ChevronIcon open={open} />
          </span>
        ) : (
          <span className="shrink-0 w-3.5 flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-gray-600" />
          </span>
        )}

        <span className="flex-1 truncate">{label}</span>

        {badge && <span className="shrink-0 text-[10px] text-gray-500">{badge}</span>}

        {hasChildren && (
          <span
            className={`shrink-0 text-[10px] rounded-full px-1.5 py-0.5 border transition-colors duration-150 ${
              active
                ? 'border-primary/40 text-primary bg-primary/10'
                : 'border-border text-gray-500 bg-background/70 group-hover:border-primary/30 group-hover:text-primary/90'
            }`}
          >
            {childCount}
          </span>
        )}
      </button>

      {hasChildren && (
        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div
              className={`ml-[7px] border-l-2 border-primary/25 pl-3 mt-1 space-y-1 pb-1 transition-opacity duration-200 ${
                open ? 'opacity-100 delay-100' : 'opacity-0'
              }`}
            >
              {children}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
