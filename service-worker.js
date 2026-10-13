/* عامل الخدمة: يخزّن اللعبة محليًا لتعمل بدون إنترنت.
   عند تعديل أي ملف في اللعبة، غيّر رقم VERSION ليصل التحديث للأجهزة. */
const VERSION = 'v1';
const CACHE = 'guess-animal-' + VERSION;

const CORE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// يجب أن يطابق هذا الرابط تمامًا رابط الخط في index.html
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Lalezar&family=Readex+Pro:wght@400;500;600&display=swap';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // ملفات اللعبة: إذا فشل أحدها يفشل التثبيت كله (حتى لا نعتمد نسخة ناقصة)
    await cache.addAll(CORE);
    // الخطوط: محاولة إضافية، وفشلها لا يمنع التثبيت (اللعبة لها خطوط بديلة)
    try {
      const res = await fetch(FONT_CSS);
      if (res.ok) {
        await cache.put(FONT_CSS, res.clone());
        const css = await res.text();
        const urls = Array.from(new Set(css.match(/https:\/\/fonts\.gstatic\.com[^)'"\s]+/g) || []));
        await Promise.all(urls.map(async (u) => {
          try {
            const r = await fetch(u);
            if (r.ok) await cache.put(u, r);
          } catch (e) { /* تجاهل */ }
        }));
      }
    } catch (e) { /* لا إنترنت وقت التثبيت: تُستخدم الخطوط البديلة */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('guess-animal-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // الخطوط: من التخزين أولًا، ثم الشبكة مع حفظ نسخة
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith((async () => {
      const cached = await caches.match(req, { ignoreVary: true });
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (e) {
        return new Response('', { status: 504, statusText: 'offline' });
      }
    })());
    return;
  }

  if (url.origin !== self.location.origin) return;

  // التنقل بين الصفحات: دائمًا من التخزين المحلي (index.html)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cached = (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./index.html'));
      if (cached) {
        // تحديث هادئ في الخلفية إذا وُجد إنترنت
        event.waitUntil(fetch('./index.html', { cache: 'no-cache' }).then((r) => {
          if (r && r.ok) return caches.open(CACHE).then((c) => Promise.all([c.put('./index.html', r.clone()), c.put('./', r.clone())]));
        }).catch(() => {}));
        return cached;
      }
      return fetch(req);
    })());
    return;
  }

  // باقي ملفات اللعبة: من التخزين أولًا ثم الشبكة
  event.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;
    try {
      const res = await fetch(req);
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      }
      return res;
    } catch (e) {
      return new Response('', { status: 504, statusText: 'offline' });
    }
  })());
});
