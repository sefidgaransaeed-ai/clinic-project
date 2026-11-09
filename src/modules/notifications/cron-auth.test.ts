import { describe, expect, it } from "vitest";
import { isCronAuthorized } from "./cron-auth";

// رمز ساختگی؛ رمز واقعی هیچ‌جا نیامده است.
const SECRET = "test-cron-secret-123";

describe("isCronAuthorized", () => {
  it("هدر Bearer با رمز درست را می‌پذیرد", () => {
    expect(isCronAuthorized(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    null,
    "",
    SECRET,
    `bearer ${SECRET}`,
    `Bearer ${SECRET} `,
    `Bearer ${SECRET}x`,
    "Bearer wrong-secret",
    "Bearer ",
    "Basic abc",
  ])("هدر نادرست %j را رد می‌کند", (header) => {
    expect(isCronAuthorized(header, SECRET)).toBe(false);
  });
});
