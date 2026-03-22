import { describe, it, expect } from "vitest";
import { parseTimeToMinutes } from "@/lib/parseTime";

describe("parseTimeToMinutes", () => {
  it("returns null for null/undefined", () => {
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
    expect(parseTimeToMinutes("")).toBeNull();
  });

  it("parses '15 minutes'", () => {
    expect(parseTimeToMinutes("15 minutes")).toBe(15);
  });

  it("parses '30 min'", () => {
    expect(parseTimeToMinutes("30 min")).toBe(30);
  });

  it("parses '1 hour'", () => {
    expect(parseTimeToMinutes("1 hour")).toBe(60);
  });

  it("parses '2 hours'", () => {
    expect(parseTimeToMinutes("2 hours")).toBe(120);
  });

  it("parses '1 hour 30 min'", () => {
    expect(parseTimeToMinutes("1 hour 30 min")).toBe(90);
  });

  it("parses '1h30m'", () => {
    expect(parseTimeToMinutes("1h30m")).toBe(90);
  });

  it("parses '1h 30m'", () => {
    expect(parseTimeToMinutes("1h 30m")).toBe(90);
  });

  it("parses '90 mins'", () => {
    expect(parseTimeToMinutes("90 mins")).toBe(90);
  });

  it("returns null for unrecognized strings", () => {
    expect(parseTimeToMinutes("unknown")).toBeNull();
    expect(parseTimeToMinutes("varies")).toBeNull();
  });

  it("parses bare number as minutes", () => {
    expect(parseTimeToMinutes("45")).toBe(45);
  });
});
