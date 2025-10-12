const BaseScraper = require('../baseScraper');

class ZipRecruiterScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'ZipRecruiter', gptExtractor);
    this.baseUrl = 'https://www.ziprecruiter.com/jobs-search';
  }
  
  getBaseDomain() {
    return 'ziprecruiter.com';
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;

    try {
      await this.initBrowser();
      
      const url = `${this.baseUrl}?search=software+engineer&location=Remote&days=1`;
      console.log(`${this.platform}: Navigating to ${url}`);
      
      await this.navigateToUrl(url);
      await this.randomDelay(3000, 5000);

      let actions = this.db.getActions(this.platform);
      
      if (!actions) {
        actions = {
          jobCardSelector: 'a[data-job-id], .job_link, article a',
          companySelector: '.hiring_company, [itemprop="hiringOrganization"]',
          titleSelector: '.job_title, h2[itemprop="title"]'
        };
      }

      const jobLinks = await this.executeScript(`
        (function() {
          const links = Array.from(document.querySelectorAll('${actions.jobCardSelector}')).slice(0, 20);
          return links.map(link => link.href).filter(href => href.includes('/job/') || href.includes('/c/'));
        })();
      `);

      console.log(`${this.platform}: Found ${jobLinks ? jobLinks.length : 0} job listings`);

      if (jobLinks && Array.isArray(jobLinks)) {
        for (const jobUrl of jobLinks) {
          if (!this.isRunning) break;

          try {
            await this.navigateToUrl(jobUrl);
            await this.randomDelay(2000, 3000);

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

            await this.randomDelay(3000, 5000);
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

module.exports = ZipRecruiterScraper;
