import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BiometricOffer } from "@/components/auth/biometric-offer";

const enrollBiometric = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/biometric", () => ({ enrollBiometric }));

beforeEach(() => enrollBiometric.mockReset());
afterEach(cleanup);

describe("BiometricOffer", () => {
  it("enrolls the user and then finishes when accepted", async () => {
    enrollBiometric.mockResolvedValue(true);
    const onDone = vi.fn();
    render(<BiometricOffer label="ana@example.com" onDone={onDone} userId="u1" />);

    expect(screen.getByText("¿Activar huella o Face ID?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Activar" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(enrollBiometric).toHaveBeenCalledWith("u1", "ana@example.com");
  });

  it("reports a failed enrollment and waits for the user to continue", async () => {
    enrollBiometric.mockResolvedValue(false);
    const onDone = vi.fn();
    render(<BiometricOffer onDone={onDone} userId="u1" />);

    fireEvent.click(screen.getByRole("button", { name: "Activar" }));

    expect(await screen.findByText("No pudimos activar la huella. Podés intentarlo más tarde desde tu perfil.")).toBeInTheDocument();
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("finishes without enrolling when declined", () => {
    const onDone = vi.fn();
    render(<BiometricOffer onDone={onDone} userId="u1" />);

    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(enrollBiometric).not.toHaveBeenCalled();
  });

  it("finishes only once on repeated clicks", async () => {
    enrollBiometric.mockResolvedValue(true);
    const onDone = vi.fn();
    render(<BiometricOffer onDone={onDone} userId="u1" />);

    const activate = screen.getByRole("button", { name: "Activar" });
    fireEvent.click(activate);
    fireEvent.click(activate);
    fireEvent.click(screen.getByRole("button", { name: "Ahora no" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(enrollBiometric).toHaveBeenCalledTimes(1);
  });
});
