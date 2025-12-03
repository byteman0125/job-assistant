const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const Database = require('./database');
const ScraperManager = require('./scrapers/scraperManager');
const { setMainWindow } = require('./windowManager');
const { setScrapingWebContents, updateScrapingStatus } = require('./scrapingViewManager');

let mainWindow = null;
let tray = null;
let db = null;
let scraperManager = null;
let isScraperRunning = false;
let todayJobCount = 0;

// Intercept console.log to send platform logs to UI
const originalConsoleLog = console.log;
const trackedLogPlatforms = [
  'Jobright',
  'Himalayas',
  'BuiltIn',
  'ZipRecruiter',
  'RemoteOK',
  'WeWorkRemotely',
  'Jungle',
  'Rocketship'
];
console.log = function(...args) {
  originalConsoleLog.apply(console, args);
  
  // Send Jobright logs to UI
  const message = args.join(' ');
  if (mainWindow && trackedLogPlatforms.some(name => message.includes(`${name}:`))) {
    mainWindow.webContents.send('console-log', {
      message: message,
      timestamp: new Date().toLocaleTimeString()
    });
  }
};

// Initialize database
function initDatabase() {
  db = new Database();
  console.log('Database initialized');
}

// Create main window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    frame: false, // Remove title bar and menu
    transparent: true, // Enable transparency for rounded corners
    backgroundColor: '#00000000', // Transparent background
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webviewTag: true
    },
    icon: path.join(__dirname, '../../assets/icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // ChatGPT UI removed - no longer needed
  });
  
  // Register main window globally
  setMainWindow(mainWindow);

  // Handle webview attachments to hide Electron/automation indicators
  mainWindow.webContents.on('did-attach-webview', (event, webContents) => {
    console.log('🔧 Webview attached - Setting up anti-detection...');
    
    // Set realistic Chrome user agent (Windows Chrome 120)
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    webContents.setUserAgent(userAgent);
    console.log(`✅ User agent set: Chrome (not Electron)`);
    
    // ChatGPT webview removed - no longer needed
    
    // Hide webdriver and automation flags
    webContents.executeJavaScript(`
      // Remove webdriver property
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      
      // Hide automation indicators
      window.chrome = window.chrome || {};
      window.chrome.runtime = window.chrome.runtime || {};
      
      // Make navigator.plugins look realistic
      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          { name: 'Chrome PDF Plugin' },
          { name: 'Chrome PDF Viewer' },
          { name: 'Native Client' }
        ]
      });
      
      // Hide automation flags
      delete navigator.__proto__.webdriver;
      
      console.log('✅ Anti-detection measures applied');
    `).catch(err => {
      console.log('⚠️ Could not inject anti-detection:', err.message);
    });
    
    // Log when webview navigation occurs
    webContents.on('did-navigate', (event, url) => {
      console.log(`🔗 Webview navigated to: ${url}`);
    });
  });

  // Hide to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  
  updateTrayMenu();
  
  tray.setToolTip('Job Searcher');
  
  // Click tray icon to show window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    }
  });
}

// Update tray menu
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    {
      label: 'Hide',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    { type: 'separator' },
    {
      label: isScraperRunning ? 'Stop Scraping' : 'Start Scraping',
      click: () => {
        if (isScraperRunning) {
          stopScraping();
        } else {
          startScraping();
        }
      }
    },
    { type: 'separator' },
    {
      label: `New Jobs Today: ${todayJobCount}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Close',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

// Update tray badge
function updateTrayBadge(count) {
  todayJobCount = count;
  updateTrayMenu();
  
  // Show notification
  if (count > 0 && mainWindow) {
    mainWindow.webContents.send('notification', {
      title: 'New Jobs Found!',
      body: `${count} new remote jobs found today`
    });
  }
}

// Start scraping
async function startScraping() {
  if (isScraperRunning) {
    console.log('⚠️ Scraper is already running, ignoring duplicate start request');
    return;
  }
  
  isScraperRunning = true;
  updateTrayMenu();
  
  // Notify renderer to update UI
  if (mainWindow) {
    mainWindow.webContents.send('scraper-status-changed', { 
      running: true,
      todayCount: todayJobCount 
    });
  }
  
  // Load all platform cookies into scraping webview session BEFORE starting
  console.log('Loading platform cookies into scraping session...');
  try {
    const { session } = require('electron');
    const scrapingSession = session.fromPartition('persist:scraping');
    const allCookies = db.getAllCookies();
    
    for (const [platform, cookies] of Object.entries(allCookies)) {
      if (platform === 'chatgpt') continue; // Skip ChatGPT cookies
      
      console.log(`Loading ${cookies.length} cookies for ${platform}...`);
      
      for (const cookie of cookies) {
        try {
          // Determine domain based on platform
          let domain = cookie.domain;
          if (!domain) {
            if (platform === 'Jobright') domain = '.jobright.ai';
            else if (platform === 'Himalayas') domain = '.himalayas.app';
            else if (platform === 'RemoteOK') domain = '.remoteok.com';
            else if (platform === 'WeWorkRemotely') domain = '.weworkremotely.com';
            else if (platform === 'BuiltIn') domain = '.builtin.com';
            else if (platform === 'ZipRecruiter') domain = '.ziprecruiter.com';
            else if (platform === 'Jungle') domain = '.welcometothejungle.com';
            else if (platform === 'Rocketship') domain = '.remoterocketship.com';
          }
          
          await scrapingSession.cookies.set({
            url: `https://${domain.replace(/^\./, '')}`,
            name: cookie.name,
            value: cookie.value,
            domain: domain,
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly !== false,
            expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 365)
          });
        } catch (err) {
          console.error(`  Error setting cookie ${cookie.name}:`, err.message);
        }
      }
      
      console.log(`✅ ${platform} cookies loaded into scraping session`);
    }
  } catch (error) {
    console.error('Error loading cookies:', error);
  }
  
  if (!scraperManager) {
    scraperManager = new ScraperManager(db);
  }
  
  console.log('Starting scraper...');
  
  try {
    await scraperManager.start((newJobCount) => {
      updateTrayBadge(newJobCount);
      if (mainWindow) {
        mainWindow.webContents.send('jobs-updated');
        mainWindow.webContents.send('scraping-status-update', {
          platform: 'Running',
          progress: 'Scraping...',
          jobsFound: newJobCount
        });
      }
    });
  } catch (error) {
    console.error('Scraping error:', error);
    isScraperRunning = false;
    updateTrayMenu();
  }
}

// Stop scraping
function stopScraping() {
  if (!isScraperRunning) return;
  
  isScraperRunning = false;
  updateTrayMenu();
  
  if (scraperManager) {
    scraperManager.stop();
  }
  
  // Don't log here - renderer will show a single notification
  
  // Notify renderer that scraping has stopped
  if (mainWindow) {
    mainWindow.webContents.send('scraper-status-changed', { 
      running: false, 
      todayCount: todayJobCount 
    });
  }
}

// IPC Handlers
ipcMain.handle('get-jobs', async () => {
  return db.getAllJobs();
});

ipcMain.handle('get-jobs-today', async () => {
  return db.getJobsToday();
});

ipcMain.handle('save-cookies', async (event, platform, cookies) => {
  const result = db.saveCookies(platform, cookies);
  
  // If saving ChatGPT cookies, also set them in the webview session
  if (platform === 'chatgpt' && Array.isArray(cookies)) {
    try {
      const { session } = require('electron');
      const chatgptSession = session.fromPartition('persist:chatgpt');
      
      for (const cookie of cookies) {
        try {
          const cookieConfig = {
            url: 'https://chatgpt.com',
            name: cookie.name,
            value: cookie.value,
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly !== false,
            expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 365)
          };
          
          // Handle __Host- and __Secure- prefix cookies specially
          if (cookie.name.startsWith('__Host-')) {
            // __Host- cookies MUST NOT have a domain attribute
            // They MUST be secure and MUST have path='/'
            cookieConfig.secure = true;
            cookieConfig.path = '/';
            // Don't set domain at all
          } else if (cookie.name.startsWith('__Secure-')) {
            // __Secure- cookies MUST be secure
            cookieConfig.secure = true;
            cookieConfig.domain = cookie.domain || '.chatgpt.com';
          } else {
            // Regular cookies can have domain
            cookieConfig.domain = cookie.domain || '.chatgpt.com';
          }
          
          await chatgptSession.cookies.set(cookieConfig);
        } catch (err) {
          console.error(`Error setting cookie ${cookie.name}:`, err.message);
        }
      }
      console.log('ChatGPT cookies set in session');
    } catch (error) {
      console.error('Error setting ChatGPT session cookies:', error);
    }
  }
  
  return result;
});

ipcMain.handle('get-cookies', async (event, platform) => {
  return db.getCookies(platform);
});

// Cookie set management (multiple sets per platform)
ipcMain.handle('get-cookie-sets', async (event, platform) => {
  return db.getCookieSets(platform);
});

ipcMain.handle('save-cookie-set', async (event, payload) => {
  const { id, platform, label, cookies } = payload || {};
  if (!platform || !Array.isArray(cookies)) {
    throw new Error('Invalid cookie set payload');
  }
  if (id) {
    db.updateCookieSet(id, label, cookies);
    return { success: true, id };
  }
  const newId = db.saveCookieSet(platform, label, cookies);
  return { success: true, id: newId };
});

ipcMain.handle('delete-cookie-set', async (event, id) => {
  if (!id) throw new Error('Missing cookie set id');
  const ok = db.deleteCookieSet(id);
  return { success: ok };
});

ipcMain.handle('reorder-cookie-sets', async (event, platform, orderedIds) => {
  if (!platform || !Array.isArray(orderedIds)) {
    throw new Error('Invalid reorder payload');
  }
  const ok = db.reorderCookieSets(platform, orderedIds);
  return { success: ok };
});

ipcMain.handle('save-actions', async (event, platform, actions) => {
  return db.saveActions(platform, actions);
});

ipcMain.handle('get-actions', async (event, platform) => {
  return db.getActions(platform);
});

// Settings IPC handlers
ipcMain.handle('get-settings', async () => {
  return db.getAllSettings();
});

ipcMain.handle('save-settings', async (event, settings) => {
  // Save each setting
  for (const [key, value] of Object.entries(settings)) {
    db.saveSetting(key, value);
  }
  return { success: true };
});

ipcMain.handle('test-google-sheets', async (event, credentialsJson) => {
  try {
    // Temporarily save credentials to test
    db.saveSetting('google_sheets_credentials', credentialsJson);
    
    // Get Google Sheets service and test
    const sheetsService = db.getGoogleSheets();
    const result = await sheetsService.testConnection();
    
    return result;
  } catch (error) {
    return { 
      success: false, 
      message: `Test failed: ${error.message}` 
    };
  }
});

// Profile handlers
ipcMain.handle('get-profile', async () => {
  return db.getProfile();
});

ipcMain.handle('save-profile', async (event, profileData) => {
  try {
    db.saveProfile(profileData);
    return { success: true };
  } catch (error) {
    console.error('Error saving profile:', error);
    return { success: false, error: error.message };
  }
});

// Resume handlers
ipcMain.handle('add-resume', async (event, resumeData) => {
  try {
    const id = db.addResume(resumeData);
    return { success: true, id };
  } catch (error) {
    console.error('Error adding resume:', error);
    return { success: false, error: error.message };
  }
});

// File dialog handler
ipcMain.handle('dialog:openFile', async (event, options) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, options);
  
  if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
    return { canceled: true };
  }
  
  const filePath = result.filePaths[0];
  const fileName = filePath.split(/[\\/]/).pop();
  
  return {
    canceled: false,
    filePath,
    fileName
  };
});

ipcMain.handle('get-all-resumes', async () => {
  return db.getAllResumes();
});

ipcMain.handle('get-resume-by-id', async (event, id) => {
  return db.getResumeById(id);
});

ipcMain.handle('get-primary-resume', async () => {
  return db.getPrimaryResume();
});

ipcMain.handle('update-resume', async (event, id, resumeData) => {
  try {
    db.updateResume(id, resumeData);
    return { success: true };
  } catch (error) {
    console.error('Error updating resume:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-resume', async (event, id) => {
  try {
    db.deleteResume(id);
    return { success: true };
  } catch (error) {
    console.error('Error deleting resume:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-matching-resume', async (event, jobTechStack) => {
  return db.getMatchingResume(jobTechStack);
});

ipcMain.handle('clear-profile', async () => {
  try {
    db.clearProfile();
    return { success: true };
  } catch (error) {
    console.error('Error clearing profile:', error);
    return { success: false, error: error.message };
  }
});

// Work Experience handlers
ipcMain.handle('get-all-work-experience', async () => {
  try {
    const experiences = db.getAllWorkExperience();
    return { success: true, data: experiences };
  } catch (error) {
    console.error('Error getting work experience:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-work-experience', async (event, expData) => {
  try {
    const id = db.saveWorkExperience(expData);
    return { success: true, id };
  } catch (error) {
    console.error('Error saving work experience:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-work-experience', async (event, id, expData) => {
  try {
    db.updateWorkExperience(id, expData);
    return { success: true };
  } catch (error) {
    console.error('Error updating work experience:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-work-experience', async (event, id) => {
  try {
    db.deleteWorkExperience(id);
    return { success: true };
  } catch (error) {
    console.error('Error deleting work experience:', error);
    return { success: false, error: error.message };
  }
});

// Education handlers
ipcMain.handle('get-all-education', async () => {
  try {
    const education = db.getAllEducation();
    return { success: true, data: education };
  } catch (error) {
    console.error('Error getting education:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('save-education', async (event, eduData) => {
  try {
    const id = db.saveEducation(eduData);
    return { success: true, id };
  } catch (error) {
    console.error('Error saving education:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-education', async (event, id, eduData) => {
  try {
    db.updateEducation(id, eduData);
    return { success: true };
  } catch (error) {
    console.error('Error updating education:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-education', async (event, id) => {
  try {
    db.deleteEducation(id);
    return { success: true };
  } catch (error) {
    console.error('Error deleting education:', error);
    return { success: false, error: error.message };
  }
});

// Resume parsing handler
ipcMain.handle('parse-resume', async (event, resumePath) => {
  try {
    const gptExtractor = require('./gptExtractor');
    const parsedData = await gptExtractor.parseResumeFile(resumePath);
    return { success: true, data: parsedData };
  } catch (error) {
    console.error('Error parsing resume:', error);
    return { success: false, error: error.message };
  }
});

// Bug Report handlers
ipcMain.handle('get-all-bugs', async (event, filter) => {
  try {
    const bugs = db.getAllBugs(filter || {});
    return { success: true, data: bugs };
  } catch (error) {
    console.error('Error getting bugs:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-bug-stats', async () => {
  try {
    const stats = db.getBugStats();
    return { success: true, data: stats };
  } catch (error) {
    console.error('Error getting bug stats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('update-bug-status', async (event, id, status, notes) => {
  try {
    db.updateBugStatus(id, status, notes);
    return { success: true };
  } catch (error) {
    console.error('Error updating bug status:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-bug', async (event, id) => {
  try {
    db.deleteBug(id);
    return { success: true };
  } catch (error) {
    console.error('Error deleting bug:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('clear-all-bugs', async () => {
  try {
    db.clearAllBugs();
    return { success: true };
  } catch (error) {
    console.error('Error clearing bugs:', error);
    return { success: false, error: error.message };
  }
});

// File dialog handler for resume/cover letter
ipcMain.handle('open-file-dialog', async (event, options) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: options.filters || [
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, filePath: result.filePaths[0] };
  }
  return { success: false };
});

ipcMain.handle('start-scraping', async () => {
  await startScraping();
  return { success: true, running: isScraperRunning };
});

ipcMain.handle('stop-scraping', async () => {
  stopScraping();
  return { success: true, running: isScraperRunning };
});

ipcMain.handle('get-scraper-status', async () => {
  return { running: isScraperRunning, todayCount: todayJobCount };
});

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  const { clipboard } = require('electron');
  clipboard.writeText(text);
  return { success: true };
});

ipcMain.handle('delete-job', async (event, id) => {
  return db.deleteJob(id);
});

ipcMain.handle('update-job-applied-status', async (event, id, applied, appliedBy = 'User') => {
  return db.updateJobAppliedStatus(id, applied, appliedBy);
});

ipcMain.handle('update-multiple-jobs-applied-status', async (event, ids, applied, appliedBy = 'User') => {
  return db.updateMultipleJobsAppliedStatus(ids, applied, appliedBy);
});

ipcMain.handle('get-jobs-by-applied-status', async (event, appliedStatus) => {
  return db.getJobsByAppliedStatus(appliedStatus);
});

ipcMain.handle('chatgpt-send-result', async (event, result) => {
  // Handler for ChatGPT send confirmation
  return result;
});

// Chat with AI handler
ipcMain.handle('chat-with-ai', async (event, message) => {
  try {
    console.log('🤖 Chat request received:', message);
    
    let gptExtractor;
    
    // Get or create GPT extractor instance
    if (scraperManager && scraperManager.gptExtractor) {
      gptExtractor = scraperManager.gptExtractor;
    } else {
      const GPTExtractor = require('./gptExtractor');
      gptExtractor = new GPTExtractor();
      await gptExtractor.initialize();
    }
    
    if (!gptExtractor.ollamaInitialized && !gptExtractor.isReady) {
      return {
        success: false,
        error: 'AI service not available. Please ensure Ollama is running.'
      };
    }
    
    // Send message to Ollama
    const response = await gptExtractor.sendToOllama(message);
    
    if (!response) {
      return {
        success: false,
        error: 'No response from AI service'
      };
    }
    
    console.log('🤖 Chat response:', response.substring(0, 100) + '...');
    
    return {
      success: true,
      message: response
    };
    
  } catch (error) {
    console.error('❌ Chat error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Window controls for custom title bar
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('register-scraping-webview', async (event) => {
  // This will be called when scraping webview is ready
  console.log('Scraping webview registered');
  return { success: true };
});

// Listen for new window redirects
ipcMain.on('new-window-redirected', (event, url) => {
  console.log('🆕 New window redirect captured:', url);
});

// Navigate scraping webview to URL
ipcMain.handle('navigate-scraping-view', async (event, url) => {
  if (mainWindow) {
    mainWindow.webContents.send('load-url-in-scraping-view', url);
  }
  return { success: true };
});

// Execute script in scraping webview
ipcMain.handle('execute-in-scraping-view', async (event, script) => {
  return new Promise((resolve) => {
    if (mainWindow) {
      const requestId = Date.now();
      
      // Listen for result
      ipcMain.once(`scraping-script-result-${requestId}`, (evt, result) => {
        resolve(result);
      });
      
      // Send script to renderer
      mainWindow.webContents.send('execute-script-in-scraping-view', { script, requestId });
    } else {
      resolve(null);
    }
  });
});

// Job Apply Tab - Navigate to URL with Puppeteer
ipcMain.handle('apply-navigate', async (event, url) => {
  try {
    console.log(`Apply Tab: Navigating to ${url}`);
    // For now, just return success - actual Puppeteer integration can be added later
    // The webview will handle the navigation directly
    return { success: true };
  } catch (err) {
    console.error('Apply navigation error:', err);
    return { success: false, error: err.message };
  }
});

// Get ChatGPT cookies
ipcMain.handle('get-gpt-cookies', async () => {
  try {
    return db.getCookies('chatgpt');
  } catch (err) {
    console.error('Error getting GPT cookies:', err);
    return [];
  }
});

// App lifecycle
app.whenReady().then(async () => {
  initDatabase();
  createWindow();
  createTray();
  
  // Load ChatGPT cookies into session if they exist
  try {
    const chatgptCookies = db.getCookies('chatgpt');
    if (chatgptCookies && Array.isArray(chatgptCookies)) {
      const { session } = require('electron');
      const chatgptSession = session.fromPartition('persist:chatgpt');
      
      for (const cookie of chatgptCookies) {
        try {
          const cookieConfig = {
            url: 'https://chatgpt.com',
            name: cookie.name,
            value: cookie.value,
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly !== false,
            expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 365)
          };
          
          // Handle __Host- and __Secure- prefix cookies specially
          if (cookie.name.startsWith('__Host-')) {
            // __Host- cookies MUST NOT have a domain attribute
            // They MUST be secure and MUST have path='/'
            cookieConfig.secure = true;
            cookieConfig.path = '/';
            // Don't set domain at all
          } else if (cookie.name.startsWith('__Secure-')) {
            // __Secure- cookies MUST be secure
            cookieConfig.secure = true;
            cookieConfig.domain = cookie.domain || '.chatgpt.com';
          } else {
            // Regular cookies can have domain
            cookieConfig.domain = cookie.domain || '.chatgpt.com';
          }
          
          await chatgptSession.cookies.set(cookieConfig);
        } catch (err) {
          console.error(`Error loading cookie ${cookie.name}:`, err.message);
        }
      }
      console.log('ChatGPT cookies loaded into session on startup');
    }
  } catch (error) {
    console.error('Error loading ChatGPT cookies on startup:', error);
  }
  
  // Get today's job count
  const todayJobs = db.getJobsToday();
  updateTrayBadge(todayJobs.length);
});

app.on('window-all-closed', () => {
  // Don't quit on window close, keep running in tray
  // Only quit when explicitly closed from tray menu
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  stopScraping();
  if (db) {
    db.close();
  }
});

