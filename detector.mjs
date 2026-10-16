// Adaptive bass onset detector. Times are milliseconds; energy values are 0–1.
// A visual interpretation of timbre and dynamics; no mood recognition or randomness.
export class BeatPalette {
  constructor() { this.reset(); }
  reset() {
    this.hue = 240; this.saturation = 85; this.lightness = 65;
    this.lastTime = null; this.initialized = false;
    this.brightness = 0; this.energy = 0;
  }
  update({ bass = 0, mid = 0, treble = 0, rms = 0, bpm = null }, now) {
    const seconds = this.lastTime === null ? 1 / 60 : Math.min(.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    // Silence keeps the last palette instead of introducing unprompted changes.
    if (rms < .004) return this.color;
    const total = bass + mid + treble;
    const brightness = total > 0 ? (treble + mid * .35) / total : 0;
    const energy = Math.min(1, Math.log1p(rms * 20) / Math.log(4));
    const smooth = this.initialized ? 1 - Math.exp(-seconds / 1.8) : 1;
    this.brightness += (brightness - this.brightness) * smooth;
    this.energy += (energy - this.energy) * smooth;
    const cadence = bpm === null ? 0 : Math.max(-1, Math.min(1, (bpm - 110) / 70)) * 10;
    // Deep sounds stay in violet/blue; brighter, more energetic textures move toward cyan/gold.
    const targetHue = 285 - this.brightness * 220 - this.energy * 45 - cadence;
    const targetSaturation = 78 + this.energy * 22;
    const targetLightness = 61 + this.energy * 7;
    if (!this.initialized) {
      this.hue = targetHue; this.saturation = targetSaturation; this.lightness = targetLightness;
      this.initialized = true;
    } else {
      const distance = ((targetHue - this.hue + 540) % 360) - 180;
      const movement = distance * (1 - Math.exp(-seconds / 1.5));
      this.hue = (this.hue + Math.max(-24 * seconds, Math.min(24 * seconds, movement)) + 360) % 360;
      const blend = 1 - Math.exp(-seconds / .8);
      this.saturation += (targetSaturation - this.saturation) * blend;
      this.lightness += (targetLightness - this.lightness) * blend;
    }
    return this.color;
  }
  get color() { return `hsl(${Math.round(this.hue)} ${Math.round(this.saturation)}% ${Math.round(this.lightness)}%)`; }
}

export class BeatDetector {
  constructor() { this.reset(); }
  reset() {
    this.baseline = 0;
    this.previous = 0;
    this.lastBeat = -Infinity;
    this.started = null;
    this.intervals = [];
  }
  update(energy, rms, now, sensitivity = 70, cooldown = 1) {
    if (this.started === null) this.started = now;
    const threshold = 1.32 - sensitivity / 100 * 0.30;
    const rise = energy - this.previous;
    const beat = now - this.started > 700 && now - this.lastBeat >= cooldown &&
      rms > 0.004 && energy > 0.025 &&
      energy > this.baseline * threshold + 0.003 && rise > 0.002;
    this.baseline += (energy - this.baseline) * 0.07;
    this.previous = energy;
    if (beat) {
      const interval = now - this.lastBeat;
      if (interval >= 180 && interval <= 2000) {
        this.intervals.push(interval);
        if (this.intervals.length > 8) this.intervals.shift();
      } else this.intervals = [];
      this.lastBeat = now;
    }
    return beat;
  }
  get bpm() {
    if (this.intervals.length < 3) return null;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    return Math.round(60000 / sorted[Math.floor(sorted.length / 2)]);
  }
}
