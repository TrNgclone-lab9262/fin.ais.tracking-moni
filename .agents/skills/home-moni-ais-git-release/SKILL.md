---
name: home-moni-ais-git-release
description: >-
  Chuẩn quy trình phát hành mã nguồn quốc tế (GitHub Flow + CI Verification + Conventional Commits + Semantic Versioning Tag + CI/CD Trigger) cho dự án HOME MONI phát triển song song trên Google AI Studio (https://app-home-moni.ai.studio) và Google Antigravity. Kích hoạt khi người dùng yêu cầu: "hãy chạy release code", "hãy đẩy lên github", "hãy commit đẩy lên github", "hãy commit và đẩy nhánh lên GitHub", "release code" hoặc "git release".
---

# HOME MONI — AIS GIT RELEASE SKILL (QUY TRÌNH PHÁT HÀNH QUỐC TẾ)

Skill này thực hiện quy trình phát hành mã nguồn chuẩn hóa 3 giai đoạn cho dự án **HOME MONI**, đồng bộ giữa **Google AI Studio** (`https://app-home-moni.ai.studio`) và **Google Antigravity**, kết nối kho lưu trữ GitHub chính thức:
👉 **Repository:** `https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni`

---

## TRIGGER PHRASES (CÁC KHẨU LỆNH KÍCH HOẠT)
Agent tự động kích hoạt skill này khi người dùng đưa ra các yêu cầu như:
* *"hãy chạy release code"*
* *"hãy đẩy lên github"*
* *"hãy commit đẩy lên github"*
* *"hãy commit và đẩy nhánh lên GitHub"*
* *"release code"* hoặc *"git release"*

---

## QUY TRÌNH 3 GIAI ĐOẠN CHI TIẾT

```
┌────────────────────────────────────────────────────────────────────────┐
│                   QUY TRÌNH PHÁT HÀNH CHUẨN 3 GIAI ĐOẠN                │
├─────────────────────┬─────────────────────┬────────────────────────────┤
│ GIAI ĐOẠN 1         │ GIAI ĐOẠN 2         │ GIAI ĐOẠN 3                │
│ Commit & Push       │ PR & CI Check       │ Local Sync & SemVer Tag    │
├─────────────────────┼─────────────────────┼────────────────────────────┤
│ • Pre-flight check  │ • URL 1-click mở PR │ • Checkout & pull main     │
│ • Trích dẫn song ngữ│ • PR Template chuẩn │ • Tạo Tag vX.Y.Z-<codename>│
│ • 2-5 Điểm đặc trưng│ • User merge GitHub │ • Push Tag kích hoạt CI    │
│ • Khối lệnh terminal│ • Xác nhận hoàn tất │ • Báo cáo Release hoàn tất │
└─────────────────────┴─────────────────────┴────────────────────────────┘
```

---

### GIAI ĐOẠN 1: COMMIT & ĐẨY NHÁNH LÊN GITHUB (LOCAL PRE-FLIGHT & PUSH)

#### Bước 1.1: Agent tự động kiểm tra trạng thái
Khi kích hoạt, Agent thực thi:
1. Chạy `npm run state:verify` để đảm bảo `PROJECT_STATE.md` đồng bộ $100\%$ với mã nguồn.
2. Kiểm tra trạng thái Git (`git status --short`, `git branch --show-current`).
   * *Lưu ý:* Nếu kho mã nguồn chưa có `.git`, Agent hướng dẫn kèm lệnh `git init` và kết nối remote.

#### Bước 1.2: Trích dẫn Song ngữ & 2 - 5 Điểm Đặc Trưng Nổi Bật
Agent tự động xuất thông tin tóm tắt có cấu trúc:
```text
📋 [BẢN TRÍCH DẪN THAY ĐỔI MÃ NGUỒN / CHANGES SUMMARY]
─────────────────────────────────────────────────────────────────────────────
• Kho lưu trữ GitHub: https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni
• Môi trường phát triển: Google AI Studio (https://app-home-moni.ai.studio) & Antigravity
• Số lượng tệp thay đổi: <X> files

• Đề xuất Conventional Commit Message:
  [EN] <type>(<scope>): <thông điệp tiếng Anh chuẩn quốc tế>
  [VI] <Bản dịch tiếng Việt tinh gọn, súc tích>

⭐ 2 - 5 ĐIỂM ĐẶC TRƯNG NỔI BẬT CỦA BẢN PHÁT HÀNH:
  1. <Điểm đặc trưng 1>
  2. <Điểm đặc trưng 2>
  3. <Điểm đặc trưng 3>
─────────────────────────────────────────────────────────────────────────────
❓ Bạn muốn đẩy code lên nhánh nào?
   [1] Sử dụng nhánh hiện tại: "<tên-nhánh-hiện-tại>"
   [2] Tạo và chuyển sang nhánh mới (VD: "feat/<tên-tính-năng>" hoặc "fix/<lỗi>")
```

#### Bước 1.3: Cung cấp khối lệnh Terminal Copy-Paste Linh Hoạt
Agent tạo sẵn khối mã lệnh để người dùng copy chạy hoặc duyệt cho Agent thực thi:

```powershell
# =========================================================================
# GIAI ĐOẠN 1: KHỞI TẠO (NẾU CHƯA CÓ) VÀ ĐẨY NHÁNH LÊN GITHUB
# =========================================================================

# (Tùy chọn: Chỉ chạy lần đầu tiên nếu máy chưa khởi tạo Git)
# git init
# git remote add origin https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni.git

# 1. Chuyển sang nhánh làm việc
git checkout -b <tên-nhánh> 2>$null || git checkout <tên-nhánh>

# 2. Thêm toàn bộ thay đổi và commit theo chuẩn quốc tế
git add .
git commit -m "<Conventional-Commit-Message>"

# 3. Đẩy nhánh lên GitHub
git push -u origin <tên-nhánh>
```

---

### GIAI ĐOẠN 2: MỞ PULL REQUEST & KIỂM TRA CI TỰ ĐỘNG (GITHUB PR & CI)

#### Bước 2.1: Cung cấp Đường dẫn 1-Click mở PR
Sau khi code được đẩy lên nhánh ở Giai đoạn 1, Agent xuất ngay liên kết trực tiếp:

```text
🔗 NHẤN VÀO LINK DƯỚI ĐÂY ĐỂ MỞ PULL REQUEST TRÊN GITHUB:
👉 https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni/compare/main...<tên-nhánh>?expand=1
```

#### Bước 2.2: Cung cấp Mẫu Nội dung PR (PR Template)
```markdown
## 📌 Tóm Tắt Bản Phát Hành (Release Summary)
- Phiên bản hệ thống: <vX.Y.Z-codename>
- Môi trường song song: Google AI Studio (https://app-home-moni.ai.studio) & Antigravity
- Loại cập nhật: [Feature / Fix / Chore / Refactor]

### ⭐ Điểm Đặc Trưng Nổi Bật:
1. <Điểm 1>
2. <Điểm 2>
3. <Điểm 3>

## ✅ Checklist Kiểm Tra Chất Lượng (CI Verification)
- [x] npm run state:verify (Pass 100% SSOT Integrity)
- [x] npm run lint (Pass 0 errors)
- [x] npm run build (Pass 0 errors)
- [x] Tuân thủ 6 Non-Negotiable Invariants trong PROJECT_STATE.md
```

#### Bước 2.3: Chờ Xác Nhận Từ Người Dùng
Người dùng thực hiện review và merge Pull Request trên GitHub. Sau khi merge xong, người dùng xác nhận lại với Agent:
> *"Tôi đã merge PR vào main thành công, hãy tiếp tục Giai đoạn 3."*

---

### GIAI ĐOẠN 3: CẬP NHẬT MAIN LOCAL & ĐÁNH DẤU TAG PHIÊN BẢN (SEMVER RELEASE)

#### Bước 3.1: Quy Chuẩn Đặt Tên Tag Phiên Bản (SemVer Standard)
Tuân thủ nghiêm ngặt định dạng chuẩn hiện tại của dự án HOME MONI:
$$\text{Tag Format: } \mathbf{v\langle MAJOR\rangle.\langle MINOR\rangle.\langle PATCH\rangle-\langle CODENAME\rangle}$$
* Ví dụ danh mục chuẩn hóa:
  * `v1.0.0-foundation` (Nền tảng cốt lõi hoàn chỉnh)
  * `v1.1.0-pwa` (Cài đặt PWA trên iPhone/Android)
  * `v1.2.0-gemini-ocr` (Quét hóa đơn AI Vision)
  * `v1.3.0-supabase-realtime` (Đám mây thời gian thực 2 vợ chồng)
  * `v2.0.0-openbanking` (Tự động hóa Ngân hàng mở 2027)

#### Bước 3.2: Cung cấp khối lệnh Terminal Copy-Paste Giai đoạn 3
Agent xuất khối lệnh:

```powershell
# =========================================================================
# GIAI ĐOẠN 3: ĐỒNG BỘ MAIN TẠI LOCAL VÀ TẠO TAG PHIÊN BẢN QUỐC TẾ
# =========================================================================

# 1. Chuyển về nhánh main và kéo mã nguồn mới nhất sau khi merge PR
git checkout main
git pull origin main

# 2. Đánh dấu Git Tag có chú thích (Annotated SemVer Tag)
git tag -a <vX.Y.Z-codename> -m "release: <thông điệp phiên bản>"

# 3. Đẩy Tag lên GitHub để kích hoạt CI/CD Release
git push origin <vX.Y.Z-codename>
```

#### Bước 3.3: Báo Cáo Hoàn Tất
Agent thông báo hoàn tất chu trình phát hành quốc tế, cập nhật lại trạng thái trong `PROJECT_STATE.md`.
