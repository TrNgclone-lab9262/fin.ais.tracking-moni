import { supabase, isSupabaseConfigured } from "./supabaseClient";
import {
  DbAccount,
  DbCategory,
  DbCategoryBudget,
  DbDebt,
  DbHouseholdSettings,
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
  mapDbToInvestment,
  mapDbToRecurringRule,
  mapDbToSharedSettings,
  mapDbToSkyOneLoan,
  mapDbToTransaction,
  mapDebtToDb,
  mapGoalToDb,
  mapInvestmentToDb,
  mapRecurringRuleToDb,
  mapSharedSettingsToDb,
  mapSkyOneLoanToDb,
  mapTransactionToDb,
} from "./supabaseMappers";
import { CloudMutation } from "./offlineOutbox";
import { StoredAppStateV3 } from "./storage";
import {
  Account,
  AuthMemberId,
  Category,
  CategoryBudget,
  DebtItem,
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
  async fetchAllData(householdId: string): Promise<CloudFullData | null> {
    if (!isSupabaseConfigured || !supabase) return null;

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
    ] = await Promise.all([
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
    ]);

    if (
      catRes.error ||
      accRes.error ||
      txRes.error ||
      budgetRes.error ||
      goalRes.error ||
      debtRes.error ||
      invRes.error ||
      recRes.error ||
      skyRes.error ||
      setRes.error
    ) {
      throw new Error("Không thể tải dữ liệu đồng bộ từ Supabase.");
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
    const recurringRules = validateArrayWithZod(
      ((recRes.data || []) as DbRecurringRule[]).map(mapDbToRecurringRule),
      RecurringRuleSchema
    );

    const skyRow = (skyRes.data || [])[0] as DbSkyOneLoan | undefined;
    const rawSkyOne = skyRow ? mapDbToSkyOneLoan(skyRow) : null;
    const skyoneLoan = rawSkyOne
      ? reconcileBidvSkyOneContract(rawSkyOne).contract
      : undefined;

    const sharedSettings = setRes.data
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
    return true;
  },

  // -------------------------------------------------------------------------
  // 4. SINGLE MUTATION EXECUTION (USED ONLINE & BY OFFLINE OUTBOX FLUSHER)
  // -------------------------------------------------------------------------
  async executeMutation(householdId: string, mutation: CloudMutation): Promise<boolean> {
    if (!isSupabaseConfigured || !supabase) return false;

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
        if (mutation.payload.length === 0) return true;
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
        if (mutation.payload.length === 0) return true;
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
        if (mutation.ids.length === 0) return true;
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
        if (mutation.payload.length === 0) return true;
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
        if (mutation.payload.length === 0) return true;
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

      case "UPSERT_SKYONE_LOAN":
        res = await supabase
          .from("skyone_loans")
          .upsert(mapSkyOneLoanToDb(mutation.payload, householdId), {
            onConflict: "household_id,id",
          });
        break;

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
    return true;
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
