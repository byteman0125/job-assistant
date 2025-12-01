const BaseScraper = require('../baseScraper');
const path = require('path');
const { BrowserWindow } = require('electron');

class BuiltInScraper extends BaseScraper {
  constructor(database) {
    super(database, 'BuiltIn');
    this.baseUrl = 'https://builtin.com/jobs/remote/engineering?daysSinceUpdated=1&earlyApplicant=true&country=USA&allLocations=true';
    this.maxPagesToScan = 5;
  }
  
  getBaseDomain() {
    return 'builtin.com';
  }

  // Helper: Send skip notification to UI
  sendSkipNotification(job, reason) {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('job-skipped', {
          company: job.company,
          title: job.title,
          reason: reason,
          platform: this.platform
        });
      }
    } catch (error) {
      // Silently fail if can't send notification
    }
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;

    try {
      await this.initBrowser();
      
      this.updateStatus('Starting BuiltIn scraper...', '0/0');
      console.log(`${this.platform}: Starting BuiltIn scraper...`);
      console.log(`${this.platform}: Base URL: ${this.baseUrl}`);
      
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages && this.isRunning && currentPage <= this.maxPagesToScan) {
        // Build URL with page number
        const pageUrl = currentPage === 1 
          ? this.baseUrl 
          : `${this.baseUrl}&page=${currentPage}`;
        
        console.log(`\n${this.platform}: ═══════════════════════════════════════════`);
        console.log(`${this.platform}: 📄 Processing Page ${currentPage}`);
        console.log(`${this.platform}: ═══════════════════════════════════════════`);
        
        this.updateStatus(`Loading page ${currentPage}...`, `Found: ${newJobsCount}`);
        this.mirrorToWebview(pageUrl);
        
        // Navigate to page
        await this.page.goto(pageUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        await this.randomDelay(2000, 3000);
        
        // Check if "No job results" message exists
        const noResults = await this.page.evaluate(() => {
          const h1 = document.querySelector('h1.fs-2xl.fw-extrabold.mb-md.text-midnight');
          if (h1 && h1.textContent.includes('No job results')) {
            return true;
          }
          return false;
        });
        
        if (noResults) {
          console.log(`${this.platform}: ❌ No job results found - stopping pagination`);
          hasMorePages = false;
          break;
        }
        
        // Extract all job cards from current page
        const jobCards = await this.page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('[data-id="job-card"]'));
          
          return cards.map((card, index) => {
            // Extract company name
            const companyEl = card.querySelector('div.left-side-tile-item-2 a[data-id="company-title"] span');
            const company = companyEl ? companyEl.textContent.trim() : null;
            
            // Extract job title
            const titleEl = card.querySelector('div.left-side-tile-item-3 h2 a[data-id="job-card-title"]');
            const title = titleEl ? titleEl.textContent.trim() : null;
            
            // Extract job ID from card
            const cardId = card.getAttribute('id')?.replace('job-card-', '') || null;
            
            // Extract location (if available)
            const locationEl = card.querySelector('.font-barlow.text-gray-04');
            let location = 'Unknown';
            if (locationEl) {
              const locationText = locationEl.textContent.trim();
              if (locationText && !locationText.includes('Remote') && !locationText.includes('Hybrid')) {
                location = locationText;
              }
            }
            
            // Extract work type (Remote/Hybrid)
            const workTypeEl = card.querySelector('.font-barlow.text-gray-04');
            let workType = 'Unknown';
            const workTypeText = card.innerText;
            if (workTypeText.includes('Remote or Hybrid')) {
              workType = 'Hybrid';
            } else if (workTypeText.includes('Remote')) {
              workType = 'Remote';
            }
            
            return {
              index: index,
              cardId: cardId,
              company: company,
              title: title,
              location: location,
              workType: workType,
              cardElement: card
            };
          }).filter(job => job.company && job.title && job.cardId);
        });
        
        console.log(`${this.platform}: 📋 Found ${jobCards.length} job cards on page ${currentPage}`);
        
        if (jobCards.length === 0) {
          console.log(`${this.platform}: ⚠️ No job cards found - stopping`);
          hasMorePages = false;
          break;
        }
        
        // Process each job card
        for (let i = 0; i < jobCards.length; i++) {
          const jobCard = jobCards[i];
          if (!this.isRunning) break;
          
          const jobNumber = (currentPage - 1) * jobCards.length + i + 1;
          
          console.log(`\n${this.platform}: ──────────────────────────────────────────`);
          console.log(`${this.platform}: 📋 Processing Job ${jobNumber}: ${jobCard.company} - ${jobCard.title}`);
          console.log(`${this.platform}: ──────────────────────────────────────────`);
          
          this.updateStatus(`[${i + 1}/${jobCards.length}] Processing: ${jobCard.title}`, `Found: ${newJobsCount}`);
          
          try {
            // Get current page count before clicking
            const pagesBefore = await this.browser.pages();
            const pageCountBefore = pagesBefore.length;
            
            // Click on the job card to open new tab
            this.updateStatus(`[${i + 1}/${jobCards.length}] Clicking job card...`, `Found: ${newJobsCount}`);
            const cardSelector = `#job-card-${jobCard.cardId}`;
            const cardClicked = await this.page.evaluate((selector) => {
              const card = document.querySelector(selector);
              if (card) {
                const titleLink = card.querySelector('div.left-side-tile-item-3 h2 a');
                if (titleLink) {
                  titleLink.click();
                  return true;
                }
              }
              return false;
            }, cardSelector);
            
            if (!cardClicked) {
              console.log(`${this.platform}: ⚠️ Could not click job card`);
              continue;
            }
            
            // Wait for new tab to open (check every 500ms, max 5 seconds)
            this.updateStatus(`[${i + 1}/${jobCards.length}] Waiting for new tab...`, `Found: ${newJobsCount}`);
            let newPage = null;
            for (let attempt = 0; attempt < 10; attempt++) {
              await new Promise(r => setTimeout(r, 500));
              const pagesAfter = await this.browser.pages();
              
              if (pagesAfter.length > pageCountBefore) {
                // New page opened
                newPage = pagesAfter[pagesAfter.length - 1];
                break;
              }
            }
            
            if (!newPage || newPage === this.page) {
              console.log(`${this.platform}: ⚠️ New tab did not open`);
              continue;
            }
            
            // Wait for page to load
            try {
              await newPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 });
            } catch (navErr) {
              // Page might already be loaded
              await new Promise(r => setTimeout(r, 2000));
            }
            
            const jobPageUrl = newPage.url();
            console.log(`${this.platform}: ✅ New tab opened: ${jobPageUrl}`);
            
            // Don't mirror new tab to webview (causes ERR_ABORTED errors)
            this.updateStatus(`[${i + 1}/${jobCards.length}] Extracting URL...`, `Found: ${newJobsCount}`);
            
            // Extract redirected URL from Apply button
            const redirectedUrl = await newPage.evaluate(() => {
              // Try to find Apply button
              const applyButton = document.querySelector('a#applyButton');
              if (applyButton && applyButton.href) {
                return applyButton.href;
              }
              
              // Fallback: try other apply button selectors
              const applyButtons = document.querySelectorAll('a[href*="apply"], a[href*="jobs"], button[onclick*="apply"]');
              for (const btn of applyButtons) {
                if (btn.href && !btn.href.includes('builtin.com')) {
                  return btn.href;
                }
              }
              
              // If no apply button found, return current page URL
              return window.location.href;
            });
            
            console.log(`${this.platform}: 🔗 Redirected URL: ${redirectedUrl}`);
            
            // Validate URL
            if (!redirectedUrl || 
                redirectedUrl.startsWith('chrome-error://') || 
                redirectedUrl.startsWith('about:') ||
                !redirectedUrl.startsWith('http')) {
              console.log(`${this.platform}: ⚠️ Invalid URL: ${redirectedUrl}`);
              this.updateStatus(`[${i + 1}/${jobCards.length}] ⚠️ Invalid URL, skipping...`, `Found: ${newJobsCount}`);
              await newPage.close();
              continue;
            }
            
            // Don't mirror redirected URL to webview (causes ERR_ABORTED errors)
            this.updateStatus(`[${i + 1}/${jobCards.length}] 💾 Saving job...`, `Found: ${newJobsCount}`);
            
            // Save job to database
            const saved = this.saveJob({
              company: jobCard.company,
              title: jobCard.title,
              url: redirectedUrl,
              is_remote: jobCard.workType === 'Remote',
              is_startup: true, // BuiltIn is startup-focused
              location: jobCard.location || 'United States',
              salary: null,
              tech_stack: null
            });
            
            if (saved) {
              newJobsCount++;
              console.log(`${this.platform}: ✅ Saved job - ${jobCard.company} - ${jobCard.title}`);
              
              // Send notification
              const { getMainWindow } = require(path.join(__dirname, '../../windowManager'));
              const mainWindow = getMainWindow();
              if (mainWindow) {
                mainWindow.webContents.send('new-job-found', {
                  company: jobCard.company,
                  title: jobCard.title,
                  platform: this.platform
                });
                
                const todayJobs = this.db.getJobsToday();
                mainWindow.webContents.send('update-today-count', todayJobs.length);
              }
            } else {
              console.log(`${this.platform}: ℹ️ DUPLICATE - Already in database`);
            }
            
            // Close the new tab
            await newPage.close();
            console.log(`${this.platform}: ✅ Tab closed`);
            
            // Mirror back to job list page
            this.mirrorToWebview(pageUrl);
            
            // Small delay before next job
            await this.randomDelay(1000, 2000);
            
          } catch (error) {
            console.error(`${this.platform}: ❌ Error processing job:`, error.message);
            
            // Try to close any extra tabs
            try {
              const pages = await this.browser.pages();
              if (pages.length > 1) {
                for (let i = 1; i < pages.length; i++) {
                  try { await pages[i].close(); } catch (err) {}
                }
              }
            } catch (closeErr) {
              // Ignore
            }
          }
        }
        
        // Move to next page
        currentPage++;
        if (currentPage > this.maxPagesToScan) {
          hasMorePages = false;
          console.log(`${this.platform}: Reached page limit (${this.maxPagesToScan}). Stopping pagination.`);
        } else {
          this.updateStatus(`Moving to page ${currentPage}...`, `Found: ${newJobsCount}`);
          await this.randomDelay(2000, 3000);
        }
      }
      
      this.updateStatus(`✅ Scraping complete!`, `Total: ${newJobsCount} new jobs`);
      console.log(`\n${this.platform}: ═══════════════════════════════════════════`);
      console.log(`${this.platform}: ✅ Scraping complete!`);
      console.log(`${this.platform}: 💼 New jobs found: ${newJobsCount}`);
      console.log(`${this.platform}: ═══════════════════════════════════════════\n`);

    } catch (error) {
      console.error(`${this.platform}: ❌ Scraping error:`, error.message);
    } finally {
      await this.closeBrowser();
      this.isRunning = false;
    }

    return newJobsCount;
  }
}

module.exports = BuiltInScraper;
