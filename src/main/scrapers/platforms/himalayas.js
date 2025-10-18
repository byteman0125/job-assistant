const BaseScraper = require('../baseScraper');

class HimalayasScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'Himalayas', gptExtractor);
    this.baseUrl = 'https://himalayas.app/jobs';
  }
  
  getBaseDomain() {
    return 'himalayas.app';
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;

    try {
      await this.initBrowser();
      
      // Navigate to Himalayas jobs page with filters
      const url = `${this.baseUrl}?remoteType=remote&location=United+States&sort=recent`;
      console.log(`${this.platform}: Navigating to ${url}`);
      
      await this.navigateToUrl(url);
      await this.randomDelay(2000, 4000);

      // Get saved actions or use default selectors
      let actions = this.db.getActions(this.platform);
      
      if (!actions) {
        // Default selectors for Himalayas
        actions = {
          jobCardSelector: 'a[href*="/jobs/"]',
          companySelector: '.company-name, [data-company], .text-dark-aaaa',
          titleSelector: '.job-title, h3, .font-medium',
          linkAttribute: 'href'
        };
      }

      // Get all job links
      const jobLinks = await this.executeScript(`
        (function() {
          const links = Array.from(document.querySelectorAll('${actions.jobCardSelector}'));
          return links.map(link => link.href).filter(href => href.includes('/jobs/')).slice(0, 20);
        })();
      `);

      console.log(`${this.platform}: Found ${jobLinks.length} job listings`);

      // Process each job
      for (let i = 0; i < Math.min(jobLinks.length, 20); i++) {
        if (!this.isRunning) break;

        let jobUrl = null;
        let company = null;
        let title = null;

        try {
          jobUrl = jobLinks[i];
          console.log(`${this.platform}: Processing job ${i + 1}/${jobLinks.length}`);
          
          // Navigate to job page
          await this.navigateToUrl(jobUrl);
          await this.randomDelay(1000, 2000);

          // Get final redirected URL
          const finalUrl = this.window.webContents.getURL();

          // ALWAYS try GPT extraction first
          let gptData = null;
          
          if (this.gptExtractor) {
            console.log(`${this.platform}: 🤖 Using ChatGPT to extract job data...`);
            gptData = await this.extractWithGPT(finalUrl);
            if (gptData) {
              // Check if AI extracted valid company and title
              const aiCompanyValid = gptData.company && 
                                     gptData.company.trim() !== '' && 
                                     gptData.company.toLowerCase() !== 'unknown';
              const aiTitleValid = gptData.title && 
                                   gptData.title.trim() !== '' && 
                                   gptData.title.toLowerCase() !== 'unknown';
              
              if (aiCompanyValid && aiTitleValid) {
                company = gptData.company;
                title = gptData.title;
                console.log(`${this.platform}: ✅ GPT extracted: ${company} - ${title}`);
              } else {
                console.log(`${this.platform}: ⚠️ GPT extraction incomplete - will use fallback selectors`);
              }
              
              // Check if it's a software job
              if (gptData.isSoftwareJob === false) {
                console.log(`${this.platform}: ⚠️ Skipping - Not a software/tech job`);
                
                // Save skipped job to database for audit trail
                this.saveJob({
                  company,
                  title,
                  url: finalUrl,
                  is_remote: true,
                  is_startup: true,
                  salary: 'Skipped: Not software/tech job',
                  location: 'United States'
                });
                
                // Mark as applied by bot
                const jobs = this.db.getAllJobs();
                const savedJob = jobs.find(j => j.url === finalUrl);
                if (savedJob) {
                  this.db.updateJobAppliedStatus(savedJob.id, true, 'Bot');
                }
                
                continue; // Skip to next job
              }
            }
          }
          
          // Fallback to selectors if GPT fails or didn't provide valid company/title
          if (!company || !title) {
            console.log(`${this.platform}: Falling back to selector extraction`);
            if (!company) {
              company = await this.extractText(actions.companySelector) || 'Unknown Company';
            }
            if (!title) {
              title = await this.extractText(actions.titleSelector) || 'Unknown Title';
            }
          }

          // Save job (only if it passed the software check)
          const jobData = {
            company,
            title,
            url: finalUrl,
            is_remote: true,
            is_startup: true, // Himalayas is startup-focused
            location: 'United States'
          };
          
          // Include GPT data if available
          if (gptData) {
            jobData.salary = gptData.salary;
            jobData.tech_stack = gptData.techStack;
            jobData.job_type = gptData.jobType;
            jobData.industry = gptData.industry;
          }
          
          const saved = this.saveJob(jobData);

          if (saved) {
            newJobsCount++;
            console.log(`${this.platform}: Saved job - ${company} - ${title}`);
          }

          await this.randomDelay(2000, 4000);
        } catch (error) {
          console.error(`${this.platform}: Error processing job:`, error.message);
          
          // Report bug automatically with deduplication
          this.reportBug('Processing Error', error.message, {
            stack: error.stack,
            url: jobUrl,
            job_title: title,
            job_company: company
          });
        }
      }

    } catch (error) {
      console.error(`${this.platform}: Scraping error:`, error.message);
      
      // Report scraping error
      this.reportBug('Scraping Error', error.message, {
        stack: error.stack
      });
    } finally {
      await this.closeBrowser();
      this.isRunning = false;
    }

    return newJobsCount;
  }
}

module.exports = HimalayasScraper;

