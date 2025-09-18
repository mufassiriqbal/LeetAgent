// background.js - LeetCode Agent
// TODO: Add content from Claude artifacts

const CLIENT_ID = "Ov23liSuRU6nVNxttjXc";
const BACKEND_URL = "http://127.0.0.1:5000/exchange_token";

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "login") {
    handleGitHubLogin(sendResponse);
    return true; // Indicates async response
  }
  
  if (msg.type === "pushCode") {
    handlePushCode(msg.data, sendResponse);
    return true; // Indicates async response
  }
  
  if (msg.type === "checkStatus") {
    checkAuthStatus(sendResponse);
    return true; // Indicates async response
  }
});

async function handleGitHubLogin(sendResponse) {
  try {
    const redirectUri = chrome.identity.getRedirectURL("callback");
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;

    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async function (redirectUrl) {
        if (chrome.runtime.lastError || !redirectUrl) {
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError?.message || "Authorization cancelled" 
          });
          return;
        }

        try {
          const url = new URL(redirectUrl);
          const code = url.searchParams.get("code");
          const error = url.searchParams.get("error");

          if (error) {
            sendResponse({ 
              success: false, 
              error: url.searchParams.get("error_description") || error 
            });
            return;
          }

          if (!code) {
            sendResponse({ success: false, error: "No authorization code received" });
            return;
          }

          // Exchange code for token
          const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              "Accept": "application/json"
            },
            body: JSON.stringify({ 
              code: code,
              redirect_uri: redirectUri 
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
          }

          const data = await response.json();
          
          if (data.access_token) {
            // Store token securely
            await chrome.storage.local.set({ 
              githubToken: data.access_token,
              tokenExpiry: Date.now() + (data.expires_in || 3600) * 1000
            });
            
            sendResponse({ success: true, token: data.access_token });
          } else {
            sendResponse({ 
              success: false, 
              error: data.error_description || "No access token received" 
            });
          }
        } catch (error) {
          console.error("Token exchange error:", error);
          sendResponse({ 
            success: false, 
            error: `Token exchange failed: ${error.message}` 
          });
        }
      }
    );
  } catch (error) {
    console.error("Login error:", error);
    sendResponse({ success: false, error: error.message });
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
    const result = await chrome.storage.local.get(['githubToken', 'tokenExpiry']);
    const isAuthenticated = !!(result.githubToken && result.tokenExpiry > Date.now());
    
    sendResponse({ authenticated: isAuthenticated });
  } catch (error) {
    console.error("Status check error:", error);
    sendResponse({ authenticated: false, error: error.message });
  }
}

// Clean up expired tokens
chrome.runtime.onStartup.addListener(async () => {
  try {
    const result = await chrome.storage.local.get(['tokenExpiry']);
    if (result.tokenExpiry && result.tokenExpiry <= Date.now()) {
      await chrome.storage.local.remove(['githubToken', 'tokenExpiry']);
    }
  } catch (error) {
    console.error("Startup cleanup error:", error);
  }
});