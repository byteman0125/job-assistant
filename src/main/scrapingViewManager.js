// Scraping View Manager
const { ipcMain } = require('electron');

let scrapingWebContents = null;

function setScrapingWebContents(webContents) {
  scrapingWebContents = webContents;
}

function getScrapingWebContents() {
  return scrapingWebContents;
}

function updateScrapingStatus(platform, progress, jobsFound) {
  // Send status update to renderer
  if (scrapingWebContents && scrapingWebContents.hostWebContents) {
    scrapingWebContents.hostWebContents.send('scraping-status-update', {
      platform,
      progress,
      jobsFound
    });
  }
}

module.exports = {
  setScrapingWebContents,
  getScrapingWebContents,
  updateScrapingStatus
};

