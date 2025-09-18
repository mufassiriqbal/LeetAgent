// Remove hardcoded client ID - will be loaded from extension storage
let CLIENT_ID = null;
const BACKEND_URL = "http://127.0.0.1:5000/exchange_token";

// Load configuration on startup
chrome.runtime.onStartup.addListener(loadConfig);
chrome.runtime.onInstalled.addListener(loadConfig);

async function loadConfig() {
  try {
    // Try to get client ID from storage first
    const result = await chrome.storage.local.get(['githubClientId']);
    if (result.githubClientId) {
      CLIENT_ID = result.githubClientId;
      console.log('✅ GitHub Client ID loaded from storage');
    } else {
      // Fallback: try to get from backend
      try {
        const response = await fetch('http://127.0.0.1:5000/config');
        const config = await response.json();
        if (config.client_id) {
          CLIENT_ID = config.client_id;
          // Store for future use
          await chrome.storage.local.set({ githubClientId: CLIENT_ID });
          console.log('✅ GitHub Client ID loaded from backend');
        }
      } catch (e) {
        console.warn('⚠️ Could not load client ID from backend:', e.message);
      }
    }
    
    console.log('=== LeetCode Agent Setup Info ===');
    console.log('Extension ID:', chrome.runtime.id);
    console.log('Client ID configured:', !!CLIENT_ID);
    console.log('Redirect URI for GitHub OAuth:', 'http://localhost:5000/callback');
    console.log('==================================');
    
  } catch (error) {
    console.error('❌ Error loading configuration:', error);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "setClientId") {
    setClientId(msg.clientId, sendResponse);
    return true;
  }
  
  if (msg.type === "login") {
    handleGitHubLogin(sendResponse);
    return true;
  }
  
  if (msg.type === "pushCode") {
    handlePushCode(msg.data, sendResponse);
    return true;
  }
  
  if (msg.type === "checkStatus") {
    checkAuthStatus(sendResponse);
    return true;
  }
});

async function setClientId(clientId, sendResponse) {
  try {
    CLIENT_ID = clientId;
    await chrome.storage.local.set({ githubClientId: clientId });
    sendResponse({ success: true, message: "Client ID saved" });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleGitHubLogin(sendResponse) {
  try {
    if (!CLIENT_ID) {
      sendResponse({ 
        success: false, 
        error: "GitHub Client ID not configured. Please set it in the extension settings." 
      });
      return;
    }

    // Use localhost callback instead of chrome-extension
    const redirectUri = "http://localhost:5000/callback";
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;

    // Open GitHub OAuth in a new tab instead of using chrome.identity
    chrome.tabs.create({ url: authUrl }, (tab) => {
      // Listen for tab updates to catch the callback
      const tabUpdateListener = (tabId, changeInfo, updatedTab) => {
        if (tabId === tab.id && changeInfo.url && changeInfo.url.includes('localhost:5000/callback')) {
          // Remove the listener
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
          
          // Close the OAuth tab
          chrome.tabs.remove(tabId);
          
          // The server should handle the token exchange
          // We'll check the backend for authentication status
          setTimeout(() => {
            checkBackendAuthStatus(sendResponse);
          }, 2000);
        }
      };
      
      chrome.tabs.onUpdated.addListener(tabUpdateListener);
      
      // Timeout after 5 minutes
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        sendResponse({ success: false, error: "OAuth timeout" });
      }, 300000);
    });

  } catch (error) {
    console.error("Login error:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function checkBackendAuthStatus(sendResponse) {
  try {
    const response = await fetch("http://127.0.0.1:5000/status");
    const result = await response.json();
    
    if (result.authenticated) {
      // Store a flag that we're authenticated
      await chrome.storage.local.set({ 
        githubAuthenticated: true,
        lastAuthCheck: Date.now()
      });
      
      sendResponse({ success: true, message: "Successfully authenticated with GitHub" });
    } else {
      sendResponse({ success: false, error: "Authentication failed" });
    }
  } catch (error) {
    sendResponse({ success: false, error: "Could not verify authentication status" });
  }
}

async function handlePushCode(data, sendResponse) {
  try {
    const response = await fetch("http://127.0.0.1:5000/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    sendResponse(result);
  } catch (error) {
    console.error("Push code error:", error);
    sendResponse({ 
      success: false, 
      error: `Failed to push code: ${error.message}` 
    });
  }
}

async function checkAuthStatus(sendResponse) {
  try {
    // Check both local storage and backend
    const result = await chrome.storage.local.get(['githubAuthenticated', 'lastAuthCheck']);
    const isRecentlyChecked = result.lastAuthCheck && (Date.now() - result.lastAuthCheck) < 300000; // 5 minutes
    
    if (result.githubAuthenticated && isRecentlyChecked) {
      sendResponse({ authenticated: true });
    } else {
      // Double-check with backend
      try {
        const response = await fetch("http://127.0.0.1:5000/status");
        const backendResult = await response.json();
        
        await chrome.storage.local.set({ 
          githubAuthenticated: backendResult.authenticated,
          lastAuthCheck: Date.now()
        });
        
        sendResponse({ authenticated: backendResult.authenticated });
      } catch (error) {
        sendResponse({ authenticated: false, error: error.message });
      }
    }
  } catch (error) {
    console.error("Status check error:", error);
    sendResponse({ authenticated: false, error: error.message });
  }
}

// Initialize on load
loadConfig();