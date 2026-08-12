let ctx;

function getCtx() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    ctx = new AudioCtx();
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

export function primeAudio() {
  getCtx();
}

export function playBell() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const partials = [
    { freq: 987.77, gain: 0.28, decay: 1.3 },
    { freq: 1567.98, gain: 0.16, decay: 1.05 },
    { freq: 2349.32, gain: 0.09, decay: 0.8 },
  ];
  partials.forEach(({ freq, gain, decay }) => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(gain, now + 0.008);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + decay + 0.05);
  });
}
