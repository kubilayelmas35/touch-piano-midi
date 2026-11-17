import { describe, expect, it } from "vitest";
import { bendCents, boardHit, resetBoard } from "./midiBoard";

describe("LX25+ controls", () => {
  it("turns the transport buttons into play, record and a bar skip", () => {
    resetBoard();
    expect(boardHit(0xb0, 106, 127, "Impact LX25+", 0)?.action).toEqual({ t: "btn", id: "play" });
    expect(boardHit(0xb0, 106, 0, "Impact LX25+", 10)?.action).toBeNull();
    expect(boardHit(0xb0, 106, 127, "Impact LX25+", 20)?.action).toEqual({ t: "btn", id: "play" });
    expect(boardHit(0xb0, 103, 127, "keyboard", 30)?.action).toEqual({ t: "btn", id: "back" });
    expect(boardHit(0xb0, 107, 127, "keyboard", 40)?.action).toEqual({ t: "btn", id: "record" });
  });

  it("maps the eight pots, the fader and the two wheels", () => {
    expect(boardHit(0xb0, 7, 127, "Impact LX25+", 0)?.action).toEqual({ t: "knob", id: "volume", v: 1 });
    expect(boardHit(0xb0, 74, 0, "x", 0)?.action).toEqual({ t: "knob", id: "cutoff", v: 0 });
    expect(boardHit(0xb0, 71, 127, "x", 0)?.action).toEqual({ t: "knob", id: "resonance", v: 1 });
    expect(boardHit(0xb0, 5, 64, "x", 0)?.action).toMatchObject({ t: "knob", id: "env" });
    expect(boardHit(0xb0, 76, 32, "x", 0)?.action).toMatchObject({ t: "knob", id: "lfoRate" });
    expect(boardHit(0xb0, 77, 90, "x", 0)?.action).toMatchObject({ t: "knob", id: "lfoDepth" });
    expect(boardHit(0xb0, 1, 40, "x", 0)?.action).toMatchObject({ t: "knob", id: "lfoDepth" });
    expect(boardHit(0xb0, 10, 64, "x", 0)?.action).toMatchObject({ t: "knob", id: "pan" });
    expect(boardHit(0xb0, 64, 127, "x", 0)).toBeNull();
    expect(bendCents(0, 64)).toBe(0);
    expect(bendCents(127, 127)).toBeCloseTo(200, 0);
    expect(bendCents(0, 0)).toBeCloseTo(-200, 0);
  });

  it("uses the pads as buttons only on a Nektar keyboard", () => {
    resetBoard();
    expect(boardHit(0x90, 36, 100, "Impact LX25+", 0)?.action).toEqual({ t: "btn", id: "play" });
    expect(boardHit(0x80, 36, 0, "Impact LX25+", 50)?.action).toBeNull();
    expect(boardHit(0x90, 36, 100, "Impact LX25+", 100)).toEqual({ eat: true, action: null });
    expect(boardHit(0x90, 40, 90, "Keystation", 400)).toBeNull();
    expect(boardHit(0x90, 60, 90, "Impact LX25+", 500)).toBeNull();
  });
});
