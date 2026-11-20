"use client";

import React from "react";
import { Box, ClipboardList, ShieldCheck, CheckSquare } from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { InteriorRouteTab } from "@/types/finance";

export function InteriorBottomNavBar() {
  const { interiorTab, setInteriorTab } = useFinance();

  const items: {
    id: InteriorRouteTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "STUDIO", label: "3D Studio", icon: Box },
    { id: "BOQ", label: "Dự toán", icon: ClipboardList },
    { id: "READINESS", label: "Nhận nhà", icon: ShieldCheck },
    { id: "CHECKLIST", label: "Nghiệm thu", icon: CheckSquare },
  ];

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 pb-safe">
      <div className="grid grid-cols-4 h-16">
        {items.map((item) => {
          const Icon = item.icon;
          const active = interiorTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setInteriorTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                active
                  ? "text-teal-600 dark:text-teal-400 font-extrabold"
                  : "text-slate-500 dark:text-slate-400 font-semibold"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
