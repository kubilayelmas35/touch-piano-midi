import { getBus } from "./context";

let clickVolume = 0.6;

export function setClickVolume(v: number): void {
  clickVolume = Math.max(0, Math.min(1, v));
}

/** Schedules a short woodblock-like click on the dry bus. */
export function scheduleClick(when: number, accent: boolean): void {
  if (clickVolume <= 0) return;
  const { ctx, dryInput } = getBus();
  const t = Math.max(ctx.currentTime, when);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(accent ? 1760 : 1180, t);
  osc.frequency.exponentialRampToValueAtTime(accent ? 880 : 620, t + 0.05);
  filter.type = "bandpass";
  filter.frequency.value = accent ? 1800 : 1250;
  filter.Q.value = 1.4;
  const peak = (accent ? 0.9 : 0.55) * clickVolume;
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  osc.connect(filter);
  filter.connect(env);
  env.connect(dryInput);
  osc.start(t);
  osc.stop(t + 0.09);
  osc.onended = () => {
    osc.disconnect();
    filter.disconnect();
    env.disconnect();
  };
}
