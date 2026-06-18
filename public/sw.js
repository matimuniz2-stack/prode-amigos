/* Service Worker del Prode — recibe los push y muestra la notificación, y
   abre/enfoca la app al tocarla. Se registra desde components/push-notifications.tsx. */

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Prode de los Pibes";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const c of list) {
          if ("focus" in c) {
            // Si la ventana no está ya en la ruta destino, la llevamos (sin
            // romper el handler si navigate() rechaza).
            if (c.url && c.url.indexOf(target) === -1 && c.navigate) {
              c.navigate(target).catch(() => {});
            }
            return c.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      }),
  );
});
