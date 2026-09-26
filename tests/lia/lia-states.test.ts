import { describe, it, expect } from "vitest";
import {
  LIA_STATES,
  LIA_STATE_IDS,
  getLiaState,
} from "@/lib/lia/lia-states";

describe("LIA state contract", () => {
  it("exposes exactly the five approved states", () => {
    expect(LIA_STATE_IDS).toEqual([
      "idle",
      "blink",
      "hello",
      "thinking",
      "talking",
    ]);
  });

  it("defines correct segments and loop/return rules", () => {
    expect(LIA_STATES.idle).toMatchObject({
      segment: [0, 59],
      loop: true,
      returnToIdle: false,
    });
    expect(LIA_STATES.blink).toMatchObject({
      segment: [60, 89],
      loop: false,
      returnToIdle: true,
    });
    expect(LIA_STATES.hello).toMatchObject({
      segment: [90, 149],
      loop: false,
      returnToIdle: true,
    });
    expect(LIA_STATES.thinking).toMatchObject({
      segment: [150, 209],
      loop: true,
      returnToIdle: false,
    });
    expect(LIA_STATES.talking).toMatchObject({
      segment: [210, 299],
      loop: true,
      returnToIdle: false,
    });
  });

  it("rejects undefined states", () => {
    expect(() => getLiaState("unknown" as any)).toThrow(
      /desconocido/i
    );
  });

  it("returns the correct state object for each id", () => {
    for (const id of LIA_STATE_IDS) {
      const state = getLiaState(id);
      expect(state.segment).toHaveLength(2);
      expect(typeof state.loop).toBe("boolean");
      expect(typeof state.returnToIdle).toBe("boolean");
    }
  });
});