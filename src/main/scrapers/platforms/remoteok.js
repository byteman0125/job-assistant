const BaseScraper = require('../baseScraper');

class RemoteOKScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'RemoteOK', gptExtractor);
    this.baseUrl = 'https://remoteok.com/remote-dev-jobs';
  }
  
  getBaseDomain() {
    return 'remoteok.com';
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;

    try {
      await this.initBrowser();
      
      console.log(`${this.platform}: Navigating to ${this.baseUrl}`);
      await this.navigateToUrl(this.baseUrl);
      await this.randomDelay(2000, 4000);

      let actions = this.db.getActions(this.platform);
      
      if (!actions) {
        actions = {
          jobRowSelector: 'tr.job',
          companySelector: 'h3',
          titleSelector: 'h2',
          linkSelector: 'a.preventLink'
        };
      }

      // Get job elements
      const jobs = await this.executeScript(`
        (function() {
          const rows = Array.from(document.querySelectorAll('${actions.jobRowSelector}')).slice(0, 20);
          return rows.map(row => {
            const link = row.querySelector('${actions.linkSelector}');
            const company = row.querySelector('${actions.companySelector}');
            const title = row.querySelector('${actions.titleSelector}');
            
            return {
              url: link ? link.href : null,
              company: company ? company.textContent.trim() : 'Unknown',
              title: title ? title.textContent.trim() : 'Unknown'
            };
          }).filter(job => job.url);
        })();
      `);

      console.log(`${this.platform}: Found ${jobs ? jobs.length : 0} job listings`);

      if (jobs && Array.isArray(jobs)) {
        for (const job of jobs) {
          if (!this.isRunning) break;

          try {
            await this.navigateToUrl(job.url);
            await this.randomDelay(1000, 2000);
            const finalUrl = this.window.webContents.getURL();

            const saved = this.saveJob({
              company: job.company,
              title: job.title,
              url: finalUrl,
              is_remote: true,
              location: 'United States'
            });

            if (saved) {
              newJobsCount++;
              console.log(`${this.platform}: Saved job - ${job.company} - ${job.title}`);
            }

            await this.randomDelay(2000, 3000);
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

module.exports = RemoteOKScraper;
