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
  }

  public async resume() {
    this.init();
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
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
    const freq = this.getFrequency(index);
    this.playTone(freq, 0.1, 'sine', 0.1);
    this.triggerHaptic(HapticType.SELECTION);
  }

  /**
   * Plays a "Pop" sound
   */
  public playPop(index: number) {
    if (!this.ctx) this.init();
    const freq = this.getFrequency(index);
    
    // Procedural "Wet Bubble Pop"
    // Fast pitch decay + short envelope
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

    if (index === 0) {
        this.triggerHaptic(HapticType.HEAVY);
    }
  }

  /**
   * Plays a "Power Up" chime for long chains
   */
  public playPowerUp() {
    if (!this.ctx) this.init();
    const now = this.ctx!.currentTime;
    // Shimmering harmonic chord
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
   * Plays a "Refill" slide
   */
  public playRefill() {
    if (!this.ctx) this.init();
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
