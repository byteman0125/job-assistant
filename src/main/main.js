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

// Intercept console.log to send Jobright logs to UI
const originalConsoleLog = console.log;
console.log = function(...args) {
  originalConsoleLog.apply(console, args);
  
  // Send Jobright logs to UI
  const message = args.join(' ');
  if (message.includes('Jobright:') && mainWindow) {
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
  });
  
  // Register main window globally
  setMainWindow(mainWindow);

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
  if (isScraperRunning) return;
  
  isScraperRunning = true;
  updateTrayMenu();
  
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
            else if (platform === 'Jobgether') domain = '.jobgether.com';
            else if (platform === 'BuiltIn') domain = '.builtin.com';
            else if (platform === 'ZipRecruiter') domain = '.ziprecruiter.com';
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
  
  console.log('Scraper stopped');
  
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
          await chatgptSession.cookies.set({
            url: 'https://chatgpt.com',
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || '.chatgpt.com',
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly !== false,
            expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 365)
          });
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

ipcMain.handle('update-job-applied-status', async (event, id, applied) => {
  return db.updateJobAppliedStatus(id, applied);
});

ipcMain.handle('update-multiple-jobs-applied-status', async (event, ids, applied) => {
  return db.updateMultipleJobsAppliedStatus(ids, applied);
});

ipcMain.handle('get-jobs-by-applied-status', async (event, appliedStatus) => {
  return db.getJobsByAppliedStatus(appliedStatus);
});

ipcMain.handle('chatgpt-send-result', async (event, result) => {
  // Handler for ChatGPT send confirmation
  return result;
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
          await chatgptSession.cookies.set({
            url: 'https://chatgpt.com',
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || '.chatgpt.com',
            path: cookie.path || '/',
            secure: cookie.secure !== false,
            httpOnly: cookie.httpOnly !== false,
            expirationDate: cookie.expirationDate || (Date.now() / 1000 + 86400 * 365)
          });
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

