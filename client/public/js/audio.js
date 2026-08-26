/**
 * Sound Effects & Audio Engine for Left 730 Dead
 * High-performance, zero-latency procedural Web Audio synthesizer.
 * Generates custom combat, zombie, barricade, and broadcast fanfare sounds in real-time.
 */

class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.volume = 0.5; // Default 50%
    this.lastSoundTimes = new Map(); // Sound throttling map
    this.noiseBuffer = null;

    // Load saved preferences
    try {
      const savedVol = localStorage.getItem('left730_volume');
      if (savedVol !== null) this.volume = Math.max(0, Math.min(1, parseFloat(savedVol)));
      const savedMute = localStorage.getItem('left730_muted');
      if (savedMute !== null) this.isMuted = savedMute === 'true';
    } catch (e) {
      console.warn('LocalStorage not available for audio settings:', e);
    }

    this.initUserInteractionUnlock();
  }

  getAudioContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
        this.createNoiseBuffer();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  initUserInteractionUnlock() {
    const unlock = () => {
      this.getAudioContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
    try {
      localStorage.setItem('left730_volume', this.volume.toString());
    } catch (e) {}

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('left730_muted', this.isMuted.toString());
    } catch (e) {}

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  throttle(soundKey, minIntervalMs) {
    const now = performance.now();
    const last = this.lastSoundTimes.get(soundKey) || 0;
    if (now - last < minIntervalMs) return true;
    this.lastSoundTimes.set(soundKey, now);
    return false;
  }

  // -------------------------------------------------------------
  // COMBAT & WEAPON SOUNDS
  // -------------------------------------------------------------

  playGunshot(weaponType = 'pistol') {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;
    if (this.throttle(`gunshot_${weaponType}`, 45)) return;

    const t = ctx.currentTime;
    const outGain = ctx.createGain();
    outGain.connect(this.masterGain);

    if (weaponType === 'shotgun') {
      // Deep punchy bass transient + crunchy noise spread
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, t);
      osc.frequency.exponentialRampToValueAtTime(30, t + 0.22);
      oscGain.gain.setValueAtTime(0.7, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.connect(oscGain);
      oscGain.connect(outGain);
      osc.start(t);
      osc.stop(t + 0.25);

      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, t);
        filter.frequency.exponentialRampToValueAtTime(200, t + 0.28);
        
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(outGain);
        noise.start(t);
        noise.stop(t + 0.28);
      }
    } else if (weaponType === 'rifle') {
      // Sharp crack with high resonance
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(480, t);
      osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
      oscGain.gain.setValueAtTime(0.45, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(oscGain);
      oscGain.connect(outGain);
      osc.start(t);
      osc.stop(t + 0.12);

      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2400, t);
        filter.Q.value = 3.0;

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.5, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(outGain);
        noise.start(t);
        noise.stop(t + 0.14);
      }
    } else {
      // Standard Pistol Pop
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.10);
      oscGain.gain.setValueAtTime(0.4, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.10);
      osc.connect(oscGain);
      oscGain.connect(outGain);
      osc.start(t);
      osc.stop(t + 0.10);

      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, t);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.35, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(outGain);
        noise.start(t);
        noise.stop(t + 0.09);
      }
    }
  }

  playZombieHit(isCrit = false) {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;
    if (this.throttle('zombie_hit', 40)) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isCrit ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isCrit ? 220 : 160, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.09);

    gain.gain.setValueAtTime(isCrit ? 0.35 : 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  playZombieDeath(isBrute = false) {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;
    if (this.throttle('zombie_death', 60)) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isBrute ? 110 : 180, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.28);

    gain.gain.setValueAtTime(isBrute ? 0.45 : 0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.28);
  }

  playSurvivorHurt() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;
    if (this.throttle('survivor_hurt', 120)) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  // -------------------------------------------------------------
  // BARRICADE & ENVIRONMENT SOUNDS
  // -------------------------------------------------------------

  playRepair() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;
    if (this.throttle('barricade_repair', 80)) return;

    const t = ctx.currentTime;
    const pitch = 650 + (Math.random() * 150 - 75); // slight pitch variation

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, t);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.4, t + 0.07);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  playBarricadeHit() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;
    if (this.throttle('barricade_hit', 70)) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.14);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.14);
  }

  playBarricadeBreach() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;
    if (this.throttle('barricade_breach', 300)) return;

    const t = ctx.currentTime;

    // Heavy crash impact
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.6);

    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.6);

    // Wood shattering noise
    if (this.noiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, t);
      filter.Q.value = 1.5;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.7, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(t);
      noise.stop(t + 0.55);
    }
  }

  playLootPickup() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;

    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.06);

      gain.gain.setValueAtTime(0, t + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.25, t + idx * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.15);
    });
  }

  // -------------------------------------------------------------
  // GAME EVENT BROADCAST FANFARES
  // -------------------------------------------------------------

  playWaveStart() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;

    const t = ctx.currentTime;
    // Dramatic dual air-raid siren wail
    const freqs = [330, 440];
    freqs.forEach(freq => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      
      osc.frequency.setValueAtTime(freq * 0.7, t);
      osc.frequency.linearRampToValueAtTime(freq * 1.25, t + 0.6);
      osc.frequency.linearRampToValueAtTime(freq * 0.9, t + 1.2);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.22, t + 0.15);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 1.3);
    });
  }

  playWaveClear() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;

    const t = ctx.currentTime;
    const chords = [440, 554.37, 659.25, 880]; // A Major triumph
    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0, t + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, t + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.5);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.5);
    });
  }

  playLevelUp() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;

    const t = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880, 1108.73, 1318.51]; // Ascending magic arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0, t + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.2, t + idx * 0.05 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.3);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.3);
    });
  }

  playGameOver() {
    const ctx = this.getAudioContext();
    if (!ctx || this.isMuted || this.volume <= 0) return;

    const t = ctx.currentTime;
    const notes = [220, 207.65, 196, 174.61]; // Descending ominous tones
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t + idx * 0.2);

      gain.gain.setValueAtTime(0, t + idx * 0.2);
      gain.gain.linearRampToValueAtTime(0.3, t + idx * 0.2 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.2 + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t + idx * 0.2);
      osc.stop(t + idx * 0.2 + 0.45);
    });
  }
}

export const soundManager = new SoundManager();
