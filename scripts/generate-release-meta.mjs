/**
 * @file generate-release-meta.mjs
 * @description Script hỗ trợ sinh thông tin phát hành song ngữ (EN / VI) và 2 - 5 điểm đặc trưng nổi bật
 * cho Skill home-moni-ais-git-release kết nối repo https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();
const GITHUB_REPO = 'https://github.com/TrNgclone-lab9262/fin.ais.tracking-moni';
const AI_STUDIO_URL = 'https://app-home-moni.ai.studio';

function getGitStatus() {
  try {
    const isGit = execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' }).toString().trim();
    if (isGit !== 'true') return { isGit: false };

    const statusOutput = execSync('git status --short', { stdio: 'pipe' }).toString().trim();
    const branch = execSync('git branch --show-current', { stdio: 'pipe' }).toString().trim() || 'main';
    const lines = statusOutput ? statusOutput.split('\n') : [];

    return {
      isGit: true,
      branch,
      changedFilesCount: lines.length,
      files: lines,
    };
  } catch {
    return { isGit: false };
  }
}

function getCurrentVersion() {
  const statePath = path.join(ROOT_DIR, 'PROJECT_STATE.md');
  if (fs.existsSync(statePath)) {
    const content = fs.readFileSync(statePath, 'utf-8');
    const match = content.match(/Phiên bản:\*\* `([^`]+)`/);
    if (match) return match[1];
  }
  return 'v1.0.0-foundation';
}

function generateReleaseMeta() {
  const gitInfo = getGitStatus();
  const version = getCurrentVersion();

  console.log('\n=============================================================================');
  console.log('   HOME MONI — AIS GIT RELEASE METADATA GENERATOR (Song Ngữ EN/VI)   ');
  console.log('=============================================================================\n');

  console.log(`📌 KHO LƯU TRỮ GITHUB: ${GITHUB_REPO}`);
  console.log(`🌐 GOOGLE AI STUDIO URL: ${AI_STUDIO_URL}`);
  console.log(`🏷️  PHIÊN BẢN HIỆN TẠI: ${version}\n`);

  if (!gitInfo.isGit) {
    console.log('⚠️  LƯU Ý: Thư mục dự án chưa khởi tạo Git repository (.git chưa tồn tại).');
    console.log('👉 Lệnh khởi tạo một lần duy nhất:');
    console.log('   git init');
    console.log(`   git remote add origin ${GITHUB_REPO}.git\n`);
  } else {
    console.log(`🌿 NHÁNH HIỆN TẠI: ${gitInfo.branch}`);
    console.log(`📦 SỐ LƯỢNG FILE THAY ĐỔI: ${gitInfo.changedFilesCount} files\n`);
  }

  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('📋 [BẢN TRÍCH DẪN ĐỀ XUẤT / PROPOSED COMMIT MESSAGE]');
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log(`[EN] feat(release): release ${version} with vision 2035 and git-flow skill`);
  console.log(`[VI] Phát hành phiên bản ${version} tích hợp tầm nhìn 2035 và skill phát hành mã nguồn`);
  console.log('\n⭐ 2 - 5 ĐIỂM ĐẶC TRƯNG NỔI BẬT:');
  console.log('  1. Nền tảng quản trị tài chính tổ ấm tích hợp song song Google AI Studio & Antigravity.');
  console.log('  2. Chuẩn hóa quy trình phát hành 3 giai đoạn (Conventional Commits, PR CI Check, SemVer Tag).');
  console.log(`  3. Kết nối đồng bộ kho mã nguồn chính thức: ${GITHUB_REPO}.`);
  console.log('  4. Thiết lập lộ trình chiến lược 4 kỷ nguyên tài chính gia đình hiện đại (2026 - 2035).');
  console.log('  5. Bộ bảo vệ 6 Non-Negotiable Invariants giữ toàn vẹn kế toán Event Sourcing và 2 thẻ BIDV.\n');

  const branchName = gitInfo.isGit ? gitInfo.branch : 'main';
  console.log('─────────────────────────────────────────────────────────────────────────────');
  console.log('🔗 URL MỞ PULL REQUEST (GIAI ĐOẠN 2):');
  console.log(`👉 ${GITHUB_REPO}/compare/main...${branchName}?expand=1`);
  console.log('─────────────────────────────────────────────────────────────────────────────\n');
}

generateReleaseMeta();
