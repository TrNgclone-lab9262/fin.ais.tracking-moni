"use client";

import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Sun,
  Moon,
  RefreshCw,
  Download,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AppSwitcherWaffle } from "@/components/common/AppSwitcherWaffle";
import { GoldRouteTab } from "@/types/finance";

interface GoldTopBarProps {
  onOpenBackupModal: () => void;
}

const TAB_TITLES: Record<GoldRouteTab, { title: string; subtitle: string }> = {
  OVERVIEW: {
    title: "Kho Tích Sản Vàng & Phòng Vệ Tài Sản",
    subtitle: "Định giá thanh khoản thực nhận theo giá Bid · Ưu tiên Nhẫn trơn 9999",
  },
  LOTS: {
    title: "Sổ Lô Vàng & Kế Toán Giá Vốn",
    subtitle: "Theo dõi từng hóa đơn mua, giá vốn bình quân (WAC) và lịch sử bán FIFO / chỉ định lô",
  },
  PRICES: {
    title: "Bảng Giá Mua–Bán & Chênh Lệch Nội–Ngoại",
    subtitle: "Nhập nhanh thủ công hoặc cập nhật giá tham khảo từ máy chủ · So sánh XAU/USD",
  },
  DCA: {
    title: "Kế Hoạch Tích Lũy Vàng Đều Đặn (DCA)",
    subtitle: "Định lượng tiến độ dự phòng cho cột mốc nhận nhà Q3/2027 & tất toán 08/2028",
  },
  SIMULATOR: {
    title: "Mô Phỏng Bán Vàng Thanh Khoản Q3/2027",
    subtitle: "So sánh chiến lược bán lỗ spread ít nhất, tối ưu lãi thực và lượng vàng giữ lại",
  },
};

export function GoldTopBar({ onOpenBackupModal }: GoldTopBarProps) {
  const {
    goldTab,
    isPrivacyMode,
    togglePrivacyMode,
    themeMode,
    toggleThemeMode,
    fetchReferenceGoldPrices,
  } = useFinance();

  const [isRefreshingPrice, setIsRefreshingPrice] = useState(false);
  const [priceFeedback, setPriceFeedback] = useState<string | null>(null);

  const meta = TAB_TITLES[goldTab];

  const handleRefreshPrices = async () => {
    setIsRefreshingPrice(true);
    setPriceFeedback(null);
    const res = await fetchReferenceGoldPrices(true);
    setIsRefreshingPrice(false);
    if (res.ok) {
      setPriceFeedback(
        res.mode === "LIVE_FEED"
          ? "Đã cập nhật theo XAU/USD"
          : "Đã nạp giá tham khảo VN"
      );
      window.setTimeout(() => setPriceFeedback(null), 4000);
    } else {
      setPriceFeedback(res.error || "Chưa lấy được giá");
      window.setTimeout(() => setPriceFeedback(null), 4000);
    }
  };

  return (
    <header className="sticky top-0 z-20 h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-[#DCE4EE] dark:border-slate-800 px-6 lg:px-8 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <AppSwitcherWaffle />
        <div className="min-w-0">
          <h1 className="text-base lg:text-lg font-black text-[#0F172A] dark:text-slate-100 truncate">
            {meta.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {meta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {priceFeedback && (
          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 hidden xl:inline">
            {priceFeedback}
          </span>
        )}

        <button
          type="button"
          onClick={handleRefreshPrices}
          disabled={isRefreshingPrice}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPrice ? "animate-spin" : ""}`} />
          <span>Lấy giá tham khảo</span>
        </button>

        <button
          type="button"
          onClick={togglePrivacyMode}
          aria-label={isPrivacyMode ? "Hiện số tiền" : "Ẩn số tiền (Riêng tư)"}
          title={isPrivacyMode ? "Đang ẩn số dư" : "Ẩn số dư riêng tư"}
          className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
        >
          {isPrivacyMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>

        <button
          type="button"
          onClick={onOpenBackupModal}
          aria-label="Sao lưu dữ liệu"
          title="Sao lưu & Đồng bộ JSON"
          className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={(e) => toggleThemeMode(e)}
          aria-label={themeMode === "dark" ? "Chuyển Light Mode" : "Chuyển Dark Mode"}
          className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-amber-300 transition-colors cursor-pointer"
        >
          {themeMode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
}
