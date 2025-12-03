const BaseScraper = require('../baseScraper');
const { BrowserWindow } = require('electron');

class RocketshipScraper extends BaseScraper {
  constructor(database) {
    super(database, 'Rocketship');
    this.baseUrl = 'https://www.remoterocketship.com/?page=1&sort=DateAdded&locations=United+States&jobTitle=Software+Engineer';
  }
  
  getBaseDomain() {
    return 'remoterocketship.com';
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

      console.log(`${this.platform}: Starting Rocketship scraper...`);
      this.updateStatus('Starting Rocketship scraper...', '0/0');

      // Navigate to the page
      this.updateStatus('Loading page...', '0/0');
      this.mirrorToWebview(this.baseUrl);
      
      await this.page.goto(this.baseUrl, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      await this.randomDelay(2000, 3000);

      // Check for bot challenge
      if (await this.detectBotChallenge(this.page)) {
        console.log(`${this.platform}: 🚨 Bot challenge detected, attempting to solve...`);
        const solved = await this.attemptBotChallenge(this.page);
        if (!solved) {
          console.log(`${this.platform}: ❌ Could not solve bot challenge, skipping`);
          return 0;
        }
      }

      // Extract all job cards from the page
      const jobCards = await this.page.evaluate(() => {
        // Find all job card containers
        // Cards are in: <div class="sm:w-8/12 list-none"><div class="relative cursor-pointer">
        const cards = Array.from(document.querySelectorAll('div[class*="list-none"] > div[role="button"], div[class*="list-none"] > div[class*="relative"][class*="cursor-pointer"]'));
        
        return cards.map((card, index) => {
          // Extract company name from <a target="_blank" href="/company/...">Company</a>
          // Company is in: <h4 class="text-md font-normal text-primary mr-2"><a target="_blank" href="/company/...">Company</a>
          const companyEl = card.querySelector('h4 a[target="_blank"][href^="/company/"]');
          const company = companyEl ? companyEl.textContent.trim() : null;
          
          // Extract job title from <a target="_blank" href="/company/.../jobs/...">Title</a>
          // Title is in: <h3 class="text-lg font-semibold text-primary mr-4"><a target="_blank" href="/company/.../jobs/...">Title</a>
          const titleEl = card.querySelector('h3 a[target="_blank"][href*="/jobs/"]');
          const title = titleEl ? titleEl.textContent.trim() : null;
          
          // Extract job URL from Apply button: <a href="https://..." class="...">Apply</a>
          // The Apply button is in: <div class="flex flex-row items-end pl-4"><a href="https://...">Apply</a>
          // Look for any anchor with http/https href that contains "Apply" text or is in the apply button container
          let jobUrl = null;
          const applyContainer = card.querySelector('div[class*="flex"][class*="flex-row"][class*="items-end"]');
          if (applyContainer) {
            const applyLink = applyContainer.querySelector('a[href^="http"]');
            if (applyLink) {
              jobUrl = applyLink.getAttribute('href');
            }
          }
          // Fallback: search for any http link in the card
          if (!jobUrl) {
            const allLinks = card.querySelectorAll('a[href^="http"]');
            for (const link of allLinks) {
              const href = link.getAttribute('href');
              // Skip links to remoterocketship.com itself
              if (href && !href.includes('remoterocketship.com')) {
                jobUrl = href;
                break;
              }
            }
          }
          
          // Extract tech stack from pill badges
          // Tech stack pills are in: <div class="flex flex-row flex-wrap items-center mt-4 -ml-2 gap-2">
          // Each tech pill is: <div class="py-2 px-2 ..."><p class="text-xs sm:text-sm font-semibold text-primary">Tech</p></div>
          const techStackContainer = card.querySelector('div[class*="mt-4"]');
          let techStack = [];
          if (techStackContainer) {
            // Find all pill divs that contain tech stack (not salary, location, etc.)
            const allPills = Array.from(techStackContainer.querySelectorAll('div[class*="py-2"][class*="px-2"]'));
            techStack = allPills
              .map(pill => {
                const textEl = pill.querySelector('p');
                return textEl ? textEl.textContent.trim() : null;
              })
              .filter(text => {
                if (!text || text.length === 0) return false;
                // Filter out non-tech badges (salary, location, emoji badges, etc.)
                const lowerText = text.toLowerCase();
                return !lowerText.includes('$') && 
                       !lowerText.includes('k /') && 
                       !lowerText.includes('year') &&
                       !lowerText.includes('hour') &&
                       !lowerText.includes('grant') &&
                       !lowerText.includes('full time') &&
                       !lowerText.includes('part time') &&
                       !lowerText.includes('contract') &&
                       !lowerText.includes('mid-level') &&
                       !lowerText.includes('senior') &&
                       !lowerText.includes('junior') &&
                       !lowerText.includes('lead') &&
                       !lowerText.includes('software engineer') &&
                       !lowerText.includes('remote') &&
                       !lowerText.includes('texas') &&
                       !lowerText.includes('florida') &&
                       !lowerText.includes('california') &&
                       !lowerText.includes('new york') &&
                       !lowerText.includes('h1b') &&
                       !lowerText.includes('visa') &&
                       !text.match(/^[🤠🐊🌲🗽🏄🇺🇸💵💰⏰🟡🟠🖥🦅]/); // No emoji at start
              });
          }
          
          return {
            index: index,
            company: company,
            title: title,
            url: jobUrl,
            techStack: techStack
          };
        }).filter(job => job.company && job.title && job.url);
      });

      console.log(`${this.platform}: 📋 Found ${jobCards.length} job cards`);

      if (jobCards.length === 0) {
        console.log(`${this.platform}: ⚠️ No job cards found`);
        return 0;
      }

      // Process each job card
      for (let i = 0; i < jobCards.length; i++) {
        const jobCard = jobCards[i];
        if (!this.isRunning) break;

        console.log(`\n${this.platform}: ──────────────────────────────────────────`);
        console.log(`${this.platform}: JOB ${i + 1}/${jobCards.length}`);
        console.log(`${this.platform}: ${jobCard.company} — ${jobCard.title}`);
        console.log(`${this.platform}: ──────────────────────────────────────────`);

        this.updateStatus(`[${i + 1}/${jobCards.length}] Processing: ${jobCard.title}`, `Found: ${newJobsCount}`);

        try {
          // Check for duplicates
          if (this.db.isDuplicate(jobCard.company, jobCard.title)) {
            console.log(`${this.platform}: ℹ️ DUPLICATE - Already in database: ${jobCard.company} - ${jobCard.title}`);
            continue;
          }

          // Apply ignore keywords filter
          const ignoreKeywords = this.db.getSetting('ignore_keywords') || [];
          const titleLower = jobCard.title.toLowerCase();
          const matchedKeyword = ignoreKeywords.find(keyword => 
            titleLower.includes(keyword.toLowerCase())
          );
          
          if (matchedKeyword) {
            console.log(`${this.platform}: ⏭️ SKIP (ignore keyword) - ${jobCard.title}`);
            this.sendSkipNotification(jobCard, `Ignore keyword: ${matchedKeyword}`);
            continue;
          }

          // Apply ignore domains filter
          const ignoreDomains = this.db.getSetting('ignore_domains') || ['indeed.com', 'linkedin.com', 'dice.com'];
          let isBlocked = false;
          for (const domain of ignoreDomains) {
            if (jobCard.url.toLowerCase().includes(domain.toLowerCase())) {
              isBlocked = true;
              break;
            }
          }
          
          if (isBlocked) {
            console.log(`${this.platform}: ⏭️ SKIP (ignore domain) - ${jobCard.url}`);
            this.sendSkipNotification(jobCard, 'Ignore domain');
            continue;
          }

          // Check if US-only (URL should already be filtered by the base URL, but double-check)
          // The base URL already filters for United States, so we can assume all jobs are US

          // Prepare job data
          const jobData = {
            company: jobCard.company.trim(),
            title: jobCard.title.trim(),
            url: jobCard.url.trim(),
            platform: this.platform,
            salary: null, // Not extracted from card
            tech_stack: jobCard.techStack.join(', ') || null,
            is_remote: true, // All jobs from this URL are remote
            is_startup: null // Not determined from card
          };

          // Save to database
          console.log(`${this.platform}: [${i + 1}/${jobCards.length}] 💾 Saving job...`);
          console.log(`${this.platform}: 📝 Saving: "${jobCard.company}" - "${jobCard.title}"`);
          console.log(`${this.platform}: 🔗 URL: ${jobCard.url}`);

          const saved = this.saveJob(jobData);
          
          if (saved) {
            newJobsCount++;
            console.log(`${this.platform}: [${i + 1}/${jobCards.length}] ✅ Saved ${jobCard.title}`);
            
            // Notify UI
            const { getMainWindow } = require('../../windowManager');
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
            console.log(`${this.platform}: [${i + 1}/${jobCards.length}] ⚠️ Failed to save ${jobCard.title}`);
          }

        } catch (error) {
          console.error(`${this.platform}: Error processing job card:`, error.message);
          this.reportBug('Job Processing Error', error.message, { 
            stack: error.stack,
            job: jobCard 
          });
        }

        // Small delay between jobs
        if (i < jobCards.length - 1) {
          await this.randomDelay(1000, 2000);
        }
      }

      console.log(`${this.platform}: ✅ Scraping complete. New jobs: ${newJobsCount}`);
      this.updateStatus(`Rocketship scraping complete`, `Total new: ${newJobsCount}`);

    } catch (error) {
      console.error(`${this.platform}: Scraping error:`, error.message);
      this.reportBug('Scraping Error', error.message, { stack: error.stack });
    } finally {
      await this.closeBrowser();
      this.isRunning = false;
    }

    return newJobsCount;
  }
}

module.exports = RocketshipScraper;

