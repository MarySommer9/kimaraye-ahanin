// ============================================
// 🦁 کیمارای آهنین - تنظیمات پروژه
// ============================================
// این فایل تمام مقادیر پیش‌فرض و قابل‌تنظیم پروژه را نگه می‌دارد.
// مقادیر می‌توانند از متغیرهای محیطی (env.vars) بازنویسی شوند.

// ==================== تنظیمات شبکه ====================
export const NETWORK = {
  /** مهلت زمانی اتصال (میلی‌ثانیه) */
  CONNECT_TIMEOUT_MS:   10_000,
  /** مهلت زمانی پاسخ (میلی‌ثانیه) */
  REQUEST_TIMEOUT_MS:   30_000,
  /** حداکثر اندازه‌ی body درخواست (بایت) — 10 مگابایت */
  MAX_BODY_SIZE:        10 * 1024 * 1024,
  /** پورت‌های مجاز برای هدف‌گذاری */
  ALLOWED_PORTS:        [80, 443, 8080, 8443],
  /** دامنه‌هایی که به‌عنوان هدف مجاز نیستند */
  BLOCKED_DOMAINS:      ['localhost', '127.0.0.1', '0.0.0.0', '::1'],
} as const;

// ==================== تنظیمات احراز هویت ====================
export const AUTH = {
  /** مدت اعتبار کش KV برای کاربر (ثانیه) */
  CACHE_TTL_SECONDS:    300,   // ۵ دقیقه
  /** حداکثر تعداد تلاش‌های ناموفق ورود */
  MAX_FAILED_ATTEMPTS:  5,
  /** مدت قفل شدن حساب پس از تلاش‌های ناموفق (میلی‌ثانیه) */
  LOCKOUT_DURATION_MS:  15 * 60 * 1000, // ۱۵ دقیقه
  /** طول حداقل رمز عبور */
  MIN_PASSWORD_LENGTH:  8,
  /** طول UUID */
  UUID_LENGTH:          36,
} as const;

// ==================== تنظیمات سهمیه ====================
export const QUOTA = {
  /** سهمیه‌ی پیش‌فرض برای کاربر جدید (گیگابایت) */
  DEFAULT_QUOTA_GB:     10,
  /** حداکثر سهمیه (۰ = نامحدود) */
  MAX_QUOTA_GB:         0,
  /** بازه‌ی بررسی سهمیه (میلی‌ثانیه) */
  CHECK_INTERVAL_MS:    60_000,
} as const;

// ==================== تنظیمات امنیتی ====================
export const SECURITY = {
  /** فعال بودن لایه‌ی Morph به‌صورت پیش‌فرض */
  MORPH_ENABLED:         true,
  /** فعال بودن لایه‌ی Decoy به‌صورت پیش‌فرض */
  DECOY_ENABLED:         true,
  /** فعال بودن Fragment به‌صورت پیش‌فرض */
  FRAGMENT_ENABLED:      true,
  /** اثرانگشت TLS پیش‌فرض */
  DEFAULT_TLS_FP:        'chrome' as const,
  /** مدت تغییر پارامترهای Morph (میلی‌ثانیه) */
  MORPH_ROTATION_MS:     60_000,
  /** URL پیش‌فرض برای لایه‌ی Decoy */
  DECOY_URL:             'https://www.wikipedia.org',
  /** حداکثر اندازه‌ی بخش Fragment (بایت) */
  FRAGMENT_MAX_CHUNK:    256,
  /** حداقل اندازه‌ی بخش Fragment (بایت) */
  FRAGMENT_MIN_CHUNK:    50,
} as const;

// ==================== تنظیمات توزیع بار ====================
export const LOAD_BALANCER = {
  /** استراتژی پیش‌فرض */
  DEFAULT_STRATEGY:      'round-robin' as const,
  /** بازه‌ی بررسی سلامت Worker (میلی‌ثانیه) */
  HEALTH_CHECK_INTERVAL: 30_000,
  /** مهلت زمانی بررسی سلامت (میلی‌ثانیه) */
  HEALTH_CHECK_TIMEOUT:  5_000,
} as const;

// ==================== تنظیمات ساب‌اسکریپشن ====================
export const SUBSCRIPTION = {
  /** فرمت پیش‌فرض */
  DEFAULT_FORMAT:        'text' as const,
  /** نام نمایشی در لینک اتصال */
  PROXY_TAG:             'Kimaraye-Ahanin',
  /** SNI پیش‌فرض برای Reality */
  REALITY_SNI:           'www.microsoft.com',
  /** اثرانگشت پیش‌فرض برای Reality */
  REALITY_FP:            'chrome',
} as const;

// ==================== تنظیمات لاگ‌گذاری ====================
export const LOGGING = {
  /** سطح لاگ */
  LEVEL:                 'info' as 'debug' | 'info' | 'warn' | 'error',
  /** ثبت IP کاربران */
  LOG_IPS:               false,
  /** ثبت UUID در لاگ */
  LOG_UUIDS:             false,
} as const;

// ==================== تنظیمات پایگاه داده ====================
export const DATABASE = {
  /** محدودیت پیش‌فرض تعداد نتایج */
  DEFAULT_LIMIT:         100,
  /** حداکثر محدودیت */
  MAX_LIMIT:             1000,
} as const;

// ==================== صادر کردن همه تنظیمات ====================
export const config = {
  network:       NETWORK,
  auth:          AUTH,
  quota:         QUOTA,
  security:      SECURITY,
  loadBalancer:  LOAD_BALANCER,
  subscription:  SUBSCRIPTION,
  logging:       LOGGING,
  database:      DATABASE,
} as const;

export type Config = typeof config;
