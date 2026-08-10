// ============================================
// 🦁 کیمارای آهنین - Iron Chimera
// پروکسی ضد‌فیلتر روی Cloudflare Workers
// ============================================

import { Env } from './types';
import { router } from './core/router';

// ==================== هندلر اصلی ====================
export default {
  /**
   * نقطه‌ی ورودی اصلی Cloudflare Worker.
   * تمام درخواست‌ها از اینجا به router ارسال می‌شوند.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    return router(request, env);
  },
};
