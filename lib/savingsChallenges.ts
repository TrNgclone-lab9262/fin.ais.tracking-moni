import { FamilyMember, SavingsChallenge, Transaction } from "@/types/finance";

export type ChallengePerspective = "ALL" | "HUSBAND" | "WIFE";

export interface EvaluatedSavingsChallenge {
  challenge: SavingsChallenge;
  autoSurplusAmount: number;
  manualSavedAmount: number;
  savedAmount: number;
  targetAmount: number;
  remainingAmount: number;
  progressPct: number; // Clamped 0..100 for ring & bar stroke
  rawPct: number; // Uncapped integer/decimal %
  isCompleted: boolean;
}

export interface SavingsChallengeSummary {
  monthKey: string;
  monthSurplusAll: number;
  monthSurplusHusband: number;
  monthSurplusWife: number;
  activeSurplus: number;
  items: EvaluatedSavingsChallenge[];
  ringItems: EvaluatedSavingsChallenge[]; // Up to 5 rings for Concentric Circles SVG
  overflowCount: number;
  totalTarget: number;
  totalSaved: number;
  overallPct: number;
  completedCount: number;
}

export const CHALLENGE_RING_COLORS = [
  { label: "Xanh dương", hex: "#2563EB" },
  { label: "Ngọc lục bảo", hex: "#10B981" },
  { label: "Hổ phách", hex: "#F59E0B" },
  { label: "Tím Indigo", hex: "#6366F1" },
  { label: "Hồng Rose", hex: "#F43F5E" },
  { label: "Ngọc Cyan", hex: "#06B6D4" },
];

export interface SavingsChallengeTemplate {
  id: string;
  name: string;
  targetAmount: number;
  trackingMode: "AUTO_SURPLUS" | "MANUAL";
  color: string;
  description: string;
}

export const SAVINGS_CHALLENGE_TEMPLATES: SavingsChallengeTemplate[] = [
  {
    id: "tpl_no_boba",
    name: "Cắt giảm trà sữa & cà phê ngoài",
    targetAmount: 1000000,
    trackingMode: "MANUAL",
    color: "#2563EB",
    description: "Nạp nhanh mỗi lần tự pha tại nhà (+50k/+100k)",
  },
  {
    id: "tpl_cook_lunch",
    name: "Tự nấu cơm trưa văn phòng",
    targetAmount: 1500000,
    trackingMode: "MANUAL",
    color: "#F59E0B",
    description: "Tích lũy 50k–100k mỗi ngày mang cơm đi làm",
  },
  {
    id: "tpl_surplus_goal",
    name: "Giữ thặng dư thu chi trong tháng",
    targetAmount: 15000000,
    trackingMode: "AUTO_SURPLUS",
    color: "#10B981",
    description: "Tự động cập nhật theo chênh lệch Thu - Chi tháng",
  },
  {
    id: "tpl_no_impulse",
    name: "21 ngày không mua sắm ngẫu hứng",
    targetAmount: 2000000,
    trackingMode: "MANUAL",
    color: "#6366F1",
    description: "Bỏ qua đơn hàng không cần thiết và nạp thẳng vào quỹ",
  },
];

export function calculateMonthlySurplusForMember(
  transactions: Transaction[],
  monthKey: string,
  member: ChallengePerspective
): number {
  let income = 0;
  let expense = 0;

  for (const tx of transactions) {
    if (!tx.date.startsWith(monthKey)) continue;
    if (member !== "ALL" && tx.memberId !== member) continue;

    if (tx.type === "INCOME") income += tx.amount;
    else if (tx.type === "EXPENSE") expense += tx.amount;
  }

  return Math.max(0, income - expense);
}

function challengeMatchesPerspective(
  challengeMember: FamilyMember | undefined,
  perspective: ChallengePerspective
): boolean {
  if (perspective === "ALL") return true;
  if (!challengeMember || challengeMember === "SHARED") return true;
  return challengeMember === perspective;
}

export function evaluateSavingsChallenges(params: {
  challenges: SavingsChallenge[];
  monthKey: string;
  transactions: Transaction[];
  perspective: ChallengePerspective;
}): SavingsChallengeSummary {
  const { challenges, monthKey, transactions, perspective } = params;

  const monthSurplusAll = calculateMonthlySurplusForMember(transactions, monthKey, "ALL");
  const monthSurplusHusband = calculateMonthlySurplusForMember(transactions, monthKey, "HUSBAND");
  const monthSurplusWife = calculateMonthlySurplusForMember(transactions, monthKey, "WIFE");

  const activeSurplus =
    perspective === "HUSBAND"
      ? monthSurplusHusband
      : perspective === "WIFE"
      ? monthSurplusWife
      : monthSurplusAll;

  const filtered = challenges
    .filter(
      (c) =>
        c.month === monthKey &&
        challengeMatchesPerspective(c.memberId, perspective)
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const items: EvaluatedSavingsChallenge[] = filtered.map((c) => {
    let autoSurplusAmount = 0;
    if (c.trackingMode === "AUTO_SURPLUS") {
      if (perspective !== "ALL") {
        autoSurplusAmount = activeSurplus;
      } else if (c.memberId === "HUSBAND") {
        autoSurplusAmount = monthSurplusHusband;
      } else if (c.memberId === "WIFE") {
        autoSurplusAmount = monthSurplusWife;
      } else {
        autoSurplusAmount = monthSurplusAll;
      }
    }

    const manualSavedAmount = Math.max(0, c.manualSavedAmount || 0);
    const savedAmount = autoSurplusAmount + manualSavedAmount;
    const targetAmount = Math.max(1, c.targetAmount);
    const rawPct = Math.round((savedAmount / targetAmount) * 1000) / 10;
    const progressPct = Math.min(100, Math.max(0, rawPct));
    const remainingAmount = Math.max(0, targetAmount - savedAmount);

    return {
      challenge: c,
      autoSurplusAmount,
      manualSavedAmount,
      savedAmount,
      targetAmount,
      remainingAmount,
      progressPct,
      rawPct,
      isCompleted: savedAmount >= targetAmount,
    };
  });

  const maxRings = 5;
  const ringItems = items.slice(0, maxRings);
  const overflowCount = Math.max(0, items.length - maxRings);

  const totalTarget = items.reduce((s, item) => s + item.targetAmount, 0);
  const totalSaved = items.reduce((s, item) => s + Math.min(item.savedAmount, item.targetAmount), 0);
  const overallPct =
    totalTarget > 0 ? Math.min(100, Math.round((totalSaved / totalTarget) * 1000) / 10) : 0;
  const completedCount = items.filter((item) => item.isCompleted).length;

  return {
    monthKey,
    monthSurplusAll,
    monthSurplusHusband,
    monthSurplusWife,
    activeSurplus,
    items,
    ringItems,
    overflowCount,
    totalTarget,
    totalSaved,
    overallPct,
    completedCount,
  };
}
