// Bump RELEASE whenever any cached file changes. Deploy the complete release together.
const RELEASE = "v1";
const CACHE_PREFIX = `pngsa-shell:${self.registration.scope}:`;
const CACHE_NAME = CACHE_PREFIX + RELEASE;
const FILES = ["./", "index.html", "styles.css", "storage.js", "app.js", "reports.js",
    "pwa.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
const URLS = FILES.map(file => new URL(file, self.registration.scope).href);

self.addEventListener("install", event => {
    // Installation fails if any essential file cannot be fetched. Keep the old worker.
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await cache.addAll(URLS.map(url => new Request(url, { cache: "reload" })));
    })());
    // No skipWaiting: updates wait until every old app window has closed.
});

self.addEventListener("activate", event => {
    event.waitUntil((async () => {
        for (const name of await caches.keys()) {
            if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
        }
        await self.clients.claim();
    })());
});

self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    const home = new URL("./", self.registration.scope).href;
    const isHome = event.request.mode === "navigate" &&
        [home, new URL("index.html", home).href].includes(url.origin + url.pathname);
    if (!isHome && !URLS.includes(url.href)) return;
    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(isHome ? home : event.request);
        return response || fetch(event.request);
    })());
});

self.addEventListener("message", event => {
    if (event.data !== "CHECK_OFFLINE" || !event.ports[0]) return;
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        const complete = (await Promise.all(URLS.map(url => cache.match(url)))).every(Boolean);
        event.ports[0].postMessage({ complete, release: RELEASE });
    })());
});
