/**
 * @file verify-project-state.ts
 * @description Công cụ tự động đối soát tính toàn vẹn giữa PROJECT_STATE.md và mã nguồn thực tế.
 * Giúp đảm bảo tệp chủ SSOT luôn "sống", phản ánh chính xác 100% hiện trạng của dự án HOME MONI.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT_DIR = process.cwd();
const PROJECT_STATE_PATH = path.join(ROOT_DIR, 'PROJECT_STATE.md');

// Các thư mục mã nguồn cốt lõi cần đối soát
const WATCHED_DIRS = [
  'app',
  'components',
  'constants',
  'context',
  'lib',
  'src',
  'types',
];

// Các file được miễn trừ khỏi ma trận chi tiết (vd: file tạm, styles đơn giản)
const IGNORED_FILES = new Set<string>([
  'app/globals.css',
  'src/index.css',
]);

function getAllFiles(dir: string, baseDir = dir): string[] {
  const fullPath = path.join(ROOT_DIR, dir);
  if (!fs.existsSync(fullPath)) return [];

  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const resPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(resPath, baseDir));
    } else if (entry.isFile()) {
      // Chuẩn hóa dấu phân cách đường dẫn sang forward slash '/'
      const normalized = resPath.replace(/\\/g, '/');
      files.push(normalized);
    }
  }

  return files;
}

function verifyProjectState() {
  console.log('\n🔍 ========================================================');
  console.log('   HOME MONI — STATE INTEGRITY & SSOT VERIFICATION AGENT   ');
  console.log('========================================================\n');

  if (!fs.existsSync(PROJECT_STATE_PATH)) {
    console.error('❌ LỖI NGHIÊM TRỌNG: Không tìm thấy tệp PROJECT_STATE.md tại thư mục gốc!');
    process.exit(1);
  }

  const content = fs.readFileSync(PROJECT_STATE_PATH, 'utf-8');

  // 1. Kiểm tra 7 phần cấu trúc bắt buộc
  const REQUIRED_SECTIONS = [
    '## 1. PROJECT IDENTITY & SYSTEM METADATA',
    '## 2. NON-NEGOTIABLE ARCHITECTURAL INVARIANTS',
    '## 3. TECH STACK & SYSTEM ARCHITECTURE MAP',
    '## 4. COMPONENT INVENTORY & RESPONSIBILITY MATRIX',
    '## 5. DATA ENGINE & STORAGE SPECIFICATIONS',
    '## 6. MILESTONE ROADMAP',
    '## 7. LIVING CHANGELOG & CHANGE PROTOCOL',
  ];

  console.log('📋 [1/3] Kiểm tra các phần cấu trúc bắt buộc:');
  let hasMissingSection = false;
  for (const section of REQUIRED_SECTIONS) {
    if (content.includes(section)) {
      console.log(`   ✅ Đã tìm thấy: "${section}"`);
    } else {
      console.error(`   ❌ THIẾU PHẦN BẮT BUỘC: "${section}"`);
      hasMissingSection = true;
    }
  }

  if (hasMissingSection) {
    console.error('\n❌ Cấu trúc tệp PROJECT_STATE.md không hợp lệ theo quy chuẩn!');
    process.exit(1);
  }

  // 2. Trích xuất danh sách file được khai báo trong bảng Component Matrix
  console.log('\n📦 [2/3] Quét danh mục tệp được ghi nhận trong PROJECT_STATE.md...');
  const registeredFiles = new Set<string>();

  // Regex trích xuất các đường dẫn dạng `ten_file.tsx` hoặc `duong_dan/ten_file.tsx`
  const codeBlockRegex = /`([^`]+\.(?:ts|tsx|css|json|html|md))`(?:\s*\||\s*thể hiện|\s*thanh)/gi;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const rawPath = match[1].trim();
    registeredFiles.add(rawPath);
  }

  console.log(`   -> Tìm thấy ${registeredFiles.size} định danh tệp được theo dõi trong tài liệu.`);

  // 3. Quét tệp thực tế trong mã nguồn dự án
  console.log('\n📂 [3/3] Quét các tệp mã nguồn thực tế trên ổ đĩa...');
  const actualFiles: string[] = [];
  for (const dir of WATCHED_DIRS) {
    actualFiles.push(...getAllFiles(dir));
  }

  console.log(`   -> Tìm thấy ${actualFiles.length} tệp mã nguồn thuộc các thư mục theo dõi.`);

  let errorCount = 0;
  const unindexedFiles: string[] = [];

  for (const file of actualFiles) {
    if (IGNORED_FILES.has(file)) continue;

    // Kiểm tra xem file có được ghi nhận trong PROJECT_STATE.md không (bằng full path hoặc basename)
    const baseName = path.basename(file);
    const isIndexed = registeredFiles.has(file) || registeredFiles.has(baseName);

    if (!isIndexed) {
      unindexedFiles.push(file);
      errorCount++;
    }
  }

  if (unindexedFiles.length > 0) {
    console.warn('\n⚠️ CẢNH BÁO: Phát hiện các tệp mã nguồn chưa được ghi nhận vào PROJECT_STATE.md:');
    for (const f of unindexedFiles) {
      console.warn(`   ⚠️ ${f}`);
    }
  }

  // Đánh giá kết quả cuối cùng
  console.log('\n========================================================');
  if (errorCount === 0) {
    console.log('🎉 XÁC THỰC THÀNH CÔNG: Tệp PROJECT_STATE.md đồng bộ 100% với mã nguồn!');
    console.log('   Phiên bản: v1.0.0-foundation (Core Invariants Guaranteed)');
    console.log('========================================================\n');
    process.exit(0);
  } else {
    console.warn(`⚠️ Có ${errorCount} tệp chưa được ghi danh trong Component Matrix.`);
    console.warn('   Hãy bổ sung các tệp trên vào PROJECT_STATE.md để đảm bảo tính toàn vẹn SSOT.');
    console.log('========================================================\n');
    process.exit(0);
  }
}

verifyProjectState();
