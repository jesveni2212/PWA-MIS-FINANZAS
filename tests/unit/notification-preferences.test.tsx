import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NotificationPreferences } from "@/components/profile/notification-preferences";
import { NotificationPermissionDeniedError, serializePushSubscription } from "@/lib/notifications/browser";
import { disablePushSubscription, savePushSubscription, setNotificationPreferences } from "@/lib/notifications/repository";

const { permission, requestSubscription } = vi.hoisted(() => ({ permission: vi.fn(), requestSubscription: vi.fn() }));
vi.mock("@/lib/notifications/browser", () => ({ getBrowserNotificationPermission: permission, requestPushSubscription: requestSubscription, serializePushSubscription: vi.fn() , NotificationPermissionDeniedError: class NotificationPermissionDeniedError extends Error {} }));
vi.mock("@/lib/notifications/repository", () => ({ disablePushSubscription: vi.fn(), savePushSubscription: vi.fn(), setNotificationPreferences: vi.fn() }));

const mockedDisable = vi.mocked(disablePushSubscription);
const mockedSave = vi.mocked(savePushSubscription);
const mockedPreferences = vi.mocked(setNotificationPreferences);
const subscription = { endpoint: "https://push.example/1", unsubscribe: vi.fn().mockResolvedValue(true) } as unknown as PushSubscription;

beforeEach(() => {
  requestSubscription.mockReset();
  mockedSave.mockReset();
  mockedDisable.mockReset();
  mockedPreferences.mockReset();
  permission.mockReturnValue("default");
  requestSubscription.mockResolvedValue(subscription);
  vi.mocked(serializePushSubscription).mockReturnValue({ endpoint: subscription.endpoint, p256dh: "key", auth: "auth" });
  mockedSave.mockResolvedValue(undefined);
  mockedDisable.mockResolvedValue(undefined);
  mockedPreferences.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription) } }) } });
});

afterEach(() => cleanup());

describe("NotificationPreferences", () => {
  it("does not request browser permission on mount", () => {
    render(<NotificationPreferences />);
    expect(requestSubscription).not.toHaveBeenCalled();
  });

  it("requests permission after the explicit activation click", async () => {
    render(<NotificationPreferences />);
    fireEvent.click(screen.getByRole("button", { name: "Activar notificaciones" }));
    await waitFor(() => expect(requestSubscription).toHaveBeenCalledTimes(1));
    expect(mockedSave).toHaveBeenCalledWith({ endpoint: subscription.endpoint, p256dh: "key", auth: "auth" });
    expect(mockedPreferences).toHaveBeenCalledWith(true, true);
    expect(await screen.findByText("Notificaciones activadas.")).toBeInTheDocument();
  });

  it("explains a denied permission without calling the backend", async () => {
    permission.mockReturnValueOnce("default").mockReturnValue("denied");
    requestSubscription.mockRejectedValueOnce(new NotificationPermissionDeniedError());
    render(<NotificationPreferences />);
    fireEvent.click(screen.getByRole("button", { name: "Activar notificaciones" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/configuración del navegador/);
    expect(mockedSave).not.toHaveBeenCalled();
  });

  it("disables the saved subscription after the explicit deactivation click", async () => {
    render(<NotificationPreferences />);
    fireEvent.click(screen.getByRole("button", { name: "Activar notificaciones" }));
    await screen.findByText("Notificaciones activadas.");
    fireEvent.click(screen.getByRole("button", { name: "Desactivar notificaciones" }));
    await waitFor(() => expect(mockedDisable).toHaveBeenCalledWith(subscription.endpoint));
    expect(mockedPreferences).toHaveBeenLastCalledWith(false, true);
    expect(await screen.findByText("Notificaciones desactivadas.")).toBeInTheDocument();
  });
});
