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
  
  // Show immediate feedback
  status.textContent = '● Stopping...';
  status.style.color = '#ff9800';
  stopBtn.disabled = true;
  stopBtn.textContent = 'Stopping...';
  showNotification('🛑 Stopping scraper... (may take a few seconds)', 'info');
  
  const result = await ipcRenderer.invoke('stop-scraping');
  if (result.success) {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    stopBtn.textContent = 'Stop Scraping';
    status.textContent = '● Stopped';
    status.style.color = '#f44336';
    
    // Reset progress bar when stopping
    resetProgressBar();
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
  const appliedBy = appliedByFilter.value;
  const selectedDate = appliedDate.value;
  
  const filtered = allJobs.filter(job => {
    const matchesSearch = 
      job.company.toLowerCase().includes(searchTerm) ||
      job.title.toLowerCase().includes(searchTerm);
    
    const matchesPlatform = !platform || job.platform === platform;
    
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
    
    return matchesSearch && matchesPlatform && matchesAppliedBy && matchesDate;
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
  
  // Tab-separated format: Company\tTitle\tURL
  const jobInfo = `${job.company}\t${job.title}\t${job.url}`;
  
  await ipcRenderer.invoke('copy-to-clipboard', jobInfo);
  showNotification('✅ Copied to clipboard!', 'success');
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
    `${job.company}\t${job.title}\t${job.url}`
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

