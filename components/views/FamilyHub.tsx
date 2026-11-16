"use client";

import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Cloud,
  CloudOff,
  Copy,
  Database,
  Download,
  Home,
  LogOut,
  Pencil,
  RefreshCw,
  UploadCloud,
  UserCheck,
  UserPlus,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useFinance } from "@/context/FinanceContext";
import { AuthMemberId } from "@/types/finance";
import { CloudAuthForm } from "@/components/auth/CloudAuthForm";
import schemaSql from "@/supabase/schema.sql?raw";

interface FamilyHubProps {
  onStatusToast?: (msg: string) => void;
}

export function FamilyHub({ onStatusToast }: FamilyHubProps) {
  const {
    isSupabaseEnvReady,
    cloudUser,
    cloudProfile,
    household,
    isCloudConnected,
    isSyncing,
    pendingOutboxCount,
    cloudError,
    clearCloudError,
    syncWithCloud,
    updateCloudProfile,
    signOutCloud,
    createCloudHousehold,
    joinCloudHousehold,
    rotateHouseholdInviteCode,
    leaveCloudHousehold,
    pushLocalStateToCloud,
    settings,
  } = useFinance();

  const [hubTab, setHubTab] = useState<"CREATE" | "JOIN">("CREATE");
  const [newHouseholdName, setNewHouseholdName] = useState("Tổ Ấm Home Moni");
  const [inviteCodeInput, setInviteCodeInput] = useState("");
  const [pairingSlot, setPairingSlot] = useState<AuthMemberId>(
    cloudProfile?.memberSlot || settings.authActiveProfile || "HUSBAND"
  );
  const [isBusy, setIsBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedHouseholdId, setCopiedHouseholdId] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Inline Profile editing state (syncs directly to public.profiles)
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email Provider / Resend SMTP setup guide state
  const [isSmtpGuideOpen, setIsSmtpGuideOpen] = useState(false);
  const [copiedSmtpField, setCopiedSmtpField] = useState<string | null>(null);
  const appOrigin =
    typeof window !== "undefined" ? window.location.origin : "https://your-app-domain.run.app";

  const copyGuideValue = async (key: string, value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedSmtpField(key);
      notify(`Đã sao chép ${label}: ${value}`);
      setTimeout(() => setCopiedSmtpField(null), 2000);
    } catch {
      notify(value);
    }
  };

  useEffect(() => {
    if (cloudProfile?.memberSlot) {
      setPairingSlot(cloudProfile.memberSlot);
    }
    if (cloudProfile?.displayName !== undefined) {
      setProfileNameDraft(cloudProfile.displayName);
    }
  }, [cloudProfile?.memberSlot, cloudProfile?.displayName]);

  const notify = (msg: string) => {
    onStatusToast?.(msg);
  };

  const handleCopySqlSchema = async () => {
    try {
      await navigator.clipboard.writeText(schemaSql);
      setCopiedSql(true);
      notify("Đã sao chép toàn bộ SQL schema Supabase.");
      setTimeout(() => setCopiedSql(false), 2400);
    } catch {
      notify("Không thể truy cập clipboard, hãy dùng nút Tải file .sql.");
    }
  };

  const handleDownloadSqlSchema = () => {
    const blob = new Blob([schemaSql], { type: "text/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "home-moni-supabase-schema.sql";
    link.click();
    URL.revokeObjectURL(url);
    notify("Đã tải file home-moni-supabase-schema.sql.");
  };

  const handleSaveProfileName = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = profileNameDraft.trim();
    if (!cleaned) return;
    setIsSavingProfile(true);
    try {
      const ok = await updateCloudProfile({ displayName: cleaned });
      if (ok) {
        setIsEditingProfile(false);
        notify("Đã cập nhật tên hiển thị trong bảng profiles.");
      }
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateHouseholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearCloudError();
    setIsBusy(true);
    try {
      const ok = await createCloudHousehold(newHouseholdName.trim(), pairingSlot);
      if (ok) {
        notify("Đã tạo Tổ ấm Cloud & đồng bộ dữ liệu hiện tại lên Supabase.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleJoinHouseholdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearCloudError();
    if (!inviteCodeInput.trim()) return;
    setIsBusy(true);
    try {
      const ok = await joinCloudHousehold(inviteCodeInput.trim(), pairingSlot);
      if (ok) {
        setInviteCodeInput("");
        notify("Đã ghép đôi vào Tổ ấm & gộp thông minh dữ liệu hai vợ chồng.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleCopyText = async (
    value: string,
    setFlag: (val: boolean) => void,
    message: string
  ) => {
    try {
      await navigator.clipboard.writeText(value);
      setFlag(true);
      notify(message);
      setTimeout(() => setFlag(false), 2200);
    } catch {
      notify(value);
    }
  };

  const handleRotateInviteCode = async () => {
    setIsBusy(true);
    try {
      const nextCode = await rotateHouseholdInviteCode();
      if (nextCode) {
        notify(`Đã đổi mã ghép đôi mới: ${nextCode}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleLeaveHousehold = async () => {
    setIsBusy(true);
    try {
      const ok = await leaveCloudHousehold();
      if (ok) {
        setConfirmLeave(false);
        notify("Đã rời Tổ ấm Cloud. Dữ liệu cục bộ vẫn được giữ an toàn.");
      }
    } finally {
      setIsBusy(false);
    }
  };

  const statusText = isCloudConnected
    ? pendingOutboxCount > 0
      ? `Đang chờ đẩy ${pendingOutboxCount} thay đổi`
      : "Cloud Realtime Active"
    : cloudUser
    ? "Đã đăng nhập · Chờ ghép Tổ ấm"
    : isSupabaseEnvReady
    ? "Supabase Sẵn sàng"
    : "Local-First Active";

  const statusClass = isCloudConnected
    ? pendingOutboxCount > 0
      ? "text-amber-700 dark:text-amber-300"
      : "text-emerald-700 dark:text-emerald-300"
    : cloudUser || isSupabaseEnvReady
    ? "text-blue-700 dark:text-blue-300"
    : "text-slate-600 dark:text-slate-300";

  return (
    <section
      aria-labelledby="family-hub-heading"
      data-testid="family-hub-section"
      className="space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E9EEF5] dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
              isCloudConnected
                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                : isSupabaseEnvReady
                ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
            }`}
          >
            {isCloudConnected ? (
              <Cloud className="w-4 h-4" />
            ) : (
              <Database className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3
              id="family-hub-heading"
              className="text-sm sm:text-base font-bold text-[#172B4D] dark:text-slate-100"
            >
              FamilyHub · Kết Nối Cloud &amp; Ghép Đôi Gia Đình
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Khởi động 0ms LocalStorage (<code className="font-mono text-blue-600 dark:text-blue-400">HOME_MONI_DATA_V4</code>) · Supabase Auth &amp; RLS Tổ ấm
            </p>
          </div>
        </div>

        <span
          className={`text-xs font-bold tabular-nums whitespace-nowrap shrink-0 ${statusClass}`}
        >
          {statusText}
        </span>
      </div>

      {/* STATE A: Environment variables not yet configured */}
      {!isSupabaseEnvReady && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#E9EEF5] dark:border-slate-700 space-y-3">
          <div className="flex items-start gap-2.5">
            <CloudOff className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <p className="font-bold text-[#172B4D] dark:text-slate-100">
                Chế độ Local-First đang chạy độc lập trên thiết bị này
              </p>
              <p>
                Để bật đăng nhập Supabase Auth &amp; ghép đôi FamilyHub giữa máy{" "}
                {settings.husbandName} và {settings.wifeName}, hãy khai báo{" "}
                <code className="font-mono text-blue-600 dark:text-blue-400">VITE_SUPABASE_URL</code>{" "}
                và{" "}
                <code className="font-mono text-blue-600 dark:text-blue-400">
                  VITE_SUPABASE_ANON_KEY
                </code>{" "}
                trong Secrets / biến môi trường triển khai, đồng thời chạy script SQL khởi tạo bảng{" "}
                <code className="font-mono">profiles</code> &amp;{" "}
                <code className="font-mono">households</code>.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleCopySqlSchema()}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedSql ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              )}
              <span>
                {copiedSql ? "Đã chép SQL schema" : "Sao chép SQL khởi tạo (schema.sql)"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadSqlSchema}
              className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Tải file .sql</span>
            </button>
          </div>
        </div>
      )}

      {/* STATE B: Supabase ready, user not signed in -> Embedded CloudAuthForm */}
      {isSupabaseEnvReady && !cloudUser && (
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#E9EEF5] dark:border-slate-700">
          <CloudAuthForm onStatusToast={notify} />
        </div>
      )}

      {/* STATE C & D: Authenticated User Profile Bar + Create/Join or Connected Household */}
      {isSupabaseEnvReady && cloudUser && (
        <div className="space-y-4">
          {cloudError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start justify-between gap-2"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cloudError}</span>
              </div>
              <button
                type="button"
                onClick={clearCloudError}
                className="text-[11px] font-bold underline shrink-0 cursor-pointer"
              >
                Đóng
              </button>
            </div>
          )}

          {/* Profile Summary Strip (from public.profiles) */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#E9EEF5] dark:border-slate-700 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>

              {isEditingProfile ? (
                <form
                  onSubmit={(e) => void handleSaveProfileName(e)}
                  className="flex flex-wrap items-center gap-2 flex-1 min-w-0"
                >
                  <input
                    type="text"
                    value={profileNameDraft}
                    onChange={(e) => setProfileNameDraft(e.target.value)}
                    placeholder="Tên hiển thị..."
                    className="min-h-[36px] flex-1 min-w-[140px] bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                  />
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    {isSavingProfile ? "Đang lưu..." : "Lưu tên"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingProfile(false);
                      setProfileNameDraft(cloudProfile?.displayName || "");
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                  >
                    Hủy
                  </button>
                </form>
              ) : (
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-extrabold text-[#172B4D] dark:text-slate-100 truncate">
                      {cloudProfile?.displayName || cloudUser.email}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileNameDraft(cloudProfile?.displayName || "");
                        setIsEditingProfile(true);
                      }}
                      title="Đổi tên hiển thị trong bảng profiles"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Sửa tên</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="truncate">{cloudUser.email}</span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Hồ sơ:{" "}
                      {cloudProfile?.memberSlot === "WIFE"
                        ? settings.wifeName
                        : settings.husbandName}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void signOutCloud()}
              className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-[#DCE4EE] dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất</span>
            </button>
          </div>

          {/* STATE C: Signed in, NOT paired to a household yet */}
          {!household && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-[#E9EEF5] dark:border-slate-700 space-y-4">
              <div className="grid grid-cols-2 gap-2 p-1 rounded-lg bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700">
                <button
                  type="button"
                  data-testid="familyhub-tab-create"
                  onClick={() => setHubTab("CREATE")}
                  className={`min-h-[40px] py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    hubTab === "CREATE"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Tạo Tổ ấm mới</span>
                </button>
                <button
                  type="button"
                  data-testid="familyhub-tab-join"
                  onClick={() => setHubTab("JOIN")}
                  className={`min-h-[40px] py-2 px-3 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                    hubTab === "JOIN"
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Nhập Mã ghép đôi</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Vai trò của bạn:
                </span>
                {(
                  [
                    { id: "HUSBAND" as AuthMemberId, label: `👨 ${settings.husbandName}` },
                    { id: "WIFE" as AuthMemberId, label: `👩 ${settings.wifeName}` },
                  ] as const
                ).map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setPairingSlot(slot.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer ${
                      pairingSlot === slot.id
                        ? "bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-700 dark:text-blue-200"
                        : "bg-white dark:bg-slate-900 border-[#DCE4EE] dark:border-slate-700 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>

              {hubTab === "CREATE" ? (
                <form
                  onSubmit={(e) => void handleCreateHouseholdSubmit(e)}
                  className="space-y-3"
                >
                  <div>
                    <label
                      htmlFor="familyhub-household-name"
                      className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Tên Tổ ấm gia đình
                    </label>
                    <input
                      id="familyhub-household-name"
                      type="text"
                      value={newHouseholdName}
                      onChange={(e) => setNewHouseholdName(e.target.value)}
                      placeholder="Tổ Ấm Home Moni"
                      className="w-full min-h-[40px] bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-blue-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Hệ thống sẽ gắn <code className="font-mono">household_id</code> vào Profile cá nhân của bạn, sinh mã ghép đôi (dạng <span className="font-mono font-bold">MONI-XXXX</span>) và đồng bộ toàn bộ giao dịch, tài khoản &amp; hợp đồng SKYONE hiện có lên Cloud.
                  </p>
                  <button
                    type="submit"
                    disabled={isBusy}
                    data-testid="familyhub-create-submit"
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>
                      {isBusy ? "Đang tạo & đồng bộ..." : "Tạo Tổ ấm & Lấy Mã ghép đôi"}
                    </span>
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={(e) => void handleJoinHouseholdSubmit(e)}
                  className="space-y-3"
                >
                  <div>
                    <label
                      htmlFor="familyhub-invite-code"
                      className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Mã ghép đôi gia đình (từ máy vợ/chồng)
                    </label>
                    <input
                      id="familyhub-invite-code"
                      type="text"
                      value={inviteCodeInput}
                      onChange={(e) => setInviteCodeInput(e.target.value.toUpperCase())}
                      placeholder="Ví dụ: MONI-7K9P"
                      className="w-full min-h-[40px] bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold tracking-wider text-slate-800 dark:text-slate-100 uppercase outline-none focus:border-blue-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Khi nhập mã ghép đôi hợp lệ, Profile của bạn sẽ kết nối vào Tổ ấm hiện có và chạy Smart Merge gộp thông minh dữ liệu hai máy (không trùng ID, không mất giao dịch cũ).
                  </p>
                  <button
                    type="submit"
                    disabled={isBusy || !inviteCodeInput.trim()}
                    data-testid="familyhub-join-submit"
                    className="min-h-[40px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isBusy ? "Đang ghép đôi..." : "Kết nối vào Tổ ấm"}</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* STATE D: Connected to Household */}
          {household && (
            <div className="p-4 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/70 space-y-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-[#172B4D] dark:text-slate-100">
                    {household.name}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    · {household.myRole === "OWNER" ? "Chủ hộ (OWNER)" : "Thành viên (PARTNER)"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Đồng bộ Realtime 2 chiều trên 10 bảng dữ liệu (bao gồm Phú Đông SKYONE). Mã PIN &amp; Face ID giữ riêng trên từng thiết bị.
                </p>
              </div>

              {/* Pairing Invite Code + Household ID Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Mã mời ghép đôi (Chia sẻ cho{" "}
                      {household.mySlot === "HUSBAND"
                        ? settings.wifeName
                        : settings.husbandName}
                      )
                    </p>
                    <p className="text-base font-mono font-black tracking-widest text-blue-700 dark:text-blue-400 tabular-nums mt-0.5">
                      {household.inviteCode}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopyText(
                          household.inviteCode,
                          setCopiedInvite,
                          `Đã sao chép mã ghép đôi ${household.inviteCode}`
                        )
                      }
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                    >
                      {copiedInvite ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedInvite ? "Đã chép" : "Chép mã"}</span>
                    </button>

                    {household.myRole === "OWNER" && (
                      <button
                        type="button"
                        onClick={() => void handleRotateInviteCode()}
                        disabled={isBusy}
                        className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-[#DCE4EE] dark:border-slate-700 text-xs font-bold whitespace-nowrap cursor-pointer disabled:opacity-60"
                      >
                        Đổi mã
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Household ID (Liên kết RLS bảng profiles)
                    </p>
                    <p
                      title={household.id}
                      className="text-xs font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums truncate mt-1"
                    >
                      {household.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyText(
                        household.id,
                        setCopiedHouseholdId,
                        "Đã sao chép Household ID."
                      )
                    }
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-[#DCE4EE] dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {copiedHouseholdId ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedHouseholdId ? "Đã chép" : "Chép ID"}</span>
                  </button>
                </div>
              </div>

              {/* Paired Members */}
              <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  Thành viên đã ghép ({household.members.length}):
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {household.members.map((m, idx) => (
                    <React.Fragment key={m.userId}>
                      {idx > 0 && (
                        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                          ·
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
                        <span>{m.memberSlot === "HUSBAND" ? "👨" : "👩"}</span>
                        <span>
                          {m.displayName ||
                            (m.memberSlot === "HUSBAND"
                              ? settings.husbandName
                              : settings.wifeName)}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 font-normal">
                          ({m.role === "OWNER" ? "Chủ hộ" : "Bạn đời"})
                        </span>
                      </span>
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Sync & Leave Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-emerald-200/70 dark:border-emerald-900/50">
                <button
                  type="button"
                  onClick={() => void syncWithCloud()}
                  disabled={isSyncing}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
                  <span>
                    {isSyncing
                      ? "Đang đồng bộ..."
                      : pendingOutboxCount > 0
                      ? `Đẩy ${pendingOutboxCount} thay đổi & Tải về`
                      : "Đồng bộ ngay"}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void pushLocalStateToCloud().then(
                      (ok) => ok && notify("Đã đẩy toàn bộ dữ liệu máy này lên Cloud.")
                    )
                  }
                  disabled={isSyncing}
                  className="min-h-[40px] px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[#DCE4EE] dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Đẩy bản hiện tại lên Cloud</span>
                </button>

                {!confirmLeave ? (
                  <button
                    type="button"
                    onClick={() => setConfirmLeave(true)}
                    className="ml-auto min-h-[40px] px-3 py-2 rounded-lg text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Rời Tổ ấm
                  </button>
                ) : (
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleLeaveHousehold()}
                      disabled={isBusy}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      Xác nhận rời
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmLeave(false)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold whitespace-nowrap cursor-pointer"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Email Provider & Resend SMTP Configuration Guide */}
      <div className="rounded-xl border border-[#E9EEF5] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <button
          type="button"
          aria-expanded={isSmtpGuideOpen}
          data-testid="familyhub-smtp-guide-toggle"
          onClick={() => setIsSmtpGuideOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#172B4D] dark:text-slate-100 truncate">
                Hướng dẫn cấu hình Email Provider (Resend Custom SMTP &amp; Supabase Auth)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Khắc phục giới hạn 2 email/giờ của SMTP mặc định để gửi mail xác nhận ổn định
              </p>
            </div>
          </div>
          {isSmtpGuideOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          )}
        </button>

        {isSmtpGuideOpen && (
          <div
            data-testid="familyhub-smtp-guide-content"
            className="px-4 pb-4 pt-3 border-t border-[#E9EEF5] dark:border-slate-800 space-y-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed"
          >
            <div className="space-y-1.5">
              <p className="font-bold text-[#172B4D] dark:text-slate-100">
                1. Cấu hình Resend Custom SMTP trên Supabase Dashboard
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tại Resend: xác thực tên miền (SPF/DKIM) và tạo API Key (<code className="font-mono">re_...</code>). Sau đó mở{" "}
                <strong>Supabase Dashboard → Authentication → Emails (hoặc Project Settings → Auth → SMTP Settings)</strong>, bật{" "}
                <strong>Enable Custom SMTP</strong> và điền thông số dưới đây (API Key nhập trực tiếp trên Supabase Dashboard, không lưu trên trình duyệt):
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(
                [
                  { key: "host", label: "SMTP Host", value: "smtp.resend.com", copyable: true },
                  { key: "port", label: "Port (Implicit TLS / STARTTLS)", value: "465", note: "hoặc 587", copyable: true },
                  { key: "user", label: "SMTP Username", value: "resend", copyable: true },
                  { key: "redirect", label: "Redirect URL (URL Configuration)", value: appOrigin, copyable: true },
                ] as const
              ).map((item) => (
                <div
                  key={item.key}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-[#E9EEF5] dark:border-slate-700 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="text-xs font-mono font-bold text-[#172B4D] dark:text-slate-100 tabular-nums truncate">
                      {item.value}
                      {"note" in item && item.note ? (
                        <span className="font-sans font-normal text-[11px] text-slate-500 dark:text-slate-400">
                          {" "}
                          ({item.note})
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {item.copyable && (
                    <button
                      type="button"
                      onClick={() => void copyGuideValue(item.key, item.value, item.label)}
                      className="min-h-[32px] px-2.5 py-1 rounded-md bg-white dark:bg-slate-900 border border-[#DCE4EE] dark:border-slate-700 text-[11px] font-bold text-blue-700 dark:text-blue-300 inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer hover:bg-blue-50 dark:hover:bg-slate-800"
                    >
                      {copiedSmtpField === item.key ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedSmtpField === item.key ? "Đã chép" : "Chép"}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <p className="font-bold text-[#172B4D] dark:text-slate-100 text-xs">
                2. Kiểm tra Redirect URL &amp; Kích hoạt nhanh cho gia đình
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li>
                  <strong>URL Configuration:</strong> Vào <strong>Authentication → URL Configuration</strong>, thêm{" "}
                  <code className="font-mono text-blue-600 dark:text-blue-400">{appOrigin}/**</code> vào danh sách{" "}
                  <strong>Redirect URLs</strong> để bấm link xác nhận không bị chuyển nhầm về localhost.
                </li>
                <li>
                  <strong>Sender Email:</strong> Dùng địa chỉ thuộc domain đã verify trên Resend (ví dụ{" "}
                  <code className="font-mono">no-reply@tenmien-cuaban.com</code>), không dùng <code className="font-mono">@gmail.com</code> làm Sender khi gửi qua Resend.
                </li>
                <li>
                  <strong>Xác nhận thủ công tức thì (nếu chỉ dùng 2 vợ chồng):</strong> Vào{" "}
                  <strong>Authentication → Users → menu ⋯ → Confirm user</strong>, hoặc tắt tạm{" "}
                  <strong>Confirm email</strong> tại <strong>Authentication → Providers → Email</strong>.
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
