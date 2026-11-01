// Original synthesized soundscape: no external samples or network requests.
export class GameAudio {
  constructor() { this.enabled = true; this.volume = .55; this.last = {}; this.nextAmbient = 0; }
  unlock() {
    if (!this.enabled) return;
    try {
      if (!this.context) {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.context.createGain(); this.master.gain.value = this.volume;
        const compressor = this.context.createDynamicsCompressor(); this.master.connect(compressor); compressor.connect(this.context.destination);
        const rate = this.context.sampleRate;
        this.noiseBuffer = this.context.createBuffer(1, rate, rate);
        const samples = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < rate; i++) samples[i] = Math.random() * 2 - 1;
      }
      if (this.context.state === 'suspended') this.context.resume();
    } catch { this.enabled = false; }
  }
  setVolume(value) { this.volume = Math.max(0, Math.min(1, value)); if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, .04); }
  toggle() { this.enabled = !this.enabled; if (this.enabled) this.unlock(); this.setVolume(this.volume); return this.enabled; }
  tone(from, to, duration, volume = .1, type = 'sine', delay = 0) {
    const c = this.context, time = c.currentTime + delay, oscillator = c.createOscillator(), gain = c.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(from, time); oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + duration);
    gain.gain.setValueAtTime(.001, time); gain.gain.exponentialRampToValueAtTime(volume, time + .008); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(time); oscillator.stop(time + duration + .02);
  }
  noise(duration, frequency, volume = .1, delay = 0) {
    const c = this.context, time = c.currentTime + delay, source = c.createBufferSource(), filter = c.createBiquadFilter(), gain = c.createGain();
    source.buffer = this.noiseBuffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .7;
    gain.gain.setValueAtTime(volume, time); gain.gain.exponentialRampToValueAtTime(.001, time + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(time); source.stop(time + duration);
  }
  play(kind, style) {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (now - (this.last[kind] ?? -10) < (kind === 'hit' ? .055 : .03)) return;
    this.last[kind] = now;
    if (kind === 'step') { this.noise(.06, 350 + Math.random() * 300, .09); this.tone(80, 45, .06, .025); }
    else if (kind === 'lancer') { this.noise(.18, 2100, .2); this.tone(420, 120, .15, .07, 'triangle'); }
    else if (kind === 'berserker') { this.noise(.25, 700, .28); this.tone(180, 45, .23, .16, 'triangle'); }
    else if (kind === 'archer') { this.tone(720, 210, .11, .13, 'triangle'); this.noise(.17, 3400, .12); }
    else if (kind === 'mage') { this.tone(280, 980, .25, .1, 'triangle'); this.tone(560, 1960, .3, .045); this.noise(.2, 1800, .055); }
    else if (kind === 'hit') { this.noise(.09, 1700, .17); this.tone(180, 55, .09, .15, 'triangle'); }
    else if (kind === 'damage') { this.noise(.16, 350, .24); this.tone(95, 35, .22, .17, 'sawtooth'); }
    else if (kind === 'skill') { this.play(style); this.tone(140, 700, .4, .12); this.noise(.45, 1400, .16); }
    else if (kind === 'meteor' || kind === 'bossAttack') { this.noise(.55, 180, .3); this.tone(120, 28, .6, .22, 'triangle'); }
    else if (kind === 'enemyAttack') { this.noise(.2, 800, .15); this.tone(160, 60, .17, .08); }
    else if (kind === 'warning') { this.tone(240, 290, .18, .045, 'triangle'); }
    else if (kind === 'splash') { this.noise(.35, 850, .2); this.tone(300, 80, .2, .08); }
    else if (kind === 'dash') { this.noise(.2, 2400, .16); }
    else if (kind === 'defeat') { this.tone(180, 40, .3, .1); this.noise(.2, 500, .09); }
    else {
      const melodies = { loot: [660, 880], coin: [1046, 1318], equip: [440, 660], heal: [440, 554, 660], level: [523, 659, 784, 1046], boss: [330, 440, 554, 660], victory: [523, 659, 784, 1046, 1318] };
      const notes = melodies[kind]; if (notes) notes.forEach((n, i) => this.tone(n, n * 1.002, .24, .085, 'sine', i * .085));
    }
  }
  ambience(game) {
    if (!this.enabled || !this.context || this.context.state !== 'running' || game.paused || game.status !== 'playing') return;
    const now = this.context.currentTime; if (now < this.nextAmbient) return;
    this.nextAmbient = now + 3.8;
    const root = [130.81, 146.83, 110][game.floor - 1];
    this.tone(root, root, 3.6, .022); this.tone(root * 1.5, root * 1.5, 3.4, .013, 'sine', .1);
    this.noise(.8, game.safe ? 1100 : 2100, game.safe ? .025 : .014);
    if (game.floor === 1) { this.tone(1800, 2400, .12, .015, 'sine', 1.2); this.tone(2300, 1700, .13, .013, 'sine', 1.4); }
  }
}
