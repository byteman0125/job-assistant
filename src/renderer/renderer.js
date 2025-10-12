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
const jobsTableBody = document.getElementById('jobsTableBody');
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

// Settings state
let currentSettings = {
  enabled_platforms: ['Jobright'],
  ignore_keywords: [],
  ignore_domains: ['indeed.com', 'linkedin.com', 'dice.com']
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
  if (data.running) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    status.textContent = '● Running';
    status.style.color = '#4CAF50';
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
    status.textContent = '● Stopped';
    status.style.color = '#f44336';
  }
  todayCount.textContent = `${data.todayCount} jobs today`;
});

// Listen for console logs and display them in "Current Step"
ipcRenderer.on('console-log', (event, data) => {
  if (!statusStep) return;
  
  // Extract the message and remove "Jobright: " prefix
  const cleanMsg = data.message.replace(/Jobright: /, '').trim();
  
  // Update the Current Step field
  statusStep.textContent = cleanMsg;
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
  appliedFilter.addEventListener('change', () => { currentPage = 1; loadJobs(); });
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
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      // Update active tab
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show corresponding pane
      tabPanes.forEach(pane => {
        if (pane.id === `${tabName}-tab`) {
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
    const result = await ipcRenderer.invoke('start-scraping');
    if (result.success) {
      startBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = '● Running';
      status.style.color = '#4CAF50';
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
    jobsTableBody.innerHTML = '<tr><td colspan="5" class="no-data">No jobs found. Start scraping to find jobs!</td></tr>';
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
    const detailsTooltip = `Company: ${job.company}
Title: ${job.title}
Salary: ${job.salary || 'Not specified'}
Tech Stack: ${job.tech_stack || 'Not specified'}
Location: ${job.location || 'Not specified'}
Platform: ${job.platform}
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
  
  const filtered = allJobs.filter(job => {
    const matchesSearch = 
      job.company.toLowerCase().includes(searchTerm) ||
      job.title.toLowerCase().includes(searchTerm);
    
    const matchesPlatform = !platform || job.platform === platform;
    
    return matchesSearch && matchesPlatform;
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
  const success = await ipcRenderer.invoke('update-job-applied-status', jobId, applied);
  if (success) {
    // Update local state
    const job = allJobs.find(j => j.id === jobId);
    if (job) job.applied = applied;
    showNotification(applied ? 'Marked as applied' : 'Marked as not applied', 'success');
  }
};

// Remove this - now handled by drag selection system
// window.toggleRowSelection is not needed anymore

function updateSelectedCount() {
  const selected = document.querySelectorAll('.job-row.selected').length;
  selectedCount.textContent = `${selected} selected`;
  
  // Enable/disable all bulk action buttons
  const hasSelection = selected > 0;
  copySelectedBtn.disabled = !hasSelection;
  deleteSelectedBtn.disabled = !hasSelection;
  markAppliedBtn.disabled = !hasSelection;
  markNotAppliedBtn.disabled = !hasSelection;
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
  
  const success = await ipcRenderer.invoke('update-multiple-jobs-applied-status', selectedIds, true);
  if (success) {
    showNotification(`${selectedIds.length} job(s) marked as applied`, 'success');
    await loadJobs();
  }
}

async function markSelectedAsNotApplied() {
  const selectedIds = Array.from(document.querySelectorAll('.job-row.selected'))
    .map(row => parseInt(row.dataset.jobId));
  
  if (selectedIds.length === 0) return;
  
  const success = await ipcRenderer.invoke('update-multiple-jobs-applied-status', selectedIds, false);
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
async function loadSettings() {
  try {
    const settings = await ipcRenderer.invoke('get-settings');
    if (settings) {
      currentSettings = settings;
      
      // Update platform checkboxes
      const platforms = settings.enabled_platforms || ['Jobright'];
      document.querySelectorAll('[id^="platform-"]').forEach(checkbox => {
        checkbox.checked = platforms.includes(checkbox.value);
      });
      
      // Update ignore keywords
      currentSettings.ignore_keywords = settings.ignore_keywords || [];
      renderKeywords();
      
      // Update ignore domains
      currentSettings.ignore_domains = settings.ignore_domains || ['indeed.com', 'linkedin.com', 'dice.com'];
      renderDomains();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

async function saveSettings() {
  try {
    // Get selected platforms
    const selectedPlatforms = [];
    document.querySelectorAll('[id^="platform-"]').forEach(checkbox => {
      if (checkbox.checked) {
        selectedPlatforms.push(checkbox.value);
      }
    });
    
    if (selectedPlatforms.length === 0) {
      showMessage(settingsStatus, 'Please select at least one platform', 'error');
      return;
    }
    
    currentSettings.enabled_platforms = selectedPlatforms;
    
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

