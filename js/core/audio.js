// Procedural Audio System for PHLY - All sounds synthesized via Web Audio API
const AudioSystem = {
  ctx: null,
  masterGain: null,
  sfxGain: null,
  musicGain: null,
  engineOsc: null,
  engineGain: null,
  engineFilter: null,
  afterburnerNoise: null,
  afterburnerGain: null,
  isInitialized: false,

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = GAME_SETTINGS.volumeMaster;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = GAME_SETTINGS.volumeSFX;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = GAME_SETTINGS.volumeMusic;
      this.musicGain.connect(this.masterGain);

      this._initEngine();
      this._initMusic();
      this.isInitialized = true;
      console.log('[PHLY][Audio] Initialized');
    } catch (e) {
      console.warn('[PHLY][Audio] Failed to initialize:', e.message);
    }
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  _initEngine() {
    // Engine fundamental
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 80;

    // Second harmonic
    const harmonic = this.ctx.createOscillator();
    harmonic.type = 'sawtooth';
    harmonic.frequency.value = 160;
    const harmonicGain = this.ctx.createGain();
    harmonicGain.gain.value = 0.25;
    harmonic.connect(harmonicGain);

    // Bandpass filter for intake roar
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'bandpass';
    this.engineFilter.frequency.value = 200;
    this.engineFilter.Q.value = 2;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.15;

    this.engineOsc.connect(this.engineFilter);
    harmonicGain.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc.start();
    harmonic.start();

    // Afterburner noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    this.afterburnerNoise = this.ctx.createBufferSource();
    this.afterburnerNoise.buffer = noiseBuffer;
    this.afterburnerNoise.loop = true;

    const abFilter = this.ctx.createBiquadFilter();
    abFilter.type = 'lowpass';
    abFilter.frequency.value = 600;

    this.afterburnerGain = this.ctx.createGain();
    this.afterburnerGain.gain.value = 0;

    this.afterburnerNoise.connect(abFilter);
    abFilter.connect(this.afterburnerGain);
    this.afterburnerGain.connect(this.sfxGain);
    this.afterburnerNoise.start();
  },

  updateEngine(throttle, afterburner, speed) {
    if (!this.isInitialized) return;
    const freq = 80 + throttle * 240; // 80-320 Hz
    this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);
    this.engineFilter.frequency.setTargetAtTime(100 + throttle * 400, this.ctx.currentTime, 0.1);
    this.engineGain.gain.setTargetAtTime(0.08 + throttle * 0.12, this.ctx.currentTime, 0.05);
    this.afterburnerGain.gain.setTargetAtTime(afterburner ? 0.15 : 0, this.ctx.currentTime, 0.1);
  },

  playGunshot(gunId) {
    if (!this.isInitialized) return;
    const gun = EQUIPMENT.guns.find(g => g.id === gunId);
    if (!gun) return;

    const duration = gunId === 'g105mm' ? 0.08 : (gunId === 'g30mm' ? 0.015 : 0.025);
    const pitch = gunId === 'g105mm' ? 60 : (gunId === 'g762' ? 800 : 400);

    // Noise burst
    const bufSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      const env = 1 - i / bufSize;
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = pitch;
    filter.Q.value = 1;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.3;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration * 2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start();

    // 105mm recoil LFO
    if (gunId === 'g105mm') {
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 8;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 0.2;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
      lfo.stop(this.ctx.currentTime + 0.15);
    }
  },

  playExplosion(position, radius) {
    if (!this.isInitialized) return;
    radius = radius || 10;
    const dist = position ? FlightPhysics.position.distanceTo(position) : 0;
    const volume = PHLYMath.clamp(1 - dist / 5000, 0.05, 1);

    // Low frequency boom
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 30 + radius;
    osc.frequency.exponentialRampToValueAtTime(20, this.ctx.currentTime + 1.5);

    const gain = this.ctx.createGain();
    gain.gain.value = volume * 0.5;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 1.5);

    // Broadband noise burst
    const bufSize = Math.floor(this.ctx.sampleRate * 0.3);
    const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize);
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.value = volume * 0.4;
    noiseSource.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSource.start();
  },

  playMissileLaunch() {
    if (!this.isInitialized) return;
    // Rising frequency sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 2);

    const gain = this.ctx.createGain();
    gain.gain.value = 0.2;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 2.5);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 600;
    filter.Q.value = 3;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 2.5);
  },

  playMissileWarning() {
    if (!this.isInitialized) return;
    // 880 Hz beeping alarm
    const beepDuration = 0.1;
    const beepGap = 0.15;
    for (let i = 0; i < 8; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 880;
      const gain = this.ctx.createGain();
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(this.sfxGain);
      const startTime = this.ctx.currentTime + i * (beepDuration + beepGap);
      osc.start(startTime);
      osc.stop(startTime + beepDuration);
    }
  },

  playHit() {
    if (!this.isInitialized) return;
    // Metallic impact
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 1200;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  },

  playLockTone(quality) {
    if (!this.isInitialized) return;
    // 440-660 Hz based on lock quality
    const freq = 440 + quality * 220;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.value = quality * 0.1;
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  },

  // Procedural music system
  _musicNodes: [],
  _musicTension: 'calm',
  _musicTimer: 0,
  _chordIndex: 0,

  _initMusic() {
    // Simple procedural music: chord progressions driven by tension
    this._chords = {
      calm: [[262, 330, 392], [294, 370, 440], [330, 415, 494], [262, 330, 392]],
      alert: [[262, 311, 392], [294, 349, 440], [330, 392, 494], [262, 311, 392]],
      combat: [[262, 311, 370], [294, 349, 415], [330, 392, 466], [349, 415, 523]],
      climax: [[262, 311, 370, 466], [294, 349, 440, 523], [330, 415, 494, 587], [349, 440, 523, 659]],
    };
  },

  updateMusic(dt, tension) {
    if (!this.isInitialized) return;
    this._musicTension = tension || 'calm';
    this._musicTimer += dt;

    const bpm = this._musicTension === 'combat' ? 140 : (this._musicTension === 'alert' ? 110 : 80);
    const beatInterval = 60 / bpm;

    if (this._musicTimer >= beatInterval) {
      this._musicTimer = 0;
      this._playMusicChord();
    }
  },

  _playMusicChord() {
    const chords = this._chords[this._musicTension] || this._chords.calm;
    const chord = chords[this._chordIndex % chords.length];
    this._chordIndex++;

    for (const freq of chord) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.03;
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.8);
    }
  },

  setVolumes(master, sfx, music) {
    if (!this.isInitialized) return;
    if (master !== undefined) this.masterGain.gain.value = master;
    if (sfx !== undefined) this.sfxGain.gain.value = sfx;
    if (music !== undefined) this.musicGain.gain.value = music;
  },
};

window.AudioSystem = AudioSystem;
console.log('[PHLY] Audio module loaded');
