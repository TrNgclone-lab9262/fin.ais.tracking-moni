"use client";

import React from "react";
import {
  X,
  Home,
  ArrowLeftRight,
  CreditCard,
  Target,
  Coins,
  HelpCircle,
  Settings,
  Heart,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { useFinance, NavTab, PerspectiveMode } from "@/context/FinanceContext";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const {
    activeTab,
    setActiveTab,
    activePerspective,
    setActivePerspective,
    isCloudConnected,
    isSyncing,
    husbandCreditCard,
    wifeCreditCard,
    debts,
  } = useFinance();

  if (!isOpen) return null;

  const creditCardWarning =
    (husbandCreditCard && husbandCreditCard.usagePercentage >= 70) ||
    (wifeCreditCard && wifeCreditCard.usagePercentage >= 70);

  const activeDebtsCount = debts.filter((d) => d.status === "ACTIVE").length;

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }[] = [
    { id: "overview", label: "Tổng quan tổ ấm", icon: Home },
    { id: "transactions", label: "Sổ giao dịch", icon: ArrowLeftRight },
    {
      id: "accounts",
      label: "Tài khoản & Thẻ",
      icon: CreditCard,
      badge: creditCardWarning ? "Cảnh báo" : undefined,
      badgeColor: "bg-amber-400 text-amber-950",
    },
    { id: "planning", label: "Ngân sách & Mục tiêu", icon: Target },
    {
      id: "debts_invest",
      label: "Khoản nợ & Đầu tư",
      icon: Coins,
      badge: activeDebtsCount > 0 ? `${activeDebtsCount}` : undefined,
      badgeColor: "bg-blue-600 text-white",
    },
    { id: "guide", label: "Cẩm nang tổ ấm", icon: HelpCircle },
    { id: "settings", label: "Cài đặt & Tùy biến", icon: Settings },
  ];

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div
        className="relative w-full max-w-[320px] bg-gradient-to-b from-[#1E3A8A] via-[#1D4ED8] to-[#172554] text-white h-full shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          {/* Header */}
          <div className="h-18 flex items-center justify-between px-5 border-b border-blue-800/40">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                <Home className="w-5 h-5" />
              </div>
              <div>
                <span className="font-black text-base tracking-wider block leading-tight">
                  HOME MONI
                </span>
                <span className="text-[10px] text-blue-200 uppercase tracking-widest font-bold">
                  🏡 My Home
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Family Mini Profile */}
          <div className="p-4 mx-3 my-3 rounded-xl bg-blue-950/40 border border-blue-800/40 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>👨 Anh Chuột</span>
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                <span>👩 Bé Mèo</span>
              </span>
              <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {isCloudConnected ? "Cloud Sync" : "Local-First"}
              </span>
            </div>

            {/* Quick Perspective Filter */}
            <div className="grid grid-cols-3 gap-1 bg-blue-900/40 p-1 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActivePerspective("ALL")}
                className={`py-1 rounded-md transition-all ${
                  activePerspective === "ALL"
                    ? "bg-white text-blue-900 shadow-xs"
                    : "text-blue-200 hover:text-white"
                }`}
              >
                🏡 Chung
              </button>
              <button
                type="button"
                onClick={() => setActivePerspective("HUSBAND")}
                className={`py-1 rounded-md transition-all ${
                  activePerspective === "HUSBAND"
                    ? "bg-white text-blue-900 shadow-xs"
                    : "text-blue-200 hover:text-white"
                }`}
              >
                👨 Chuột
              </button>
              <button
                type="button"
                onClick={() => setActivePerspective("WIFE")}
                className={`py-1 rounded-md transition-all ${
                  activePerspective === "WIFE"
                    ? "bg-white text-blue-900 shadow-xs"
                    : "text-blue-200 hover:text-white"
                }`}
              >
                👩 Mèo
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-white text-blue-900 shadow-md font-black"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 ${
                      isActive ? "text-blue-700" : "text-blue-200"
                    }`}
                  />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.badgeColor || "bg-blue-800 text-white"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-blue-800/40 text-[11px] text-blue-300/80 bg-blue-950/40 flex items-center justify-between">
          <span>HOME MONI v5.2</span>
          <span className="flex items-center gap-1 text-emerald-300 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            An toàn bảo mật
          </span>
        </div>
      </div>
    </div>
  );
}
