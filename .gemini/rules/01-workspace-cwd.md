# Workspace Working Directory Rule

## Quy tắc bắt buộc
- **Working directory mặc định** của dự án này LUÔN LUÔN là: `D:\NTT-2026\dev.app\fin.ais.tracking-moni`
- Khi agent chạy bất kỳ lệnh `run_command` nào, thư mục làm việc phải là đường dẫn trên (trừ khi người dùng chỉ định rõ ràng khác).
- Mọi lệnh `git`, `pnpm`, `npm`, `bun`, `vite`, `tsc` đều phải chạy tại `D:\NTT-2026\dev.app\fin.ais.tracking-moni`.

## Lý do
Dự án HOME MONI có source code thực tại `D:\NTT-2026\dev.app\fin.ais.tracking-moni`, KHÔNG phải tại workspace nội bộ của Antigravity.
