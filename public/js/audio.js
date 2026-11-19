// Web Audio API Synthesizer for CS:GO sound effects
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.speechEnabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playShoot(weapon = 'ak47') {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    if (weapon === 'awp') {
      // Thunderous AWP blast
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.35);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      // Noise burst for crack
      const noise = this.createNoiseBuffer(0.2);
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noise;
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.8, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      noiseNode.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
      noiseNode.start(now);
    } else if (weapon === 'm4a1') {
      // Silenced M4A1
      const noise = this.createNoiseBuffer(0.08);
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noiseNode.start(now);
    } else if (weapon === 'ak47') {
      // Crisp AK47 punch
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      const noise = this.createNoiseBuffer(0.12);
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = noise;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.5, now);
      nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      noiseNode.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
      noiseNode.start(now);
    } else {
      // Pistol pop
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(350, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.08);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    }
  }

  playHeadshot() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Metallic bell dink
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1800, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2600, now);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.25);
    osc2.stop(now + 0.25);
  }

  playFlashbang() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Pop
    const noise = this.createNoiseBuffer(0.15);
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;
    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(0.8, now);
    nGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    noiseNode.connect(nGain);
    nGain.connect(this.ctx.destination);
    noiseNode.start(now);

    // High tinnitus ringing
    const ring = this.ctx.createOscillator();
    const ringGain = this.ctx.createGain();
    ring.type = 'sine';
    ring.frequency.setValueAtTime(3800, now);
    ringGain.gain.setValueAtTime(0.2, now);
    ringGain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

    ring.connect(ringGain);
    ringGain.connect(this.ctx.destination);
    ring.start(now + 0.05);
    ring.stop(now + 2.25);
  }

  playSmoke() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    // Hissing bloom sound
    const noise = this.createNoiseBuffer(0.8);
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.4);
    filter.frequency.linearRampToValueAtTime(200, now + 0.8);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    noiseNode.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noiseNode.start(now);
  }

  playBombBeep(urgency = 1) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    // Frequency rises as bomb gets closer to 0
    const freq = 1900 + (urgency * 400);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  playBombPlanted() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1200, now);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2400, now + 0.1);

    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.15);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.3);

    this.speak("The bomb has been planted!");
  }

  playBombDropped() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.22);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playBombPickup() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(620, now + 0.16);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  playDefuseStart() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.linearRampToValueAtTime(1000, now + 0.1);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);

    this.speak("Defusing bomb!");
  }

  playBombDefused() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    [1046, 1318, 1567, 2093].forEach((f, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      gain.gain.setValueAtTime(0.3, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
    });

    this.speak("Bomb has been defused! Counter-Terrorists win!");
  }

  playBombExplosion() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    // Heavy bass oscillator drop
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, now);
    osc.frequency.exponentialRampToValueAtTime(20, now + 1.2);
    oscGain.gain.setValueAtTime(0.9, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);

    // Rumble noise
    const noise = this.createNoiseBuffer(1.5);
    const noiseNode = this.ctx.createBufferSource();
    noiseNode.buffer = noise;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + 1.4);

    const nGain = this.ctx.createGain();
    nGain.gain.setValueAtTime(1.0, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    noiseNode.connect(filter);
    filter.connect(nGain);
    nGain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.5);
    noiseNode.start(now);

    this.speak("Terrorists win!");
  }

  playRoundWin(winner) {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (winner === 'ct') {
      // Counter-Terrorists win fanfare
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.12);
        gain.gain.setValueAtTime(0.3, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.35);
      });
      this.speak("Counter-Terrorists win!");
    } else {
      // Terrorists win fanfare
      [440, 415.3, 392, 349.2].forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f, now + i * 0.14);
        gain.gain.setValueAtTime(0.25, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.4);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.4);
      });
      this.speak("Terrorists win!");
    }
  }

  speak(text) {
    if (!this.speechEnabled || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.15;
      utterance.pitch = 0.95;
      utterance.volume = 0.7;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Ignore speech synthesis errors if blocked
    }
  }

  createNoiseBuffer(duration) {
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }
}

window.soundEngine = new SoundEngine();
