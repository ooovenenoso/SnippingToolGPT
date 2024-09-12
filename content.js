chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'showResult') {
    showFloatingResult(request.result);
    sendResponse({ success: true });
  } else if (request.action === 'initiateScreenshot') {
    initiateScreenshot();
    sendResponse({ success: true });
  } else if (request.action === 'captureScreenshot') {
    captureTab()
      .then(() => sendResponse({ success: true }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Indica que la respuesta es asincrónica
  } else if (request.action === 'cropScreenshot') {
    cropScreenshot(request.dataUrl, request.area, request.zoomFactor);
    sendResponse({ success: true });
  }
  return true;
});

function showFloatingResult(result) {
  const floatingDiv = document.createElement('div');
  floatingDiv.className = 'snipping-tool-gpt-result';
  floatingDiv.innerHTML = `
    <div class="result-content">
      <h3>Analysis Result</h3>
      <p id="analysis-text"></p>
    </div>
    <div class="button-container">
      <button class="close-btn">Close</button>
      <button class="new-screenshot-btn">New Screenshot</button>
    </div>
  `;

  document.body.appendChild(floatingDiv);

  const analysisText = floatingDiv.querySelector('#analysis-text');
  typeWriter(result, analysisText);

  floatingDiv.querySelector('.close-btn').addEventListener('click', () => {
    document.body.removeChild(floatingDiv);
  });

  floatingDiv.querySelector('.new-screenshot-btn').addEventListener('click', () => {
    document.body.removeChild(floatingDiv);
    initiateScreenshot();
  });
}

function typeWriter(text, element, index = 0) {
  if (index < text.length) {
    element.innerHTML += text.charAt(index);
    setTimeout(() => typeWriter(text, element, index + 1), 20);
  }
}

function initiateScreenshot() {
  document.body.style.cursor = 'crosshair';
  let startX, startY, endX, endY;
  let isSelecting = false;
  let selectionDiv;

  function handleMouseDown(e) {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    selectionDiv = document.createElement('div');
    selectionDiv.className = 'snipping-tool-gpt-selection';
    document.body.appendChild(selectionDiv);
  }

  function handleMouseMove(e) {
    if (!isSelecting) return;
    endX = e.clientX;
    endY = e.clientY;
    selectionDiv.style.left = `${Math.min(startX, endX)}px`;
    selectionDiv.style.top = `${Math.min(startY, endY)}px`;
    selectionDiv.style.width = `${Math.abs(endX - startX)}px`;
    selectionDiv.style.height = `${Math.abs(endY - startY)}px`;
  }

  function handleMouseUp() {
    isSelecting = false;
    document.body.style.cursor = 'default';
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    const scaleFactor = window.devicePixelRatio || 1;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Ajustar el área seleccionada para que sea consistente con la captura
    chrome.runtime.sendMessage({
      action: 'captureScreenshot',
      area: {
        x: (Math.min(startX, endX) + scrollX) * scaleFactor,
        y: (Math.min(startY, endY) + scrollY) * scaleFactor,
        width: Math.abs(endX - startX) * scaleFactor,
        height: Math.abs(endY - startY) * scaleFactor
      }
    });

    document.body.removeChild(selectionDiv);
  }

  document.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

async function captureTab() {
  return new Promise((resolve, reject) => {
    chrome.tabCapture.capture({
      audio: false,
      video: true
    }, (stream) => {
      if (!stream) {
        return reject('Failed to capture tab.');
      }

      const videoElement = document.createElement('video');
      videoElement.srcObject = stream;
      videoElement.autoplay = true;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      videoElement.onloadedmetadata = () => {
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;

        // Dibuja el video en el canvas
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Convierte el canvas a dataURL y lo envía como respuesta
        const capturedDataUrl = canvas.toDataURL();
        chrome.runtime.sendMessage({
          action: 'captureComplete',
          dataUrl: capturedDataUrl
        });

        // Detener el stream para liberar recursos
        stream.getTracks().forEach(track => track.stop());

        resolve();
      };
    });
  });
}

function cropScreenshot(dataUrl, area, zoomFactor) {
  const img = new Image();
  img.onload = function() {
    const canvas = document.createElement('canvas');
    canvas.width = area.width / zoomFactor;
    canvas.height = area.height / zoomFactor;
    const ctx = canvas.getContext('2d');

    // Recortar la imagen utilizando las coordenadas seleccionadas
    ctx.drawImage(
      img,
      area.x / zoomFactor,
      area.y / zoomFactor,
      area.width / zoomFactor,
      area.height / zoomFactor,
      0,
      0,
      area.width / zoomFactor,
      area.height / zoomFactor
    );

    const croppedDataUrl = canvas.toDataURL();

    chrome.runtime.sendMessage({
      action: 'analyzeScreenshot',
      dataUrl: croppedDataUrl
    });
  };
  img.src = dataUrl;
}