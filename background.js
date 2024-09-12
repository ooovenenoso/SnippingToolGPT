// Listener para la instalación del service worker
self.addEventListener('install', (event) => {
  console.log('Service worker installed');
});

// Listener para la activación del service worker
self.addEventListener('activate', (event) => {
  console.log('Service worker activated');
});

// Listener para mensajes
self.addEventListener('message', (event) => {
  // Manejar mensajes aquí si es necesario
});

// Funcionalidad existente
chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.sendMessage(tab.id, {action: "initiateScreenshot"});
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureScreenshot') {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      chrome.tabs.getZoom(sender.tab.id, (zoomFactor) => {
        chrome.tabs.sendMessage(sender.tab.id, {
          action: 'cropScreenshot',
          dataUrl: dataUrl,
          area: request.area,
          zoomFactor: zoomFactor
        });
      });
    });
    return true; // Indica que la respuesta será asíncrona
  } else if (request.action === 'analyzeScreenshot') {
    sendToGPTAPI(request.dataUrl, sender.tab.id);
    return true; // Indica que la respuesta será asíncrona
  }
});

async function sendToGPTAPI(dataUrl, tabId) {
  try {
    const result = await chrome.storage.sync.get(['openaiApiKey']);
    const apiKey = result.openaiApiKey;

    if (!apiKey) {
      throw new Error('OpenAI API key not set. Please set it in the extension options.');
    }

    showNotification('Analysis Started', 'Sending image to GPT-4o-mini for analysis...');

    // Convert dataUrl to base64
    const base64Image = dataUrl.split(',')[1];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an AI assistant. The user will provide you with a base64 encoded image. Your task is to extract and summarize the most important information from this image. Keep the response brief and focus only on the relevant content, such as any text or key visual elements that stand out."
          },
          {
            role: "user",
            content: [
              "Analyze this image and provide only the correct answer.",
              {
                "type": "image_url",
                "image_url": {
                  "url": `data:image/png;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API request failed: ${errorData.error.message}`);
    }

    const data = await response.json();
    const analysisResult = data.choices[0].message.content;

    showNotification('Analysis Complete', 'Image analysis completed successfully.');

    chrome.tabs.sendMessage(tabId, {
      action: 'showResult',
      result: analysisResult
    });

    saveScreenshot(dataUrl);
  } catch (error) {
    console.error('Error in sendToGPTAPI:', error);
    showNotification('Error', `Failed to analyze image: ${error.message}`);
    chrome.tabs.sendMessage(tabId, {
      action: 'showResult',
      result: `Error: ${error.message}`
    });
  }
}

function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon48.png',
    title: title,
    message: message
  });
}

function saveScreenshot(dataUrl) {
  chrome.storage.local.get({screenshots: []}, function(result) {
    const screenshots = result.screenshots;
    screenshots.unshift({
      dataUrl: dataUrl,
      timestamp: Date.now()
    });
    // Keep only the last 10 screenshots
    if (screenshots.length > 10) {
      screenshots.pop();
    }
    chrome.storage.local.set({screenshots: screenshots});
  });
}