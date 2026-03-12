let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Hollow metallic tick for Architect bridge building
export function playBuildTick() {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 1200 + Math.random() * 600;
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.06);
  gain.gain.setValueAtTime(0.04, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.06);
}

// Glitch noise burst with pitch drop for Anchor activation
export function playAnchorClick() {
  const ctx = getCtx();
  // Noise-like burst using two detuned oscillators
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();
  osc1.type = "sawtooth";
  osc2.type = "square";
  osc1.frequency.value = 600;
  osc2.frequency.value = 620;
  osc1.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);
  osc2.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.07, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);
  osc1.start();
  osc2.start();
  osc1.stop(ctx.currentTime + 0.1);
  osc2.stop(ctx.currentTime + 0.1);
}

let humOsc: OscillatorNode | null = null;
let humOsc2: OscillatorNode | null = null;
let humGain: GainNode | null = null;
let humLfo: OscillatorNode | null = null;

// Ominous growing hum for level transitions
export function startTransitionHum() {
  const ctx = getCtx();
  humGain = ctx.createGain();
  
  // Main low drone
  humOsc = ctx.createOscillator();
  humOsc.type = "sine";
  humOsc.frequency.value = 50;
  
  // Second harmonic for thickness
  humOsc2 = ctx.createOscillator();
  humOsc2.type = "sine";
  humOsc2.frequency.value = 75;
  
  // LFO for volume oscillation
  humLfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  humLfo.type = "sine";
  humLfo.frequency.value = 3;
  lfoGain.gain.value = 0.02;
  humLfo.connect(lfoGain);
  lfoGain.connect(humGain.gain);
  
  // Start quiet, grow louder
  humGain.gain.setValueAtTime(0.01, ctx.currentTime);
  humGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 1.5);
  
  humOsc.connect(humGain);
  humOsc2.connect(humGain);
  humGain.connect(ctx.destination);
  
  humOsc.start();
  humOsc2.start();
  humLfo.start();
}

export function stopTransitionHum() {
  if (humOsc && humGain) {
    try {
      humOsc.stop();
      humOsc2?.stop();
      humLfo?.stop();
    } catch {}
    humOsc = null;
    humOsc2 = null;
    humGain = null;
    humLfo = null;
  }
}
