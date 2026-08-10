// ============================================
// 🦁 کیمارای آهنین - لایه‌ی دامی (Decoy)
// ============================================

// ==================== لایه‌ی دامی ====================
export async function serveDecoy(request: Request): Promise<Response> {
  // سایت‌های قانونی برای پراکسی شدن
  const decoySites = [
    'https://www.wikipedia.org',
    'https://www.github.com',
    'https://www.stackoverflow.com',
    'https://www.medium.com'
  ];

  const randomSite = decoySites[Math.floor(Math.random() * decoySites.length)];
  const decoyResponse = await fetch(randomSite);

  // شبیه‌سازی هدرهای یک سایت معمولی
  return new Response(decoyResponse.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Server': 'nginx/1.18.0',
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
