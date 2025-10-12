const BaseScraper = require('../baseScraper');

class JobgetherScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'Jobgether', gptExtractor);
    this.baseUrl = 'https://jobgether.com/offers';
  }
  
  getBaseDomain() {
    return 'jobgether.com';
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;

    try {
      await this.initBrowser();
      
      const url = `${this.baseUrl}?location=United+States&remote=true`;
      console.log(`${this.platform}: Navigating to ${url}`);
      
      await this.navigateToUrl(url);
      await this.randomDelay(3000, 5000);

      let actions = this.db.getActions(this.platform);
      
      if (!actions) {
        actions = {
          jobCardSelector: '[data-testid="job-card"], .job-card, a[href*="/offer/"]',
          companySelector: '.company-name, [data-testid="company"]',
          titleSelector: '.job-title, h3, h2'
        };
      }

      const jobLinks = await this.executeScript(`
        (function() {
          const cards = Array.from(document.querySelectorAll('${actions.jobCardSelector}')).slice(0, 20);
          return cards.map(card => card.href || card.closest('a')?.href).filter(Boolean);
        })();
      `);

      console.log(`${this.platform}: Found ${jobLinks ? jobLinks.length : 0} job listings`);

      if (jobLinks && Array.isArray(jobLinks)) {
        for (const jobUrl of jobLinks) {
          if (!this.isRunning) break;

          try {
            await this.navigateToUrl(jobUrl);
            await this.randomDelay(1000, 2000);

            const company = await this.extractText(actions.companySelector) || 'Unknown Company';
            const title = await this.extractText(actions.titleSelector) || 'Unknown Title';
            const finalUrl = this.window.webContents.getURL();

            const saved = this.saveJob({
              company,
              title,
              url: finalUrl,
              is_remote: true,
              location: 'United States'
            });

            if (saved) {
              newJobsCount++;
              console.log(`${this.platform}: Saved job - ${company} - ${title}`);
            }

            await this.randomDelay(2000, 4000);
          } catch (error) {
            console.error(`${this.platform}: Error processing job:`, error.message);
          }
        }
      }

    } catch (error) {
      console.error(`${this.platform}: Scraping error:`, error.message);
    } finally {
      await this.closeBrowser();
      this.isRunning = false;
    }

    return newJobsCount;
  }
}

module.exports = JobgetherScraper;
