// ============================================
// 🦁 کیمارای آهنین - چرخش خودکار دامنه
// ============================================
// این ماژول با استفاده از Cloudflare API ساب‌دامین‌های تصادفی
// ایجاد می‌کند و هر ۲۴ ساعت آن‌ها را می‌چرخاند.

import { Env } from '../types';

// ==================== تایپ‌ها ====================
export interface DomainRotatorConfig {
  zoneId:       string;   // Cloudflare Zone ID
  apiToken:     string;   // Cloudflare API Token
  baseDomain:   string;   // مثال: example.com
  targetIP:     string;   // IP یا hostname هدف (A یا CNAME)
  prefixes:     string[]; // پیشوندهای مجاز برای ساب‌دامین
  ttlSeconds:   number;   // TTL رکورد DNS
  maxSubdomains: number;  // حداکثر تعداد ساب‌دامین فعال
}

export interface SubdomainRecord {
  subdomain:  string;
  fqdn:       string;     // نام کامل: sub.example.com
  cfRecordId: string;     // شناسه رکورد در Cloudflare
  createdAt:  number;
  expiresAt:  number;
}

export interface RotationResult {
  success:    boolean;
  created:    SubdomainRecord[];
  deleted:    string[];
  current:    SubdomainRecord[];
  message:    string;
}

// ==================== ثابت‌ها ====================
const KV_ACTIVE_DOMAINS    = 'domain_rotator:active';
const KV_LAST_ROTATION     = 'domain_rotator:last_rotation';
const ROTATION_INTERVAL_MS = 24 * 60 * 60 * 1000; // ۲۴ ساعت
const CF_API_BASE          = 'https://api.cloudflare.com/client/v4';

// ==================== هندلر اصلی ====================
export async function handleDomainRotator(request: Request, env: Env): Promise<Response> {
  const url    = new URL(request.url);
  const action = url.searchParams.get('action') || 'status';

  // احراز هویت ادمین
  const adminToken = await env.KV.get('admin_token') || 'admin123';
  const token      = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token || token !== adminToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  switch (action) {
    case 'rotate': return handleRotate(request, env);
    case 'status': return handleStatus(env);
    case 'force':  return handleForceRotate(env);
    case 'clean':  return handleCleanup(env);
    default:
      return new Response(JSON.stringify({ error: 'آکشن نامعتبر است. از status | rotate | force | clean استفاده کنید.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
  }
}

// ==================== وضعیت جاری ====================
async function handleStatus(env: Env): Promise<Response> {
  const [activeRaw, lastRotation] = await Promise.all([
    env.KV.get(KV_ACTIVE_DOMAINS, 'json'),
    env.KV.get(KV_LAST_ROTATION),
  ]);

  const active = (activeRaw as SubdomainRecord[]) || [];
  const lastMs = lastRotation ? parseInt(lastRotation) : 0;
  const nextMs = lastMs + ROTATION_INTERVAL_MS;

  return new Response(JSON.stringify({
    activeSubdomains: active,
    lastRotation:     lastMs ? new Date(lastMs).toISOString() : null,
    nextRotation:     lastMs ? new Date(nextMs).toISOString() : null,
    needsRotation:    Date.now() > nextMs,
    count:            active.length,
  }, null, 2), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== چرخش بر اساس زمان‌بندی ====================
async function handleRotate(request: Request, env: Env): Promise<Response> {
  const lastRotation = await env.KV.get(KV_LAST_ROTATION);
  const lastMs       = lastRotation ? parseInt(lastRotation) : 0;

  if (Date.now() - lastMs < ROTATION_INTERVAL_MS) {
    const nextMs = lastMs + ROTATION_INTERVAL_MS;
    return new Response(JSON.stringify({
      message: `هنوز زمان چرخش نرسیده. چرخش بعدی: ${new Date(nextMs).toISOString()}`,
      nextRotation: new Date(nextMs).toISOString(),
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return performRotation(env);
}

// ==================== چرخش اجباری ====================
async function handleForceRotate(env: Env): Promise<Response> {
  return performRotation(env);
}

// ==================== پاکسازی دامنه‌های منقضی ====================
async function handleCleanup(env: Env): Promise<Response> {
  const config = await loadConfig(env);
  if (!config) {
    return new Response(JSON.stringify({ error: 'پیکربندی domain rotator تنظیم نشده' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const activeRaw = (await env.KV.get(KV_ACTIVE_DOMAINS, 'json')) as SubdomainRecord[] || [];
  const now       = Date.now();
  const expired   = activeRaw.filter(r => r.expiresAt < now);
  const valid     = activeRaw.filter(r => r.expiresAt >= now);

  const deleted: string[] = [];
  for (const rec of expired) {
    const ok = await deleteCloudflareRecord(config, rec.cfRecordId);
    if (ok) deleted.push(rec.fqdn);
  }

  await env.KV.put(KV_ACTIVE_DOMAINS, JSON.stringify(valid));

  return new Response(JSON.stringify({
    message:  `${deleted.length} دامنه‌ی منقضی پاک شد`,
    deleted,
    remaining: valid.length,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== اجرای چرخش ====================
async function performRotation(env: Env): Promise<Response> {
  const config = await loadConfig(env);
  if (!config) {
    return new Response(JSON.stringify({
      error: 'پیکربندی domain rotator تنظیم نشده.',
      hint:  'در KV کلیدهای domain_rotator_zone_id، domain_rotator_token، domain_rotator_base_domain و domain_rotator_target_ip را تنظیم کنید.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await rotateDomains(env, config);

  return new Response(JSON.stringify(result, null, 2), {
    status:  result.success ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ==================== منطق اصلی چرخش ====================
async function rotateDomains(env: Env, config: DomainRotatorConfig): Promise<RotationResult> {
  const activeRaw = (await env.KV.get(KV_ACTIVE_DOMAINS, 'json')) as SubdomainRecord[] || [];
  const deleted: string[] = [];
  const created: SubdomainRecord[] = [];

  // حذف دامنه‌های قدیمی از Cloudflare
  for (const rec of activeRaw) {
    const ok = await deleteCloudflareRecord(config, rec.cfRecordId);
    if (ok) deleted.push(rec.fqdn);
  }

  // ایجاد ساب‌دامین‌های جدید تصادفی
  const count = Math.min(config.maxSubdomains, 3); // حداکثر ۳ ساب‌دامین جدید
  for (let i = 0; i < count; i++) {
    const subdomain = generateRandomSubdomain(config.prefixes);
    const record    = await createCloudflareRecord(config, subdomain);
    if (record) created.push(record);
  }

  // ذخیره در KV
  await env.KV.put(KV_ACTIVE_DOMAINS, JSON.stringify(created));
  await env.KV.put(KV_LAST_ROTATION, Date.now().toString());

  // بروزرسانی ساب‌اسکریپشن‌های کاربران در KV
  if (created.length > 0) {
    await env.KV.put('current_domains', JSON.stringify(created.map(r => r.fqdn)));
  }

  return {
    success: created.length > 0,
    created,
    deleted,
    current: created,
    message: created.length > 0
      ? `✅ ${created.length} ساب‌دامین جدید ایجاد شد و ${deleted.length} مورد قدیمی حذف شد`
      : '❌ ایجاد ساب‌دامین ناموفق بود',
  };
}

// ==================== تولید ساب‌دامین تصادفی ====================
function generateRandomSubdomain(prefixes: string[]): string {
  const prefix  = prefixes[Math.floor(Math.random() * prefixes.length)];
  const suffix  = crypto.getRandomValues(new Uint8Array(4));
  const hexSuffix = Array.from(suffix).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}-${hexSuffix}`;
}

// ==================== ایجاد رکورد DNS در Cloudflare ====================
async function createCloudflareRecord(
  config: DomainRotatorConfig,
  subdomain: string
): Promise<SubdomainRecord | null> {
  try {
    const fqdn       = `${subdomain}.${config.baseDomain}`;
    const isIP       = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(config.targetIP);
    const recordType = isIP ? 'A' : 'CNAME';

    const response = await fetch(
      `${CF_API_BASE}/zones/${config.zoneId}/dns_records`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiToken}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          type:    recordType,
          name:    fqdn,
          content: config.targetIP,
          ttl:     config.ttlSeconds,
          proxied: true, // Cloudflare proxy فعال
        }),
      }
    );

    const data = await response.json() as any;
    if (!data.success) {
      console.error('[DomainRotator] خطا در ایجاد رکورد:', JSON.stringify(data.errors));
      return null;
    }

    const expiresAt = Date.now() + ROTATION_INTERVAL_MS + (6 * 60 * 60 * 1000); // ۳۰ ساعت

    return {
      subdomain,
      fqdn,
      cfRecordId: data.result.id,
      createdAt:  Date.now(),
      expiresAt,
    };
  } catch (err: any) {
    console.error('[DomainRotator] استثنا در ایجاد رکورد:', err.message);
    return null;
  }
}

// ==================== حذف رکورد DNS از Cloudflare ====================
async function deleteCloudflareRecord(
  config: DomainRotatorConfig,
  recordId: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `${CF_API_BASE}/zones/${config.zoneId}/dns_records/${recordId}`,
      {
        method:  'DELETE',
        headers: { 'Authorization': `Bearer ${config.apiToken}` },
      }
    );
    const data = await response.json() as any;
    return !!data.success;
  } catch {
    return false;
  }
}

// ==================== بارگذاری پیکربندی از KV ====================
async function loadConfig(env: Env): Promise<DomainRotatorConfig | null> {
  const [zoneId, apiToken, baseDomain, targetIP] = await Promise.all([
    env.KV.get('domain_rotator_zone_id'),
    env.KV.get('domain_rotator_token'),
    env.KV.get('domain_rotator_base_domain'),
    env.KV.get('domain_rotator_target_ip'),
  ]);

  if (!zoneId || !apiToken || !baseDomain || !targetIP) return null;

  return {
    zoneId,
    apiToken,
    baseDomain,
    targetIP,
    prefixes:     ['cdn', 'edge', 'gw', 'net', 'proxy', 'node', 'api', 'srv'],
    ttlSeconds:   1,      // Auto TTL از Cloudflare
    maxSubdomains: 3,
  };
}

// ==================== دریافت دامنه‌های فعال (برای سایر ماژول‌ها) ====================
/**
 * لیست ساب‌دامین‌های فعال را برمی‌گرداند.
 * در سرویس‌های دیگر برای ساخت لینک‌های اشتراک استفاده می‌شود.
 */
export async function getActiveDomains(env: Env): Promise<string[]> {
  const stored = await env.KV.get('current_domains', 'json');
  if (stored && Array.isArray(stored)) return stored as string[];
  return [];
}
