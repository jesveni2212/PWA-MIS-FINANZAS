import { beforeEach, describe, expect, it, vi } from "vitest";
import { getBrowserNotificationPermission, NotificationPermissionDeniedError, requestPushSubscription, serializePushSubscription } from "@/lib/notifications/browser";

beforeEach(() => {
  vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn() });
  vi.stubGlobal("PushManager", class PushManager {});
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: {} });
});

describe("browser notifications", () => {
  it("reports the browser permission without prompting", () => {
    expect(getBrowserNotificationPermission()).toBe("default");
    expect((Notification.requestPermission as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("requests a subscription only when explicitly invoked and serializes keys", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    const subscription = { endpoint: "https://push.example/1", getKey: (name: string) => name === "p256dh" ? Uint8Array.from([1, 2]).buffer : Uint8Array.from([3, 4]).buffer } as unknown as PushSubscription;
    const subscribe = vi.fn().mockResolvedValue(subscription);
    const registration = { pushManager: { subscribe } } as unknown as ServiceWorkerRegistration;

    await expect(requestPushSubscription(registration, "AQIDBA")).resolves.toBe(subscription);
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(ArrayBuffer) });
    expect(serializePushSubscription(subscription)).toEqual({ endpoint: "https://push.example/1", p256dh: "AQI", auth: "AwQ" });
  });

  it("converts a denied native prompt into a typed error", async () => {
    vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn().mockResolvedValue("denied") });
    const registration = { pushManager: { subscribe: vi.fn() } } as unknown as ServiceWorkerRegistration;
    await expect(requestPushSubscription(registration, "AQIDBA")).rejects.toBeInstanceOf(NotificationPermissionDeniedError);
  });

  it("does not prompt again when the browser already denied permission", async () => {
    const requestPermission = vi.fn();
    vi.stubGlobal("Notification", { permission: "denied", requestPermission });
    const registration = { pushManager: { subscribe: vi.fn() } } as unknown as ServiceWorkerRegistration;

    await expect(requestPushSubscription(registration, "AQIDBA")).rejects.toBeInstanceOf(NotificationPermissionDeniedError);
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
