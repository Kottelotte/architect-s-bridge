let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

export function playBuildTick() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 800 + Math.random() * 400;
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

export function playAnchorClick() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 200;
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.08);
}

let humOsc: OscillatorNode | null = null;
let humGain: GainNode | null = null;

export function startTransitionHum() {
  const ctx = getCtx();
  humOsc = ctx.createOscillator();
  humGain = ctx.createGain();
  humOsc.type = "sine";
  humOsc.frequency.value = 55;
  humGain.gain.setValueAtTime(0.04, ctx.currentTime);
  humOsc.connect(humGain).connect(ctx.destination);
  humOsc.start();
}

export function stopTransitionHum() {
  if (humOsc && humGain) {
    const ctx = getCtx();
    humGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    humOsc.stop(ctx.currentTime + 0.3);
    humOsc = null;
    humGain = null;
  }
}
