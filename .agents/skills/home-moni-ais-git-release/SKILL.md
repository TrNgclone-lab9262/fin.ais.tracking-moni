---
name: home-moni-ais-git-release
description: >-
  Chuẩn quy trình phát hành mã nguồn quốc tế (GitHub Flow + Pre-flight CI + GitHub Actions CI Verification + Conventional Commits + Semantic Versioning Tag) cho dự án HOME MONI phát triển song song trên Google AI Studio (https://app-home-moni.ai.studio) và Google Antigravity. Kích hoạt khi người dùng yêu cầu: "hãy chạy release code", "hãy đẩy lên github", "hãy commit đẩy lên github", "hãy commit và đẩy nhánh lên GitHub", "release code" hoặc "git release".
---

# HOME MONI — AIS GIT RELEASE SKILL (QUY TRÌNH PHÁT HÀNH QUỐC TẾ)

Skill này thực hiện quy trình phát hành mã nguồn chuẩn hóa 3 giai đoạn tinh gọn, thực dụng và an toàn tuyệt đối cho dự án **HOME MONI**, đồng bộ giữa **Google AI Studio** (`https://app-home-moni.ai.studio`) và **Google Antigravity**, kết nối kho lưu trữ GitHub chính thức:
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

## 🛑 QUY TẮC TIÊN QUYẾT: PRE-FLIGHT CI (AGENT CHẠY NGẦM)

Trước khi hiển thị bất kỳ khối lệnh nào cho người dùng, Agent **BẮT BUỘC** phải tự chạy ngầm bộ 3 lệnh kiểm thử chất lượng tại thư mục gốc dự án:

1. `npm run state:verify` (Đảm bảo `PROJECT_STATE.md` đồng bộ 100% với cấu trúc mã nguồn).
2. `npm run lint` (`tsc --noEmit` — Type-check TypeScript đạt 0 lỗi).
3. `npm run build` (`vite build` — Biên dịch Production đạt 0 lỗi).

* **Nếu có bất kỳ lỗi nào xảy ra:**
  * Agent dừng ngay lập tức, báo cáo chính xác thông điệp lỗi (stderr) và đề xuất phương án sửa chữa.
  * Tuyệt đối không xuất lệnh commit/push khi mã nguồn chưa sạch.
* **Khi cả 3 bài kiểm tra đều vượt qua xuất sắc:**
  * Mở đầu Giai đoạn 1 bằng báo cáo kiểm thử trực quan:
    > `Mã nguồn đã được kiểm thử biên dịch ngầm npm run build xuất sắc: 🟢 PASSING (0 errors, build production hoàn tất).`

---

## QUY TRÌNH 3 GIAI ĐOẠN CHI TIẾT

```
┌────────────────────────────────────────────────────────────────────────┐
│                   QUY TRÌNH PHÁT HÀNH CHUẨN 3 GIAI ĐOẠN                │
├─────────────────────┬─────────────────────┬────────────────────────────┤
│ GIAI ĐOẠN 1         │ GIAI ĐOẠN 2         │ GIAI ĐOẠN 3                │
│ Commit & Đẩy Nhánh  │ Mở PR & CI Check    │ Đồng Bộ Main & Gắn Tag     │
├─────────────────────┼─────────────────────┼────────────────────────────┤
│ • Pre-flight ngầm   │ • URL 1-click tạo PR│ • Checkout & pull main     │
│ • Báo cáo 🟢 PASSING │ • Tự điền PR Body   │ • Annotated Tag vX.Y.Z-... │
│ • Conventional Msg  │ • Theo dõi CI xanh  │ • Push Tag lên GitHub      │
│ • Khối lệnh copy    │ • Bấm Merge trên UI │ • Dọn dẹp nhánh tính năng  │
└─────────────────────┴─────────────────────┴────────────────────────────┘
```

---

### GIAI ĐOẠN 1: TẠO NHÁNH TÍNH NĂNG, COMMIT & ĐẨY LÊN GITHUB

#### 1. Báo cáo Pre-flight & Trích dẫn thay đổi song ngữ
Agent xuất phần mở đầu trực quan gồm:
* Trạng thái kiểm thử ngầm (`🟢 PASSING`).
* Tóm tắt 2 - 5 điểm đặc trưng nổi bật của phiên phát hành.
* Đề xuất tên nhánh tính năng (VD: `feat/<tên-tính-năng>` hoặc `fix/<tên-lỗi>`).
* Đề xuất thông điệp commit theo chuẩn Conventional Commits (kèm nội dung mô tả chi tiết bằng Tiếng Việt).

#### 2. Khối lệnh Copy-Paste Giai đoạn 1 (PowerShell)
Agent cung cấp khối lệnh duy nhất để người dùng copy và dán vào terminal PowerShell:

```powershell
# =========================================================================
# GIAI ĐOẠN 1: TẠO NHÁNH, COMMIT & ĐẨY LÊN GITHUB
# =========================================================================

# 1. Tạo và chuyển sang nhánh tính năng mới
git checkout -b <tên-nhánh>

# 2. Kiểm tra trạng thái các file thay đổi
git status -s

# 3. Stage toàn bộ các file cập nhật và cấu hình mới
git add .

# 4. Tạo commit chuẩn Conventional Commits với mô tả Tiếng Việt tinh gọn
git commit -m "<type>(<scope>): <tiêu đề commit ngắn gọn>" -m "- <Điểm đặc trưng nổi bật 1>
- <Điểm đặc trưng nổi bật 2>
- <Điểm đặc trưng nổi bật 3>
- Đã kiểm thử biên dịch ngầm hoàn tất (0 errors, build production pass)"

# 5. Đẩy nhánh mới lên GitHub
git push -u origin <tên-nhánh>
```

---

### GIAI ĐOẠN 2: MỞ PULL REQUEST & KIỂM TRA CI TỰ ĐỘNG TRÊN GITHUB UI

Sau khi người dùng chạy xong khối lệnh Giai đoạn 1, Agent cung cấp hướng dẫn rõ ràng:

#### 1. Đường dẫn 1-Click mở Pull Request trực tiếp
```text
🌐 MỞ LINK TẠO PULL REQUEST TRỰC TIẾP TRÊN TRÌNH DUYỆT:
👉 https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni/compare/main...<tên-nhánh>?expand=1
```

#### 2. Các bước thao tác chuẩn trên GitHub UI
1. **Tạo PR:** Nhấn nút xanh **Create pull request** (Tiêu đề và nội dung checklist đã được hệ thống tự động điền sẵn theo `.github/pull_request_template.md`).
2. **Theo dõi CI:** GitHub Actions (`CI — Lint & Build`) sẽ tự động kích hoạt máy ảo Node.js 20 kiểm thử `npm run state:verify`, `npm run lint` và `npm run build`.
3. **Merge Pull Request:** Khi xuất hiện dấu tick xanh **🟢 All checks have passed**, nhấn nút **Merge pull request** ➔ **Confirm merge** (Khuyến khích chọn *Squash and merge* để giữ lịch sử git gọn gàng).
4. **Xóa nhánh trên GitHub:** Bấm nút **Delete branch** trên trang PR vừa merge.

#### 3. Chờ người dùng xác nhận
> ⏸️ **Agent dừng lại tại đây** và chờ người dùng phản hồi:  
> *"Tôi đã merge PR vào main thành công, hãy tiếp tục Giai đoạn 3."*

---

### GIAI ĐOẠN 3: ĐỒNG BỘ MAIN LOCAL, GẮN TAG SEMVER & DỌN DẸP

Khi nhận được xác nhận merge từ người dùng, Agent chúc mừng và xuất khối lệnh Giai đoạn 3.

#### 1. Quy chuẩn Tag phiên bản (SemVer)
Tuân thủ định dạng chuẩn của dự án HOME MONI:
$$\mathbf{v\langle MAJOR\rangle.\langle MINOR\rangle.\langle PATCH\rangle-\langle CODENAME\rangle}$$
*(Ví dụ: `v1.0.0-foundation`, `v1.1.0-pwa`, `v1.2.0-gemini-ocr`, `v1.3.0-supabase-realtime`,...)*

#### 2. Khối lệnh Copy-Paste Giai đoạn 3 (PowerShell)
```powershell
# =========================================================================
# GIAI ĐOẠN 3: ĐỒNG BỘ MAIN LOCAL & GẮN TAG PHIÊN BẢN CHÍNH THỨC
# =========================================================================

# 1. Chuyển sang nhánh main
git checkout main

# 2. Kéo toàn bộ mã nguồn sạch đã merge từ GitHub về máy
git pull origin main

# 3. Tạo Annotated Tag chính thức kèm thông điệp phát hành
git tag -a <vX.Y.Z-codename> -m "HOME MONI <vX.Y.Z-codename>: <tóm tắt ngắn gọn tính năng>"

# 4. Đẩy Tag lên GitHub để tạo mốc phát hành (Release milestone)
git push origin <vX.Y.Z-codename>

# 5. Dọn dẹp nhánh tính năng local đã merge xong
git branch -d <tên-nhánh>
```

#### 3. Báo cáo hoàn tất
Agent gửi lời chúc mừng phát hành thành công và cập nhật lại `PROJECT_STATE.md` (nếu cần thiết).
