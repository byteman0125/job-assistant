const BaseScraper = require('../baseScraper');
const path = require('path');
const { BrowserWindow } = require('electron');

class JobrightScraper extends BaseScraper {
  constructor(database, gptExtractor) {
    super(database, 'Jobright', gptExtractor);
    this.baseUrl = 'https://jobright.ai/jobs/recommend';
    this.currentSalarySettings = null; // Cache salary settings per batch
  }
  
  getBaseDomain() {
    return 'jobright.ai';
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

  // Helper: Check salary from job card text
  checkSalaryFromCard(salaryText) {
    try {
      // Parse salary text like "$175K/yr - $210K/yr", "$120K", "120000/year", etc.
      const minSalary = this.currentSalarySettings?.annual || 120000;
      
      if (!salaryText || salaryText === 'Unknown') {
        return { meetsRequirement: true, reason: 'No salary info to check' };
      }
      
      console.log(`${this.platform}: 🔍 Parsing salary: "${salaryText}"`);
      
      // Extract all numbers from salary text
      const numbers = salaryText.match(/\d+/g);
      if (!numbers || numbers.length === 0) {
        return { meetsRequirement: true, reason: 'Could not parse salary - will check later' };
      }
      
      // Determine if it's annual, monthly, or hourly
      const isAnnual = salaryText.toLowerCase().includes('/yr') || 
                      salaryText.toLowerCase().includes('year') ||
                      salaryText.toLowerCase().includes('annual') ||
                      (!salaryText.toLowerCase().includes('/mo') && !salaryText.toLowerCase().includes('/hr'));
      const isMonthly = salaryText.toLowerCase().includes('/mo') || salaryText.toLowerCase().includes('month');
      const isHourly = salaryText.toLowerCase().includes('/hr') || salaryText.toLowerCase().includes('hour');
      
      // Convert to annual salary for comparison
      let annualSalaries = [];
      
      for (const numStr of numbers) {
        let num = parseInt(numStr);
        
        // Handle K notation (e.g., "175K" = 175000)
        if (salaryText.includes('K') || salaryText.includes('k')) {
          num = num * 1000;
        }
        
        // Convert to annual
        if (isMonthly) {
          num = num * 12;
        } else if (isHourly) {
          num = num * 2080; // 40 hours/week * 52 weeks
        }
        
        annualSalaries.push(num);
      }
      
      // Get maximum salary from range (e.g., "$120K - $150K" → use 150K)
      const maxSalary = Math.max(...annualSalaries);
      
      console.log(`${this.platform}: 💵 Parsed max annual salary: $${maxSalary.toLocaleString()}`);
      console.log(`${this.platform}: 📊 Minimum required: $${minSalary.toLocaleString()}`);
      
      const meetsRequirement = maxSalary >= minSalary;
      
      return {
        meetsRequirement,
        reason: meetsRequirement 
          ? `Salary $${maxSalary.toLocaleString()} >= $${minSalary.toLocaleString()}`
          : `Salary $${maxSalary.toLocaleString()} < $${minSalary.toLocaleString()}`
      };
    } catch (error) {
      console.error(`${this.platform}: ⚠️ Error parsing salary:`, error.message);
      return { meetsRequirement: true, reason: 'Error parsing - will check later' };
    }
  }

  // Helper: Check if location is in USA (pattern-based, no GPT needed)
  checkIfUSALocation(location) {
    try {
      if (!location || location === 'Unknown') {
        console.log(`${this.platform}: ⚠️ Unknown location - assuming USA`);
        return true; // If location is unknown, proceed (might be remote)
      }
      
      // USA indicators and state abbreviations
      const usaIndicators = [
        'USA', 'U.S.A', 'U.S', 'US', 'United States', 'America',
        // Common US state abbreviations
        'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
        'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
        'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
        'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
        'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
      ];
      
      // Check if location contains USA indicators
      const locationUpper = location.toUpperCase();
      const hasUSAIndicator = usaIndicators.some(indicator => {
        // Check for state abbreviations (must be at word boundary or after comma)
        if (indicator.length === 2) {
          return locationUpper.match(new RegExp(`\\b${indicator}\\b|,\\s*${indicator}\\b`));
        }
        return locationUpper.includes(indicator);
      });
      
      if (hasUSAIndicator) {
        console.log(`${this.platform}: ✅ USA location detected (contains USA indicator)`);
        return true;
      }
      
      // Check for non-USA indicators
      const nonUSAIndicators = [
        'CANADA', 'TORONTO', 'VANCOUVER', 'MONTREAL', 'OTTAWA',
        'UK', 'LONDON', 'MANCHESTER', 'EDINBURGH',
        'GERMANY', 'BERLIN', 'MUNICH',
        'FRANCE', 'PARIS',
        'INDIA', 'BANGALORE', 'MUMBAI', 'DELHI',
        'AUSTRALIA', 'SYDNEY', 'MELBOURNE',
        'WORLDWIDE', 'GLOBAL', 'INTERNATIONAL'
      ];
      
      const hasNonUSAIndicator = nonUSAIndicators.some(indicator => 
        locationUpper.includes(indicator)
      );
      
      if (hasNonUSAIndicator) {
        console.log(`${this.platform}: ❌ Non-USA location detected: "${location}"`);
        return false;
      }
      
      // Default: if ambiguous, assume USA (false negatives are worse than false positives)
      console.log(`${this.platform}: ⚠️ Ambiguous location "${location}" - assuming USA`);
      return true;
    } catch (error) {
      console.error(`${this.platform}: ⚠️ Error checking USA location:`, error.message);
      // On error, assume USA to avoid false negatives
      return true;
    }
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
      
      console.log(`${this.platform}: 🖱️ Clicking "More Options" button to open dropdown... [PRIMARY FILTER]`);
      const clicked = await this.page.evaluate((company, title) => {
        const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
        console.log(`🔍 [PRIMARY] Found ${cards.length} job cards on page`);
        
        for (const card of cards) {
          const companyEl = card.querySelector('div.index_company-name__gKiOY');
          const titleEl = card.querySelector('h2.index_job-title__UjuEY');
          if (companyEl?.textContent?.trim() === company && titleEl?.textContent?.trim() === title) {
            console.log(`✅ [PRIMARY] Found matching card: "${company}" - "${title}"`);
            
            // Find "More Options" button - ENHANCED SEARCH
            console.log('🔍 [PRIMARY] Searching for "More Options" button...');
            
            let moreBtn = card.querySelector('img[alt="more-options"]');
            console.log(`   ✓ img[alt="more-options"]: ${moreBtn ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
            
            if (!moreBtn) {
              moreBtn = card.querySelector('[class*="job-more-button"]');
              console.log(`   ✓ [class*="job-more-button"]: ${moreBtn ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
              if (moreBtn) {
                const img = moreBtn.querySelector('img');
                if (img) {
                  console.log(`      → Found img inside container`);
                  moreBtn = img;
                }
              }
            }
            
            if (!moreBtn) {
              moreBtn = card.querySelector('.ant-dropdown-trigger');
              console.log(`   ✓ .ant-dropdown-trigger: ${moreBtn ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
            }
            
            if (!moreBtn) {
              const allImgs = card.querySelectorAll('img');
              for (const img of allImgs) {
                if (img.src && img.src.includes('more')) {
                  moreBtn = img;
                  console.log(`   ✓ img with "more" in src: FOUND ✅ (${img.src})`);
                  break;
                }
              }
              if (!moreBtn) {
                console.log(`   ✓ img with "more" in src: NOT FOUND ❌`);
              }
            }
            
            if (moreBtn) {
              console.log(`✅ [PRIMARY] FINAL: Found "More Options" button!`);
              console.log(`   Tag: ${moreBtn.tagName}`);
              console.log(`   Alt: ${moreBtn.alt || 'N/A'}`);
              console.log(`   Src: ${moreBtn.src || 'N/A'}`);
              console.log(`   Class: ${moreBtn.className}`);
              
              // Click the IMG directly
              const clickTarget = moreBtn;
              console.log(`🖱️ [PRIMARY] Clicking IMG element directly...`);
              
              const rect = clickTarget.getBoundingClientRect();
              const x = rect.left + rect.width / 2;
              const y = rect.top + rect.height / 2;
              console.log(`   Click coordinates: (${x}, ${y})`);
              
              ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                const event = new MouseEvent(eventType, {
                  view: window,
                  bubbles: true,
                  cancelable: true,
                  clientX: x,
                  clientY: y,
                  button: 0
                });
                clickTarget.dispatchEvent(event);
              });
              
              return true;
            } else {
              console.log('❌ [PRIMARY] "More Options" button not found after ALL attempts');
              
              const allButtons = card.querySelectorAll('button');
              const allImgs = card.querySelectorAll('img');
              const allDivs = card.querySelectorAll('div[class*="dropdown"]');
              
              console.log(`📊 [PRIMARY] Card debugging:`);
              console.log(`   Total buttons: ${allButtons.length}`);
              console.log(`   Total images: ${allImgs.length}`);
              console.log(`   Divs with "dropdown": ${allDivs.length}`);
              
              console.log(`\n🖼️ [PRIMARY] All images in card:`);
              allImgs.forEach((img, idx) => {
                console.log(`   [${idx + 1}] alt="${img.alt || 'NONE'}", src="${img.src || 'NONE'}", class="${img.className || 'NONE'}"`);
              });
              
              console.log(`\n🔘 [PRIMARY] All buttons in card:`);
              allButtons.forEach((btn, idx) => {
                console.log(`   [${idx + 1}] id="${btn.id || 'NONE'}", class="${btn.className || 'NONE'}"`);
              });
              
              return false;
            }
          }
        }
        console.log('❌ [PRIMARY] Card not found');
        return false;
      }, jobCard.company, jobCard.title);
      
      if (!clicked) {
        console.log(`${this.platform}: ⚠️ More Options button not found - card may have been auto-removed`);
        return false;
      }
      
      console.log(`${this.platform}: ✅ Clicked "More Options" button`);
      
      // STEP 3: Handle modal OR dropdown menu [V2]
      console.log(`${this.platform}: ⏳ Waiting for UI to appear... [V2]`);
      await new Promise(r => setTimeout(r, 1500)); // Wait for modal/dropdown
      
      // FIRST: Check if dropdown exists
      console.log(`${this.platform}: 🔍 Checking for dropdown menu... [V2]`);
      const dropdownCheck = await this.page.evaluate(() => {
        const dropdownItems = document.querySelectorAll('.ant-dropdown-menu-item');
        return {
          exists: dropdownItems.length > 0,
          count: dropdownItems.length,
          items: Array.from(dropdownItems).map(item => ({
            text: item.textContent?.trim() || '',
            menuId: item.getAttribute('data-menu-id')
          }))
        };
      });
      
      console.log(`${this.platform}: 📋 Dropdown check: Found ${dropdownCheck.count} items`);
      
      // SCENARIO 1: Dropdown exists - use dropdown approach
      if (dropdownCheck.exists) {
        console.log(`${this.platform}: ✅ Dropdown menu detected!`);
        dropdownCheck.items.forEach((item, idx) => {
          console.log(`${this.platform}:   Item ${idx + 1}: "${item.text}" (id: ${item.menuId})`);
        });
        
        const dropdownClicked = await this.page.evaluate(() => {
          const dropdownItems = document.querySelectorAll('.ant-dropdown-menu-item');
          
          for (const item of dropdownItems) {
            const menuId = item.getAttribute('data-menu-id');
            const text = item.textContent?.trim() || '';
            
            // Look for "Already Applied" or menu ID containing "applied"
            if (text.includes('Already Applied') || (menuId && menuId.includes('applied'))) {
              console.log('✅ Clicking "Already Applied" option');
              item.click();
              return { success: true };
            }
          }
          
          console.log('❌ "Already Applied" option not found');
          return { success: false };
        });
        
        if (dropdownClicked.success) {
          console.log(`${this.platform}: ✅ Clicked "Already Applied" from dropdown`);
          console.log(`${this.platform}: ⏳ Waiting 2s...`);
          await new Promise(r => setTimeout(r, 2000));
          return true;
        } else {
          console.log(`${this.platform}: ⚠️ Could not click dropdown - continuing anyway`);
          await new Promise(r => setTimeout(r, 2000));
          return true;
        }
      }
      
      // SCENARIO 2: No dropdown - check for modal
      console.log(`${this.platform}: 📋 No dropdown found, checking for modal...`);
      const modalInfo = await this.page.evaluate(() => {
        const modal = document.querySelector('.ant-modal');
        const popup = document.querySelector('[class*="not-interest-popup"]');
        const radios = document.querySelectorAll('input.ant-radio-input');
        const submitBtn = document.querySelector('button.index_not-interest-popup-button-submit__x6ojj');
        
        return {
          modalVisible: !!modal || !!popup,
          radioCount: radios.length,
          submitButtonExists: !!submitBtn
        };
      });
      
      console.log(`${this.platform}: 📋 Modal check: visible=${modalInfo.modalVisible}, radios=${modalInfo.radioCount}`);
      
      // If no modal either, assume button worked directly
      if (!modalInfo.modalVisible || modalInfo.radioCount === 0) {
        console.log(`${this.platform}: ✅ No modal/dropdown needed - button click worked directly`);
        await new Promise(r => setTimeout(r, 2000));
        return true;
      }
      
      // SCENARIO 3: Modal with radio options (old UI)
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
        
        // Wait and verify card actually disappeared
        let disappeared = false;
        for (let i = 0; i < 5; i++) {
          await this.randomDelay(1000, 1500);
          
          // Check if card is gone
          const cardStillExists = await this.page.evaluate((company, title) => {
            const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
            for (const card of cards) {
              const companyEl = card.querySelector('div.index_company-name__gKiOY');
              const titleEl = card.querySelector('h2.index_job-title__UjuEY');
              if (companyEl?.textContent?.trim() === company && titleEl?.textContent?.trim() === title) {
                return true; // Card still exists
              }
            }
            return false; // Card is gone
          }, jobCard.company, jobCard.title);
          
          if (!cardStillExists) {
            console.log(`${this.platform}: ✅ Card disappeared after ${i + 1}s`);
            disappeared = true;
            break;
          }
        }
        
        if (!disappeared) {
          console.log(`${this.platform}: ⚠️ Card didn't disappear after 5s - forcing page refresh`);
          await this.page.reload({ waitUntil: 'networkidle2' });
          await this.randomDelay(2000, 3000);
        }
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
      // If rate limited or login required, rotate cookie set (if available)
      try {
        for (let attempt = 0; attempt < 3; attempt++) {
          const limited = await this.page.evaluate(() => {
            const text = document.body.innerText || '';
            const signals = [
              'too many requests',
              'rate limit',
              'verify you are human',
              'captcha',
              'access denied',
              'sign in',
              'log in'
            ];
            return signals.some(s => text.toLowerCase().includes(s));
          });
          if (!limited) break;
          console.log(`${this.platform}: ⚠️ Detected limitation/login page. Rotating cookie set...`);
          const nextSet = this.db.rotateCookieSet(this.platform);
          if (!nextSet) { console.log(`${this.platform}: ❌ No alternate cookie sets available`); break; }
          // Clear existing cookies for domain and apply new set
          try {
            const client = await this.page.target().createCDPSession();
            await client.send('Network.clearBrowserCookies');
          } catch (_) {}
          const cookies = nextSet.cookies || [];
          if (cookies.length > 0) {
            await this.page.setCookie(...cookies.map(c => ({
              name: c.name,
              value: c.value,
              domain: c.domain || this.getBaseDomain(),
              path: c.path || '/',
              httpOnly: c.httpOnly || false,
              secure: c.secure !== false,
              expires: c.expirationDate || (Date.now() / 1000 + 86400 * 365)
            })));
          }
          console.log(`${this.platform}: 🔄 Reloading with rotated cookies...`);
          await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        }
      } catch (e) {
        console.log(`${this.platform}: ⚠️ Cookie rotation check failed: ${e.message}`);
      }
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
          // Try multiple container selectors (Jobright may update their HTML)
          let cards = [];
          
          // Method 1: Try with ant-list-items container
          const listContainer = document.querySelector('.ant-list-items');
          if (listContainer) {
            cards = Array.from(listContainer.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC'));
          }
          
          // Method 2: If no cards found, try direct query (container might have changed)
          if (cards.length === 0) {
            cards = Array.from(document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC'));
          }
          
          // Method 3: If still no cards, try alternative class names
          if (cards.length === 0) {
            cards = Array.from(document.querySelectorAll('[class*="job-card"]'));
          }
          
          console.log(`🔍 Found ${cards.length} potential job cards on page`);
          
          // Get only the FIRST card
          return cards.slice(0, 1).map((card, index) => {
            const titleEl = card.querySelector('h2.index_job-title__UjuEY') || card.querySelector('[class*="job-title"]');
            const companyEl = card.querySelector('div.index_company-name__gKiOY') || card.querySelector('[class*="company-name"]');
            const timeEl = card.querySelector('span.index_publish-time__cMfCi') || card.querySelector('[class*="publish-time"]');
            const applyBtn = card.querySelector('button.index_apply-button__kp79C') || card.querySelector('button[class*="apply-button"]');
            
            // Check button text to detect "DIRECT APPLY" (Easy Apply equivalent)
            const buttonText = applyBtn ? applyBtn.textContent.trim().toUpperCase() : '';
            const isDirectApply = buttonText.includes('DIRECT') || buttonText.includes('EASY');
            
            // Extract metadata: location, salary, and work type (Remote/Hybrid/Onsite)
            // Try multiple selectors for metadata items
            let metadataItems = card.querySelectorAll('.index_job-metadata-item__ThMv4');
            if (metadataItems.length === 0) {
              metadataItems = card.querySelectorAll('[class*="job-metadata-item"]');
            }
            if (metadataItems.length === 0) {
              metadataItems = card.querySelectorAll('.ant-col');
            }
            
            let jobLocation = 'Unknown';
            let salaryText = null;
            // Removed work location type parsing per requirement
            
            // Loop through metadata items to identify each by icon or content
            metadataItems.forEach((item) => {
              const img = item.querySelector('img');
              const iconAlt = img ? img.getAttribute('alt') : '';
              
              // Check for Remote/Hybrid/Onsite by keyword-highlight (it's inside keyword-highlight-container)
              const highlightEl = item.querySelector('.keyword-highlight');
              if (highlightEl) {
                const workTypeText = highlightEl.textContent.trim().toUpperCase();
                if (workTypeText === 'REMOTE' || workTypeText === 'HYBRID' || workTypeText === 'ONSITE') {
                  // skip: work location parsing not needed
                  return; // Found work type, skip other checks for this item
                }
              }
              
              // Get text from span (handle nested spans)
              const span = item.querySelector('span');
              if (!span) return;
              const text = span.textContent.trim();
              
              // Skip if this looks like work type but we didn't get highlight element
              if (text.toUpperCase().includes('REMOTE') || text.toUpperCase().includes('HYBRID') || text.toUpperCase().includes('ONSITE')) {
                // Extract work type from text as fallback
                // skip: work location parsing not needed
                return;
              }
              
              // Location: has 'position' icon
              if (iconAlt === 'position' || iconAlt === 'location') {
                jobLocation = text;
                return;
              }
              
              // Salary: contains $ or /yr or /hr or K with numbers
              if (text.includes('$') || text.includes('/yr') || text.includes('/hr') || (text.includes('K') && text.match(/\d/))) {
                salaryText = text;
                return;
              }
              
              // Fallback: if no icon matched and text looks like location (has comma or state)
              if ((text.includes(',') || text.match(/\b[A-Z]{2}\b/)) && jobLocation === 'Unknown') {
                jobLocation = text;
              }
            });
            
            // skip: work location flags not needed
            
            return {
              index: index,
              title: titleEl ? titleEl.textContent.trim() : null,
              company: companyEl ? companyEl.textContent.trim() : null,
              postedTime: timeEl ? timeEl.textContent.trim() : null,
              hasApplyButton: !!applyBtn,
              buttonText: buttonText,
              isDirectApply: isDirectApply,
              // work location fields removed
              location: jobLocation,
              salaryFromCard: salaryText
            };
          }).filter(job => job.title && job.company && job.hasApplyButton);
        });

        console.log(`${this.platform}: 📋 Cards in list: ${jobCards ? jobCards.length : 0}`);

      if (!jobCards || jobCards.length === 0) {
        consecutiveEmptyCount++;
        console.log(`${this.platform}: ⚠️ No job cards found (attempt ${consecutiveEmptyCount}/5)`);
        
        if (consecutiveEmptyCount >= 5) {
          // Before stopping, rotate through all available cookie sets to try recovering
          try {
            const sets = this.db.getCookieSets(this.platform) || [];
            if (sets.length > 1) {
              console.log(`${this.platform}: 🔄 No cards after 5 tries. Trying cookie set rotation across ${sets.length} set(s)...`);
              let recovered = false;
              for (let i = 0; i < sets.length; i++) {
                const next = this.db.rotateCookieSet(this.platform);
                if (!next) break;
                // Clear cookies and apply new set
                try {
                  const client = await this.page.target().createCDPSession();
                  await client.send('Network.clearBrowserCookies');
                } catch (_) {}
                // Clear persistent data and apply cookies
                const origin = 'https://jobright.ai';
                try { await client.send('Network.clearBrowserCache'); } catch (_) {}
                try { await client.send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' }); } catch (_) {}
                try {
                  await this.page.evaluate(async () => {
                    try { localStorage.clear(); } catch (e) {}
                    try { sessionStorage.clear(); } catch (e) {}
                    try {
                      const regs = await navigator.serviceWorker?.getRegistrations?.();
                      if (Array.isArray(regs)) { for (const r of regs) { try { await r.unregister(); } catch (e) {} } }
                    } catch (e) {}
                    try {
                      const keys = await caches?.keys?.();
                      if (Array.isArray(keys)) { for (const k of keys) { try { await caches.delete(k); } catch (e) {} } }
                    } catch (e) {}
                  });
                } catch (_) {}
                const cookies = next.cookies || [];
                if (cookies.length > 0) {
                  await this.page.setCookie(...cookies.map(c => ({
                    name: c.name,
                    value: c.value,
                    domain: c.domain || this.getBaseDomain(),
                    path: c.path || '/',
                    httpOnly: c.httpOnly || false,
                    secure: c.secure !== false,
                    expires: c.expirationDate || (Date.now() / 1000 + 86400 * 365)
                  })));
                }
                // Disable cache for next navigation and reload
                try { await this.page.setCacheEnabled(false); } catch (_) {}
                console.log(`${this.platform}: 🔁 Reloading page with rotated cookies (attempt ${i + 1}/${sets.length})...`);
                await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                try { await this.page.setCacheEnabled(true); } catch (_) {}
                await this.randomDelay(1500, 2000);
                // Quick check for cards
                const cardCount = await this.page.evaluate(() => {
                  const list = document.querySelector('.ant-list-items');
                  const cards = list ? list.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC') : document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
                  return cards ? cards.length : 0;
                });
                console.log(`${this.platform}: 🔎 Cards after rotation: ${cardCount}`);
                if (cardCount > 0) {
                  consecutiveEmptyCount = 0;
                  recovered = true;
                  break;
                }
              }
              if (recovered) {
                continue; // Resume main loop with new cookies
              }
            }
          } catch (e) {
            console.log(`${this.platform}: ⚠️ Rotation attempt failed: ${e.message}`);
          }

          console.log(`${this.platform}: ❌ No cards found after rotation attempts - stopping`);
          // Send warning to UI
          const path = require('path');
          const { getMainWindow } = require(path.join(__dirname, '../../windowManager'));
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('scraper-warning', {
              platform: this.platform,
              message: 'No job cards found. Tried rotating cookie sets; please update cookies.'
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
      
      // FAST-SKIP: If company shows aggregator like "Jobs via Dice", auto-mark applied and skip
      try {
        const companyLower = (jobCard.company || '').toLowerCase();
        if (companyLower.includes('jobs via dice')) {
          console.log(`${this.platform}: 🚫 Aggregator detected (Jobs via Dice) - auto-marking as applied and skipping`);
          this.sendSkipNotification(jobCard, 'Aggregator: Jobs via Dice');
          try {
            const aggJob = {
              company: jobCard.company,
              title: jobCard.title,
              url: this.baseUrl,
              is_remote: false,
              is_startup: false,
              salary: 'Skipped: Jobs via Dice',
              tech_stack: '',
              location: ''
            };
            const saved = this.saveJob(aggJob);
            if (saved) {
              const jobs = this.db.getAllJobs();
              const savedJob = jobs.find(j => j.company === jobCard.company);
              if (savedJob) {
                this.db.updateJobAppliedStatus(savedJob.id, true, 'Bot');
                console.log(`${this.platform}: 💾 Saved and marked as applied by Bot (aggregator)`);
              }
            }
          } catch (saveErr) {
            console.log(`${this.platform}: ⚠️ Error saving aggregator job: ${saveErr.message}`);
          }
          // Remove card from feed if possible
          try {
            await this.clickNotInterestedButton(jobCard);
          } catch (e) {}
          // Soft refresh to move on
          try { await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }); } catch (_) {}
          await this.randomDelay(800, 1200);
          continue;
        }
      } catch (_) {}
      
      // CHECK: Is this job older than 7 days?
      const isOld = this.isJobOlderThanOneDay(jobCard.postedTime);
      if (isOld) {
        consecutiveOldJobs++;
        console.log(`${this.platform}: ⏭️ SKIPPING OLD JOB (> 7 days old) [${consecutiveOldJobs}/10]`);
        console.log(`${this.platform}: Job: "${jobCard.title}"`);
        console.log(`${this.platform}: Posted: ${jobCard.postedTime}`);
        
        // Stop if we've seen 10 consecutive old jobs
        if (consecutiveOldJobs >= 10) {
          // Before exiting, rotate cookie sets to see if another account has fresh feed
          let rotatedFound = false;
          try {
            const sets = this.db.getCookieSets(this.platform) || [];
            if (sets.length > 1) {
              console.log(`${this.platform}: 🔄 10 old jobs in a row. Rotating cookie sets across ${sets.length} set(s)...`);
              for (let i = 0; i < sets.length; i++) {
                const next = this.db.rotateCookieSet(this.platform);
                if (!next) break;
                try {
                  const client = await this.page.target().createCDPSession();
                  await client.send('Network.clearBrowserCookies');
                } catch (_) {}
                const origin2 = 'https://jobright.ai';
                try { await client.send('Network.clearBrowserCache'); } catch (_) {}
                try { await client.send('Storage.clearDataForOrigin', { origin: origin2, storageTypes: 'all' }); } catch (_) {}
                try {
                  await this.page.evaluate(async () => {
                    try { localStorage.clear(); } catch (e) {}
                    try { sessionStorage.clear(); } catch (e) {}
                    try {
                      const regs = await navigator.serviceWorker?.getRegistrations?.();
                      if (Array.isArray(regs)) { for (const r of regs) { try { await r.unregister(); } catch (e) {} } }
                    } catch (e) {}
                    try {
                      const keys = await caches?.keys?.();
                      if (Array.isArray(keys)) { for (const k of keys) { try { await caches.delete(k); } catch (e) {} } }
                    } catch (e) {}
                  });
                } catch (_) {}
                const cookies = next.cookies || [];
                if (cookies.length > 0) {
                  await this.page.setCookie(...cookies.map(c => ({
                    name: c.name,
                    value: c.value,
                    domain: c.domain || this.getBaseDomain(),
                    path: c.path || '/',
                    httpOnly: c.httpOnly || false,
                    secure: c.secure !== false,
                    expires: c.expirationDate || (Date.now() / 1000 + 86400 * 365)
                  })));
                }
                try { await this.page.setCacheEnabled(false); } catch (_) {}
                console.log(`${this.platform}: 🔁 Reloading page with rotated cookies (attempt ${i + 1}/${sets.length})...`);
                await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                try { await this.page.setCacheEnabled(true); } catch (_) {}
                await this.randomDelay(1500, 2000);
                // Quick probe for a fresh-looking first card
                const hasAnyCard = await this.page.evaluate(() => {
                  const list = document.querySelector('.ant-list-items');
                  const cards = list ? list.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC') : document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
                  return (cards && cards.length > 0);
                });
                if (hasAnyCard) {
                  consecutiveOldJobs = 0;
                  rotatedFound = true;
                  break;
                }
              }
            }
          } catch (e) {
            console.log(`${this.platform}: ⚠️ Rotation attempt failed: ${e.message}`);
          }
          if (rotatedFound) {
            continue; // Resume with reset counters on new cookie set
          }
          console.log(`\n${this.platform}: ═══════════════════════════════════════════`);
          console.log(`${this.platform}: 🛑 STOPPING - Found 10 consecutive old jobs (after rotation attempts)`);
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
      
      // CHECK: Is this a "DIRECT APPLY" or "EASY APPLY" job? (We want to avoid these)
      if (jobCard.isDirectApply) {
        console.log(`${this.platform}: 🚫 SKIPPING - "DIRECT APPLY" or "EASY APPLY" job (button text: "${jobCard.buttonText}")`);
        console.log(`${this.platform}: These jobs use simplified application forms - avoiding as requested`);
        
        this.sendSkipNotification(jobCard, `Direct Apply - Button: "${jobCard.buttonText}"`);
        
        // Click "Not Interested" to remove it and reveal next card
        try {
          await this.clickNotInterestedButton(jobCard);
          console.log(`${this.platform}: ✅ Marked as "Not Interested" and removed from feed`);
        } catch (err) {
          console.log(`${this.platform}: ⚠️ Could not remove job: ${err.message}`);
        }
        
        // Refresh page after skip to ensure clean state
        console.log(`${this.platform}: 🔄 Refreshing page after skip...`);
        try {
          await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (reloadErr) {
          console.log(`${this.platform}: ⚠️ Page reload timeout - continuing anyway`);
        }
        await this.randomDelay(1000, 1500);
        continue; // Get next card from refreshed list
      }
      
      // CHECK: Work location type - Only process REMOTE jobs
      // skip: no work location logging

      // skip: no work location checks
      
      // CHECK: Job location - Must be USA
      console.log(`${this.platform}: 📍 Job Location: ${jobCard.location}`);
      
      const isUSALocation = this.checkIfUSALocation(jobCard.location);
      
      if (!isUSALocation) {
        console.log(`${this.platform}: 🚫 SKIPPING - Non-USA location: "${jobCard.location}"`);
        console.log(`${this.platform}: Job: "${jobCard.title}" at ${jobCard.company}`);
        
        this.sendSkipNotification(jobCard, `Non-USA Location: ${jobCard.location}`);
        
        // Click "Not Interested" to remove it and reveal next card
        try {
          await this.clickNotInterestedButton(jobCard);
          console.log(`${this.platform}: ✅ Marked as "Not Interested" and removed from feed`);
        } catch (err) {
          console.log(`${this.platform}: ⚠️ Could not remove job: ${err.message}`);
        }
        
        // Refresh page after skip to ensure clean state
        console.log(`${this.platform}: 🔄 Refreshing page after skip...`);
        try {
          await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (reloadErr) {
          console.log(`${this.platform}: ⚠️ Page reload timeout - continuing anyway`);
        }
        await this.randomDelay(1000, 1500);
        continue; // Get next card from refreshed list
      }
      
      console.log(`${this.platform}: ✅ USA location confirmed - Will process this job`);
      
      // CHECK: Primary salary check from job card (if available)
      if (jobCard.salaryFromCard) {
        console.log(`${this.platform}: 💰 Salary from card: ${jobCard.salaryFromCard}`);
        
        const salaryCheckResult = this.checkSalaryFromCard(jobCard.salaryFromCard);
        
        if (!salaryCheckResult.meetsRequirement) {
          console.log(`${this.platform}: 🚫 SKIPPING - Salary too low: ${jobCard.salaryFromCard}`);
          console.log(`${this.platform}: ${salaryCheckResult.reason}`);
          console.log(`${this.platform}: Job: "${jobCard.title}" at ${jobCard.company}`);
          
          this.sendSkipNotification(jobCard, `Salary Too Low: ${jobCard.salaryFromCard} (${salaryCheckResult.reason})`);
          
          // Click "Not Interested" to remove it and reveal next card
          try {
            await this.clickNotInterestedButton(jobCard);
            console.log(`${this.platform}: ✅ Marked as "Not Interested" and removed from feed`);
          } catch (err) {
            console.log(`${this.platform}: ⚠️ Could not remove job: ${err.message}`);
          }
          
          // Refresh page after skip to ensure clean state
          console.log(`${this.platform}: 🔄 Refreshing page after skip...`);
          try {
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
          } catch (reloadErr) {
            console.log(`${this.platform}: ⚠️ Page reload timeout - continuing anyway`);
          }
          await this.randomDelay(1000, 1500);
          continue; // Get next card from refreshed list
        }
        
        console.log(`${this.platform}: ✅ Salary meets requirement: ${salaryCheckResult.reason}`);
      } else {
        console.log(`${this.platform}: 💰 No salary info on card - will check after opening job`);
      }
      
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
        
        this.sendSkipNotification(jobCard, `Ignored Keyword: "${matchedKeyword}" in title`);
        
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
        
        // Refresh page after skip to ensure clean state
        console.log(`${this.platform}: 🔄 Refreshing page after skip...`);
        try {
          await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
        } catch (reloadErr) {
          console.log(`${this.platform}: ⚠️ Page reload timeout - continuing anyway`);
          // Page might still be usable, continue
        }
        await this.randomDelay(1000, 1500);
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
                  // Try all possible button selectors
                  const btn = card.querySelector('button.index_apply-button__kp79C') ||
                              card.querySelector('button[class*="apply-button"]') ||
                              card.querySelector('button[class*="apply"]') ||
                              card.querySelector('a[class*="apply-button"]') ||
                              card.querySelector('a[class*="apply"]') ||
                              card.querySelector('button[aria-label*="Apply"]') ||
                              card.querySelector('button[aria-label*="apply"]');
                  
                  if (btn) {
                    btn.click();
                    return { success: true, method: 'matched' };
                  } else {
                    // Debug: Log all buttons found in this card
                    const allButtons = Array.from(card.querySelectorAll('button, a'));
                    const buttonInfo = allButtons.map(b => ({
                      tag: b.tagName,
                      class: b.className,
                      id: b.id,
                      text: b.textContent?.trim()?.substring(0, 50)
                    }));
                    return { success: false, debug: buttonInfo };
                  }
                }
              }
              
              // Fallback: Click first card
              const firstCard = cards[0];
              if (firstCard) {
                const btn = firstCard.querySelector('button.index_apply-button__kp79C') ||
                            firstCard.querySelector('button[class*="apply-button"]') ||
                            firstCard.querySelector('button[class*="apply"]') ||
                            firstCard.querySelector('a[class*="apply-button"]') ||
                            firstCard.querySelector('a[class*="apply"]') ||
                            firstCard.querySelector('button[aria-label*="Apply"]') ||
                            firstCard.querySelector('button[aria-label*="apply"]');
                if (btn) {
                  btn.click();
                  return { success: true, method: 'first_card' };
                }
              }
              
              return { success: false, debug: 'No cards or buttons found' };
            }, jobCard.company, jobCard.title);
            
            if (clicked && clicked.success) {
              console.log(`${this.platform}: ✅ Clicked button (method: ${clicked.method})`);
              console.log(`${this.platform}: ⏳ Waiting 1s for tab to open...`);
              await new Promise(r => setTimeout(r, 1000));
            } else {
              console.log(`${this.platform}: ⚠️ Button not found`);
              if (clicked && clicked.debug) {
                console.log(`${this.platform}: 🔍 DEBUG - Buttons/links found on card:`, JSON.stringify(clicked.debug, null, 2));
              }
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
                  const dislikeBtn = card.querySelector('button#index_not-interest-button__9OtWF') ||
                                     card.querySelector('button[id*="not-interest"]') ||
                                     card.querySelector('button[class*="not-interest"]') ||
                                     card.querySelector('button[aria-label*="Not interested"]') ||
                                     card.querySelector('button[aria-label*="not interested"]');
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
        
        // ⚡ IMMEDIATELY click "More Options" while card still exists!
        console.log(`${this.platform}: ⚡ QUICK ACTION: Clicking "More Options" to open dropdown...`);
        console.log(`${this.platform}: 📍 Current page URL: ${this.page.url()}`);
        try {

          console.log("============ QUICK ACTION: Clicking 'More Options' to open dropdown =============");
          const quickClicked = await this.page.evaluate((company, title) => {
            const cards = document.querySelectorAll('.job-card-flag-classname.index_job-card__AsPKC');
            for (const card of cards) {
              const companyEl = card.querySelector('div.index_company-name__gKiOY');
              const titleEl = card.querySelector('h2.index_job-title__UjuEY');
              
              const cardCompany = companyEl?.textContent?.trim();
              const cardTitle = titleEl?.textContent?.trim();
              
              if (cardCompany === company && cardTitle === title) {
                console.log(`✅ Found matching card: "${company}" - "${title}"`);
                
                // Find "More Options" button (three dots) - ENHANCED SEARCH
                console.log('🔍 Searching for "More Options" button with multiple approaches...');
                
                let moreBtn = card.querySelector('img[alt="more-options"]');
                console.log(`   ✓ img[alt="more-options"]: ${moreBtn ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
                
                if (!moreBtn) {
                  moreBtn = card.querySelector('[class*="job-more-button"]');
                  console.log(`   ✓ [class*="job-more-button"]: ${moreBtn ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
                  if (moreBtn) {
                    // Get the img inside if container found
                    const img = moreBtn.querySelector('img');
                    if (img) {
                      console.log(`      → Found img inside container`);
                      moreBtn = img;
                    }
                  }
                }
                
                if (!moreBtn) {
                  moreBtn = card.querySelector('.ant-dropdown-trigger');
                  console.log(`   ✓ .ant-dropdown-trigger: ${moreBtn ? 'FOUND ✅' : 'NOT FOUND ❌'}`);
                }
                
                if (!moreBtn) {
                  // Look for any img with "more" in src
                  const allImgs = card.querySelectorAll('img');
                  for (const img of allImgs) {
                    if (img.src && img.src.includes('more')) {
                      moreBtn = img;
                      console.log(`   ✓ img with "more" in src: FOUND ✅ (${img.src})`);
                      break;
                    }
                  }
                  if (!moreBtn) {
                    console.log(`   ✓ img with "more" in src: NOT FOUND ❌`);
                  }
                }
                
                if (moreBtn) {
                  console.log(`✅ FINAL: Found "More Options" button!`);
                  console.log(`   Tag: ${moreBtn.tagName}`);
                  console.log(`   Alt: ${moreBtn.alt || 'N/A'}`);
                  console.log(`   Src: ${moreBtn.src || 'N/A'}`);
                  console.log(`   Class: ${moreBtn.className}`);
                  
                  // Click the IMG directly (it has ant-dropdown-trigger)
                  const clickTarget = moreBtn;
                  console.log(`🖱️ Clicking IMG element directly...`);
                  
                  // Simulate real mouse events (not just click())
                  const rect = clickTarget.getBoundingClientRect();
                  const x = rect.left + rect.width / 2;
                  const y = rect.top + rect.height / 2;
                  
                  // Dispatch mousedown, mouseup, and click events
                  ['mousedown', 'mouseup', 'click'].forEach(eventType => {
                    const event = new MouseEvent(eventType, {
                      view: window,
                      bubbles: true,
                      cancelable: true,
                      clientX: x,
                      clientY: y,
                      button: 0
                    });
                    clickTarget.dispatchEvent(event);
                  });
                  
                  return true;
                } else {
                  console.log('❌ "More Options" button not found on card after ALL search attempts');
                  
                  // Debug: Log ALL elements on the card
                  const allButtons = card.querySelectorAll('button');
                  const allImgs = card.querySelectorAll('img');
                  const allDivs = card.querySelectorAll('div[class*="dropdown"]');
                  
                  console.log(`📊 Card debugging info:`);
                  console.log(`   Total buttons: ${allButtons.length}`);
                  console.log(`   Total images: ${allImgs.length}`);
                  console.log(`   Divs with "dropdown": ${allDivs.length}`);
                  
                  console.log(`\n🖼️ All images in card:`);
                  allImgs.forEach((img, idx) => {
                    console.log(`   [${idx + 1}] alt="${img.alt || 'NONE'}", src="${img.src || 'NONE'}", class="${img.className || 'NONE'}"`);
                  });
                  
                  console.log(`\n🔘 All buttons in card:`);
                  allButtons.forEach((btn, idx) => {
                    console.log(`   [${idx + 1}] id="${btn.id || 'NONE'}", class="${btn.className || 'NONE'}"`);
                  });
                  
                  return false;
                }
              }
            }
            return false;
          }, jobCard.company, jobCard.title);
          
          if (quickClicked) {
            console.log(`${this.platform}: ✅ Clicked "More Options" button`);
            
            // Wait for dropdown and click "Already Applied"
            console.log(`${this.platform}: ⏳ Waiting for dropdown to appear...`);
            await new Promise(r => setTimeout(r, 1500));
            
            // Check for dropdown
            const dropdownCheck = await this.page.evaluate(() => {
              const dropdownItems = document.querySelectorAll('.ant-dropdown-menu-item');
              return {
                exists: dropdownItems.length > 0,
                count: dropdownItems.length,
                items: Array.from(dropdownItems).map(item => ({
                  text: item.textContent?.trim() || '',
                  menuId: item.getAttribute('data-menu-id')
                }))
              };
            });
            
            console.log(`${this.platform}: 📋 Dropdown check: Found ${dropdownCheck.count} items`);
            
            if (dropdownCheck.exists) {
              console.log(`${this.platform}: ✅ Dropdown menu appeared!`);
              dropdownCheck.items.forEach((item, idx) => {
                console.log(`${this.platform}:   ${idx + 1}. "${item.text}"`);
              });
              
              // Click "Already Applied"
              const dropdownClicked = await this.page.evaluate(() => {
                const dropdownItems = document.querySelectorAll('.ant-dropdown-menu-item');
                
                for (const item of dropdownItems) {
                  const menuId = item.getAttribute('data-menu-id');
                  const text = item.textContent?.trim() || '';
                  
                  // Look for "Already Applied" or menu ID containing "applied"
                  if (text.includes('Already Applied') || (menuId && menuId.includes('applied'))) {
                    console.log('✅ Clicking "Already Applied" option');
                    item.click();
                    return { success: true };
                  }
                }
                
                console.log('❌ "Already Applied" option not found');
                return { success: false };
              });
              
              if (dropdownClicked.success) {
                console.log(`${this.platform}: ✅ Clicked "Already Applied" from dropdown`);
                console.log(`${this.platform}: ⏳ Waiting 2s...`);
                await new Promise(r => setTimeout(r, 2000));
              } else {
                console.log(`${this.platform}: ⚠️ Could not click dropdown option`);
              }
            } else {
              console.log(`${this.platform}: ⚠️ No dropdown appeared - continuing anyway`);
            }
          } else {
            console.log(`${this.platform}: ⚠️ "More Options" button not found - card may have disappeared`);
          }
        } catch (quickErr) {
          console.log(`${this.platform}: ⚠️ Error clicking "More Options": ${quickErr.message}`);
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
                  const dislikeBtn = card.querySelector('button#index_not-interest-button__9OtWF') ||
                                     card.querySelector('button[id*="not-interest"]') ||
                                     card.querySelector('button[class*="not-interest"]') ||
                                     card.querySelector('button[aria-label*="Not interested"]') ||
                                     card.querySelector('button[aria-label*="not interested"]');
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
        
        // Step 4: Send to Ollama AI for analysis
        this.updateStatus(`[4/5] 🤖 Analyzing with Ollama AI...`, `Processed: ${totalProcessedCount}`);
        console.log(`${this.platform}: 📤 Sending to Ollama AI for COMBINED analysis...`);
        
        let gptResult = null;
        
        if (this.gptExtractor) {
          try {
            gptResult = await this.gptExtractor.extractJobData(
              quickContent,
              this.platform,
              finalJobUrl
            );
            
            if (gptResult) {
              console.log(`${this.platform}: ✅ Ollama AI analysis complete`);
            } else {
              console.log(`${this.platform}: ⚠️ Ollama AI extraction returned null - Using fallback data`);
            }
            
            // Check if scraper was stopped during AI analysis
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
            console.log(`${this.platform}: ⚠️ Ollama AI error: ${gptError.message}`);
          }
        }
        
        // Fallback if Ollama AI fails or doesn't provide company/title
        if (!gptResult) {
          console.log(`${this.platform}: Using basic extraction - no AI result`);
          gptResult = {
            isVerificationPage: false,
            isExpired: false,
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
        } else {
          // AI result exists - check if company and title are valid
          // If AI didn't extract valid company/title, fallback to job card data
          const aiCompanyValid = gptResult.company && 
                                 gptResult.company.trim() !== '' && 
                                 gptResult.company.toLowerCase() !== 'unknown';
          const aiTitleValid = gptResult.title && 
                               gptResult.title.trim() !== '' && 
                               gptResult.title.toLowerCase() !== 'unknown';
          
          if (!aiCompanyValid || !aiTitleValid) {
            console.log(`${this.platform}: AI result incomplete - using job card for missing data`);
            if (!aiCompanyValid) {
              gptResult.company = jobCard.company;
              console.log(`${this.platform}: Using job card company: ${jobCard.company}`);
            }
            if (!aiTitleValid) {
              gptResult.title = jobCard.title;
              console.log(`${this.platform}: Using job card title: ${jobCard.title}`);
            }
          } else {
            console.log(`${this.platform}: Using AI-extracted company: "${gptResult.company}" and title: "${gptResult.title}"`);
          }
        }

        // CHECK: Is this a verification page?
        if (gptResult.isVerificationPage) {
          console.log(`${this.platform}: ❌ Ollama AI confirmed: Verification page - SKIPPING`);
          
          // Close tab and go back
          try {
            await newPage.close();
            console.log(`${this.platform}: ✅ Tab closed`);
          } catch (closeErr) {
            console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
          }
          
          // Navigate back and continue
          try {
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Back on job list`);
          } catch (navErr) {
            console.log(`${this.platform}: ⚠️ Navigation error: ${navErr.message}`);
          }
          
          continue; // Skip to next job
        }
        
        // CHECK: Is this an EXPIRED or NO LONGER AVAILABLE page?
        if (gptResult.isExpired) {
          console.log(`${this.platform}: ⏰ Ollama AI confirmed: Job posting is EXPIRED or NO LONGER AVAILABLE - SKIPPING`);
          
          // Send skip notification
          this.sendSkipNotification(jobCard, 'Expired/No Longer Available');
          
          // Close tab
          try {
            await newPage.close();
            console.log(`${this.platform}: ✅ Tab closed`);
          } catch (closeErr) {
            console.log(`${this.platform}: ⚠️ Error closing tab: ${closeErr.message}`);
          }
          
          // Navigate back to job list
          try {
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            console.log(`${this.platform}: ✅ Back on job list`);
          } catch (navErr) {
            console.log(`${this.platform}: ⚠️ Navigation error: ${navErr.message}`);
          }
          
          // Refresh page to reload cards
          console.log(`${this.platform}: 🔄 Refreshing page after skip...`);
          try {
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
          } catch (reloadErr) {
            console.log(`${this.platform}: ⚠️ Page reload timeout - continuing anyway`);
          }
          await this.randomDelay(1000, 1500);
          
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
            
            // Send skip notification to UI
            this.sendSkipNotification(jobCard, `GPT Analysis: ${skipReason}`);
            
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
            
            // Use Ollama AI-extracted company/title if available, otherwise fall back to job card
            const finalCompany = (gptResult.company && gptResult.company !== 'Unknown') 
              ? gptResult.company 
              : jobCard.company;
            const finalTitle = (gptResult.title && gptResult.title !== 'Unknown') 
              ? gptResult.title 
              : jobCard.title;
            
            // Log which source we're using
            if (gptResult.company && gptResult.company !== 'Unknown') {
              console.log(`${this.platform}: 📝 Using Ollama AI-extracted company: "${finalCompany}"`);
            } else {
              console.log(`${this.platform}: 📝 Using job card company: "${finalCompany}"`);
            }
            if (gptResult.title && gptResult.title !== 'Unknown') {
              console.log(`${this.platform}: 📝 Using Ollama AI-extracted title: "${finalTitle}"`);
            } else {
              console.log(`${this.platform}: 📝 Using job card title: "${finalTitle}"`);
            }
            
            // Save job - Use Ollama AI data when available, fall back to card data
            const saved = this.saveJob({
              company: finalCompany,
              title: finalTitle,
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
              console.log(`${this.platform}: ✅ Saved job - ${finalCompany} - ${finalTitle}`);
              
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
          try {
            await this.page.goto(this.baseUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
          } catch (gotoErr) {
            console.log(`${this.platform}: ⚠️ Recovery goto timeout - continuing anyway`);
          }
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
        try {
          // Check if page is still valid before scrolling
          if (!this.page || this.page.isClosed()) {
            console.log(`${this.platform}: ⚠️ Page closed, skipping scroll`);
          } else {
            await this.page.evaluate(() => {
              window.scrollTo(0, document.body.scrollHeight);
            });
            await this.randomDelay(1500, 2000);
          }
        } catch (scrollErr) {
          console.log(`${this.platform}: ⚠️ Scroll error: ${scrollErr.message}`);
        }
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

  // Send job content to Ollama AI and extract detailed info (legacy method)
  // Note: This method appears to be unused - the main extraction now uses gptExtractor.extractJobData()
  async sendToGPTAndExtract(jobContent, company, title) {
    try {
      const path = require('path');
      const { getMainWindow } = require(path.join(__dirname, '../../windowManager'));
      const mainWindow = getMainWindow();
      
      if (!mainWindow) {
        console.log(`${this.platform}: Main window not available for GPT`);
        return null;
      }

      console.log(`${this.platform}: 🤖 Preparing Ollama AI extraction...`);
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
        console.log(`${this.platform}: ⚠️ ChatGPT new chat button not found`);
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
        console.log(`${this.platform}: ⚠️ No GPT response received`);
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
