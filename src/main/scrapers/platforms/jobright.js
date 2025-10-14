const BaseScraper = require('../baseScraper');
const path = require('path');

class JobrightScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'Jobright', gptExtractor);
    this.baseUrl = 'https://jobright.ai/jobs/recommend';
    this.currentSalarySettings = null; // Cache salary settings per batch
  }
  
  getBaseDomain() {
    return 'jobright.ai';
  }
  
  // Helper: Check if a job is older than 7 days
  isJobOlderThanOneDay(postedTime) {
    if (!postedTime) return false;
    
    const text = postedTime.toLowerCase();
    
    // Fresh jobs (< 7 days)
    if (text.includes('hour') || text.includes('minute') || text.includes('second')) {
      return false; // Fresh (hours/minutes ago)
    }
    
    // Check for day-based posts
    if (text.includes('day')) {
      const match = text.match(/(\d+)\s*day/);
      if (match) {
        const days = parseInt(match[1]);
        return days > 7; // Fresh if 1-7 days, old if 8+ days
      }
      return false; // If we can't parse, assume fresh
    }
    
    // Old jobs (weeks, months, years)
    if (text.includes('week') || text.includes('month') || text.includes('year')) {
      return true; // Anything in weeks/months/years is old
    }
    
    return false; // Default: assume fresh if can't determine
  }

  // Helper: Click "Not Interested" button and handle modal
  async clickNotInterestedButton(jobCard, options = {}) {
    const { highlight = false, showForDuration = 0 } = options;
    
    try {
      // STEP 1: Optionally highlight the card
      if (highlight && showForDuration > 0) {
        const highlighted = await this.page.evaluate((company, title) => {
          const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
          for (const card of cards) {
            const companyEl = card.querySelector('div.index_company-name__gKiOY');
            const titleEl = card.querySelector('h2.index_job-title__UjuEY');
            if (companyEl?.textContent?.trim() === company && titleEl?.textContent?.trim() === title) {
              card.style.border = '4px solid #ff0000';
              card.style.backgroundColor = '#ffe6e6';
              card.style.boxShadow = '0 0 20px rgba(255,0,0,0.5)';
              card.scrollIntoView({ behavior: 'smooth', block: 'center' });
              return true;
            }
          }
          return false;
        }, jobCard.company, jobCard.title);
        
        if (highlighted) {
          console.log(`${this.platform}: 🔴 Card highlighted!`);
          console.log(`${this.platform}: 👀 Showing for ${showForDuration / 1000}s...`);
          await new Promise(r => setTimeout(r, showForDuration));
        }
      }
      
      // STEP 2: Click "Not Interested" button
      // First, log what page we're on and what cards are visible
      const pageInfo = await this.page.evaluate(() => {
        const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
        const cardList = Array.from(cards).slice(0, 5).map(card => {
          const companyEl = card.querySelector('div.index_company-name__gKiOY');
          const titleEl = card.querySelector('h2.index_job-title__UjuEY');
          return {
            company: companyEl?.textContent?.trim() || 'N/A',
            title: titleEl?.textContent?.trim() || 'N/A'
          };
        });
        return {
          url: window.location.href,
          totalCards: cards.length,
          firstFiveCards: cardList
        };
      });
      
      console.log(`${this.platform}: 📍 Current URL: ${pageInfo.url}`);
      console.log(`${this.platform}: 📊 ${pageInfo.totalCards} cards on page`);
      console.log(`${this.platform}: 🔍 Looking for: "${jobCard.company}" - "${jobCard.title}"`);
      if (pageInfo.firstFiveCards.length > 0) {
        console.log(`${this.platform}: 📋 First 5 cards on page:`);
        pageInfo.firstFiveCards.forEach((card, idx) => {
          console.log(`${this.platform}:    ${idx + 1}. ${card.company} - ${card.title}`);
        });
      }
      
      console.log(`${this.platform}: 🖱️ Clicking "Not Interested" button...`);
      const clicked = await this.page.evaluate((company, title) => {
        const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
        for (const card of cards) {
          const companyEl = card.querySelector('div.index_company-name__gKiOY');
          const titleEl = card.querySelector('h2.index_job-title__UjuEY');
          if (companyEl?.textContent?.trim() === company && titleEl?.textContent?.trim() === title) {
            const dislikeBtn = card.querySelector('button#index_not-interest-button__9OtWF');
            if (dislikeBtn) {
              dislikeBtn.click();
              return true;
            }
          }
        }
        return false;
      }, jobCard.company, jobCard.title);
      
      if (!clicked) {
        console.log(`${this.platform}: ⚠️ Not Interested button not found - card may have been auto-removed`);
        return false;
      }
      
      console.log(`${this.platform}: ✅ Clicked "Not Interested" button`);
      
      // STEP 3: Handle modal (select reason and submit)
      console.log(`${this.platform}: ⏳ Waiting for reason modal to appear...`);
      await new Promise(r => setTimeout(r, 1500)); // Wait a bit longer for modal
      
      // Check what's on the page and log it
      const modalInfo = await this.page.evaluate(() => {
        // Check for modal
        const modal = document.querySelector('.ant-modal');
        const popup = document.querySelector('[class*="not-interest-popup"]');
        
        // Get all radio options
        const radios = document.querySelectorAll('input.ant-radio-input');
        const radioInfo = Array.from(radios).map(radio => ({
          value: radio.value,
          text: radio.parentElement?.parentElement?.textContent?.trim() || 'Unknown',
          visible: radio.offsetParent !== null
        }));
        
        // Check for submit button
        const submitBtn = document.querySelector('button.index_not-interest-popup-button-submit__x6ojj');
        
        return {
          modalVisible: !!modal || !!popup,
          radioCount: radios.length,
          radioOptions: radioInfo,
          submitButtonExists: !!submitBtn,
          submitButtonDisabled: submitBtn?.disabled || false
        };
      });
      
      console.log(`${this.platform}: 📋 Modal Info:`, JSON.stringify(modalInfo, null, 2));
      
      if (!modalInfo.modalVisible) {
        console.log(`${this.platform}: ⚠️ Modal not found! Skipping modal handling...`);
        await new Promise(r => setTimeout(r, 2000));
        return true;
      }
      
      console.log(`${this.platform}: ✅ Modal detected with ${modalInfo.radioCount} options`);
      
      // Try to click "I already applied" radio button (value="5")
      const submitted = await this.page.evaluate(() => {
        const radio = document.querySelector('input.ant-radio-input[value="5"]');
        
        if (!radio) {
          console.log('❌ Radio button with value="5" not found');
          return { success: false, reason: 'Radio not found' };
        }
        
        console.log('✅ Found radio button with value="5", clicking...');
        radio.click();
        
        return new Promise(resolve => {
          setTimeout(() => {
            const submitBtn = document.querySelector('button.index_not-interest-popup-button-submit__x6ojj');
            if (submitBtn && !submitBtn.disabled) {
              console.log('✅ Submit button is enabled, clicking...');
              submitBtn.click();
              resolve({ success: true, reason: 'Submitted' });
            } else {
              console.log('❌ Submit button not found or disabled');
              resolve({ success: false, reason: 'Submit button unavailable' });
            }
          }, 500);
        });
      });
      
      console.log(`${this.platform}: 📤 Modal submit result:`, JSON.stringify(submitted));
      
      if (submitted.success) {
        console.log(`${this.platform}: ✅ Submitted "I already applied" - waiting for card to disappear...`);
        await this.randomDelay(3000, 4000);
      } else {
        console.log(`${this.platform}: ⚠️ Submit failed (${submitted.reason}), waiting anyway...`);
        await new Promise(r => setTimeout(r, 3000));
      }
      
      return true;
    } catch (err) {
      console.log(`${this.platform}: ⚠️ Error clicking Not Interested: ${err.message}`);
      return false;
    }
  }

  async scrape() {
    let newJobsCount = 0;
    this.isRunning = true;

    try {
      await this.initBrowser();
      
      // Update UI status
      this.updateStatus('Loading job list page...', '0/0');
      
      console.log(`${this.platform}: Navigating to ${this.baseUrl}`);
      await this.navigateToUrl(this.baseUrl);
      console.log(`${this.platform}: ⏳ Waiting 1.5-2s for page to load...`);
      await this.randomDelay(1500, 2000);

      // Check for and close "Resume needs Attention" modal
      this.updateStatus('Checking for modals...', '0/0');
      console.log(`${this.platform}: Checking for resume modal...`);
      
      try {
        const modalExists = await this.page.$('.ant-modal-content');
        if (modalExists) {
          const closeBtn = await this.page.$('button.ant-modal-close[aria-label="Close"]');
          if (closeBtn) {
            await closeBtn.click();
            console.log(`${this.platform}: ✅ Closed "Resume needs Attention" modal`);
            console.log(`${this.platform}: ⏳ Waiting 1-1.5s...`);
            await this.randomDelay(1000, 1500);
          }
        }
      } catch (err) {
        // No modal, continue
      }

      // CONTINUOUS LOOP: Process jobs one by one, refreshing list after each
      let continueScraping = true;
      let totalProcessedCount = 0; // Track total jobs processed
      let consecutiveEmptyCount = 0; // Track how many times we found no cards
      let consecutiveOldJobs = 0; // Track consecutive old jobs (stop after 10)
      let scrollAttempts = 0; // Track scroll attempts to trigger periodic scrolling
      
      // Reload salary settings once at start
      this.currentSalarySettings = {
        annual: this.db.getSetting('min_salary_annual'),
        monthly: this.db.getSetting('min_salary_monthly'),
        hourly: this.db.getSetting('min_salary_hourly')
      };
      console.log(`${this.platform}: 💰 Loaded salary settings: Annual=$${this.currentSalarySettings.annual || 'N/A'}`);
      
      while (continueScraping && this.isRunning) {
        // Get FIRST job card from the current list (it will change as we process)
        const jobCards = await this.page.evaluate(() => {
          const listContainer = document.querySelector('.ant-list-items');
          if (!listContainer) return [];
          
          const cards = Array.from(listContainer.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC'));
          
          // Get only the FIRST card
          return cards.slice(0, 1).map((card, index) => {
            const titleEl = card.querySelector('h2.index_job-title__UjuEY');
            const companyEl = card.querySelector('div.index_company-name__gKiOY');
            const timeEl = card.querySelector('span.index_publish-time__cMfCi');
            const applyBtn = card.querySelector('button.index_apply-button__kp79C');
            
            return {
              index: index,
              title: titleEl ? titleEl.textContent.trim() : null,
              company: companyEl ? companyEl.textContent.trim() : null,
              postedTime: timeEl ? timeEl.textContent.trim() : null,
              hasApplyButton: !!applyBtn
            };
          }).filter(job => job.title && job.company && job.hasApplyButton);
        });

        console.log(`${this.platform}: 📋 Cards in list: ${jobCards ? jobCards.length : 0}`);

      if (!jobCards || jobCards.length === 0) {
        consecutiveEmptyCount++;
        console.log(`${this.platform}: ⚠️ No job cards found (attempt ${consecutiveEmptyCount}/5)`);
        
        if (consecutiveEmptyCount >= 5) {
          console.log(`${this.platform}: ❌ No cards found after 5 attempts - stopping`);
          
          // Send warning to UI  
          const path = require('path');
          const { getMainWindow } = require(path.join(__dirname, '../../windowManager'));
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('scraper-warning', {
              platform: this.platform,
              message: 'No job cards found. Please save Jobright cookies and login.'
            });
          }
          
          await this.closeBrowser();
          this.isRunning = false;
          return newJobsCount;
        }
        
        // Try scrolling to load more cards
        console.log(`${this.platform}: 📜 Scrolling to load more cards...`);
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.randomDelay(2000, 3000);
        continue; // Try again
      }
      
      // Reset empty count if we found cards
      consecutiveEmptyCount = 0;

      // Process THE FIRST job card
      if (!this.isRunning) break;

      const jobCard = jobCards[0];
      totalProcessedCount++;
      
      this.updateStatus(`Processing job #${totalProcessedCount}...`, `Found: ${newJobsCount}`);
      
      console.log(`\n${this.platform}: ═══════════════════════════════════════════`);
      console.log(`${this.platform}: 📋 Processing Job #${totalProcessedCount}`);
      console.log(`${this.platform}: ═══════════════════════════════════════════`);
      console.log(`  Company: ${jobCard.company}`);
      console.log(`  Title: ${jobCard.title}`);
      console.log(`  Posted: ${jobCard.postedTime}`);
      
      // CHECK: Is this job older than 7 days?
      const isOld = this.isJobOlderThanOneDay(jobCard.postedTime);
      if (isOld) {
        consecutiveOldJobs++;
        console.log(`${this.platform}: ⏭️ SKIPPING OLD JOB (> 7 days old) [${consecutiveOldJobs}/10]`);
        console.log(`${this.platform}: Job: "${jobCard.title}"`);
        console.log(`${this.platform}: Posted: ${jobCard.postedTime}`);
        
        // Stop if we've seen 10 consecutive old jobs
        if (consecutiveOldJobs >= 10) {
          console.log(`\n${this.platform}: ═══════════════════════════════════════════`);
          console.log(`${this.platform}: 🛑 STOPPING - Found 10 consecutive old jobs`);
          console.log(`${this.platform}: All remaining jobs are likely older than 7 days`);
          console.log(`${this.platform}: ═══════════════════════════════════════════\n`);
          break; // Exit the while loop
        }
        
        // Click "Not Interested" to remove it and reveal next card
        try {
          await this.clickNotInterestedButton(jobCard);
          console.log(`${this.platform}: ✅ Removed old job from feed`);
        } catch (err) {
          console.log(`${this.platform}: ⚠️ Could not remove old job: ${err.message}`);
        }
        
        await this.randomDelay(1000, 1500);
        continue; // Get next card from refreshed list
      }
      
      // Reset consecutive old jobs counter when we find a fresh job
      consecutiveOldJobs = 0;
      
      console.log(`${this.platform}: ✅ Job is fresh (≤ 7 days old) - Processing...`);
      
      // CHECK: Ignore keywords in job title
      const ignoreKeywords = this.db.getSetting('ignore_keywords') || [];
      const titleLower = jobCard.title.toLowerCase();
      const matchedKeyword = ignoreKeywords.find(keyword => 
        titleLower.includes(keyword.toLowerCase())
      );
      
      if (matchedKeyword) {
        console.log(`${this.platform}: 🚫 Ignored - Title contains keyword "${matchedKeyword}"`);
        console.log(`${this.platform}: Title: "${jobCard.title}"`);
        console.log(`${this.platform}: Saving to database and marking as applied by Bot...`);
        
        // Save job to database with minimal info (no GPT extraction needed)
        try {
          const ignoredJob = {
            company: jobCard.company,
            title: jobCard.title,
            url: 'https://jobright.ai/jobs/recommend', // Use base URL since we don't have specific URL
            is_remote: false, // Unknown
            is_startup: false, // Unknown
            salary: `Ignored: ${matchedKeyword}`,
            tech_stack: '',
            location: ''
          };
          
          const saved = this.saveJob(ignoredJob);
          if (saved) {
            const jobs = this.db.getAllJobs();
            const savedJob = jobs.find(j => j.company === jobCard.company && j.title === jobCard.title);
            if (savedJob) {
              this.db.updateJobAppliedStatus(savedJob.id, true, 'Bot');
              console.log(`${this.platform}: 💾 Saved and marked as applied by Bot (ignored keyword)`);
            }
          }
        } catch (saveErr) {
          console.log(`${this.platform}: ⚠️ Error saving ignored job: ${saveErr.message}`);
        }
        
        // Try to click "Not Interested" on Jobright to remove it from feed
        try {
          // Ensure we're on Jobright page with cards loaded
          const currentUrl = this.page.url();
          if (!currentUrl.includes('jobright.ai/jobs/recommend')) {
            console.log(`${this.platform}: 🔄 Navigating to Jobright page...`);
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
          }
          
          // Reload to ensure fresh cards
          console.log(`${this.platform}: 🔄 Refreshing to load cards...`);
          await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
          
          // Wait for cards to appear
          console.log(`${this.platform}: ⏳ Waiting for cards...`);
          let cardsLoaded = false;
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const cardCount = await this.page.evaluate(() => {
              return document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC').length;
            });
            
            if (cardCount > 0) {
              console.log(`${this.platform}: ✅ ${cardCount} cards loaded`);
              cardsLoaded = true;
              break;
            }
          }
          
          if (cardsLoaded) {
            // Now try to click "Not Interested"
            await this.clickNotInterestedButton(jobCard);
          } else {
            console.log(`${this.platform}: ⚠️ No cards appeared - skipping click`);
          }
        } catch (err) {
          console.log(`${this.platform}: ⚠️ Error clicking Not Interested: ${err.message}`);
        }
        
        continue; // Skip to next job
      }

      // Now process the fresh job
      try {
        // Step 1: Click APPLY NOW button with retry (up to 3 attempts)
        this.updateStatus(`[1/5] 🖱️ Opening job tab...`, `Processed: ${totalProcessedCount}`);
        
        let newPage = null;
        
        for (let clickAttempt = 1; clickAttempt <= 3; clickAttempt++) {
          // Check if scraper was stopped
          if (!this.isRunning) {
            console.log(`${this.platform}: 🛑 Scraper stopped by user`);
            break;
          }
          
          console.log(`${this.platform}: 🖱️ Click attempt ${clickAttempt}/3...`);
          
          // Set up promise to wait for new tab with countdown
          const newTabPromise = new Promise((resolve) => {
            let tabOpened = false;
            
            this.browser.once('targetcreated', async (target) => {
              try {
                if (target.type() === 'page') {
                  tabOpened = true;
                  console.log(`${this.platform}: 🆕 New tab detected, getting page object...`);
                  const newPage = await target.page();
                  console.log(`${this.platform}: ✅ Page object obtained successfully`);
                  
                  // IMMEDIATELY show the page to user
                  const quickUrl = newPage.url();
                  console.log(`${this.platform}: 📺 INSTANT MIRROR: ${quickUrl}`);
                  this.mirrorToWebview(quickUrl);
                  
                  resolve(newPage);
                }
              } catch (err) {
                console.log(`${this.platform}: ❌ Error getting page: ${err.message}`);
                resolve(null);
              }
            });
            
            // Countdown with status updates and isRunning checks
            const countdownInterval = setInterval(() => {
              if (!this.isRunning) {
                clearInterval(countdownInterval);
                console.log(`${this.platform}: 🛑 Stopped by user during wait`);
                resolve(null);
              }
            }, 500);
            
            // Show countdown every 2 seconds
            let timeLeft = 8;
            const countdownDisplay = setInterval(() => {
              if (tabOpened) {
                clearInterval(countdownDisplay);
                clearInterval(countdownInterval);
              } else if (timeLeft > 0) {
                console.log(`${this.platform}: ⏳ Waiting for tab... ${timeLeft}s`);
                timeLeft -= 2;
              }
            }, 2000);
            
            // Timeout after 8 seconds (reduced from 20s)
            setTimeout(() => {
              clearInterval(countdownDisplay);
              clearInterval(countdownInterval);
              if (!tabOpened) {
                console.log(`${this.platform}: ⏰ No tab after 8s`);
                resolve(null);
              }
            }, 8000);
          });
        
          // Click the button (try to match by company/title, fallback to first card)
          try {
            console.log(`${this.platform}: Looking for: ${jobCard.company} - ${jobCard.title}`);
            
            const clicked = await this.page.evaluate((company, title) => {
              const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
              
              for (const card of cards) {
                const companyEl = card.querySelector('div.index_company-name__gKiOY');
                const titleEl = card.querySelector('h2.index_job-title__UjuEY');
                
                const cardCompany = companyEl?.textContent?.trim();
                const cardTitle = titleEl?.textContent?.trim();
                
                if (cardCompany === company && cardTitle === title) {
                  const btn = card.querySelector('button.index_apply-button__kp79C');
                  if (btn) {
                    btn.click();
                    return true;
                  }
                }
              }
              
              // Fallback: Click first card
              const firstCard = cards[0];
              if (firstCard) {
                const btn = firstCard.querySelector('button.index_apply-button__kp79C');
                if (btn) {
                  btn.click();
                  return true;
                }
              }
              
              return false;
            }, jobCard.company, jobCard.title);
            
            if (clicked) {
              console.log(`${this.platform}: ✅ Clicked button`);
              console.log(`${this.platform}: ⏳ Waiting 1s for tab to open...`);
              await new Promise(r => setTimeout(r, 1000));
            } else {
              console.log(`${this.platform}: ⚠️ Button not found`);
            }
          } catch (clickError) {
            console.log(`${this.platform}: ⚠️ Click error: ${clickError.message}`);
          }
          
          // Check if tab opened
          const tabOpened = await newTabPromise;
          
          if (tabOpened) {
            console.log(`${this.platform}: ✅ Tab opened successfully!`);
            newPage = tabOpened;
            break; // Exit retry loop
          } else {
            console.log(`${this.platform}: ❌ No tab opened`);
            
            if (clickAttempt < 3) {
              console.log(`${this.platform}: 🔄 Retrying click...`);
              await new Promise(r => setTimeout(r, 2000)); // Wait before retry
            }
          }
        } // End retry loop
        
        // If no tab opened after 3 attempts, skip job
        if (!newPage) {
          console.log(`${this.platform}: ❌ Failed to open tab after 3 attempts - skipping job`);
          
          // Mark as "Not Interested" so we don't keep trying
          try {
            const clicked = await this.page.evaluate((company, title) => {
              const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
              for (const card of cards) {
                const companyEl = card.querySelector('div.index_company-name__gKiOY');
                const titleEl = card.querySelector('h2.index_job-title__UjuEY');
                if (companyEl?.textContent?.trim() === company && titleEl?.textContent?.trim() === title) {
                  const dislikeBtn = card.querySelector('button#index_not-interest-button__9OtWF');
                  if (dislikeBtn) {
                    dislikeBtn.click();
                    return true;
                  }
                }
              }
              return false;
            }, jobCard.company, jobCard.title);
            
            if (clicked) {
              console.log(`${this.platform}: ✅ Marked as "Not Interested" - won't retry this job`);
              await new Promise(r => setTimeout(r, 2000));
            }
          } catch (err) {
            // Ignore
          }
          
          continue;
        }
        
        console.log(`${this.platform}: 🆕 New tab opened!`);
        
        // Step 2: Click "Not Interested"
        this.updateStatus(`[2/5] ⚡ Removing from feed...`, `Processed: ${totalProcessedCount}`);
        
        // ⚡ IMMEDIATELY click "Not Interested" while card still exists!
        console.log(`${this.platform}: ⚡ QUICK ACTION: Clicking "Not Interested" immediately...`);
        try {
          const quickClicked = await this.page.evaluate((company, title) => {
            const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
            for (const card of cards) {
              const companyEl = card.querySelector('div.index_company-name__gKiOY');
              const titleEl = card.querySelector('h2.index_job-title__UjuEY');
              
              const cardCompany = companyEl?.textContent?.trim();
              const cardTitle = titleEl?.textContent?.trim();
              
              if (cardCompany === company && cardTitle === title) {
                const dislikeBtn = card.querySelector('button#index_not-interest-button__9OtWF');
                if (dislikeBtn) {
                  dislikeBtn.click();
                  return true;
                }
              }
            }
            return false;
          }, jobCard.company, jobCard.title);
          
          if (quickClicked) {
            console.log(`${this.platform}: ✅ Clicked "Not Interested" button`);
            
            // Wait for modal and submit reason
            console.log(`${this.platform}: ⏳ Waiting for reason modal...`);
            await new Promise(r => setTimeout(r, 1500));
            
            const modalInfo = await this.page.evaluate(() => {
              const modal = document.querySelector('div.ant-modal[role="dialog"]');
              if (!modal) return { modalVisible: false };
              
              const radioInputs = modal.querySelectorAll('input.ant-radio-input');
              const submitBtn = modal.querySelector('button.index_not-interest-popup-button-submit__x6ojj');
              
              return {
                modalVisible: true,
                radioCount: radioInputs.length,
                radioOptions: Array.from(radioInputs).map(input => ({
                  value: input.value,
                  text: input.parentElement?.parentElement?.textContent?.trim(),
                  visible: true
                })),
                submitButtonExists: !!submitBtn,
                submitButtonDisabled: submitBtn?.disabled
              };
            });
            
            console.log(`${this.platform}: 📋 Modal Info:`, JSON.stringify(modalInfo, null, 2));
            
            if (modalInfo.modalVisible) {
              console.log(`${this.platform}: ✅ Modal detected with ${modalInfo.radioCount} options`);
              
              const submitted = await this.page.evaluate(() => {
                const radio = document.querySelector('input.ant-radio-input[value="5"]'); // "I already applied"
                if (radio) radio.click();
                return new Promise(resolve => {
                  setTimeout(() => {
                    const submitBtn = document.querySelector('button.index_not-interest-popup-button-submit__x6ojj');
                    if (submitBtn && !submitBtn.disabled) {
                      submitBtn.click();
                      resolve({ success: true, reason: 'Submitted' });
                    } else {
                      resolve({ success: false, reason: 'Button disabled or not found' });
                    }
                  }, 500);
                });
              });
              
              console.log(`${this.platform}: 📤 Modal submit result:`, JSON.stringify(submitted));
              
              if (submitted.success) {
                console.log(`${this.platform}: ✅ Submitted "I already applied" - card will disappear`);
              } else {
                console.log(`${this.platform}: ⚠️ Submit may have failed: ${submitted.reason}`);
              }
            } else {
              console.log(`${this.platform}: ⚠️ Modal not visible - card may have disappeared already`);
            }
          } else {
            console.log(`${this.platform}: ⚠️ "Not Interested" button not found - card may have disappeared`);
          }
        } catch (quickErr) {
          console.log(`${this.platform}: ⚠️ Error clicking "Not Interested": ${quickErr.message}`);
        }
        
        console.log(`${this.platform}: ✅ Card removed from feed, now processing job...`);
        
        // Page already mirrored instantly - user can see it!
        let finalJobUrl = newPage.url();
        
        // Navigate to clean URL if needed (for full job details!)
        if (finalJobUrl.includes('/apply')) {
          const cleanUrl = finalJobUrl.split('/apply')[0] + '/';
          console.log(`${this.platform}: 🔄 Quick nav to: ${cleanUrl}`);
          
          newPage.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 500)); // Brief pause for navigation to start
          finalJobUrl = cleanUrl;
          this.mirrorToWebview(cleanUrl);
          console.log(`${this.platform}: ✅ Navigating...`);
          
        } else if (finalJobUrl.includes('/application')) {
          const cleanUrl = finalJobUrl.split('/application')[0];
          console.log(`${this.platform}: 🔄 Quick nav to: ${cleanUrl}`);
          
          newPage.goto(cleanUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
          await new Promise(r => setTimeout(r, 500)); // Brief pause for navigation to start
          finalJobUrl = cleanUrl;
          this.mirrorToWebview(cleanUrl);
          console.log(`${this.platform}: ✅ Navigating...`);
          
        } else {
          console.log(`${this.platform}: ✅ Final job URL: ${finalJobUrl}`);
        }
        
        // CRITICAL: Wait for page content to fully load (not just DOM)
        console.log(`${this.platform}: Waiting for content to fully render...`);
        
        // Smart wait: Check every 1s if content loaded (max 20s)
        let contentLoaded = false;
        for (let waitAttempt = 0; waitAttempt < 20; waitAttempt++) {
          // Check if scraper was stopped
          if (!this.isRunning) {
            console.log(`${this.platform}: 🛑 Scraper stopped by user during page load`);
            await newPage.close();
            return newJobsCount;
          }
          
          await new Promise(r => setTimeout(r, 1000)); // ⚡ Fast check
          
          const checkContent = await newPage.evaluate(() => {
            const title = document.title.toLowerCase();
            const bodyLength = document.body ? document.body.innerText.length : 0;
            
            // Check if it's still Cloudflare
            const isStillLoading = title.includes('just a moment') || 
                                   title.includes('checking') ||
                                   bodyLength < 500;
            
            return {
              title,
              bodyLength,
              isStillLoading
            };
          });
          
          if (!checkContent.isStillLoading) {
            console.log(`${this.platform}: ✅ Content loaded after ${waitAttempt + 1}s (${checkContent.bodyLength} chars)`);
            contentLoaded = true;
            break;
          }
          
          console.log(`${this.platform}: Still loading (attempt ${waitAttempt + 1}/20, ${checkContent.bodyLength} chars)...`);
        }
        
        if (!contentLoaded) {
          console.log(`${this.platform}: ❌ Content didn't load after 20s - SKIPPING (stuck on Cloudflare)`);
          
            // Close tab and mark as applied
            try {
              await newPage.close();
              console.log(`${this.platform}: ✅ Tab closed`);
            } catch (closeErr) {
              console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
            }
            
            // Memory cleanup
            const pages = await this.browser.pages();
            if (pages.length > 1) {
              for (let i = 1; i < pages.length; i++) {
                try { await pages[i].close(); } catch (err) {}
              }
            }
            this.page = pages[0];
            
            // INSTANT MIRROR: Show Jobright.ai immediately
            this.mirrorToWebview(this.baseUrl);
            
            // Navigate back
          try {
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            console.log(`${this.platform}: ✅ Back on job list`);
            
            // REFRESH to ensure cards are loaded
            console.log(`${this.platform}: 🔄 Refreshing page to load cards...`);
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Page refreshed`);
            
            // Smart wait: Wait for cards to actually appear (up to 10s)
            console.log(`${this.platform}: ⏳ Waiting for cards to appear...`);
            let cardsLoaded = false;
            for (let attempt = 0; attempt < 10; attempt++) {
              await new Promise(r => setTimeout(r, 1000));
              const cardCount = await this.page.evaluate(() => {
                return document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC').length;
              });
              
              if (cardCount > 0) {
                console.log(`${this.platform}: ✅ ${cardCount} cards loaded after ${attempt + 1}s`);
                cardsLoaded = true;
                break;
              }
            }
            
            if (!cardsLoaded) {
              console.log(`${this.platform}: ⚠️ No cards appeared after 10s`);
            }
          } catch (err) {
            console.log(`${this.platform}: ⚠️ Nav error: ${err.message}`);
          }
          
          this.mirrorToWebview(this.baseUrl);
          
          // FAST METHOD: Highlight card, then click "Not Interested"
          console.log(`${this.platform}: 🚀 Using FAST method - highlighting card...`);
          
          try {
            // STEP 1: Highlight the card
            const highlighted = await this.page.evaluate((company, title) => {
              const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
              
              for (const card of cards) {
                const companyEl = card.querySelector('div.index_company-name__gKiOY');
                const titleEl = card.querySelector('h2.index_job-title__UjuEY');
                
                const cardCompany = companyEl?.textContent?.trim();
                const cardTitle = titleEl?.textContent?.trim();
                
                if (cardCompany === company && cardTitle === title) {
                  // HIGHLIGHT
                  card.style.border = '4px solid #ff0000';
                  card.style.backgroundColor = '#ffe6e6';
                  card.style.boxShadow = '0 0 20px rgba(255,0,0,0.5)';
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  return true;
                }
              }
              return false;
            }, jobCard.company, jobCard.title);
            
            if (highlighted) {
              console.log(`${this.platform}: 🔴 Card highlighted!`);
            }
            
            // STEP 2: Wait so user can see it
            console.log(`${this.platform}: 👀 Showing for 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            
            // STEP 3: Click "Not Interested"
            console.log(`${this.platform}: 🖱️ Clicking "Not Interested" button...`);
            const clicked = await this.page.evaluate((company, title) => {
              const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
              
              for (const card of cards) {
                const companyEl = card.querySelector('div.index_company-name__gKiOY');
                const titleEl = card.querySelector('h2.index_job-title__UjuEY');
                
                const cardCompany = companyEl?.textContent?.trim();
                const cardTitle = titleEl?.textContent?.trim();
                
                if (cardCompany === company && cardTitle === title) {
                  const dislikeBtn = card.querySelector('button#index_not-interest-button__9OtWF');
                  if (dislikeBtn) {
                    dislikeBtn.click();
                    return true;
                  }
                }
              }
              return false;
            }, jobCard.company, jobCard.title);
            
            if (clicked) {
              console.log(`${this.platform}: ✅ Clicked "Not Interested" button`);
              
              // Wait for modal to appear
              console.log(`${this.platform}: ⏳ Waiting for reason modal...`);
              await new Promise(r => setTimeout(r, 1000));
              
              // Select reason and submit
              const submitted = await this.page.evaluate(() => {
                // Click radio button (value="2" = "Not interested in job title")
                const radio = document.querySelector('input.ant-radio-input[value="2"]');
                if (radio) radio.click();
                
                // Wait a bit
                return new Promise(resolve => {
                  setTimeout(() => {
                    // Click Submit button
                    const submitBtn = document.querySelector('button.index_not-interest-popup-button-submit__x6ojj');
                    if (submitBtn && !submitBtn.disabled) {
                      submitBtn.click();
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  }, 500);
                });
              });
              
              if (submitted) {
                console.log(`${this.platform}: ✅ Submitted reason - waiting for card to disappear...`);
                console.log(`${this.platform}: ⏳ Waiting 3-4s...`);
                await this.randomDelay(3000, 4000);
              } else {
                console.log(`${this.platform}: ⚠️ Submit failed, waiting anyway...`);
                await new Promise(r => setTimeout(r, 3000));
              }
            }
          } catch (err) {
            console.log(`${this.platform}: ⚠️ Error clicking Not Interested: ${err.message}`);
          }
          
          continue; // Skip to next job
        }
        
        // Mirror final page
        this.mirrorToWebview(newPage.url());
        
        // FILTER: Skip if URL is from ignored domains (from settings)
        const ignoreDomains = this.db.getSetting('ignore_domains') || ['indeed.com', 'linkedin.com', 'dice.com'];
        let isBlocked = false;
        let blockedPlatform = null;
        
        for (const domain of ignoreDomains) {
          if (finalJobUrl.toLowerCase().includes(domain.toLowerCase())) {
            isBlocked = true;
            blockedPlatform = domain;
            break;
          }
        }
        
        if (isBlocked) {
          console.log(`${this.platform}: ❌ ❌ ❌ BLOCKED DOMAIN DETECTED ❌ ❌ ❌`);
          console.log(`${this.platform}: Domain: ${blockedPlatform.toUpperCase()}`);
          console.log(`${this.platform}: URL: ${finalJobUrl}`);
          console.log(`${this.platform}: ⏭️ SKIPPING - Closing tab and marking as applied`);
          
          // Close the tab immediately
          try {
            await newPage.close();
            console.log(`${this.platform}: ✅ Tab closed successfully`);
          } catch (closeErr) {
            console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
          }
          
          // Memory cleanup: Close any extra pages
          const pages = await this.browser.pages();
          if (pages.length > 1) {
            for (let i = 1; i < pages.length; i++) {
              try {
                await pages[i].close();
                console.log(`${this.platform}: 🧹 Closed extra page`);
              } catch (err) {}
            }
          }
          
          this.page = pages[0];
          
          // INSTANT MIRROR: Show Jobright.ai immediately
          this.mirrorToWebview(this.baseUrl);
          
          // Navigate back to job list to ensure we're on the right page
          try {
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Navigated back to job list`);
            
            // REFRESH to ensure cards are loaded
            console.log(`${this.platform}: 🔄 Refreshing page to load cards...`);
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Page refreshed`);
            
            // Smart wait: Wait for cards to actually appear (up to 10s)
            console.log(`${this.platform}: ⏳ Waiting for cards to appear...`);
            let cardsLoaded = false;
            for (let attempt = 0; attempt < 10; attempt++) {
              await new Promise(r => setTimeout(r, 1000));
              const cardCount = await this.page.evaluate(() => {
                return document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC').length;
              });
              
              if (cardCount > 0) {
                console.log(`${this.platform}: ✅ ${cardCount} cards loaded after ${attempt + 1}s`);
                cardsLoaded = true;
                break;
              }
            }
            
            if (!cardsLoaded) {
              console.log(`${this.platform}: ⚠️ No cards appeared after 10s`);
            }
            
            // Mirror to webview
            this.mirrorToWebview(this.baseUrl);
            
            // Card was already removed at the beginning (quick action)
            console.log(`${this.platform}: ℹ️ Card already removed from feed (clicked immediately after opening)`);
            
          } catch (navError) {
            console.log(`${this.platform}: ⚠️ Navigation error: ${navError.message}`);
          }
          
          // ⚡ Navigate back to Jobright job list for next iteration
          try {
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Back on job list`);
          } catch (navErr) {
            console.log(`${this.platform}: ⚠️ Navigation error: ${navErr.message}`);
          }
          
          // Skip to next job
          continue;
        }
        
        console.log(`${this.platform}: ✅ ✅ ✅ URL is safe (not Indeed/LinkedIn/Dice)`);
        
        // Step 3: Extract page content
        this.updateStatus(`[3/5] 📄 Extracting content...`, `Processed: ${totalProcessedCount}`);
        
        const quickContent = await newPage.evaluate(() => {
          return {
            title: document.title,
            bodyText: document.body ? document.body.innerText : '',
            html: document.body ? document.body.innerHTML : '',
            url: window.location.href
          };
        });
        
        console.log(`${this.platform}: 📄 Extracted content (${quickContent.bodyText?.length || 0} chars)`);
        
        // FAST CHECK: If content too small → skip immediately
        if (quickContent.bodyText?.length < 400) {
          console.log(`${this.platform}: ❌ Content too small (${quickContent.bodyText?.length} chars) - likely Cloudflare`);
          
          // Close tab
          try {
            await newPage.close();
            console.log(`${this.platform}: ✅ Tab closed`);
          } catch (closeErr) {
            console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
          }
          
          // Memory cleanup
          const pages = await this.browser.pages();
          if (pages.length > 1) {
            for (let i = 1; i < pages.length; i++) {
              try { await pages[i].close(); } catch (err) {}
            }
          }
          this.page = pages[0];
          
          // INSTANT MIRROR: Show Jobright.ai immediately
          this.mirrorToWebview(this.baseUrl);
          
          // Navigate back to job list
          console.log(`${this.platform}: Navigating back to job list...`);
          try {
            await this.page.goto(this.baseUrl, { 
              waitUntil: 'domcontentloaded', 
              timeout: 15000 
            });
            console.log(`${this.platform}: ✅ Back on job list page`);
            
            // REFRESH to ensure cards are loaded
            console.log(`${this.platform}: 🔄 Refreshing page to load cards...`);
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Page refreshed`);
            
            // Smart wait: Wait for cards to actually appear (up to 10s)
            console.log(`${this.platform}: ⏳ Waiting for cards to appear...`);
            let cardsLoaded = false;
            for (let attempt = 0; attempt < 10; attempt++) {
              await new Promise(r => setTimeout(r, 1000));
              const cardCount = await this.page.evaluate(() => {
                return document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC').length;
              });
              
              if (cardCount > 0) {
                console.log(`${this.platform}: ✅ ${cardCount} cards loaded after ${attempt + 1}s`);
                cardsLoaded = true;
                break;
              }
            }
            
            if (!cardsLoaded) {
              console.log(`${this.platform}: ⚠️ No cards appeared after 10s`);
            }
          } catch (navError) {
            console.log(`${this.platform}: ⚠️ Navigation error: ${navError.message}`);
          }
          
          this.mirrorToWebview(this.baseUrl);
          
          // Card was already removed at the beginning (quick action)
          console.log(`${this.platform}: ℹ️ Card already removed from feed (clicked immediately after opening)`);
          
          // ⚡ Navigate back to Jobright job list for next iteration
          try {
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Back on job list`);
          } catch (navErr) {
            console.log(`${this.platform}: ⚠️ Navigation error: ${navErr.message}`);
          }
          
          continue; // Skip to next job
        }
        
        // Step 4: Send to ChatGPT for analysis
        this.updateStatus(`[4/5] 🤖 Analyzing with ChatGPT...`, `Processed: ${totalProcessedCount}`);
        console.log(`${this.platform}: 📤 Sending to ChatGPT for COMBINED analysis...`);
        
        let gptResult = null;
        
        if (this.gptExtractor) {
          try {
            gptResult = await this.gptExtractor.extractJobData(
              quickContent,
              this.platform,
              finalJobUrl
            );
            
            if (gptResult) {
              console.log(`${this.platform}: ✅ ChatGPT analysis complete`);
            } else {
              console.log(`${this.platform}: ⚠️ ChatGPT returned null - Refreshing ChatGPT and retrying...`);
              
              // Refresh ChatGPT webview
              try {
                const { BrowserWindow } = require('electron');
                const mainWindow = BrowserWindow.getAllWindows()[0];
                if (mainWindow) {
                  mainWindow.webContents.send('refresh-chatgpt');
                  console.log(`${this.platform}: 🔄 Sent ChatGPT refresh command`);
                  
                  // Wait 3 seconds for ChatGPT to reload
                  await new Promise(r => setTimeout(r, 3000));
                  
                  // Retry once
                  console.log(`${this.platform}: 🔄 Retrying ChatGPT analysis...`);
                  gptResult = await this.gptExtractor.extractJobData(
                    quickContent,
                    this.platform,
                    finalJobUrl
                  );
                  
                  if (gptResult) {
                    console.log(`${this.platform}: ✅ ChatGPT analysis successful after refresh!`);
                  } else {
                    console.log(`${this.platform}: ⚠️ ChatGPT still failed - Using fallback`);
                  }
                }
              } catch (refreshErr) {
                console.log(`${this.platform}: ⚠️ Error refreshing ChatGPT: ${refreshErr.message}`);
              }
            }
            
            // Check if scraper was stopped during ChatGPT analysis
            if (!this.isRunning) {
              console.log(`${this.platform}: 🛑 Scraper stopped by user during analysis`);
              
              // Clean up tab
              try {
                await newPage.close();
                console.log(`${this.platform}: ✅ Tab closed`);
              } catch (closeErr) {
                console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
              }
              
              // Memory cleanup - close ALL extra pages
              const pages = await this.browser.pages();
              if (pages.length > 1) {
                for (let i = 1; i < pages.length; i++) {
                  try { await pages[i].close(); } catch (err) {}
                }
              }
              
              break;
            }
          } catch (gptError) {
            console.log(`${this.platform}: ⚠️ ChatGPT error: ${gptError.message}`);
          }
        }
        
        // Fallback if ChatGPT fails
        if (!gptResult) {
          console.log(`${this.platform}: Using basic extraction`);
          gptResult = {
            isVerificationPage: false,
            company: jobCard.company,
            title: jobCard.title,
            isRemote: true,
            isOnsite: false,
            isHybrid: false,
            isStartup: false,
            location: 'United States',
            salary: null,
            techStack: null
          };
        }

        // CHECK: Is this a verification page?
        if (gptResult.isVerificationPage) {
          console.log(`${this.platform}: ❌ ChatGPT confirmed: Verification page - SKIPPING`);
          
          // Close tab and go back
          try {
            await newPage.close();
            console.log(`${this.platform}: ✅ Tab closed`);
          } catch (closeErr) {
            console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
          }
          
          // Memory cleanup
          const pages = await this.browser.pages();
          if (pages.length > 1) {
            for (let i = 1; i < pages.length; i++) {
              try { await pages[i].close(); } catch (err) {}
            }
          }
          this.page = pages[0];
          
          // INSTANT MIRROR: Show Jobright.ai immediately
          this.mirrorToWebview(this.baseUrl);
          
          await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          console.log(`${this.platform}: ✅ Back on job list`);
          
          // Refresh and wait for cards
          console.log(`${this.platform}: 🔄 Refreshing page...`);
          await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
          
          console.log(`${this.platform}: ⏳ Waiting for cards...`);
          for (let attempt = 0; attempt < 10; attempt++) {
            await new Promise(r => setTimeout(r, 1000));
            const cardCount = await this.page.evaluate(() => document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC').length);
            if (cardCount > 0) {
              console.log(`${this.platform}: ✅ ${cardCount} cards loaded`);
              break;
            }
          }
          
          this.mirrorToWebview(this.baseUrl);
          
          // Click "Not Interested"
          console.log(`${this.platform}: 🚀 Clicking "Not Interested" button...`);
          try {
            // Highlight
            await this.page.evaluate((company, title) => {
              const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
              for (const card of cards) {
                const companyEl = card.querySelector('div.index_company-name__gKiOY');
                const titleEl = card.querySelector('h2.index_job-title__UjuEY');
                if (companyEl?.textContent?.trim() === company && titleEl?.textContent?.trim() === title) {
                  card.style.border = '4px solid #ff0000';
                  card.style.backgroundColor = '#ffe6e6';
                  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }
            }, jobCard.company, jobCard.title);
            
            console.log(`${this.platform}: 👀 Showing for 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            
            // Click
            const clicked = await this.page.evaluate((company, title) => {
              const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
              for (const card of cards) {
                const companyEl = card.querySelector('div.index_company-name__gKiOY');
                const titleEl = card.querySelector('h2.index_job-title__UjuEY');
                if (companyEl?.textContent?.trim() === company && titleEl?.textContent?.trim() === title) {
                  const dislikeBtn = card.querySelector('button#index_not-interest-button__9OtWF');
                  if (dislikeBtn) {
                    dislikeBtn.click();
                    return true;
                  }
                }
              }
              return false;
            }, jobCard.company, jobCard.title);
            
            if (clicked) {
              console.log(`${this.platform}: ✅ Clicked "Not Interested" button`);
              
              // Wait for modal and submit reason
              console.log(`${this.platform}: ⏳ Waiting for reason modal...`);
              await new Promise(r => setTimeout(r, 1000));
              
              const submitted = await this.page.evaluate(() => {
                const radio = document.querySelector('input.ant-radio-input[value="2"]');
                if (radio) radio.click();
                return new Promise(resolve => {
                  setTimeout(() => {
                    const submitBtn = document.querySelector('button.index_not-interest-popup-button-submit__x6ojj');
                    if (submitBtn && !submitBtn.disabled) {
                      submitBtn.click();
                      resolve(true);
                    } else {
                      resolve(false);
                    }
                  }, 500);
                });
              });
              
              if (submitted) {
                console.log(`${this.platform}: ✅ Submitted - waiting for card to disappear...`);
                await this.randomDelay(3000, 4000);
              } else {
                await new Promise(r => setTimeout(r, 3000));
              }
            }
          } catch (err) {
            console.log(`${this.platform}: ⚠️ Error: ${err.message}`);
          }
          
          continue;
        }
        
        console.log(`${this.platform}: ✅ Real job page confirmed`);

        if (gptResult) {
          // Check if job should be filtered out
          let shouldSkip = false;
          
          if (gptResult.isSoftwareJob === false) {
            console.log(`${this.platform}: ⚠️ Skipping - Not a software/tech job`);
            shouldSkip = true;
          } else if (gptResult.isOnsite || gptResult.isHybrid) {
            console.log(`${this.platform}: ⚠️ Skipping - Job is onsite/hybrid`);
            shouldSkip = true;
          } else if (gptResult.platform && ['indeed', 'linkedin', 'dice'].includes(gptResult.platform.toLowerCase())) {
            console.log(`${this.platform}: ⚠️ Skipping - Job is from ${gptResult.platform} (blocked platform)`);
            shouldSkip = true;
          } else {
            // Check salary requirements (using cached settings from batch start)
            const salaryComparator = require(path.join(__dirname, '../../utils/salaryComparator'));
            const salaryCheck = salaryComparator.compareToMinimum(gptResult.salary, this.currentSalarySettings);
            console.log(`${this.platform}: 💰 Salary check: ${salaryCheck.reason}`);
            
            if (!salaryCheck.meetsRequirement) {
              console.log(`${this.platform}: ⚠️ Skipping - Salary below minimum requirement`);
              shouldSkip = true;
            }
          }
          
          if (shouldSkip) {
            // FAST METHOD: Click "Not Interested" button to remove card
            console.log(`${this.platform}: 🚀 Using FAST method - clicking "Not Interested" button`);
            
            // Determine skip reason
            let skipReason = 'Filtered';
            if (gptResult.isSoftwareJob === false) {
              skipReason = 'Not software/tech job';
            } else if (gptResult.isOnsite || gptResult.isHybrid) {
              skipReason = gptResult.isOnsite ? 'Onsite' : 'Hybrid';
            } else if (gptResult.platform && ['indeed', 'linkedin', 'dice'].includes(gptResult.platform.toLowerCase())) {
              skipReason = `Blocked: ${gptResult.platform}`;
            } else {
              // Must be salary-based skip
              skipReason = 'Salary below minimum';
            }
            
            // Save job to database as "applied by Bot"
            try {
              const skippedJob = {
                company: jobCard.company,
                title: jobCard.title,
                url: finalJobUrl,
                is_remote: gptResult.isRemote,
                is_startup: gptResult.isStartup,
                salary: `Skipped: ${skipReason}`,
                tech_stack: gptResult.techStack,
                location: gptResult.location
              };
              
              const saved = this.saveJob(skippedJob);
              if (saved) {
                // Mark as applied by Bot
                const jobs = this.db.getAllJobs();
                const savedJob = jobs.find(j => j.url === finalJobUrl);
                if (savedJob) {
                  this.db.updateJobAppliedStatus(savedJob.id, true, 'Bot');
                  console.log(`${this.platform}: 💾 Saved and marked as applied by Bot (Reason: ${skipReason})`);
                }
              }
            } catch (saveErr) {
              console.log(`${this.platform}: ⚠️ Error saving skipped job: ${saveErr.message}`);
            }
            
            // Close the job tab first
            try {
              await newPage.close();
              console.log(`${this.platform}: ✅ Tab closed`);
            } catch (closeErr) {
              console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
            }
            
            // Memory cleanup
            const pages = await this.browser.pages();
            if (pages.length > 1) {
              for (let i = 1; i < pages.length; i++) {
                try { await pages[i].close(); } catch (err) {}
              }
            }
            this.page = pages[0];
            
            // INSTANT MIRROR: Show Jobright.ai immediately
            this.mirrorToWebview(this.baseUrl);
            
            // Navigate back to job list
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            console.log(`${this.platform}: ✅ Back on job list`);
            
            // REFRESH to ensure cards are loaded
            console.log(`${this.platform}: 🔄 Refreshing page to load cards...`);
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Page refreshed`);
            
            // Smart wait: Wait for cards to actually appear (up to 10s)
            console.log(`${this.platform}: ⏳ Waiting for cards to appear...`);
            let cardsLoaded = false;
            for (let attempt = 0; attempt < 10; attempt++) {
              await new Promise(r => setTimeout(r, 1000));
              const cardCount = await this.page.evaluate(() => {
                return document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC').length;
              });
              
              if (cardCount > 0) {
                console.log(`${this.platform}: ✅ ${cardCount} cards loaded after ${attempt + 1}s`);
                cardsLoaded = true;
                break;
              }
            }
            
            if (!cardsLoaded) {
              console.log(`${this.platform}: ⚠️ No cards appeared after 10s`);
            }
            
            this.mirrorToWebview(this.baseUrl);
            
            // Card was already removed at the beginning (quick action)
            console.log(`${this.platform}: ℹ️ Card already removed from feed (clicked immediately after opening)`);
            
            // ⚡ Navigate back to Jobright job list for next iteration
            try {
              await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
              console.log(`${this.platform}: ✅ Back on job list`);
            } catch (navErr) {
              console.log(`${this.platform}: ⚠️ Navigation error: ${navErr.message}`);
            }
            
            continue; // Skip to next job
          } else {
            // Step 5: Save job
            this.updateStatus(`[5/5] 💾 Saving job to database...`, `Processed: ${totalProcessedCount}`);
            
            // Save job - Use Jobright card data for company/title, ChatGPT for other fields
            const saved = this.saveJob({
              company: jobCard.company,  // Always use card data
              title: jobCard.title,      // Always use card data
              url: finalJobUrl,
              is_remote: gptResult.isRemote,
              is_startup: gptResult.isStartup,
              location: gptResult.location || 'United States',
              salary: gptResult.salary,
              tech_stack: gptResult.techStack,
              job_type: gptResult.jobType,
              industry: gptResult.industry
            });

            if (saved) {
              newJobsCount++;
              console.log(`${this.platform}: ✅ Saved job - ${jobCard.company} - ${jobCard.title}`);
              
              // Send toast notification and update job count
              const path = require('path');
              const { getMainWindow } = require(path.join(__dirname, '../../windowManager'));
              const mainWindow = getMainWindow();
              if (mainWindow) {
                mainWindow.webContents.send('new-job-found', {
                  company: jobCard.company,
                  title: jobCard.title,
                  platform: this.platform
                });
                
                // Update today's count
                const todayJobs = this.db.getJobsToday();
                mainWindow.webContents.send('update-today-count', todayJobs.length);
              }
            } else {
              console.log(`${this.platform}: ℹ️ DUPLICATE - Already in database: ${jobCard.company} - ${jobCard.title}`);
            }
            
            // Card was already removed at the beginning (quick action)
            console.log(`${this.platform}: ℹ️ Card already removed from feed (clicked immediately after opening)`);
            
            // Close the job tab and ensure cleanup
            try {
              await newPage.close();
              console.log(`${this.platform}: ✅ Tab closed successfully`);
            } catch (closeErr) {
              console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
            }
            
            // Get all pages and close any extra ones (memory cleanup)
            const pages = await this.browser.pages();
            console.log(`${this.platform}: 📊 Total open pages: ${pages.length}`);
            
            // Close any extra pages (should only have 1 - the main Jobright page)
            if (pages.length > 1) {
              for (let i = 1; i < pages.length; i++) {
                try {
                  await pages[i].close();
                  console.log(`${this.platform}: 🧹 Closed extra page ${i}`);
                } catch (err) {
                  // Ignore
                }
              }
            }
            
            this.page = pages[0];
            
            // ⚡ Navigate back to Jobright job list for next iteration
            try {
              await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
              console.log(`${this.platform}: ✅ Back on job list`);
            } catch (navErr) {
              console.log(`${this.platform}: ⚠️ Navigation error: ${navErr.message}`);
            }
            
            // INSTANT MIRROR: Show Jobright.ai immediately
            this.mirrorToWebview(this.baseUrl);
            
            continue; // Skip to next job
          }
        }

      } catch (processError) {
        console.error(`${this.platform}: ❌ Error processing job:`, processError.message);
        
        // Report bug
        this.reportBug('Processing Error', processError.message, {
          company: jobCard?.company || 'Unknown',
          title: jobCard?.title || 'Unknown',
          url: this.page?.url() || 'Unknown'
        });
        
        // Try to recover and continue
        try {
          if (!this.page || this.page.isClosed()) {
            const pages = await this.browser.pages();
            this.page = pages[0];
          }
          await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await this.randomDelay(1500, 2000);
        } catch (recoverErr) {
          console.error(`${this.platform}: ❌ Failed to recover, stopping...`);
          break;
        }
      }
      
      // After processing each job: Scroll periodically to load more cards
      scrollAttempts++;
      if (scrollAttempts >= 5) {
        console.log(`${this.platform}: 📜 Scrolling to load more cards (every 5 jobs)...`);
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await this.randomDelay(1500, 2000);
        scrollAttempts = 0; // Reset counter
      }
      
      // Periodic memory cleanup (every 20 jobs)
      if (totalProcessedCount % 20 === 0) {
        try {
          const pages = await this.browser.pages();
          if (pages.length > 1) {
            console.log(`${this.platform}: 🧹 Memory cleanup - closing ${pages.length - 1} orphaned page(s)...`);
            for (let i = 1; i < pages.length; i++) {
              try {
                await pages[i].close();
              } catch (err) {
                // Ignore
              }
            }
          }
          
          // Trigger garbage collection
          if (global.gc) {
            global.gc();
            console.log(`${this.platform}: 🧹 Garbage collected`);
          }
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
        
        // Show progress summary
        console.log(`\n${this.platform}: ═══════════════════════════════════════════`);
        console.log(`${this.platform}: 📊 PROGRESS UPDATE`);
        console.log(`${this.platform}: ═══════════════════════════════════════════`);
        console.log(`${this.platform}: ✅ Total jobs processed: ${totalProcessedCount}`);
        console.log(`${this.platform}: 💼 New jobs found: ${newJobsCount}`);
        console.log(`${this.platform}: ═══════════════════════════════════════════\n`);
      }
      
      // Continue to next job (list will be refreshed at start of loop)
    } // End of while loop

    } catch (error) {
      console.error(`${this.platform}: Scraping error:`, error.message);
    } finally {
      await this.closeBrowser();
      this.isRunning = false;
    }

    return newJobsCount;
  }

  // Send job content to ChatGPT and extract detailed info
  async sendToGPTAndExtract(jobContent, company, title) {
    try {
      const path = require('path');
      const { getMainWindow } = require(path.join(__dirname, '../../windowManager'));
      const mainWindow = getMainWindow();
      
      if (!mainWindow) {
        console.log(`${this.platform}: Main window not available for GPT`);
        return null;
      }

      console.log(`${this.platform}: 🤖 Preparing ChatGPT extraction...`);
      console.log(`${this.platform}: Job URL: ${jobContent.url}`);
      console.log(`${this.platform}: Page title: ${jobContent.title}`);

      // Create detailed prompt for GPT
      const prompt = `Analyze this job posting and extract detailed information:

Job Title: ${title}
Company: ${company}
URL: ${jobContent.url}

Page Content:
${jobContent.bodyText.substring(0, 3000)}

Please extract and provide in JSON format:
1. Company name (verify/correct if needed)
2. Job title (verify/correct if needed)
3. Salary range (if mentioned, or "Not specified")
4. Tech stack/technologies (comma-separated list)
5. Location (city, state, or "Remote")
6. Work type: Is it "Fully Remote", "Hybrid", or "Onsite"?
7. Is it a startup? (yes/no)
8. Platform source (check if job redirects to Indeed, LinkedIn, or Dice)
9. Any other relevant details

IMPORTANT: 
- If work type is Hybrid or Onsite, mark as "skip"
- If platform source is Indeed, LinkedIn, or Dice, mark as "skip"
- For tech stack, list all mentioned technologies
- Google the company name if needed to verify startup status

Format response as JSON.`;

      // Step 1: Click "New chat" button in ChatGPT
      console.log(`${this.platform}: Starting new ChatGPT conversation...`);
      const newChatClicked = await mainWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const iframe = document.querySelector('webview#chatgptView');
          if (!iframe) {
            resolve(false);
            return;
          }
          
          iframe.executeJavaScript(\`
            (function() {
              const newChatBtn = document.querySelector('[data-testid="create-new-chat-button"]');
              if (newChatBtn) {
                newChatBtn.click();
                return true;
              }
              return false;
            })();
          \`).then(result => resolve(result));
        });
      `);

      if (!newChatClicked) {
        console.log(`${this.platform}: ⚠️ ChatGPT new chat button not found, may need refresh`);
        return null;
      }

      await this.randomDelay(2000, 3000); // Duration: 2-3 seconds - Wait for new chat form

      // Step 2: Input prompt into ChatGPT
      console.log(`${this.platform}: Typing prompt into ChatGPT...`);
      await mainWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const iframe = document.querySelector('webview#chatgptView');
          if (!iframe) {
            resolve(false);
            return;
          }
          
          iframe.executeJavaScript(\`
            (function() {
              const inputArea = document.querySelector('div#prompt-textarea[contenteditable="true"]');
              if (inputArea) {
                const p = inputArea.querySelector('p');
                if (p) {
                  p.textContent = ${JSON.stringify(prompt)};
                  return true;
                }
              }
              return false;
            })();
          \`).then(result => resolve(result));
        });
      `);

      await this.randomDelay(2000, 3000); // Duration: 2-3 seconds - Let text appear

      // Step 3: Click send button
      console.log(`${this.platform}: Clicking send button...`);
      await mainWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const iframe = document.querySelector('webview#chatgptView');
          if (!iframe) {
            resolve(false);
            return;
          }
          
          iframe.executeJavaScript(\`
            (function() {
              const sendBtn = document.querySelector('#composer-submit-button');
              if (sendBtn) {
                sendBtn.click();
                return true;
              }
              return false;
            })();
          \`).then(result => resolve(result));
        });
      `);

      // Step 4: Wait for GPT response
      console.log(`${this.platform}: ⏳ Waiting for ChatGPT response...`);
      await this.randomDelay(10000, 15000); // Duration: 10-15 seconds - Wait for GPT to respond

      // Step 5: Extract GPT response
      console.log(`${this.platform}: Extracting GPT response...`);
      const gptResponse = await mainWindow.webContents.executeJavaScript(`
        new Promise((resolve) => {
          const iframe = document.querySelector('webview#chatgptView');
          if (!iframe) {
            resolve(null);
            return;
          }
          
          iframe.executeJavaScript(\`
            (function() {
              const messages = document.querySelectorAll('div[data-message-author-role="assistant"]');
              if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                const markdown = lastMessage.querySelector('.markdown');
                return markdown ? markdown.innerText : null;
              }
              return null;
            })();
          \`).then(result => resolve(result));
        });
      `);

      if (gptResponse) {
        console.log(`${this.platform}: ✅ Got ChatGPT response (${gptResponse.length} chars)`);
        
        // Parse GPT response
        try {
          // Try to extract JSON from response
          const jsonMatch = gptResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            
            // Check work_type and location for remote keywords
            const workType = data.work_type?.toLowerCase() || '';
            const location = data.location?.toLowerCase() || '';
            
            const isRemoteFromWorkType = workType.includes('remote') && 
                                        !workType.includes('hybrid') && 
                                        !workType.includes('onsite');
            const isRemoteFromLocation = location.includes('remote') && 
                                        !location.includes('hybrid') && 
                                        !location.includes('onsite');
            
            return {
              company: data.company || company,
              title: data.title || title,
              salary: data.salary || null,
              techStack: data.tech_stack || data.techStack || null,
              location: data.location || 'Remote',
              isRemote: isRemoteFromWorkType || isRemoteFromLocation || data.isRemote,
              isOnsite: workType.includes('onsite') || location.includes('onsite'),
              isHybrid: workType.includes('hybrid') || location.includes('hybrid'),
              isStartup: data.is_startup === 'yes' || data.isStartup === true,
              platform: data.platform || data.source || null
            };
          } else {
            console.log(`${this.platform}: ⚠️ GPT response not in JSON format, parsing text...`);
            
            // Fallback: Extract from text response
            return {
              company: company,
              title: title,
              isRemote: gptResponse.toLowerCase().includes('remote') && !gptResponse.toLowerCase().includes('hybrid'),
              isOnsite: gptResponse.toLowerCase().includes('onsite'),
              isHybrid: gptResponse.toLowerCase().includes('hybrid'),
              location: 'Remote',
              salary: null,
              techStack: null,
              isStartup: false,
              platform: null
            };
          }
        } catch (parseError) {
          console.error(`${this.platform}: Error parsing GPT response:`, parseError.message);
          return null;
        }
      } else {
        console.log(`${this.platform}: ⚠️ No ChatGPT response, ChatGPT may need refresh`);
        
        // Try to refresh ChatGPT
        console.log(`${this.platform}: Refreshing ChatGPT...`);
        mainWindow.webContents.send('refresh-chatgpt-view');
        await this.randomDelay(5000, 7000); // Duration: 5-7 seconds - Wait for refresh
        
        return null;
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

module.exports = JobrightScraper;
