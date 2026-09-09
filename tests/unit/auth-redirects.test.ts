import { describe, expect, it } from "vitest";
import {
  getRegistrationConfirmationPagePath,
  getRegistrationConfirmationRedirect,
} from "@/lib/auth/redirects";

describe("registration redirects", () => {
  it("builds the callback URL from the active origin", () => {
    expect(getRegistrationConfirmationRedirect("https://app.test")).toBe(
      "https://app.test/auth/callback?next=%2Fregistro-confirmado",
    );
  });

  it("builds the success and error confirmation paths", () => {
    expect(getRegistrationConfirmationPagePath()).toBe("/registro-confirmado?estado=exitoso");
    expect(getRegistrationConfirmationPagePath("error")).toBe("/registro-confirmado?estado=error");
  });
});
