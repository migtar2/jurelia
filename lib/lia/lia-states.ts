/** LIA Bot — state contract (matches POC exactly) */

export const LIA_STATES = {
  idle: { segment: [0, 59] as [number, number], loop: true, returnToIdle: false },
  blink: { segment: [60, 89] as [number, number], loop: false, returnToIdle: true },
  hello: { segment: [90, 149] as [number, number], loop: false, returnToIdle: true },
  thinking: { segment: [150, 209] as [number, number], loop: true, returnToIdle: false },
  talking: { segment: [210, 299] as [number, number], loop: true, returnToIdle: false },
} as const;

export type LiaStateId = keyof typeof LIA_STATES;

export const LIA_STATE_IDS = Object.keys(LIA_STATES) as LiaStateId[];

export function getLiaState(id: LiaStateId) {
  const state = LIA_STATES[id];
  if (!state) throw new RangeError(`Estado de LIA desconocido: ${id}`);
  return state;
}