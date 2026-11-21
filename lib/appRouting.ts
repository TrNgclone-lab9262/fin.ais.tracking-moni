import {
  FinanceTab,
  GoldRouteTab,
  InteriorRouteTab,
  SkyOneRouteTab,
  SubAppId,
} from "@/types/finance";

export const ACTIVE_APP_STORAGE_KEY = "HOME_MONI_ACTIVE_APP";
export const SUB_APP_LAST_TABS_STORAGE_KEY = "HOME_MONI_SUB_APP_LAST_TABS";

export interface SavedSubAppTabs {
  FINANCE?: FinanceTab;
  SKYONE?: SkyOneRouteTab;
  GOLD?: GoldRouteTab;
  INTERIOR?: InteriorRouteTab;
}

export interface ParsedAppRoute {
  app: SubAppId;
  financeTab: FinanceTab;
  skyoneTab: SkyOneRouteTab;
  goldTab: GoldRouteTab;
  interiorTab: InteriorRouteTab;
  highlightPeriod: number | null;
  goldTargetAmount: number | null;
  interiorScenarioId: string | null;
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
  ADVISOR: "advisor",
  SCHEDULE: "schedule",
  PREPAYMENT: "prepayment",
  CONTRACT: "contract",
  DATA_ADMIN: "data-admin",
  SETTINGS: "settings",
};

const SEGMENT_TO_SKYONE_TAB: Record<string, SkyOneRouteTab> = {
  overview: "OVERVIEW",
  advisor: "ADVISOR",
  cashflow: "SCHEDULE",
  schedule: "SCHEDULE",
  prepayment: "PREPAYMENT",
  contract: "CONTRACT",
  "data-admin": "DATA_ADMIN",
  data_admin: "DATA_ADMIN",
  settings: "SETTINGS",
};

const GOLD_TAB_TO_SEGMENT: Record<GoldRouteTab, string> = {
  OVERVIEW: "overview",
  LOTS: "lots",
  PRICES: "prices",
  DCA: "dca",
  SIMULATOR: "simulator",
};

const SEGMENT_TO_GOLD_TAB: Record<string, GoldRouteTab> = {
  overview: "OVERVIEW",
  lots: "LOTS",
  prices: "PRICES",
  dca: "DCA",
  simulator: "SIMULATOR",
};

const INTERIOR_TAB_TO_SEGMENT: Record<InteriorRouteTab, string> = {
  STUDIO: "studio",
  BOQ: "boq",
  READINESS: "readiness",
  CHECKLIST: "checklist",
};

const SEGMENT_TO_INTERIOR_TAB: Record<string, InteriorRouteTab> = {
  studio: "STUDIO",
  "3d": "STUDIO",
  boq: "BOQ",
  readiness: "READINESS",
  checklist: "CHECKLIST",
};

export function getSavedActiveApp(): SubAppId {
  if (typeof window === "undefined") return "LAUNCHER";
  try {
    const raw = window.localStorage.getItem(ACTIVE_APP_STORAGE_KEY);
    if (raw === "SKYONE") return "SKYONE";
    if (raw === "FINANCE") return "FINANCE";
    if (raw === "GOLD") return "GOLD";
    if (raw === "INTERIOR") return "INTERIOR";
    return "LAUNCHER";
  } catch {
    return "LAUNCHER";
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

export function getSavedSubAppTabs(): SavedSubAppTabs {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SUB_APP_LAST_TABS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<SavedSubAppTabs>;
    return {
      FINANCE:
        parsed.FINANCE && parsed.FINANCE in FINANCE_TAB_TO_SEGMENT ? parsed.FINANCE : undefined,
      SKYONE:
        parsed.SKYONE && parsed.SKYONE in SKYONE_TAB_TO_SEGMENT ? parsed.SKYONE : undefined,
      GOLD: parsed.GOLD && parsed.GOLD in GOLD_TAB_TO_SEGMENT ? parsed.GOLD : undefined,
      INTERIOR:
        parsed.INTERIOR && parsed.INTERIOR in INTERIOR_TAB_TO_SEGMENT ? parsed.INTERIOR : undefined,
    };
  } catch {
    return {};
  }
}

export function saveSubAppTab<K extends keyof SavedSubAppTabs>(
  app: K,
  tab: NonNullable<SavedSubAppTabs[K]>
): void {
  if (typeof window === "undefined") return;
  try {
    const prev = getSavedSubAppTabs();
    const next: SavedSubAppTabs = { ...prev, [app]: tab };
    window.localStorage.setItem(SUB_APP_LAST_TABS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function parseAppRoute(pathname: string, search = ""): ParsedAppRoute {
  const cleanPath = (pathname || "/").replace(/\/+$/, "") || "/";
  const parts = cleanPath.split("/").filter(Boolean).map((s) => s.toLowerCase());

  let highlightPeriod: number | null = null;
  let goldTargetAmount: number | null = null;
  let interiorScenarioId: string | null = null;

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
      const rawTarget = params.get("target");
      if (rawTarget) {
        const parsedTarget = Number(rawTarget.replace(/[^0-9.]/g, ""));
        if (Number.isFinite(parsedTarget) && parsedTarget > 0) {
          goldTargetAmount = Math.round(parsedTarget);
        }
      }
      const rawScenario = params.get("scenario")?.trim();
      if (rawScenario && rawScenario.length <= 80) {
        interiorScenarioId = rawScenario;
      }
    } catch {
      // ignore invalid query
    }
  }

  if (parts[0] === "login") {
    return {
      app: "LAUNCHER",
      financeTab: "overview",
      skyoneTab: "OVERVIEW",
      goldTab: "OVERVIEW",
      interiorTab: "STUDIO",
      highlightPeriod: null,
      goldTargetAmount: null,
      interiorScenarioId: null,
      isLoginRoute: true,
    };
  }

  if (parts[0] === "launcher") {
    return {
      app: "LAUNCHER",
      financeTab: "overview",
      skyoneTab: "OVERVIEW",
      goldTab: "OVERVIEW",
      interiorTab: "STUDIO",
      highlightPeriod: null,
      goldTargetAmount: null,
      interiorScenarioId: null,
      isLoginRoute: false,
    };
  }

  if (parts[0] === "skyone") {
    const seg = parts[1] || "overview";
    const skyoneTab = SEGMENT_TO_SKYONE_TAB[seg] || "OVERVIEW";
    return {
      app: "SKYONE",
      financeTab: "overview",
      skyoneTab,
      goldTab: "OVERVIEW",
      interiorTab: "STUDIO",
      highlightPeriod,
      goldTargetAmount: null,
      interiorScenarioId: null,
      isLoginRoute: false,
    };
  }

  if (parts[0] === "gold") {
    const seg = parts[1] || "overview";
    const goldTab = SEGMENT_TO_GOLD_TAB[seg] || "OVERVIEW";
    return {
      app: "GOLD",
      financeTab: "overview",
      skyoneTab: "OVERVIEW",
      goldTab,
      interiorTab: "STUDIO",
      highlightPeriod: null,
      goldTargetAmount,
      interiorScenarioId: null,
      isLoginRoute: false,
    };
  }

  if (parts[0] === "interior") {
    const seg = parts[1] || "studio";
    const interiorTab = SEGMENT_TO_INTERIOR_TAB[seg] || "STUDIO";
    return {
      app: "INTERIOR",
      financeTab: "overview",
      skyoneTab: "OVERVIEW",
      goldTab: "OVERVIEW",
      interiorTab,
      highlightPeriod: null,
      goldTargetAmount: null,
      interiorScenarioId,
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
      goldTab: "OVERVIEW",
      interiorTab: "STUDIO",
      highlightPeriod: null,
      goldTargetAmount: null,
      interiorScenarioId: null,
      isLoginRoute: false,
    };
  }

  // Root "/" hoặc đường dẫn chưa phân định -> mở App Launcher tập trung
  return {
    app: "LAUNCHER",
    financeTab: "overview",
    skyoneTab: "OVERVIEW",
    goldTab: "OVERVIEW",
    interiorTab: "STUDIO",
    highlightPeriod: null,
    goldTargetAmount: null,
    interiorScenarioId: null,
    isLoginRoute: false,
  };
}

export function buildAppPath(
  app: SubAppId,
  financeTab: FinanceTab,
  skyoneTab: SkyOneRouteTab,
  highlightPeriod?: number | null,
  goldTab: GoldRouteTab = "OVERVIEW",
  interiorTab: InteriorRouteTab = "STUDIO",
  extraQuery?: {
    goldTargetAmount?: number | null;
    interiorScenarioId?: string | null;
  }
): string {
  if (app === "LAUNCHER") {
    return "/launcher";
  }

  if (app === "SKYONE") {
    const seg = SKYONE_TAB_TO_SEGMENT[skyoneTab] || "overview";
    const base = `/skyone/${seg}`;
    if (skyoneTab === "SCHEDULE" && highlightPeriod && highlightPeriod > 0) {
      return `${base}?period=${highlightPeriod}`;
    }
    return base;
  }

  if (app === "GOLD") {
    const seg = GOLD_TAB_TO_SEGMENT[goldTab] || "overview";
    const base = `/gold/${seg}`;
    if (
      goldTab === "SIMULATOR" &&
      extraQuery?.goldTargetAmount &&
      extraQuery.goldTargetAmount > 0
    ) {
      return `${base}?target=${Math.round(extraQuery.goldTargetAmount)}`;
    }
    return base;
  }

  if (app === "INTERIOR") {
    const seg = INTERIOR_TAB_TO_SEGMENT[interiorTab] || "studio";
    const base = `/interior/${seg}`;
    if (extraQuery?.interiorScenarioId) {
      return `${base}?scenario=${encodeURIComponent(extraQuery.interiorScenarioId)}`;
    }
    return base;
  }

  const seg = FINANCE_TAB_TO_SEGMENT[financeTab] || "overview";
  return `/finance/${seg}`;
}

export function getAppDocumentTitle(
  app: SubAppId,
  financeTab: FinanceTab,
  skyoneTab: SkyOneRouteTab,
  goldTab: GoldRouteTab = "OVERVIEW",
  interiorTab: InteriorRouteTab = "STUDIO"
): string {
  if (app === "LAUNCHER") {
    return "App Launcher · HOME MONI";
  }

  if (app === "SKYONE") {
    const map: Record<SkyOneRouteTab, string> = {
      OVERVIEW: "Tổng quan & Stress-Test · Phú Đông SKYONE",
      ADVISOR: "Cố vấn Chiến lược · Phú Đông SKYONE",
      SCHEDULE: "Lịch trả nợ & Dòng tiền · Phú Đông SKYONE",
      PREPAYMENT: "Trả gốc trước hạn · Phú Đông SKYONE",
      CONTRACT: "Hợp đồng & Lãi suất · Phú Đông SKYONE",
      DATA_ADMIN: "Quản trị Dữ liệu · Phú Đông SKYONE",
      SETTINGS: "Cài đặt hệ thống · Phú Đông SKYONE",
    };
    return map[skyoneTab];
  }

  if (app === "GOLD") {
    const map: Record<GoldRouteTab, string> = {
      OVERVIEW: "Kho Tích Sản Vàng · HOME MONI",
      LOTS: "Sổ Lô Vàng & Giá Vốn · HOME MONI GOLD",
      PRICES: "Bảng Giá & Chênh Lệch Nội–Ngoại · HOME MONI GOLD",
      DCA: "Kế Hoạch Tích Lũy DCA · HOME MONI GOLD",
      SIMULATOR: "Mô Phỏng Bán Vàng Q3/2027 · HOME MONI GOLD",
    };
    return map[goldTab];
  }

  if (app === "INTERIOR") {
    const map: Record<InteriorRouteTab, string> = {
      STUDIO: "Phối Cảnh 3D A.12A.07 · SKYONE Interior",
      BOQ: "Dự Toán Nội Thất BOQ · SKYONE Interior",
      READINESS: "Độ Sẵn Sàng Bàn Giao Q3/2027 · SKYONE Interior",
      CHECKLIST: "Checklist Nghiệm Thu A.12A.07 · SKYONE Interior",
    };
    return map[interiorTab];
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
