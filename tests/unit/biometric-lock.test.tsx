import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BiometricLock } from "@/components/auth/biometric-lock";

const biometric = vi.hoisted(() => ({
  getEnrollment: vi.fn(),
  isUnlocked: vi.fn(),
  markUnlocked: vi.fn(),
  markLocked: vi.fn(),
  markHidden: vi.fn(),
  shouldRelock: vi.fn(),
  unlockWithBiometric: vi.fn(),
  clearBiometric: vi.fn(),
}));
const signOut = vi.hoisted(() => vi.fn());
const clearUserData = vi.hoisted(() => vi.fn());
const assign = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/biometric", () => biometric);
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));
vi.mock("@/lib/offline/storage", () => ({ clearUserData }));

const enrolled = { userId: "u1", credentialId: "abc" };
const lockName = "Aplicación bloqueada";

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, value: hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  for (const mock of [...Object.values(biometric), signOut, clearUserData, assign]) mock.mockReset();
  biometric.getEnrollment.mockReturnValue(enrolled);
  biometric.isUnlocked.mockReturnValue(false);
  biometric.shouldRelock.mockReturnValue(false);
  biometric.unlockWithBiometric.mockResolvedValue(false);
  signOut.mockResolvedValue({ error: null });
  clearUserData.mockResolvedValue(undefined);
  Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
});
afterEach(() => { cleanup(); setHidden(false); });

describe("BiometricLock", () => {
  it("renders nothing without an enrollment", () => {
    biometric.getEnrollment.mockReturnValue(null);
    render(<BiometricLock />);

    expect(screen.queryByRole("dialog", { name: lockName })).not.toBeInTheDocument();
    expect(biometric.unlockWithBiometric).not.toHaveBeenCalled();
  });

  it("does not lock an already unlocked session", () => {
    biometric.isUnlocked.mockReturnValue(true);
    render(<BiometricLock />);

    expect(screen.queryByRole("dialog", { name: lockName })).not.toBeInTheDocument();
  });

  it("locks on a cold start and unlocks automatically once", async () => {
    biometric.unlockWithBiometric.mockResolvedValue(true);
    render(<BiometricLock />);

    await waitFor(() => expect(screen.queryByRole("dialog", { name: lockName })).not.toBeInTheDocument());
    expect(biometric.unlockWithBiometric).toHaveBeenCalledTimes(1);
    expect(biometric.markUnlocked).toHaveBeenCalled();
  });

  it("stays locked after a failed attempt and lets the user retry", async () => {
    render(<BiometricLock />);

    const dialog = await screen.findByRole("dialog", { name: lockName });
    await waitFor(() => expect(biometric.unlockWithBiometric).toHaveBeenCalledTimes(1));
    expect(dialog).toBeInTheDocument();

    biometric.unlockWithBiometric.mockResolvedValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Desbloquear con huella o Face ID" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: lockName })).not.toBeInTheDocument());
    expect(biometric.unlockWithBiometric).toHaveBeenCalledTimes(2);
  });

  it("signs out, clears local data and the enrollment when using the password", async () => {
    render(<BiometricLock />);
    await screen.findByRole("dialog", { name: lockName });

    fireEvent.click(screen.getByRole("button", { name: "Usar contraseña" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/acceso"));
    expect(clearUserData).toHaveBeenCalledWith("u1");
    expect(signOut).toHaveBeenCalled();
    expect(biometric.clearBiometric).toHaveBeenCalled();
  });

  it("still leaves through the password path when clearing local data fails", async () => {
    clearUserData.mockRejectedValue(new Error("storage"));
    render(<BiometricLock />);
    await screen.findByRole("dialog", { name: lockName });

    fireEvent.click(screen.getByRole("button", { name: "Usar contraseña" }));

    await waitFor(() => expect(assign).toHaveBeenCalledWith("/acceso"));
  });

  it("records when the app goes to the background", () => {
    biometric.isUnlocked.mockReturnValue(true);
    render(<BiometricLock />);

    act(() => setHidden(true));

    expect(biometric.markHidden).toHaveBeenCalled();
  });

  it("relocks and prompts again when returning after the threshold", async () => {
    biometric.isUnlocked.mockReturnValue(true);
    render(<BiometricLock />);
    act(() => setHidden(true));
    biometric.shouldRelock.mockReturnValue(true);

    act(() => setHidden(false));

    await screen.findByRole("dialog", { name: lockName });
    expect(biometric.markLocked).toHaveBeenCalled();
    await waitFor(() => expect(biometric.unlockWithBiometric).toHaveBeenCalledTimes(1));
  });

  it("does not relock when returning before the threshold", () => {
    biometric.isUnlocked.mockReturnValue(true);
    render(<BiometricLock />);
    act(() => setHidden(true));

    act(() => setHidden(false));

    expect(screen.queryByRole("dialog", { name: lockName })).not.toBeInTheDocument();
  });
});
