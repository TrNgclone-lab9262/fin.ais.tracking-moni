import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  APP_BUILD_ID,
  APP_VERSION,
  CURRENT_RELEASE,
} from './constants/appVersion';
import {
  FinancialInsightsRequestSchema,
  GoldReferenceQuerySchema,
  MonthlyDigestRequestSchema,
  ParseTransactionRequestSchema,
  ScanBoqQuoteRequestSchema,
  ScanGoldInvoiceRequestSchema,
  ScanLoanStatementRequestSchema,
  ScanReceiptRequestSchema,
  SkyOneStrategyRequestSchema,
  SlidingWindowRateLimiter,
  SpendingForecastRequestSchema,
  buildApiError,
  formatZodApiError,
} from './lib/apiSchemas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SERVER_STARTED_AT = Date.now();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-4-hydrogen';
const GEMINI_TEXT_TIMEOUT_MS = 18_000;
const GEMINI_VISION_TIMEOUT_MS = 28_000;
const GOLD_CACHE_FILE = path.join(os.tmpdir(), 'home-moni-gold-reference-cache-v1.json');

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

class GeminiTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`GEMINI_TIMEOUT_AFTER_${timeoutMs}MS`);
    this.name = 'GeminiTimeoutError';
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new GeminiTimeoutError(timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function createRateLimitMiddleware(
  limiter: SlidingWindowRateLimiter,
  scope: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const key = `${scope}:${getClientIp(req)}`;
    const decision = limiter.check(key);
    res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      res.status(429).json(
        buildApiError(
          'RATE_LIMITED',
          `Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau ${decision.retryAfterSeconds} giây.`,
          { fallbackAvailable: false }
        )
      );
      return;
    }
    next();
  };
}

function mapGeminiUpstreamError(
  err: unknown,
  defaultMessage: string
): { status: number; body: ReturnType<typeof buildApiError> } {
  if (err instanceof GeminiTimeoutError) {
    return {
      status: 504,
      body: buildApiError(
        'GEMINI_TIMEOUT',
        'Máy chủ Gemini AI phản hồi quá thời gian cho phép. Vui lòng thử lại sau giây lát.',
        { fallbackAvailable: false }
      ),
    };
  }
  const rawMsg = err instanceof Error ? err.message : String(err);
  if (
    rawMsg.includes('403') ||
    rawMsg.includes('PERMISSION_DENIED') ||
    rawMsg.includes('API_KEY_INVALID')
  ) {
    return {
      status: 403,
      body: buildApiError(
        'GEMINI_AUTH_ERROR',
        'Khóa GEMINI_API_KEY không hợp lệ hoặc chưa được cấp quyền. Vui lòng kiểm tra trong Settings > Secrets.',
        { fallbackAvailable: false }
      ),
    };
  }
  if (rawMsg.includes('429') || rawMsg.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      body: buildApiError(
        'GEMINI_RATE_LIMIT',
        'Đã chạm giới hạn lượt gọi Gemini API. Vui lòng thử lại sau ít phút.',
        { fallbackAvailable: false }
      ),
    };
  }
  return {
    status: 502,
    body: buildApiError('GEMINI_REQUEST_FAILED', defaultMessage, { fallbackAvailable: false }),
  };
}

interface GoldReferenceResponse {
  source: 'SERVER_REFERENCE';
  mode: 'LIVE_FEED' | 'BENCHMARK_FALLBACK';
  tier: 'WORLD_XAU_CALIBRATED' | 'BENCHMARK_FALLBACK';
  fetchedAt: string;
  cacheAgeSeconds: number;
  note: string;
  calibration: {
    nhanPremiumPct: number;
    sjcPremiumPct: number;
    nhanSpreadVnd: number;
    sjcSpreadVnd: number;
  };
  macro: {
    worldXauUsdPerOz: number;
    usdVndRate: number;
  };
  quotes: {
    NHAN_9999: { brandLabel: string; buyPricePerChi: number; sellPricePerChi: number };
    SJC_BAR: { brandLabel: string; buyPricePerChi: number; sellPricePerChi: number };
    GOLD_24K_JEWELRY: { brandLabel: string; buyPricePerChi: number; sellPricePerChi: number };
    GOLD_18K: { brandLabel: string; buyPricePerChi: number; sellPricePerChi: number };
    DIGITAL_GOLD: { brandLabel: string; buyPricePerChi: number; sellPricePerChi: number };
  };
}

interface GoldFeedCacheFile {
  expiresAt: number;
  fetchedAtMs: number;
  worldXauUsdPerOz: number;
  usdVndRate: number;
  mode: 'LIVE_FEED' | 'BENCHMARK_FALLBACK';
}

function buildGoldReferencePayload(
  base: {
    worldXauUsdPerOz: number;
    usdVndRate: number;
    mode: 'LIVE_FEED' | 'BENCHMARK_FALLBACK';
    fetchedAtMs: number;
  },
  calibration: {
    nhanPremiumPct: number;
    sjcPremiumPct: number;
    nhanSpreadVnd: number;
    sjcSpreadVnd: number;
  },
  nowMs: number
): GoldReferenceResponse {
  const worldPerChi =
    Math.round(((base.worldXauUsdPerOz * base.usdVndRate * 1.205653027) / 10) / 10000) * 10000;
  const nhanSell =
    Math.round((worldPerChi * (1 + calibration.nhanPremiumPct / 100)) / 10000) * 10000;
  const nhanBuy = Math.max(1_000_000, nhanSell - Math.round(calibration.nhanSpreadVnd / 10000) * 10000);
  const sjcSell =
    Math.round((worldPerChi * (1 + calibration.sjcPremiumPct / 100)) / 10000) * 10000;
  const sjcBuy = Math.max(1_000_000, sjcSell - Math.round(calibration.sjcSpreadVnd / 10000) * 10000);
  const gold24Sell = Math.max(1_000_000, nhanSell - 50_000);
  const gold24Buy = Math.max(1_000_000, gold24Sell - 250_000);
  const gold18Sell = Math.round((worldPerChi * 0.77) / 10000) * 10000;
  const gold18Buy = Math.max(1_000_000, gold18Sell - 380_000);
  const digitalSell = nhanSell;
  const digitalBuy = Math.max(1_000_000, digitalSell - 150_000);

  return {
    source: 'SERVER_REFERENCE',
    mode: base.mode,
    tier: base.mode === 'LIVE_FEED' ? 'WORLD_XAU_CALIBRATED' : 'BENCHMARK_FALLBACK',
    fetchedAt: new Date(base.fetchedAtMs).toISOString(),
    cacheAgeSeconds: Math.max(0, Math.round((nowMs - base.fetchedAtMs) / 1000)),
    note:
      base.mode === 'LIVE_FEED'
        ? `Quy đổi từ XAU/USD & USD/VND quốc tế + biên độ nội địa hiệu chỉnh (Nhẫn 9999 +${calibration.nhanPremiumPct}%, SJC +${calibration.sjcPremiumPct}%).`
        : 'Giá tham chiếu chuẩn thị trường VN (có thể hiệu chỉnh biên độ nội địa hoặc nhập tay theo hóa đơn PNJ/SJC/BTMC).',
    calibration,
    macro: {
      worldXauUsdPerOz: base.worldXauUsdPerOz,
      usdVndRate: base.usdVndRate,
    },
    quotes: {
      NHAN_9999: {
        brandLabel: 'Nhẫn trơn 9999 (PNJ/SJC/BTMC)',
        buyPricePerChi: nhanBuy,
        sellPricePerChi: nhanSell,
      },
      SJC_BAR: {
        brandLabel: 'Vàng miếng SJC 9999',
        buyPricePerChi: sjcBuy,
        sellPricePerChi: sjcSell,
      },
      GOLD_24K_JEWELRY: {
        brandLabel: 'Vàng 24K Trang sức',
        buyPricePerChi: gold24Buy,
        sellPricePerChi: gold24Sell,
      },
      GOLD_18K: {
        brandLabel: 'Vàng 18K (750)',
        buyPricePerChi: gold18Buy,
        sellPricePerChi: gold18Sell,
      },
      DIGITAL_GOLD: {
        brandLabel: 'Vàng tích lũy / eGold',
        buyPricePerChi: digitalBuy,
        sellPricePerChi: digitalSell,
      },
    },
  };
}

async function readDiskGoldCache(): Promise<GoldFeedCacheFile | null> {
  try {
    const raw = await fs.readFile(GOLD_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<GoldFeedCacheFile>;
    if (
      typeof parsed.expiresAt === 'number' &&
      typeof parsed.fetchedAtMs === 'number' &&
      typeof parsed.worldXauUsdPerOz === 'number' &&
      typeof parsed.usdVndRate === 'number' &&
      (parsed.mode === 'LIVE_FEED' || parsed.mode === 'BENCHMARK_FALLBACK')
    ) {
      return parsed as GoldFeedCacheFile;
    }
  } catch {
    // Ignore missing or unreadable disk cache
  }
  return null;
}

async function writeDiskGoldCache(data: GoldFeedCacheFile): Promise<void> {
  try {
    await fs.writeFile(GOLD_CACHE_FILE, JSON.stringify(data), 'utf-8');
  } catch {
    // Best-effort persistent cache
  }
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '12mb' }));

  // Security headers (giữ tương thích AI Studio preview iframe trên HTML, gắn X-Frame-Options cho /api/*)
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    if (req.path.startsWith('/api/')) {
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    }
    if (req.path === '/sw.js' || req.path === '/index.html') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  const lightApiLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 120 });
  const aiApiLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 25 });

  const GOLD_CACHE_TTL_MS = 15 * 60 * 1000;
  let cachedGoldFeed: GoldFeedCacheFile | null = await readDiskGoldCache();

  app.get('/api/health', createRateLimitMiddleware(lightApiLimiter, 'health'), (_req, res) => {
    const hasKey = Boolean(
      process.env.GEMINI_API_KEY &&
        process.env.GEMINI_API_KEY.trim() !== '' &&
        process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'
    );
    const now = Date.now();
    res.json({
      ok: true,
      aiConfigured: hasKey,
      model: GEMINI_MODEL,
      appVersion: APP_VERSION,
      buildId: APP_BUILD_ID,
      uptimeSeconds: Math.floor((now - SERVER_STARTED_AT) / 1000),
      goldFeed: {
        cached: Boolean(cachedGoldFeed),
        mode: cachedGoldFeed?.mode ?? null,
        cacheAgeSeconds: cachedGoldFeed
          ? Math.max(0, Math.round((now - cachedGoldFeed.fetchedAtMs) / 1000))
          : null,
      },
    });
  });

  // PWA Version Manifest Endpoint (luôn bỏ qua cache để thiết bị di động nhận biết bản mới tức thì)
  app.get('/api/app-version', createRateLimitMiddleware(lightApiLimiter, 'version'), async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const candidates = [
      path.resolve(__dirname, 'public', 'version.json'),
      path.resolve(__dirname, 'dist', 'version.json'),
    ];

    for (const filePath of candidates) {
      try {
        const raw = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return res.json(parsed);
      } catch {
        // Thử đường dẫn tiếp theo
      }
    }

    return res.json({
      version: CURRENT_RELEASE.version,
      buildId: CURRENT_RELEASE.buildId,
      releasedAt: CURRENT_RELEASE.releasedAt,
      title: CURRENT_RELEASE.title,
      mandatory: Boolean(CURRENT_RELEASE.mandatory),
      highlights: CURRENT_RELEASE.highlights,
    });
  });

  // Đảm bảo tệp Service Worker và version.json không bao giờ bị browser/CDN cache cứng
  app.use((req, res, next) => {
    if (req.path === '/sw.js' || req.path === '/version.json') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  // Áp dụng Rate Limiter chuyên biệt cho toàn bộ nhóm tuyến AI
  app.use('/api/ai/', createRateLimitMiddleware(aiApiLimiter, 'ai'));

  // 0. GET /api/gold/reference-prices — Giá vàng tham khảo VN (có hiệu chỉnh biên độ nội địa & cache bền vững)
  app.get(
    '/api/gold/reference-prices',
    createRateLimitMiddleware(lightApiLimiter, 'gold'),
    async (req, res) => {
      const queryParsed = GoldReferenceQuerySchema.safeParse(req.query);
      if (!queryParsed.success) {
        return res.status(400).json(formatZodApiError(queryParsed.error));
      }

      const {
        force,
        nhanPremiumPct = 3.5,
        sjcPremiumPct = 6.0,
        nhanSpreadVnd = 180_000,
        sjcSpreadVnd = 220_000,
      } = queryParsed.data;

      const calibration = {
        nhanPremiumPct,
        sjcPremiumPct,
        nhanSpreadVnd,
        sjcSpreadVnd,
      };

      const forceRefresh = force === '1';
      const now = Date.now();
      if (!forceRefresh && cachedGoldFeed && cachedGoldFeed.expiresAt > now) {
        return res.json(buildGoldReferencePayload(cachedGoldFeed, calibration, now));
      }

      let worldXauUsdPerOz = cachedGoldFeed?.worldXauUsdPerOz ?? 2780;
      let usdVndRate = cachedGoldFeed?.usdVndRate ?? 25450;
      let mode: 'LIVE_FEED' | 'BENCHMARK_FALLBACK' = 'BENCHMARK_FALLBACK';

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const [xauRes, fxRes] = await Promise.allSettled([
          fetch('https://api.gold-api.com/price/XAU', { signal: controller.signal }),
          fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal }),
        ]);
        clearTimeout(timer);

        let gotLive = false;
        if (xauRes.status === 'fulfilled' && xauRes.value.ok) {
          const xauJson = (await xauRes.value.json()) as { price?: number };
          if (typeof xauJson.price === 'number' && xauJson.price > 1500 && xauJson.price < 15000) {
            worldXauUsdPerOz = Math.round(xauJson.price * 10) / 10;
            gotLive = true;
          }
        }
        if (fxRes.status === 'fulfilled' && fxRes.value.ok) {
          const fxJson = (await fxRes.value.json()) as { rates?: { VND?: number } };
          const vnd = fxJson.rates?.VND;
          if (typeof vnd === 'number' && vnd > 20000 && vnd < 38000) {
            usdVndRate = Math.round(vnd);
            gotLive = true;
          }
        }
        if (gotLive) {
          mode = 'LIVE_FEED';
        }
      } catch {
        // Fallback giữ giá gần nhất / benchmark an toàn
      }

      cachedGoldFeed = {
        expiresAt: now + GOLD_CACHE_TTL_MS,
        fetchedAtMs: now,
        worldXauUsdPerOz,
        usdVndRate,
        mode,
      };
      void writeDiskGoldCache(cachedGoldFeed);

      return res.json(buildGoldReferencePayload(cachedGoldFeed, calibration, now));
    }
  );

  // 1. POST /api/ai/scan-receipt — Multimodal Receipt OCR + Itemized Split Suggestions
  app.post('/api/ai/scan-receipt', async (req, res) => {
    const parsedReq = ScanReceiptRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ...buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ, chuyển sang chế độ mẫu.',
          { fallbackAvailable: true }
        ),
        source: 'fallback',
        reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const { imageBase64, mimeType, categories } = parsedReq.data;

      const categoryList = categories
        .filter((c) => c.type === 'EXPENSE')
        .map((c) => `- "${c.id}": ${c.name}`)
        .join('\n');

      const prompt = `Bạn là chuyên gia kế toán gia đình Việt Nam cho HOME MONI.
Hãy đọc ảnh hóa đơn/biên lai đính kèm và trích xuất thông tin tài chính chuẩn xác:
- amount: Tổng số tiền thanh toán cuối cùng (số nguyên dương VNĐ).
- date: Ngày thanh toán YYYY-MM-DD (nếu thiếu năm thì dùng năm hiện tại).
- merchantName: Tên cửa hàng/nhà hàng/siêu thị.
- suggestedCategoryId: Chọn mã ID phù hợp nhất từ danh sách danh mục sau:
${categoryList || '- "cat_expense_food": Ăn uống\n- "cat_expense_shopping": Mua sắm\n- "cat_expense_transport": Đi lại\n- "cat_expense_bills": Hóa đơn\n- "cat_expense_health": Sức khỏe\n- "cat_expense_rent": Tiền nhà\n- "cat_expense_entertainment": Giải trí\n- "cat_expense_other": Chi phí khác'}
- items: Danh sách các mặt hàng chính nếu đọc được (tên món, giá tiền VNĐ, và gợi ý suggestedCategoryId cho từng món để người dùng có thể tách hóa đơn).
- notes: Tóm tắt ngắn gọn bằng tiếng Việt.
- confidence: Độ tin cậy từ 0.0 đến 1.0.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                amount: { type: Type.NUMBER },
                date: { type: Type.STRING },
                merchantName: { type: Type.STRING },
                suggestedCategoryId: { type: Type.STRING },
                notes: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      price: { type: Type.NUMBER },
                      suggestedCategoryId: { type: Type.STRING },
                    },
                    required: ['name', 'price'],
                  },
                },
              },
              required: ['amount', 'date', 'merchantName', 'suggestedCategoryId', 'confidence'],
            },
          },
        }),
        GEMINI_VISION_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
      return res.json({
        ok: true,
        source: 'gemini',
        result: {
          amount: Math.abs(Number(parsed.amount) || 0),
          date:
            typeof parsed.date === 'string' && parsed.date
              ? parsed.date
              : new Date().toISOString().slice(0, 10),
          merchantName:
            typeof parsed.merchantName === 'string' && parsed.merchantName
              ? parsed.merchantName
              : 'Hóa đơn tiêu dùng',
          suggestedCategoryId:
            typeof parsed.suggestedCategoryId === 'string' && parsed.suggestedCategoryId
              ? parsed.suggestedCategoryId
              : 'cat_expense_food',
          items: Array.isArray(parsed.items) ? parsed.items : [],
          notes: typeof parsed.notes === 'string' ? parsed.notes : '',
          confidence: Number(parsed.confidence) || 0.9,
        },
      });
    } catch (err) {
      console.error('[AI Scan Receipt Error]', err);
      const mapped = mapGeminiUpstreamError(err, 'Không thể bóc tách hóa đơn bằng Gemini AI.');
      return res.json({
        ...mapped.body,
        fallbackAvailable: true,
        source: 'fallback',
        reason: mapped.body.code,
      });
    }
  });

  // 1b. POST /api/ai/scan-gold-invoice — Multimodal Vietnamese Gold Invoice / Certificate OCR
  app.post('/api/ai/scan-gold-invoice', async (req, res) => {
    const parsedReq = ScanGoldInvoiceRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ...buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ.',
          { fallbackAvailable: true }
        ),
        source: 'fallback',
        reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const { imageBase64, mimeType } = parsedReq.data;

      const prompt = `Bạn là chuyên gia kiểm định và kế toán vàng vật chất Việt Nam cho HOME MONI.
Hãy đọc ảnh hóa đơn mua vàng / giấy đảm bảo vàng đính kèm (PNJ, SJC, DOJI, Bảo Tín Minh Châu, Phú Quý, Mi Hồng...) và trích xuất thông tin chuẩn xác:
- category: Chọn 1 trong 5 mã: "NHAN_9999" (nhẫn tròn trơn 9999/24K/ép vỉ), "SJC_BAR" (vàng miếng SJC), "GOLD_24K_JEWELRY" (trang sức 24K/9999), "GOLD_18K" (vàng 18K/750/610), "DIGITAL_GOLD" (vàng tích lũy eGold).
- brand: Thương hiệu / quy cách ngắn gọn (VD: "PNJ Nhẫn trơn 9999", "SJC Miếng 1 lượng", "DOJI Hưng Thịnh Vượng").
- purchaseDate: Ngày mua định dạng YYYY-MM-DD (nếu thiếu dùng ngày hôm nay ${new Date().toISOString().slice(0, 10)}).
- quantityChi: Tổng khối lượng quy đổi ra ĐƠN VỊ CHỈ (số dương, 1 lượng = 10 chỉ, 1 phân = 0.1 chỉ, 3.75 gram = 1 chỉ).
- unitBuyPricePerChi: Đơn giá mua thực tế cho 1 CHỈ (VNĐ, số nguyên dương; nếu hóa đơn ghi giá 1 lượng thì chia 10; nếu chỉ có thành tiền chưa công thì chia cho quantityChi).
- makingFee: Tổng tiền công / phí gia công / phí ép vỉ (VNĐ, số nguyên >= 0, mặc định 0 nếu không tách riêng).
- serialNumber: Số seri vỉ / miếng vàng nếu có in trên giấy (chuỗi rỗng nếu không có).
- certificateCode: Mã hóa đơn / số phiếu / số giấy đảm bảo (chuỗi rỗng nếu không có).
- storeName: Tên cửa hàng / chi nhánh tiệm vàng (chuỗi rỗng nếu không rõ).
- purityLabel: Tuổi vàng / hàm lượng (VD: "999.9 (24K)", "99.99%", "750 (18K)").
- invoiceNote: Ghi chú ngắn gọn tiếng Việt tóm tắt quy cách/tình trạng vỉ.
- confidence: Độ tin cậy từ 0.0 đến 1.0.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                category: { type: Type.STRING },
                brand: { type: Type.STRING },
                purchaseDate: { type: Type.STRING },
                quantityChi: { type: Type.NUMBER },
                unitBuyPricePerChi: { type: Type.NUMBER },
                makingFee: { type: Type.NUMBER },
                serialNumber: { type: Type.STRING },
                certificateCode: { type: Type.STRING },
                storeName: { type: Type.STRING },
                purityLabel: { type: Type.STRING },
                invoiceNote: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
              },
              required: [
                'category',
                'brand',
                'purchaseDate',
                'quantityChi',
                'unitBuyPricePerChi',
                'confidence',
              ],
            },
          },
        }),
        GEMINI_VISION_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
      const allowedCategories = new Set([
        'NHAN_9999',
        'SJC_BAR',
        'GOLD_24K_JEWELRY',
        'GOLD_18K',
        'DIGITAL_GOLD',
      ]);
      const category =
        typeof parsed.category === 'string' && allowedCategories.has(parsed.category)
          ? parsed.category
          : 'NHAN_9999';
      const rawQty = Number(parsed.quantityChi);
      const rawUnitPrice = Number(parsed.unitBuyPricePerChi);
      const rawMakingFee = Number(parsed.makingFee);

      return res.json({
        ok: true,
        source: 'gemini',
        result: {
          category,
          brand: String(parsed.brand || 'Nhẫn trơn 9999').trim(),
          purchaseDate:
            typeof parsed.purchaseDate === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(parsed.purchaseDate)
              ? parsed.purchaseDate
              : new Date().toISOString().slice(0, 10),
          quantityChi: Number.isFinite(rawQty) && rawQty > 0 ? Math.round(rawQty * 1000) / 1000 : 1,
          unitBuyPricePerChi:
            Number.isFinite(rawUnitPrice) && rawUnitPrice > 0 ? Math.round(rawUnitPrice) : 0,
          makingFee: Number.isFinite(rawMakingFee) && rawMakingFee > 0 ? Math.round(rawMakingFee) : 0,
          serialNumber: typeof parsed.serialNumber === 'string' ? parsed.serialNumber.trim() : '',
          certificateCode:
            typeof parsed.certificateCode === 'string' ? parsed.certificateCode.trim() : '',
          storeName: typeof parsed.storeName === 'string' ? parsed.storeName.trim() : '',
          purityLabel: typeof parsed.purityLabel === 'string' ? parsed.purityLabel.trim() : '',
          invoiceNote: typeof parsed.invoiceNote === 'string' ? parsed.invoiceNote.trim() : '',
          confidence: Number(parsed.confidence) || 0.85,
        },
      });
    } catch (err) {
      console.error('[AI Scan Gold Invoice Error]', err);
      const mapped = mapGeminiUpstreamError(err, 'Không thể đọc hóa đơn vàng lúc này.');
      return res.json({
        ...mapped.body,
        fallbackAvailable: true,
        source: 'fallback',
        reason: mapped.body.code,
      });
    }
  });

  // 2. POST /api/ai/parse-transaction — Natural Language Quick Entry Parser
  app.post('/api/ai/parse-transaction', async (req, res) => {
    const parsedReq = ParseTransactionRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ...buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY, dùng bộ phân tích ngoại tuyến.',
          { fallbackAvailable: true }
        ),
        source: 'fallback',
        reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const { text, accounts, categories, today } = parsedReq.data;

      const accLines = accounts
        .map((a) => `- "${a.id}": ${a.name} (owner=${a.owner}, type=${a.type})`)
        .join('\n');
      const catLines = categories
        .map((c) => `- "${c.id}": ${c.name} (${c.type})`)
        .join('\n');

      const prompt = `Phân tích câu mô tả giao dịch tiếng Việt của gia đình Anh Chuột (HUSBAND) & Bé Mèo (WIFE).
Hôm nay là ${today || new Date().toISOString().slice(0, 10)}.
Câu nhập: "${text}"

Danh sách tài khoản:
${accLines}

Danh sách danh mục:
${catLines}

Trả về mảng các giao dịch bóc tách được (hỗ trợ nhiều giao dịch trong 1 câu nếu có, ví dụ "ăn phở 100k và đổ xăng 50k"). Quy đổi k = 1.000, tr/m = 1.000.000.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                transactions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      amount: { type: Type.NUMBER },
                      date: { type: Type.STRING },
                      type: { type: Type.STRING, enum: ['INCOME', 'EXPENSE', 'TRANSFER'] },
                      categoryId: { type: Type.STRING },
                      accountId: { type: Type.STRING },
                      memberId: { type: Type.STRING, enum: ['HUSBAND', 'WIFE', 'SHARED'] },
                      scope: { type: Type.STRING, enum: ['FAMILY', 'PERSONAL'] },
                      note: { type: Type.STRING },
                    },
                    required: ['amount', 'type', 'categoryId', 'memberId', 'scope', 'note'],
                  },
                },
              },
              required: ['transactions'],
            },
          },
        }),
        GEMINI_TEXT_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as { transactions?: unknown[] };
      return res.json({
        ok: true,
        source: 'gemini',
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
      });
    } catch (err) {
      console.error('[AI Parse Transaction Error]', err);
      const mapped = mapGeminiUpstreamError(err, 'Không thể phân tích câu giao dịch bằng AI.');
      return res.json({
        ...mapped.body,
        fallbackAvailable: true,
        source: 'fallback',
        reason: mapped.body.code,
      });
    }
  });

  // 3. POST /api/ai/monthly-digest — Couple Monthly Financial Advisor Digest
  app.post('/api/ai/monthly-digest', async (req, res) => {
    const parsedReq = MonthlyDigestRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        ...buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY, sử dụng tóm tắt ngoại tuyến.',
          { fallbackAvailable: true }
        ),
        source: 'fallback',
        reason: 'GEMINI_API_KEY_NOT_CONFIGURED',
      });
    }

    try {
      const { monthLabel, summary, topCategories, creditCards, budgetOverruns } = parsedReq.data;

      const prompt = `Bạn là cố vấn tài chính thân thiện của gia đình trẻ Anh Chuột & Bé Mèo.
Dữ liệu kỳ ${monthLabel}:
- Thu nhập: ${summary.monthlyIncome.toLocaleString('vi-VN')} đ
- Chi tiêu: ${summary.monthlyExpense.toLocaleString('vi-VN')} đ
- Tiết kiệm: ${summary.savingsAmount.toLocaleString('vi-VN')} đ (${summary.savingsRate}%)
- Tài sản ròng: ${summary.netWorth.toLocaleString('vi-VN')} đ
- Top danh mục chi: ${topCategories.map((c) => `${c.name} (${c.percentage}%)`).join(', ') || 'Chưa có'}
- Thẻ tín dụng BIDV: ${creditCards.map((c) => `${c.name}: ${c.usagePercentage}%`).join(', ')}
- Danh mục vượt/gần trần: ${budgetOverruns.join(', ') || 'Không có'}

Hãy viết nhận xét ngắn gọn, thực tế, mang tính động viên bằng tiếng Việt gồm: headline (1 câu), highlights (2-3 gạch đầu dòng ngắn), actionTip (1 lời khuyên hành động cụ thể cho 2 vợ chồng).`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                highlights: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                actionTip: { type: Type.STRING },
              },
              required: ['headline', 'highlights', 'actionTip'],
            },
          },
        }),
        GEMINI_TEXT_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}');
      return res.json({
        ok: true,
        source: 'gemini',
        digest: parsed,
      });
    } catch (err) {
      console.error('[AI Monthly Digest Error]', err);
      const mapped = mapGeminiUpstreamError(err, 'Không thể tạo tổng kết tháng bằng AI.');
      return res.json({
        ...mapped.body,
        fallbackAvailable: true,
        source: 'fallback',
        reason: mapped.body.code,
      });
    }
  });

  // 4. POST /api/ai/financial-insights — Monthly Spending Pattern Analysis & 3 Actionable Saving Tips
  app.post('/api/ai/financial-insights', async (req, res) => {
    const parsedReq = FinancialInsightsRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json(
        buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong Settings > Secrets.'
        )
      );
    }

    try {
      const {
        monthLabel,
        perspectiveLabel,
        totalIncome,
        totalExpense,
        savingsRate,
        previousMonthExpense,
        categoryBreakdown,
        topMerchants,
        recurringTotal,
        discretionaryTotal,
        recentTransactions,
        budgetOverruns,
        creditCards,
      } = parsedReq.data;

      if (totalExpense <= 0) {
        return res
          .status(400)
          .json(
            buildApiError(
              'NO_TRANSACTIONS',
              'Chưa có giao dịch chi tiêu trong kỳ này để Gemini phân tích.'
            )
          );
      }

      const categoryLines = categoryBreakdown
        .slice(0, 8)
        .map((c) => {
          const prevInfo =
            typeof c.prevAmount === 'number' && c.prevAmount > 0
              ? ` (tháng trước: ${c.prevAmount.toLocaleString('vi-VN')} đ)`
              : '';
          return `- ${c.name}: ${c.amount.toLocaleString('vi-VN')} đ (${c.percentage}%)${prevInfo}`;
        })
        .join('\n');

      const merchantLines = topMerchants
        .slice(0, 8)
        .map((m) => `- "${m.label}": ${m.count} lần, tổng ${m.totalAmount.toLocaleString('vi-VN')} đ`)
        .join('\n');

      const txLines = recentTransactions
        .slice(0, 25)
        .map(
          (t) =>
            `- ${t.date} | ${t.category} | ${t.amount.toLocaleString('vi-VN')} đ | ${t.scope} | ${t.note}`
        )
        .join('\n');

      const momDeltaPct =
        previousMonthExpense > 0
          ? Math.round(((totalExpense - previousMonthExpense) / previousMonthExpense) * 100)
          : null;

      const prompt = `Phân tích xu hướng chi tiêu tháng và đề xuất đúng 3 mẹo tiết kiệm cụ thể, khả thi bằng tiếng Việt cho gia đình HOME MONI.

Thông tin kỳ phân tích:
- Kỳ: ${monthLabel} (${perspectiveLabel})
- Tổng thu nhập: ${totalIncome.toLocaleString('vi-VN')} đ
- Tổng chi tiêu: ${totalExpense.toLocaleString('vi-VN')} đ${momDeltaPct !== null ? ` (thay đổi ${momDeltaPct >= 0 ? '+' : ''}${momDeltaPct}% so với tháng trước ${previousMonthExpense.toLocaleString('vi-VN')} đ)` : ''}
- Tỷ lệ tiết kiệm: ${savingsRate}%
- Chi cố định/định kỳ: ${recurringTotal.toLocaleString('vi-VN')} đ | Chi linh hoạt: ${discretionaryTotal.toLocaleString('vi-VN')} đ
- Thẻ tín dụng: ${creditCards.map((c) => `${c.name} (${c.usagePercentage}%)`).join(', ') || 'Không có'}
- Danh mục vượt/gần ngân sách: ${budgetOverruns.join(', ') || 'Không có'}

Cơ cấu chi theo danh mục:
${categoryLines || 'Chưa phân loại'}

Các khoản chi lặp lại / nổi bật:
${merchantLines || 'Không có dữ liệu'}

Mẫu giao dịch gần đây:
${txLines || 'Không có'}

Yêu cầu đầu ra JSON:
1. patternSummary: 1-2 câu súc tích chỉ ra thói quen/mô hình chi tiêu nổi bật nhất trong lịch sử giao dịch trên.
2. comparisonNote: 1 câu nhận xét ngắn về biến động chi tiêu so với tháng trước hoặc cơ cấu cố định vs linh hoạt.
3. tips: ĐÚNG 3 mẹo tiết kiệm thực tế bám sát trực tiếp các danh mục/khoản chi cụ thể ở trên. Mỗi mẹo gồm:
   - title: Tiêu đề hành động ngắn gọn (tối đa 10 từ).
   - action: Hướng dẫn cụ thể phải làm gì và cắt giảm ở khoản nào (1-2 câu).
   - targetCategory: Tên danh mục chi tiêu liên quan.
   - estimatedMonthlySavings: Số tiền ước tính tiết kiệm được mỗi tháng (VNĐ, số nguyên dương hợp lý với dữ liệu).`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là chuyên gia phân tích tài chính cá nhân cho gia đình Việt Nam. Luôn trả về JSON đúng schema với đúng 3 mẹo tiết kiệm thực tế dựa trên dữ liệu giao dịch được cung cấp, không bịa đặt số liệu ngoài ngữ cảnh.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                patternSummary: { type: Type.STRING },
                comparisonNote: { type: Type.STRING },
                tips: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      action: { type: Type.STRING },
                      targetCategory: { type: Type.STRING },
                      estimatedMonthlySavings: { type: Type.NUMBER },
                    },
                    required: ['title', 'action', 'targetCategory', 'estimatedMonthlySavings'],
                  },
                },
              },
              required: ['patternSummary', 'comparisonNote', 'tips'],
            },
          },
        }),
        GEMINI_TEXT_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as {
        patternSummary?: string;
        comparisonNote?: string;
        tips?: {
          title?: string;
          action?: string;
          targetCategory?: string;
          estimatedMonthlySavings?: number;
        }[];
      };

      const rawTips = Array.isArray(parsed.tips) ? parsed.tips.slice(0, 3) : [];
      if (rawTips.length === 0 || !parsed.patternSummary) {
        return res
          .status(502)
          .json(
            buildApiError(
              'GEMINI_INVALID_OUTPUT',
              'Phản hồi từ Gemini AI chưa đầy đủ cấu trúc. Vui lòng thử phân tích lại.'
            )
          );
      }

      return res.json({
        ok: true,
        insights: {
          patternSummary: parsed.patternSummary,
          comparisonNote: parsed.comparisonNote || '',
          tips: rawTips.map((t) => ({
            title: String(t.title || 'Tối ưu chi tiêu'),
            action: String(t.action || ''),
            targetCategory: String(t.targetCategory || 'Chi tiêu chung'),
            estimatedMonthlySavings: Math.max(
              0,
              Math.round(Number(t.estimatedMonthlySavings) || 0)
            ),
          })),
        },
      });
    } catch (err) {
      console.error('[AI Financial Insights Error]', err);
      const mapped = mapGeminiUpstreamError(
        err,
        'Không thể kết nối Gemini AI để phân tích dữ liệu chi tiêu. Vui lòng thử lại sau.'
      );
      return res.status(mapped.status).json(mapped.body);
    }
  });

  // 5. POST /api/ai/spending-forecast — 3-Month Spending Forecast Narrative & Recommendations
  app.post('/api/ai/spending-forecast', async (req, res) => {
    const parsedReq = SpendingForecastRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json(
        buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong Settings > Secrets.'
        )
      );
    }

    try {
      const {
        anchorMonthLabel,
        perspectiveLabel,
        monthsAnalyzed,
        historicalAvgIncome,
        historicalAvgExpense,
        recurringExpenseBaseline,
        discretionaryExpenseBaseline,
        monthlyGrowthRatePct,
        forecastMonths,
        topDrivers,
        budgetWarnings,
        creditCards,
      } = parsedReq.data;

      const forecastLines = forecastMonths
        .slice(0, 3)
        .map(
          (m) =>
            `- ${m.monthLabel} (${m.month}): Thu dự kiến ${m.predictedIncome.toLocaleString('vi-VN')} đ | Chi dự kiến ${m.predictedExpense.toLocaleString('vi-VN')} đ (Cố định: ${m.recurringExpense.toLocaleString('vi-VN')} đ, Linh hoạt: ${m.discretionaryExpense.toLocaleString('vi-VN')} đ) | Tiết kiệm dự kiến: ${m.projectedSavings.toLocaleString('vi-VN')} đ (${m.savingsRate}%) [${m.riskLabel}]`
        )
        .join('\n');

      const driverLines = topDrivers
        .slice(0, 5)
        .map(
          (d) =>
            `- ${d.categoryName}: TB ${d.avgMonthlyAmount.toLocaleString('vi-VN')} đ/tháng (${d.sharePct}%${d.isRecurringDominant ? ', có khoản định kỳ' : ''})`
        )
        .join('\n');

      const prompt = `Hãy đóng vai chuyên gia cố vấn tài chính gia đình Việt Nam, nhận xét dự báo xu hướng chi tiêu 3 tháng tiếp theo bằng tiếng Việt cho gia đình HOME MONI.

Ngữ cảnh lịch sử (từ Financial Insights):
- Kỳ neo hiện tại: ${anchorMonthLabel} (${perspectiveLabel})
- Số tháng dữ liệu lịch sử đã phân tích: ${monthsAnalyzed} tháng
- Trung bình lịch sử: Thu ${historicalAvgIncome.toLocaleString('vi-VN')} đ/tháng | Chi ${historicalAvgExpense.toLocaleString('vi-VN')} đ/tháng
- Định kỳ cố định hàng tháng: ${recurringExpenseBaseline.toLocaleString('vi-VN')} đ | Nền chi linh hoạt: ${discretionaryExpenseBaseline.toLocaleString('vi-VN')} đ (biến động ${monthlyGrowthRatePct}%/tháng)
- Thẻ tín dụng BIDV: ${creditCards.map((c) => `${c.name} (${c.usagePercentage}%)`).join(', ') || 'Không có'}
- Danh mục ngân sách gần/vượt ngưỡng: ${budgetWarnings.join(', ') || 'Không có'}

Các nhóm chi dẫn dắt từ lịch sử:
${driverLines || 'Chưa có phân bổ chi tiết'}

Số liệu dự báo 3 tháng tới:
${forecastLines}

Yêu cầu đầu ra JSON:
1. headline: 1 câu tiêu đề súc tích tóm tắt triển vọng dòng tiền 3 tháng tới.
2. overallTrend: 2 câu nhận xét ngắn gọn về xu hướng chi cố định vs linh hoạt, rủi ro bội chi hoặc cơ hội tích lũy dựa trên số liệu trên.
3. monthlyNotes: Mảng đúng 3 phần tử tương ứng từng tháng dự báo (+1, +2, +3), mỗi phần tử gồm:
   - month: mã YYYY-MM đúng như đầu vào
   - focus: 1 cụm từ ngắn (tối đa 8 từ) về trọng tâm tháng đó (VD: "Kiểm soát ăn uống cuối năm")
   - advice: 1 câu gợi ý cụ thể cho tháng đó.
4. savingActions: Mảng 2-3 gạch đầu dòng hành động cụ thể giúp tối ưu phần chi linh hoạt hoặc gia tăng tiết kiệm trong 3 tháng tới.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là cố vấn tài chính gia đình tại Việt Nam. Luôn trả về JSON đúng schema dựa trên số liệu dự báo đã tính, không bịa đặt con số ngoài dữ liệu được cung cấp.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                headline: { type: Type.STRING },
                overallTrend: { type: Type.STRING },
                monthlyNotes: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      month: { type: Type.STRING },
                      focus: { type: Type.STRING },
                      advice: { type: Type.STRING },
                    },
                    required: ['month', 'focus', 'advice'],
                  },
                },
                savingActions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: ['headline', 'overallTrend', 'monthlyNotes', 'savingActions'],
            },
          },
        }),
        GEMINI_TEXT_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as {
        headline?: string;
        overallTrend?: string;
        monthlyNotes?: { month?: string; focus?: string; advice?: string }[];
        savingActions?: string[];
      };

      if (!parsed.headline || !parsed.overallTrend || !Array.isArray(parsed.monthlyNotes)) {
        return res
          .status(502)
          .json(
            buildApiError(
              'GEMINI_INVALID_OUTPUT',
              'Phản hồi dự báo từ Gemini AI chưa đầy đủ cấu trúc. Vui lòng thử lại.'
            )
          );
      }

      return res.json({
        ok: true,
        forecastInsights: {
          headline: String(parsed.headline),
          overallTrend: String(parsed.overallTrend),
          monthlyNotes: parsed.monthlyNotes.slice(0, 3).map((n, idx) => ({
            month: String(n.month || forecastMonths[idx]?.month || ''),
            focus: String(n.focus || 'Theo dõi dòng tiền'),
            advice: String(n.advice || ''),
          })),
          savingActions: Array.isArray(parsed.savingActions)
            ? parsed.savingActions.slice(0, 3).map((a) => String(a))
            : [],
        },
      });
    } catch (err) {
      console.error('[AI Spending Forecast Error]', err);
      const mapped = mapGeminiUpstreamError(
        err,
        'Không thể kết nối Gemini AI để nhận xét dự báo 3 tháng. Vui lòng thử lại sau.'
      );
      return res.status(mapped.status).json(mapped.body);
    }
  });

  // 6. POST /api/ai/scan-loan-statement — SKYONE BIDV Loan Statement / Interest Rate Notice OCR
  app.post('/api/ai/scan-loan-statement', async (req, res) => {
    const parsedReq = ScanLoanStatementRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json(
        buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong Settings > Secrets.'
        )
      );
    }

    try {
      const { imageBase64, mimeType, currentPeriodHint, currentBalanceVnd } = parsedReq.data;

      const prompt = `Bạn là chuyên gia tín dụng bất động sản ngân hàng BIDV Việt Nam cho hệ thống HOME MONI (căn hộ Phú Đông SKYONE).
Hãy đọc ảnh/PDF thông báo thu nợ gốc lãi, sao kê vay hoặc thông báo điều chỉnh lãi suất đính kèm và trích xuất chính xác JSON:
- documentType: Chọn 1 trong 3: "PAYMENT_RECEIPT" (biên lai/thông báo thu nợ kỳ), "RATE_ADJUSTMENT" (thông báo đổi lãi suất thả nổi/ưu đãi), "DISBURSEMENT" (giải ngân mới).
- period: Số thứ tự kỳ trả nợ nếu đọc được (số nguyên dương; nếu không rõ dùng gợi ý kỳ hiện tại ${currentPeriodHint ?? 1}).
- paymentDate: Ngày thu nợ / ngày chứng từ dạng YYYY-MM-DD (mặc định ${new Date().toISOString().slice(0, 10)}).
- principalPaidVnd: Tiền gốc đã thu/phải thu trong kỳ (VNĐ, số nguyên >= 0).
- interestPaidVnd: Tiền lãi đã thu/phải thu trong kỳ (VNĐ, số nguyên >= 0).
- totalPaidVnd: Tổng tiền gốc + lãi thu trong kỳ (VNĐ, số nguyên >= 0).
- newInterestRatePct: Lãi suất áp dụng (%/năm, VD: 8.5 hoặc 10.2; đặt 0 nếu không đề cập).
- effectiveFromDate: Ngày hiệu lực lãi suất mới dạng YYYY-MM-DD (chuỗi rỗng nếu không đề cập).
- remainingBalanceVnd: Dư nợ gốc còn lại sau kỳ (VNĐ, số nguyên >= 0; gợi ý hiện tại ${currentBalanceVnd ?? 0}).
- bankNote: Tóm tắt ngắn gọn nội dung chứng từ bằng tiếng Việt (tối đa 160 ký tự).
- confidence: Độ tin cậy từ 0.0 đến 1.0.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                documentType: {
                  type: Type.STRING,
                  enum: ['PAYMENT_RECEIPT', 'RATE_ADJUSTMENT', 'DISBURSEMENT'],
                },
                period: { type: Type.INTEGER },
                paymentDate: { type: Type.STRING },
                principalPaidVnd: { type: Type.NUMBER },
                interestPaidVnd: { type: Type.NUMBER },
                totalPaidVnd: { type: Type.NUMBER },
                newInterestRatePct: { type: Type.NUMBER },
                effectiveFromDate: { type: Type.STRING },
                remainingBalanceVnd: { type: Type.NUMBER },
                bankNote: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
              },
              required: ['documentType', 'paymentDate', 'bankNote', 'confidence'],
            },
          },
        }),
        GEMINI_VISION_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
      const principalPaidVnd = Math.max(0, Math.round(Number(parsed.principalPaidVnd) || 0));
      const interestPaidVnd = Math.max(0, Math.round(Number(parsed.interestPaidVnd) || 0));
      const totalPaidVnd =
        Math.max(0, Math.round(Number(parsed.totalPaidVnd) || 0)) ||
        principalPaidVnd + interestPaidVnd;

      return res.json({
        ok: true,
        source: 'gemini',
        result: {
          documentType:
            parsed.documentType === 'RATE_ADJUSTMENT' || parsed.documentType === 'DISBURSEMENT'
              ? parsed.documentType
              : 'PAYMENT_RECEIPT',
          period: Math.max(1, Math.round(Number(parsed.period) || currentPeriodHint || 1)),
          paymentDate:
            typeof parsed.paymentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.paymentDate)
              ? parsed.paymentDate
              : new Date().toISOString().slice(0, 10),
          principalPaidVnd,
          interestPaidVnd,
          totalPaidVnd,
          newInterestRatePct: Math.max(
            0,
            Math.round((Number(parsed.newInterestRatePct) || 0) * 100) / 100
          ),
          effectiveFromDate:
            typeof parsed.effectiveFromDate === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(parsed.effectiveFromDate)
              ? parsed.effectiveFromDate
              : '',
          remainingBalanceVnd: Math.max(0, Math.round(Number(parsed.remainingBalanceVnd) || 0)),
          bankNote: String(parsed.bankNote || 'Chứng từ khoản vay BIDV SKYONE').trim(),
          confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.85)),
        },
      });
    } catch (err) {
      console.error('[AI Scan Loan Statement Error]', err);
      const mapped = mapGeminiUpstreamError(
        err,
        'Không thể đọc thông báo khoản vay BIDV bằng Gemini AI lúc này.'
      );
      return res.status(mapped.status).json(mapped.body);
    }
  });

  // 7. POST /api/ai/skyone-strategy — Cross-App Strategy (SKYONE Prepayment vs GOLD vs FINANCE Cash)
  app.post('/api/ai/skyone-strategy', async (req, res) => {
    const parsedReq = SkyOneStrategyRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json(
        buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong Settings > Secrets.'
        )
      );
    }

    try {
      const d = parsedReq.data;
      const prompt = `Bạn là Giám đốc Hoạch định Gia sản (Private Wealth Strategist) tư vấn cho 2 vợ chồng Anh Chuột & Bé Mèo về bài toán phân bổ vốn liên thông 4 Sub-App HOME MONI.

Số liệu thực tế hiện tại:
- Khoản vay BĐS (${d.projectName}): Dư nợ còn lại ${d.remainingBalanceVnd.toLocaleString('vi-VN')} đ | Lãi suất hiện tại ${d.currentInterestRatePct}%/năm | Lãi thả nổi dự kiến ${d.projectedFloatingRatePct}%/năm | Còn ${d.remainingMonths} tháng | Đóng hàng tháng ~${d.monthlyPaymentVnd.toLocaleString('vi-VN')} đ | Phí phạt trả gốc trước hạn hiện hành ${d.prepaymentPenaltyPct}%.
- Sức khỏe tín dụng: DTI ${d.dtiPct.toFixed(1)}% | Vốn chủ sở hữu Equity ${d.equityPct.toFixed(1)}%.
- Thanh khoản tiền mặt (FINANCE): Số dư ví/ngân hàng ròng ${d.liquidCashVnd.toLocaleString('vi-VN')} đ | Thặng dư dòng tiền tháng ~${d.monthlyNetSurplusVnd.toLocaleString('vi-VN')} đ.
- Kho Tích Sản Vàng (GOLD): Tổng ${d.goldTotalChi.toFixed(2)} chỉ | Định giá bán ngay (Bid) ${d.goldBidValueVnd.toLocaleString('vi-VN')} đ | Lãi/lỗ chưa chốt ${d.goldUnrealizedPnlVnd.toLocaleString('vi-VN')} đ.
- Dự toán Nội thất bàn giao Q3/2027 (INTERIOR): Còn cần chuẩn bị ${d.interiorBudgetRemainingVnd.toLocaleString('vi-VN')} đ.
- Số vốn dự kiến cân nhắc hành động: ${d.targetExtraPrepayVnd.toLocaleString('vi-VN')} đ.

Hãy phân tích rõ ràng, sắc bén bằng tiếng Việt và trả về JSON:
- recommendedAction: Chọn 1 trong 4: "PREPAY_SKYONE", "HOLD_GOLD_AND_CASH", "HYBRID_SPLIT", "RESERVE_FOR_INTERIOR".
- headline: 1 câu kết luận chiến lược rõ ràng.
- rationale: 2-3 câu giải thích lý do dựa trực tiếp trên chênh lệch lãi vay + phí phạt vs thanh khoản vàng & nhu cầu nội thất Q3/2027.
- allocationPlan: Mảng 3 phương án phân bổ cụ thể (bucket, amountVnd, reason).
- riskWarnings: Mảng 2-3 lưu ý rủi ro (DTI, lãi thả nổi, trượt giá nội thất hoặc chênh lệch mua-bán vàng).
- nextStepChecklist: Mảng 3 bước hành động cụ thể trong 30-90 ngày tới.`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction:
              'Bạn là cố vấn tài chính gia đình chuyên nghiệp tại Việt Nam. Luôn trả JSON đúng schema, bám chặt con số được cung cấp, tuyệt đối không bịa thêm tài sản không có.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                recommendedAction: {
                  type: Type.STRING,
                  enum: [
                    'PREPAY_SKYONE',
                    'HOLD_GOLD_AND_CASH',
                    'HYBRID_SPLIT',
                    'RESERVE_FOR_INTERIOR',
                  ],
                },
                headline: { type: Type.STRING },
                rationale: { type: Type.STRING },
                allocationPlan: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      bucket: { type: Type.STRING },
                      amountVnd: { type: Type.NUMBER },
                      reason: { type: Type.STRING },
                    },
                    required: ['bucket', 'amountVnd', 'reason'],
                  },
                },
                riskWarnings: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                nextStepChecklist: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'recommendedAction',
                'headline',
                'rationale',
                'allocationPlan',
                'riskWarnings',
                'nextStepChecklist',
              ],
            },
          },
        }),
        GEMINI_TEXT_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
      if (typeof parsed.headline !== 'string' || typeof parsed.rationale !== 'string') {
        return res
          .status(502)
          .json(
            buildApiError(
              'GEMINI_INVALID_OUTPUT',
              'Phản hồi chiến lược SKYONE từ Gemini AI chưa hợp lệ.'
            )
          );
      }

      return res.json({
        ok: true,
        source: 'gemini',
        strategy: parsed,
      });
    } catch (err) {
      console.error('[AI SkyOne Strategy Error]', err);
      const mapped = mapGeminiUpstreamError(
        err,
        'Không thể tạo phân tích chiến lược SKYONE bằng Gemini AI lúc này.'
      );
      return res.status(mapped.status).json(mapped.body);
    }
  });

  // 8. POST /api/ai/scan-boq-quote — INTERIOR Contractor BOQ Quotation OCR & Variance Comparison
  app.post('/api/ai/scan-boq-quote', async (req, res) => {
    const parsedReq = ScanBoqQuoteRequestSchema.safeParse(req.body);
    if (!parsedReq.success) {
      return res.status(400).json(formatZodApiError(parsedReq.error));
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json(
        buildApiError(
          'AI_NOT_CONFIGURED',
          'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Vui lòng thiết lập khóa API trong Settings > Secrets.'
        )
      );
    }

    try {
      const { imageBase64, mimeType, scenarioName, existingItems } = parsedReq.data;
      const refLines = existingItems
        .slice(0, 40)
        .map(
          (item) =>
            `- ${item.name} [phòng=${item.roomId}]: dự toán ${item.estimatedVnd.toLocaleString('vi-VN')} đ`
        )
        .join('\n');

      const prompt = `Bạn là Kỹ sư QS Dự toán Nội thất căn hộ chung cư Việt Nam (căn hộ Phú Đông SKYONE A.12A.07, phương án "${scenarioName}").
Hãy đọc ảnh/PDF báo giá thi công nội thất đính kèm và bóc tách từng hạng mục chuẩn xác để đối chiếu với dự toán hiện tại:

Danh mục dự toán hiện tại của gia đình:
${refLines || 'Chưa có danh mục tham chiếu'}

Yêu cầu trích xuất JSON:
- vendorName: Tên đơn vị/xưởng thi công (nếu thấy trên báo giá).
- quoteDate: Ngày báo giá dạng YYYY-MM-DD (mặc định ${new Date().toISOString().slice(0, 10)}).
- totalQuotedVnd: Tổng giá trị báo giá (VNĐ, số nguyên >= 0).
- summaryNote: 1-2 câu nhận xét ngắn về mặt bằng giá, vật liệu (MDF An Cường/Picomat/phụ kiện...) và chênh lệch so với dự toán.
- confidence: Độ tin cậy từ 0.0 đến 1.0.
- items: Mảng tối đa 30 hạng mục chính gồm:
  - name: Tên hạng mục rõ ràng bằng tiếng Việt.
  - roomId: Chọn 1 trong các mã phòng: "living", "kitchen", "master", "room05", "wc", "balcony", "general".
  - boqGroup: Chọn 1 trong 3: "WOOD_FURNITURE", "APPLIANCES", "FINISHING_DECOR".
  - unit: Đơn vị tính ("bộ", "md", "m2", "cái", "gói").
  - quantity: Số lượng dương (VD: 1, 2.4, 3.5).
  - unitPriceVnd: Đơn giá VNĐ/đơn vị (số nguyên >= 0).
  - totalVnd: Thành tiền VNĐ (số nguyên >= 0).
  - matchedExistingName: Tên hạng mục dự toán tương ứng nếu khớp (chuỗi rỗng nếu hạng mục mới).
  - varianceVnd: Chênh lệch (báo giá - dự toán; 0 nếu không khớp).`;

      const response = await withTimeout(
        ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: imageBase64,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                vendorName: { type: Type.STRING },
                quoteDate: { type: Type.STRING },
                totalQuotedVnd: { type: Type.NUMBER },
                summaryNote: { type: Type.STRING },
                confidence: { type: Type.NUMBER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      roomId: { type: Type.STRING },
                      boqGroup: {
                        type: Type.STRING,
                        enum: ['WOOD_FURNITURE', 'APPLIANCES', 'FINISHING_DECOR'],
                      },
                      unit: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unitPriceVnd: { type: Type.NUMBER },
                      totalVnd: { type: Type.NUMBER },
                      matchedExistingName: { type: Type.STRING },
                      varianceVnd: { type: Type.NUMBER },
                    },
                    required: [
                      'name',
                      'roomId',
                      'boqGroup',
                      'unit',
                      'quantity',
                      'unitPriceVnd',
                      'totalVnd',
                    ],
                  },
                },
              },
              required: ['vendorName', 'totalQuotedVnd', 'summaryNote', 'confidence', 'items'],
            },
          },
        }),
        GEMINI_VISION_TIMEOUT_MS
      );

      const parsed = JSON.parse(response.text || '{}') as {
        vendorName?: string;
        quoteDate?: string;
        totalQuotedVnd?: number;
        summaryNote?: string;
        confidence?: number;
        items?: Array<Record<string, unknown>>;
      };

      const validGroups = new Set(['WOOD_FURNITURE', 'APPLIANCES', 'FINISHING_DECOR']);
      const normalizedItems = (Array.isArray(parsed.items) ? parsed.items : [])
        .slice(0, 30)
        .map((item) => {
          const qty = Math.max(0.1, Number(item.quantity) || 1);
          const unitPrice = Math.max(0, Math.round(Number(item.unitPriceVnd) || 0));
          const total =
            Math.max(0, Math.round(Number(item.totalVnd) || 0)) || Math.round(qty * unitPrice);
          const group =
            typeof item.boqGroup === 'string' && validGroups.has(item.boqGroup)
              ? item.boqGroup
              : 'WOOD_FURNITURE';
          return {
            name: String(item.name || 'Hạng mục báo giá').trim(),
            roomId: String(item.roomId || 'general').trim(),
            boqGroup: group as 'WOOD_FURNITURE' | 'APPLIANCES' | 'FINISHING_DECOR',
            unit: String(item.unit || 'bộ').trim(),
            quantity: Math.round(qty * 100) / 100,
            unitPriceVnd: unitPrice,
            totalVnd: total,
            matchedExistingName:
              typeof item.matchedExistingName === 'string' ? item.matchedExistingName.trim() : '',
            varianceVnd: Math.round(Number(item.varianceVnd) || 0),
          };
        });

      const computedTotal = normalizedItems.reduce((acc, i) => acc + i.totalVnd, 0);

      return res.json({
        ok: true,
        source: 'gemini',
        result: {
          vendorName: String(parsed.vendorName || 'Nhà thầu nội thất').trim(),
          quoteDate:
            typeof parsed.quoteDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.quoteDate)
              ? parsed.quoteDate
              : new Date().toISOString().slice(0, 10),
          totalQuotedVnd: Math.max(0, Math.round(Number(parsed.totalQuotedVnd) || 0)) || computedTotal,
          summaryNote: String(parsed.summaryNote || '').trim(),
          confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.85)),
          items: normalizedItems,
        },
      });
    } catch (err) {
      console.error('[AI Scan BOQ Quote Error]', err);
      const mapped = mapGeminiUpstreamError(
        err,
        'Không thể bóc tách bảng báo giá nội thất bằng Gemini AI lúc này.'
      );
      return res.status(mapped.status).json(mapped.body);
    }
  });

  // Vite dev middleware or static production build
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`HOME MONI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
