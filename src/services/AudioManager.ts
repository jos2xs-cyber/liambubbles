/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

enum HapticType {
  SELECTION = 'selection',
  HEAVY = 'heavy',
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private loadPromise: Promise<void> | null = null;

  // Major Scale: C, D, E, F, G, A, B, C
  private readonly scaleIndices = [0, 2, 4, 5, 7, 9, 11, 12];
  private readonly baseFreq = 261.63; // C4

  constructor() {
    // Context is initialized on first user interaction
  }

  private init() {
    if (this.ctx) return;

    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    this.ctx = new AudioContextClass();
    this.compressor = this.ctx.createDynamicsCompressor();
    this.masterGain = this.ctx.createGain();

    this.masterGain.connect(this.ctx.destination);
    this.compressor.connect(this.masterGain);

    this.masterGain.gain.value = 0.4;

    // Android Chrome suspends AudioContext when the page is backgrounded
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.ctx?.state === 'suspended') {
        this.ctx.resume();
      }
    });
  }

  private async loadBuffers() {
    if (!this.ctx) return;

    const sfx = ['pop', 'connect', 'power_up', 'epic_pop', 'legendary_pop', 'refill', 'clapping'];
    const voices = [
      'amazing_spider_kid', 'wow_you_are_good', 'pirates_booty', 'lightning_boy',
      'crazy_cool', 'epic_tacos', 'super_stinky', 'spicy_bananas',
      'turbo_pants', 'cosmic_waffles', 'captain_noodles',
      'rocket_monkey', 'laser_toes', 'taco_thunder', 'flying_underpants',
      'pickle_explosion', 'sneaky_pancakes', 'monster_muffins',
      'amazing', 'incredible', 'legendary', 'epic', 'outstanding', 'phenomenal', 'i_see_you',
    ];

    await Promise.allSettled([
      ...sfx.map(async (name) => {
        try {
          const res = await fetch(`/sounds/${name}.wav`);
          if (!res.ok) return;
          this.buffers.set(name, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
        } catch { /* fall back to procedural */ }
      }),
      ...['fart1', 'fart2'].map(async (name) => {
        try {
          const res = await fetch(`/sounds/${name}.mp3`);
          if (!res.ok) return;
          this.buffers.set(name, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
        } catch { /* fall back to procedural */ }
      }),
      ...voices.map(async (word) => {
        try {
          const res = await fetch(`/sounds/voice/${word}.mp3`);
          if (!res.ok) return;
          this.buffers.set(`voice_${word}`, await this.ctx!.decodeAudioData(await res.arrayBuffer()));
        } catch { /* fall back to speech synthesis */ }
      }),
    ]);
  }

  public async resume() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.loadPromise) {
      this.loadPromise = this.loadBuffers();
    }
    await this.loadPromise;
  }

  private playBuffer(name: string, volume = 1.0): boolean {
    const buf = this.buffers.get(name);
    if (!buf || !this.ctx) return false;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    src.buffer = buf;
    gain.gain.value = volume;
    src.connect(gain);
    gain.connect(this.compressor!);
    src.start();
    return true;
  }

  /**
   * Calculates the frequency based on chain length
   */
  public getFrequency(index: number): number {
    const scaleLen = this.scaleIndices.length;
    const octave = Math.floor(index / scaleLen);
    const noteInScale = index % scaleLen;
    const semitones = this.scaleIndices[noteInScale] + (octave * 12);
    return this.baseFreq * Math.pow(2, semitones / 12);
  }

  /**
   * Plays a "Connect" chime
   */
  public playConnect(index: number) {
    if (!this.ctx) this.init();
    if (this.playBuffer('connect', 0.7)) {
      this.triggerHaptic(HapticType.SELECTION);
      return;
    }
    const freq = this.getFrequency(index);
    this.playTone(freq, 0.1, 'sine', 0.1);
    this.triggerHaptic(HapticType.SELECTION);
  }

  /**
   * Plays a "Pop" sound
   */
  public playPop(index: number) {
    if (!this.ctx) this.init();
    if (this.playBuffer('pop', 0.8)) {
      if (index === 0) this.triggerHaptic(HapticType.HEAVY);
      return;
    }
    const freq = this.getFrequency(index);

    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 1.5, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.1, now + 0.05);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.compressor!);

    osc.start(now);
    osc.stop(now + 0.1);

    if (index === 0) this.triggerHaptic(HapticType.HEAVY);
  }

  /**
   * Plays a "Power Up" chime for long chains (during drag)
   */
  public playPowerUp() {
    if (!this.ctx) this.init();
    if (this.playBuffer('power_up', 0.9)) return;
    const now = this.ctx!.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + (i * 0.02));

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.05 + (i * 0.02));
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(this.compressor!);

      osc.start(now);
      osc.stop(now + 0.5);
    });
  }

  /**
   * Plays an "Epic Pop" sound for 5–7 bubble chains
   */
  public playEpicPop() {
    if (!this.ctx) this.init();
    if (this.playBuffer('epic_pop', 1.0)) return;
    const now = this.ctx!.currentTime;
    const freqs = [523.25, 587.33, 659.25, 783.99, 1046.50];
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + (i * 0.04));

      gain.gain.setValueAtTime(0, now + (i * 0.04));
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05 + (i * 0.04));
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + (i * 0.04));

      osc.connect(gain);
      gain.connect(this.compressor!);

      osc.start(now + (i * 0.04));
      osc.stop(now + 0.7 + (i * 0.04));
    });
  }

  /**
   * Plays a pre-generated neural voice clip for the exclamation word,
   * with bass boost and slight pitch-down for a dramatic effect.
   * Falls back to speech synthesis if the clip isn't loaded yet.
   */
  public speakExclamation(word: string) {
    const fileKey = word.toLowerCase().replace(/!/g, '').trim().replace(/\s+/g, '_');
    const spokenText = word.replace(/!/g, '').trim(); // keep spaces for TTS
    const buf = this.buffers.get(`voice_${fileKey}`);

    if (buf && this.ctx) {
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();

      src.buffer = buf;
      src.playbackRate.value = 1.0;
      gain.gain.value = 2.5;

      src.connect(gain);
      gain.connect(this.masterGain!);
      src.start();
      return;
    }

    // Fallback: speech synthesis (robotic but functional)
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(spokenText);
    utter.pitch = 0.4;
    utter.rate = 0.6;
    utter.volume = 1.0;
    const applyVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      const male = voices.find(v => /male|david|alex|mark|james|daniel/i.test(v.name))
        || voices.find(v => v.lang.startsWith('en')) || voices[0];
      if (male) utter.voice = male;
    };
    applyVoice();
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.addEventListener('voiceschanged', applyVoice, { once: true });
    }
    window.speechSynthesis.speak(utter);
  }

  /**
   * Plays a "Legendary Pop" fanfare for 7+ bubble chains
   */
  public playLegendaryPop() {
    if (!this.ctx) this.init();
    if (this.playBuffer('legendary_pop', 1.0)) return;
    const now = this.ctx!.currentTime;

    // Bass hit
    const bassOsc = this.ctx!.createOscillator();
    const bassGain = this.ctx!.createGain();
    bassOsc.type = 'sine';
    bassOsc.frequency.setValueAtTime(65.41, now);
    bassOsc.frequency.exponentialRampToValueAtTime(32.7, now + 0.3);
    bassGain.gain.setValueAtTime(0.3, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    bassOsc.connect(bassGain);
    bassGain.connect(this.compressor!);
    bassOsc.start(now);
    bassOsc.stop(now + 0.5);

    // Fanfare chord (staggered)
    const fanfareFreqs = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    fanfareFreqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = i < 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, now + (i * 0.03));
      gain.gain.setValueAtTime(0, now + (i * 0.03));
      gain.gain.linearRampToValueAtTime(0.06, now + 0.05 + (i * 0.03));
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(now + (i * 0.03));
      osc.stop(now + 0.9);
    });

    // Sweeping whoosh
    const sweepOsc = this.ctx!.createOscillator();
    const sweepGain = this.ctx!.createGain();
    sweepOsc.type = 'sine';
    sweepOsc.frequency.setValueAtTime(200, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(2000, now + 0.4);
    sweepGain.gain.setValueAtTime(0.05, now);
    sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    sweepOsc.connect(sweepGain);
    sweepGain.connect(this.compressor!);
    sweepOsc.start(now);
    sweepOsc.stop(now + 0.5);
  }

  /**
   * Plays the secret fart sound for the long-press Easter egg
   */
  public playFart() {
    if (!this.ctx) this.init();
    const key = this.buffers.has('fart1') || this.buffers.has('fart2')
      ? (Math.random() < 0.5 ? 'fart1' : 'fart2')
      : 'fart_missing';
    if (this.playBuffer(key, 2.5)) return;

    // Procedural fallback
    const now = this.ctx!.currentTime;
    const sr = this.ctx!.sampleRate;
    const N = Math.floor(sr * 0.75);
    const buf = this.ctx!.createBuffer(1, N, sr);
    const data = buf.getChannelData(0);
    let phase = 0;
    for (let i = 0; i < N; i++) {
      const t = i / sr;
      const freq = 110 * Math.exp(-t / 0.18) + 40;
      phase += (2 * Math.PI * freq) / sr;
      const env = Math.exp(-t / 0.22) * Math.min(t / 0.008, 1.0);
      data[i] = (Math.sin(phase) * 0.6 + (Math.random() * 2 - 1) * 0.35) * env;
    }
    const src = this.ctx!.createBufferSource();
    const gain = this.ctx!.createGain();
    src.buffer = buf;
    gain.gain.value = 2.0;
    src.connect(gain);
    gain.connect(this.compressor!);
    src.start(now);
  }

  /**
   * Plays a soft cascade of bloop tones as new bubbles rain down
   */
  public playBubbleRain(count: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 587.33, 659.25, 783.99, 880.00];
    const num = Math.min(count, 5);
    for (let i = 0; i < num; i++) {
      const t = now + i * 0.09;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(notes[i] * 1.4, t);
      osc.frequency.exponentialRampToValueAtTime(notes[i], t + 0.05);
      gain.gain.setValueAtTime(0.07, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      osc.connect(gain);
      gain.connect(this.compressor!);
      osc.start(t);
      osc.stop(t + 0.15);
    }
  }

  /**
   * Plays crowd clapping for 7+ chains
   */
  public playClapping() {
    if (!this.ctx) this.init();
    if (this.playBuffer('clapping', 1.0)) return;

    // Procedural fallback: 7 sharp noise bursts
    const now = this.ctx!.currentTime;
    for (let i = 0; i < 7; i++) {
      const t = now + i * 0.18;
      const buf = this.ctx!.createBuffer(1, Math.floor(this.ctx!.sampleRate * 0.065), this.ctx!.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < data.length; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (data.length * 0.25));
      }
      const src = this.ctx!.createBufferSource();
      const gain = this.ctx!.createGain();
      src.buffer = buf;
      gain.gain.setValueAtTime(0.5, t);
      src.connect(gain);
      gain.connect(this.compressor!);
      src.start(t);
    }
  }

  /**
   * Plays a "Refill" slide
   */
  public playRefill() {
    if (!this.ctx) this.init();
    if (this.playBuffer('refill', 0.7)) return;
    const now = this.ctx!.currentTime;
    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.compressor!);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  private playTone(freq: number, duration: number, type: OscillatorType, volume: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.compressor!);

    osc.start(now);
    osc.stop(now + duration);
  }

  private triggerHaptic(type: HapticType) {
    if (!('vibrate' in navigator)) return;

    if (type === HapticType.SELECTION) {
      navigator.vibrate(10);
    } else if (type === HapticType.HEAVY) {
      navigator.vibrate([20, 10, 20]);
    }
  }
}

export const audioManager = new AudioManager();
export default audioManager;
