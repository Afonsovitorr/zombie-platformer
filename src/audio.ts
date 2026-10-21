// All sound is synthesized with WebAudio, so the game ships no audio files.
export type Sfx =
  | 'swing' | 'hit' | 'heavy' | 'parry' | 'block' | 'hurt' | 'dodge'
  | 'jump' | 'bow' | 'death' | 'fire' | 'growl' | 'land';

// A-minor pentatonic, used for the sparse melody notes.
const SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];
// Pad chords (root, fifth) per bar: Am, F, G, Em.
const CHORDS: [number, number][] = [[55, 82.41], [43.65, 65.41], [49, 73.42], [41.2, 61.74]];
const BAR = 8;

export class GameAudio {
  muted = false;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private lastPlayed = new Map<Sfx, number>();
  private nextBar = 0;
  private barIndex = 0;

  // Browsers only allow audio after a user gesture; call this from the first input.
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.35;
      this.musicBus.connect(this.master);

      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.nextBar = this.ctx.currentTime + 0.2;
      setInterval(() => this.scheduleMusic(), 1000);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.8;
    return this.muted;
  }

  play(name: Sfx) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const now = ctx.currentTime;
    if (now - (this.lastPlayed.get(name) ?? -1) < 0.05) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'swing': this.noise(0.12, 'bandpass', 800, 2500, 0.22); break;
      case 'hit':
        this.tone(160, 60, 0.12, 'triangle', 0.45);
        this.noise(0.08, 'lowpass', 1200, 400, 0.3);
        break;
      case 'heavy':
        this.tone(110, 40, 0.3, 'triangle', 0.6);
        this.noise(0.14, 'lowpass', 1500, 300, 0.4);
        break;
      case 'parry':
        this.tone(1200, 1800, 0.25, 'sine', 0.3);
        this.tone(2400, 2400, 0.15, 'sine', 0.15);
        break;
      case 'block':
        this.noise(0.08, 'bandpass', 600, 600, 0.3);
        this.tone(300, 200, 0.1, 'square', 0.12);
        break;
      case 'hurt': this.tone(300, 100, 0.25, 'sawtooth', 0.3); break;
      case 'dodge': this.noise(0.2, 'highpass', 1000, 3000, 0.14); break;
      case 'jump': this.tone(250, 500, 0.12, 'sine', 0.15); break;
      case 'bow':
        this.tone(600, 200, 0.12, 'triangle', 0.25);
        this.noise(0.06, 'highpass', 2000, 2000, 0.15);
        break;
      case 'death': this.tone(200, 50, 0.5, 'sawtooth', 0.3); break;
      case 'fire':
        this.noise(0.4, 'lowpass', 800, 800, 0.2);
        this.tone(400, 800, 0.3, 'sine', 0.12);
        break;
      case 'growl': this.tone(70, 55, 0.35, 'sawtooth', 0.18); break;
      case 'land': this.noise(0.1, 'lowpass', 300, 200, 0.3); break;
    }
  }

  private tone(f0: number, f1: number, dur: number, type: OscillatorType, vol: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, filter: BiquadFilterType, f0: number, f1: number, vol: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Dark ambient: a slow detuned pad that changes chord every bar, plus sparse bell-like notes.
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || ctx.currentTime < this.nextBar - 1.5) return;
    const t = this.nextBar;
    const [root, fifth] = CHORDS[this.barIndex++ % CHORDS.length];

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.22, t + 2);
    env.gain.linearRampToValueAtTime(0.0001, t + BAR + 1.5);
    filter.connect(env).connect(this.musicBus);
    for (const [f, detune] of [[root, -6], [root, 7], [fifth, 0], [root * 2, 3]] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + BAR + 1.6);
    }

    for (let i = 0; i < 3; i++) {
      if (Math.random() < 0.35) continue;
      const nt = t + 1 + i * 2.5 + Math.random();
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = SCALE[Math.floor(Math.random() * SCALE.length)];
      g.gain.setValueAtTime(0.0001, nt);
      g.gain.linearRampToValueAtTime(0.1, nt + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, nt + 2.5);
      osc.connect(g).connect(this.musicBus);
      osc.start(nt);
      osc.stop(nt + 2.6);
    }

    this.nextBar += BAR;
  }
}
