const BaseScraper = require('../baseScraper');
const path = require('path');
const { BrowserWindow } = require('electron');

class JungleScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'Jungle', gptExtractor);
    this.baseUrl = 'https://app.welcometothejungle.com/jobs/';
    this.maxJobsPerRun = 10;
  }
  
  getBaseDomain() {
    return 'welcometothejungle.com';
  }

  getSettingsSnapshot() {
    const ignoreKeywords = this.db.getSetting('ignore_keywords') || [];
    const ignoreDomains = this.db.getSetting('ignore_domains') || ['indeed.com', 'linkedin.com', 'dice.com'];
    return {
      ignoreKeywords: Array.isArray(ignoreKeywords) ? ignoreKeywords.map(k => String(k).toLowerCase()) : [],
      ignoreDomains: Array.isArray(ignoreDomains) ? ignoreDomains : []
    };
  }

  normalizeText(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  shouldSkipByKeyword(title, keywords) {
    if (!title || !keywords.length) return false;
    const normalized = this.normalizeText(title);
    return keywords.some(keyword => normalized.includes(keyword.toLowerCase()));
  }

  shouldSkipDomain(url, domains) {
    if (!url || !domains.length) return false;
    return domains.some(domain => url.toLowerCase().includes(domain.toLowerCase()));
  }

  sendSkipNotification(job, reason) {
    try {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('job-skipped', {
          company: job.company,
          title: job.title,
          reason,
          platform: this.platform
        });
      }
    } catch (error) {
      // Fail silently
    }
  }

  async login() {
    try {
      console.log(`${this.platform}: 🔐 Logging in to Jungle...`);
      this.updateStatus('Logging in...', '0/0');
      
      // Navigate to login page
      await this.navigateToUrl('https://app.welcometothejungle.com/login');
      await this.randomDelay(2000, 3000);
      
      // Wait for email input
      await this.page.waitForSelector('input[id="email"][data-testid="input-email"]', { timeout: 10000 });
      
      // Fill email
      await this.page.type('input[id="email"][data-testid="input-email"]', 'jimdumdev001@gmail.com', { delay: 100 });
      console.log(`${this.platform}: ✅ Filled email`);
      await this.randomDelay(500, 800);
      
      // Fill password
      await this.page.type('input[id="password"][data-testid="input-password"]', 'Dosongchan0125!', { delay: 100 });
      console.log(`${this.platform}: ✅ Filled password`);
      await this.randomDelay(500, 800);
      
      // Click sign in button
      const signInButton = await this.page.waitForSelector('button[type="submit"][data-testid="login-button"]', { timeout: 5000 });
      if (!signInButton) {
        throw new Error('Sign in button not found');
      }
      
      await signInButton.click();
      console.log(`${this.platform}: ✅ Clicked Sign in button`);
      
      // Wait for navigation to home page
      await this.page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 });
      
      const currentUrl = this.page.url();
      console.log(`${this.platform}: ✅ Logged in successfully. Current URL: ${currentUrl}`);
      
      // Verify we're on home page (not still on login)
      if (currentUrl.includes('/login')) {
        throw new Error('Still on login page after sign in');
      }
      
      await this.randomDelay(2000, 3000);
      return true;
      
    } catch (error) {
      console.error(`${this.platform}: ❌ Login failed:`, error.message);
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async processJobsFromUrl(initialUrl, maxJobs, settings) {
    let savedCount = 0;
    
    console.log(`${this.platform}: 📍 Navigating to: ${initialUrl}`);
    await this.navigateToUrl(initialUrl);
    await this.randomDelay(2000, 3000);
    
    // Wait for page to load and check if we're on a job detail page or job list
    // If on job list, we need to click first job or wait for auto-redirect
    const currentUrl = this.page.url();
    console.log(`${this.platform}: Current URL after navigation: ${currentUrl}`);
    
    // If we're on a job list page, we might need to click the first job
    // But based on the original behavior, it seems like navigating to /jobs/ auto-redirects to first job
    // Let's wait a bit and see if we get redirected to a job detail page
    await this.randomDelay(2000, 3000);
    
    for (let jobIndex = 0; jobIndex < maxJobs && this.isRunning; jobIndex++) {
      console.log(`${this.platform}: ═══════════════════════════════════════════`);
      console.log(`${this.platform}: JOB ${jobIndex + 1}/${maxJobs} from ${initialUrl}`);
      
      const currentJobUrl = this.page.url();
      console.log(`${this.platform}: Current URL: ${currentJobUrl}`);
      
      // Extract job details from current page
      const jobData = await this.extractJobDetails();
      
      if (!jobData || !jobData.company || !jobData.title) {
        console.log(`${this.platform}: ⚠️ Could not extract job details, skipping...`);
        await this.clickNextButton();
        continue;
      }
      
      console.log(`${this.platform}: Found: ${jobData.company} - ${jobData.title}`);
      
      // Check duplicate BEFORE clicking Apply
      const duplicate = this.db.isDuplicate(jobData.company, jobData.title, currentJobUrl);
      if (duplicate) {
        console.log(`${this.platform}: 🔁 DUPLICATE - ${jobData.company} - ${jobData.title}`);
        await this.clickNextButton();
        continue;
      }
      
      // Check ignore keywords
      if (this.shouldSkipByKeyword(jobData.title, settings.ignoreKeywords)) {
        console.log(`${this.platform}: ⏭️ SKIP (ignore keyword) - ${jobData.title}`);
        this.sendSkipNotification(jobData, 'Ignored keyword match');
        await this.clickNextButton();
        continue;
      }
      
      // Click Apply button
      const redirectUrl = await this.getRedirectUrlFromModal();
      
      if (!redirectUrl) {
        console.log(`${this.platform}: ⚠️ No redirect URL found in modal, skipping...`);
        await this.clickNextButton();
        continue;
      }
      
      // Check ignore domains
      if (this.shouldSkipDomain(redirectUrl, settings.ignoreDomains)) {
        console.log(`${this.platform}: ⏭️ SKIP (ignored domain) - ${redirectUrl}`);
        this.sendSkipNotification(jobData, 'Ignored domain');
        await this.clickNextButton();
        continue;
      }
      
      // Save job
      const jobRecord = {
        company: jobData.company,
        title: jobData.title,
        url: redirectUrl,
        is_remote: jobData.isRemote || true,
        is_startup: false,
        location: jobData.location || 'United States',
        salary: jobData.salary || null,
        tech_stack: jobData.techStack || null
      };
      
      const saved = this.saveJob(jobRecord);
      if (saved) {
        savedCount++;
        console.log(`${this.platform}: ✅ Saved ${jobData.company} - ${jobData.title}`);
        this.notifyJobSaved(jobRecord);
        this.updateStatus(`Job ${jobIndex + 1}: Saved ${jobData.title}`, `Found: ${savedCount}`);
      } else {
        console.log(`${this.platform}: ℹ️ Duplicate detected during save`);
      }
      
      // Click Next button to go to next job
      await this.clickNextButton();
      await this.randomDelay(1500, 2500);
    }
    
    return savedCount;
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;
    const settings = this.getSettingsSnapshot();

    // Define initial URLs to process
    const initialUrls = [
      'https://app.welcometothejungle.com/jobs?theme=newly-added',
      'https://app.welcometothejungle.com/jobs?theme=recently-funded',
      'https://app.welcometothejungle.com/jobs?theme=female-leaders',
      'https://app.welcometothejungle.com/jobs?theme=tech-for-good',
      'https://app.welcometothejungle.com/jobs/'
    ];

    try {
      await this.initBrowser();
      
      console.log(`${this.platform}: Starting Jungle scraper...`);
      this.updateStatus('Starting Jungle scraper...', '0/0');
      
      // Login first
      await this.login();
      
      // Process jobs from each URL
      for (let urlIndex = 0; urlIndex < initialUrls.length && this.isRunning; urlIndex++) {
        const url = initialUrls[urlIndex];
        console.log(`${this.platform}: 🔄 Processing URL ${urlIndex + 1}/${initialUrls.length}: ${url}`);
        this.updateStatus(`Processing theme ${urlIndex + 1}/${initialUrls.length}...`, `Total saved: ${newJobsCount}`);
        
        const savedFromUrl = await this.processJobsFromUrl(url, 10, settings);
        newJobsCount += savedFromUrl;
        
        console.log(`${this.platform}: ✅ Completed ${url}. Saved ${savedFromUrl} jobs. Total: ${newJobsCount}`);
        
        // Small delay between URLs
        if (urlIndex < initialUrls.length - 1) {
          await this.randomDelay(2000, 3000);
        }
      }
      
      console.log(`${this.platform}: ✅ Scraping complete. New jobs: ${newJobsCount}`);
      this.updateStatus(`Jungle scraping complete`, `Total new: ${newJobsCount}`);

    } catch (error) {
      console.error(`${this.platform}: Scraping error:`, error.message);
      this.reportBug('Scraping Error', error.message, { stack: error.stack });
    } finally {
      await this.closeBrowser();
      this.isRunning = false;
    }

    return newJobsCount;
  }

  async extractJobDetails() {
    try {
      const data = await this.page.evaluate(() => {
        // Extract job title and company
        const titleEl = document.querySelector('h1[data-testid="job-title"]');
        if (!titleEl) return null;
        
        const companyLink = titleEl.querySelector('a');
        const company = companyLink ? companyLink.textContent.trim() : null;
        
        // Extract title by removing company name and comma
        let titleText = titleEl.textContent.trim();
        if (company) {
          // Remove company name and any leading/trailing comma/whitespace
          titleText = titleText.replace(new RegExp(`,\\s*${company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
          titleText = titleText.replace(new RegExp(company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '');
          titleText = titleText.replace(/^,\s*|\s*,$/g, '').trim();
        }
        
        // Extract salary
        const salarySection = document.querySelector('[data-testid="salary-section"]');
        let salary = null;
        if (salarySection) {
          const salaryText = salarySection.textContent.trim();
          if (salaryText) {
            salary = salaryText.replace(/\s+/g, ' ').trim();
          }
        }
        
        // Extract tech stack
        const techSection = document.querySelector('[data-testid="job-technology-used"]');
        const techStack = techSection 
          ? Array.from(techSection.querySelectorAll('div')).map(el => el.textContent.trim()).filter(Boolean).join(', ')
          : null;
        
        // Extract location
        const locationSection = document.querySelector('[data-testid="job-locations"]');
        let location = 'United States';
        if (locationSection) {
          const locationTag = locationSection.querySelector('[data-testid="job-location-tag"]');
          if (locationTag) {
            location = locationTag.textContent.trim();
          }
        }
        
        // Check if remote
        const isRemote = location.toLowerCase().includes('remote') || 
                        location.toLowerCase().includes('us') ||
                        location.toLowerCase().includes('united states');
        
        return {
          title: titleText,
          company: company,
          salary: salary,
          techStack: techStack,
          location: location,
          isRemote: isRemote
        };
      });
      
      return data;
    } catch (error) {
      console.error(`${this.platform}: Error extracting job details:`, error.message);
      return null;
    }
  }

  async getRedirectUrlFromModal() {
    try {
      // Click Apply button
      const applyButton = await this.page.waitForSelector('button[data-testid="apply-button"]', { timeout: 10000 });
      if (!applyButton) {
        console.log(`${this.platform}: ⚠️ Apply button not found`);
        return null;
      }
      
      await applyButton.click();
      console.log(`${this.platform}: ✅ Clicked Apply button`);
      
      // Wait for modal to appear
      await this.page.waitForSelector('div[role="dialog"][data-state="open"][data-testid="modal-content"]', { timeout: 10000 });
      console.log(`${this.platform}: ✅ Modal appeared`);
      
      await this.randomDelay(1000, 1500);
      
      // Find redirect URL from <a> tag in modal
      const redirectUrl = await this.page.evaluate(() => {
        const modal = document.querySelector('div[role="dialog"][data-state="open"][data-testid="modal-content"]');
        if (!modal) return null;
        
        // Look for "Or apply on..." link
        const applyLinks = modal.querySelectorAll('a[href]');
        for (const link of applyLinks) {
          const href = link.getAttribute('href');
          if (href && href.startsWith('http') && !href.includes('welcometothejungle.com') && !href.includes('otta.com')) {
            return href;
          }
        }
        
        // Also check for "Apply on [Company]'s website" button link
        const externalButton = modal.querySelector('button[data-testid="apply-modal-external-button"]');
        if (externalButton) {
          const parentLink = externalButton.closest('a[href]');
          if (parentLink) {
            const href = parentLink.getAttribute('href');
            if (href && href.startsWith('http')) {
              return href;
            }
          }
        }
        
        return null;
      });
      
      // Close modal by clicking close button or outside
      try {
        const closeButton = await this.page.$('button[aria-label="close"]');
        if (closeButton) {
          await closeButton.click();
          await this.randomDelay(500, 800);
        }
      } catch (err) {
        // Ignore close errors
      }
      
      if (redirectUrl) {
        console.log(`${this.platform}: 🔗 Found redirect URL: ${redirectUrl}`);
        return redirectUrl;
      }
      
      console.log(`${this.platform}: ⚠️ No redirect URL found in modal`);
      return null;
      
    } catch (error) {
      console.error(`${this.platform}: Error getting redirect URL:`, error.message);
      return null;
    }
  }

  async clickNextButton() {
    try {
      const nextButton = await this.page.waitForSelector('button[data-testid="next-button"]', { timeout: 5000 });
      if (nextButton) {
        await nextButton.click();
        console.log(`${this.platform}: ✅ Clicked Next button`);
        await this.randomDelay(2000, 3000); // Wait for next job to load
        return true;
      }
      return false;
    } catch (error) {
      console.log(`${this.platform}: ⚠️ Next button not found or error: ${error.message}`);
      return false;
    }
  }

  notifyJobSaved(job) {
    try {
      const { getMainWindow } = require(path.join(__dirname, '../../windowManager'));
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.webContents.send('new-job-found', {
          company: job.company,
          title: job.title,
          platform: this.platform
        });
        const todayJobs = this.db.getJobsToday();
        mainWindow.webContents.send('update-today-count', todayJobs.length);
      }
    } catch (error) {
      // Ignore notification errors
    }
  }
}

module.exports = JungleScraper;

