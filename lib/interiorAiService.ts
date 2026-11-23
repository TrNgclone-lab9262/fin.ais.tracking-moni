/**
 * @file interiorAiService.ts
 * @description Client bridge cho tuyến Full-Stack AI của Sub-App INTERIOR:
 * - POST /api/ai/scan-boq-quote (OCR báo giá nhà thầu nội thất & đối chiếu lệch giá BOQ)
 */

import { InteriorBoqGroup } from '@/types/finance';
import { postAiJson } from './aiFetch';

export interface ScannedBoqQuoteItem {
  name: string;
  roomId: string;
  boqGroup: Exclude<InteriorBoqGroup, 'DEVELOPER_INCLUDED'>;
  unit: string;
  quantity: number;
  unitPriceVnd: number;
  totalVnd: number;
  matchedExistingName: string;
  varianceVnd: number;
}

export interface ScannedBoqQuoteResult {
  vendorName: string;
  quoteDate: string;
  totalQuotedVnd: number;
  summaryNote: string;
  confidence: number;
  items: ScannedBoqQuoteItem[];
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.includes(',') ? result.split(',')[1] || '' : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp báo giá.'));
    reader.readAsDataURL(file);
  });
}

export async function scanBoqQuoteWithGemini(
  file: File,
  context: {
    scenarioName: string;
    existingItems: { name: string; roomId: string; estimatedVnd: number }[];
  }
): Promise<ScannedBoqQuoteResult> {
  const imageBase64 = await fileToBase64(file);
  const res = await postAiJson('/api/ai/scan-boq-quote', {
    imageBase64,
    mimeType: file.type || 'image/jpeg',
    scenarioName: context.scenarioName,
    existingItems: context.existingItems.slice(0, 100),
  });

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    result?: ScannedBoqQuoteResult;
    message?: string;
    error?: string;
  };

  if (!res.ok || !data.result) {
    throw new Error(
      data.message || data.error || 'Không thể bóc tách bảng báo giá nhà thầu lúc này.'
    );
  }

  return data.result;
}
