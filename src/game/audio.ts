let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Hollow metallic tick for Architect bridge building
export function playBuildTick() {
  const ctx = getCtx();
  // Filtered noise via short buffer
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // Bandpass filter for metallic resonance
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200 + Math.random() * 800;
  bp.Q.value = 12;

  // High-pass to remove low rumble
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1800;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.06, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

  noise.connect(bp).connect(hp).connect(gain).connect(ctx.destination);
  noise.start();
  noise.stop(ctx.currentTime + 0.05);
}

// Glitch noise burst with pitch drop for Anchor activation
export function playAnchorClick() {
  const ctx = getCtx();
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

  humOsc = ctx.createOscillator();
  humOsc.type = "sine";
  humOsc.frequency.value = 50;

  humOsc2 = ctx.createOscillator();
  humOsc2.type = "sine";
  humOsc2.frequency.value = 75;

  humLfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  humLfo.type = "sine";
  humLfo.frequency.value = 3;
  lfoGain.gain.value = 0.02;
  humLfo.connect(lfoGain);
  lfoGain.connect(humGain.gain);

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

// --- Ambient background drone ---
let droneOscs: OscillatorNode[] = [];
let droneGain: GainNode | null = null;
let droneLfo: OscillatorNode | null = null;
let droneRunning = false;

export function startAmbientDrone() {
  if (droneRunning) return;
  droneRunning = true;
  const ctx = getCtx();

  droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  droneGain.gain.linearRampToValueAtTime(0.035, ctx.currentTime + 3);

  // Low-pass filter for muffled industrial feel
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 180;
  lp.Q.value = 2;

  // Three slightly detuned oscillators for thick drone
  const freqs = [38, 39.2, 57.5];
  const types: OscillatorType[] = ["sine", "sine", "triangle"];
  for (let i = 0; i < freqs.length; i++) {
    const osc = ctx.createOscillator();
    osc.type = types[i];
    osc.frequency.value = freqs[i];
    osc.connect(lp);
    osc.start();
    droneOscs.push(osc);
  }

  // Slow LFO modulating filter cutoff for movement
  droneLfo = ctx.createOscillator();
  droneLfo.type = "sine";
  droneLfo.frequency.value = 0.08; // Very slow
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 60;
  droneLfo.connect(lfoDepth);
  lfoDepth.connect(lp.frequency);
  droneLfo.start();

  lp.connect(droneGain);
  droneGain.connect(ctx.destination);
}

export function stopAmbientDrone() {
  if (!droneRunning) return;
  droneRunning = false;
  try {
    for (const osc of droneOscs) osc.stop();
    droneLfo?.stop();
  } catch {}
  droneOscs = [];
  droneLfo = null;
  droneGain = null;
}
