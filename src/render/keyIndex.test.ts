import { describe, expect, it } from "vitest";
import { blackKeyMark, keyIndexMarks, normalizeBlackKeyOrder } from "./keyIndex";

describe("key numbers", () => {
  it("numbers white keys from 1 and letters black keys from the left", () => {
    const marks = keyIndexMarks([60, 61, 62, 63, 64], "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    expect(marks.get(60)).toBe("1");
    expect(marks.get(61)).toBe("A");
    expect(marks.get(62)).toBe("2");
    expect(marks.get(63)).toBe("B");
    expect(marks.get(64)).toBe("3");
  });

  it("keeps a rearranged letter order and fills in the rest from A to Z", () => {
    expect(normalizeBlackKeyOrder("cba!")).toBe("CBADEFGHIJKLMNOPQRSTUVWXYZ");
    expect(blackKeyMark(0, "CBADEFGHIJKLMNOPQRSTUVWXYZ")).toBe("C");
    expect(blackKeyMark(1, "CBADEFGHIJKLMNOPQRSTUVWXYZ")).toBe("B");
    expect(blackKeyMark(26, "ABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBe("AA");
  });
});
