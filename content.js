
(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        selectors: {
            problemTitle: '[data-cy="question-title"], .css-v3d350, h1[class*="title"]',
            difficulty: '[diff="Easy"], [diff="Medium"], [diff="Hard"], .css-10o4wqw, [class*="difficulty"]',
            codeEditor: '.monaco-editor .view-lines, [data-mode-id], textarea[autocomplete="off"]',
            submitButton: '[data-cy="submit-code-btn"], button[class*="submit"]',
            runButton: '[data-cy="run-code-btn"], button[class*="run"]',
            language: '[id*="lang"], .ant-select-selection-item, [class*="language"]',
            description: '[class*="content"], .question-content, [class*="description"]'
        },
        patterns: {
            problemUrl: /leetcode\.com\/problems\/([^\/\?]+)/,
            submissionSuccess: /(accepted|success)/i,
            timeComplexity: /time complexity[:\s]*o\([^)]+\)/gi,
            spaceComplexity: /space complexity[:\s]*o\([^)]+\)/gi
        }
    };
    
    // State management
    let currentProblemData = null;
    let solutionHistory = [];
    let isExtensionActive = false;
    
    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
    
    function initialize() {
        console.log('LeetCode Agent: Content script initialized');
        
        // Set up observers and listeners
        setupProblemObserver();
        setupMessageListener();
        extractCurrentProblemData();
        
        // Add extension UI elements
        addExtensionUI();
        
        isExtensionActive = true;
    }
    
    function setupMessageListener() {
        // Listen for messages from popup/background script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                switch (message.type) {
                    case 'extractProblem':
                        sendResponse(extractCurrentProblemData());
                        break;
                    case 'extractSolution':
                        sendResponse(extractSolutionCode());
                        break;
                    case 'getFullData':
                        sendResponse(getFullProblemSolutionData());
                        break;
                    case 'submitSolution':
                        submitCurrentSolution();
                        sendResponse({ success: true });
                        break;
                    case 'runTests':
                        runCurrentTests();
                        sendResponse({ success: true });
                        break;
                    default:
                        sendResponse({ error: 'Unknown message type' });
                }
            } catch (error) {
                console.error('LeetCode Agent: Message handling error:', error);
                sendResponse({ error: error.message });
            }
            return true;
        });
    }
    
    function setupProblemObserver() {
        // Watch for page changes in SPA
        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if this might be a new problem page
                    const hasRelevantChanges = Array.from(mutation.addedNodes).some(node => 
                        node.nodeType === Node.ELEMENT_NODE && 
                        (node.querySelector && node.querySelector(CONFIG.selectors.problemTitle))
                    );
                    
                    if (hasRelevantChanges) {
                        shouldUpdate = true;
                    }
                }
            });
            
            if (shouldUpdate) {
                // Debounce updates
                clearTimeout(window.leetcodeAgentUpdateTimeout);
                window.leetcodeAgentUpdateTimeout = setTimeout(() => {
                    extractCurrentProblemData();
                    updateExtensionUI();
                }, 500);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    function extractCurrentProblemData() {
        try {
            const problemData = {
                title: extractProblemTitle(),
                difficulty: extractDifficulty(),
                description: extractDescription(),
                url: window.location.href,
                problemId: extractProblemId(),
                timestamp: new Date().toISOString()
            };
            
            // Only update if we have meaningful data
            if (problemData.title && problemData.title !== 'Unknown Problem') {
                currentProblemData = problemData;
                console.log('LeetCode Agent: Problem data extracted:', problemData);
            }
            
            return currentProblemData;
        } catch (error) {
            console.error('LeetCode Agent: Error extracting problem data:', error);
            return null;
        }
    }
    
    function extractProblemTitle() {
        const titleElement = document.querySelector(CONFIG.selectors.problemTitle);
        if (titleElement) {
            return titleElement.textContent.trim();
        }
        
        // Fallback: try to extract from URL or page title
        const urlMatch = window.location.href.match(CONFIG.patterns.problemUrl);
        if (urlMatch) {
            return urlMatch[1].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        }
        
        return 'Unknown Problem';
    }
    
    function extractDifficulty() {
        const difficultyElement = document.querySelector(CONFIG.selectors.difficulty);
        if (difficultyElement) {
            const text = difficultyElement.textContent.toLowerCase();
            if (text.includes('easy')) return 'Easy';
            if (text.includes('medium')) return 'Medium';
            if (text.includes('hard')) return 'Hard';
        }
        
        // Try to find difficulty in various places
        const allText = document.body.textContent.toLowerCase();
        if (allText.includes('difficulty: easy')) return 'Easy';
        if (allText.includes('difficulty: medium')) return 'Medium';
        if (allText.includes('difficulty: hard')) return 'Hard';
        
        return 'Unknown';
    }
    
    function extractDescription() {
        const descElement = document.querySelector(CONFIG.selectors.description);
        if (descElement) {
            // Clean up the description text
            let description = descElement.textContent.trim();
            // Remove excessive whitespace
            description = description.replace(/\s+/g, ' ');
            // Limit length
            if (description.length > 500) {
                description = description.substring(0, 500) + '...';
            }
            return description;
        }
        return '';
    }
    
    function extractProblemId() {
        const urlMatch = window.location.href.match(CONFIG.patterns.problemUrl);
        return urlMatch ? urlMatch[1] : null;
    }
    
    function extractSolutionCode() {
        try {
            const codeEditor = document.querySelector(CONFIG.selectors.codeEditor);
            let code = '';
            
            if (!codeEditor) {
                throw new Error('Code editor not found');
            }
            
            // Handle different editor types
            if (codeEditor.tagName === 'TEXTAREA') {
                code = codeEditor.value;
            } else if (codeEditor.classList.contains('view-lines')) {
                // Monaco editor
                const lines = codeEditor.querySelectorAll('.view-line');
                code = Array.from(lines).map(line => {
                    // Extract text content while preserving formatting
                    return line.textContent || '';
                }).join('\n');
            } else {
                // Generic fallback
                code = codeEditor.textContent || codeEditor.innerText || '';
            }
            
            if (!code.trim()) {
                throw new Error('No code found in editor');
            }
            
            const language = extractLanguage();
            
            return {
                code: code,
                language: language,
                timestamp: new Date().toISOString(),
                success: true
            };
            
        } catch (error) {
            console.error('LeetCode Agent: Error extracting solution:', error);
            return {
                error: error.message,
                success: false
            };
        }
    }
    
    function extractLanguage() {
        const langElement = document.querySelector(CONFIG.selectors.language);
        if (langElement) {
            const langText = langElement.textContent.toLowerCase();
            if (langText.includes('python')) return 'python';
            if (langText.includes('java')) return 'java';
            if (langText.includes('javascript')) return 'javascript';
            if (langText.includes('c++')) return 'cpp';
            if (langText.includes('c#')) return 'csharp';
            if (langText.includes('go')) return 'go';
            if (langText.includes('rust')) return 'rust';
            if (langText.includes('swift')) return 'swift';
            if (langText.includes('kotlin')) return 'kotlin';
        }
        
        // Fallback: try to detect from code syntax
        const solution = extractSolutionCode();
        if (solution.success && solution.code) {
            return detectLanguageFromCode(solution.code);
        }
        
        return 'python'; // Default assumption
    }
    
    function detectLanguageFromCode(code) {
        const lowerCode = code.toLowerCase();
        
        if (lowerCode.includes('def ') || lowerCode.includes('import ') || lowerCode.includes('print(')) {
            return 'python';
        }
        if (lowerCode.includes('public class') || lowerCode.includes('system.out')) {
            return 'java';
        }
        if (lowerCode.includes('function') || lowerCode.includes('console.log') || lowerCode.includes('const ')) {
            return 'javascript';
        }
        if (lowerCode.includes('#include') || lowerCode.includes('std::')) {
            return 'cpp';
        }
        if (lowerCode.includes('using system') || lowerCode.includes('console.writeline')) {
            return 'csharp';
        }
        
        return 'python'; // Default
    }
    
    function getFullProblemSolutionData() {
        const problemData = extractCurrentProblemData();
        const solutionData = extractSolutionCode();
        
        if (!problemData) {
            return { error: 'Could not extract problem data', success: false };
        }
        
        if (!solutionData.success) {
            return { error: solutionData.error, success: false };
        }
        
        // Generate filename
        const sanitizedTitle = problemData.title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const extension = getFileExtension(solutionData.language);
        const filename = `${sanitizedTitle}_${timestamp}.${extension}`;
        
        return {
            title: problemData.title,
            difficulty: problemData.difficulty,
            description: problemData.description,
            url: problemData.url,
            problemId: problemData.problemId,
            content: solutionData.code,
            language: solutionData.language,
            filename: filename,
            timestamp: new Date().toISOString(),
            success: true
        };
    }
    
    function getFileExtension(language) {
        const extensions = {
            'python': 'py',
            'java': 'java',
            'javascript': 'js',
            'cpp': 'cpp',
            'csharp': 'cs',
            'go': 'go',
            'rust': 'rs',
            'swift': 'swift',
            'kotlin': 'kt'
        };
        return extensions[language] || 'txt';
    }
    
    function submitCurrentSolution() {
        const submitButton = document.querySelector(CONFIG.selectors.submitButton);
        if (submitButton && !submitButton.disabled) {
            submitButton.click();
            console.log('LeetCode Agent: Solution submitted');
            
            // Track submission
            setTimeout(() => {
                checkSubmissionResult();
            }, 2000);
        } else {
            console.warn('LeetCode Agent: Submit button not found or disabled');
        }
    }
    
    function runCurrentTests() {
        const runButton = document.querySelector(CONFIG.selectors.runButton);
        if (runButton && !runButton.disabled) {
            runButton.click();
            console.log('LeetCode Agent: Tests running');
        } else {
            console.warn('LeetCode Agent: Run button not found or disabled');
        }
    }
    
    function checkSubmissionResult() {
        // Look for success/failure indicators
        const resultElements = document.querySelectorAll('[class*="result"], [class*="status"], [class*="accepted"]');
        
        for (const element of resultElements) {
            const text = element.textContent.toLowerCase();
            if (CONFIG.patterns.submissionSuccess.test(text)) {
                // Solution was accepted
                const solutionData = getFullProblemSolutionData();
                if (solutionData.success) {
                    // Store successful solution
                    solutionHistory.push({
                        ...solutionData,
                        status: 'accepted',
                        submissionTime: new Date().toISOString()
                    });
                    
                    // Notify extension
                    chrome.runtime.sendMessage({
                        type: 'solutionAccepted',
                        data: solutionData
                    });
                }
                break;
            }
        }
    }
    
    function addExtensionUI() {
        // Only add UI if we're on a problem page
        if (!window.location.href.includes('/problems/')) {
            return;
        }
        
        // Check if UI already exists
        if (document.getElementById('leetcode-agent-ui')) {
            return;
        }
        
        // Create floating action button
        const fab = document.createElement('div');
        fab.id = 'leetcode-agent-ui';
        fab.innerHTML = `
            <div class="lc-agent-fab" title="LeetCode Agent">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L2 7V17L12 22L22 17V7L12 2M12 4.84L19.5 8.5L12 12.16L4.5 8.5L12 4.84M4 10.16L11 13.84V19.84L4 16.16V10.16M13 13.84L20 10.16V16.16L13 19.84V13.84Z"/>
                </svg>
            </div>
            <div class="lc-agent-menu" style="display: none;">
                <button class="lc-agent-btn" data-action="extract">Extract Problem</button>
                <button class="lc-agent-btn" data-action="push">Push to GitHub</button>
                <button class="lc-agent-btn" data-action="analyze">Analyze Solution</button>
                <button class="lc-agent-btn" data-action="optimize">Get Hints</button>
            </div>
        `;
        
        // Add styles
        const styles = document.createElement('style');
        styles.textContent = `
            #leetcode-agent-ui {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .lc-agent-fab {
                width: 56px;
                height: 56px;
                background: linear-gradient(135deg, #4caf50, #2b8a3e);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                color: white;
                transition: all 0.2s ease;
            }
            
            .lc-agent-fab:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 16px rgba(0,0,0,0.2);
            }
            
            .lc-agent-menu {
                position: absolute;
                bottom: 70px;
                right: 0;
                background: white;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                border: 1px solid #e0e0e0;
                min-width: 200px;
                overflow: hidden;
            }
            
            .lc-agent-btn {
                display: block;
                width: 100%;
                padding: 12px 16px;
                border: none;
                background: white;
                text-align: left;
                cursor: pointer;
                font-size: 14px;
                color: #333;
                transition: background-color 0.15s ease;
            }
            
            .lc-agent-btn:hover {
                background-color: #f5f5f5;
            }
            
            .lc-agent-btn:active {
                background-color: #eeeeee;
            }
        `;
        
        document.head.appendChild(styles);
        document.body.appendChild(fab);
        
        // Add event listeners
        const fabButton = fab.querySelector('.lc-agent-fab');
        const menu = fab.querySelector('.lc-agent-menu');
        
        fabButton.addEventListener('click', (e) => {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!fab.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
        
        // Handle menu actions
        fab.addEventListener('click', (e) => {
            if (e.target.classList.contains('lc-agent-btn')) {
                const action = e.target.dataset.action;
                handleUIAction(action);
                menu.style.display = 'none';
            }
        });
    }
    
    function handleUIAction(action) {
        switch (action) {
            case 'extract':
                const problemData = getFullProblemSolutionData();
                if (problemData.success) {
                    showNotification('✅ Problem data extracted successfully!', 'success');
                    console.log('Extracted data:', problemData);
                } else {
                    showNotification('❌ Failed to extract problem data', 'error');
                }
                break;
                
            case 'push':
                chrome.runtime.sendMessage({
                    type: 'pushCurrentSolution'
                }, (response) => {
                    if (response && response.success) {
                        showNotification('✅ Solution pushed to GitHub!', 'success');
                    } else {
                        showNotification('❌ Failed to push solution', 'error');
                    }
                });
                break;
                
            case 'analyze':
                const solutionData = getFullProblemSolutionData();
                if (solutionData.success) {
                    chrome.runtime.sendMessage({
                        type: 'analyzeSolution',
                        data: solutionData
                    });
                    showNotification('🔍 Analyzing solution...', 'info');
                }
                break;
                
            case 'optimize':
                showNotification('💡 Getting optimization hints...', 'info');
                chrome.runtime.sendMessage({
                    type: 'getHints',
                    data: getFullProblemSolutionData()
                });
                break;
        }
    }
    
    function showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.getElementById('lc-agent-notification');
        if (existing) {
            existing.remove();
        }
        
        const notification = document.createElement('div');
        notification.id = 'lc-agent-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10001;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Add slide-in animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 4000);
    }
    
    function updateExtensionUI() {
        // Update UI based on current problem
        const fab = document.getElementById('leetcode-agent-ui');
        if (fab && currentProblemData) {
            const fabButton = fab.querySelector('.lc-agent-fab');
            fabButton.title = `LeetCode Agent - ${currentProblemData.title}`;
        }
    }
    
    // Export functions for testing/debugging
    window.leetcodeAgent = {
        extractProblemData: extractCurrentProblemData,
        extractSolution: extractSolutionCode,
        getFullData: getFullProblemSolutionData,
        getCurrentData: () => currentProblemData,
        getSolutionHistory: () => solutionHistory
    };
    
})();