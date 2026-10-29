"use client";

import React from "react";
import { Home, ArrowLeftRight, CreditCard, Target, Plus } from "lucide-react";
import { useFinance, NavTab } from "@/context/FinanceContext";

interface BottomNavBarProps {
  onOpenAddModal: () => void;
}

export function BottomNavBar({ onOpenAddModal }: BottomNavBarProps) {
  const { activeTab, setActiveTab } = useFinance();

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Tổng quan", icon: Home },
    { id: "transactions", label: "Sổ GD", icon: ArrowLeftRight },
  ];

  const rightNavItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "accounts", label: "Ví & Thẻ", icon: CreditCard },
    { id: "planning", label: "Tích lũy", icon: Target },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-[#DCE4EE] px-3 py-2 flex items-center justify-between shadow-lg">
      {/* 2 tabs bên trái */}
      <div className="flex items-center justify-around flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all min-h-[44px] min-w-[56px] justify-center ${
                isActive ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div
                className={`p-1 rounded-md transition-colors ${
                  isActive ? "bg-blue-50 text-blue-600" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Nút FAB trung tâm: Nhập nhanh 3 giây */}
      <div className="relative -top-4 px-2">
        <button
          onClick={onOpenAddModal}
          aria-label="Thêm giao dịch nhanh 3 giây"
          className="w-13 h-13 rounded-full bg-blue-600 hover:bg-blue-700 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-blue-500/35 border-4 border-[#F6F8FB] transition-all cursor-pointer"
        >
          <Plus className="w-6 h-6 stroke-[2.5]" />
        </button>
      </div>

      {/* 2 tabs bên phải */}
      <div className="flex items-center justify-around flex-1">
        {rightNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all min-h-[44px] min-w-[56px] justify-center ${
                isActive ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div
                className={`p-1 rounded-md transition-colors ${
                  isActive ? "bg-blue-50 text-blue-600" : ""
                }`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
