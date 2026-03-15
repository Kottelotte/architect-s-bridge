let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

// Flesh tear + bone crack destruction sound for false victory
export function playFleshTear() {
  const ctx = getCtx();
  const dur = 0.6;

  // Wet tearing noise — filtered noise with mid-frequency emphasis
  const tearLen = Math.floor(ctx.sampleRate * 0.4);
  const tearBuf = ctx.createBuffer(1, tearLen, ctx.sampleRate);
  const td = tearBuf.getChannelData(0);
  for (let i = 0; i < tearLen; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 5) * (1 - Math.exp(-t * 80));
    // Modulated noise for wet texture
    const mod = 0.5 + 0.5 * Math.sin(t * 180);
    td[i] = (Math.random() * 2 - 1) * env * mod * 0.6;
  }
  const tearSrc = ctx.createBufferSource();
  tearSrc.buffer = tearBuf;
  const tearBp = ctx.createBiquadFilter();
  tearBp.type = "bandpass";
  tearBp.frequency.value = 900;
  tearBp.Q.value = 1.5;
  const tearGain = ctx.createGain();
  tearGain.gain.setValueAtTime(0.35, ctx.currentTime);
  tearGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  tearSrc.connect(tearBp).connect(tearGain).connect(ctx.destination);
  tearSrc.start();
  tearSrc.stop(ctx.currentTime + 0.4);

  // Bone snap — sharp transient click
  const snapLen = Math.floor(ctx.sampleRate * 0.04);
  const snapBuf = ctx.createBuffer(1, snapLen, ctx.sampleRate);
  const sd = snapBuf.getChannelData(0);
  for (let i = 0; i < snapLen; i++) {
    const t = i / snapLen;
    sd[i] = (Math.random() * 2 - 1) * Math.exp(-t * 40) * 0.9;
  }
  const snapSrc = ctx.createBufferSource();
  snapSrc.buffer = snapBuf;
  const snapHp = ctx.createBiquadFilter();
  snapHp.type = "highpass";
  snapHp.frequency.value = 1800;
  snapHp.Q.value = 8;
  const snapGain = ctx.createGain();
  snapGain.gain.setValueAtTime(0.5, ctx.currentTime);
  snapGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
  snapSrc.connect(snapHp).connect(snapGain).connect(ctx.destination);
  snapSrc.start(ctx.currentTime + 0.02); // slight delay after tear starts
  snapSrc.stop(ctx.currentTime + 0.06);

  // Low rumble — sub-frequency body
  const rumbleLen = Math.floor(ctx.sampleRate * dur);
  const rumbleBuf = ctx.createBuffer(1, rumbleLen, ctx.sampleRate);
  const rd = rumbleBuf.getChannelData(0);
  for (let i = 0; i < rumbleLen; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 4);
    rd[i] = Math.sin(t * 55 * Math.PI * 2) * env * 0.3
      + Math.sin(t * 38 * Math.PI * 2) * env * 0.2;
  }
  const rumbleSrc = ctx.createBufferSource();
  rumbleSrc.buffer = rumbleBuf;
  const rumbleLp = ctx.createBiquadFilter();
  rumbleLp.type = "lowpass";
  rumbleLp.frequency.value = 120;
  rumbleLp.Q.value = 2;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.4, ctx.currentTime);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  rumbleSrc.connect(rumbleLp).connect(rumbleGain).connect(ctx.destination);
  rumbleSrc.start();
  rumbleSrc.stop(ctx.currentTime + dur);
}

// Metallic industrial impact for Architect bridge building (noise-only)
export function playBuildTick() {
  const ctx = getCtx();
  const dur = 0.05;
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);

  for (let i = 0; i < bufSize; i++) {
    const t = i / bufSize;
    const env = Math.exp(-t * 24);
    d[i] = (Math.random() * 2 - 1) * env;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const lowBody = ctx.createBiquadFilter();
  lowBody.type = "bandpass";
  lowBody.frequency.value = 650 + Math.random() * 120;
  lowBody.Q.value = 7;

  const metalRing = ctx.createBiquadFilter();
  metalRing.type = "bandpass";
  metalRing.frequency.value = 1450 + Math.random() * 260;
  metalRing.Q.value = 11;

  const air = ctx.createBiquadFilter();
  air.type = "highpass";
  air.frequency.value = 2200;
  air.Q.value = 0.8;

  const mix = ctx.createGain();
  mix.gain.value = 1;

  const out = ctx.createGain();
  out.gain.setValueAtTime(0.24, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

  src.connect(lowBody).connect(mix);
  src.connect(metalRing).connect(mix);
  src.connect(air).connect(mix);
  mix.connect(out).connect(ctx.destination);

  src.start();
  src.stop(ctx.currentTime + dur);
}

// Heavy mechanical lock sound for Anchor activation
export function playAnchorClick() {
  const ctx = getCtx();
  const dur = 0.12;

  // Sub hit — low-frequency thud
  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.06));
  }
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = buf;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 200;
  lp.Q.value = 8;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.6, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

  noiseSrc.connect(lp).connect(noiseGain).connect(ctx.destination);
  noiseSrc.start();
  noiseSrc.stop(ctx.currentTime + dur);

  // Click transient — short sharp knock
  const clickDur = 0.03;
  const clickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * clickDur), ctx.sampleRate);
  const cd = clickBuf.getChannelData(0);
  for (let i = 0; i < cd.length; i++) {
    cd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (cd.length * 0.04));
  }
  const clickSrc = ctx.createBufferSource();
  clickSrc.buffer = clickBuf;
  const clickBp = ctx.createBiquadFilter();
  clickBp.type = "bandpass";
  clickBp.frequency.value = 400;
  clickBp.Q.value = 5;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.45, ctx.currentTime);
  clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + clickDur);
  clickSrc.connect(clickBp).connect(clickGain).connect(ctx.destination);
  clickSrc.start();
  clickSrc.stop(ctx.currentTime + clickDur);
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
  lfoGain.gain.value = 0.08;
  humLfo.connect(lfoGain);
  lfoGain.connect(humGain.gain);

  humGain.gain.setValueAtTime(0.01, ctx.currentTime);
  humGain.gain.linearRampToValueAtTime(1.1, ctx.currentTime + 1.5);

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
  ambientGain.gain.value = 2.3;
  ambientGain.connect(ctx.destination);

  // Layer 1: Filtered noise base with slow modulation (distant machinery)
  const startNoiseBase = () => {
    if (!ambientRunning || !ambientGain) return;
    const c = getCtx();
    const dur = 4 + Math.random() * 3;
    const bufSize = Math.floor(c.sampleRate * dur);
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = Math.sin((i / bufSize) * Math.PI);
      d[i] = (Math.random() * 2 - 1) * env * 0.4;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 250 + Math.random() * 150;
    lp.Q.value = 1;
    const g = c.createGain();
    g.gain.value = 0.12;
    src.connect(lp).connect(g).connect(ambientGain!);
    src.start();
    src.stop(c.currentTime + dur);
    const id = window.setTimeout(startNoiseBase, (dur * 1000) - 500 + Math.random() * 2000);
    ambientIntervals.push(id);
  };

  // Layer 2: Electrical crackle (irregular bursts)
  const scheduleCrackle = () => {
    if (!ambientRunning) return;
    const delay = 500 + Math.random() * 2500;
    const id = window.setTimeout(() => {
      if (!ambientRunning || !ambientGain) return;
      const c = getCtx();
      const len = 0.015 + Math.random() * 0.04;
      const bufSize = Math.floor(c.sampleRate * len);
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.2));
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 2500 + Math.random() * 3000;
      const g = c.createGain();
      g.gain.value = 0.06 + Math.random() * 0.05;
      src.connect(hp).connect(g).connect(ambientGain!);
      src.start();
      src.stop(c.currentTime + len);
      scheduleCrackle();
    }, delay);
    ambientIntervals.push(id);
  };

  // Layer 3: Mid-frequency texture for laptop speaker audibility
  const scheduleMidTexture = () => {
    if (!ambientRunning) return;
    const delay = 900 + Math.random() * 1800;
    const id = window.setTimeout(() => {
      if (!ambientRunning || !ambientGain) return;
      const c = getCtx();
      const dur = 0.12 + Math.random() * 0.16;
      const bufSize = Math.floor(c.sampleRate * dur);
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 700 + Math.random() * 650;
      bp.Q.value = 2.2;
      const g = c.createGain();
      g.gain.setValueAtTime(0.08 + Math.random() * 0.05, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      src.connect(bp).connect(g).connect(ambientGain!);
      src.start();
      src.stop(c.currentTime + dur);
      scheduleMidTexture();
    }, delay);
    ambientIntervals.push(id);
  };

  // Layer 4: Sparse metallic ticks
  const scheduleTick = () => {
    if (!ambientRunning) return;
    const delay = 3000 + Math.random() * 8000;
    const id = window.setTimeout(() => {
      if (!ambientRunning || !ambientGain) return;
      const c = getCtx();
      const tickDur = 0.05;
      const bufSize = Math.floor(c.sampleRate * tickDur);
      const buf = c.createBuffer(1, bufSize, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.05));
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1500 + Math.random() * 2000;
      bp.Q.value = 18;
      const g = c.createGain();
      g.gain.setValueAtTime(0.04 + Math.random() * 0.03, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + tickDur);
      src.connect(bp).connect(g).connect(ambientGain!);
      src.start();
      src.stop(c.currentTime + tickDur);
      scheduleTick();
    }, delay);
    ambientIntervals.push(id);
  };

  startNoiseBase();
  scheduleCrackle();
  scheduleMidTexture();
  scheduleTick();
}

export function stopAmbientDrone() {
  if (!ambientRunning) return;
  ambientRunning = false;
  for (const id of ambientIntervals) clearTimeout(id);
  ambientIntervals = [];
  ambientGain = null;
}

// Deep distant impact for martyr materialization on horizon — LOUD
export function playMartyrAppear() {
  const ctx = getCtx();
  const dur = 1.5;

  const bufSize = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 2.0);
    d[i] = Math.sin(t * 32 * Math.PI * 2) * env * 0.5
      + Math.sin(t * 20 * Math.PI * 2) * env * 0.35
      + Math.sin(t * 48 * Math.PI * 2) * env * 0.15
      + (Math.random() * 2 - 1) * Math.exp(-t * 6) * 0.12;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 100;
  lp.Q.value = 2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.8, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + dur);
}

// Massive stone gate slam for ending sequence
export function playGateSlam() {
  const ctx = getCtx();
  const dur = 2.0;

  // Heavy impact transient
  const impactLen = Math.floor(ctx.sampleRate * 0.15);
  const impactBuf = ctx.createBuffer(1, impactLen, ctx.sampleRate);
  const id = impactBuf.getChannelData(0);
  for (let i = 0; i < impactLen; i++) {
    const t = i / ctx.sampleRate;
    id[i] = (Math.random() * 2 - 1) * Math.exp(-t * 20) * 0.9;
  }
  const impactSrc = ctx.createBufferSource();
  impactSrc.buffer = impactBuf;
  const impactLp = ctx.createBiquadFilter();
  impactLp.type = "lowpass";
  impactLp.frequency.value = 150;
  impactLp.Q.value = 4;
  const impactGain = ctx.createGain();
  impactGain.gain.setValueAtTime(1.0, ctx.currentTime);
  impactGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  impactSrc.connect(impactLp).connect(impactGain).connect(ctx.destination);
  impactSrc.start();
  impactSrc.stop(ctx.currentTime + 0.3);

  // Reverberant sub-bass decay
  const revLen = Math.floor(ctx.sampleRate * dur);
  const revBuf = ctx.createBuffer(1, revLen, ctx.sampleRate);
  const rd = revBuf.getChannelData(0);
  for (let i = 0; i < revLen; i++) {
    const t = i / ctx.sampleRate;
    const env = Math.exp(-t * 1.5);
    rd[i] = (Math.sin(t * 28 * Math.PI * 2) * 0.3
      + Math.sin(t * 42 * Math.PI * 2) * 0.15
      + Math.sin(t * 18 * Math.PI * 2) * 0.2) * env
      + (Math.random() * 2 - 1) * Math.exp(-t * 3) * 0.08;
  }
  const revSrc = ctx.createBufferSource();
  revSrc.buffer = revBuf;
  const revLp = ctx.createBiquadFilter();
  revLp.type = "lowpass";
  revLp.frequency.value = 100;
  revLp.Q.value = 2;
  const revGain = ctx.createGain();
  revGain.gain.setValueAtTime(0.5, ctx.currentTime);
  revGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  revSrc.connect(revLp).connect(revGain).connect(ctx.destination);
  revSrc.start();
  revSrc.stop(ctx.currentTime + dur);
}
