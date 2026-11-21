import { GoldCategory, GoldSalePurpose } from "@/types/finance";

export const GOLD_CATEGORIES: GoldCategory[] = [
  "NHAN_9999",
  "SJC_BAR",
  "GOLD_24K_JEWELRY",
  "GOLD_18K",
  "DIGITAL_GOLD",
];

export const BRAND_SUGGESTIONS: Record<GoldCategory, string[]> = {
  NHAN_9999: ["PNJ 9999", "SJC 9999", "BTMC Rồng Thăng Long", "DOJI Hưng Thịnh Vượng"],
  SJC_BAR: ["SJC Miếng 1 lượng", "SJC Miếng 5 chỉ", "SJC Miếng 2 chỉ"],
  GOLD_24K_JEWELRY: ["PNJ 24K", "SJC 24K", "Mi Hồng 999"],
  GOLD_18K: ["PNJ 18K (750)", "DOJI 18K"],
  DIGITAL_GOLD: ["DOJI eGold", "Tích lũy PNJ"],
};

export const PURITY_SUGGESTIONS: Record<GoldCategory, string> = {
  NHAN_9999: "999.9 (24K)",
  SJC_BAR: "999.9 (24K)",
  GOLD_24K_JEWELRY: "999.0 (24K)",
  GOLD_18K: "750 (18K)",
  DIGITAL_GOLD: "999.9 (eGold)",
};

export const SALE_PURPOSE_LABELS: Record<GoldSalePurpose, string> = {
  INTERIOR_HANDOVER: "Hoàn thiện Nội thất Q3/2027",
  SKYONE_PREPAY: "Tất toán gốc SKYONE 08/2028",
  REBALANCE: "Chốt lời / Tái cơ cấu danh mục",
  OTHER: "Nhu cầu gia đình khác",
};
