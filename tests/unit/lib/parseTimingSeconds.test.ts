import { describe, it, expect } from "vitest";
import { parseTimingSeconds, formatCountdown } from "@/lib/parseTimingSeconds";

describe("parseTimingSeconds", () => {
  it("returns null for empty string", () => {
    expect(parseTimingSeconds("")).toBeNull();
  });

  it("returns null when no time found", () => {
    expect(parseTimingSeconds("Stir well and serve immediately")).toBeNull();
  });

  // Minutes
  it("parses 'X minutes'", () => {
    expect(parseTimingSeconds("15 minutes")).toBe(900);
  });

  it("parses 'X min'", () => {
    expect(parseTimingSeconds("30 min")).toBe(1800);
  });

  it("parses 'X mins'", () => {
    expect(parseTimingSeconds("45 mins")).toBe(2700);
  });

  it("parses lowercase 'm' suffix (e.g. '5m')", () => {
    expect(parseTimingSeconds("5m")).toBe(300);
  });

  it("parses minute with context text", () => {
    expect(parseTimingSeconds("Cook for 20 minutes until golden")).toBe(1200);
  });

  // Hours
  it("parses 'X hours'", () => {
    expect(parseTimingSeconds("2 hours")).toBe(7200);
  });

  it("parses 'X hour'", () => {
    expect(parseTimingSeconds("1 hour")).toBe(3600);
  });

  it("parses 'X hr'", () => {
    expect(parseTimingSeconds("3 hr")).toBe(10800);
  });

  it("parses 'X hrs'", () => {
    expect(parseTimingSeconds("2 hrs")).toBe(7200);
  });

  // Seconds
  it("parses 'X seconds'", () => {
    expect(parseTimingSeconds("45 seconds")).toBe(45);
  });

  it("parses 'X sec'", () => {
    expect(parseTimingSeconds("30 sec")).toBe(30);
  });

  // Combined
  it("parses 'X hours Y minutes'", () => {
    expect(parseTimingSeconds("1 hour 30 minutes")).toBe(5400);
  });

  it("parses '2 hours 15 min'", () => {
    expect(parseTimingSeconds("2 hours 15 min")).toBe(8100);
  });

  // MM:SS format
  it("parses 'M:SS' colon format", () => {
    expect(parseTimingSeconds("3:30")).toBe(210);
  });

  it("parses '1:00' colon format", () => {
    expect(parseTimingSeconds("1:00")).toBe(60);
  });

  // Decimal
  it("parses decimal minutes '1.5 hours'", () => {
    expect(parseTimingSeconds("1.5 hours")).toBe(5400);
  });

  // Returns null for zero
  it("returns null for '0 minutes'", () => {
    expect(parseTimingSeconds("0 minutes")).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("formats 0 as '0:00'", () => {
    expect(formatCountdown(0)).toBe("0:00");
  });

  it("formats 60 as '1:00'", () => {
    expect(formatCountdown(60)).toBe("1:00");
  });

  it("formats 90 as '1:30'", () => {
    expect(formatCountdown(90)).toBe("1:30");
  });

  it("formats 65 as '1:05'", () => {
    expect(formatCountdown(65)).toBe("1:05");
  });

  it("formats 3600 as '60:00'", () => {
    expect(formatCountdown(3600)).toBe("60:00");
  });

  it("formats 45 as '0:45'", () => {
    expect(formatCountdown(45)).toBe("0:45");
  });
});
