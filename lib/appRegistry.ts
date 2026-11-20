import { MortgageContract, SubAppId } from "@/types/finance";
import { generateMortgageSchedule } from "@/lib/mortgageEngine";
import { formatDateVN } from "@/lib/formatters";

export type EcosystemAppId = Exclude<SubAppId, "LAUNCHER">;

export interface EcosystemAppDefinition {
  id: EcosystemAppId;
  title: string;
  waffleSubtitle: string;
  launcherDescription: string;
  ctaLabel: string;
  accentTone: "blue" | "indigo" | "amber" | "teal";
  testIdKey: "finance" | "skyone" | "gold" | "interior";
}

export interface UrgentSkyOneAlert {
  kind: "danger" | "warning";
  compactLabel: string;
  detailLabel: string;
}

/**
 * Danh mục khai báo tập trung cho hệ sinh thái ứng dụng.
 * Khi mở rộng thêm phân hệ mới (Đầu tư, Thuế, Bảo hiểm...), chỉ cần thêm
 * một mục mới vào đây để cả AppLauncherView và AppSwitcherWaffle tự động cập nhật.
 */
export const APP_ECOSYSTEM_REGISTRY: readonly EcosystemAppDefinition[] = [
  {
    id: "FINANCE",
    title: "Thu Chi Tổ Ấm",
    waffleSubtitle: "Sổ giao dịch, thẻ & ngân sách",
    launcherDescription: "Sổ giao dịch, thẻ tín dụng và ngân sách gia đình",
    ctaLabel: "Mở Thu Chi",
    accentTone: "blue",
    testIdKey: "finance",
  },
  {
    id: "SKYONE",
    title: "Phú Đông SKYONE",
    waffleSubtitle: "Khoản vay BIDV & Cố vấn 08/2028",
    launcherDescription: "Khoản vay căn hộ BIDV, sao kê và cố vấn 08/2028",
    ctaLabel: "Mở SKYONE",
    accentTone: "indigo",
    testIdKey: "skyone",
  },
  {
    id: "GOLD",
    title: "Kho Tích Sản Vàng",
    waffleSubtitle: "Nhẫn 9999, SJC & Thanh khoản Q3/2027",
    launcherDescription: "Định giá Bid thực thu, giá vốn WAC/FIFO & mô phỏng bán vàng",
    ctaLabel: "Mở Kho Vàng",
    accentTone: "amber",
    testIdKey: "gold",
  },
  {
    id: "INTERIOR",
    title: "SKYONE 3D Interior",
    waffleSubtitle: "Phối cảnh 3D A.12A.07 & Dự toán BOQ",
    launcherDescription: "Thiết kế 3D Three.js căn hộ A.12A.07 (51m²) & dự toán trọn gói",
    ctaLabel: "Mở 3D Studio",
    accentTone: "teal",
    testIdKey: "interior",
  },
] as const;

export function getUrgentSkyOneAlert(
  contract: MortgageContract,
  referenceDate?: string
): UrgentSkyOneAlert | null {
  const schedule = generateMortgageSchedule(contract, referenceDate);

  if (schedule.overdueCount > 0) {
    return {
      kind: "danger",
      compactLabel: `Quá hạn ${schedule.overdueCount} kỳ`,
      detailLabel: `Có ${schedule.overdueCount} kỳ quá hạn cần đối soát`,
    };
  }

  const nextDue = schedule.nextUnpaidInstallment;
  if (nextDue && nextDue.status === "DUE_SOON") {
    return {
      kind: "warning",
      compactLabel:
        nextDue.daysUntilDue === 0
          ? `Hôm nay hạn kỳ #${nextDue.period}`
          : `Còn ${nextDue.daysUntilDue} ngày (${formatDateVN(nextDue.dueDate)})`,
      detailLabel:
        nextDue.daysUntilDue === 0
          ? `Hôm nay đến hạn đóng kỳ #${nextDue.period}`
          : `Còn ${nextDue.daysUntilDue} ngày đến hạn kỳ #${nextDue.period}`,
    };
  }

  return null;
}
