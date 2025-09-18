// popup.js - LeetCode Agent
// TODO: Add content from Claude artifacts

// DOM elements
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const loginText = document.getElementById("loginText");
const loginSpinner = document.getElementById("loginSpinner");
const status = document.getElementById("status");
const authSection = document.getElementById("authSection");
const actionsSection = document.getElementById("actionsSection");
const settingsSection = document.getElementById("settingsSection");
const pushCurrentBtn = document.getElementById("pushCurrentBtn");
const checkStatusBtn = document.getElementById("checkStatusBtn");
const repoNameInput = document.getElementById("repoName");

// State management
let isAuthenticated = false;
let isLoading = false;

// Initialize popup
document.addEventListener("DOMContentLoaded", async () => {
  await checkAuthStatus();
  await loadSettings();
  setupEventListeners();
});

// Event listeners
function setupEventListeners() {
  loginBtn.addEventListener("click", handleLogin);
  logoutBtn.addEventListener("click", handleLogout);
  pushCurrentBtn.addEventListener("click", handlePushCurrent);
  checkStatusBtn.addEventListener("click", handleCheckStatus);
  repoNameInput.addEventListener("change", saveSettings);
}

// Authentication functions
async function handleLogin() {
  if (isLoading) return;
  
  setLoading(true);
  updateStatus("Connecting to GitHub...", "info");
  
  try {
    const response = await sendMessage({ type: "login" });
    
    if (response.success) {
      isAuthenticated = true;
      updateStatus("✅ Successfully logged in!", "success");
      updateUI();
    } else {
      updateStatus(`❌ Login failed: ${response.error}`, "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    updateStatus(`❌ Login failed: ${error.message}`, "error");
  } finally {
    setLoading(false);
  }
}

async function handleLogout() {
  try {
    await chrome.storage.local.remove(['githubToken', 'tokenExpiry']);
    
    // Also notify backend
    try {
      await fetch("http://127.0.0.1:5000/logout", { method: "POST" });
    } catch (e) {
      console.warn("Backend logout failed:", e.message);
    }
    
    isAuthenticated = false;
    updateStatus("Logged out successfully", "info");
    updateUI();
  } catch (error) {
    console.error("Logout error:", error);
    updateStatus(`Logout failed: ${error.message}`, "error");
  }
}

// Action handlers
async function handlePushCurrent() {
  if (!isAuthenticated) {
    updateStatus("Please login first", "error");
    return;
  }

  setLoading(true);
  updateStatus("Getting current solution...", "info");

  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab.url.includes("leetcode.com")) {
      updateStatus("Please navigate to a LeetCode problem page", "error");
      return;
    }

    // Inject content script to get solution
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: extractLeetCodeSolution
    });

    if (!results || !results[0] || !results[0].result) {
      updateStatus("Could not extract solution from page", "error");
      return;
    }

    const solutionData = results[0].result;
    const repoName = repoNameInput.value || "leetcode-solutions";

    // Push to GitHub
    const pushData = {
      filename: solutionData.filename,
      content: solutionData.content,
      repo: repoName,
      message: `Add solution: ${solutionData.title}`
    };

    const response = await sendMessage({ 
      type: "pushCode", 
      data: pushData 
    });

    if (response.success) {
      updateStatus(`✅ ${solutionData.filename} pushed successfully!`, "success");
    } else {
      updateStatus(`❌ Push failed: ${response.error}`, "error");
    }
  } catch (error) {
    console.error("Push current error:", error);
    updateStatus(`❌ Failed to push: ${error.message}`, "error");
  } finally {
    setLoading(false);
  }
}

async function handleCheckStatus() {
  setLoading(true);
  
  try {
    const response = await sendMessage({ type: "checkStatus" });
    
    if (response.authenticated) {
      updateStatus("✅ GitHub connection active", "success");
    } else {
      updateStatus("❌ Not connected to GitHub", "error");
      isAuthenticated = false;
      updateUI();
    }
  } catch (error) {
    updateStatus(`Status check failed: ${error.message}`, "error");
  } finally {
    setLoading(false);
  }
}

// Utility functions
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['githubToken', 'tokenExpiry']);
    isAuthenticated = !!(result.githubToken && result.tokenExpiry > Date.now());
    updateUI();
  } catch (error) {
    console.error("Auth check error:", error);
    isAuthenticated = false;
    updateUI();
  }
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(['repoName']);
    if (result.repoName) {
      repoNameInput.value = result.repoName;
    }
  } catch (error) {
    console.error("Load settings error:", error);
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ repoName: repoNameInput.value });
  } catch (error) {
    console.error("Save settings error:", error);
  }
}

function updateUI() {
  if (isAuthenticated) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "block";
    actionsSection.style.display = "block";
    settingsSection.style.display = "block";
  } else {
    loginBtn.style.display = "block";
    logoutBtn.style.display = "none";
    actionsSection.style.display = "none";
    settingsSection.style.display = "none";
  }
}

function setLoading(loading) {
  isLoading = loading;
  loginBtn.disabled = loading;
  pushCurrentBtn.disabled = loading;
  checkStatusBtn.disabled = loading;
  
  if (loading) {
    loginSpinner.style.display = "inline-block";
    loginText.textContent = "Connecting...";
  } else {
    loginSpinner.style.display = "none";
    loginText.textContent = "Login with GitHub";
  }
}

function updateStatus(message, type = "info") {
  status.textContent = message;
  status.className = `status-${type}`;
  
  // Auto-clear after 5 seconds for non-error messages
  if (type !== "error") {
    setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
        status.className = "";
      }
    }, 5000);
  }
}

function sendMessage(message) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, resolve);
  });
}

// Content script function to extract LeetCode solution
function extractLeetCodeSolution() {
  try {
    // Get problem title
    const titleElement = document.querySelector('[data-cy="question-title"]') || 
                        document.querySelector('.css-v3d350') ||
                        document.querySelector('h1');
    const title = titleElement ? titleElement.textContent.trim() : 'Unknown Problem';
    
    // Get code editor content
    const codeEditor = document.querySelector('.monaco-editor .view-lines') ||
                      document.querySelector('[data-mode-id="python"]') ||
                      document.querySelector('textarea[autocomplete="off"]');
    
    if (!codeEditor) {
      throw new Error("Could not find code editor on page");
    }
    
    let code = '';
    if (codeEditor.tagName === 'TEXTAREA') {
      code = codeEditor.value;
    } else {
      // Monaco editor
      const lines = codeEditor.querySelectorAll('.view-line');
      code = Array.from(lines).map(line => line.textContent).join('\n');
    }
    
    if (!code.trim()) {
      throw new Error("No code found in editor");
    }
    
    // Generate filename
    const sanitizedTitle = title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${sanitizedTitle}_${timestamp}.py`;
    
    return {
      title: title,
      content: code,
      filename: filename,
      url: window.location.href
    };
  } catch (error) {
    throw new Error(`Failed to extract solution: ${error.message}`);
  }
}