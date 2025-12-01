const BaseScraper = require('../baseScraper');
const path = require('path');
const { BrowserWindow } = require('electron');

class HimalayasScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'Himalayas', gptExtractor);
    this.baseUrl = 'https://himalayas.app/jobs/countries/united-states/software-engineer?sort=recent';
    this.maxPagesToScan = 2;
    this.redirectWaitRangeMs = [5000, 15000];
  }
  
  getBaseDomain() {
    return 'himalayas.app';
  }

  getSettingsSnapshot() {
    const ignoreKeywords = this.db.getSetting('ignore_keywords') || [];
    const ignoreDomains = this.db.getSetting('ignore_domains') || ['indeed.com', 'linkedin.com', 'dice.com'];
    const minSalaryAnnual = Number(this.db.getSetting('min_salary_annual') || 0) || 0;
    return {
      ignoreKeywords: Array.isArray(ignoreKeywords) ? ignoreKeywords.map(k => String(k).toLowerCase()) : [],
      ignoreDomains: Array.isArray(ignoreDomains) ? ignoreDomains : [],
      minSalaryAnnual
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

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;
    const settings = this.getSettingsSnapshot();
    const seenJobs = new Set();

    try {
      await this.initBrowser();
      
      let actions = this.db.getActions(this.platform);
      if (!actions) {
        actions = {
          jobCardSelector: 'div[data-testid="job-list"] article, article.flex',
          titleSelector: 'a[href*="/companies/"][href*="/jobs/"]',
          companySelector: 'a[href^="/companies/"]:not([href*="/jobs/"])'
        };
      }
      
      for (let pageNumber = 1; pageNumber <= this.maxPagesToScan && this.isRunning; pageNumber++) {
        const pageUrl = `${this.baseUrl}&page=${pageNumber}`;
        console.log(`${this.platform}: ═══════════════════════════════════════════`);
        console.log(`${this.platform}: 📄 PAGE ${pageNumber} → ${pageUrl}`);
        this.updateStatus(`Loading Himalayas page ${pageNumber}...`, `Found: ${newJobsCount}`);
        
        await this.navigateToUrl(pageUrl);
        await this.randomDelay(2000, 3000);
        
        const jobCards = await this.loadJobCards(actions);
        if (!jobCards.length) {
          console.log(`${this.platform}: ⚠️ No job cards detected on page ${pageNumber}, stopping pagination.`);
          break;
        }
        
        console.log(`${this.platform}: Page ${pageNumber} - Found ${jobCards.length} job cards`);
        this.updateStatus(`Page ${pageNumber}: ${jobCards.length} job cards`, `Found: ${newJobsCount}`);

        for (let index = 0; index < jobCards.length && this.isRunning; index++) {
          const jobCard = jobCards[index];
          const dedupKey = `${this.normalizeText(jobCard.company)}::${this.normalizeText(jobCard.title)}`;
          if (seenJobs.has(dedupKey)) {
            console.log(`${this.platform}: ⏭️ SKIP (already processed this run) - ${jobCard.company} - ${jobCard.title}`);
            continue;
          }
          seenJobs.add(dedupKey);

          if (this.shouldSkipByKeyword(jobCard.title, settings.ignoreKeywords)) {
            console.log(`${this.platform}: ⏭️ SKIP (ignore keyword) - ${jobCard.title}`);
            this.sendSkipNotification(jobCard, 'Ignored keyword match');
            continue;
          }

          const duplicate = this.db.isDuplicate(jobCard.company, jobCard.title, jobCard.url);
          if (duplicate) {
            console.log(`${this.platform}: 🔁 DUPLICATE - ${jobCard.company} - ${jobCard.title}`);
            continue;
          }

          const saved = await this.processJobCard(jobCard, {
            pageNumber,
            cardIndex: index,
            totalCards: jobCards.length
          }, settings);

          if (saved) {
            newJobsCount++;
            this.updateStatus(`[${index + 1}/${jobCards.length}] Saved ${jobCard.title}`, `Found: ${newJobsCount}`);
          }

          await this.randomDelay(800, 1500);
        }

        this.updateStatus(`Completed page ${pageNumber}`, `Found: ${newJobsCount}`);
        await this.randomDelay(2000, 3500);
      }
      
      console.log(`${this.platform}: ✅ Scraping complete. New jobs: ${newJobsCount}`);
      this.updateStatus(`Himalayas scraping complete`, `Total new: ${newJobsCount}`);

    } catch (error) {
      console.error(`${this.platform}: Scraping error:`, error.message);
      this.reportBug('Scraping Error', error.message, { stack: error.stack });
    } finally {
      await this.closeBrowser();
      this.isRunning = false;
    }

    return newJobsCount;
  }

  async loadJobCards(actions) {
    const selector = actions.jobCardSelector || 'article';
    try {
      await this.page.waitForSelector(selector, { timeout: 15000 });
    } catch (error) {
      console.log(`${this.platform}: ⏳ Job card selector timed out: ${selector}`);
    }

    const cards = await this.page.evaluate((sel) => {
      const origin = window.location.origin;
      const nodes = document.querySelectorAll(sel);
      const result = [];
      nodes.forEach((card) => {
        const titleLink = card.querySelector('a[href*="/companies/"][href*="/jobs/"]');
        const companyLink = card.querySelector('a[href^="/companies/"]:not([href*="/jobs/"])');
        if (!titleLink || !companyLink) {
          return;
        }
        const href = titleLink.getAttribute('href') || '';
        const absoluteUrl = href.startsWith('http') ? href : new URL(href, origin).href;
        if (!absoluteUrl.includes('/companies/')) {
          return;
        }
        const salaryNode = Array.from(card.querySelectorAll('span.sr-only')).find(el => 
          el.textContent && el.textContent.toLowerCase().includes('salary')
        );
        let salaryText = null;
        if (salaryNode && salaryNode.parentElement) {
          salaryText = salaryNode.parentElement.textContent.replace(/Salary:/i, '').trim();
        }
        const locationBadge = Array.from(card.querySelectorAll('div.inline-flex.items-center')).find(el => 
          el.textContent && el.textContent.toLowerCase().includes('united states')
        );
        const tags = Array.from(card.querySelectorAll('div.inline-flex.items-center.border')).map(el => el.textContent.trim()).filter(Boolean);
        result.push({
          company: companyLink.textContent.trim(),
          title: titleLink.textContent.trim(),
          url: absoluteUrl,
          salary: salaryText || null,
          location: locationBadge ? locationBadge.textContent.trim() : 'United States',
          badges: tags
        });
      });
      return result;
    }, selector);

    return cards || [];
  }

  async processJobCard(jobCard, context, settings) {
    const { pageNumber, cardIndex, totalCards } = context;
    console.log(`${this.platform}: ───────────────────────────────────────────`);
    console.log(`${this.platform}: PAGE ${pageNumber} · JOB ${cardIndex + 1}/${totalCards}`);
    console.log(`${this.platform}: ${jobCard.company} — ${jobCard.title}`);

    let jobPage;
    try {
      this.updateStatus(`[${cardIndex + 1}/${totalCards}] Opening job`, `Found: --`);
      jobPage = await this.createWorkerPage('job-detail');
      console.log(`${this.platform}: [1/5] Opening job detail page`);
      await jobPage.goto(jobCard.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const details = await this.extractJobDetails(jobPage);
      console.log(`${this.platform}: [2/5] Job detail parsed`);

      let applicationLink = await this.getApplicationLinkFromModal(jobPage);
      if (!applicationLink && details.applicationLink) {
        applicationLink = details.applicationLink;
      }
      let finalUrl = jobCard.url;

      if (applicationLink) {
        console.log(`${this.platform}: [3/5] Found application link → ${applicationLink}`);
        finalUrl = await this.followApplicationLink(jobPage, applicationLink);
      } else {
        console.log(`${this.platform}: ⚠️ No application link found, using job detail URL`);
      }

      if (this.shouldSkipDomain(finalUrl, settings.ignoreDomains)) {
        console.log(`${this.platform}: ⏭️ SKIP (ignored domain) - ${finalUrl}`);
        this.sendSkipNotification(jobCard, 'Ignored domain');
        return false;
      }

      const jobRecord = {
        company: jobCard.company,
        title: jobCard.title,
        url: finalUrl,
        is_remote: true,
        is_startup: true,
        location: details.location || jobCard.location || 'United States',
        salary: details.salary || jobCard.salary || null,
        tech_stack: details.techStack?.length ? details.techStack.join(', ') : (jobCard.badges?.join(', ') || null)
      };

      console.log(`${this.platform}: [4/5] Saving job to database`);
      const saved = this.saveJob(jobRecord);
      if (saved) {
        console.log(`${this.platform}: [5/5] ✅ Saved ${jobCard.company} - ${jobCard.title}`);
        this.notifyJobSaved(jobRecord);
        return true;
      }

      console.log(`${this.platform}: ℹ️ Duplicate detected during save`);
      return false;
    } catch (error) {
      console.error(`${this.platform}: ❌ Error processing job:`, error.message);
      this.reportBug('Processing Error', error.message, {
        stack: error.stack,
        url: jobCard.url,
        job_title: jobCard.title,
        job_company: jobCard.company
      });
      return false;
    } finally {
      if (jobPage) {
        try {
          await jobPage.close();
        } catch (closeErr) {
          // Ignore close errors
        }
      }
    }
  }

  async extractJobDetails(page) {
    const details = await page.evaluate(() => {
      const techTags = Array.from(document.querySelectorAll('[class*="tech"] a, a[href*="/tech-stack"]'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);
      const locationNode = Array.from(document.querySelectorAll('div, span'))
        .map(el => el.textContent?.trim())
        .find(text => text && text.toLowerCase().includes('united states'));
      const salaryNode = Array.from(document.querySelectorAll('span, p'))
        .map(el => el.textContent?.trim())
        .find(text => text && text.includes('USD') && text.includes('$'));
      const scriptWithLink = Array.from(document.querySelectorAll('script'))
        .map(script => script.textContent || '')
        .find(text => text.includes('applicationLink'));
      let applicationLink = null;
      if (scriptWithLink) {
        const match = scriptWithLink.match(/"applicationLink":"([^"]+)"/);
        if (match && match[1]) {
          applicationLink = match[1]
            .replace(/\\u002F/g, '/')
            .replace(/\\\//g, '/')
            .replace(/\\\\/g, '\\');
        }
      }
      return {
        techStack: Array.from(new Set(techTags)),
        location: locationNode || null,
        salary: salaryNode || null,
        applicationLink
      };
    });

    if (details.applicationLink && !details.applicationLink.startsWith('http')) {
      try {
        const absolute = new URL(details.applicationLink, 'https://himalayas.app');
        details.applicationLink = absolute.href;
      } catch (error) {
        // Keep original if URL construction fails
      }
    }

    return details;
  }

  async getApplicationLinkFromModal(page) {
    try {
      // Use CSS selector approach instead of XPath
      // Wait for any button that contains "apply now" text (case-insensitive)
      const buttonFound = await page.waitForFunction(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(btn => {
          const text = btn.textContent.trim().toLowerCase();
          return text === 'apply now' || text.includes('apply now');
        });
      }, { timeout: 12000 }).catch(() => false);
      
      if (!buttonFound) {
        console.log(`${this.platform}: ⚠️ Apply button not found`);
        return null;
      }
      
      // Find and click the button using evaluate
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const applyButton = buttons.find(btn => {
          const text = btn.textContent.trim().toLowerCase();
          return text === 'apply now' || text.includes('apply now');
        });
        
        if (!applyButton) return false;
        
        // Scroll into view
        applyButton.scrollIntoView({ block: 'center', behavior: 'instant' });
        
        // Try direct click first
        try {
          applyButton.click();
          return true;
        } catch (e) {
          // Fallback to synthetic click
          applyButton.dispatchEvent(new MouseEvent('click', { 
            bubbles: true, 
            cancelable: true, 
            view: window 
          }));
          return true;
        }
      });
      
      if (!clicked) {
        console.log(`${this.platform}: ⚠️ Failed to click Apply button`);
        return null;
      }
      
      await page.waitForTimeout(1000);
      
      const linkAppeared = await page.waitForFunction(() => {
        const modal = document.querySelector('div[role="dialog"][data-state="open"]');
        if (!modal) return false;
        const anchor = modal.querySelector('a[href*="/apply/"]');
        return !!anchor;
      }, { timeout: 10000 }).catch(() => false);
      
      if (!linkAppeared) {
        return null;
      }
      
      const href = await page.evaluate(() => {
        const modal = document.querySelector('div[role="dialog"][data-state="open"]');
        if (!modal) return null;
        const anchor = modal.querySelector('a[href*="/apply/"]');
        if (!anchor) return null;
        return anchor.href || anchor.getAttribute('href');
      });
      
      if (!href) {
        return null;
      }
      
      try {
        const absolute = new URL(href, 'https://himalayas.app');
        return absolute.href;
      } catch {
        return href;
      }
    } catch (error) {
      console.log(`${this.platform}: ⚠️ Unable to capture apply link from modal: ${error.message}`);
      return null;
    }
  }

  async followApplicationLink(page, applyUrl) {
    try {
      await page.goto(applyUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      const waitMs = this.getRandomInt(this.redirectWaitRangeMs[0], this.redirectWaitRangeMs[1]);
      console.log(`${this.platform}: ⏳ Waiting ${Math.round(waitMs / 1000)}s for redirect...`);
      await page.waitForTimeout(waitMs);
      const finalUrl = page.url();
      console.log(`${this.platform}: 🔗 Final redirected URL: ${finalUrl}`);
      return finalUrl;
    } catch (error) {
      console.error(`${this.platform}: ⚠️ Failed to follow application link:`, error.message);
      return applyUrl;
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

  getRandomInt(min, max) {
    const minCeil = Math.ceil(min);
    const maxFloor = Math.floor(max);
    return Math.floor(Math.random() * (maxFloor - minCeil + 1)) + minCeil;
  }
}

module.exports = HimalayasScraper;

