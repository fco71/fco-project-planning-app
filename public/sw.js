self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // Ignore cache cleanup failures.
      }

      try {
        await self.registration.unregister();
      } catch {
        // Ignore unregister failures.
      }

      try {
        const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
          client.navigate(client.url);
        }
      } catch {
        // Ignore client refresh failures.
      }
    })()
  );
});
