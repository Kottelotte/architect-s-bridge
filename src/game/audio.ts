let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Hollow metallic tick for Architect bridge building
export function playBuildTick() {
  const ctx = getCtx();
  const bufferSize = ctx.sampleRate * 0.05;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200 + Math.random() * 800;
  bp.Q.value = 12;

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

// --- Layered ambient environment ---
let ambientRunning = false;
let ambientIntervals: number[] = [];
let ambientGain: GainNode | null = null;

export function startAmbientDrone() {
  if (ambientRunning) return;
  ambientRunning = true;
  const ctx = getCtx();

  ambientGain = ctx.createGain();
  ambientGain.gain.value = 0.04;
  ambientGain.connect(ctx.destination);

  // Layer 1: Distant electrical crackle (irregular noise bursts)
  const scheduleCrackle = () => {
    if (!ambientRunning) return;
    const delay = 400 + Math.random() * 2000;
    const id = window.setTimeout(() => {
      if (!ambientRunning || !ambientGain) return;
      const c = getCtx();
      const len = 0.01 + Math.random() * 0.03;
      const bufSize = Math.floor(c.sampleRate * len);
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.3));
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2000 + Math.random() * 3000;
      const g = c.createGain();
      g.gain.value = 0.02 + Math.random() * 0.03;
      src.connect(hp).connect(g).connect(ambientGain!);
      src.start();
      src.stop(c.currentTime + len);
      scheduleCrackle();
    }, delay);
    ambientIntervals.push(id);
  };

  // Layer 2: Subtle ventilation wind (filtered noise, long duration, irregular volume)
  const scheduleWind = () => {
    if (!ambientRunning) return;
    const delay = 2000 + Math.random() * 5000;
    const id = window.setTimeout(() => {
      if (!ambientRunning || !ambientGain) return;
      const c = getCtx();
      const dur = 0.8 + Math.random() * 1.5;
      const bufSize = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        // Shaped noise: fade in and out
        const env = Math.sin((i / bufSize) * Math.PI);
        d[i] = (Math.random() * 2 - 1) * env * 0.3;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 400 + Math.random() * 300;
      lp.Q.value = 0.5;
      const g = c.createGain();
      g.gain.value = 0.015 + Math.random() * 0.02;
      src.connect(lp).connect(g).connect(ambientGain!);
      src.start();
      src.stop(c.currentTime + dur);
      scheduleWind();
    }, delay);
    ambientIntervals.push(id);
  };

  // Layer 3: Occasional metallic ticks (very sparse)
  const scheduleTick = () => {
    if (!ambientRunning) return;
    const delay = 3000 + Math.random() * 8000;
    const id = window.setTimeout(() => {
      if (!ambientRunning || !ambientGain) return;
      const c = getCtx();
      const osc = c.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 1200 + Math.random() * 2000;
      const g = c.createGain();
      g.gain.setValueAtTime(0.015 + Math.random() * 0.01, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.04);
      osc.connect(g).connect(ambientGain!);
      osc.start();
      osc.stop(c.currentTime + 0.04);
      scheduleTick();
    }, delay);
    ambientIntervals.push(id);
  };

  scheduleCrackle();
  scheduleWind();
  scheduleTick();
}

export function stopAmbientDrone() {
  if (!ambientRunning) return;
  ambientRunning = false;
  for (const id of ambientIntervals) clearTimeout(id);
  ambientIntervals = [];
  ambientGain = null;
}
