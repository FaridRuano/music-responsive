import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireAudio } from './capture.mjs';

test('device capture requests system and tab audio without accessing the microphone', async () => {
  let requested;
  const audio = { readyState: 'live' };
  const stream = { getAudioTracks: () => [audio], getVideoTracks: () => [] };
  const result = await acquireAudio('device', {
    getDisplayMedia: async options => { requested = options; return stream; },
    getUserMedia: () => assert.fail('Must not activate microphone'),
  });
  assert.equal(result, stream);
  assert.equal(requested.video, true);
  assert.equal(requested.systemAudio, 'include');
  assert.equal(requested.audio.suppressLocalAudioPlayback, false);
});
test('device capture stops and removes video while preserving live audio', async () => {
  const audio = { kind: 'audio', readyState: 'live', stop() { assert.fail('Audio must remain live'); } };
  let videoStopped = false;
  const video = { kind: 'video', stop() { videoStopped = true; } };
  let tracks = [audio, video];
  const stream = {
    getAudioTracks: () => tracks.filter(track => track.kind === 'audio'),
    getVideoTracks: () => tracks.filter(track => track.kind === 'video'),
    getTracks: () => tracks,
    removeTrack: track => { tracks = tracks.filter(item => item !== track); },
  };
  const result = await acquireAudio('device', { getDisplayMedia: async () => stream });
  assert.equal(videoStopped, true);
  assert.deepEqual(result.getTracks(), [audio]);
  assert.equal(audio.readyState, 'live');
});
test('if the browser ends audio with video, capture fails without retaining screen video', async () => {
  let audioStopped = false;
  const audio = { readyState: 'live', stop() { audioStopped = true; } };
  const video = { stop() { audio.readyState = 'ended'; } };
  let videos = [video];
  await assert.rejects(acquireAudio('device', { getDisplayMedia: async () => ({
    getAudioTracks: () => [audio], getVideoTracks: () => videos,
    getTracks: () => [audio, ...videos], removeTrack: () => { videos = []; },
  }) }), /cerró el audio/);
  assert.equal(audioStopped, true);
  assert.equal(videos.length, 0);
});
test('sharing without audio releases all captured tracks and explains how to retry', async () => {
  let stopped = false;
  await assert.rejects(acquireAudio('device', {
    getDisplayMedia: async () => ({ getAudioTracks: () => [], getTracks: () => [{ stop() { stopped = true; } }] }),
  }), /Compartir audio/);
  assert.equal(stopped, true);
});
test('cancelled screen sharing does not silently switch to the microphone', async () => {
  const denied = new Error('Cancelled'); denied.name = 'NotAllowedError';
  await assert.rejects(acquireAudio('device', {
    getDisplayMedia: async () => { throw denied; },
    getUserMedia: () => assert.fail('Must not fall back to mic'),
  }), error => error === denied);
});
test('unsupported screen capture has an actionable error', async () => {
  await assert.rejects(acquireAudio('device', {}), /Chrome o Edge/);
});
test('microphone capture requests only audio', async () => {
  let requested;
  const stream = {};
  assert.equal(await acquireAudio('mic', { getUserMedia: async options => { requested = options; return stream; } }), stream);
  assert.equal(requested.video, false);
  assert.equal(requested.audio.echoCancellation, false);
});
