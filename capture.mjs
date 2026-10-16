export async function acquireAudio(kind, devices = navigator.mediaDevices) {
  if (kind === 'device') {
    if (!devices?.getDisplayMedia) {
      throw new Error('Este navegador no permite capturar audio de pantalla. Abre esta dirección en Chrome o Edge de escritorio, o elige Micrófono.');
    }
    // Display capture requires video initially; release and remove it immediately.
    const stream = await devices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
      systemAudio: 'include',
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include',
    });
    if (!stream.getAudioTracks().some(track => track.readyState === 'live')) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('No se compartió audio. Vuelve a intentar y activa «Compartir audio» al elegir la pestaña con música o una pantalla con audio del sistema. Si no aparece esa opción, prueba Chrome o Edge de escritorio.');
    }
    for (const track of stream.getVideoTracks()) {
      track.stop();
      stream.removeTrack(track);
    }
    if (!stream.getAudioTracks().some(track => track.readyState === 'live')) {
      stream.getTracks().forEach(track => track.stop());
      throw new Error('Este navegador cerró el audio al detener la imagen. Prueba Chrome o Edge de escritorio para capturar solo audio.');
    }
    return stream;
  }
  if (!devices?.getUserMedia) throw new Error('Este navegador no permite acceder al micrófono. Prueba Chrome o Edge de escritorio.');
  return devices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
}
