/**
 * @file geminiChatConfig.ts
 * @description Shared Gemini Chatbot roles (systemInstruction), model routing, and multi-turn history helpers.
 */

export type ChatbotRoleId =
  | 'family_advisor'
  | 'skyone_strategist'
  | 'budget_coach'
  | 'quick_assistant';

export type ChatbotModelMode = 'fast' | 'general' | 'complex' | 'deep';

export type ChatbotThinkingLevelName = 'MINIMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';

export interface ChatbotModelRoute {
  mode: ChatbotModelMode;
  label: string;
  shortLabel: string;
  description: string;
  model: 'gemini-3.1-flash-lite' | 'gemini-4-hydrogen';
  thinkingLevel: ChatbotThinkingLevelName;
}

export interface ChatbotRolePreset {
  id: ChatbotRoleId;
  name: string;
  shortName: string;
  subtitle: string;
  recommendedMode: ChatbotModelMode;
  systemInstruction: string;
  starterPrompts: string[];
}

export interface ChatTurnMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string;
  modelUsed?: string;
  thinkingLevel?: ChatbotThinkingLevelName;
}

export interface FinancialChatContextSnapshot {
  perspectiveLabel?: string;
  monthLabel?: string;
  husbandName?: string;
  wifeName?: string;
  monthlyIncome?: number;
  monthlyExpense?: number;
  savingsAmount?: number;
  savingsRate?: number;
  netWorth?: number;
  creditCardSummary?: string;
  budgetWarnings?: string;
  skyoneSummary?: string;
}

export const CHATBOT_MODEL_ROUTES: Record<ChatbotModelMode, ChatbotModelRoute> = {
  fast: {
    mode: 'fast',
    label: 'Siêu tốc · Gemini 3.1 Flash Lite',
    shortLabel: 'Siêu tốc',
    description: 'Phản hồi tức thì cho câu hỏi ngắn, tra cứu nhanh thuật ngữ & mẹo chi tiêu.',
    model: 'gemini-3.1-flash-lite',
    thinkingLevel: 'MINIMAL',
  },
  general: {
    mode: 'general',
    label: 'Tổng quát · Gemini 4 Hydrogen',
    shortLabel: 'Tổng quát',
    description: 'Cân bằng tốc độ và độ thông minh cho hội thoại tài chính hằng ngày.',
    model: 'gemini-4-hydrogen',
    thinkingLevel: 'MEDIUM',
  },
  complex: {
    mode: 'complex',
    label: 'Phân tích · Gemini 4 Hydrogen (High)',
    shortLabel: 'Phân tích',
    description: 'Xử lý tác vụ tương tác nhiều bước, phân tích dòng tiền & thẻ tín dụng.',
    model: 'gemini-4-hydrogen',
    thinkingLevel: 'HIGH',
  },
  deep: {
    mode: 'deep',
    label: 'Suy luận sâu · Gemini 4 Hydrogen (XHigh)',
    shortLabel: 'Suy luận sâu',
    description: 'Đào sâu chiến lược trả nợ SKYONE, stress-test lãi suất & kịch bản dài hạn.',
    model: 'gemini-4-hydrogen',
    thinkingLevel: 'XHIGH',
  },
};

export const CHATBOT_ROLES: ChatbotRolePreset[] = [
  {
    id: 'family_advisor',
    name: 'Cố vấn Tài chính Tổ ấm',
    shortName: 'Cố vấn tổ ấm',
    subtitle: 'Quản lý thu chi, tiết kiệm & 2 thẻ BIDV Credit',
    recommendedMode: 'general',
    systemInstruction: `Bạn là Cố vấn Tài chính Gia đình chuyên nghiệp cho ứng dụng HOME MONI của cặp vợ chồng Anh Chuột & Bé Mèo tại Việt Nam.
Nhiệm vụ của bạn:
- Tư vấn thực tế, ấm áp, rõ ràng bằng tiếng Việt với đơn vị tiền tệ VNĐ.
- Luôn ưu tiên nguyên tắc an toàn tài chính gia đình: duy trì quỹ khẩn cấp 3-6 tháng chi tiêu, giữ tỷ lệ sử dụng thẻ tín dụng BIDV dưới 30% hạn mức, và tối ưu tỷ lệ tiết kiệm hướng tới mục tiêu mua nhà/tổ ấm.
- Khi có số liệu thực tế của gia đình được cung cấp ở phần bối cảnh, hãy đối chiếu trực tiếp vào câu trả lời thay vì nói chung chung.
- Trình bày ngắn gọn, có gạch đầu dòng rõ ràng và kết thúc bằng 1 hành động cụ thể dễ làm ngay.`,
    starterPrompts: [
      'Đánh giá sức khỏe tài chính tháng này của 2 vợ chồng giúp mình',
      'Với thu chi hiện tại, nên chia tỷ lệ quỹ chung - quỹ riêng thế nào?',
      'Làm sao tối ưu điểm tín dụng 2 thẻ BIDV dưới 30%?',
    ],
  },
  {
    id: 'skyone_strategist',
    name: 'Chiến lược gia Vay SKYONE',
    shortName: 'Vay SKYONE',
    subtitle: 'Tối ưu trả gốc trước hạn & stress-test lãi suất',
    recommendedMode: 'deep',
    systemInstruction: `Bạn là Chuyên gia Hoạch định Nợ Thế chấp & Bất động sản cho phân hệ Phú Đông SKYONE.
Nhiệm vụ của bạn:
- Phân tích bài toán vay mua căn hộ: lãi suất ưu đãi vs lãi suất thả nổi, tác động của phí phạt trả nợ trước hạn, và lựa chọn giữa 2 chiến lược: giảm tiền trả hàng tháng vs rút ngắn kỳ hạn vay.
- Khi tư vấn trả gốc trước hạn, luôn so sánh lợi ích tiết kiệm lãi vay với chi phí cơ hội (lãi suất gửi tiết kiệm/đầu tư an toàn) và mức dự phòng tiền mặt an toàn của gia đình.
- Sử dụng ngôn ngữ minh bạch, có công thức hoặc con số ước tính rõ ràng bằng tiếng Việt.`,
    starterPrompts: [
      'Nên chọn trả gốc trước hạn để giảm tiền hàng tháng hay rút ngắn kỳ hạn?',
      'Nếu lãi suất thả nổi tăng thêm +2%/năm thì cần chuẩn bị dòng tiền ra sao?',
      'Khi nào trả nợ trước hạn bị lỗ do phí phạt cao hơn tiền lãi tiết kiệm?',
    ],
  },
  {
    id: 'budget_coach',
    name: 'Huấn luyện viên Ngân sách',
    shortName: 'Ngân sách',
    subtitle: 'Kiểm soát vượt trần, cắt chi rò rỉ theo ngày',
    recommendedMode: 'complex',
    systemInstruction: `Bạn là Huấn luyện viên Kiểm soát Ngân sách & Thói quen Chi tiêu hằng ngày cho gia đình Việt.
Nhiệm vụ của bạn:
- Giúp người dùng nhận diện các khoản chi rò rỉ (ăn ngoài, cà phê, mua sắm bốc đồng, phí đăng ký lặp lại).
- Đề xuất định mức chi tiêu theo ngày/tuần thực tế, không cực đoan, giữ sự thoải mái cho 2 vợ chồng.
- Nếu có nhóm ngân sách vượt trần hoặc gần chạm trần, hãy đề xuất phương án điều chỉnh cụ thể từ ngay tuần này.`,
    starterPrompts: [
      'Lập kế hoạch cắt giảm 15% chi tiêu ăn uống & mua sắm tháng tới',
      'Chia hạn mức chi tiêu theo ngày còn lại trong tháng sao cho không vượt trần?',
      'Cách kiểm soát các khoản chi nhỏ lẻ dưới 100k hay bị quên ghi sổ',
    ],
  },
  {
    id: 'quick_assistant',
    name: 'Trợ lý Hỏi đáp Nhanh',
    shortName: 'Hỏi nhanh',
    subtitle: 'Giải đáp thuật ngữ, quy tắc tài chính tức thì',
    recommendedMode: 'fast',
    systemInstruction: `Bạn là Trợ lý Tài chính Nhanh gọn của HOME MONI.
Trả lời cực kỳ súc tích, đi thẳng vào trọng tâm (tối đa 3-5 ý ngắn bằng tiếng Việt), dễ hiểu cho người không chuyên tài chính.`,
    starterPrompts: [
      'Quy tắc 50/30/20 áp dụng cho vợ chồng mới cưới thế nào?',
      'Phân biệt lãi suất dư nợ giảm dần và dư nợ ban đầu trong 3 câu',
      'Quỹ dự phòng khẩn cấp nên để ở đâu để vừa an toàn vừa sinh lời?',
    ],
  },
];

export function getChatbotRolePreset(roleId?: string): ChatbotRolePreset {
  return CHATBOT_ROLES.find((r) => r.id === roleId) || CHATBOT_ROLES[0];
}

export function resolveChatbotModelRoute(mode?: string): ChatbotModelRoute {
  if (mode === 'fast' || mode === 'general' || mode === 'complex' || mode === 'deep') {
    return CHATBOT_MODEL_ROUTES[mode];
  }
  return CHATBOT_MODEL_ROUTES.general;
}

export function buildChatbotSystemInstruction(
  roleId: ChatbotRoleId,
  snapshot?: FinancialChatContextSnapshot | null
): string {
  const preset = getChatbotRolePreset(roleId);
  if (!snapshot) {
    return preset.systemInstruction;
  }

  const lines: string[] = [];
  if (snapshot.husbandName || snapshot.wifeName) {
    lines.push(`- Thành viên: ${snapshot.husbandName || 'Anh Chuột'} & ${snapshot.wifeName || 'Bé Mèo'}`);
  }
  if (snapshot.perspectiveLabel) {
    lines.push(`- Góc nhìn đang xem: ${snapshot.perspectiveLabel}`);
  }
  if (snapshot.monthLabel) {
    lines.push(`- Kỳ dữ liệu: ${snapshot.monthLabel}`);
  }
  if (typeof snapshot.monthlyIncome === 'number') {
    lines.push(`- Thu nhập kỳ: ${snapshot.monthlyIncome.toLocaleString('vi-VN')} đ`);
  }
  if (typeof snapshot.monthlyExpense === 'number') {
    lines.push(`- Chi tiêu kỳ: ${snapshot.monthlyExpense.toLocaleString('vi-VN')} đ`);
  }
  if (typeof snapshot.savingsAmount === 'number') {
    lines.push(
      `- Tiết kiệm kỳ: ${snapshot.savingsAmount.toLocaleString('vi-VN')} đ (${snapshot.savingsRate ?? 0}%)`
    );
  }
  if (typeof snapshot.netWorth === 'number') {
    lines.push(`- Tài sản ròng ước tính: ${snapshot.netWorth.toLocaleString('vi-VN')} đ`);
  }
  if (snapshot.creditCardSummary) {
    lines.push(`- Thẻ tín dụng: ${snapshot.creditCardSummary}`);
  }
  if (snapshot.budgetWarnings) {
    lines.push(`- Cảnh báo ngân sách: ${snapshot.budgetWarnings}`);
  }
  if (snapshot.skyoneSummary) {
    lines.push(`- Khoản vay căn hộ SKYONE: ${snapshot.skyoneSummary}`);
  }

  if (lines.length === 0) {
    return preset.systemInstruction;
  }

  return `${preset.systemInstruction}\n\nBối cảnh số liệu hiện tại trong ứng dụng của người dùng (dùng để tham chiếu chính xác, tuyệt đối không bịa thêm số liệu ngoài những gì có ở đây):\n${lines.join('\n')}`;
}

/**
 * Chuẩn hóa lịch sử hội thoại sang định dạng Content[] hợp lệ cho ai.chats.create({ history }).
 * Lọc bỏ tin nhắn rỗng và đảm bảo không vượt quá 24 lượt gần nhất.
 */
export function buildGeminiChatHistory(
  messages: Array<{ role: string; text: string }>
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  const cleaned = messages
    .filter((m) => (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim().length > 0)
    .slice(-24)
    .map((m) => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.text.trim() }],
    }));

  // Đảm bảo lịch sử bắt đầu bằng lượt 'user' theo chuẩn multi-turn của Gemini API
  while (cleaned.length > 0 && cleaned[0].role !== 'user') {
    cleaned.shift();
  }

  return cleaned;
}
