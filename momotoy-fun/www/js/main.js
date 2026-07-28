/* MomoToys 官网 — 主交互脚本 (v0.1)
   - nav 当前 section 高亮
   - 平滑滚动 fallback
   - 简化埋点 (console,后续接 GA)
   ---------------------------------------------------------------- */

(function () {
  'use strict';

  // 1) 滚动时高亮当前 nav 项
  const navLinks = document.querySelectorAll('.nav__menu a[href^="#"]');
  const sections = Array.from(navLinks)
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (sections.length > 0) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = '#' + entry.target.id;
            navLinks.forEach((a) => {
              const match = a.getAttribute('href') === id;
              a.style.color = match ? 'var(--c-primary)' : '';
            });
          }
        });
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // 2) 移动端 nav 折叠 (留作 Phase 2 扩展, 临时空操作)
  // 当前已是纯链接菜单, 移动端 display: none 隐藏, 不需要 toggle

  // 3) 价格按钮埋点
  document.querySelectorAll('.price .btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tier = e.target.closest('.price')?.querySelector('h3')?.textContent || 'unknown';
      console.log('[momotoy.fun] price-click', { tier, ts: Date.now() });
    });
  });

  // 4) FAQ 互斥展开 (同一时间只开一个)
  const faqs = document.querySelectorAll('.faq');
  faqs.forEach((faq) => {
    faq.addEventListener('toggle', () => {
      if (faq.open) {
        faqs.forEach((other) => {
          if (other !== faq) other.open = false;
        });
      }
    });
  });

  console.log('[momotoy.fun] main.js loaded', { version: '0.1.0', ts: Date.now() });
})();
