/* Service Worker - كريدي. غيّر رقم النسخة عند كل تحديث مهم للملفات الثابتة */
var CACHE = "kridi-shell-v1";
var SHELL = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png"];
var CDN = ["www.gstatic.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function swr(req) {
  return caches.open(CACHE).then(function (c) {
    return c.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);

  /* الصفحة نفسها: الشبكة أولا (باش توصل التحديثات)، ثم الكاش إذا ما كاين نت */
  if (req.mode === "navigate") {
    e.respondWith(
      Promise.race([
        fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
          return res;
        }),
        new Promise(function (_, rej) { setTimeout(rej, 5000); })
      ]).catch(function () {
        return caches.match("./index.html").then(function (r) { return r || caches.match("./"); });
      })
    );
    return;
  }

  /* ملفات الموقع + مكتبات Firebase والخطوط فقط. باقي الطلبات (Firestore/Auth) ما كنلمسوهاش */
  if (url.origin === self.location.origin || CDN.indexOf(url.hostname) !== -1) {
    e.respondWith(swr(req));
  }
});
