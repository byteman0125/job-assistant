const puppeteer = require('puppeteer');

class BaseScraper {
  constructor(database, platform, gptExtractor = null) {
    this.db = database;
    this.platform = platform;
    this.browser = null;
    this.page = null;
    this.isRunning = false;
    this.gptExtractor = gptExtractor;
    this.viewportSettings = {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: true,
      isMobile: false
    };
    this.extraHTTPHeaders = {
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-User': '?1',
      'Sec-Fetch-Dest': 'document',
      'Cache-Control': 'max-age=0'
    };
    this.currentUserAgent = null;
  }

  // User agents for bot avoidance
  getUserAgent() {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  // Random delay for bot avoidance
  async randomDelay(min = 3000, max = 6000) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    console.log(`${this.platform}: Waiting ${Math.round(delay/1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Detect bot verification pages - Simple and fast
  async detectBotChallenge(page) {
    try {
      const pageInfo = await page.evaluate(() => {
        const title = document.title.toLowerCase();
        const bodyText = document.body ? document.body.innerText.toLowerCase() : '';
        
        return {
          title: title,
          bodyText: bodyText.substring(0, 500), // First 500 chars for quick check
          
          // Quick checks
          isCloudflare: title.includes('just a moment') || 
                        bodyText.includes('checking your browser'),
          
          isCaptcha: bodyText.includes('captcha') || 
                     bodyText.includes('verify you are human'),
          
          isBlocked: bodyText.includes('access denied') || 
                     bodyText.includes('forbidden')
        };
      });
      
      const isChallenge = pageInfo.isCloudflare || pageInfo.isCaptcha || pageInfo.isBlocked;
      
      if (isChallenge) {
        console.log(`${this.platform}: 🚨 Bot challenge detected!`);
        console.log(`${this.platform}: - Title: "${pageInfo.title}"`);
        console.log(`${this.platform}: - Type: ${pageInfo.isCloudflare ? 'Cloudflare' : pageInfo.isCaptcha ? 'Captcha' : 'Blocked'}`);
      }
      
      return isChallenge;
      
    } catch (error) {
      return false;
    }
  }

  // Attempt to solve bot challenge with mouse movements
  async attemptBotChallenge(page) {
    try {
      console.log(`${this.platform}: 🤖 Bot challenge detected! Attempting to solve...`);
      
      // Step 1: Wait 10 seconds (some challenges auto-solve)
      console.log(`${this.platform}: Waiting 10 seconds for auto-solve...`);
      await new Promise(r => setTimeout(r, 10000));
      
      // Check if solved
      if (!(await this.detectBotChallenge(page))) {
        console.log(`${this.platform}: ✅ Challenge auto-solved!`);
        return true;
      }
      
      // Step 2: Simulate human mouse movements AND clicks (focused area: 100-800 x 200-500)
      console.log(`${this.platform}: Simulating human mouse movements with clicks in center area...`);
      
      // Focus on center area where verification usually happens
      const startX = 100;
      const endX = 800;
      const startY = 200;
      const endY = 500;
      
      let clickCount = 0;
      
      // Move mouse in a natural pattern across the verification area with clicks
      for (let y = startY; y <= endY; y += 50) {
        for (let x = startX; x <= endX; x += 50) {
          // Move to position (smooth with steps)
          await page.mouse.move(x, y, { steps: 5 });
          await new Promise(r => setTimeout(r, 10 + Math.random() * 20));
          
          // Click more frequently in this area (every ~5 positions)
          if (Math.random() < 0.2) {
            await page.mouse.click(x, y);
            clickCount++;
            await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
          }
        }
      }
      
      console.log(`${this.platform}: Mouse movements complete in area 100-800×200-500 (${clickCount} clicks)`);
      
      // Step 3: Wait another 5 seconds
      await new Promise(r => setTimeout(r, 5000));
      
      // Check if solved now
      if (!(await this.detectBotChallenge(page))) {
        console.log(`${this.platform}: ✅ Challenge solved with mouse movements!`);
        return true;
      }
      
      console.log(`${this.platform}: ❌ Challenge still present, will skip this job`);
      return false;
      
    } catch (error) {
      console.error(`${this.platform}: Error handling bot challenge:`, error.message);
      return false;
    }
  }

  async applyStealthScripts(page) {
    await page.evaluateOnNewDocument(() => {
        // 1. Remove navigator.webdriver flag ⭐ CRITICAL
        Object.defineProperty(navigator, 'webdriver', {
          get: () => false,
        });
        
        // 2. Mock Chrome object
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };
        
        // 3. Mock plugins (shows Chrome PDF plugin)
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: {type: "application/x-google-chrome-pdf", suffixes: "pdf", description: "Portable Document Format"},
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            }
          ],
        });
        
        // 4. Mock mimeTypes
        Object.defineProperty(navigator, 'mimeTypes', {
          get: () => [
            {type: "application/pdf", suffixes: "pdf", description: "Portable Document Format"}
          ],
        });
        
        // 5. Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
        
        // 6. Languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en'],
        });
        
        // 7. WebGL Vendor (realistic GPU)
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter.apply(this, [parameter]);
        };
        
        // 8. Battery API (makes it look like a laptop)
        Object.defineProperty(navigator, 'getBattery', {
          get: () => async () => ({
            charging: true,
            chargingTime: 0,
            dischargingTime: Infinity,
            level: 1
          })
        });
        
        // 9. Connection API
        Object.defineProperty(navigator, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false
          })
        });
        
        // 10. Hardware concurrency (CPU cores)
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8
        });
        
        // 11. Device memory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8
        });
        
        // 12. Platform
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Win32'
        });
        
        // 13. Vendor
        Object.defineProperty(navigator, 'vendor', {
          get: () => 'Google Inc.'
        });
      });
  }

  async configurePage(page) {
    if (!this.currentUserAgent) {
      this.currentUserAgent = this.getUserAgent();
    }
    await page.setUserAgent(this.currentUserAgent);
    await this.applyStealthScripts(page);
    if (this.extraHTTPHeaders) {
      await page.setExtraHTTPHeaders(this.extraHTTPHeaders);
    }
    if (this.viewportSettings) {
      await page.setViewport(this.viewportSettings);
    }
  }

  // Initialize browser with Puppeteer (HEADLESS - we'll mirror to webview)
  async initBrowser() {
    try {
      console.log(`${this.platform}: Launching browser (headless, mirroring to scraping tab)...`);
      
      this.browser = await puppeteer.launch({
        headless: true,  // NO SEPARATE WINDOW! All work happens in background
        defaultViewport: { width: 1920, height: 1080 },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920,1080',
          '--start-maximized',
          '--disable-infobars',
          '--disable-notifications',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ]
      });

      this.page = await this.browser.newPage();
      await this.configurePage(this.page);
      
      // Load cookies if available (prefer multi-set rotation, fallback to legacy single set)
      let cookies = null;
      let activeSetId = null;

      // Try rotating through cookie_sets (multiple sets per platform)
      let activeSet = this.db.rotateCookieSet(this.platform);
      if (!activeSet) {
        activeSet = this.db.getActiveCookieSet(this.platform);
      }
      if (activeSet && activeSet.cookies && Array.isArray(activeSet.cookies) && activeSet.cookies.length > 0) {
        cookies = activeSet.cookies;
        activeSetId = activeSet.id;
      } else {
        // Fallback: legacy single-set cookies table
        const legacyCookies = this.db.getCookies(this.platform);
        if (legacyCookies && Array.isArray(legacyCookies) && legacyCookies.length > 0) {
          cookies = legacyCookies;
        }
      }

      if (cookies && Array.isArray(cookies) && cookies.length > 0) {
        console.log(`${this.platform}: Loading ${cookies.length} cookies...`);
        const puppeteerCookies = cookies.map(c => ({
          name: c.name,
          value: c.value,
          domain: c.domain || this.getBaseDomain(),
          path: c.path || '/',
          httpOnly: c.httpOnly || false,
          secure: c.secure !== false,
          expires: c.expirationDate || (Date.now() / 1000 + 86400 * 365)
        }));
        
        await this.page.setCookie(...puppeteerCookies);
        console.log(`${this.platform}: ✅ Cookies loaded`);

        if (activeSetId) {
          this.db.markCookieSetUsed(activeSetId);
        }
      } else {
        console.log(`${this.platform}: No cookies configured (cookie_sets or legacy)`);
      }
      
      // Note: Tab creation is now handled per-scraper with promises
      // Global handler removed to avoid conflicts with specific tab handling

      console.log(`${this.platform}: ✅ Browser initialized`);
    } catch (error) {
      console.error(`${this.platform}: Failed to initialize browser:`, error.message);
      throw error;
    }
  }

  async createWorkerPage(label = 'worker') {
    if (!this.browser) {
      throw new Error(`${this.platform}: Browser is not initialized`);
    }
    const workerPage = await this.browser.newPage();
    await this.configurePage(workerPage);
    return workerPage;
  }

  // Close browser
  async closeBrowser() {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
        this.page = null;
      }
    } catch (err) {
      console.error(`${this.platform}: Error closing browser:`, err.message);
    }
  }
  
  // Get base domain for cookies
  getBaseDomain() {
    // Override in child classes
    return 'example.com';
  }

  // Navigate to URL (also mirror to scraping webview)
  async navigateToUrl(url) {
    try {
      this.updateStatus(`Navigating to ${url.substring(0, 50)}...`, '');
      console.log(`${this.platform}: 📍 Navigating to ${url}`);
      
      // Navigate Puppeteer page
      await this.page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Also show in scraping webview for visual feedback
      this.mirrorToWebview(url);
      
      console.log(`${this.platform}: ✅ Page loaded`);
      return url;
    } catch (error) {
      console.error(`${this.platform}: ❌ Navigation error:`, error.message);
      return url;
    }
  }
  
  // Mirror current URL to scraping webview for visual feedback
  mirrorToWebview(url) {
    try {
      // Skip URLs with Cloudflare challenge tokens (they cause ERR_ABORTED in webview)
      if (url && url.includes('__cf_chl_rt_tk=')) {
        console.log(`${this.platform}: ⚠️ Skipping mirror (Cloudflare token URL)`);
        return;
      }
      
      const { getMainWindow } = require('../windowManager');
      const mainWindow = getMainWindow();
      
      if (mainWindow) {
        mainWindow.webContents.send('load-url-in-scraping-view', url);
      }
    } catch (err) {
      // Ignore errors silently
    }
  }

  // Extract text content safely
  async extractText(selector) {
    try {
      await this.page.waitForSelector(selector, { timeout: 5000 });
      return await this.page.$eval(selector, el => el.textContent.trim());
    } catch (error) {
      return null;
    }
  }
  
  // Execute JavaScript in page
  async executeScript(script) {
    try {
      return await this.page.evaluate(script);
    } catch (error) {
      console.error(`${this.platform}: Error executing script:`, error.message);
      return null;
    }
  }
  
  // Update UI status
  updateStatus(step, progress) {
    try {
      // Log to console for progress bar parsing
      console.log(`${this.platform}: ${step}`);
      
      const { getMainWindow } = require('../windowManager');
      const mainWindow = getMainWindow();
      
      if (mainWindow) {
        mainWindow.webContents.send('scraping-status-update', {
          platform: this.platform,
          step: step,
          progress: progress,
          jobsFound: 0
        });
      }
    } catch (err) {
      // Ignore errors
    }
  }

  // Report bug with automatic deduplication
  reportBug(errorType, errorMessage, additionalData = {}) {
    try {
      const bugData = {
        platform: this.platform,
        error_type: errorType,
        error_message: errorMessage.substring(0, 500), // Limit message length
        error_stack: additionalData.stack ? additionalData.stack.substring(0, 2000) : null,
        url: additionalData.url || null,
        job_title: additionalData.job_title || null,
        job_company: additionalData.job_company || null
      };
      
      const bugId = this.db.reportBug(bugData);
      
      // Only log when it's a new bug, not when incrementing count
      if (bugId && !additionalData.silent) {
        console.log(`${this.platform}: 🐛 Bug reported (ID: ${bugId})`);
      }
      
      return bugId;
    } catch (error) {
      console.error(`${this.platform}: Error reporting bug:`, error.message);
      return null;
    }
  }

  // Save job to database
  saveJob(job) {
    try {
      const success = this.db.addJob({
        ...job,
        platform: this.platform,
        timestamp: Date.now()
      });
      return success;
    } catch (error) {
      console.error(`${this.platform}: Error saving job:`, error.message);
      return false;
    }
  }

  // Extract job data using GPT/AI from current page
  async extractWithGPT(jobUrl) {
    try {
      if (!this.gptExtractor || !this.page) {
        console.log(`${this.platform}: GPT extractor or page not available`);
        return null;
      }

      console.log(`${this.platform}: 📄 Extracting page content for AI analysis...`);
      
      // Get page content
      const pageContent = await this.page.evaluate(() => {
        return {
          title: document.title || '',
          bodyText: document.body ? document.body.innerText : '',
          url: window.location.href
        };
      });

      if (!pageContent.bodyText || pageContent.bodyText.length < 50) {
        console.log(`${this.platform}: ⚠️ Page content too short for AI analysis`);
        return null;
      }

      console.log(`${this.platform}: 🤖 Sending ${pageContent.bodyText.length} chars to AI extractor...`);
      
      // Use the GPT extractor to analyze the job page
      const extractedData = await this.gptExtractor.extractJobData(pageContent, this.platform, jobUrl);
      
      if (extractedData) {
        console.log(`${this.platform}: ✅ AI extracted job data successfully`);
        return extractedData;
      } else {
        console.log(`${this.platform}: ⚠️ AI extraction failed`);
        return null;
      }
      
    } catch (error) {
      console.error(`${this.platform}: Error in extractWithGPT:`, error.message);
      return null;
    }
  }

  // Main scrape method - to be implemented by each platform
  async scrape() {
    throw new Error('scrape() method must be implemented by platform scraper');
  }

  // Stop scraping
  stop() {
    this.isRunning = false;
    this.closeBrowser();
  }
}

module.exports = BaseScraper;
