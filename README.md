# Pulso

Web que usa el audio del dispositivo, de una pestaña o del micrófono para alternar la pantalla entre negro y blanco al detectar golpes de música. Sin dependencias de instalación.

## Ejecutar

Con Node.js instalado:

```sh
npm run dev
```

Abre http://localhost:5173, acepta el aviso de luces intermitentes y pulsa **Capturar audio del dispositivo**. En el selector del navegador elige la pestaña con música o una pantalla, activa **Compartir audio** y confirma. La disponibilidad del audio del sistema depende del navegador, del sistema operativo y de la superficie elegida; si no aparece, prueba Chrome o Edge de escritorio o comparte una pestaña con música. Una ventana puede no ofrecer audio. La web no puede activar esa casilla automáticamente.

La API exige solicitar imagen junto con audio al abrir el selector. Tras validar que hay audio, Pulso detiene y elimina inmediatamente todas las pistas de vídeo y conserva solo las pistas de audio. No muestra, graba ni envía la imagen o el sonido. El selector inicial y los indicadores de captura del navegador no se pueden ocultar desde la web. Si el navegador termina el audio al cerrar la imagen, se libera la captura y se informa del problema, sin mantener vídeo como alternativa. Detener la escucha libera todas las pistas de captura. Si compartes sin audio, la captura se cierra y muestra instrucciones para reintentar. No se activa el micrófono como alternativa automática.

También puedes seleccionar **Micrófono**, autorizarlo y reproducir música por altavoces. Con captura directa puedes usar auriculares y evitas ruido ambiental. Cada cambio responde a un golpe detectado en el audio elegido. Ajusta la sensibilidad y la pausa entre cambios (inicialmente 1 ms). Puedes elegir alternancia o destellos de 100 ms y abrir la vista en pantalla completa. **Esc** solo sale de pantalla completa; la captura y los efectos continúan. Usa **Detener audio** para detener la captura. Cambiar de pestaña durante la escucha también detiene la sesión; abrir el selector de captura no cancela la solicitud pendiente.

La captura de audio requiere localhost o HTTPS; abrir el archivo HTML directamente o una dirección HTTP de red no es suficiente. Para usarlo desde otro dispositivo, sirve los archivos mediante HTTPS. Pantalla completa depende del soporte del navegador.

El audio se procesa localmente con Web Audio y no se graba, reproduce ni envía a un servidor. Las tipografías se solicitan a Google Fonts y tienen alternativas del sistema si no hay conexión.

La detección automática compara la energía de graves (40–220 Hz) con un promedio adaptativo y exige un aumento de energía. El BPM automático es aproximado, calculado a partir de los golpes detectados; ruido, volumen, ritmo y micrófono pueden afectar los resultados. Hay 700 ms iniciales de calibración. El intervalo configurable entre cambios automáticos es de 1–1000 ms (inicialmente 1 ms). Este valor es un límite mínimo del detector, no una frecuencia garantizada de destellos: el navegador procesa un análisis por fotograma y la pantalla limita la frecuencia visible. A 60 Hz, los fotogramas están separados por unos 16,7 ms. Una pausa muy corta puede detectar varios ataques de un mismo golpe y producir destellos intensos.

**Luces intermitentes:** evita esta experiencia si tienes fotosensibilidad. La pausa entre cambios no garantiza que los destellos sean adecuados para ti.

## Verificar

```sh
npm test
```

Pruebas del detector con silencio, sonido constante, ataques sintéticos, BPM e intervalo mínimo. Las pruebas de captura cubren selección de fuente, ausencia de audio, cancelación, falta de soporte y solicitud de micrófono sin vídeo. La captura real requiere elegir una fuente y conceder permisos desde el navegador.

En pantalla completa, el botón inferior cambia entre **Detener audio**, **Reanudar audio** y **Conectando…**. Reanudar usa la fuente elegida y puede volver a pedir permiso o abrir el selector de captura. Acepta el aviso de luces antes de entrar en pantalla completa. Los mensajes de conexión y error también aparecen dentro de ella.

El modo **Ondas** (seleccionado inicialmente) lanza un anillo blanco desde el centro con cada golpe detectado. Las ondas se expanden hasta los bordes en aproximadamente 1,15 segundos, se desvanecen y pueden superponerse. Se adapta a la vista previa y a pantalla completa. **Probar onda** permite comprobar el efecto tras aceptar el aviso de luces, sin activar captura ni sumar beats. Detener o cambiar de modo limpia las ondas pendientes.

El selector **B/W / RGB** cambia la paleta de los efectos. RGB interpreta el carácter del audio mediante tres bandas (graves 40–220 Hz, medios 220–2000 Hz y agudos 2000–8000 Hz), intensidad RMS y cadencia detectada. El predominio de graves orienta la paleta hacia violetas/azules; mayor brillo e intensidad la acercan a cianes y tonos cálidos. Es una interpretación visual basada en rasgos del sonido, no un reconocimiento de emociones o géneros.

El análisis se actualiza en cada fotograma y se suaviza durante varios segundos. Los cambios de tono están limitados a 24 grados por segundo para conservar armonía entre ondas consecutivas. Sonidos estables conservan una paleta estable y el silencio la congela. No hay cambios aleatorios ni cambios forzados cada cuatro beats. Cada onda conserva el color con el que nació; el glow responde a la fuerza del audio y el fondo permanece negro. En RGB, Alternar y Destello usan un resplandor central de color. **Probar onda** utiliza la paleta actual (azul antes de escuchar); iniciar captura reinicia el análisis.
