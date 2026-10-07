import { describe, expect, it } from "vitest";
import { sanitizeSettings } from "./settings";

describe("dust cloud and approach effect switches", () => {
  it("turns the old 'off' style into a switch that is off, with the style back on its default", () => {
    const s = sanitizeSettings({ dust: "off", approach: "off", keymapRev: 3 } as never);
    expect(s.dustOn).toBe(false);
    expect(s.dust).toBe("smoke");
    expect(s.approachOn).toBe(false);
    expect(s.approach).toBe("beam");
  });

  it("keeps a chosen style, and the switch on when it was never turned off", () => {
    const s = sanitizeSettings({ dust: "embers", approach: "ring" });
    expect(s.dustOn).toBe(true);
    expect(s.dust).toBe("embers");
    expect(s.approachOn).toBe(true);
    expect(s.approach).toBe("ring");
    expect(sanitizeSettings({ dustOn: false, dust: "fog" }).dust).toBe("fog");
  });
});

describe("instrument looks", () => {
  it("defaults to the original designs and drops unknown ones", () => {
    const s = sanitizeSettings({ pianoSkin: "nope", guitarSkin: "maple", violinSkin: "amber" } as never);
    expect(s.pianoSkin).toBe("standard");
    expect(s.guitarSkin).toBe("maple");
    expect(s.violinSkin).toBe("amber");
  });
});

describe("instrument sounds", () => {
  it("keeps chosen sounds and falls back to the original ones", () => {
    const s = sanitizeSettings({ pianoSound: "church", guitarTone: "banjo", violinSound: "electric" });
    expect([s.pianoSound, s.guitarTone, s.violinSound]).toEqual(["church", "banjo", "electric"]);
    const d = sanitizeSettings({ pianoSound: "kazoo", guitarTone: "ukulele" } as never);
    expect([d.pianoSound, d.guitarTone, d.violinSound]).toEqual(["grand", "steel", "classic"]);
  });
});
