"use client";

import { useState, type ReactNode } from "react";

type Tab = { id: string; label: string; content: ReactNode };

export function FormTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  return (
    <div>
      <div className="mb-6 overflow-x-auto border-b border-slate-200">
        <div className="flex min-w-max gap-1" role="tablist">
          {tabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)} className={`border-b-2 px-4 py-3 text-sm font-semibold transition ${active === tab.id ? "border-brand-700 text-brand-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{tab.label}</button>)}
        </div>
      </div>
      {tabs.map((tab) => <div key={tab.id} className={active === tab.id ? "block" : "hidden"} aria-hidden={active !== tab.id}>{tab.content}</div>)}
    </div>
  );
}
