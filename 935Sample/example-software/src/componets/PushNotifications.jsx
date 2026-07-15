import { useEffect } from "react";
import { useURL } from "../urlConfig";

const urlBase64ToUint8Array = (value) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from(rawData, (character) => character.charCodeAt(0));
};

export async function enablePushNotifications(api, actor) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Push notifications are not supported by this browser.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const keyResponse = await fetch(`${api}/push/vapid-public-key?actor=${encodeURIComponent(actor)}`);
  if (!keyResponse.ok) throw new Error("Push notifications are not configured on the server.");
  const { publicKey } = await keyResponse.json();
  const registration = await navigator.serviceWorker.ready;
  const existingSubscription = await registration.pushManager.getSubscription();
  const subscription = existingSubscription || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const response = await fetch(`${api}/push/subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actor, subscription: subscription.toJSON() }),
  });
  if (!response.ok) throw new Error("Could not save this device for notifications.");
  return subscription;
}

/** Keeps a previously-approved browser subscription associated with the signed-in user. */
export default function PushNotifications() {
  const api = useURL();
  const actor = localStorage.getItem("currentUser") || "";

  useEffect(() => {
    if (!actor || Notification.permission !== "granted") return;
    enablePushNotifications(api, actor).catch((error) => console.warn("[push] subscription failed:", error));
  }, [api, actor]);

  return null;
}
