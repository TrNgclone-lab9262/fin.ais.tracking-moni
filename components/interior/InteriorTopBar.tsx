"use client";

import React from "react";
import { Eye, EyeOff, Sun, Moon, Database } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AppSwitcherWaffle } from "@/components/common/AppSwitcherWaffle";
import { InteriorRouteTab } from "@/types/finance";

interface InteriorTopBarProps {
  onOpenBackupModal: () => void;
}

const TAB_TITLES: Record<InteriorRouteTab, { title: string; subtitle: string }> = {
  STUDIO: {
    title: "Phối Cảnh Nội Thất 3D · A.12A.07",
    subtitle: "Loại A2 (51.0 m² thông thủy · 55.3 m² xây dựng) · So sánh PA-A & PA-B Dual Studio",
  },
  BOQ: {
    title: "Dự Toán BOQ & Tiến Độ Mua Sắm",
    subtitle: "Khung mục tiêu 100–150 triệu trọn gói nội thất gỗ + điện máy · Bếp & WC CĐT = 0 đ",
  },
  READINESS: {
    title: "Cầu Nối Tài Chính Nhận Nhà Q3/2027",
    subtitle: "Hợp nhất Tiền mặt + Thặng dư + Kho Vàng (Bid) vs PBT 2% + Sổ hồng 5% + BOQ Nội thất",
  },
  CHECKLIST: {
    title: "Danh Mục Nghiệm Thu Bàn Giao Phú Đông",
    subtitle: "Đối chiếu chuẩn 8 khu vực 01–08 từ Lecmax, Changyih đến trọn bộ Hafele",
  },
};

export function InteriorTopBar({ onOpenBackupModal }: InteriorTopBarProps) {
  const { interiorTab, isPrivacyMode, togglePrivacyMode, themeMode, toggleThemeMode } = useFinance();
  const meta = TAB_TITLES[interiorTab] || TAB_TITLES.STUDIO;

  return (
    <header className="sticky top-0 z-30 h-20 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-800 px-6 lg:px-8 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
          {meta.title}
        </h1>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
          {meta.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={togglePrivacyMode}
          title={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền"}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={(e) => toggleThemeMode(e)}
          title="Đổi giao diện Sáng / Tối"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {themeMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenBackupModal}
          title="Sao lưu & Đồng bộ"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Database className="w-4 h-4" />
        </button>

        <AppSwitcherWaffle />
      </div>
    </header>
  );
}
