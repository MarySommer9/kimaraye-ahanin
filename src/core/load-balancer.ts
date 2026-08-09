// ============================================
// 🦁 کیمارای آهنین - توزیع بار
// ============================================

import { LoadBalancerConfig } from '../types';

// لیست Workerهای پشتیبان (با پروژه‌های کپی شده)
const WORKER_LIST = [
  'https://kimaraye-ahanin-1.your-subdomain.workers.dev',
  'https://kimaraye-ahanin-2.your-subdomain.workers.dev',
  'https://kimaraye-ahanin-3.your-subdomain.workers.dev',
  'https://kimaraye-ahanin-4.your-subdomain.workers.dev'
];

const config: LoadBalancerConfig = {
  workers: WORKER_LIST,
  strategy: 'round-robin',
  healthCheckInterval: 30000
};

let currentIndex = 0;

// ==================== دریافت آدرس Worker بعدی ====================
export async function getWorkerEndpoint(request: Request): Promise<string> {
  const strategy = config.strategy;
  let selected = '';

  if (strategy === 'round-robin') {
    currentIndex = (currentIndex + 1) % config.workers.length;
    selected = config.workers[currentIndex];
  } else if (strategy === 'random') {
    selected = config.workers[Math.floor(Math.random() * config.workers.length)];
  }

  return selected;
}

// ==================== بررسی سلامت Worker ====================
export async function healthCheck(workerUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${workerUrl}/health`, { method: 'HEAD' });
    return response.status === 200;
  } catch {
    return false;
  }
}
