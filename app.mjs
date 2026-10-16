import { BeatDetector, BeatPalette } from './detector.mjs';
import { acquireAudio } from './capture.mjs';
const $ = id => document.getElementById(id);
const detector = new BeatDetector();
const palette = new BeatPalette();
let colorMode = 'bw';
function updateModeHelp() {
  const colored = colorMode === 'rgb';
  $('mode-help').textContent = mode === 'waves' ? 'Cada beat lanza una onda desde el centro hacia los bordes.' : mode === 'toggle' ? (colored ? 'Cada beat enciende o apaga un resplandor de color sobre negro.' : 'Cada beat cambia de negro a blanco, y viceversa.') : (colored ? 'Cada beat lanza un resplandor de color durante 100 ms.' : 'Cada beat ilumina la pantalla durante 100 ms.');
}
function beatColor() {
  const color = colorMode === 'rgb' ? palette.color : '#fff';
  $('stage').style.setProperty('--beat-color', color);
  return color;
}
let stream, context, analyser, source, frame, flashTimer;
let running = false, starting = false, generation = 0, count = 0, mode = 'waves';
const waveLayer = $('waves');
const waveSize = new ResizeObserver(() => {
  const { width, height } = $('stage').getBoundingClientRect();
  waveLayer.style.setProperty('--wave-size', `${Math.ceil(Math.hypot(width, height)) + 8}px`);
});
waveSize.observe($('stage'));
function clearWaves() {
  waveLayer.replaceChildren();
  $('stage').classList.remove('wave-preview');
}
function emitWave(color = '#fff', strength = 0.5) {
  // Keep overlapping attacks bounded even with the shortest detection interval.
  while (waveLayer.childElementCount >= 32) waveLayer.firstElementChild.remove();
  const ring = document.createElement('div');
  ring.className = 'beat-wave';
  ring.style.color = color;
  ring.style.setProperty('--glow-size', `${55 + Math.min(1, strength) * 90}px`);
  if (!running) $('stage').classList.add('wave-preview');
  ring.addEventListener('animationend', () => {
    ring.remove();
    if (!waveLayer.childElementCount) $('stage').classList.remove('wave-preview');
  }, { once: true });
  waveLayer.append(ring);
}
$('test-wave').addEventListener('click', () => {
  if ($('consent').checked && mode === 'waves') emitWave(beatColor());
});
document.querySelectorAll('[data-color]').forEach(button => button.addEventListener('click', () => {
  colorMode = button.dataset.color;
  palette.reset(); clearWaves(); clearTimeout(flashTimer);
  $('stage').classList.remove('white');
  $('stage').classList.toggle('rgb', colorMode === 'rgb');
  $('color-label').textContent = colorMode === 'rgb' ? 'R G B' : 'B / W';
  $('color-help').textContent = colorMode === 'rgb' ? 'La paleta evoluciona con los graves, el brillo y la fuerza de la música. Colores cercanos, transiciones suaves y glow sobre negro.' : 'Ondas blancas sobre fondo negro.';
  document.querySelectorAll('[data-color]').forEach(item => {
    const selected = item === button;
    item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected));
  });
  updateModeHelp();
}));
const bars = Array.from({ length: 36 }, () => { const bar = document.createElement('i'); $('meter').append(bar); return bar; });
const message = (text, error = false) => {
  $('message').textContent = text; $('message').classList.toggle('error', error);
  $('stage-feedback').textContent = !$('consent').checked ? 'Para reanudar, acepta primero el aviso de luces en la vista normal.' : text;
};
function buttonState() {
  $('start').disabled = starting || (!running && !$('consent').checked);
  $('start-label').textContent = starting ? 'Conectando…' : running ? 'Detener audio' : $('audio-source').value === 'device' ? 'Capturar audio del dispositivo' : 'Activar micrófono';
  $('start-icon').textContent = running ? '■' : '↗';
  $('start').classList.toggle('running', running);
  $('stage-stop').disabled = $('start').disabled;
  $('stage-stop').textContent = starting ? 'Conectando…' : running ? '■ Detener audio' : '▶ Reanudar audio';
  $('test-wave').disabled = !$('consent').checked || starting;
}
$('audio-source').addEventListener('change', () => {
  stop();
  $('source-help').textContent = $('audio-source').value === 'device'
    ? 'Elige dónde suena la música y activa «Compartir audio». El navegador exige seleccionar pantalla o pestaña al iniciar; Pulso detiene la pista de imagen inmediatamente y conserva solo audio, sin grabarlo ni enviarlo.'
    : 'Autoriza el micrófono y reproduce música por altavoces. El audio del dispositivo evita el ruido ambiental y también funciona con auriculares.';
});
$('consent').addEventListener('change', () => {
  if (!$('consent').checked) stop();
  else $('stage-feedback').textContent = 'Pulsa «Reanudar audio» para activar la escucha.';
  buttonState();
});
for (const name of ['sensitivity', 'cooldown']) {
  $(name).addEventListener('input', () => { $(name + '-value').textContent = $(name).value + (name === 'sensitivity' ? '%' : ' ms'); });
}
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  mode = button.dataset.mode;
  clearTimeout(flashTimer);
  clearWaves();
  $('stage').classList.remove('white');
  document.querySelectorAll('[data-mode]').forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
  updateModeHelp();
  $('test-wave').hidden = mode !== 'waves';
}));
async function start() {
  if (starting || running || !$('consent').checked) return;
  if (!window.isSecureContext || !navigator.mediaDevices) {
    message('La captura de audio necesita HTTPS o localhost. Abre esta web desde el servidor local.', true); return;
  }
  const deviceAudio = $('audio-source').value === 'device';
  const attempt = ++generation;
  starting = true; buttonState(); message(deviceAudio ? 'Elige dónde suena la música y activa «Compartir audio» en el selector del navegador.' : 'Acepta el permiso de micrófono en tu navegador.');
  let acquired, audio;
  try {
    acquired = await acquireAudio(deviceAudio ? 'device' : 'mic');
    if (attempt !== generation) { acquired.getTracks().forEach(track => track.stop()); return; }
    audio = new AudioContext();
    await audio.resume();
    if (attempt !== generation) { acquired.getTracks().forEach(track => track.stop()); await audio.close(); return; }
    stream = acquired; context = audio;
    analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.12;
    source = context.createMediaStreamSource(stream); source.connect(analyser);
    // No connection to destination: prevents microphone feedback.
    stream.getTracks().forEach(track => track.addEventListener('ended', () => { stop(); message('La fuente de audio se desconectó o dejaste de compartir. Puedes volver a activarla.', true); }));
    detector.reset(); palette.reset(); clearWaves(); count = 0; $('beats').textContent = '000'; $('bpm').textContent = '—';
    running = true; starting = false; buttonState();
    $('stage').classList.add('active'); $('stage-status').innerHTML = '<i></i> ESCUCHANDO';
    $('preview-state').textContent = 'EN VIVO'; $('mic-state').textContent = deviceAudio ? 'Dispositivo' : 'Micrófono';
    $('stage-hint').textContent = 'Esc para salir de pantalla completa';
    message('Escuchando la música en vivo. Ajusta la sensibilidad si pierde golpes o detecta demasiados.');
    const frequencies = new Uint8Array(analyser.frequencyBinCount);
    const samples = new Float32Array(analyser.fftSize);
    function tick(now) {
      if (!running) return;
      analyser.getByteFrequencyData(frequencies); analyser.getFloatTimeDomainData(samples);
      let sum = 0; for (const sample of samples) sum += sample * sample;
      const rms = Math.sqrt(sum / samples.length);
      const low = Math.max(1, Math.floor(40 * analyser.fftSize / context.sampleRate));
      const high = Math.min(frequencies.length - 1, Math.ceil(220 * analyser.fftSize / context.sampleRate));
      let bass = 0; for (let i = low; i <= high; i++) bass += frequencies[i] / 255;
      bass /= high - low + 1;
      const volume = Math.min(1, rms * 5);
      bars.forEach((bar, i) => bar.classList.toggle('lit', i < volume * bars.length));
      $('level').textContent = Math.round(volume * 100) + '%';
      const bandEnergy = (from, to) => {
        const first = Math.max(1, Math.ceil(from * analyser.fftSize / context.sampleRate));
        const last = Math.min(frequencies.length - 1, Math.floor(to * analyser.fftSize / context.sampleRate));
        if (last < first) return 0;
        let energy = 0;
        for (let i = first; i <= last; i++) energy += frequencies[i] / 255;
        return energy / (last - first + 1);
      };
      const beat = detector.update(bass, rms, now, +$('sensitivity').value, +$('cooldown').value);
      if (colorMode === 'rgb') {
        palette.update({ bass, mid: bandEnergy(220, 2000), treble: bandEnergy(2000, 8000), rms, bpm: now - detector.lastBeat < 3000 ? detector.bpm : null }, now);
      }
      if (beat) {
        count++; $('beats').textContent = String(count).padStart(3, '0');
        const color = beatColor();
        if (mode === 'waves') emitWave(color, Math.min(1, rms * 4 + bass * .5));
        else if (mode === 'toggle') $('stage').classList.toggle('white');
        else { $('stage').classList.add('white'); clearTimeout(flashTimer); flashTimer = setTimeout(() => $('stage').classList.remove('white'), 100); }
      }
      $('bpm').textContent = now - detector.lastBeat > 3000 ? '—' : (detector.bpm ?? '—');
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  } catch (error) {
    acquired?.getTracks().forEach(track => track.stop());
    if (audio && audio.state !== 'closed') await audio.close().catch(() => {});
    if (attempt !== generation) return;
    stop();
    const errors = { NotAllowedError: deviceAudio ? 'No se autorizó la captura o cancelaste el selector. Vuelve a intentar y activa «Compartir audio».' : 'Permiso denegado. Habilita el micrófono en los permisos del sitio y vuelve a intentar.', NotFoundError: 'No se encontró la fuente de audio. Revisa tu dispositivo y vuelve a intentar.', NotReadableError: 'No se pudo abrir la fuente de audio. Revisa los permisos del sistema o si otra aplicación la está usando.', InvalidStateError: 'Vuelve a esta pestaña y pulsa el botón de captura para abrir el selector del navegador.', AbortError: 'Se canceló la captura de audio. Puedes volver a intentar.' };
    message(errors[error.name] || (error.name === 'Error' ? error.message : 'No se pudo iniciar la captura. Prueba Chrome o Edge de escritorio o elige Micrófono.'), true);
  }
}
function stop() {
  generation++; running = false; starting = false;
  cancelAnimationFrame(frame); clearTimeout(flashTimer);
  clearWaves();
  source?.disconnect(); source = null;
  stream?.getTracks().forEach(track => track.stop()); stream = null;
  if (context && context.state !== 'closed') context.close().catch(() => {});
  context = null; analyser = null;
  $('stage').classList.remove('active', 'white'); $('stage-status').innerHTML = '<i></i> SIN SEÑAL';
  $('preview-state').textContent = 'EN ESPERA'; $('mic-state').textContent = 'Inactiva';
  $('stage-hint').textContent = 'El próximo beat enciende todo.';
  $('level').textContent = '0%'; $('bpm').textContent = '—'; bars.forEach(bar => bar.classList.remove('lit'));
  buttonState(); message('En pausa. Activa la fuente de audio para volver a empezar.');
}
$('start').addEventListener('click', () => running ? stop() : start());
$('stage-stop').addEventListener('click', () => running ? stop() : start());
$('fullscreen').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('stage').requestFullscreen) await $('stage').requestFullscreen();
    else message('Este navegador no admite pantalla completa. Puedes usar la vista previa.', true);
  } catch { message('No se pudo abrir pantalla completa. Prueba desde otra ventana del navegador.', true); }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen').setAttribute('aria-label', document.fullscreenElement ? 'Salir de pantalla completa' : 'Entrar en pantalla completa');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && running) stop(); });
window.addEventListener('pagehide', stop);
