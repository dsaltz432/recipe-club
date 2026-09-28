import { describe, it, expect } from "vitest";
import { getAnniversaryInfo, toOrdinal } from "@/lib/anniversary";

describe("getAnniversaryInfo", () => {
  it("returns info on the anniversary itself", () => {
    const info = getAnniversaryInfo(new Date(2026, 8, 29, 12));
    expect(info).toEqual({ years: 6, date: new Date(2026, 8, 29), isToday: true });
  });

  it("returns info for other days in the anniversary week (Sun–Sat)", () => {
    // Sep 29, 2026 is a Tuesday → week is Sun Sep 27 – Sat Oct 3
    expect(getAnniversaryInfo(new Date(2026, 8, 27, 0, 0))).toMatchObject({ years: 6, isToday: false });
    expect(getAnniversaryInfo(new Date(2026, 8, 28, 9))).toMatchObject({ years: 6, isToday: false });
    expect(getAnniversaryInfo(new Date(2026, 9, 3, 23, 59))).toMatchObject({ years: 6, isToday: false });
  });

  it("returns null outside the anniversary week", () => {
    expect(getAnniversaryInfo(new Date(2026, 8, 26, 23, 59))).toBeNull();
    expect(getAnniversaryInfo(new Date(2026, 9, 4))).toBeNull();
    expect(getAnniversaryInfo(new Date(2026, 5, 15))).toBeNull();
  });

  it("counts years from the 2020 founding", () => {
    expect(getAnniversaryInfo(new Date(2027, 8, 29))?.years).toBe(7);
  });

  it("returns null in the founding year", () => {
    expect(getAnniversaryInfo(new Date(2020, 8, 29))).toBeNull();
  });
});

describe("toOrdinal", () => {
  it.each([
    [1, "1st"], [2, "2nd"], [3, "3rd"], [4, "4th"], [6, "6th"],
    [11, "11th"], [12, "12th"], [13, "13th"], [21, "21st"], [22, "22nd"], [23, "23rd"],
  ])("%i → %s", (n, expected) => {
    expect(toOrdinal(n)).toBe(expected);
  });
});
