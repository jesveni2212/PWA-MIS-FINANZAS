const STATIC_CACHE_NAME = "mis-finanzas-static-v2";
const CACHE_PREFIXES = ["mis-finanzas-shell-", "mis-finanzas-static-"];
const STATIC_PATHS = ["/_next/static/", "/brand/", "/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.resolve().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => CACHE_PREFIXES.some((prefix) => key.startsWith(prefix) && key !== STATIC_CACHE_NAME))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

function isCacheableStaticRequest(request) {
  if (request.method !== "GET" || request.mode === "navigate") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/auth/")) return false;
  return STATIC_PATHS.some((path) => path.endsWith("/") ? url.pathname.startsWith(path) : url.pathname === path);
}

self.addEventListener("fetch", (event) => {
  if (!isCacheableStaticRequest(event.request)) return;

  event.respondWith(
    caches.open(STATIC_CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      if (cached) return cached;

      const response = await fetch(event.request);
      if (response.ok) await cache.put(event.request, response.clone());
      return response;
    }).catch(() => fetch(event.request)),
  );
});

self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? { title: "Mis Finanzas", body: "Tenés un recordatorio pendiente." };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    data: { url: payload.url ?? "/recordatorios" },
    tag: payload.tag ?? "mis-finanzas-reminder",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/recordatorios", self.location.origin).href;
  event.waitUntil(clients.openWindow(target));
});
