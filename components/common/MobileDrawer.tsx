"use client";

import React from "react";
import {
  X,
  Home,
  ArrowLeftRight,
  CreditCard,
  Target,
  Coins,
  Database,
  HelpCircle,
  Settings,
  Heart,
  ShieldCheck,
  Lock,
  Building2,
  TrendingDown,
  Calendar,
  Calculator,
  SlidersHorizontal,
  Compass,
  Layers,
  Box,
  ClipboardCheck,
  TrendingUp,
  Scale,
  Wallet,
} from "lucide-react";
import { useFinance, NavTab } from "@/context/FinanceContext";
import { usePWAUpdate } from "@/context/PWAUpdateContext";
import { APP_VERSION } from "@/constants/appVersion";
import { GoldRouteTab, InteriorRouteTab, SkyOneRouteTab } from "@/types/finance";
import { useHaptic } from "@/src/hooks/useHaptic";

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const {
    activeApp,
    activeTab,
    setActiveTab,
    skyoneTab,
    setSkyoneTab,
    goldTab,
    setGoldTab,
    interiorTab,
    setInteriorTab,
    activePerspective,
    setActivePerspective,
    isCloudConnected,
    husbandCreditCard,
    wifeCreditCard,
    debts,
    settings,
    lockApp,
  } = useFinance();

  const { hasUpdate } = usePWAUpdate();
  const haptic = useHaptic();

  if (!isOpen) return null;

  const creditCardWarning =
    (husbandCreditCard && husbandCreditCard.usagePercentage > 30) ||
    (wifeCreditCard && wifeCreditCard.usagePercentage > 30);

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
      badge: creditCardWarning ? ">30%" : undefined,
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
    {
      id: "data_admin",
      label: "Quản trị Dữ liệu",
      icon: Database,
      badge: "Studio",
      badgeColor: "bg-indigo-400 text-indigo-950",
    },
    { id: "guide", label: "Cẩm nang tổ ấm", icon: HelpCircle },
    {
      id: "settings",
      label: "Cài đặt & Tùy biến",
      icon: Settings,
      badge: hasUpdate ? "Bản mới" : undefined,
      badgeColor: "bg-sky-300 text-blue-950",
    },
  ];

  const skyoneNavItems: {
    id: SkyOneRouteTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "OVERVIEW", label: "Tổng quan & Stress-Test", icon: TrendingDown },
    { id: "ADVISOR", label: "Cố vấn Chiến lược", icon: Compass },
    { id: "SCHEDULE", label: "Lịch trả nợ & Dòng tiền", icon: Calendar },
    { id: "PREPAYMENT", label: "Trả gốc trước hạn", icon: Calculator },
    { id: "CONTRACT", label: "Hợp đồng & Hồ sơ Pháp lý", icon: SlidersHorizontal },
    { id: "DATA_ADMIN", label: "Quản trị Dữ liệu", icon: Database },
    { id: "SETTINGS", label: "Cài đặt chung", icon: Settings },
  ];

  const goldNavItems: {
    id: GoldRouteTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "OVERVIEW", label: "Tổng quan Kho Vàng", icon: Coins },
    { id: "LOTS", label: "Sổ Lô Vàng & Giá Vốn", icon: Layers },
    { id: "PRICES", label: "Bảng Giá & Chênh Lệch", icon: TrendingUp },
    { id: "DCA", label: "Kế hoạch DCA", icon: Target },
    { id: "SIMULATOR", label: "Mô phỏng Bán Q3/2027", icon: Scale },
  ];

  const interiorNavItems: {
    id: InteriorRouteTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "STUDIO", label: "Phối cảnh 3D & Mặt bằng 2D", icon: Box },
    { id: "BOQ", label: "Dự toán Nội thất BOQ", icon: Calculator },
    { id: "READINESS", label: "Sẵn sàng Bàn giao Q3/2027", icon: Wallet },
    { id: "CHECKLIST", label: "Checklist Nghiệm thu", icon: ClipboardCheck },
  ];

  const handleSelectTab = (tab: NavTab) => {
    haptic.light();
    setActiveTab(tab);
    onClose();
  };

  const handleSelectSkyOneTab = (tab: SkyOneRouteTab) => {
    haptic.light();
    setSkyoneTab(tab);
    onClose();
  };

  const handleSelectGoldTab = (tab: GoldRouteTab) => {
    haptic.light();
    setGoldTab(tab);
    onClose();
  };

  const handleSelectInteriorTab = (tab: InteriorRouteTab) => {
    haptic.light();
    setInteriorTab(tab);
    onClose();
  };

  const drawerBgClass =
    activeApp === "SKYONE"
      ? "bg-gradient-to-b from-[#1E1B4B] via-[#312E81] to-[#0F172A] dark:from-[#0F172A] dark:via-[#111827] dark:to-[#090F1D]"
      : activeApp === "GOLD"
        ? "bg-gradient-to-b from-[#451A03] via-[#78350F] to-[#1C1917] dark:from-[#1C1917] dark:via-[#292524] dark:to-[#0C0A09]"
        : activeApp === "INTERIOR"
          ? "bg-gradient-to-b from-[#134E4A] via-[#115E59] to-[#0F172A] dark:from-[#0F172A] dark:via-[#132A2E] dark:to-[#090F1D]"
          : "bg-gradient-to-b from-[#1E3A8A] via-[#1D4ED8] to-[#172554] dark:from-[#0F172A] dark:via-[#111C33] dark:to-[#090F1D]";

  const brandTitle =
    activeApp === "SKYONE"
      ? "SKYONE LOAN"
      : activeApp === "GOLD"
        ? "GOLD VAULT"
        : activeApp === "INTERIOR"
          ? "SKYONE 3D"
          : "HOME MONI";

  const brandSubtitle =
    activeApp === "SKYONE"
      ? "Phú Đông SKYONE"
      : activeApp === "GOLD"
        ? "Kho Tích Sản Vàng"
        : activeApp === "INTERIOR"
          ? "A.12A.07 Interior Studio"
          : "🏡 My Home";

  return (
    <div className="fixed inset-0 z-50 flex md:hidden animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer content */}
      <div
        className={`relative w-full max-w-[320px] text-white h-full pt-safe pb-safe shadow-2xl flex flex-col justify-between z-10 animate-in slide-in-from-left duration-200 select-none ${drawerBgClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto">
          {/* Header */}
          <div className="h-18 flex items-center justify-between px-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-400 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-md">
                {activeApp === "SKYONE" ? (
                  <Building2 className="w-5 h-5" />
                ) : activeApp === "GOLD" ? (
                  <Coins className="w-5 h-5" />
                ) : activeApp === "INTERIOR" ? (
                  <Box className="w-5 h-5" />
                ) : (
                  <Home className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="font-black text-base tracking-wider block leading-tight">
                  {brandTitle}
                </span>
                <span className="text-[10px] text-blue-200 uppercase tracking-widest font-bold">
                  {brandSubtitle}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                haptic.light();
                onClose();
              }}
              aria-label="Đóng menu"
              className="p-1.5 rounded-md text-blue-200 hover:text-white hover:bg-white/10 transition-all active:scale-95 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Family Mini Profile */}
          <div className="p-4 mx-3 my-3 rounded-xl bg-blue-950/40 dark:bg-slate-900/60 border border-blue-800/40 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <span>👨 {settings.husbandName}</span>
                <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                <span>👩 {settings.wifeName}</span>
              </span>
              <span className="text-[10px] text-emerald-300 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {isCloudConnected ? "Cloud Sync" : "Local-First"}
              </span>
            </div>

            {/* Quick Perspective Filter */}
            <div className="grid grid-cols-3 gap-1 bg-blue-900/40 dark:bg-slate-800/80 p-1 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setActivePerspective("ALL");
                }}
                className={`py-1 rounded-md transition-all active:scale-95 cursor-pointer ${
                  activePerspective === "ALL"
                    ? "bg-white dark:bg-blue-600 text-blue-900 dark:text-white shadow-xs"
                    : "text-blue-200 dark:text-slate-300 hover:text-white"
                }`}
              >
                🏡 Chung
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setActivePerspective("HUSBAND");
                }}
                className={`py-1 rounded-md transition-all active:scale-95 cursor-pointer ${
                  activePerspective === "HUSBAND"
                    ? "bg-white dark:bg-blue-600 text-blue-900 dark:text-white shadow-xs"
                    : "text-blue-200 dark:text-slate-300 hover:text-white"
                }`}
              >
                👨 Chuột
              </button>
              <button
                type="button"
                onClick={() => {
                  haptic.light();
                  setActivePerspective("WIFE");
                }}
                className={`py-1 rounded-md transition-all active:scale-95 cursor-pointer ${
                  activePerspective === "WIFE"
                    ? "bg-white dark:bg-blue-600 text-blue-900 dark:text-white shadow-xs"
                    : "text-blue-200 dark:text-slate-300 hover:text-white"
                }`}
              >
                👩 Mèo
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {activeApp === "SKYONE"
              ? skyoneNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = skyoneTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelectSkyOneTab(item.id)}
                      className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                        isActive
                          ? "bg-white dark:bg-indigo-600 text-indigo-950 dark:text-white shadow-md font-black"
                          : "text-indigo-100 dark:text-slate-300 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Icon
                        className={`w-5 h-5 shrink-0 ${
                          isActive
                            ? "text-indigo-700 dark:text-white"
                            : "text-indigo-200 dark:text-slate-400"
                        }`}
                      />
                      <span className="flex-1 text-left">{item.label}</span>
                    </button>
                  );
                })
              : activeApp === "GOLD"
                ? goldNavItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = goldTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectGoldTab(item.id)}
                        className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                          isActive
                            ? "bg-white dark:bg-amber-600 text-amber-950 dark:text-white shadow-md font-black"
                            : "text-amber-100 dark:text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 shrink-0 ${
                            isActive
                              ? "text-amber-700 dark:text-white"
                              : "text-amber-200 dark:text-slate-400"
                          }`}
                        />
                        <span className="flex-1 text-left">{item.label}</span>
                      </button>
                    );
                  })
                : activeApp === "INTERIOR"
                  ? interiorNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = interiorTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectInteriorTab(item.id)}
                          className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                            isActive
                              ? "bg-white dark:bg-teal-600 text-teal-950 dark:text-white shadow-md font-black"
                              : "text-teal-100 dark:text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 shrink-0 ${
                              isActive
                                ? "text-teal-700 dark:text-white"
                                : "text-teal-200 dark:text-slate-400"
                            }`}
                          />
                          <span className="flex-1 text-left">{item.label}</span>
                        </button>
                      );
                    })
                  : navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all active:scale-[0.98] cursor-pointer ${
                            isActive
                              ? "bg-white dark:bg-blue-600 text-blue-900 dark:text-white shadow-md font-black"
                              : "text-blue-100 dark:text-slate-300 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <Icon
                            className={`w-5 h-5 shrink-0 ${
                              isActive ? "text-blue-700 dark:text-white" : "text-blue-200 dark:text-slate-400"
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
        <div className="p-4 border-t border-blue-800/40 text-[11px] text-blue-300/80 bg-blue-950/40 space-y-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              haptic.medium();
              onClose();
              lockApp();
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Khóa & Mở màn hình /login</span>
          </button>

          <div className="flex items-center justify-between">
            <span>HOME MONI v{APP_VERSION}</span>
            <span className="flex items-center gap-1 text-emerald-300 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              An toàn bảo mật
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
