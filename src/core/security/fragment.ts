// ============================================
// 🦁 کیمارای آهنین - تقسیم هدرها (Fragment)
// ============================================
// تابع fragmentHeaders هدرهای HTTP را به بخش‌های کوچک‌تر تقسیم می‌کند.
// این تکنیک برای دور زدن DPI (Deep Packet Inspection) استفاده می‌شود.

export interface FragmentConfig {
  /** اندازه‌ی هر بخش به بایت */
  chunkSize: number;
  /** تعداد بخش‌ها */
  count: number;
  /** تأخیر بین ارسال بخش‌ها (میلی‌ثانیه) */
  delayMs: number;
}

// ==================== تولید تنظیمات Fragment تصادفی ====================
export function randomFragmentConfig(): FragmentConfig {
  return {
    chunkSize: Math.floor(Math.random() * 200) + 50,  // 50–250 بایت
    count:     Math.floor(Math.random() * 5)  + 2,    // 2–6 بخش
    delayMs:   Math.floor(Math.random() * 30) + 5,    // 5–35 میلی‌ثانیه
  };
}

// ==================== تقسیم هدرهای HTTP ====================
/**
 * هدرهای HTTP را به آرایه‌ای از Uint8Array تقسیم می‌کند.
 * هر عنصر یک بخش (chunk) از هدر است که باید به‌صورت جداگانه ارسال شود.
 *
 * @param headers   هدرهای HTTP ورودی
 * @param config    تنظیمات تقسیم (اختیاری - در صورت عدم ارائه، تصادفی)
 * @returns         آرایه‌ای از Uint8Array که هر عنصر یک بخش است
 *
 * @example
 * const chunks = fragmentHeaders(request.headers);
 * for (const chunk of chunks) {
 *   await sendChunk(chunk); // ارسال به‌صورت جداگانه
 * }
 */
export function fragmentHeaders(
  headers: Headers,
  config?: Partial<FragmentConfig>
): Uint8Array[] {
  const { chunkSize, count } = {
    ...randomFragmentConfig(),
    ...config,
  };

  // سریال‌سازی هدرها به رشته‌ی HTTP خام
  const headerLines: string[] = [];
  headers.forEach((value, key) => {
    headerLines.push(`${key}: ${value}`);
  });
  const rawHeaders = headerLines.join('\r\n') + '\r\n\r\n';

  // تبدیل به Uint8Array
  const enc        = new TextEncoder();
  const rawBytes   = enc.encode(rawHeaders);
  const totalBytes = rawBytes.byteLength;

  // تقسیم به بخش‌ها
  const chunks: Uint8Array[] = [];
  const effectiveChunkSize   = Math.ceil(totalBytes / count);
  const finalChunkSize       = Math.min(chunkSize, effectiveChunkSize);

  let offset = 0;
  while (offset < totalBytes) {
    const end   = Math.min(offset + finalChunkSize, totalBytes);
    chunks.push(rawBytes.slice(offset, end));
    offset = end;
  }

  return chunks;
}

// ==================== تقسیم داده‌های باینری ====================
/**
 * داده‌های باینری را به بخش‌های کوچک‌تر تقسیم می‌کند.
 * برای obfuscation ترافیک WebSocket استفاده می‌شود.
 *
 * @param data      داده‌ی باینری ورودی
 * @param config    تنظیمات تقسیم
 */
export function fragmentData(
  data: Uint8Array,
  config?: Partial<FragmentConfig>
): Uint8Array[] {
  const { chunkSize } = {
    ...randomFragmentConfig(),
    ...config,
  };

  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (offset < data.byteLength) {
    // اضافه کردن کمی تصادفی بودن به اندازه‌ی هر بخش (±20%)
    const jitter    = Math.floor(chunkSize * 0.2 * (Math.random() - 0.5));
    const size      = Math.max(1, chunkSize + jitter);
    const end       = Math.min(offset + size, data.byteLength);

    chunks.push(data.slice(offset, end));
    offset = end;
  }

  return chunks;
}

// ==================== تولید رشته‌ی پیکربندی Fragment ====================
/**
 * رشته‌ی پیکربندی Fragment را برای هدر X-Fragment تولید می‌کند.
 * فرمت: "chunkSize:count:delayMs"
 */
export function getFragmentConfigString(config?: Partial<FragmentConfig>): string {
  const { chunkSize, count, delayMs } = {
    ...randomFragmentConfig(),
    ...config,
  };
  return `${chunkSize}:${count}:${delayMs}`;
}
