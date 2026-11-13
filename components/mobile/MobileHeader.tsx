"use client";

import React from "react";
import { Menu, Home, RefreshCw, Camera, Eye, EyeOff } from "lucide-react";
import { useFinance, PerspectiveMode } from "@/context/FinanceContext";

interface MobileHeaderProps {
  onOpenDrawer: () => void;
  onOpenScanner?: () => void;
}

export function MobileHeader({ onOpenDrawer, onOpenScanner }: MobileHeaderProps) {
  const {
    activePerspective,
    setActivePerspective,
    isCloudConnected,
    isSyncing,
    isPrivacyMode,
    togglePrivacyMode,
  } = useFinance();

  const perspectives: { id: PerspectiveMode; label: string; icon: string }[] = [
    { id: "ALL", label: "Tất cả", icon: "🏡" },
    { id: "HUSBAND", label: "Chuột", icon: "👨" },
    { id: "WIFE", label: "Mèo", icon: "👩" },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#DCE4EE] px-3 py-2.5 flex items-center justify-between gap-1.5 shadow-xs">
      {/* Nút Hamburger + Logo Brand */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onOpenDrawer}
          aria-label="Mở menu tổ ấm"
          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-7 h-7 rounded-md bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <Home className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span className="font-black text-xs sm:text-sm tracking-wide text-[#1E3A8A] truncate">
            HOME MONI
          </span>
        </div>
      </div>

      {/* Perspective Switcher */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200/80 shrink-0">
        {perspectives.map((p) => {
          const isActive = activePerspective === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setActivePerspective(p.id)}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-blue-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span>{p.icon}</span>
              <span className="text-[10px]">{p.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Privacy Eye Toggle */}
        <button
          onClick={togglePrivacyMode}
          aria-label={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
          title={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền nhạy cảm"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer border ${
            isPrivacyMode
              ? "bg-amber-50 text-amber-700 border-amber-200"
              : "bg-slate-100 text-slate-600 border-slate-200/80"
          }`}
        >
          {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        {/* Nút Quét Hóa Đơn AI Nhanh */}
        {onOpenScanner && (
          <button
            onClick={onOpenScanner}
            aria-label="Quét hóa đơn bằng AI"
            className="w-8 h-8 rounded-lg bg-indigo-50 active:bg-indigo-100 text-indigo-600 flex items-center justify-center transition-all cursor-pointer border border-indigo-200/80"
            title="Quét hóa đơn thông minh"
          >
            <Camera className="w-4 h-4" />
          </button>
        )}

        {/* Sync dot */}
        <div className="flex items-center">
          {isSyncing ? (
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />
          ) : isCloudConnected ? (
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100" title="Cloud Sync Hoạt động" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" title="Local-first Storage" />
          )}
        </div>
      </div>
    </header>
  );
}
