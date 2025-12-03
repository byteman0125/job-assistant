const HimalayasScraper = require('./platforms/himalayas');
const JobgetherScraper = require('./platforms/jobgether');
const BuiltInScraper = require('./platforms/builtin');
const ZipRecruiterScraper = require('./platforms/ziprecruiter');
const JobrightScraper = require('./platforms/jobright');
const RemoteOKScraper = require('./platforms/remoteok');
const WeWorkRemotelyScraper = require('./platforms/weworkremotely');
const JungleScraper = require('./platforms/jungle');
const RocketshipScraper = require('./platforms/rocketship');
const GPTExtractor = require('../gptExtractor');
const ActionRecorder = require('../actionRecorder');

class ScraperManager {
  constructor(database) {
    this.db = database;
    this.isRunning = false;
    this.gptExtractor = new GPTExtractor();
    this.actionRecorder = new ActionRecorder();
    
    this.scrapers = [
      new JobrightScraper(database),  // START WITH JOBRIGHT FIRST! (No AI)
      new HimalayasScraper(database, this.gptExtractor),
      new JobgetherScraper(database, this.gptExtractor),
      new BuiltInScraper(database),  // No AI needed
      new ZipRecruiterScraper(database, this.gptExtractor),
      new RemoteOKScraper(database, this.gptExtractor),
      new WeWorkRemotelyScraper(database, this.gptExtractor),
      new JungleScraper(database, this.gptExtractor),
      new RocketshipScraper(database)
    ];
    this.onJobFoundCallback = null;
  }

  async start(onJobFound) {
    if (this.isRunning) {
      console.log('Scraper already running');
      return;
    }

    this.isRunning = true;
    this.onJobFoundCallback = onJobFound;

    console.log('Starting all scrapers... [V2-NEW-FILE]');
    console.log('🤖 GPT Extractor: Mandatory AI extraction enabled');
    console.log('📹 Action Recorder: Ready to learn from you');
    await this.gptExtractor.initialize();
    
    // Get enabled platforms from settings (order matters!)
    const enabledPlatforms = this.db.getSetting('enabled_platforms') || ['Jobright'];
    console.log(`⚙️ Enabled platforms (in order): ${enabledPlatforms.join(', ')}`);
    
    // Sort scrapers based on the order in enabledPlatforms
    const activateScrapers = enabledPlatforms
      .map(platformName => this.scrapers.find(s => s.platform === platformName))
      .filter(scraper => scraper !== undefined); // Remove any platforms that don't have scrapers
    
    if (activateScrapers.length === 0) {
      console.log('⚠️ No platforms enabled in settings!');
      this.isRunning = false;
      return;
    }
    
    console.log(`🎯 Scraping order: ${activateScrapers.map(s => s.platform).join(' → ')}`);
    
    // Log available recorded actions
    const platforms = this.actionRecorder.getAllPlatforms();
    if (platforms.length > 0) {
      console.log(`💾 Loaded recorded actions for: ${platforms.join(', ')}`);
    }

    // Run scrapers in sequence to avoid overwhelming the system
    while (this.isRunning) {
      for (const scraper of activateScrapers) {
        if (!this.isRunning) break;

        try {
          console.log(`\n========================================`);
          console.log(`🔍 Starting ${scraper.platform}...`);
          console.log(`========================================`);
          const newJobs = await scraper.scrape();
          
          if (newJobs > 0) {
            console.log(`✅ ${scraper.platform}: Found ${newJobs} new jobs!`);
            
            // Notify about new jobs
            if (this.onJobFoundCallback) {
              const todayJobs = this.db.getJobsToday();
              this.onJobFoundCallback(todayJobs.length);
            }
          } else {
            console.log(`⚠️ ${scraper.platform}: No new jobs found`);
          }
        } catch (error) {
          console.error(`❌ Error scraping ${scraper.platform}:`, error.message);
          
          // Send error to UI
          const { getMainWindow } = require('../windowManager');
          const mainWindow = getMainWindow();
          if (mainWindow) {
            mainWindow.webContents.send('scraper-error', {
              platform: scraper.platform,
              message: error.message
            });
          }
        }

        // Wait between scrapers
        if (this.isRunning) {
          console.log(`⏳ Waiting 15 seconds before next platform...`);
          await this.delay(15000); // 15 seconds between platforms
        }
      }

      // Wait before next round
      if (this.isRunning) {
        console.log('Waiting 30 minutes before next scraping cycle...');
        await this.delay(5 * 60 * 1000); // 30 minutes
      }
    }
  }

  stop() {
    this.isRunning = false;
    this.scrapers.forEach(scraper => scraper.stop());
    // Cleanup Ollama if we started it
    if (this.gptExtractor) {
      this.gptExtractor.cleanup();
    }
    // Don't log here - main.js will handle the notification
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ScraperManager;

