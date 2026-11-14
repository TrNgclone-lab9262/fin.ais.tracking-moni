"use client";

import React from "react";
import { Building2, Wallet } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { SubAppId } from "@/types/finance";

interface AppSwitcherProps {
  collapsed?: boolean;
  onSwitched?: () => void;
  variant?: "sidebar" | "header";
}

export function AppSwitcher({
  collapsed = false,
  onSwitched,
  variant = "sidebar",
}: AppSwitcherProps) {
  const { activeApp, switchSubApp } = useFinance();

  const handleSelect = (app: SubAppId) => {
    if (app !== activeApp) {
      switchSubApp(app);
    }
    onSwitched?.();
  };

  if (variant === "header") {
    return (
      <div
        role="tablist"
        aria-label="Chuyển đổi ứng dụng HOME MONI"
        className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 shrink-0"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "FINANCE"}
          data-testid="app-switcher-finance"
          onClick={() => handleSelect("FINANCE")}
          className={`min-h-[30px] px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeApp === "FINANCE"
              ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-2xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Wallet className="w-3.5 h-3.5 shrink-0" />
          <span>Thu chi</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "SKYONE"}
          data-testid="app-switcher-skyone"
          onClick={() => handleSelect("SKYONE")}
          className={`min-h-[30px] px-2.5 py-1 rounded-md text-[11px] font-bold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
            activeApp === "SKYONE"
              ? "bg-indigo-600 text-white shadow-2xs"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span>SKYONE</span>
        </button>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="px-2.5 pt-3 pb-1 flex flex-col items-center gap-1.5 shrink-0">
        <button
          type="button"
          data-testid="app-switcher-finance"
          onClick={() => handleSelect("FINANCE")}
          title="HOME MONI · Thu chi tổ ấm"
          aria-label="Chuyển sang HOME MONI Thu chi tổ ấm"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            activeApp === "FINANCE"
              ? "bg-white text-blue-800 shadow-md"
              : "bg-white/10 text-blue-100 hover:bg-white/20"
          }`}
        >
          <Wallet className="w-4 h-4" />
        </button>
        <button
          type="button"
          data-testid="app-switcher-skyone"
          onClick={() => handleSelect("SKYONE")}
          title="Phú Đông SKYONE · Vay căn hộ"
          aria-label="Chuyển sang Phú Đông SKYONE"
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
            activeApp === "SKYONE"
              ? "bg-indigo-500 text-white shadow-md ring-1 ring-white/30"
              : "bg-white/10 text-blue-100 hover:bg-white/20"
          }`}
        >
          <Building2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3 pb-1 shrink-0">
      <div
        role="tablist"
        aria-label="Chuyển đổi phân hệ ứng dụng"
        className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/25 border border-white/10"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "FINANCE"}
          data-testid="app-switcher-finance"
          onClick={() => handleSelect("FINANCE")}
          className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            activeApp === "FINANCE"
              ? "bg-white text-blue-900 shadow-sm"
              : "text-white/75 hover:text-white hover:bg-white/10"
          }`}
        >
          <Wallet className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Thu chi</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeApp === "SKYONE"}
          data-testid="app-switcher-skyone"
          onClick={() => handleSelect("SKYONE")}
          className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
            activeApp === "SKYONE"
              ? "bg-indigo-500 text-white shadow-sm ring-1 ring-white/25"
              : "text-white/75 hover:text-white hover:bg-white/10"
          }`}
        >
          <Building2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">SKYONE</span>
        </button>
      </div>
    </div>
  );
}
