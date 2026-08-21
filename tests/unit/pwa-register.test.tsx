import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PwaRegister } from "@/components/pwa-register";

describe("PwaRegister", () => {
  it("registers the worker", () => {
    const register = vi.fn();
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });

    render(<PwaRegister />);

    expect(register).toHaveBeenCalledWith("/sw.js");
  });
});
