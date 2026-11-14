import { FinanceTab, SkyOneRouteTab, SubAppId } from "@/types/finance";

export const ACTIVE_APP_STORAGE_KEY = "HOME_MONI_ACTIVE_APP";

export interface ParsedAppRoute {
  app: SubAppId;
  financeTab: FinanceTab;
  skyoneTab: SkyOneRouteTab;
  highlightPeriod: number | null;
  isLoginRoute: boolean;
}

const FINANCE_TAB_TO_SEGMENT: Record<FinanceTab, string> = {
  overview: "overview",
  transactions: "transactions",
  accounts: "accounts",
  planning: "planning",
  debts_invest: "debts-invest",
  data_admin: "data-admin",
  guide: "guide",
  settings: "settings",
};

const SEGMENT_TO_FINANCE_TAB: Record<string, FinanceTab> = {
  overview: "overview",
  transactions: "transactions",
  accounts: "accounts",
  planning: "planning",
  "debts-invest": "debts_invest",
  debts_invest: "debts_invest",
  "data-admin": "data_admin",
  data_admin: "data_admin",
  guide: "guide",
  settings: "settings",
};

const SKYONE_TAB_TO_SEGMENT: Record<SkyOneRouteTab, string> = {
  OVERVIEW: "overview",
  CASHFLOW: "cashflow",
  SCHEDULE: "schedule",
  PREPAYMENT: "prepayment",
  CONTRACT: "contract",
  DATA_ADMIN: "data-admin",
  SETTINGS: "settings",
};

const SEGMENT_TO_SKYONE_TAB: Record<string, SkyOneRouteTab> = {
  overview: "OVERVIEW",
  cashflow: "CASHFLOW",
  schedule: "SCHEDULE",
  prepayment: "PREPAYMENT",
  contract: "CONTRACT",
  "data-admin": "DATA_ADMIN",
  data_admin: "DATA_ADMIN",
  settings: "SETTINGS",
};

export function getSavedActiveApp(): SubAppId {
  if (typeof window === "undefined") return "FINANCE";
  try {
    const raw = window.localStorage.getItem(ACTIVE_APP_STORAGE_KEY);
    return raw === "SKYONE" ? "SKYONE" : "FINANCE";
  } catch {
    return "FINANCE";
  }
}

export function saveActiveApp(app: SubAppId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACTIVE_APP_STORAGE_KEY, app);
  } catch {
    // ignore
  }
}

export function parseAppRoute(pathname: string, search = ""): ParsedAppRoute {
  const cleanPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const parts = cleanPath.split("/").filter(Boolean).map((s) => s.toLowerCase());

  let highlightPeriod: number | null = null;
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const rawPeriod = params.get("period");
      if (rawPeriod) {
        const parsed = parseInt(rawPeriod, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          highlightPeriod = parsed;
        }
      }
    } catch {
      // ignore invalid query
    }
  }

  if (parts[0] === "login") {
    return {
      app: getSavedActiveApp(),
      financeTab: "overview",
      skyoneTab: "OVERVIEW",
      highlightPeriod: null,
      isLoginRoute: true,
    };
  }

  if (parts[0] === "skyone") {
    const seg = parts[1] || "overview";
    const skyoneTab = SEGMENT_TO_SKYONE_TAB[seg] || "OVERVIEW";
    return {
      app: "SKYONE",
      financeTab: "overview",
      skyoneTab,
      highlightPeriod,
      isLoginRoute: false,
    };
  }

  if (parts[0] === "finance") {
    const seg = parts[1] || "overview";
    const financeTab = SEGMENT_TO_FINANCE_TAB[seg] || "overview";
    return {
      app: "FINANCE",
      financeTab,
      skyoneTab: "OVERVIEW",
      highlightPeriod: null,
      isLoginRoute: false,
    };
  }

  // Root "/" hoặc đường dẫn cũ -> khôi phục sub-webapp đã dùng gần nhất hoặc mặc định FINANCE
  const savedApp = parts.length === 0 ? getSavedActiveApp() : "FINANCE";
  return {
    app: savedApp,
    financeTab: "overview",
    skyoneTab: "OVERVIEW",
    highlightPeriod: null,
    isLoginRoute: false,
  };
}

export function buildAppPath(
  app: SubAppId,
  financeTab: FinanceTab,
  skyoneTab: SkyOneRouteTab,
  highlightPeriod?: number | null
): string {
  if (app === "SKYONE") {
    const seg = SKYONE_TAB_TO_SEGMENT[skyoneTab] || "overview";
    const base = `/skyone/${seg}`;
    if (skyoneTab === "SCHEDULE" && highlightPeriod && highlightPeriod > 0) {
      return `${base}?period=${highlightPeriod}`;
    }
    return base;
  }

  const seg = FINANCE_TAB_TO_SEGMENT[financeTab] || "overview";
  return `/finance/${seg}`;
}

export function getAppDocumentTitle(
  app: SubAppId,
  financeTab: FinanceTab,
  skyoneTab: SkyOneRouteTab
): string {
  if (app === "SKYONE") {
    const map: Record<SkyOneRouteTab, string> = {
      OVERVIEW: "Tổng quan & Stress-Test · Phú Đông SKYONE",
      CASHFLOW: "Chi tiết Dòng tiền · Phú Đông SKYONE",
      SCHEDULE: "Lịch trả nợ · Phú Đông SKYONE",
      PREPAYMENT: "Trả gốc trước hạn · Phú Đông SKYONE",
      CONTRACT: "Hợp đồng & Lãi suất · Phú Đông SKYONE",
      DATA_ADMIN: "Quản trị Dữ liệu · Phú Đông SKYONE",
      SETTINGS: "Cài đặt hệ thống · Phú Đông SKYONE",
    };
    return map[skyoneTab];
  }

  const map: Record<FinanceTab, string> = {
    overview: "Tổng quan tổ ấm · HOME MONI",
    transactions: "Sổ giao dịch · HOME MONI",
    accounts: "Tài khoản & Thẻ · HOME MONI",
    planning: "Ngân sách & Mục tiêu · HOME MONI",
    debts_invest: "Khoản nợ & Đầu tư · HOME MONI",
    data_admin: "Quản trị Dữ liệu · HOME MONI",
    guide: "Cẩm nang tổ ấm · HOME MONI",
    settings: "Cài đặt & Tùy biến · HOME MONI",
  };
  return map[financeTab];
}
