export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribePush(publicKey: string): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return null;
  }
  const permission =
    Notification.permission === "granted"
      ? Notification.permission
      : await Notification.requestPermission();
  if (permission !== "granted") return null;

  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await navigator.serviceWorker.register("/sw.js");
  }
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }
  return sub;
}

export async function ensurePushSubscribed(): Promise<PushSubscription> {
  const vapidRes = await fetch("/api/push/vapid");
  const vapid = (await vapidRes.json()) as { publicKey: string | null };
  if (!vapid.publicKey) {
    throw new Error("VAPID keys are not configured on the server yet. See README.");
  }
  const sub = await subscribePush(vapid.publicKey);
  if (!sub) {
    throw new Error(
      "Notifications are blocked. Allow notifications in your browser to enable the reminder."
    );
  }
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: {
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))),
        },
      },
    }),
  });
  if (!res.ok) throw new Error("Could not save your notification subscription");
  return sub;
}