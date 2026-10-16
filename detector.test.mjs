import test from 'node:test';
import assert from 'node:assert/strict';
import { BeatDetector, BeatPalette } from './detector.mjs';

const deep = { bass: .8, mid: .1, treble: .02, rms: .07, bpm: 98 };
const bright = { bass: .1, mid: .3, treble: .8, rms: .18, bpm: 130 };
test('the same audio produces the same RGB palette without randomness', () => {
  const first = new BeatPalette(), second = new BeatPalette();
  for (let now = 0; now < 5000; now += 16) {
    const audio = now < 2000 ? deep : bright;
    assert.equal(first.update(audio, now), second.update(audio, now));
  }
});
test('stable audio keeps a coherent palette instead of changing every few beats', () => {
  const palette = new BeatPalette();
  const initial = palette.update(deep, 0);
  for (let now = 16; now < 5000; now += 16) assert.equal(palette.update(deep, now), initial);
});
test('deep and bright musical textures produce distinct palettes', () => {
  const first = new BeatPalette(), second = new BeatPalette();
  first.update(deep, 0); second.update(bright, 0);
  assert.ok(first.hue > second.hue + 60);
  assert.ok(second.saturation > first.saturation);
});
test('a sudden change in music shifts hue gradually and converges to the new texture', () => {
  const palette = new BeatPalette();
  palette.update(deep, 0);
  const initial = palette.hue;
  for (let now = 16; now < 16000; now += 16) {
    const previous = palette.hue;
    palette.update(bright, now);
    assert.ok(Math.abs(palette.hue - previous) <= 24 * .016 + .00001);
  }
  const target = new BeatPalette(); target.update(bright, 0);
  assert.ok(Math.abs(palette.hue - target.hue) < 2);
  assert.ok(Math.abs(palette.hue - initial) > 60);
});
test('silence preserves the aura and a new session resets analysis', () => {
  const palette = new BeatPalette();
  const color = palette.update(bright, 0);
  assert.equal(palette.update({ rms: 0 }, 10000), color);
  palette.reset(); assert.equal(palette.initialized, false);
  assert.equal(palette.lastTime, null);
});

test('silence and steady sound do not create beats', () => {
  for (const energy of [0, 0.2, 0.7]) {
    const detector = new BeatDetector();
    let beats = 0;
    for (let now = 0; now < 5000; now += 16) if (detector.update(energy, energy, now)) beats++;
    assert.equal(beats, 0);
  }
});
test('automatic mode picks up modest attacks over a loud continuous background at 98 BPM', () => {
  const detector = new BeatDetector();
  let beats = 0;
  for (let now = 0; now < 7000; now += 10) {
    const attack = now >= 1000 && (now - 1000) % 610 === 0;
    if (detector.update(attack ? 0.61 : 0.5, 0.08, now)) beats++;
  }
  assert.equal(beats, 10);
  assert.equal(detector.bpm, 98);
});
test('detects separated bass attacks and estimates 120 BPM', () => {
  const detector = new BeatDetector();
  let beats = 0;
  for (let now = 0; now < 5000; now += 10) {
    const attack = now >= 1000 && now % 500 === 0;
    if (detector.update(attack ? 0.8 : 0.04, attack ? 0.3 : 0.02, now)) beats++;
  }
  assert.equal(beats, 8); assert.equal(detector.bpm, 120);
});
test('cooldown rejects closely spaced attacks; reset clears tempo', () => {
  const detector = new BeatDetector();
  const times = [];
  for (let now = 0; now < 4000; now += 10) {
    const attack = now >= 1000 && now % 100 === 0;
    if (detector.update(attack ? 0.9 : 0.01, 0.2, now, 60, 600)) times.push(now);
  }
  assert.ok(times.length >= 3);
  assert.ok(times.every((time, i) => i === 0 || time - times[i - 1] >= 600));
  detector.reset(); assert.equal(detector.bpm, null); assert.equal(detector.lastBeat, -Infinity);
});
test('1 ms cooldown accepts close attacks while a longer pause filters them', () => {
  const fast = new BeatDetector();
  const slow = new BeatDetector();
  let fastCount = 0, slowCount = 0;
  for (let now = 0; now <= 1100; now++) {
    const attack = now === 1000 || now === 1002;
    const energy = attack ? 0.8 : 0.04;
    if (fast.update(energy, 0.2, now, 70, 1)) fastCount++;
    if (slow.update(energy, 0.2, now, 70, 250)) slowCount++;
  }
  assert.equal(fastCount, 2);
  assert.equal(slowCount, 1);
});
