const BaseScraper = require('../baseScraper');

class BuiltInScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'BuiltIn', gptExtractor);
    this.baseUrl = 'https://builtin.com/jobs/remote';
  }
  
  getBaseDomain() {
    return 'builtin.com';
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;

    try {
      await this.initBrowser();
      
      console.log(`${this.platform}: Navigating to ${this.baseUrl}`);
      await this.navigateToUrl(this.baseUrl);
      await this.randomDelay(3000, 5000);

      let actions = this.db.getActions(this.platform);
      
      if (!actions) {
        actions = {
          jobCardSelector: 'a[data-id*="job"], .job-item a, [data-job-id]',
          companySelector: '.company-title, [data-company-name]',
          titleSelector: '.job-title, h2, h3'
        };
      }

      const jobLinks = await this.executeScript(`
        (function() {
          const links = Array.from(document.querySelectorAll('${actions.jobCardSelector}')).slice(0, 20);
          return links.map(link => link.href).filter(href => href.includes('/job/'));
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
              is_startup: true,
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

module.exports = BuiltInScraper;
