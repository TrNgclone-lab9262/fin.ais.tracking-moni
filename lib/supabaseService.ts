import { supabase, isSupabaseConfigured } from "./supabaseClient";
import {
  DbAccount,
  DbCategory,
  DbCategoryBudget,
  DbDebt,
  DbGoldPortfolio,
  DbHouseholdSettings,
  DbInteriorStudio,
  DbInvestment,
  DbRecurringRule,
  DbSavingsGoal,
  DbSkyOneLoan,
  DbTransaction,
  SharedHouseholdSettings,
  mapAccountToDb,
  mapBudgetToDb,
  mapCategoryToDb,
  mapDbToAccount,
  mapDbToBudget,
  mapDbToCategory,
  mapDbToDebt,
  mapDbToGoal,
  mapDbToGoldPortfolio,
  mapDbToInteriorStudio,
  mapDbToInvestment,
  mapDbToRecurringRule,
  mapDbToSharedSettings,
  mapDbToSkyOneLoan,
  mapDbToTransaction,
  mapDebtToDb,
  mapGoalToDb,
  mapGoldPortfolioToDb,
  mapInteriorStudioToDb,
  mapInvestmentToDb,
  mapRecurringRuleToDb,
  mapSharedSettingsToDb,
  mapSkyOneLoanToDb,
  mapTransactionToDb,
} from "./supabaseMappers";
import { CloudMutation } from "./offlineOutbox";
import {
  StoredAppStateV3,
  mergeGoldPortfolios,
  mergeInteriorStudios,
  mergeSkyOneContracts,
} from "./storage";
import {
  Account,
  AuthMemberId,
  Category,
  CategoryBudget,
  DebtItem,
  GoldPortfolioState,
  InteriorStudioState,
  InvestmentItem,
  MortgageContract,
  RecurringRule,
  SavingsGoal,
  Transaction,
} from "@/types/finance";
import {
  AccountSchema,
  BudgetSchema,
  CategorySchema,
  DebtItemSchema,
  InvestmentItemSchema,
  RecurringRuleSchema,
  SavingsGoalSchema,
  TransactionSchema,
} from "./validations";
import { reconcileBidvSkyOneContract } from "./mortgageEngine";

export interface CloudUser {
  id: string;
  email: string;
}

export interface CloudProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  memberSlot: AuthMemberId;
  householdId: string | null;
  role: "OWNER" | "PARTNER" | null;
  updatedAt: string;
}

export interface HouseholdMemberInfo {
  userId: string;
  role: "OWNER" | "PARTNER";
  memberSlot: AuthMemberId;
  displayName: string;
  joinedAt: string;
}

export interface HouseholdInfo {
  id: string;
  name: string;
  inviteCode: string;
  myRole: "OWNER" | "PARTNER";
  mySlot: AuthMemberId;
  members: HouseholdMemberInfo[];
}

export interface CloudFullData {
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  debts: DebtItem[];
  investments: InvestmentItem[];
  recurringRules: RecurringRule[];
  sharedSettings?: SharedHouseholdSettings;
  skyoneLoan?: MortgageContract;
  goldPortfolio?: GoldPortfolioState;
  interiorStudio?: InteriorStudioState;
}

interface DbHouseholdRow {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
}

interface DbHouseholdMemberRow {
  household_id: string;
  user_id: string;
  role: string;
  member_slot: string;
  display_name: string;
  joined_at: string;
}

interface DbProfileRow {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  member_slot: string;
  household_id: string | null;
  role: string | null;
  updated_at: string;
}

function validateArrayWithZod<T>(
  items: T[],
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }
): T[] {
  const valid: T[] = [];
  for (const item of items) {
    const res = schema.safeParse(item);
    if (res.success && res.data) {
      valid.push(res.data);
    }
  }
  return valid;
}

interface SupabaseErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
}

function isMissingRelationError(err: SupabaseErrorLike | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    Boolean(
      err.message &&
        /relation .* does not exist|could not find the table|not found in the schema cache/i.test(
          err.message
        )
    )
  );
}

function isMissingColumnError(err: SupabaseErrorLike | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === "42703" ||
    err.code === "PGRST204" ||
    Boolean(
      err.message &&
        /column .* does not exist|could not find the .* column/i.test(err.message)
    )
  );
}

function isAuthSessionError(err: SupabaseErrorLike | null | undefined): boolean {
  if (!err) return false;
  return (
    err.code === "PGRST301" ||
    err.code === "401" ||
    err.status === 401 ||
    Boolean(
      err.message &&
        /jwt expired|invalid jwt|token is expired|not authenticated/i.test(err.message)
    )
  );
}

function formatSupabaseErrorTag(table: string, err: SupabaseErrorLike): string {
  const code = err.code ? ` (${err.code})` : "";
  return `${table}${code}: ${err.message || "Lỗi truy vấn"}`;
}

export interface CloudTablePatch {
  table: string;
  categories?: Category[];
  accounts?: Account[];
  transactions?: Transaction[];
  budgets?: CategoryBudget[];
  goals?: SavingsGoal[];
  debts?: DebtItem[];
  investments?: InvestmentItem[];
  recurringRules?: RecurringRule[];
  sharedSettings?: SharedHouseholdSettings;
  skyoneLoan?: MortgageContract;
  goldPortfolio?: GoldPortfolioState;
  interiorStudio?: InteriorStudioState;
}

export interface MutationExecutionResult {
  ok: boolean;
  conflictResolved?: boolean;
  mergedSkyOneLoan?: MortgageContract;
  mergedGoldPortfolio?: GoldPortfolioState;
  mergedInteriorStudio?: InteriorStudioState;
}

// Theo dõi revision mới nhất đã đọc từ server cho 3 bảng JSONB theo hộ gia đình
const knownJsonbRevisions = new Map<string, number>();

function revKey(householdId: string, table: "skyone_loans" | "gold_portfolios" | "interior_studios", id: string): string {
  return `${householdId}:${table}:${id}`;
}

export const supabaseService = {
  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION
  // -------------------------------------------------------------------------
  async getCurrentSessionUser(): Promise<CloudUser | null> {
    if (!isSupabaseConfigured || !supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.user) return null;
    return {
      id: data.session.user.id,
      email: data.session.user.email || "",
    };
  },

  onAuthChange(callback: (user: CloudUser | null) => void): () => void {
    if (!isSupabaseConfigured || !supabase) return () => {};
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        callback({
          id: session.user.id,
          email: session.user.email || "",
        });
      } else {
        callback(null);
      }
    });
    return () => data.subscription.unsubscribe();
  },

  async signInWithPassword(
    email: string,
    password: string
  ): Promise<{ user?: CloudUser; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase chưa được cấu hình biến môi trường." };
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) {
      return { error: error?.message || "Đăng nhập thất bại." };
    }
    return {
      user: {
        id: data.user.id,
        email: data.user.email || email.trim(),
      },
    };
  },

  async signUpWithPassword(
    email: string,
    password: string,
    profileMeta?: { displayName?: string; memberSlot?: AuthMemberId }
  ): Promise<{
    user?: CloudUser;
    needsEmailConfirm?: boolean;
    alreadyRegistered?: boolean;
    error?: string;
  }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase chưa được cấu hình biến môi trường." };
    }
    const cleanEmail = email.trim();
    const displayName =
      profileMeta?.displayName?.trim() || cleanEmail.split("@")[0] || "Thành viên";
    const memberSlot: AuthMemberId =
      profileMeta?.memberSlot === "WIFE" ? "WIFE" : "HUSBAND";

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: {
          display_name: displayName,
          member_slot: memberSlot,
        },
      },
    });
    if (error) {
      return { error: error.message };
    }
    if (
      data.user &&
      !data.session &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      return {
        user: { id: data.user.id, email: data.user.email || cleanEmail },
        alreadyRegistered: true,
      };
    }
    if (data.user && !data.session) {
      return {
        user: { id: data.user.id, email: data.user.email || cleanEmail },
        needsEmailConfirm: true,
      };
    }
    if (data.user) {
      await supabase
        .from("profiles")
        .upsert(
          {
            id: data.user.id,
            email: data.user.email || cleanEmail,
            display_name: displayName,
            member_slot: memberSlot,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      return {
        user: { id: data.user.id, email: data.user.email || cleanEmail },
      };
    }
    return { error: "Không thể tạo tài khoản mới." };
  },

  async resendConfirmationEmail(
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Supabase chưa được cấu hình." };
    }
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  async sendMagicLink(email: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Supabase chưa được cấu hình." };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  async signOut(): Promise<void> {
    if (!isSupabaseConfigured || !supabase) return;
    await supabase.auth.signOut();
  },

  // -------------------------------------------------------------------------
  // 2. USER PROFILE, HOUSEHOLD & INVITE CODE PAIRING
  // -------------------------------------------------------------------------
  async fetchMyProfile(userId: string): Promise<CloudProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle<DbProfileRow>();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email || "",
      displayName: data.display_name || "",
      avatarUrl: data.avatar_url || undefined,
      memberSlot: data.member_slot === "WIFE" ? "WIFE" : "HUSBAND",
      householdId: data.household_id || null,
      role: data.role === "OWNER" ? "OWNER" : data.role === "PARTNER" ? "PARTNER" : null,
      updatedAt: data.updated_at,
    };
  },

  async updateMyProfile(
    userId: string,
    patch: { displayName?: string; avatarUrl?: string; memberSlot?: AuthMemberId }
  ): Promise<CloudProfile | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.displayName !== undefined) payload.display_name = patch.displayName.trim();
    if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl || null;
    if (patch.memberSlot !== undefined) payload.member_slot = patch.memberSlot;

    const { data, error } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select("*")
      .single<DbProfileRow>();

    if (error || !data) return null;

    return {
      id: data.id,
      email: data.email || "",
      displayName: data.display_name || "",
      avatarUrl: data.avatar_url || undefined,
      memberSlot: data.member_slot === "WIFE" ? "WIFE" : "HUSBAND",
      householdId: data.household_id || null,
      role: data.role === "OWNER" ? "OWNER" : data.role === "PARTNER" ? "PARTNER" : null,
      updatedAt: data.updated_at,
    };
  },

  async fetchMyHousehold(userId: string): Promise<HouseholdInfo | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    const { data: myMembership, error: memberErr } = await supabase
      .from("household_members")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle<DbHouseholdMemberRow>();

    if (memberErr || !myMembership) return null;

    const [hhRes, membersRes] = await Promise.all([
      supabase
        .from("households")
        .select("*")
        .eq("id", myMembership.household_id)
        .single<DbHouseholdRow>(),
      supabase
        .from("household_members")
        .select("*")
        .eq("household_id", myMembership.household_id)
        .order("joined_at", { ascending: true }),
    ]);

    if (hhRes.error || !hhRes.data) return null;

    const members: HouseholdMemberInfo[] = ((membersRes.data || []) as DbHouseholdMemberRow[]).map(
      (m) => ({
        userId: m.user_id,
        role: m.role === "OWNER" ? "OWNER" : "PARTNER",
        memberSlot: m.member_slot === "WIFE" ? "WIFE" : "HUSBAND",
        displayName: m.display_name || (m.member_slot === "WIFE" ? "Bé Mèo" : "Anh Chuột"),
        joinedAt: m.joined_at,
      })
    );

    return {
      id: hhRes.data.id,
      name: hhRes.data.name,
      inviteCode: hhRes.data.invite_code,
      myRole: myMembership.role === "OWNER" ? "OWNER" : "PARTNER",
      mySlot: myMembership.member_slot === "WIFE" ? "WIFE" : "HUSBAND",
      members,
    };
  },

  async createHousehold(
    name: string,
    memberSlot: AuthMemberId,
    displayName: string
  ): Promise<{ household?: DbHouseholdRow; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase chưa được cấu hình." };
    }
    const { data, error } = await supabase.rpc("create_household", {
      p_name: name,
      p_member_slot: memberSlot,
      p_display_name: displayName,
    });
    if (error || !data) {
      return { error: error?.message || "Không thể tạo Tổ ấm Cloud." };
    }
    return { household: data as DbHouseholdRow };
  },

  async joinHouseholdByCode(
    inviteCode: string,
    memberSlot: AuthMemberId,
    displayName: string
  ): Promise<{ household?: DbHouseholdRow; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase chưa được cấu hình." };
    }
    const { data, error } = await supabase.rpc("join_household_by_code", {
      p_invite_code: inviteCode,
      p_member_slot: memberSlot,
      p_display_name: displayName,
    });
    if (error || !data) {
      return { error: error?.message || "Mã mời không hợp lệ hoặc đã hết hạn." };
    }
    return { household: data as DbHouseholdRow };
  },

  async regenerateInviteCode(
    householdId: string
  ): Promise<{ inviteCode?: string; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "Supabase chưa được cấu hình." };
    }
    const { data, error } = await supabase.rpc("regenerate_invite_code", {
      p_household_id: householdId,
    });
    if (error || !data) {
      return { error: error?.message || "Không thể tạo mới mã mời." };
    }
    return { inviteCode: String(data) };
  },

  async leaveHousehold(householdId: string): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: "Supabase chưa được cấu hình." };
    }
    const { error } = await supabase.rpc("leave_household", {
      p_household_id: householdId,
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  },

  // -------------------------------------------------------------------------
  // 3. DATA FETCH & FULL PUSH (HOUSEHOLD-SCOPED)
  // -------------------------------------------------------------------------
  async fetchAllData(
    householdId: string,
    retriedAuth = false
  ): Promise<CloudFullData | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    let queryResults;
    try {
      queryResults = await Promise.all([
        supabase.from("categories").select("*").eq("household_id", householdId),
        supabase.from("accounts").select("*").eq("household_id", householdId),
        supabase
          .from("transactions")
          .select("*")
          .eq("household_id", householdId)
          .order("date", { ascending: false }),
        supabase.from("category_budgets").select("*").eq("household_id", householdId),
        supabase.from("savings_goals").select("*").eq("household_id", householdId),
        supabase.from("debts").select("*").eq("household_id", householdId),
        supabase.from("investments").select("*").eq("household_id", householdId),
        supabase.from("recurring_rules").select("*").eq("household_id", householdId),
        supabase.from("skyone_loans").select("*").eq("household_id", householdId).limit(1),
        supabase
          .from("household_settings")
          .select("*")
          .eq("household_id", householdId)
          .maybeSingle<DbHouseholdSettings>(),
        supabase.from("gold_portfolios").select("*").eq("household_id", householdId).limit(1),
        supabase.from("interior_studios").select("*").eq("household_id", householdId).limit(1),
      ]);
    } catch (networkErr) {
      console.warn("[Supabase fetchAllData] Lỗi kết nối mạng, giữ chế độ Offline-First:", networkErr);
      return null;
    }

    const [
      catRes,
      accRes,
      txRes,
      budgetRes,
      goalRes,
      debtRes,
      invRes,
      recRes,
      skyRes,
      setRes,
      goldRes,
      interiorRes,
    ] = queryResults;

    const coreChecks: Array<{ table: string; error: SupabaseErrorLike | null }> = [
      { table: "categories", error: catRes.error },
      { table: "accounts", error: accRes.error },
      { table: "transactions", error: txRes.error },
      { table: "category_budgets", error: budgetRes.error },
      { table: "savings_goals", error: goalRes.error },
      { table: "debts", error: debtRes.error },
      { table: "investments", error: invRes.error },
    ];

    const optionalChecks: Array<{ table: string; error: SupabaseErrorLike | null }> = [
      { table: "recurring_rules", error: recRes.error },
      { table: "skyone_loans", error: skyRes.error },
      { table: "household_settings", error: setRes.error },
      { table: "gold_portfolios", error: goldRes.error },
      { table: "interior_studios", error: interiorRes.error },
    ];

    const allErrors = [...coreChecks, ...optionalChecks].filter(
      (item): item is { table: string; error: SupabaseErrorLike } => Boolean(item.error)
    );

    // Nếu phiên JWT vừa hết hạn, tự làm mới phiên 1 lần rồi thử kéo lại trước khi báo lỗi
    if (!retriedAuth && allErrors.some((item) => isAuthSessionError(item.error))) {
      try {
        const refreshed = await supabase.auth.refreshSession();
        if (!refreshed.error && refreshed.data.session) {
          return this.fetchAllData(householdId, true);
        }
      } catch {
        // tiếp tục xử lý báo lỗi bên dưới
      }
    }

    const missingCoreTables = coreChecks.filter(
      (item) => item.error && isMissingRelationError(item.error)
    );
    if (missingCoreTables.length > 0) {
      console.warn(
        "[Supabase fetchAllData] Schema Supabase chưa đầy đủ, tạm giữ dữ liệu cục bộ:",
        missingCoreTables.map((item) => item.table)
      );
      return null;
    }

    const fatalFailures: string[] = [];
    for (const item of coreChecks) {
      if (item.error) {
        fatalFailures.push(formatSupabaseErrorTag(item.table, item.error));
      }
    }
    for (const item of optionalChecks) {
      if (item.error && !isMissingRelationError(item.error)) {
        fatalFailures.push(formatSupabaseErrorTag(item.table, item.error));
      }
    }

    if (fatalFailures.length > 0) {
      console.warn("[Supabase fetchAllData] Lỗi tải bảng:", fatalFailures);
      throw new Error(
        `Không thể tải dữ liệu đồng bộ từ Supabase (${fatalFailures[0]}).`
      );
    }

    const categories = validateArrayWithZod(
      ((catRes.data || []) as DbCategory[]).map(mapDbToCategory),
      CategorySchema
    );
    const accounts = validateArrayWithZod(
      ((accRes.data || []) as DbAccount[]).map(mapDbToAccount),
      AccountSchema
    );
    const transactions = validateArrayWithZod(
      ((txRes.data || []) as DbTransaction[]).map(mapDbToTransaction),
      TransactionSchema
    );
    const budgets = validateArrayWithZod(
      ((budgetRes.data || []) as DbCategoryBudget[]).map(mapDbToBudget),
      BudgetSchema
    );
    const goals = validateArrayWithZod(
      ((goalRes.data || []) as DbSavingsGoal[]).map(mapDbToGoal),
      SavingsGoalSchema
    );
    const debts = validateArrayWithZod(
      ((debtRes.data || []) as DbDebt[]).map(mapDbToDebt),
      DebtItemSchema
    );
    const investments = validateArrayWithZod(
      ((invRes.data || []) as DbInvestment[]).map(mapDbToInvestment),
      InvestmentItemSchema
    );
    const recurringRules = !recRes.error
      ? validateArrayWithZod(
          ((recRes.data || []) as DbRecurringRule[]).map(mapDbToRecurringRule),
          RecurringRuleSchema
        )
      : [];

    const skyRow = !skyRes.error
      ? ((skyRes.data || [])[0] as DbSkyOneLoan | undefined)
      : undefined;
    if (skyRow && typeof skyRow.revision === "number") {
      knownJsonbRevisions.set(revKey(householdId, "skyone_loans", skyRow.id), skyRow.revision);
    }
    const rawSkyOne = skyRow ? mapDbToSkyOneLoan(skyRow) : null;
    const skyoneLoan = rawSkyOne
      ? reconcileBidvSkyOneContract(rawSkyOne).contract
      : undefined;

    const goldRow = !goldRes.error
      ? ((goldRes.data || [])[0] as DbGoldPortfolio | undefined)
      : undefined;
    if (goldRow && typeof goldRow.revision === "number") {
      knownJsonbRevisions.set(revKey(householdId, "gold_portfolios", goldRow.id), goldRow.revision);
    }
    const goldPortfolio = goldRow ? (mapDbToGoldPortfolio(goldRow) ?? undefined) : undefined;

    const interiorRow = !interiorRes.error
      ? ((interiorRes.data || [])[0] as DbInteriorStudio | undefined)
      : undefined;
    if (interiorRow && typeof interiorRow.revision === "number") {
      knownJsonbRevisions.set(
        revKey(householdId, "interior_studios", interiorRow.id),
        interiorRow.revision
      );
    }
    const interiorStudio = interiorRow
      ? (mapDbToInteriorStudio(interiorRow) ?? undefined)
      : undefined;

    const sharedSettings =
      !setRes.error && setRes.data
        ? mapDbToSharedSettings(setRes.data)
        : undefined;

    return {
      categories,
      accounts,
      transactions,
      budgets,
      goals,
      debts,
      investments,
      recurringRules,
      sharedSettings,
      skyoneLoan,
      goldPortfolio,
      interiorStudio,
    };
  },

  async pushFullState(householdId: string, state: StoredAppStateV3): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

    const ops: PromiseLike<{ error: { message: string } | null }>[] = [];

    if (state.categories.length > 0) {
      ops.push(
        supabase
          .from("categories")
          .upsert(state.categories.map((c) => mapCategoryToDb(c, householdId)), {
            onConflict: "household_id,id",
          })
      );
    }
    if (state.accounts.length > 0) {
      ops.push(
        supabase
          .from("accounts")
          .upsert(state.accounts.map((a) => mapAccountToDb(a, householdId)), {
            onConflict: "household_id,id",
          })
      );
    }
    if (state.transactions.length > 0) {
      ops.push(
        supabase
          .from("transactions")
          .upsert(state.transactions.map((t) => mapTransactionToDb(t, householdId)), {
            onConflict: "household_id,id",
          })
      );
    }
    if (state.budgets.length > 0) {
      ops.push(
        supabase
          .from("category_budgets")
          .upsert(state.budgets.map((b) => mapBudgetToDb(b, householdId)), {
            onConflict: "household_id,category_id,month",
          })
      );
    }
    if (state.goals.length > 0) {
      ops.push(
        supabase
          .from("savings_goals")
          .upsert(state.goals.map((g) => mapGoalToDb(g, householdId)), {
            onConflict: "household_id,id",
          })
      );
    }
    if (state.debts.length > 0) {
      ops.push(
        supabase
          .from("debts")
          .upsert(state.debts.map((d) => mapDebtToDb(d, householdId)), {
            onConflict: "household_id,id",
          })
      );
    }
    if (state.investments.length > 0) {
      ops.push(
        supabase
          .from("investments")
          .upsert(state.investments.map((i) => mapInvestmentToDb(i, householdId)), {
            onConflict: "household_id,id",
          })
      );
    }
    if (state.recurringRules.length > 0) {
      ops.push(
        supabase
          .from("recurring_rules")
          .upsert(state.recurringRules.map((r) => mapRecurringRuleToDb(r, householdId)), {
            onConflict: "household_id,id",
          })
      );
    }

    ops.push(
      supabase
        .from("skyone_loans")
        .upsert(mapSkyOneLoanToDb(state.skyoneLoan, householdId), {
          onConflict: "household_id,id",
        })
    );

    ops.push(
      supabase
        .from("household_settings")
        .upsert(mapSharedSettingsToDb(state.settings, householdId), {
          onConflict: "household_id",
        })
    );

    const results = await Promise.all(ops);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      throw new Error(failed.error.message);
    }

    // Đồng bộ 2 phân hệ mới (tương thích ngược với DB cũ chưa thêm cột revision hoặc chưa tạo bảng)
    if (state.goldPortfolio) {
      const goldRowPayload = mapGoldPortfolioToDb(state.goldPortfolio, householdId);
      let goldUpsert = await supabase
        .from("gold_portfolios")
        .upsert(goldRowPayload, { onConflict: "household_id,id" })
        .select("id,revision")
        .maybeSingle<{ id: string; revision?: number }>();
      if (goldUpsert.error && isMissingColumnError(goldUpsert.error)) {
        goldUpsert = await supabase
          .from("gold_portfolios")
          .upsert(goldRowPayload, { onConflict: "household_id,id" })
          .select("id")
          .maybeSingle<{ id: string; revision?: number }>();
      }
      if (goldUpsert.error && !isMissingRelationError(goldUpsert.error)) {
        throw new Error(`Lỗi đồng bộ Kho Vàng: ${goldUpsert.error.message}`);
      }
      if (goldUpsert.data && typeof goldUpsert.data.revision === "number") {
        knownJsonbRevisions.set(
          revKey(householdId, "gold_portfolios", goldUpsert.data.id),
          goldUpsert.data.revision
        );
      }
    }
    if (state.interiorStudio) {
      const interiorRowPayload = mapInteriorStudioToDb(state.interiorStudio, householdId);
      let interiorUpsert = await supabase
        .from("interior_studios")
        .upsert(interiorRowPayload, { onConflict: "household_id,id" })
        .select("id,revision")
        .maybeSingle<{ id: string; revision?: number }>();
      if (interiorUpsert.error && isMissingColumnError(interiorUpsert.error)) {
        interiorUpsert = await supabase
          .from("interior_studios")
          .upsert(interiorRowPayload, { onConflict: "household_id,id" })
          .select("id")
          .maybeSingle<{ id: string; revision?: number }>();
      }
      if (interiorUpsert.error && !isMissingRelationError(interiorUpsert.error)) {
        throw new Error(`Lỗi đồng bộ Studio 3D: ${interiorUpsert.error.message}`);
      }
      if (interiorUpsert.data && typeof interiorUpsert.data.revision === "number") {
        knownJsonbRevisions.set(
          revKey(householdId, "interior_studios", interiorUpsert.data.id),
          interiorUpsert.data.revision
        );
      }
    }

    return true;
  },

  /**
   * Kéo dữ liệu gia tăng cho ĐÚNG 1 bảng bị thay đổi qua Supabase Realtime
   * thay vì kéo lại toàn bộ 12 bảng sau mỗi thao tác nhỏ.
   */
  async fetchSingleTablePatch(
    householdId: string,
    table: string
  ): Promise<CloudTablePatch | null> {
    if (!isSupabaseConfigured || !supabase) return null;

    switch (table) {
      case "categories": {
        const { data, error } = await supabase
          .from("categories")
          .select("*")
          .eq("household_id", householdId);
        if (error) throw new Error(error.message);
        return {
          table,
          categories: validateArrayWithZod(
            ((data || []) as DbCategory[]).map(mapDbToCategory),
            CategorySchema
          ),
        };
      }
      case "accounts": {
        const { data, error } = await supabase
          .from("accounts")
          .select("*")
          .eq("household_id", householdId);
        if (error) throw new Error(error.message);
        return {
          table,
          accounts: validateArrayWithZod(
            ((data || []) as DbAccount[]).map(mapDbToAccount),
            AccountSchema
          ),
        };
      }
      case "transactions": {
        const { data, error } = await supabase
          .from("transactions")
          .select("*")
          .eq("household_id", householdId)
          .order("date", { ascending: false });
        if (error) throw new Error(error.message);
        return {
          table,
          transactions: validateArrayWithZod(
            ((data || []) as DbTransaction[]).map(mapDbToTransaction),
            TransactionSchema
          ),
        };
      }
      case "category_budgets": {
        const { data, error } = await supabase
          .from("category_budgets")
          .select("*")
          .eq("household_id", householdId);
        if (error) throw new Error(error.message);
        return {
          table,
          budgets: validateArrayWithZod(
            ((data || []) as DbCategoryBudget[]).map(mapDbToBudget),
            BudgetSchema
          ),
        };
      }
      case "savings_goals": {
        const { data, error } = await supabase
          .from("savings_goals")
          .select("*")
          .eq("household_id", householdId);
        if (error) throw new Error(error.message);
        return {
          table,
          goals: validateArrayWithZod(
            ((data || []) as DbSavingsGoal[]).map(mapDbToGoal),
            SavingsGoalSchema
          ),
        };
      }
      case "debts": {
        const { data, error } = await supabase
          .from("debts")
          .select("*")
          .eq("household_id", householdId);
        if (error) throw new Error(error.message);
        return {
          table,
          debts: validateArrayWithZod(
            ((data || []) as DbDebt[]).map(mapDbToDebt),
            DebtItemSchema
          ),
        };
      }
      case "investments": {
        const { data, error } = await supabase
          .from("investments")
          .select("*")
          .eq("household_id", householdId);
        if (error) throw new Error(error.message);
        return {
          table,
          investments: validateArrayWithZod(
            ((data || []) as DbInvestment[]).map(mapDbToInvestment),
            InvestmentItemSchema
          ),
        };
      }
      case "recurring_rules": {
        const { data, error } = await supabase
          .from("recurring_rules")
          .select("*")
          .eq("household_id", householdId);
        if (error) throw new Error(error.message);
        return {
          table,
          recurringRules: validateArrayWithZod(
            ((data || []) as DbRecurringRule[]).map(mapDbToRecurringRule),
            RecurringRuleSchema
          ),
        };
      }
      case "skyone_loans": {
        const { data, error } = await supabase
          .from("skyone_loans")
          .select("*")
          .eq("household_id", householdId)
          .limit(1);
        if (error) {
          if (isMissingRelationError(error)) return null;
          throw new Error(error.message);
        }
        const row = (data || [])[0] as DbSkyOneLoan | undefined;
        if (!row) return null;
        if (typeof row.revision === "number") {
          knownJsonbRevisions.set(revKey(householdId, "skyone_loans", row.id), row.revision);
        }
        const parsed = mapDbToSkyOneLoan(row);
        return parsed
          ? { table, skyoneLoan: reconcileBidvSkyOneContract(parsed).contract }
          : null;
      }
      case "gold_portfolios": {
        const { data, error } = await supabase
          .from("gold_portfolios")
          .select("*")
          .eq("household_id", householdId)
          .limit(1);
        if (error) {
          if (isMissingRelationError(error)) return null;
          throw new Error(error.message);
        }
        const row = (data || [])[0] as DbGoldPortfolio | undefined;
        if (!row) return null;
        if (typeof row.revision === "number") {
          knownJsonbRevisions.set(revKey(householdId, "gold_portfolios", row.id), row.revision);
        }
        const parsed = mapDbToGoldPortfolio(row);
        return parsed ? { table, goldPortfolio: parsed } : null;
      }
      case "interior_studios": {
        const { data, error } = await supabase
          .from("interior_studios")
          .select("*")
          .eq("household_id", householdId)
          .limit(1);
        if (error) {
          if (isMissingRelationError(error)) return null;
          throw new Error(error.message);
        }
        const row = (data || [])[0] as DbInteriorStudio | undefined;
        if (!row) return null;
        if (typeof row.revision === "number") {
          knownJsonbRevisions.set(revKey(householdId, "interior_studios", row.id), row.revision);
        }
        const parsed = mapDbToInteriorStudio(row);
        return parsed ? { table, interiorStudio: parsed } : null;
      }
      case "household_settings": {
        const { data, error } = await supabase
          .from("household_settings")
          .select("*")
          .eq("household_id", householdId)
          .maybeSingle<DbHouseholdSettings>();
        if (error) {
          if (isMissingRelationError(error)) return null;
          throw new Error(error.message);
        }
        return data ? { table, sharedSettings: mapDbToSharedSettings(data) } : null;
      }
      default:
        return null;
    }
  },

  // -------------------------------------------------------------------------
  // 4. SINGLE MUTATION EXECUTION (USED ONLINE & BY OFFLINE OUTBOX FLUSHER)
  // -------------------------------------------------------------------------
  async executeMutation(
    householdId: string,
    mutation: CloudMutation
  ): Promise<MutationExecutionResult> {
    if (!isSupabaseConfigured || !supabase) return { ok: false };

    let res: { error: { message: string } | null } = { error: null };

    switch (mutation.type) {
      case "UPSERT_CATEGORY":
        res = await supabase
          .from("categories")
          .upsert(mapCategoryToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;
      case "DELETE_CATEGORY":
        res = await supabase
          .from("categories")
          .delete()
          .eq("household_id", householdId)
          .eq("id", mutation.id);
        break;

      case "UPSERT_ACCOUNT":
        res = await supabase
          .from("accounts")
          .upsert(mapAccountToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;
      case "UPSERT_ACCOUNTS_BATCH":
        if (mutation.payload.length === 0) return { ok: true };
        res = await supabase
          .from("accounts")
          .upsert(mutation.payload.map((a) => mapAccountToDb(a, householdId)), {
            onConflict: "household_id,id",
          });
        break;
      case "DELETE_ACCOUNT":
        res = await supabase
          .from("accounts")
          .delete()
          .eq("household_id", householdId)
          .eq("id", mutation.id);
        break;

      case "UPSERT_TRANSACTION":
        res = await supabase
          .from("transactions")
          .upsert(mapTransactionToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;
      case "UPSERT_TRANSACTIONS_BATCH":
        if (mutation.payload.length === 0) return { ok: true };
        res = await supabase
          .from("transactions")
          .upsert(mutation.payload.map((t) => mapTransactionToDb(t, householdId)), {
            onConflict: "household_id,id",
          });
        break;
      case "DELETE_TRANSACTION":
        res = await supabase
          .from("transactions")
          .delete()
          .eq("household_id", householdId)
          .eq("id", mutation.id);
        break;
      case "DELETE_TRANSACTIONS_BATCH":
        if (mutation.ids.length === 0) return { ok: true };
        res = await supabase
          .from("transactions")
          .delete()
          .eq("household_id", householdId)
          .in("id", mutation.ids);
        break;

      case "UPSERT_BUDGET":
        res = await supabase
          .from("category_budgets")
          .upsert(mapBudgetToDb(mutation.payload, householdId), {
            onConflict: "household_id,category_id,month",
          });
        break;
      case "UPSERT_BUDGETS_BATCH":
        if (mutation.payload.length === 0) return { ok: true };
        res = await supabase
          .from("category_budgets")
          .upsert(mutation.payload.map((b) => mapBudgetToDb(b, householdId)), {
            onConflict: "household_id,category_id,month",
          });
        break;
      case "DELETE_BUDGET":
        res = await supabase
          .from("category_budgets")
          .delete()
          .eq("household_id", householdId)
          .eq("category_id", mutation.categoryId)
          .eq("month", mutation.month);
        break;

      case "UPSERT_GOAL":
        res = await supabase
          .from("savings_goals")
          .upsert(mapGoalToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;
      case "DELETE_GOAL":
        res = await supabase
          .from("savings_goals")
          .delete()
          .eq("household_id", householdId)
          .eq("id", mutation.id);
        break;

      case "UPSERT_DEBT":
        res = await supabase
          .from("debts")
          .upsert(mapDebtToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;
      case "DELETE_DEBT":
        res = await supabase
          .from("debts")
          .delete()
          .eq("household_id", householdId)
          .eq("id", mutation.id);
        break;

      case "UPSERT_INVESTMENT":
        res = await supabase
          .from("investments")
          .upsert(mapInvestmentToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;
      case "DELETE_INVESTMENT":
        res = await supabase
          .from("investments")
          .delete()
          .eq("household_id", householdId)
          .eq("id", mutation.id);
        break;

      case "UPSERT_RECURRING_RULE":
        res = await supabase
          .from("recurring_rules")
          .upsert(mapRecurringRuleToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;
      case "UPSERT_RECURRING_RULES_BATCH":
        if (mutation.payload.length === 0) return { ok: true };
        res = await supabase
          .from("recurring_rules")
          .upsert(mutation.payload.map((r) => mapRecurringRuleToDb(r, householdId)), {
            onConflict: "household_id,id",
          });
        break;
      case "DELETE_RECURRING_RULE":
        res = await supabase
          .from("recurring_rules")
          .delete()
          .eq("household_id", householdId)
          .eq("id", mutation.id);
        break;

      case "UPSERT_SKYONE_LOAN": {
        const docId = mutation.payload.id || "skyone_default";
        const key = revKey(householdId, "skyone_loans", docId);
        const expectedRev = knownJsonbRevisions.get(key);

        // Kiểm tra xung đột revision trước khi ghi đè JSONB
        const remoteCheck = await supabase
          .from("skyone_loans")
          .select("*")
          .eq("household_id", householdId)
          .eq("id", docId)
          .maybeSingle<DbSkyOneLoan>();

        if (remoteCheck.error && isMissingRelationError(remoteCheck.error)) {
          return { ok: true };
        }

        let payloadToWrite = mutation.payload;
        let conflictResolved = false;

        if (
          !remoteCheck.error &&
          remoteCheck.data &&
          typeof remoteCheck.data.revision === "number" &&
          expectedRev !== undefined &&
          remoteCheck.data.revision > expectedRev
        ) {
          const remoteParsed = mapDbToSkyOneLoan(remoteCheck.data);
          if (remoteParsed) {
            payloadToWrite = reconcileBidvSkyOneContract(
              mergeSkyOneContracts(remoteParsed, mutation.payload)
            ).contract;
            conflictResolved = true;
          }
        }

        const dbRow = mapSkyOneLoanToDb(payloadToWrite, householdId);
        let saved = await supabase
          .from("skyone_loans")
          .upsert(dbRow, { onConflict: "household_id,id" })
          .select("id,revision")
          .maybeSingle<{ id: string; revision?: number }>();
        if (saved.error && isMissingColumnError(saved.error)) {
          saved = await supabase
            .from("skyone_loans")
            .upsert(dbRow, { onConflict: "household_id,id" })
            .select("id")
            .maybeSingle<{ id: string; revision?: number }>();
        }
        if (saved.error) {
          throw new Error(saved.error.message);
        }
        if (saved.data && typeof saved.data.revision === "number") {
          knownJsonbRevisions.set(key, saved.data.revision);
        }
        return {
          ok: true,
          conflictResolved,
          ...(conflictResolved ? { mergedSkyOneLoan: payloadToWrite } : {}),
        };
      }

      case "UPSERT_GOLD_PORTFOLIO": {
        const docId = "gold_default";
        const key = revKey(householdId, "gold_portfolios", docId);
        const expectedRev = knownJsonbRevisions.get(key);

        const remoteCheck = await supabase
          .from("gold_portfolios")
          .select("*")
          .eq("household_id", householdId)
          .eq("id", docId)
          .maybeSingle<DbGoldPortfolio>();

        if (remoteCheck.error && isMissingRelationError(remoteCheck.error)) {
          return { ok: true };
        }

        let payloadToWrite = mutation.payload;
        let conflictResolved = false;

        if (
          !remoteCheck.error &&
          remoteCheck.data &&
          typeof remoteCheck.data.revision === "number" &&
          expectedRev !== undefined &&
          remoteCheck.data.revision > expectedRev
        ) {
          const remoteParsed = mapDbToGoldPortfolio(remoteCheck.data);
          if (remoteParsed) {
            payloadToWrite = mergeGoldPortfolios(remoteParsed, mutation.payload);
            conflictResolved = true;
          }
        }

        const dbRow = mapGoldPortfolioToDb(payloadToWrite, householdId);
        let saved = await supabase
          .from("gold_portfolios")
          .upsert(dbRow, { onConflict: "household_id,id" })
          .select("id,revision")
          .maybeSingle<{ id: string; revision?: number }>();
        if (saved.error && isMissingColumnError(saved.error)) {
          saved = await supabase
            .from("gold_portfolios")
            .upsert(dbRow, { onConflict: "household_id,id" })
            .select("id")
            .maybeSingle<{ id: string; revision?: number }>();
        }
        if (saved.error) {
          if (isMissingRelationError(saved.error)) return { ok: true };
          throw new Error(saved.error.message);
        }
        if (saved.data && typeof saved.data.revision === "number") {
          knownJsonbRevisions.set(key, saved.data.revision);
        }
        return {
          ok: true,
          conflictResolved,
          ...(conflictResolved ? { mergedGoldPortfolio: payloadToWrite } : {}),
        };
      }

      case "UPSERT_INTERIOR_STUDIO": {
        const docId = "interior_a12a07";
        const key = revKey(householdId, "interior_studios", docId);
        const expectedRev = knownJsonbRevisions.get(key);

        const remoteCheck = await supabase
          .from("interior_studios")
          .select("*")
          .eq("household_id", householdId)
          .eq("id", docId)
          .maybeSingle<DbInteriorStudio>();

        if (remoteCheck.error && isMissingRelationError(remoteCheck.error)) {
          return { ok: true };
        }

        let payloadToWrite = mutation.payload;
        let conflictResolved = false;

        if (
          !remoteCheck.error &&
          remoteCheck.data &&
          typeof remoteCheck.data.revision === "number" &&
          expectedRev !== undefined &&
          remoteCheck.data.revision > expectedRev
        ) {
          const remoteParsed = mapDbToInteriorStudio(remoteCheck.data);
          if (remoteParsed) {
            payloadToWrite = mergeInteriorStudios(remoteParsed, mutation.payload);
            conflictResolved = true;
          }
        }

        const dbRow = mapInteriorStudioToDb(payloadToWrite, householdId);
        let saved = await supabase
          .from("interior_studios")
          .upsert(dbRow, { onConflict: "household_id,id" })
          .select("id,revision")
          .maybeSingle<{ id: string; revision?: number }>();
        if (saved.error && isMissingColumnError(saved.error)) {
          saved = await supabase
            .from("interior_studios")
            .upsert(dbRow, { onConflict: "household_id,id" })
            .select("id")
            .maybeSingle<{ id: string; revision?: number }>();
        }
        if (saved.error) {
          if (isMissingRelationError(saved.error)) return { ok: true };
          throw new Error(saved.error.message);
        }
        if (saved.data && typeof saved.data.revision === "number") {
          knownJsonbRevisions.set(key, saved.data.revision);
        }
        return {
          ok: true,
          conflictResolved,
          ...(conflictResolved ? { mergedInteriorStudio: payloadToWrite } : {}),
        };
      }

      case "UPSERT_SETTINGS":
        res = await supabase
          .from("household_settings")
          .upsert(mapSharedSettingsToDb(mutation.payload, householdId), {
            onConflict: "household_id",
          });
        break;
    }

    if (res.error) {
      throw new Error(res.error.message);
    }
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // 5. REALTIME SUBSCRIPTION (HOUSEHOLD SCOPED)
  // -------------------------------------------------------------------------
  subscribeHouseholdRealtime(
    householdId: string,
    onRemoteChange: (table: string) => void
  ): () => void {
    if (!isSupabaseConfigured || !supabase) return () => {};

    const client = supabase;
    const watchedTables = [
      "categories",
      "accounts",
      "transactions",
      "category_budgets",
      "savings_goals",
      "debts",
      "investments",
      "recurring_rules",
      "skyone_loans",
      "gold_portfolios",
      "interior_studios",
      "household_settings",
      "household_members",
      "profiles",
    ];

    const channel = client.channel(`household_${householdId}`);

    for (const table of watchedTables) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `household_id=eq.${householdId}`,
        },
        () => {
          onRemoteChange(table);
        }
      );
    }

    channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  },
};
