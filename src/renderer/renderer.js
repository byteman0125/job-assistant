const { ipcRenderer } = require('electron');

// DOM Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');
const todayCount = document.getElementById('todayCount');
const refreshBtn = document.getElementById('refreshBtn');
const searchInput = document.getElementById('searchInput');
const platformFilter = document.getElementById('platformFilter');
const appliedFilter = document.getElementById('appliedFilter');
const appliedByFilter = document.getElementById('appliedByFilter');
const datePickerContainer = document.getElementById('datePickerContainer');
const appliedDate = document.getElementById('appliedDate');
const datePickerBtn = document.getElementById('datePickerBtn');
const clearDateBtn = document.getElementById('clearDateBtn');
const jobsTableBody = document.getElementById('jobsTableBody');
const selectAllBtn = document.getElementById('selectAllBtn');
const copySelectedBtn = document.getElementById('copySelectedBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const markAppliedBtn = document.getElementById('markAppliedBtn');
const markNotAppliedBtn = document.getElementById('markNotAppliedBtn');
const selectedCount = document.getElementById('selectedCount');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageInfo = document.getElementById('pageInfo');
const pageSize = document.getElementById('pageSize');
const jobsTabCount = document.getElementById('jobsTabCount');

// Pagination state
let currentPage = 1;
let totalPages = 1;
let itemsPerPage = 50;

// Scraping view elements
const scrapingView = document.getElementById('scrapingView');
const totalJobsFound = document.getElementById('totalJobsFound');
const statusPlatform = document.getElementById('statusPlatform');
const statusStep = document.getElementById('statusStep');
const statusProgress = document.getElementById('statusProgress');

// Progress Bar Elements
const progressBarFill = document.getElementById('progressBarFill');
const progressPercentage = document.getElementById('progressPercentage');
const progressStats = document.getElementById('progressStats');
const progressETA = document.getElementById('progressETA');

// Progress tracking
let progressStartTime = null;
let totalJobsInBatch = 0;
let processedJobsCount = 0;

// Cookie Management
const cookiePlatform = document.getElementById('cookiePlatform');
const cookieData = document.getElementById('cookieData');
const saveCookiesBtn = document.getElementById('saveCookiesBtn');
const loadCookiesBtn = document.getElementById('loadCookiesBtn');
const testCookiesBtn = document.getElementById('testCookiesBtn');
const cookieStatus = document.getElementById('cookieStatus');

// Settings Management
const keywordList = document.getElementById('keywordList');
const domainList = document.getElementById('domainList');
const newKeyword = document.getElementById('newKeyword');
const newDomain = document.getElementById('newDomain');
const addKeywordBtn = document.getElementById('addKeywordBtn');
const addDomainBtn = document.getElementById('addDomainBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsStatus = document.getElementById('settingsStatus');

// Scraping state
let isScraping = false;

// Settings state
let currentSettings = {
  enabled_platforms: ['Jobright'],
  ignore_keywords: [],
  ignore_domains: ['indeed.com', 'linkedin.com', 'dice.com'],
  min_salary_annual: 120000,
  min_salary_monthly: '',
  min_salary_hourly: ''
};

// ChatGPT Sidebar
const chatgptView = document.getElementById('chatgptView');
const refreshChatGPT = document.getElementById('refreshChatGPT');
const toggleSidebar = document.getElementById('toggleSidebar');

let allJobs = [];

// ChatGPT Prompt Modal handlers
const gptPromptModal = document.getElementById('gptPromptModal');
const gptPromptOverlay = document.getElementById('gptPromptOverlay');
const gptPromptText = document.getElementById('gptPromptText');
const gptPromptInstructions = document.getElementById('gptPromptInstructions');
const gptWaitingStatus = document.getElementById('gptWaitingStatus');
const gptSendingStatus = document.getElementById('gptSendingStatus');
const copyPromptBtn = document.getElementById('copyPromptBtn');
const closePromptBtn = document.getElementById('closePromptBtn');
const closePromptModal = document.getElementById('closePromptModal');

function showGPTPrompt(data) {
  gptPromptText.value = data.prompt;
  gptPromptModal.style.display = 'block';
  gptPromptOverlay.style.display = 'block';
  
  // Show auto-sending status
  gptPromptInstructions.style.display = 'none';
  gptWaitingStatus.style.display = 'none';
  gptSendingStatus.style.display = 'block';
  
  // Disable copy button during auto-send
  copyPromptBtn.disabled = true;
  copyPromptBtn.style.opacity = '0.6';
  copyPromptBtn.textContent = '🤖 Auto-sending...';
  
  showNotification(`🤖 Auto-sending prompt to ChatGPT...`, 'info');
  
  // After 2 seconds, show waiting status
  setTimeout(() => {
    gptSendingStatus.style.display = 'none';
    gptWaitingStatus.style.display = 'block';
    copyPromptBtn.textContent = '⏳ Waiting for response...';
    showNotification(`⏳ Waiting for ChatGPT to respond (up to 90s)...`, 'info');
  }, 2000);
}

function showWaitingForResponse() {
  gptPromptInstructions.style.display = 'none';
  gptWaitingStatus.style.display = 'block';
  gptSendingStatus.style.display = 'none';
  copyPromptBtn.textContent = '⏳ Waiting for response...';
  copyPromptBtn.disabled = true;
  copyPromptBtn.style.opacity = '0.6';
}

function hideGPTPrompt() {
  gptPromptModal.style.display = 'none';
  gptPromptOverlay.style.display = 'none';
  
  // Reset button
  copyPromptBtn.textContent = '📋 Copy to Clipboard';
  copyPromptBtn.disabled = false;
  copyPromptBtn.style.opacity = '1';
}


// Listen for when ChatGPT responds
ipcRenderer.on('gpt-response-received', (event, data) => {
  console.log('✅ ChatGPT responded! Processing job...');
});

// Listen for timeout
ipcRenderer.on('gpt-response-timeout', () => {
  console.log('⏱️ ChatGPT response timeout - using basic extraction');
});

// Listen for scraper status changes
ipcRenderer.on('scraper-status-changed', (event, data) => {
  console.log('📡 Scraper status changed:', data.running ? 'RUNNING' : 'STOPPED');
  if (data.running) {
    isScraping = true;
    lockSettings();
    startBtn.disabled = true;
    stopBtn.disabled = false;
    stopBtn.textContent = 'Stop Scraping';
    status.textContent = '● Running';
    status.style.color = '#4CAF50';
    console.log('✅ Stop button enabled (from status event):', !stopBtn.disabled);
  } else {
    isScraping = false;
    unlockSettings();
    startBtn.disabled = false;
    stopBtn.disabled = true;
    stopBtn.textContent = 'Stop Scraping';
    status.textContent = '● Stopped';
    status.style.color = '#f44336';
    console.log('🔴 Stop button disabled (from status event):', stopBtn.disabled);
  }
  todayCount.textContent = `${data.todayCount} jobs today`;
});

// Function to update progress bar
function updateProgressBar(currentStep, totalSteps) {
  if (!progressBarFill || !progressPercentage || !progressStats || !progressETA) return;
  
  // Calculate percentage based on current step
  const percentage = totalSteps > 0 ? Math.round((currentStep / totalSteps) * 100) : 0;
  
  // Update progress bar fill
  progressBarFill.style.width = `${percentage}%`;
  progressPercentage.textContent = `${percentage}%`;
  
  // Update stats text - show step progress
  if (totalSteps === 5) {
    // Per-job steps
    const stepNames = ['Opening', 'Removing', 'Extracting', 'Analyzing', 'Saving'];
    const currentStepName = stepNames[currentStep - 1] || 'Processing';
    progressStats.textContent = `Step ${currentStep} of ${totalSteps}: ${currentStepName}`;
  } else {
    progressStats.textContent = `Step ${currentStep} of ${totalSteps}`;
  }
  
  // Simple ETA based on step progress
  if (progressStartTime && currentStep > 0 && totalSteps > 0) {
    const elapsed = (Date.now() - progressStartTime) / 1000; // seconds
    const avgTimePerStep = elapsed / currentStep;
    const remaining = totalSteps - currentStep;
    const etaSeconds = remaining * avgTimePerStep;
    
    if (etaSeconds > 0 && etaSeconds < 120) { // Less than 2 minutes
      const seconds = Math.floor(etaSeconds);
      progressETA.textContent = `~${seconds}s remaining`;
    } else if (etaSeconds >= 120) {
      const minutes = Math.floor(etaSeconds / 60);
      progressETA.textContent = `~${minutes}m remaining`;
    } else {
      progressETA.textContent = 'Almost done';
    }
  } else {
    progressETA.textContent = '--';
  }
}

// Reset progress bar
function resetProgressBar() {
  if (!progressBarFill || !progressPercentage || !progressStats || !progressETA) return;
  
  progressBarFill.style.width = '0%';
  progressPercentage.textContent = '0%';
  progressStats.textContent = 'Ready to start';
  progressETA.textContent = '--';
  progressStartTime = null;
  processedJobsCount = 0;
  totalJobsInBatch = 0;
}

// Listen for console logs and display them in "Current Step"
ipcRenderer.on('console-log', (event, data) => {
  if (!statusStep) return;
  
  // Extract the message and remove "Jobright: " prefix
  const cleanMsg = data.message.replace(/Jobright: /, '').trim();
  
  // Update the Current Step field
  statusStep.textContent = cleanMsg;
  
  // Extract progress info from logs
  // Look for [X/5] pattern for per-job steps
  const stepMatch = cleanMsg.match(/\[(\d+)\/(\d+)\]/);
  const batchMatch = cleanMsg.match(/BATCH (\d+) - Loading job cards/i);
  const foundMatch = cleanMsg.match(/Found (\d+) job cards/i);
  
  if (batchMatch) {
    // Starting a new batch - reset
    progressStartTime = Date.now();
    processedJobsCount = 0;
    totalJobsInBatch = 0;
  } else if (foundMatch) {
    totalJobsInBatch = parseInt(foundMatch[1]);
    updateProgressBar(0, 5); // 5 steps per job
  } else if (stepMatch) {
    // Per-job step progress (e.g., [3/5])
    const currentStep = parseInt(stepMatch[1]);
    const totalSteps = parseInt(stepMatch[2]);
    if (!progressStartTime) progressStartTime = Date.now();
    updateProgressBar(currentStep, totalSteps);
  } else if (cleanMsg.includes('BATCH') && cleanMsg.includes('COMPLETE')) {
    // Batch complete - show 100%
    updateProgressBar(5, 5);
  }
});

// Listen for new job found
ipcRenderer.on('new-job-found', async (event, job) => {
  showNotification(`🎉 New job found: ${job.company} - ${job.title}`, 'success');
  
  // Update unapplied count in Jobs tab
  const unappliedJobs = await ipcRenderer.invoke('get-jobs-by-applied-status', false);
  if (jobsTabCount) {
    jobsTabCount.textContent = `(${unappliedJobs.length})`;
  }
});

// Listen for today count updates
ipcRenderer.on('update-today-count', (event, count) => {
  todayCount.textContent = `${count} jobs today`;
});

// Custom title bar controls
const minimizeBtn = document.getElementById('minimizeBtn');
const maximizeBtn = document.getElementById('maximizeBtn');
const closeBtn = document.getElementById('closeBtn');

if (minimizeBtn) {
  minimizeBtn.addEventListener('click', () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('window-minimize');
  });
}

if (maximizeBtn) {
  maximizeBtn.addEventListener('click', () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('window-maximize');
  });
}

if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    const { ipcRenderer } = require('electron');
    ipcRenderer.send('window-close');
  });
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadJobs();
  await updateScraperStatus();
  setupEventListeners();
  setupTabs();
  setupDragSelection();
  
  // Setup GPT prompt modal buttons
  if (copyPromptBtn) {
    copyPromptBtn.addEventListener('click', async () => {
      if (copyPromptBtn.disabled) return;
      
      await ipcRenderer.invoke('copy-to-clipboard', gptPromptText.value);
      showNotification('✅ Prompt copied as backup!', 'success');
    });
  }
  
  if (closePromptBtn) closePromptBtn.addEventListener('click', hideGPTPrompt);
  if (closePromptModal) closePromptModal.addEventListener('click', hideGPTPrompt);
  if (gptPromptOverlay) gptPromptOverlay.addEventListener('click', hideGPTPrompt);
  
  // Auto-load ChatGPT cookies on startup to show they're saved
  setTimeout(async () => {
    if (cookiePlatform && cookiePlatform.value === 'chatgpt') {
      await loadCookies();
    }
  }, 1000);
});

// Setup Event Listeners
function setupEventListeners() {
  startBtn.addEventListener('click', startScraping);
  stopBtn.addEventListener('click', stopScraping);
  refreshBtn.addEventListener('click', loadJobs);
  searchInput.addEventListener('input', filterJobs);
  platformFilter.addEventListener('change', filterJobs);
  document.getElementById('jobTypeFilter').addEventListener('change', filterJobs);
  document.getElementById('industryFilter').addEventListener('change', filterJobs);
  
  // Applied filter - show/hide additional filters
  appliedFilter.addEventListener('change', () => {
    const isAppliedOnly = appliedFilter.value === 'applied';
    
    // Show/hide Applied By filter and Date Picker only when "Applied Only" is selected
    if (isAppliedOnly) {
      datePickerContainer.style.display = 'flex';
    } else {
      appliedByFilter.style.display = 'none';
      datePickerContainer.style.display = 'none';
      // Reset filters when hiding them
      appliedByFilter.value = '';
      appliedDate.value = '';
      clearDateBtn.style.display = 'none';
      datePickerBtn.textContent = '📅';
    }
    
    currentPage = 1;
    loadJobs();
  });
  
  appliedByFilter.addEventListener('change', filterJobs);
  
  // Date picker button click - open the hidden date input
  datePickerBtn.addEventListener('click', () => {
    appliedDate.showPicker();
  });
  
  // When date is selected, show clear button and filter
  appliedDate.addEventListener('change', () => {
    if (appliedDate.value) {
      clearDateBtn.style.display = 'inline-block';
      datePickerBtn.textContent = '📅✓';
    } else {
      clearDateBtn.style.display = 'none';
      datePickerBtn.textContent = '📅';
    }
    filterJobs();
  });
  
  // Clear date button
  clearDateBtn.addEventListener('click', () => {
    appliedDate.value = '';
    clearDateBtn.style.display = 'none';
    datePickerBtn.textContent = '📅';
    filterJobs();
  });
  
  selectAllBtn.addEventListener('click', toggleSelectAll);
  copySelectedBtn.addEventListener('click', copySelected);
  deleteSelectedBtn.addEventListener('click', deleteSelected);
  markAppliedBtn.addEventListener('click', markSelectedAsApplied);
  markNotAppliedBtn.addEventListener('click', markSelectedAsNotApplied);
  
  // Pagination
  prevPageBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      displayJobs(allJobs);
    }
  });
  nextPageBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      displayJobs(allJobs);
    }
  });
  pageSize.addEventListener('change', () => {
    itemsPerPage = pageSize.value === 'all' ? 999999 : parseInt(pageSize.value);
    currentPage = 1;
    displayJobs(allJobs);
  });

  // Cookies
  saveCookiesBtn.addEventListener('click', saveCookies);
  loadCookiesBtn.addEventListener('click', loadCookies);
  testCookiesBtn.addEventListener('click', testCookies);
  
  // Auto-load cookies when platform changes
  cookiePlatform.addEventListener('change', loadCookies);

  // Settings
  if (addKeywordBtn) addKeywordBtn.addEventListener('click', addKeyword);
  if (addDomainBtn) addDomainBtn.addEventListener('click', addDomain);
  if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', saveSettings);
  if (newKeyword) {
    newKeyword.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addKeyword();
    });
  }
  if (newDomain) {
    newDomain.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addDomain();
    });
  }
  
  // Load settings on startup
  loadSettings();

  // ChatGPT
  refreshChatGPT.addEventListener('click', () => {
    chatgptView.reload();
    showNotification('ChatGPT refreshed', 'success');
  });

  // Listen for refresh requests from main process
  ipcRenderer.on('refresh-chatgpt-view', () => {
    console.log('🔄 Refreshing ChatGPT as requested by scraper');
    chatgptView.reload();
  });
  
  // Handle auto-refresh from scraper when ChatGPT fails
  ipcRenderer.on('refresh-chatgpt', () => {
    console.log('🔄 ChatGPT failed - Auto-refreshing...');
    chatgptView.reload();
    showNotification('🔄 ChatGPT refreshed automatically', 'info');
  });
  
  // Handle ChatGPT verification needed
  ipcRenderer.on('chatgpt-verification-needed', () => {
    console.log('🚫 ChatGPT requires human verification!');
    showNotification('⚠️ ChatGPT needs verification! Please complete it and click "Start Scraping" again.', 'error');
    // Auto-stop scraping
    ipcRenderer.send('stop-scraping');
  });

  // Listen for ChatGPT webview load
  chatgptView.addEventListener('did-finish-load', () => {
    console.log('ChatGPT loaded - cookies should be active from session');
  });

  // Listen for scraping status updates
  ipcRenderer.on('scraping-status-update', (event, data) => {
    if (totalJobsFound) {
      totalJobsFound.textContent = `${data.jobsFound || 0} jobs found`;
    }
    if (statusPlatform && data.platform) {
      statusPlatform.textContent = data.platform;
    }
    if (statusStep && data.step) {
      statusStep.textContent = data.step;
    }
    if (statusProgress && data.progress) {
      statusProgress.textContent = data.progress;
    }
  });

  // Register scraping webview
  ipcRenderer.invoke('register-scraping-webview');
  
  // Log scraping webview status
  if (scrapingView) {
    console.log('✅ Scraping webview initialized and ready');
    console.log('   Partition:', scrapingView.partition);
  } else {
    console.error('❌ Scraping webview not found!');
  }

  // Handle loading URLs in scraping view
  ipcRenderer.on('load-url-in-scraping-view', (event, url) => {
    if (scrapingView) {
      console.log('📍 Loading in scraping view:', url);
      console.log('   Webview ready:', scrapingView ? 'YES' : 'NO');
      console.log('   Partition:', scrapingView.partition);
      
      try {
        scrapingView.loadURL(url);
        console.log('✅ loadURL() called successfully');
        
        // Set zoom to 75% for better overview
        setTimeout(() => {
          scrapingView.setZoomFactor(0.75);
          console.log('🔍 Zoom set to 75%');
        }, 100);
      } catch (err) {
        console.error('❌ Error with loadURL():', err);
        console.log('   Trying src attribute instead...');
        scrapingView.src = url;
        
        // Set zoom to 75%
        setTimeout(() => {
          scrapingView.setZoomFactor(0.75);
        }, 100);
      }
    } else {
      console.error('❌ Scraping view element not found!');
    }
  });
  
  // Log when scraping view loads a page
  if (scrapingView) {
    scrapingView.addEventListener('did-start-loading', () => {
      console.log('🔄 Scraping view: Started loading...');
    });
    
    scrapingView.addEventListener('did-finish-load', () => {
      console.log('✅ Scraping view: Page loaded');
    });
    
    scrapingView.addEventListener('did-fail-load', (event) => {
      console.error('❌ Scraping view: Failed to load', event);
    });
    
    // CRITICAL: Capture new window/tab creation!
    console.log('🔧 Setting up new-window event listener...');
    
    scrapingView.addEventListener('new-window', (event) => {
      console.log('═══════════════════════════════════════');
      console.log('🆕 NEW WINDOW EVENT FIRED!!!');
      console.log('═══════════════════════════════════════');
      console.log('   URL:', event.url);
      console.log('   Disposition:', event.disposition);
      console.log('   Options:', event.options);
      
      // Prevent new window from opening
      event.preventDefault();
      
      // Navigate current webview to the new URL
      console.log('✅ Preventing new tab, loading in scraping view instead...');
      scrapingView.loadURL(event.url);
      console.log('✅ Redirected to:', event.url);
      
      // Notify main process
      ipcRenderer.send('new-window-redirected', event.url);
    });
    
    // Also try will-navigate event as backup
    scrapingView.addEventListener('will-navigate', (event) => {
      console.log('🔀 will-navigate event:', event.url);
    });
    
    console.log('✅ Event listeners attached to scraping webview');
  }

  // Handle executing scripts in scraping view
  ipcRenderer.on('execute-script-in-scraping-view', async (event, { script, requestId }) => {
    try {
      const result = await scrapingView.executeJavaScript(script);
      ipcRenderer.send(`scraping-script-result-${requestId}`, result);
    } catch (error) {
      ipcRenderer.send(`scraping-script-result-${requestId}`, null);
    }
  });
}

// Setup Tabs
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn-vertical');
  const tabPanes = document.querySelectorAll('.tab-pane');

  console.log(`🔧 Setting up ${tabBtns.length} tab buttons`);
  tabBtns.forEach((btn, index) => {
    console.log(`  Tab ${index}: ${btn.dataset.tab}`);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tabName = btn.dataset.tab;
      console.log(`🔵 Tab clicked: ${tabName}`);
      
      // Update active tab
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show corresponding pane
      tabPanes.forEach(pane => {
        if (pane.id === `${tabName}-tab`) {
          console.log(`✅ Showing tab pane: ${pane.id}`);
          pane.classList.add('active');
        } else {
          pane.classList.remove('active');
        }
      });
    });
  });
}

// Scraper Control
async function startScraping() {
  try {
    // Set scraping state
    isScraping = true;
    lockSettings();
    
    // Reset progress bar when starting
    resetProgressBar();
    progressStartTime = Date.now();
    
    const result = await ipcRenderer.invoke('start-scraping');
    if (result.success) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      stopBtn.textContent = 'Stop Scraping';
      status.textContent = '● Running';
      status.style.color = '#4CAF50';
      console.log('✅ Stop button enabled:', !stopBtn.disabled);
      showNotification('🚀 Scraper started! Starting with Jobright...', 'success');
      
      // Automatically switch to Scraping tab to show work
      const scrapingTabBtn = document.querySelector('[data-tab="scraping"]');
      if (scrapingTabBtn) {
        scrapingTabBtn.click();
        console.log('✅ Switched to Scraping tab to show live work');
      }
    } else {
      showNotification('❌ Failed to start scraper', 'error');
    }
  } catch (error) {
    showNotification(`❌ Error starting scraper: ${error.message}`, 'error');
    console.error('Start scraping error:', error);
  }
}

async function stopScraping() {
  // Clear scraping state
  isScraping = false;
  unlockSettings();
  
  // Show immediate feedback (status only, no toast yet)
  status.textContent = '● Stopping...';
  status.style.color = '#ff9800';
  stopBtn.disabled = true;
  stopBtn.textContent = 'Stopping...';
  
  const result = await ipcRenderer.invoke('stop-scraping');
  if (result.success) {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    stopBtn.textContent = 'Stop Scraping';
    status.textContent = '● Stopped';
    status.style.color = '#f44336';
    
    // Reset progress bar when stopping
    resetProgressBar();
    
    // Show single success notification
    showNotification('✅ Scraper stopped successfully', 'success');
  } else {
    stopBtn.disabled = false;
    stopBtn.textContent = 'Stop Scraping';
    showNotification('❌ Failed to stop scraper', 'error');
  }
}

async function updateScraperStatus() {
  const result = await ipcRenderer.invoke('get-scraper-status');
  
  if (result.running) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    status.textContent = '● Running';
    status.style.color = '#4CAF50';
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = '● Idle';
    status.style.color = '#888';
  }
  
  todayCount.textContent = `${result.todayCount} jobs today`;
}

// Jobs Management
async function loadJobs() {
  try {
    // Get filter value
    const appliedFilterValue = appliedFilter ? appliedFilter.value : 'not-applied';
    
    // Fetch jobs based on applied status
    let appliedStatus = null;
    if (appliedFilterValue === 'applied') appliedStatus = true;
    else if (appliedFilterValue === 'not-applied') appliedStatus = false;
    
    allJobs = await ipcRenderer.invoke('get-jobs-by-applied-status', appliedStatus);
    displayJobs(allJobs);
    
    const todayJobs = await ipcRenderer.invoke('get-jobs-today');
    todayCount.textContent = `${todayJobs.length} jobs today`;
    
    // Update unapplied job count in Jobs tab
    const unappliedJobs = await ipcRenderer.invoke('get-jobs-by-applied-status', false);
    if (jobsTabCount) {
      jobsTabCount.textContent = `(${unappliedJobs.length})`;
    }
  } catch (error) {
    console.error('Error loading jobs:', error);
    showNotification('Error loading jobs', 'error');
  }
}

function displayJobs(jobs) {
  if (jobs.length === 0) {
    jobsTableBody.innerHTML = '<tr><td colspan="6" class="no-data">No jobs found. Start scraping to find jobs!</td></tr>';
    if (pageInfo) pageInfo.textContent = 'Page 0 of 0';
    if (prevPageBtn) prevPageBtn.disabled = true;
    if (nextPageBtn) nextPageBtn.disabled = true;
    return;
  }

  // Calculate pagination
  totalPages = itemsPerPage === 999999 ? 1 : Math.ceil(jobs.length / itemsPerPage);
  if (currentPage > totalPages) currentPage = totalPages;
  
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, jobs.length);
  const pageJobs = jobs.slice(startIndex, endIndex);

  // Truncate function
  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  jobsTableBody.innerHTML = pageJobs.map((job, pageIndex) => {
    const globalIndex = startIndex + pageIndex;
    
    // Format applied date for tooltip
    const appliedDate = job.applied_date 
      ? new Date(job.applied_date).toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Not applied';
    
    const detailsTooltip = `Company: ${job.company}
Title: ${job.title}
Salary: ${job.salary || 'Not specified'}
Tech Stack: ${job.tech_stack || 'Not specified'}
Location: ${job.location || 'Not specified'}
Platform: ${job.platform}
Applied By: ${job.applied_by || 'None'}
Applied Date: ${appliedDate}
URL: ${job.url}`;

    return `
    <tr data-job-id="${job.id}" class="job-row selectable-row">
      <td class="row-number">${globalIndex + 1}</td>
      <td class="truncate-cell" title="${escapeHtml(detailsTooltip)}">${escapeHtml(truncateText(job.company, 30))}</td>
      <td class="truncate-cell" title="${escapeHtml(detailsTooltip)}">${escapeHtml(truncateText(job.title, 50))}</td>
      <td><span class="job-type-badge">${job.job_type || 'N/A'}</span></td>
      <td><span class="industry-badge">${job.industry || 'N/A'}</span></td>
      <td>
        <input type="checkbox" class="applied-checkbox" data-job-id="${job.id}" ${job.applied ? 'checked' : ''} 
          onchange="toggleAppliedStatus(${job.id}, this.checked)">
      </td>
      <td>
        <span class="applied-by-badge ${job.applied_by?.toLowerCase() || 'none'}" title="Applied: ${appliedDate}">${job.applied_by || 'None'}</span>
      </td>
      <td>
        <div class="action-btns">
          <button class="btn-icon" onclick="openJobUrl('${escapeHtml(job.url).replace(/'/g, "\\'")}')" title="Open URL">↗️</button>
          <button class="btn-icon" onclick="copyJobInfo(${job.id})" title="Copy Info">📋</button>
          <button class="btn-icon" onclick="deleteJob(${job.id})" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `;
  }).join('');
  
  // Update pagination controls
  if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages} (${jobs.length} total)`;
  if (prevPageBtn) prevPageBtn.disabled = currentPage <= 1;
  if (nextPageBtn) nextPageBtn.disabled = currentPage >= totalPages;
  
  updateSelectedCount();
}

function filterJobs() {
  const searchTerm = searchInput.value.toLowerCase();
  const platform = platformFilter.value;
  const jobType = document.getElementById('jobTypeFilter').value;
  const industry = document.getElementById('industryFilter').value;
  const appliedBy = appliedByFilter.value;
  const selectedDate = appliedDate.value;
  
  const filtered = allJobs.filter(job => {
    const matchesSearch = 
      job.company.toLowerCase().includes(searchTerm) ||
      job.title.toLowerCase().includes(searchTerm);
    
    const matchesPlatform = !platform || job.platform === platform;
    
    const matchesJobType = !jobType || job.job_type === jobType;
    
    const matchesIndustry = !industry || job.industry === industry;
    
    const matchesAppliedBy = !appliedBy || job.applied_by === appliedBy;
    
    // Date filter logic - match exact day
    let matchesDate = true;
    if (selectedDate && job.applied_date) {
      // Job date is stored as timestamp (milliseconds since epoch)
      const jobDate = new Date(job.applied_date);
      
      // Get the local date components from the job timestamp
      const jobYear = jobDate.getFullYear();
      const jobMonth = jobDate.getMonth();
      const jobDay = jobDate.getDate();
      
      // Parse the selected date (format: YYYY-MM-DD) as local date
      const [filterYear, filterMonth, filterDay] = selectedDate.split('-').map(Number);
      
      // Compare date components (month is 0-indexed in JS)
      matchesDate = (jobYear === filterYear && 
                     jobMonth === (filterMonth - 1) && 
                     jobDay === filterDay);
    } else if (selectedDate) {
      // If date filter is set but job has no applied_date, exclude it
      matchesDate = false;
    }
    
    return matchesSearch && matchesPlatform && matchesJobType && matchesIndustry && matchesAppliedBy && matchesDate;
  });
  
  currentPage = 1; // Reset to first page when filtering
  displayJobs(filtered);
}

window.openJobUrl = (url) => {
  require('electron').shell.openExternal(url);
};

window.copyJobInfo = async (jobId) => {
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return;
  
  // Copy essential job info with tab-separated format
  const jobInfo = `${job.company}\t${job.title}\t${job.url}\t${job.job_type || 'N/A'}`;
  
  await ipcRenderer.invoke('copy-to-clipboard', jobInfo);
  showNotification('✅ Copied job info to clipboard!', 'success');
};

window.toggleAppliedStatus = async (jobId, applied) => {
  const success = await ipcRenderer.invoke('update-job-applied-status', jobId, applied, 'User');
  if (success) {
    // Reload jobs to update the UI with new applied_by and applied_date
    await loadJobs();
    showNotification(applied ? 'Marked as applied by User' : 'Marked as not applied', 'success');
  }
};

// Remove this - now handled by drag selection system
// window.toggleRowSelection is not needed anymore

function updateSelectedCount() {
  const selected = document.querySelectorAll('.job-row.selected').length;
  const total = document.querySelectorAll('.job-row').length;
  selectedCount.textContent = `${selected} selected`;
  
  // Enable/disable all bulk action buttons
  const hasSelection = selected > 0;
  const allSelected = selected > 0 && selected === total;
  
  copySelectedBtn.disabled = !hasSelection;
  deleteSelectedBtn.disabled = !hasSelection;
  markAppliedBtn.disabled = !hasSelection;
  markNotAppliedBtn.disabled = !hasSelection;
  
  // Update select all button text and style based on state
  if (total === 0) {
    selectAllBtn.textContent = '☑️ Select All';
    selectAllBtn.disabled = true;
    selectAllBtn.classList.remove('btn-danger');
    selectAllBtn.classList.add('btn-info');
  } else if (allSelected) {
    selectAllBtn.textContent = '☐ Deselect All';
    selectAllBtn.disabled = false;
    selectAllBtn.classList.remove('btn-info');
    selectAllBtn.classList.add('btn-danger');
  } else {
    selectAllBtn.textContent = '☑️ Select All';
    selectAllBtn.disabled = false;
    selectAllBtn.classList.remove('btn-danger');
    selectAllBtn.classList.add('btn-info');
  }
}

// Toggle select/deselect all visible jobs on current page
function toggleSelectAll() {
  const rows = document.querySelectorAll('.job-row');
  const selected = document.querySelectorAll('.job-row.selected').length;
  const total = rows.length;
  
  if (selected === total) {
    // All selected -> Deselect all
    rows.forEach(row => row.classList.remove('selected'));
  } else {
    // Not all selected -> Select all
    rows.forEach(row => row.classList.add('selected'));
  }
  
  updateSelectedCount();
}

async function copySelected() {
  const selectedIds = Array.from(document.querySelectorAll('.job-row.selected'))
    .map(row => parseInt(row.dataset.jobId));
  
  if (selectedIds.length === 0) return;
  
  // Get selected jobs data
  const selectedJobs = allJobs.filter(job => selectedIds.includes(job.id));
  
  // Format as tab-separated, one job per line
  const copyText = selectedJobs.map(job => 
    `${job.company}\t${job.title}\t${job.url}\t${job.job_type || 'N/A'}`
  ).join('\n');
  
  await ipcRenderer.invoke('copy-to-clipboard', copyText);
  showNotification(`✅ Copied ${selectedIds.length} job(s) to clipboard!`, 'success');
}

async function deleteSelected() {
  const selectedIds = Array.from(document.querySelectorAll('.job-row.selected'))
    .map(row => parseInt(row.dataset.jobId));
  
  if (selectedIds.length === 0) return;
  
  if (!confirm(`Delete ${selectedIds.length} selected job(s)?`)) return;
  
  // Delete each job
  for (const id of selectedIds) {
    await ipcRenderer.invoke('delete-job', id);
  }
  
  showNotification(`🗑️ Deleted ${selectedIds.length} job(s)`, 'success');
  await loadJobs();
}

async function markSelectedAsApplied() {
  const selectedIds = Array.from(document.querySelectorAll('.job-row.selected'))
    .map(row => parseInt(row.dataset.jobId));
  
  if (selectedIds.length === 0) return;
  
  const success = await ipcRenderer.invoke('update-multiple-jobs-applied-status', selectedIds, true, 'User');
  if (success) {
    showNotification(`${selectedIds.length} job(s) marked as applied by User`, 'success');
    await loadJobs();
  }
}

async function markSelectedAsNotApplied() {
  const selectedIds = Array.from(document.querySelectorAll('.job-row.selected'))
    .map(row => parseInt(row.dataset.jobId));
  
  if (selectedIds.length === 0) return;
  
  const success = await ipcRenderer.invoke('update-multiple-jobs-applied-status', selectedIds, false, 'User');
  if (success) {
    showNotification(`${selectedIds.length} job(s) marked as not applied`, 'success');
    await loadJobs();
  }
}

window.deleteJob = async (jobId) => {
  if (confirm('Are you sure you want to delete this job?')) {
    const success = await ipcRenderer.invoke('delete-job', jobId);
    if (success) {
      showNotification('Job deleted', 'success');
      await loadJobs();
    } else {
      showNotification('Failed to delete job', 'error');
    }
  }
};

// Cookie Management
async function saveCookies() {
  try {
    const platform = cookiePlatform.value;
    const cookies = JSON.parse(cookieData.value);
    
    if (!Array.isArray(cookies)) {
      throw new Error('Cookies must be an array');
    }
    
    await ipcRenderer.invoke('save-cookies', platform, cookies);
    showMessage(cookieStatus, 'Cookies saved successfully!', 'success');
    
    // If it's ChatGPT cookies, reload the webview
    if (platform === 'chatgpt') {
      chatgptView.reload();
    }
  } catch (error) {
    showMessage(cookieStatus, `Error: ${error.message}`, 'error');
  }
}

async function loadCookies() {
  try {
    const platform = cookiePlatform.value;
    console.log(`Loading cookies for platform: ${platform}`);
    
    const cookies = await ipcRenderer.invoke('get-cookies', platform);
    
    if (cookies) {
      cookieData.value = JSON.stringify(cookies, null, 2);
      showMessage(cookieStatus, `✅ Cookies loaded! Found ${cookies.length} cookies for ${platform}`, 'success');
      console.log(`Loaded ${cookies.length} cookies for ${platform}`);
    } else {
      showMessage(cookieStatus, `No cookies found for ${platform}`, 'info');
      cookieData.value = '';
      console.log(`No cookies found for ${platform}`);
    }
  } catch (error) {
    showMessage(cookieStatus, `Error: ${error.message}`, 'error');
    console.error('Error loading cookies:', error);
  }
}

async function testCookies() {
  try {
    const cookies = JSON.parse(cookieData.value);
    
    if (!Array.isArray(cookies)) {
      throw new Error('Cookies must be an array');
    }
    
    // Basic validation
    for (const cookie of cookies) {
      if (!cookie.name || !cookie.value) {
        throw new Error('Each cookie must have "name" and "value" fields');
      }
    }
    
    showMessage(cookieStatus, `Cookies are valid! Found ${cookies.length} cookies.`, 'success');
  } catch (error) {
    showMessage(cookieStatus, `Invalid cookies: ${error.message}`, 'error');
  }
}

// Settings Functions
// Lock/Unlock settings during scraping
function lockSettings() {
  const platformList = document.getElementById('platformList');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const addDomainBtn = document.getElementById('addDomainBtn');
  
  if (platformList) {
    platformList.classList.add('locked');
    platformList.querySelectorAll('.platform-item').forEach(item => {
      item.draggable = false;
      item.style.cursor = 'not-allowed';
    });
  }
  
  if (saveSettingsBtn) saveSettingsBtn.disabled = true;
  if (addKeywordBtn) addKeywordBtn.disabled = true;
  if (addDomainBtn) addDomainBtn.disabled = true;
  
  document.querySelectorAll('.platform-item input[type="checkbox"]').forEach(cb => cb.disabled = true);
}

function unlockSettings() {
  const platformList = document.getElementById('platformList');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const addKeywordBtn = document.getElementById('addKeywordBtn');
  const addDomainBtn = document.getElementById('addDomainBtn');
  
  if (platformList) {
    platformList.classList.remove('locked');
    platformList.querySelectorAll('.platform-item').forEach(item => {
      item.draggable = true;
      item.style.cursor = 'grab';
    });
  }
  
  if (saveSettingsBtn) saveSettingsBtn.disabled = false;
  if (addKeywordBtn) addKeywordBtn.disabled = false;
  if (addDomainBtn) addDomainBtn.disabled = false;
  
  document.querySelectorAll('.platform-item input[type="checkbox"]').forEach(cb => cb.disabled = false);
}

// Render platform list with drag-and-drop
function renderPlatforms() {
  const platformList = document.getElementById('platformList');
  if (!platformList) return;
  
  const platforms = [
    { id: 'Jobright', name: 'Jobright', desc: 'AI-powered' },
    { id: 'Himalayas', name: 'Himalayas', desc: 'remote + startup' },
    { id: 'Jobgether', name: 'Jobgether', desc: 'remote-first' },
    { id: 'BuiltIn', name: 'BuiltIn', desc: 'tech/startup' },
    { id: 'ZipRecruiter', name: 'ZipRecruiter', desc: 'volume + variety' },
    { id: 'RemoteOK', name: 'RemoteOK', desc: 'pure remote tech' },
    { id: 'WeWorkRemotely', name: 'We Work Remotely', desc: 'quality remote' }
  ];
  
  // Sort platforms by current order
  const orderedPlatforms = [...platforms].sort((a, b) => {
    const indexA = currentSettings.enabled_platforms.indexOf(a.id);
    const indexB = currentSettings.enabled_platforms.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  platformList.innerHTML = orderedPlatforms.map((platform, index) => {
    const isChecked = currentSettings.enabled_platforms.includes(platform.id);
    return `
      <div class="platform-item" draggable="true" data-platform="${platform.id}">
        <span class="drag-handle">⋮⋮</span>
        <label class="platform-checkbox">
          <input type="checkbox" id="platform-${platform.id}" value="${platform.id}" ${isChecked ? 'checked' : ''}>
          <span class="platform-name">${platform.name}</span>
          <span class="platform-desc">(${platform.desc})</span>
        </label>
      </div>
    `;
  }).join('');
  
  // Add drag-and-drop event listeners
  setupDragAndDrop();
}

function setupDragAndDrop() {
  const platformList = document.getElementById('platformList');
  if (!platformList) return;
  
  let draggedItem = null;
  
  platformList.querySelectorAll('.platform-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      if (isScraping) {
        e.preventDefault();
        return;
      }
      draggedItem = item;
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      draggedItem = null;
    });
    
    item.addEventListener('dragover', (e) => {
      if (isScraping) return;
      e.preventDefault();
      const afterElement = getDragAfterElement(platformList, e.clientY);
      if (afterElement == null) {
        platformList.appendChild(draggedItem);
      } else {
        platformList.insertBefore(draggedItem, afterElement);
      }
    });
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.platform-item:not(.dragging)')];
  
  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function loadSettings() {
  try {
    const settings = await ipcRenderer.invoke('get-settings');
    if (settings) {
      currentSettings = settings;
      
      // Render platform list with drag-and-drop
      renderPlatforms();
      
      // Update ignore keywords
      currentSettings.ignore_keywords = settings.ignore_keywords || [];
      renderKeywords();
      
      // Update ignore domains
      currentSettings.ignore_domains = settings.ignore_domains || ['indeed.com', 'linkedin.com', 'dice.com'];
      renderDomains();
      
      // Update salary fields
      const minSalaryAnnual = document.getElementById('minSalaryAnnual');
      const minSalaryMonthly = document.getElementById('minSalaryMonthly');
      const minSalaryHourly = document.getElementById('minSalaryHourly');
      
      if (minSalaryAnnual) minSalaryAnnual.value = settings.min_salary_annual || 120000;
      if (minSalaryMonthly) minSalaryMonthly.value = settings.min_salary_monthly || '';
      if (minSalaryHourly) minSalaryHourly.value = settings.min_salary_hourly || '';
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    // Get platform order from DOM
    const platformList = document.getElementById('platformList');
    const platformItems = platformList.querySelectorAll('.platform-item');
    const orderedPlatforms = [];
    
    platformItems.forEach(item => {
      const checkbox = item.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.checked) {
        orderedPlatforms.push(checkbox.value);
      }
    });
    
    if (orderedPlatforms.length === 0) {
      showMessage(settingsStatus, 'Please select at least one platform', 'error');
      return;
    }
    
    currentSettings.enabled_platforms = orderedPlatforms;
    
    // Get salary values
    const minSalaryAnnual = document.getElementById('minSalaryAnnual');
    const minSalaryMonthly = document.getElementById('minSalaryMonthly');
    const minSalaryHourly = document.getElementById('minSalaryHourly');
    
    currentSettings.min_salary_annual = minSalaryAnnual ? minSalaryAnnual.value : 120000;
    currentSettings.min_salary_monthly = minSalaryMonthly ? minSalaryMonthly.value : '';
    currentSettings.min_salary_hourly = minSalaryHourly ? minSalaryHourly.value : '';
    
    await ipcRenderer.invoke('save-settings', currentSettings);
    showMessage(settingsStatus, '✅ Settings saved successfully!', 'success');
    showNotification('Settings saved!', 'success');
  } catch (error) {
    showMessage(settingsStatus, `Error: ${error.message}`, 'error');
  }
}

function addKeyword() {
  const keyword = newKeyword.value.trim();
  if (!keyword) return;
  
  if (!currentSettings.ignore_keywords.includes(keyword)) {
    currentSettings.ignore_keywords.push(keyword);
    renderKeywords();
    newKeyword.value = '';
  }
}

function removeKeyword(keyword) {
  currentSettings.ignore_keywords = currentSettings.ignore_keywords.filter(k => k !== keyword);
  renderKeywords();
}

function renderKeywords() {
  if (!keywordList) return;
  
  if (currentSettings.ignore_keywords.length === 0) {
    keywordList.innerHTML = '<p style="color: #888; font-size: 13px;">No keywords added yet</p>';
    return;
  }
  
  keywordList.innerHTML = currentSettings.ignore_keywords.map(keyword => `
    <div class="keyword-tag">
      <span>${keyword}</span>
      <span class="remove-btn" onclick="window.removeKeyword('${keyword}')">×</span>
    </div>
  `).join('');
}

function addDomain() {
  const domain = newDomain.value.trim().toLowerCase();
  if (!domain) return;
  
  if (!currentSettings.ignore_domains.includes(domain)) {
    currentSettings.ignore_domains.push(domain);
    renderDomains();
    newDomain.value = '';
  }
}

function removeDomain(domain) {
  currentSettings.ignore_domains = currentSettings.ignore_domains.filter(d => d !== domain);
  renderDomains();
}

function renderDomains() {
  if (!domainList) return;
  
  if (currentSettings.ignore_domains.length === 0) {
    domainList.innerHTML = '<p style="color: #888; font-size: 13px;">No domains added yet</p>';
    return;
  }
  
  domainList.innerHTML = currentSettings.ignore_domains.map(domain => `
    <div class="domain-tag">
      <span>${domain}</span>
      <span class="remove-btn" onclick="window.removeDomain('${domain}')">×</span>
    </div>
  `).join('');
}

// Expose functions to window for onclick handlers
window.removeKeyword = removeKeyword;
window.removeDomain = removeDomain;

// Mouse drag selection for table
function setupDragSelection() {
  let isDragging = false;
  let hasMoved = false;
  let startRow = null;
  let mouseDownRow = null;
  let isDeselectMode = false; // Track if we're selecting or deselecting
  
  document.addEventListener('mousedown', (e) => {
    const row = e.target.closest('.selectable-row');
    if (!row) return;
    
    // Don't start drag if clicking on checkbox or buttons
    if (e.target.closest('.applied-checkbox') || e.target.closest('.action-btns')) {
      return;
    }
    
    isDragging = true;
    hasMoved = false;
    startRow = row;
    mouseDownRow = row;
    
    // Determine mode: if starting row is selected, we're in deselect mode
    isDeselectMode = row.classList.contains('selected');
    
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const row = e.target.closest('.selectable-row');
    if (!row) return;
    
    // If mouse moved to different row, it's a drag
    if (row !== mouseDownRow) {
      hasMoved = true;
    }
    
    if (hasMoved) {
      const allRows = Array.from(document.querySelectorAll('.selectable-row'));
      const startIndex = allRows.indexOf(startRow);
      const currentIndex = allRows.indexOf(row);
      
      if (startIndex === -1 || currentIndex === -1) return;
      
      const minIndex = Math.min(startIndex, currentIndex);
      const maxIndex = Math.max(startIndex, currentIndex);
      
      // Apply selection/deselection to range
      allRows.forEach((r, idx) => {
        if (idx >= minIndex && idx <= maxIndex) {
          if (isDeselectMode) {
            r.classList.remove('selected'); // Deselect mode
          } else {
            r.classList.add('selected'); // Select mode
          }
        }
      });
      
      updateSelectedCount();
    }
  });
  
  document.addEventListener('mouseup', (e) => {
    if (isDragging && !hasMoved) {
      // Single click without drag - toggle selection
      const row = e.target.closest('.selectable-row');
      if (row) {
        row.classList.toggle('selected');
        updateSelectedCount();
      }
    }
    
    isDragging = false;
    hasMoved = false;
    startRow = null;
    mouseDownRow = null;
    isDeselectMode = false;
  });
}

// Utility Functions
function showMessage(element, message, type) {
  element.textContent = message;
  element.className = `status-message ${type}`;
  element.style.display = 'block';
  
  setTimeout(() => {
    element.style.display = 'none';
  }, 5000);
}

function showNotification(message, type = 'info') {
  console.log(`[${type}] ${message}`);
  
  // Create toast notification
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };
  
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  toastContainer.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatDateOnly(timestamp) {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

// Listen for updates from main process
ipcRenderer.on('jobs-updated', async () => {
  await loadJobs();
});

ipcRenderer.on('notification', (event, data) => {
  showNotification(data.body, 'info');
});

// Listen for error notifications from scraper
ipcRenderer.on('scraper-error', (event, data) => {
  showNotification(`❌ ${data.platform}: ${data.message}`, 'error');
});

ipcRenderer.on('scraper-warning', (event, data) => {
  showNotification(`⚠️ ${data.platform}: ${data.message}`, 'warning');
});

ipcRenderer.on('scraper-info', (event, data) => {
  showNotification(`ℹ️ ${data.platform}: ${data.message}`, 'info');
});

// ========================================
// Profile Management
// ========================================

// Load profile data on startup
async function loadProfile() {
  try {
    const profile = await ipcRenderer.invoke('get-profile');
    
    // If no profile exists, try to load salary from settings (for migration)
    let minSalaryAnnual = '';
    let minSalaryMonthly = '';
    let minSalaryHourly = '';
    
    if (!profile) {
      // Load from settings if profile doesn't exist
      const settings = await ipcRenderer.invoke('get-settings');
      minSalaryAnnual = settings.min_salary_annual || '';
      minSalaryMonthly = settings.min_salary_monthly || '';
      minSalaryHourly = settings.min_salary_hourly || '';
    } else {
      // Use profile values, but fallback to settings if profile doesn't have them
      const settings = await ipcRenderer.invoke('get-settings');
      minSalaryAnnual = profile.min_salary_annual || settings.min_salary_annual || '';
      minSalaryMonthly = profile.min_salary_monthly || settings.min_salary_monthly || '';
      minSalaryHourly = profile.min_salary_hourly || settings.min_salary_hourly || '';
    }
    
    if (profile) {
      document.getElementById('profileFirstName').value = profile.first_name || '';
      document.getElementById('profileLastName').value = profile.last_name || '';
      document.getElementById('profileEmail').value = profile.email || '';
      document.getElementById('profilePhone').value = profile.phone || '';
      document.getElementById('profileLinkedIn').value = profile.linkedin_url || '';
      document.getElementById('profileGithub').value = profile.github_url || '';
      document.getElementById('profilePortfolio').value = profile.portfolio_url || '';
      document.getElementById('profileAddress').value = profile.address || '';
      document.getElementById('profileCity').value = profile.city || '';
      document.getElementById('profileState').value = profile.state || '';
      document.getElementById('profileZipCode').value = profile.zip_code || '';
      document.getElementById('profileCountry').value = profile.country || '';
      document.getElementById('profileJobTitle').value = profile.job_title || '';
      document.getElementById('profileYearsExperience').value = profile.years_experience || '';
      document.getElementById('profileSkills').value = profile.skills || '';
      document.getElementById('profileSummary').value = profile.summary || '';
      document.getElementById('profileWorkAuthorization').value = profile.work_authorization || '';
      document.getElementById('profileSponsorshipRequired').value = profile.sponsorship_required || 'no';
      document.getElementById('profileDesiredSalary').value = profile.desired_salary || '';
      document.getElementById('profileNoticePeriod').value = profile.notice_period || 'immediate';
      document.getElementById('profileWorkType').value = profile.work_type || 'remote';
      
      // Handle multiple employment types (stored as comma-separated)
      const employmentTypes = profile.employment_type ? profile.employment_type.split(',') : ['full_time'];
      document.getElementById('profileEmploymentFullTime').checked = employmentTypes.includes('full_time');
      document.getElementById('profileEmploymentContract').checked = employmentTypes.includes('contract');
      document.getElementById('profileEmploymentPartTime').checked = employmentTypes.includes('part_time');
      document.getElementById('profileEmploymentFreelance').checked = employmentTypes.includes('freelance');
      
      document.getElementById('profileResumePath').value = profile.resume_path || '';
      document.getElementById('profileCoverLetterPath').value = profile.cover_letter_path || '';
    }
    
    // Set salary fields (from profile or fallback to settings)
    document.getElementById('profileMinSalaryAnnual').value = minSalaryAnnual;
    document.getElementById('profileMinSalaryMonthly').value = minSalaryMonthly;
    document.getElementById('profileMinSalaryHourly').value = minSalaryHourly;
    
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Save profile
async function saveProfile() {
  const profileData = {
    first_name: document.getElementById('profileFirstName').value,
    last_name: document.getElementById('profileLastName').value,
    email: document.getElementById('profileEmail').value,
    phone: document.getElementById('profilePhone').value,
    linkedin_url: document.getElementById('profileLinkedIn').value,
    github_url: document.getElementById('profileGithub').value,
    portfolio_url: document.getElementById('profilePortfolio').value,
    address: document.getElementById('profileAddress').value,
    city: document.getElementById('profileCity').value,
    state: document.getElementById('profileState').value,
    zip_code: document.getElementById('profileZipCode').value,
    country: document.getElementById('profileCountry').value,
    job_title: document.getElementById('profileJobTitle').value,
    years_experience: parseInt(document.getElementById('profileYearsExperience').value) || null,
    skills: document.getElementById('profileSkills').value,
    summary: document.getElementById('profileSummary').value,
    work_authorization: document.getElementById('profileWorkAuthorization').value,
    sponsorship_required: document.getElementById('profileSponsorshipRequired').value,
    desired_salary: parseInt(document.getElementById('profileDesiredSalary').value) || null,
    min_salary_annual: parseInt(document.getElementById('profileMinSalaryAnnual').value) || null,
    min_salary_monthly: parseInt(document.getElementById('profileMinSalaryMonthly').value) || null,
    min_salary_hourly: parseInt(document.getElementById('profileMinSalaryHourly').value) || null,
    notice_period: document.getElementById('profileNoticePeriod').value,
    work_type: document.getElementById('profileWorkType').value,
    employment_type: getSelectedEmploymentTypes(),
    resume_path: document.getElementById('profileResumePath').value,
    cover_letter_path: document.getElementById('profileCoverLetterPath').value
  };

  // Helper function to get selected employment types
  function getSelectedEmploymentTypes() {
    const types = [];
    if (document.getElementById('profileEmploymentFullTime').checked) types.push('full_time');
    if (document.getElementById('profileEmploymentContract').checked) types.push('contract');
    if (document.getElementById('profileEmploymentPartTime').checked) types.push('part_time');
    if (document.getElementById('profileEmploymentFreelance').checked) types.push('freelance');
    return types.length > 0 ? types.join(',') : 'full_time'; // Default to full_time if none selected
  }

  try {
    const result = await ipcRenderer.invoke('save-profile', profileData);
    if (result.success) {
      // Also sync salary settings for scraper
      const salarySettings = {
        min_salary_annual: profileData.min_salary_annual,
        min_salary_monthly: profileData.min_salary_monthly,
        min_salary_hourly: profileData.min_salary_hourly
      };
      await ipcRenderer.invoke('save-settings', salarySettings);
      
      showProfileMessage('✅ Profile saved successfully!', 'success');
    } else {
      showProfileMessage('❌ Error saving profile: ' + result.error, 'error');
    }
  } catch (error) {
    showProfileMessage('❌ Error saving profile: ' + error.message, 'error');
  }
}

// Clear profile
async function clearProfile() {
  if (!confirm('Are you sure you want to clear all profile data? This action cannot be undone.')) {
    return;
  }

  try {
    const result = await ipcRenderer.invoke('clear-profile');
    if (result.success) {
      // Clear all form fields
      document.getElementById('profileFirstName').value = '';
      document.getElementById('profileLastName').value = '';
      document.getElementById('profileEmail').value = '';
      document.getElementById('profilePhone').value = '';
      document.getElementById('profileLinkedIn').value = '';
      document.getElementById('profileGithub').value = '';
      document.getElementById('profilePortfolio').value = '';
      document.getElementById('profileAddress').value = '';
      document.getElementById('profileCity').value = '';
      document.getElementById('profileState').value = '';
      document.getElementById('profileZipCode').value = '';
      document.getElementById('profileCountry').value = 'United States';
      document.getElementById('profileJobTitle').value = '';
      document.getElementById('profileYearsExperience').value = '';
      document.getElementById('profileSkills').value = '';
      document.getElementById('profileSummary').value = '';
      document.getElementById('profileWorkAuthorization').value = '';
      document.getElementById('profileSponsorshipRequired').value = 'no';
      document.getElementById('profileDesiredSalary').value = '';
      document.getElementById('profileMinSalaryAnnual').value = '';
      document.getElementById('profileMinSalaryMonthly').value = '';
      document.getElementById('profileMinSalaryHourly').value = '';
      document.getElementById('profileNoticePeriod').value = 'immediate';
      document.getElementById('profileWorkType').value = 'remote';
      
      // Uncheck all employment types
      document.getElementById('profileEmploymentFullTime').checked = true; // Default to full_time
      document.getElementById('profileEmploymentContract').checked = false;
      document.getElementById('profileEmploymentPartTime').checked = false;
      document.getElementById('profileEmploymentFreelance').checked = false;
      
      document.getElementById('profileResumePath').value = '';
      document.getElementById('profileCoverLetterPath').value = '';
      
      showProfileMessage('✅ Profile cleared successfully!', 'success');
    } else {
      showProfileMessage('❌ Error clearing profile: ' + result.error, 'error');
    }
  } catch (error) {
    showProfileMessage('❌ Error clearing profile: ' + error.message, 'error');
  }
}

// Browse for resume file
async function browseResume() {
  try {
    const result = await ipcRenderer.invoke('open-file-dialog', {
      filters: [
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.success && result.filePath) {
      document.getElementById('profileResumePath').value = result.filePath;
    }
  } catch (error) {
    console.error('Error browsing for resume:', error);
  }
}

// Browse for cover letter file
async function browseCoverLetter() {
  try {
    const result = await ipcRenderer.invoke('open-file-dialog', {
      filters: [
        { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.success && result.filePath) {
      document.getElementById('profileCoverLetterPath').value = result.filePath;
    }
  } catch (error) {
    console.error('Error browsing for cover letter:', error);
  }
}

// Show profile status message
function showProfileMessage(message, type) {
  const statusDiv = document.getElementById('profileStatus');
  statusDiv.textContent = message;
  statusDiv.className = 'status-message ' + (type === 'success' ? 'success' : 'error');
  statusDiv.style.display = 'block';
  
  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 5000);
}

// ========================================
// WIZARD NAVIGATION
// ========================================

let currentWizardPage = 1;
const totalWizardPages = 6;

function goToWizardPage(pageNum) {
  if (pageNum < 1 || pageNum > totalWizardPages) return;
  
  currentWizardPage = pageNum;
  
  // Update page visibility
  document.querySelectorAll('.wizard-page').forEach((page, index) => {
    page.classList.toggle('active', index + 1 === pageNum);
  });
  
  // Update step indicators
  document.querySelectorAll('.wizard-step').forEach((step, index) => {
    const stepNum = index + 1;
    step.classList.remove('active', 'completed');
    
    if (stepNum === pageNum) {
      step.classList.add('active');
    } else if (stepNum < pageNum) {
      step.classList.add('completed');
    }
  });
  
  // Update navigation buttons
  const prevBtn = document.getElementById('wizardPrevBtn');
  const nextBtn = document.getElementById('wizardNextBtn');
  const wizardActions = document.getElementById('wizardActions');
  
  prevBtn.style.display = pageNum === 1 ? 'none' : 'inline-block';
  
  if (pageNum === totalWizardPages) {
    nextBtn.style.display = 'none';
    wizardActions.style.display = 'flex';
  } else {
    nextBtn.style.display = 'inline-block';
    nextBtn.textContent = 'Next →';
    wizardActions.style.display = 'none';
  }
}

// Wizard navigation event listeners
document.getElementById('wizardPrevBtn').addEventListener('click', () => {
  goToWizardPage(currentWizardPage - 1);
});

document.getElementById('wizardNextBtn').addEventListener('click', () => {
  goToWizardPage(currentWizardPage + 1);
});

// Allow clicking on wizard steps
document.querySelectorAll('.wizard-step').forEach((step, index) => {
  step.addEventListener('click', () => {
    goToWizardPage(index + 1);
  });
});

// Resume parse button enable
document.getElementById('profileResumePath').addEventListener('input', (e) => {
  document.getElementById('parseResumeBtn').disabled = !e.target.value;
});

// Parse resume button
document.getElementById('parseResumeBtn').addEventListener('click', async () => {
  const resumePath = document.getElementById('profileResumePath').value;
  if (!resumePath) return;
  
  const parseBtn = document.getElementById('parseResumeBtn');
  const statusEl = document.getElementById('parseResumeStatus');
  
  parseBtn.disabled = true;
  statusEl.textContent = '🔄 Parsing resume with AI... This may take a moment.';
  statusEl.className = 'parse-status parsing';
  
  try {
    const result = await ipcRenderer.invoke('parse-resume', resumePath);
    
    if (result.success && result.data) {
      fillFormWithParsedData(result.data);
      statusEl.textContent = '✅ Resume parsed! Profile fields have been filled. Review and click Next.';
      statusEl.className = 'parse-status success';
      
      // Auto-advance to next page after 2 seconds
      setTimeout(() => {
        goToWizardPage(2);
      }, 2000);
    } else {
      statusEl.textContent = '⚠️ Resume parsing is not fully implemented yet. Please fill the form manually.';
      statusEl.className = 'parse-status error';
      parseBtn.disabled = false;
    }
  } catch (error) {
    statusEl.textContent = '❌ Error parsing resume: ' + error.message;
    statusEl.className = 'parse-status error';
    parseBtn.disabled = false;
  }
});

function fillFormWithParsedData(data) {
  // Personal Information
  if (data.first_name) document.getElementById('profileFirstName').value = data.first_name;
  if (data.last_name) document.getElementById('profileLastName').value = data.last_name;
  if (data.email) document.getElementById('profileEmail').value = data.email;
  if (data.phone) document.getElementById('profilePhone').value = data.phone;
  if (data.linkedin_url) document.getElementById('profileLinkedIn').value = data.linkedin_url;
  if (data.github_url) document.getElementById('profileGithub').value = data.github_url;
  if (data.portfolio_url) document.getElementById('profilePortfolio').value = data.portfolio_url;
  
  // Location
  if (data.address) document.getElementById('profileAddress').value = data.address;
  if (data.city) document.getElementById('profileCity').value = data.city;
  if (data.state) document.getElementById('profileState').value = data.state;
  if (data.zip_code) document.getElementById('profileZipCode').value = data.zip_code;
  if (data.country) document.getElementById('profileCountry').value = data.country;
  
  // Professional
  if (data.job_title) document.getElementById('profileJobTitle').value = data.job_title;
  if (data.years_experience) document.getElementById('profileYearsExperience').value = data.years_experience;
  if (data.skills) document.getElementById('profileSkills').value = data.skills;
  if (data.summary) document.getElementById('profileSummary').value = data.summary;
  
  // Work Experience
  if (data.work_experience && Array.isArray(data.work_experience)) {
    data.work_experience.forEach(exp => {
      addWorkExperienceCard(exp);
    });
  }
  
  // Education
  if (data.education && Array.isArray(data.education)) {
    data.education.forEach(edu => {
      addEducationCard(edu);
    });
  }
}

// ========================================
// WORK EXPERIENCE MANAGEMENT
// ========================================

let workExperiences = [];

async function loadWorkExperience() {
  try {
    const result = await ipcRenderer.invoke('get-all-work-experience');
    if (result.success) {
      workExperiences = result.data || [];
      renderWorkExperience();
    }
  } catch (error) {
    console.error('Error loading work experience:', error);
  }
}

function renderWorkExperience() {
  const container = document.getElementById('workExperienceList');
  container.innerHTML = '';
  
  if (workExperiences.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center;">No work experience added yet.</p>';
    return;
  }
  
  workExperiences.forEach((exp, index) => {
    const card = createWorkExperienceCard(exp, index);
    container.appendChild(card);
  });
}

function createWorkExperienceCard(exp, index) {
  const card = document.createElement('div');
  card.className = 'experience-card';
  
  const dates = exp.is_current ? 
    `${exp.start_date || ''} - Present` : 
    `${exp.start_date || ''} - ${exp.end_date || ''}`;
  
  card.innerHTML = `
    <div class="experience-card-header">
      <div class="experience-card-title">
        <h4>${exp.job_title}</h4>
        <p>${exp.company}${exp.location ? ' • ' + exp.location : ''}</p>
      </div>
      <div class="experience-card-actions">
        <button class="btn-icon" onclick="editWorkExperience(${index})">✏️</button>
        <button class="btn-icon danger" onclick="deleteWorkExperience(${exp.id})">🗑️</button>
      </div>
    </div>
    <div class="experience-card-body">
      <div class="experience-dates">${dates}</div>
      ${exp.description ? `<div class="experience-description">${exp.description}</div>` : ''}
    </div>
  `;
  
  return card;
}

async function addWorkExperienceCard(data = null) {
  const expData = data || await promptWorkExperienceDialog();
  if (!expData) return;
  
  try {
    const result = await ipcRenderer.invoke('save-work-experience', expData);
    if (result.success) {
      await loadWorkExperience();
    }
  } catch (error) {
    console.error('Error saving work experience:', error);
  }
}

async function editWorkExperience(index) {
  const exp = workExperiences[index];
  const updated = await promptWorkExperienceDialog(exp);
  
  if (updated) {
    try {
      const result = await ipcRenderer.invoke('update-work-experience', exp.id, updated);
      if (result.success) {
        await loadWorkExperience();
      }
    } catch (error) {
      console.error('Error updating work experience:', error);
    }
  }
}

async function deleteWorkExperience(id) {
  if (!confirm('Are you sure you want to delete this work experience?')) return;
  
  try {
    const result = await ipcRenderer.invoke('delete-work-experience', id);
    if (result.success) {
      await loadWorkExperience();
    }
  } catch (error) {
    console.error('Error deleting work experience:', error);
  }
}

function promptWorkExperienceDialog(existing = null) {
  const company = prompt('Company Name:', existing?.company || '');
  if (!company) return null;
  
  const job_title = prompt('Job Title:', existing?.job_title || '');
  if (!job_title) return null;
  
  const location = prompt('Location (e.g., San Francisco, CA):', existing?.location || '');
  const start_date = prompt('Start Date (MM/YYYY):', existing?.start_date || '');
  const is_current = confirm('Is this your current position?');
  const end_date = is_current ? null : prompt('End Date (MM/YYYY):', existing?.end_date || '');
  const description = prompt('Brief description of responsibilities:', existing?.description || '');
  
  return {
    company,
    job_title,
    location,
    start_date,
    end_date,
    is_current,
    description,
    order_index: existing?.order_index || 0
  };
}

document.getElementById('addWorkExperienceBtn').addEventListener('click', () => addWorkExperienceCard());

// ========================================
// EDUCATION MANAGEMENT
// ========================================

let education = [];

async function loadEducation() {
  try {
    const result = await ipcRenderer.invoke('get-all-education');
    if (result.success) {
      education = result.data || [];
      renderEducation();
    }
  } catch (error) {
    console.error('Error loading education:', error);
  }
}

function renderEducation() {
  const container = document.getElementById('educationList');
  container.innerHTML = '';
  
  if (education.length === 0) {
    container.innerHTML = '<p style="color: #888; text-align: center;">No education added yet.</p>';
    return;
  }
  
  education.forEach((edu, index) => {
    const card = createEducationCard(edu, index);
    container.appendChild(card);
  });
}

function createEducationCard(edu, index) {
  const card = document.createElement('div');
  card.className = 'experience-card';
  
  const dates = edu.is_current ? 
    `${edu.start_date || ''} - Present` : 
    `${edu.start_date || ''} - ${edu.end_date || ''}`;
  
  card.innerHTML = `
    <div class="experience-card-header">
      <div class="experience-card-title">
        <h4>${edu.degree}${edu.field_of_study ? ' in ' + edu.field_of_study : ''}</h4>
        <p>${edu.school}${edu.location ? ' • ' + edu.location : ''}</p>
      </div>
      <div class="experience-card-actions">
        <button class="btn-icon" onclick="editEducation(${index})">✏️</button>
        <button class="btn-icon danger" onclick="deleteEducation(${edu.id})">🗑️</button>
      </div>
    </div>
    <div class="experience-card-body">
      <div class="experience-dates">${dates}${edu.gpa ? ' • GPA: ' + edu.gpa : ''}</div>
      ${edu.description ? `<div class="experience-description">${edu.description}</div>` : ''}
    </div>
  `;
  
  return card;
}

async function addEducationCard(data = null) {
  const eduData = data || await promptEducationDialog();
  if (!eduData) return;
  
  try {
    const result = await ipcRenderer.invoke('save-education', eduData);
    if (result.success) {
      await loadEducation();
    }
  } catch (error) {
    console.error('Error saving education:', error);
  }
}

async function editEducation(index) {
  const edu = education[index];
  const updated = await promptEducationDialog(edu);
  
  if (updated) {
    try {
      const result = await ipcRenderer.invoke('update-education', edu.id, updated);
      if (result.success) {
        await loadEducation();
      }
    } catch (error) {
      console.error('Error updating education:', error);
    }
  }
}

async function deleteEducation(id) {
  if (!confirm('Are you sure you want to delete this education entry?')) return;
  
  try {
    const result = await ipcRenderer.invoke('delete-education', id);
    if (result.success) {
      await loadEducation();
    }
  } catch (error) {
    console.error('Error deleting education:', error);
  }
}

function promptEducationDialog(existing = null) {
  const school = prompt('School Name:', existing?.school || '');
  if (!school) return null;
  
  const degree = prompt('Degree (e.g., Bachelor of Science):', existing?.degree || '');
  if (!degree) return null;
  
  const field_of_study = prompt('Field of Study (e.g., Computer Science):', existing?.field_of_study || '');
  const location = prompt('Location:', existing?.location || '');
  const start_date = prompt('Start Date (MM/YYYY):', existing?.start_date || '');
  const is_current = confirm('Are you currently studying here?');
  const end_date = is_current ? null : prompt('End Date (MM/YYYY):', existing?.end_date || '');
  const gpa = prompt('GPA (optional):', existing?.gpa || '');
  const description = prompt('Additional details (optional):', existing?.description || '');
  
  return {
    school,
    degree,
    field_of_study,
    location,
    start_date,
    end_date,
    is_current,
    gpa,
    description,
    order_index: existing?.order_index || 0
  };
}

document.getElementById('addEducationBtn').addEventListener('click', () => addEducationCard());

// Load work experience and education on startup
loadWorkExperience();
loadEducation();

// Make functions global for inline onclick handlers
window.editWorkExperience = editWorkExperience;
window.deleteWorkExperience = deleteWorkExperience;
window.editEducation = editEducation;
window.deleteEducation = deleteEducation;

// Setup profile event listeners
document.getElementById('saveProfileBtn').addEventListener('click', saveProfile);
document.getElementById('clearProfileBtn').addEventListener('click', clearProfile);
document.getElementById('browseResumeBtn').addEventListener('click', browseResume);
document.getElementById('browseCoverLetterBtn').addEventListener('click', browseCoverLetter);

// Load profile on startup
loadProfile();

// ========================================
// BUG REPORTS TAB
// ========================================

let allBugs = [];

async function loadBugs() {
  try {
    const filter = {
      platform: document.getElementById('bugPlatformFilter').value || undefined,
      status: document.getElementById('bugStatusFilter').value || undefined,
      error_type: document.getElementById('bugTypeFilter').value || undefined
    };
    
    const result = await ipcRenderer.invoke('get-all-bugs', filter);
    if (result.success) {
      allBugs = result.data;
      displayBugs();
      updateBugCount();
      await loadBugStats();
    }
  } catch (error) {
    console.error('Error loading bugs:', error);
  }
}

function displayBugs() {
  const tbody = document.getElementById('bugsTableBody');
  
  if (allBugs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 40px; color: #888;">
          No bugs found. Try adjusting your filters or wait for scraping to detect issues.
        </td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = allBugs.map(bug => {
    const firstSeen = new Date(bug.first_seen * 1000).toLocaleString();
    const lastSeen = new Date(bug.last_seen * 1000).toLocaleString();
    const jobInfo = bug.job_company || bug.job_title ? 
      `<strong>${bug.job_company || 'N/A'}</strong><br/>${bug.job_title || ''}` : 'N/A';
    
    return `
      <tr class="bug-row" onclick="showBugDetails(${bug.id})" style="cursor: pointer;" title="Click to see full details">
        <td>${bug.id}</td>
        <td><span class="bug-platform">${bug.platform}</span></td>
        <td><span class="bug-error-type">${bug.error_type}</span></td>
        <td class="bug-error-message" title="${escapeHtml(bug.error_message)}">${escapeHtml(bug.error_message)}</td>
        <td class="bug-job-info">${jobInfo}</td>
        <td><span class="bug-count">${bug.occurrence_count}</span></td>
        <td class="bug-date">${firstSeen}</td>
        <td class="bug-date">${lastSeen}</td>
        <td><span class="bug-status-badge ${bug.status}">${bug.status}</span></td>
        <td class="bug-actions" onclick="event.stopPropagation();">
          ${bug.status !== 'resolved' ? `<button class="btn-resolve" onclick="updateBugStatus(${bug.id}, 'resolved')">✓ Resolve</button>` : ''}
          ${bug.status !== 'ignored' ? `<button class="btn-ignore" onclick="updateBugStatus(${bug.id}, 'ignored')">⊘ Ignore</button>` : ''}
          <button class="btn-delete" onclick="deleteBug(${bug.id})">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

async function loadBugStats() {
  try {
    const result = await ipcRenderer.invoke('get-bug-stats');
    if (result.success) {
      const stats = result.data;
      
      // Calculate totals
      const totalOpen = stats.filter(s => s.status === 'open').reduce((sum, s) => sum + s.count, 0);
      const totalResolved = stats.filter(s => s.status === 'resolved').reduce((sum, s) => sum + s.count, 0);
      const totalOccurrences = stats.reduce((sum, s) => sum + s.total_occurrences, 0);
      const totalUnique = stats.reduce((sum, s) => sum + s.count, 0);
      
      document.getElementById('bugStats').innerHTML = `
        <div class="bug-stat-card">
          <h4>Open Bugs</h4>
          <div class="stat-value" style="color: #f44336">${totalOpen}</div>
        </div>
        <div class="bug-stat-card">
          <h4>Resolved</h4>
          <div class="stat-value" style="color: #4CAF50">${totalResolved}</div>
        </div>
        <div class="bug-stat-card">
          <h4>Unique Issues</h4>
          <div class="stat-value">${totalUnique}</div>
        </div>
        <div class="bug-stat-card">
          <h4>Total Occurrences</h4>
          <div class="stat-value">${totalOccurrences}</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading bug stats:', error);
  }
}

function updateBugCount() {
  const openBugs = allBugs.filter(b => b.status === 'open').length;
  const countEl = document.getElementById('bugsTabCount');
  if (countEl) {
    countEl.textContent = openBugs;
    countEl.style.display = openBugs > 0 ? 'inline-block' : 'none';
  }
}

window.updateBugStatus = async function(bugId, status) {
  try {
    const result = await ipcRenderer.invoke('update-bug-status', bugId, status, null);
    if (result.success) {
      showNotification(`✅ Bug ${bugId} marked as ${status}`, 'success');
      await loadBugs();
    } else {
      showNotification('❌ Error updating bug status', 'error');
    }
  } catch (error) {
    console.error('Error updating bug status:', error);
    showNotification('❌ Error updating bug status', 'error');
  }
};

window.deleteBug = async function(bugId) {
  if (!confirm('Are you sure you want to delete this bug report?')) return;
  
  try {
    const result = await ipcRenderer.invoke('delete-bug', bugId);
    if (result.success) {
      showNotification('✅ Bug deleted', 'success');
      await loadBugs();
    } else {
      showNotification('❌ Error deleting bug', 'error');
    }
  } catch (error) {
    console.error('Error deleting bug:', error);
    showNotification('❌ Error deleting bug', 'error');
  }
};

async function clearAllBugs() {
  if (!confirm('Are you sure you want to clear ALL bug reports? This cannot be undone!')) return;
  
  try {
    const result = await ipcRenderer.invoke('clear-all-bugs');
    if (result.success) {
      showNotification('✅ All bugs cleared', 'success');
      await loadBugs();
    } else {
      showNotification('❌ Error clearing bugs', 'error');
    }
  } catch (error) {
    console.error('Error clearing bugs:', error);
    showNotification('❌ Error clearing bugs', 'error');
  }
}

// Bug report event listeners
document.getElementById('refreshBugsBtn').addEventListener('click', loadBugs);
document.getElementById('clearAllBugsBtn').addEventListener('click', clearAllBugs);
document.getElementById('bugPlatformFilter').addEventListener('change', loadBugs);
document.getElementById('bugStatusFilter').addEventListener('change', loadBugs);
document.getElementById('bugTypeFilter').addEventListener('change', loadBugs);

// Load bugs when switching to bug tab
document.querySelector('[data-tab="bugs"]').addEventListener('click', () => {
  loadBugs();
});

// Show bug details modal
let currentBugId = null;

window.showBugDetails = function(bugId) {
  const bug = allBugs.find(b => b.id === bugId);
  if (!bug) return;
  
  currentBugId = bugId;
  
  // Populate modal
  document.getElementById('bugDetailPlatform').textContent = bug.platform;
  document.getElementById('bugDetailType').textContent = bug.error_type;
  document.getElementById('bugDetailStatus').textContent = bug.status;
  document.getElementById('bugDetailStatus').className = `bug-status-badge ${bug.status}`;
  document.getElementById('bugDetailMessage').textContent = bug.error_message;
  document.getElementById('bugDetailStack').textContent = bug.error_stack || 'No stack trace available';
  document.getElementById('bugDetailUrl').textContent = bug.url || 'N/A';
  document.getElementById('bugDetailUrl').href = bug.url || '#';
  document.getElementById('bugDetailCompany').textContent = bug.job_company || 'N/A';
  document.getElementById('bugDetailTitle').textContent = bug.job_title || 'N/A';
  document.getElementById('bugDetailCount').textContent = bug.occurrence_count;
  document.getElementById('bugDetailFirstSeen').textContent = new Date(bug.first_seen * 1000).toLocaleString();
  document.getElementById('bugDetailLastSeen').textContent = new Date(bug.last_seen * 1000).toLocaleString();
  document.getElementById('bugDetailNotes').value = bug.notes || '';
  
  // Show modal
  document.getElementById('bugDetailsModal').style.display = 'flex';
};

window.closeBugDetailsModal = function() {
  document.getElementById('bugDetailsModal').style.display = 'none';
  currentBugId = null;
};

// Save bug notes
document.getElementById('saveBugNotesBtn').addEventListener('click', async () => {
  if (!currentBugId) return;
  
  const notes = document.getElementById('bugDetailNotes').value;
  const bug = allBugs.find(b => b.id === currentBugId);
  
  try {
    const result = await ipcRenderer.invoke('update-bug-status', currentBugId, bug.status, notes);
    if (result.success) {
      showNotification('✅ Notes saved', 'success');
      await loadBugs();
    }
  } catch (error) {
    console.error('Error saving notes:', error);
    showNotification('❌ Error saving notes', 'error');
  }
});

// Copy bug details
document.getElementById('copyBugDetailsBtn').addEventListener('click', async () => {
  if (!currentBugId) return;
  
  const bug = allBugs.find(b => b.id === currentBugId);
  if (!bug) return;
  
  const details = `BUG REPORT #${bug.id}

Platform: ${bug.platform}
Error Type: ${bug.error_type}
Status: ${bug.status}

Error Message:
${bug.error_message}

Stack Trace:
${bug.error_stack || 'N/A'}

Context:
- URL: ${bug.url || 'N/A'}
- Company: ${bug.job_company || 'N/A'}
- Job Title: ${bug.job_title || 'N/A'}

Occurrence Stats:
- Count: ${bug.occurrence_count}
- First Seen: ${new Date(bug.first_seen * 1000).toLocaleString()}
- Last Seen: ${new Date(bug.last_seen * 1000).toLocaleString()}

Notes:
${bug.notes || 'No notes'}
`;
  
  await ipcRenderer.invoke('copy-to-clipboard', details);
  showNotification('✅ Bug details copied to clipboard!', 'success');
});

// Close modal when clicking outside
document.getElementById('bugDetailsModal').addEventListener('click', (e) => {
  if (e.target.id === 'bugDetailsModal') {
    closeBugDetailsModal();
  }
});

// Load bugs on startup
loadBugs();

// ========================================
// METRICS TAB
// ========================================

async function loadMetrics() {
  try {
    const jobs = allJobs.length > 0 ? allJobs : (await ipcRenderer.invoke('get-all-jobs')).data || [];
    
    if (jobs.length === 0) {
      showEmptyMetrics();
      return;
    }
    
    // Calculate overall stats
    const totalJobs = jobs.length;
    const appliedJobs = jobs.filter(j => j.applied && j.applied_by === 'User').length;
    const botFiltered = jobs.filter(j => j.applied && j.applied_by === 'Bot').length;
    const pending = jobs.filter(j => !j.applied).length;
    const applyRate = totalJobs > 0 ? ((appliedJobs / totalJobs) * 100).toFixed(1) : '0';
    
    // Calculate average salary
    const salariesWithNumbers = jobs
      .map(j => extractSalaryNumber(j.salary))
      .filter(s => s > 0);
    const avgSalary = salariesWithNumbers.length > 0 
      ? Math.round(salariesWithNumbers.reduce((a, b) => a + b, 0) / salariesWithNumbers.length)
      : null;
    
    // Update overview cards
    document.getElementById('metricTotalJobs').textContent = totalJobs;
    document.getElementById('metricAppliedJobs').textContent = appliedJobs;
    document.getElementById('metricBotFiltered').textContent = botFiltered;
    document.getElementById('metricPending').textContent = pending;
    document.getElementById('metricApplyRate').textContent = applyRate + '%';
    document.getElementById('metricAvgSalary').textContent = avgSalary 
      ? '$' + avgSalary.toLocaleString() : 'N/A';
    
    // Generate all charts
    generatePlatformChart(jobs);
    generateJobTypeChart(jobs);
    generateIndustryChart(jobs);
    generateRemoteChart(jobs);
    generateStartupChart(jobs);
    generateTimelineChart(jobs);
    generateSalaryChart(jobs);
    generateTechStackChart(jobs);
    generateTopCompaniesChart(jobs);
    generateLocationChart(jobs);
    generateFilterChart(jobs);
    generateWeeklyTrendsChart(jobs);
    
  } catch (error) {
    console.error('Error loading metrics:', error);
  }
}

function showEmptyMetrics() {
  document.getElementById('metricTotalJobs').textContent = '0';
  document.getElementById('metricAppliedJobs').textContent = '0';
  document.getElementById('metricBotFiltered').textContent = '0';
  document.getElementById('metricPending').textContent = '0';
  document.getElementById('metricApplyRate').textContent = '0%';
  document.getElementById('metricAvgSalary').textContent = 'N/A';
  
  const emptyMessage = '<div class="chart-empty">No data available. Start scraping to see metrics!</div>';
  document.getElementById('platformChart').innerHTML = emptyMessage;
  document.getElementById('jobTypeChart').innerHTML = emptyMessage;
  document.getElementById('industryChart').innerHTML = emptyMessage;
}

function extractSalaryNumber(salaryStr) {
  if (!salaryStr || salaryStr === 'Not specified') return 0;
  
  // Extract numbers from salary string (e.g., "$120k-$150k" -> 135000)
  const numbers = salaryStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return 0;
  
  // If it's a range, take the average
  if (numbers.length >= 2) {
    const low = parseInt(numbers[0]);
    const high = parseInt(numbers[1]);
    const avg = (low + high) / 2;
    
    // Detect if it's in thousands (k) or actual numbers
    if (salaryStr.toLowerCase().includes('k')) {
      return avg * 1000;
    }
    return avg;
  }
  
  // Single number
  const num = parseInt(numbers[0]);
  if (salaryStr.toLowerCase().includes('k')) {
    return num * 1000;
  }
  return num;
}

function generatePlatformChart(jobs) {
  const platformCounts = {};
  jobs.forEach(job => {
    platformCounts[job.platform] = (platformCounts[job.platform] || 0) + 1;
  });
  
  renderBarChart('platformChart', platformCounts);
}

function generateJobTypeChart(jobs) {
  const jobTypeCounts = {};
  jobs.forEach(job => {
    const type = job.job_type || 'Other';
    jobTypeCounts[type] = (jobTypeCounts[type] || 0) + 1;
  });
  
  renderBarChart('jobTypeChart', jobTypeCounts);
}

function generateIndustryChart(jobs) {
  const industryCounts = {};
  jobs.forEach(job => {
    const industry = job.industry || 'Other';
    industryCounts[industry] = (industryCounts[industry] || 0) + 1;
  });
  
  renderBarChart('industryChart', industryCounts);
}

function generateRemoteChart(jobs) {
  const remoteCounts = {
    'Fully Remote': jobs.filter(j => j.is_remote).length,
    'Hybrid/Onsite': jobs.filter(j => !j.is_remote).length
  };
  
  renderBarChart('remoteChart', remoteCounts);
}

function generateStartupChart(jobs) {
  const startupCounts = {
    'Startup': jobs.filter(j => j.is_startup).length,
    'Established': jobs.filter(j => !j.is_startup).length
  };
  
  renderBarChart('startupChart', startupCounts);
}

function generateTimelineChart(jobs) {
  const dailyCounts = {};
  
  jobs.forEach(job => {
    const date = new Date(job.timestamp || job.created_at * 1000);
    const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
  });
  
  // Get last 14 days
  const sortedDates = Object.keys(dailyCounts).sort((a, b) => {
    return new Date(a) - new Date(b);
  }).slice(-14);
  
  const timelineData = {};
  sortedDates.forEach(date => {
    timelineData[date] = dailyCounts[date];
  });
  
  renderTimelineChart('timelineChart', timelineData);
}

function generateSalaryChart(jobs) {
  const salaryRanges = {
    'Not Specified': 0,
    '$0-$60k': 0,
    '$60k-$90k': 0,
    '$90k-$120k': 0,
    '$120k-$150k': 0,
    '$150k-$200k': 0,
    '$200k+': 0
  };
  
  jobs.forEach(job => {
    const salary = extractSalaryNumber(job.salary);
    
    if (salary === 0) {
      salaryRanges['Not Specified']++;
    } else if (salary < 60000) {
      salaryRanges['$0-$60k']++;
    } else if (salary < 90000) {
      salaryRanges['$60k-$90k']++;
    } else if (salary < 120000) {
      salaryRanges['$90k-$120k']++;
    } else if (salary < 150000) {
      salaryRanges['$120k-$150k']++;
    } else if (salary < 200000) {
      salaryRanges['$150k-$200k']++;
    } else {
      salaryRanges['$200k+']++;
    }
  });
  
  renderBarChart('salaryChart', salaryRanges);
}

function generateTechStackChart(jobs) {
  const techCounts = {};
  
  jobs.forEach(job => {
    if (job.tech_stack) {
      const techs = job.tech_stack.split(',').map(t => t.trim());
      techs.forEach(tech => {
        if (tech) {
          techCounts[tech] = (techCounts[tech] || 0) + 1;
        }
      });
    }
  });
  
  // Get top 10
  const topTechs = Object.entries(techCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, val]) => { obj[key] = val; return obj; }, {});
  
  renderBarChart('techStackChart', topTechs);
}

function generateTopCompaniesChart(jobs) {
  const companyCounts = {};
  
  jobs.forEach(job => {
    companyCounts[job.company] = (companyCounts[job.company] || 0) + 1;
  });
  
  // Get top 10
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, val]) => { obj[key] = val; return obj; }, {});
  
  renderBarChart('topCompaniesChart', topCompanies);
}

function generateLocationChart(jobs) {
  const locationCounts = {};
  
  jobs.forEach(job => {
    const loc = job.location || 'Not specified';
    locationCounts[loc] = (locationCounts[loc] || 0) + 1;
  });
  
  // Get top 10
  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .reduce((obj, [key, val]) => { obj[key] = val; return obj; }, {});
  
  renderBarChart('locationChart', topLocations);
}

function generateFilterChart(jobs) {
  const filterStats = {
    'Remote Jobs': jobs.filter(j => j.is_remote).length,
    'Startup Jobs': jobs.filter(j => j.is_startup).length,
    'With Salary': jobs.filter(j => j.salary && j.salary !== 'Not specified').length,
    'Ignored (Keywords)': jobs.filter(j => j.salary && j.salary.startsWith('Ignored:')).length,
    'Bot Filtered': jobs.filter(j => j.applied_by === 'Bot').length
  };
  
  renderBarChart('filterChart', filterStats);
}

function generateWeeklyTrendsChart(jobs) {
  // Group by week
  const weekCounts = {};
  
  jobs.forEach(job => {
    const date = new Date(job.timestamp || job.created_at * 1000);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week
    const weekKey = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
  });
  
  renderTimelineChart('weeklyTrendsChart', weekCounts);
}

function renderBarChart(elementId, data) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  const entries = Object.entries(data);
  if (entries.length === 0) {
    container.innerHTML = '<div class="chart-empty">No data available</div>';
    return;
  }
  
  const maxValue = Math.max(...entries.map(([_, count]) => count));
  const total = entries.reduce((sum, [_, count]) => sum + count, 0);
  
  const html = `
    <div class="chart-bar-container">
      ${entries.map(([label, count]) => {
        const percentage = ((count / maxValue) * 100);
        const percentOfTotal = ((count / total) * 100).toFixed(1);
        
        return `
          <div class="chart-bar-item">
            <div class="chart-bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
            <div class="chart-bar-visual">
              <div class="chart-bar" style="width: ${percentage}%"></div>
              <div class="chart-bar-value">${count}</div>
              <div class="chart-bar-percentage">(${percentOfTotal}%)</div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  container.innerHTML = html;
}

function renderTimelineChart(elementId, data) {
  const container = document.getElementById(elementId);
  if (!container) return;
  
  const entries = Object.entries(data);
  if (entries.length === 0) {
    container.innerHTML = '<div class="chart-empty">No data available</div>';
    return;
  }
  
  const maxValue = Math.max(...entries.map(([_, count]) => count));
  
  const html = `
    <div class="timeline-chart">
      ${entries.map(([label, count]) => {
        const heightPercent = (count / maxValue) * 100;
        
        return `
          <div class="timeline-bar" style="height: ${heightPercent}%" title="${label}: ${count} jobs">
            <div class="timeline-bar-value">${count}</div>
            <div class="timeline-bar-label">${label}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  
  container.innerHTML = html;
}

async function exportMetrics() {
  try {
    const jobs = allJobs.length > 0 ? allJobs : (await ipcRenderer.invoke('get-all-jobs')).data || [];
    
    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total_jobs: jobs.length,
        applied_jobs: jobs.filter(j => j.applied && j.applied_by === 'User').length,
        bot_filtered: jobs.filter(j => j.applied_by === 'Bot').length,
        pending: jobs.filter(j => !j.applied).length
      },
      by_platform: generateGroupStats(jobs, 'platform'),
      by_job_type: generateGroupStats(jobs, 'job_type'),
      by_industry: generateGroupStats(jobs, 'industry'),
      remote_stats: {
        remote: jobs.filter(j => j.is_remote).length,
        not_remote: jobs.filter(j => !j.is_remote).length
      },
      startup_stats: {
        startup: jobs.filter(j => j.is_startup).length,
        established: jobs.filter(j => !j.is_startup).length
      }
    };
    
    const reportText = JSON.stringify(report, null, 2);
    await ipcRenderer.invoke('copy-to-clipboard', reportText);
    showNotification('✅ Metrics report copied to clipboard!', 'success');
    
  } catch (error) {
    console.error('Error exporting metrics:', error);
    showNotification('❌ Error exporting metrics', 'error');
  }
}

function generateGroupStats(jobs, field) {
  const counts = {};
  jobs.forEach(job => {
    const value = job[field] || 'Unknown';
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

// Event listeners for metrics
document.getElementById('refreshMetricsBtn').addEventListener('click', loadMetrics);
document.getElementById('exportMetricsBtn').addEventListener('click', exportMetrics);

// Load metrics when switching to metrics tab
document.querySelector('[data-tab="metrics"]').addEventListener('click', () => {
  loadMetrics();
});

// Load metrics on startup
setTimeout(() => {
  loadMetrics();
}, 1000);

/* ========================================
   Job Apply Tab Functionality
   ======================================== */

let applyPage = null;
let applyGptWebview = null;
let applyWebviewElement = null;
let applyZoomLevel = 1.0;

// Initialize Job Apply Tab
function initApplyTab() {
  const urlInput = document.getElementById('applyUrlInput');
  const goBtn = document.getElementById('applyGoBtn');
  const backBtn = document.getElementById('applyBackBtn');
  const forwardBtn = document.getElementById('applyForwardBtn');
  const refreshBtn = document.getElementById('applyRefreshBtn');
  
  const zoomInBtn = document.getElementById('applyZoomInBtn');
  const zoomOutBtn = document.getElementById('applyZoomOutBtn');
  const resetZoomBtn = document.getElementById('applyResetZoomBtn');
  
  const loadGptBtn = document.getElementById('loadApplyGptBtn');
  const gptRefreshBtn = document.getElementById('applyGptRefreshBtn');
  const gptClearBtn = document.getElementById('applyGptClearBtn');
  
  const extractJobInfoBtn = document.getElementById('extractJobInfoBtn');
  const sendPageToGptBtn = document.getElementById('sendPageToGptBtn');
  const fillFormBtn = document.getElementById('fillFormBtn');
  
  // URL Navigation
  urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      navigateToUrl(urlInput.value.trim());
    }
  });
  
  goBtn.addEventListener('click', () => {
    navigateToUrl(urlInput.value.trim());
  });
  
  backBtn.addEventListener('click', () => {
    if (applyWebviewElement) {
      applyWebviewElement.goBack();
    }
  });
  
  forwardBtn.addEventListener('click', () => {
    if (applyWebviewElement) {
      applyWebviewElement.goForward();
    }
  });
  
  refreshBtn.addEventListener('click', () => {
    if (applyWebviewElement) {
      applyWebviewElement.reload();
    }
  });
  
  // Zoom Controls
  zoomInBtn.addEventListener('click', () => {
    applyZoomLevel = Math.min(applyZoomLevel + 0.1, 2.0);
    updateZoom();
  });
  
  zoomOutBtn.addEventListener('click', () => {
    applyZoomLevel = Math.max(applyZoomLevel - 0.1, 0.5);
    updateZoom();
  });
  
  resetZoomBtn.addEventListener('click', () => {
    applyZoomLevel = 1.0;
    updateZoom();
  });
  
  // ChatGPT Controls
  loadGptBtn.addEventListener('click', loadApplyGpt);
  gptRefreshBtn.addEventListener('click', refreshApplyGpt);
  gptClearBtn.addEventListener('click', clearApplyGptChat);
  
  // Quick Actions
  extractJobInfoBtn.addEventListener('click', extractJobInfo);
  sendPageToGptBtn.addEventListener('click', sendPageToGpt);
  fillFormBtn.addEventListener('click', autoFillForm);
}

// Navigate to URL
async function navigateToUrl(url) {
  if (!url) {
    setApplyStatus('Please enter a URL', false);
    return;
  }
  
  // Add https:// if no protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  
  try {
    setApplyStatus('Loading...', true);
    
    // Request to create Puppeteer page and connect to webview
    const result = await ipcRenderer.invoke('apply-navigate', url);
    
    if (result.success) {
      // Update URL input
      document.getElementById('applyUrlInput').value = url;
      
      // Create or update webview
      if (!applyWebviewElement) {
        createApplyWebview();
      }
      
      // Update webview src to match Puppeteer page
      applyWebviewElement.src = url;
      
      setApplyStatus(`Loaded: ${url}`, false);
    } else {
      throw new Error(result.error || 'Failed to navigate');
    }
  } catch (err) {
    console.error('Navigation error:', err);
    setApplyStatus('Error loading page', false);
  }
}

// Create webview element
function createApplyWebview() {
  const container = document.getElementById('applyWebviewContainer');
  
  // Remove placeholder
  const placeholder = container.querySelector('.apply-placeholder');
  if (placeholder) {
    placeholder.remove();
  }
  
  // Create webview
  applyWebviewElement = document.createElement('webview');
  applyWebviewElement.id = 'applyWebview';
  applyWebviewElement.style.width = '100%';
  applyWebviewElement.style.height = '100%';
  applyWebviewElement.setAttribute('partition', 'persist:apply');
  applyWebviewElement.setAttribute('nodeintegration', 'false');
  applyWebviewElement.setAttribute('disablewebsecurity', 'false');
  
  // Add event listeners
  applyWebviewElement.addEventListener('did-start-loading', () => {
    setApplyStatus('Loading...', true);
  });
  
  applyWebviewElement.addEventListener('did-stop-loading', () => {
    setApplyStatus('Ready', false);
    updateNavigationButtons();
  });
  
  applyWebviewElement.addEventListener('did-navigate', (e) => {
    document.getElementById('applyUrlInput').value = e.url;
    updateNavigationButtons();
  });
  
  applyWebviewElement.addEventListener('did-navigate-in-page', (e) => {
    document.getElementById('applyUrlInput').value = e.url;
  });
  
  applyWebviewElement.addEventListener('page-title-updated', (e) => {
    setApplyStatus(`${e.title}`, false);
  });
  
  container.appendChild(applyWebviewElement);
}

// Update navigation buttons state
function updateNavigationButtons() {
  if (!applyWebviewElement) return;
  
  const backBtn = document.getElementById('applyBackBtn');
  const forwardBtn = document.getElementById('applyForwardBtn');
  
  backBtn.disabled = !applyWebviewElement.canGoBack();
  forwardBtn.disabled = !applyWebviewElement.canGoForward();
}

// Update zoom level
function updateZoom() {
  if (applyWebviewElement) {
    applyWebviewElement.setZoomFactor(applyZoomLevel);
    document.getElementById('applyZoomLevel').textContent = 
      Math.round(applyZoomLevel * 100) + '%';
  }
}

// Set status
function setApplyStatus(text, loading) {
  document.getElementById('applyStatus').textContent = text;
  const loadingIndicator = document.getElementById('applyLoadingIndicator');
  loadingIndicator.style.display = loading ? 'flex' : 'none';
}

// Load ChatGPT
async function loadApplyGpt() {
  try {
    const container = document.getElementById('applyGptContainer');
    
    // Remove placeholder
    const placeholder = container.querySelector('.apply-gpt-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
    
    // Check if webview already exists
    if (applyGptWebview) {
      setApplyStatus('ChatGPT already loaded', false);
      return;
    }
    
    // Get ChatGPT cookies
    const cookies = await ipcRenderer.invoke('get-gpt-cookies');
    
    if (!cookies || cookies.length === 0) {
      setApplyStatus('No ChatGPT cookies found. Please add them in Cookies tab.', false);
      return;
    }
    
    // Create ChatGPT webview
    applyGptWebview = document.createElement('webview');
    applyGptWebview.id = 'applyGptWebview';
    applyGptWebview.src = 'https://chatgpt.com';
    applyGptWebview.style.width = '100%';
    applyGptWebview.style.height = '100%';
    applyGptWebview.setAttribute('partition', 'persist:chatgpt');
    applyGptWebview.setAttribute('nodeintegration', 'false');
    
    let cookiesApplied = false;
    
    // Wait for webview to be ready
    applyGptWebview.addEventListener('dom-ready', async () => {
      // Only set cookies once to avoid infinite reload loop
      if (!cookiesApplied) {
        cookiesApplied = true;
        try {
          // Set cookies
          for (const cookie of cookies) {
            await applyGptWebview.executeJavaScript(`
              document.cookie = '${cookie.name}=${cookie.value}; domain=${cookie.domain}; path=/; secure; samesite=lax';
            `);
          }
          
          // Reload to apply cookies
          applyGptWebview.reload();
        } catch (err) {
          console.error('Error setting ChatGPT cookies:', err);
          setApplyStatus('Failed to set ChatGPT cookies', false);
        }
      } else {
        // Cookies already applied, just show success
        setApplyStatus('ChatGPT loaded successfully', false);
      }
    });
    
    container.appendChild(applyGptWebview);
  } catch (err) {
    console.error('Error loading ChatGPT:', err);
    setApplyStatus('Failed to load ChatGPT', false);
  }
}

// Refresh ChatGPT
function refreshApplyGpt() {
  if (applyGptWebview) {
    applyGptWebview.reload();
    setApplyStatus('ChatGPT refreshed', false);
  } else {
    setApplyStatus('ChatGPT not loaded yet', false);
  }
}

// Clear ChatGPT chat (start new)
function clearApplyGptChat() {
  if (applyGptWebview) {
    applyGptWebview.loadURL('https://chatgpt.com');
    setApplyStatus('Started new ChatGPT chat', false);
  } else {
    setApplyStatus('ChatGPT not loaded yet', false);
  }
}

// Extract job info using ChatGPT
async function extractJobInfo() {
  if (!applyWebviewElement) {
    setApplyStatus('No page loaded', false);
    return;
  }
  
  if (!applyGptWebview) {
    setApplyStatus('Please load ChatGPT first', false);
    return;
  }
  
  try {
    // Get page content
    const content = await applyWebviewElement.executeJavaScript(`
      document.body.innerText
    `);
    
    if (!content || content.length < 100) {
      setApplyStatus('Page content is too short', false);
      return;
    }
    
    // Prepare prompt
    const prompt = `Extract job information from this page and format as JSON:
    
${content.substring(0, 10000)}

Please extract:
- Company name
- Job title  
- Location
- Job type (Full-time, Part-time, Contract, etc.)
- Remote status (Remote, Hybrid, On-site)
- Salary/compensation
- Required skills/tech stack
- Job description summary

Format as JSON.`;
    
    // Send to ChatGPT
    await applyGptWebview.executeJavaScript(`
      const textarea = document.querySelector('[data-id="root"] textarea');
      if (textarea) {
        textarea.value = ${JSON.stringify(prompt)};
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Find and click send button
        setTimeout(() => {
          const sendBtn = document.querySelector('[data-testid="send-button"]');
          if (sendBtn && !sendBtn.disabled) {
            sendBtn.click();
          }
        }, 500);
      }
    `);
    
    setApplyStatus('Sent job info extraction request to ChatGPT', false);
  } catch (err) {
    console.error('Error extracting job info:', err);
    setApplyStatus('Failed to extract job info', false);
  }
}

// Send current page content to ChatGPT
async function sendPageToGpt() {
  if (!applyWebviewElement) {
    setApplyStatus('No page loaded', false);
    return;
  }
  
  if (!applyGptWebview) {
    setApplyStatus('Please load ChatGPT first', false);
    return;
  }
  
  try {
    // Get page content
    const content = await applyWebviewElement.executeJavaScript(`
      document.body.innerText
    `);
    
    const url = applyWebviewElement.getURL();
    
    // Send to ChatGPT
    await applyGptWebview.executeJavaScript(`
      const textarea = document.querySelector('[data-id="root"] textarea');
      if (textarea) {
        textarea.value = 'Here is content from ${url}:\\n\\n' + ${JSON.stringify(content.substring(0, 8000))};
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
      }
    `);
    
    setApplyStatus('Sent page content to ChatGPT', false);
  } catch (err) {
    console.error('Error sending page to GPT:', err);
    setApplyStatus('Failed to send page content', false);
  }
}

// Auto-fill form with profile data
async function autoFillForm() {
  if (!applyWebviewElement) {
    setApplyStatus('No page loaded', false);
    return;
  }
  
  try {
    // Get profile data
    const profile = await ipcRenderer.invoke('get-profile');
    
    if (!profile) {
      setApplyStatus('No profile data found. Please complete your profile first.', false);
      return;
    }
    
    // Auto-fill common fields
    await applyWebviewElement.executeJavaScript(`
      (function() {
        const profile = ${JSON.stringify(profile)};
        
        // Helper function to fill field
        function fillField(selectors, value) {
          if (!value) return;
          for (const selector of selectors) {
            const field = document.querySelector(selector);
            if (field) {
              field.value = value;
              field.dispatchEvent(new Event('input', { bubbles: true }));
              field.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }
        }
        
        // Fill common fields
        fillField(['input[name="name"]', 'input[id*="name"]', 'input[placeholder*="name" i]'], 
                  profile.full_name);
        fillField(['input[name="email"]', 'input[type="email"]', 'input[id*="email"]'], 
                  profile.email);
        fillField(['input[name="phone"]', 'input[type="tel"]', 'input[id*="phone"]'], 
                  profile.phone);
        fillField(['input[name="linkedin"]', 'input[id*="linkedin"]'], 
                  profile.linkedin_url);
        fillField(['input[name="github"]', 'input[id*="github"]'], 
                  profile.github_url);
        fillField(['input[name="portfolio"]', 'input[id*="portfolio"]', 'input[id*="website"]'], 
                  profile.portfolio_url);
        fillField(['input[name="location"]', 'input[id*="location"]', 'input[id*="city"]'], 
                  profile.location);
        
        return 'Auto-fill attempted';
      })();
    `);
    
    setApplyStatus('Auto-filled form fields', false);
  } catch (err) {
    console.error('Error auto-filling form:', err);
    setApplyStatus('Failed to auto-fill form', false);
  }
}

// Initialize when apply tab is opened
document.querySelector('[data-tab="apply"]').addEventListener('click', async (e) => {
  // Check if profile is completed first
  const profile = await ipcRenderer.invoke('get-profile');
  
  if (!profile || !profile.full_name || !profile.email) {
    // Profile is incomplete - redirect to profile tab
    e.preventDefault();
    e.stopPropagation();
    
    showNotification('⚠️ Please complete your profile first before using Job Apply', 'warning');
    
    // Switch to profile tab
    const profileTab = document.querySelector('[data-tab="profile"]');
    if (profileTab) {
      profileTab.click();
    }
    
    return;
  }
  
  // Profile is complete - initialize on first click
  if (!document.getElementById('applyTabInitialized')) {
    initApplyTab();
    document.getElementById('apply-tab').setAttribute('data-initialized', 'true');
  }
});

