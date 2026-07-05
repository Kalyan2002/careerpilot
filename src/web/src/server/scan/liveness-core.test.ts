import { describe, expect, test } from "bun:test";
import { classifyLiveness } from "./liveness-core";

describe("classifyLiveness", () => {
  test("404/410 is expired via http_gone", () => {
    expect(classifyLiveness({ status: 404 }).code).toBe("http_gone");
    expect(classifyLiveness({ status: 410 }).result).toBe("expired");
  });

  test("bot challenge page is uncertain, not expired", () => {
    const result = classifyLiveness({ bodyText: "Just a moment... checking your browser before" });
    expect(result.result).toBe("uncertain");
    expect(result.code).toBe("bot_challenge");
  });

  test("403/503 without challenge text is uncertain (access blocked)", () => {
    expect(classifyLiveness({ status: 403 }).code).toBe("access_blocked");
    expect(classifyLiveness({ status: 503 }).result).toBe("uncertain");
  });

  test("expired URL pattern takes precedence over body content", () => {
    const result = classifyLiveness({
      finalUrl: "https://boards.example.com/job/1?error=true",
      bodyText: "x".repeat(400),
    });
    expect(result.code).toBe("expired_url");
  });

  test("hard-expired body phrase marks expired", () => {
    expect(classifyLiveness({ bodyText: "This job has expired." }).code).toBe("expired_body");
    expect(classifyLiveness({ bodyText: "Diese Stelle ist nicht mehr verfügbar." }).result).toBe(
      "expired",
    );
  });

  test("visible apply control marks active even with short body", () => {
    const result = classifyLiveness({ bodyText: "Senior Engineer", applyControls: ["Apply now"] });
    expect(result.result).toBe("active");
    expect(result.code).toBe("apply_control_visible");
  });

  test("listing page pattern marks expired", () => {
    expect(classifyLiveness({ bodyText: "42 jobs found for your search" }).code).toBe("listing_page");
  });

  test("short content with no apply control is expired (insufficient_content)", () => {
    expect(classifyLiveness({ bodyText: "Home About Contact" }).code).toBe("insufficient_content");
  });

  test("substantial content with no apply control is uncertain", () => {
    const result = classifyLiveness({ bodyText: "x".repeat(400) });
    expect(result.result).toBe("uncertain");
    expect(result.code).toBe("no_apply_control");
  });
});
