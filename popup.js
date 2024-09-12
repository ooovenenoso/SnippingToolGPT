document.addEventListener('DOMContentLoaded', function() {
  const mainMenu = document.getElementById('mainMenu');
  const apiKeyMenu = document.getElementById('apiKeyMenu');
  const historyMenu = document.getElementById('historyMenu');
  const captureBtn = document.getElementById('captureBtn');
  const apiKeyBtn = document.getElementById('apiKeyBtn');
  const historyBtn = document.getElementById('historyBtn');
  const apiKeyInput = document.getElementById('apiKey');
  const saveApiKeyBtn = document.getElementById('saveApiKey');
  const backToMainBtn = document.getElementById('backToMain');
  const backToMainFromHistoryBtn = document.getElementById('backToMainFromHistory');
  const apiKeyStatus = document.getElementById('apiKeyStatus');
  const errorMessage = document.getElementById('errorMessage');
  const historyList = document.getElementById('historyList');
  const clearHistoryBtn = document.getElementById('clearHistory');

  // Load saved API key
  chrome.storage.sync.get(['openaiApiKey'], function(result) {
    if (result.openaiApiKey) {
      apiKeyInput.value = result.openaiApiKey;
      apiKeyStatus.textContent = 'API Key is set';
      apiKeyStatus.style.color = 'green';
    }
  });

  captureBtn.addEventListener('click', function() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "initiateScreenshot"}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError.message);
          errorMessage.textContent = 'Error: ' + chrome.runtime.lastError.message;
          errorMessage.style.display = 'block';
        } else if (response && response.success) {
          console.log("Screenshot initiated successfully");
          errorMessage.style.display = 'none';
        } else {
          console.error('Unknown error occurred');
          errorMessage.textContent = 'Unknown error occurred';
          errorMessage.style.display = 'block';
        }
      });
    });
    window.close();
  });

  apiKeyBtn.addEventListener('click', function() {
    mainMenu.style.display = 'none';
    apiKeyMenu.style.display = 'block';
  });

  historyBtn.addEventListener('click', function() {
    mainMenu.style.display = 'none';
    historyMenu.style.display = 'block';
    loadHistory();
  });

  saveApiKeyBtn.addEventListener('click', function() {
    const apiKey = apiKeyInput.value.trim();
    if (apiKey) {
      chrome.storage.sync.set({openaiApiKey: apiKey}, function() {
        apiKeyStatus.textContent = 'API Key saved successfully';
        apiKeyStatus.style.color = 'green';
      });
    } else {
      apiKeyStatus.textContent = 'Please enter a valid API Key';
      apiKeyStatus.style.color = 'red';
    }
  });

  backToMainBtn.addEventListener('click', function() {
    apiKeyMenu.style.display = 'none';
    mainMenu.style.display = 'block';
  });

  backToMainFromHistoryBtn.addEventListener('click', function() {
    historyMenu.style.display = 'none';
    mainMenu.style.display = 'block';
  });

  clearHistoryBtn.addEventListener('click', function() {
    chrome.storage.local.set({screenshots: []}, function() {
      loadHistory();
    });
  });

  function loadHistory() {
    chrome.storage.local.get(['screenshots'], function(result) {
      const screenshots = result.screenshots || [];
      historyList.innerHTML = '';
      screenshots.forEach((screenshot, index) => {
        const li = document.createElement('li');
        li.textContent = `Screenshot ${index + 1}: ${new Date(screenshot.timestamp).toLocaleString()}`;
        li.addEventListener('click', function() {
          chrome.tabs.create({url: screenshot.dataUrl});
        });
        historyList.appendChild(li);
      });
    });
  }
});