/* Notifications only: no request interception or private data caching. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {
    return;
  }
  if (typeof data.id !== "string" || typeof data.body !== "string") return;
  event.waitUntil(
    self.registration.showNotification(data.title || "Monopol_MainFrame", {
      body: data.body,
      tag: "task-" + data.id,
      data: { url: "/?tab=tasks" },
      renotify: false,
    }),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL("/?tab=tasks", self.location.origin).href;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url);
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
