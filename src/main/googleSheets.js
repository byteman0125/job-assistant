const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleSheetsService {
  constructor(database) {
    this.db = database;
    this.sheets = null;
    this.spreadsheetId = '1hBW6XlTRz5wiFKF3g4FE_aRpGJ4g-DRLRBIynJ0rwMY';
    this.sheetName = 'Sheet1'; // Default sheet name (legacy, now using tab detection)
    this.initialized = false;
  }

  // Determine which tab a job should go to based on platform and/or URL (case-insensitive)
  detectTabName(url, platform) {
    // Platform-specific tabs take priority when available
    if (platform) {
      const p = String(platform).toLowerCase();
      if (p === 'himalayas') {
        return 'Himalayas';
      }
    }

    if (!url) return 'others';
    
    const urlLower = url.toLowerCase();
    
    // Check for greenhouse patterns first (greenhouse, ashbyhq, lever)
    if (urlLower.includes('greenhouse') || 
        urlLower.includes('ashbyhq') || 
        urlLower.includes('lever')) {
      return 'greenhouse';
    }
    
    // Check for workday pattern
    if (urlLower.includes('myworkdayjobs')) {
      return 'workday';
    }
    
    // Default to others tab
    return 'others';
  }

  // Normalize date string for comparison (handles various formats)
  normalizeDate(dateStr) {
    if (!dateStr) return '';
    
    const trimmed = dateStr.trim();
    
    // If it's already in MM/DD/YYYY format, return as is
    const mmddyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = trimmed.match(mmddyyyyPattern);
    if (match) {
      const month = match[1].padStart(2, '0');
      const day = match[2].padStart(2, '0');
      const year = match[3];
      return `${month}/${day}/${year}`;
    }
    
    // Try ISO format (YYYY-MM-DD)
    const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
    const isoMatch = trimmed.match(isoPattern);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${month}/${day}/${year}`;
    }
    
    // Try DD/MM/YYYY format (if month > 12, it's likely DD/MM/YYYY)
    const ddmmyyyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const ddmMatch = trimmed.match(ddmmyyyyPattern);
    if (ddmMatch) {
      const first = parseInt(ddmMatch[1]);
      const second = parseInt(ddmMatch[2]);
      // If first > 12, it's likely day, so swap
      if (first > 12 && second <= 12) {
        const month = ddmMatch[2].padStart(2, '0');
        const day = ddmMatch[1].padStart(2, '0');
        const year = ddmMatch[3];
        return `${month}/${day}/${year}`;
      }
    }
    
    // Return original if no pattern matches
    return trimmed;
  }

  // Get today's date in consistent format (MM/DD/YYYY)
  getTodayDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    return `${month}/${day}/${year}`;
  }

  // Initialize Google Sheets API with Service Account
  async initialize() {
    try {
      // Get service account credentials from settings
      const credentialsJson = this.db.getSetting('google_sheets_credentials');
      
      if (!credentialsJson) {
        console.log('Google Sheets: ⚠️ No credentials found. Please add Service Account JSON in Settings.');
        return false;
      }

      // Parse credentials
      let credentials;
      try {
        credentials = typeof credentialsJson === 'string' 
          ? JSON.parse(credentialsJson) 
          : credentialsJson;
      } catch (parseErr) {
        console.error('Google Sheets: ❌ Error parsing credentials:', parseErr.message);
        return false;
      }

      // Authenticate with Service Account
      const auth = new google.auth.GoogleAuth({
        credentials: credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const authClient = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient });

      this.initialized = true;
      console.log('Google Sheets: ✅ Initialized successfully');
      return true;
    } catch (error) {
      console.error('Google Sheets: ❌ Initialization error:', error.message);
      this.initialized = false;
      return false;
    }
  }

  // Check if a job already exists in the specific tab (by URL or Company+Title)
  async checkDuplicate(company, title, url, tabName) {
    try {
      if (!this.initialized || !this.sheets) {
        await this.initialize();
        if (!this.initialized) return false; // If still not initialized, assume not duplicate
      }

      // Read existing data from specific tab
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${tabName}!A2:F`, // Date, No, Company, Title, Url, Platform
      });

      const rows = response.data.values || [];
      
      // Check for duplicates in this tab
      for (const row of rows) {
        if (row.length >= 5) {
          const rowUrl = row[4]?.trim(); // Column E (Url)
          const rowCompany = row[2]?.trim(); // Column C (Company)
          const rowTitle = row[3]?.trim(); // Column D (Title)
          
          // Check by URL or Company+Title
          if (rowUrl === url || (rowCompany === company && rowTitle === title)) {
            return true; // Duplicate found
          }
        }
      }
      
      return false; // No duplicate
    } catch (error) {
      // If tab doesn't exist yet, it's not a duplicate
      if (error.message && error.message.includes('Unable to parse range')) {
        return false;
      }
      console.error('Google Sheets: ⚠️ Error checking duplicate:', error.message);
      return false; // On error, assume not duplicate (allow save)
    }
  }

  // Get next row number for a specific tab, resetting to 1 when date changes
  async getNextRowNumber(tabName, todayDate) {
    try {
      if (!this.initialized || !this.sheets) {
        await this.initialize();
        if (!this.initialized) return 1;
      }

      // Read date (column A) and number (column B) from specific tab
      // Use FORMATTED_VALUE to get dates as they appear in the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${tabName}!A2:B`, // Date (A), No (B)
        valueRenderOption: 'FORMATTED_VALUE', // Get formatted values (dates as displayed)
      }).catch(() => {
        // Tab doesn't exist yet, return 1
        return { data: { values: [] } };
      });

      const rows = response.data.values || [];
      if (rows.length === 0) return 1;

      // Normalize today's date for comparison
      const normalizedTodayDate = this.normalizeDate(todayDate);
      console.log(`Google Sheets: Looking for rows with date: "${normalizedTodayDate}" (original: "${todayDate}")`);

      // Find max number for today's date only
      let maxNo = 0;
      let rowsChecked = 0;
      let rowsWithTodayDate = 0;
      
      for (const row of rows) {
        if (row.length >= 2) {
          rowsChecked++;
          const rowDateRaw = row[0]?.trim() || ''; // Column A (Date)
          const rowNo = row[1]?.trim(); // Column B (No)
          
          // Normalize the row date for comparison
          const normalizedRowDate = this.normalizeDate(rowDateRaw);
          
          // Only count rows with today's date
          if (normalizedRowDate === normalizedTodayDate && rowNo) {
            rowsWithTodayDate++;
            const num = parseInt(rowNo);
            if (!isNaN(num) && num > maxNo) {
              maxNo = num;
              console.log(`Google Sheets: Found row with today's date - Date: "${rowDateRaw}" (normalized: "${normalizedRowDate}"), No: ${num}`);
            }
          }
        }
      }
      
      console.log(`Google Sheets: Checked ${rowsChecked} rows, found ${rowsWithTodayDate} rows with today's date, max No: ${maxNo}`);

      // If no rows found for today's date, start from 1
      // Otherwise, increment from max number for today
      return maxNo === 0 ? 1 : maxNo + 1;
    } catch (error) {
      console.error('Google Sheets: ⚠️ Error getting next row number:', error.message);
      return 1; // Default to 1 on error
    }
  }

  // Add job to Google Sheet (categorized by tab)
  async addJob(job) {
    try {
      // Only save if job was successfully saved to database
      // This method is called AFTER database save, so we know it's not a duplicate
      
      // Check if Google Sheets is enabled
      const enableGoogleSheets = this.db.getSetting('enable_google_sheets');
      if (enableGoogleSheets === false) {
        console.log(`Google Sheets: ⚠️ Sync is disabled, skipping job: ${job.platform} - ${job.company} - ${job.title}`);
        return false;
      }
      
      console.log(`Google Sheets: Processing job from ${job.platform}: ${job.company} - ${job.title}`);
      
      if (!this.initialized || !this.sheets) {
        const initialized = await this.initialize();
        if (!initialized) {
          console.log(`Google Sheets: ⚠️ Not initialized, skipping sheet save for ${job.platform}`);
          return false;
        }
      }

      // Detect which tab this job should go to
      const tabName = this.detectTabName(job.url, job.platform);
      console.log(`Google Sheets: Detected tab: "${tabName}" for URL: ${job.url}`);

      // Check for duplicate in specific tab (extra safety check, though DB already checks)
      console.log(`Google Sheets: Checking for duplicate in "${tabName}" tab: ${job.platform} - ${job.company} - ${job.title}`);
      const isDuplicate = await this.checkDuplicate(job.company, job.title, job.url, tabName);
      if (isDuplicate) {
        console.log(`Google Sheets: ℹ️ Duplicate found in "${tabName}" tab, skipping: ${job.platform} - ${job.company} - ${job.title}`);
        return false;
      }

      // Format date consistently (MM/DD/YYYY)
      const date = this.getTodayDate();

      // Get next row number for this tab (resets to 1 when date changes)
      console.log(`Google Sheets: Getting next row number for "${tabName}" tab (date: ${date})...`);
      const rowNo = await this.getNextRowNumber(tabName, date);
      console.log(`Google Sheets: Next row number for "${tabName}": ${rowNo}`);

      // Prepare row data: Date, No, Company, Title, Url, Platform
      const values = [[
        date,                    // Column A: Date
        rowNo.toString(),       // Column B: No
        job.company || '',       // Column C: Company
        job.title || '',         // Column D: Title
        job.url || '',           // Column E: Url
        job.platform || ''       // Column F: Platform
      ]];

      console.log(`Google Sheets: Appending row to "${tabName}" tab (ID: ${this.spreadsheetId}):`, values[0]);

      // Append row to specific tab
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: this.spreadsheetId,
        range: `${tabName}!A:F`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: values
        }
      }).catch(async (error) => {
        // If tab doesn't exist, create it first
        if (error.message && error.message.includes('Unable to parse range')) {
          console.log(`Google Sheets: Tab "${tabName}" doesn't exist, creating it...`);
          
          // Create the tab by adding a sheet
          await this.sheets.spreadsheets.batchUpdate({
            spreadsheetId: this.spreadsheetId,
            resource: {
              requests: [{
                addSheet: {
                  properties: {
                    title: tabName,
                    gridProperties: {
                      rowCount: 1000,
                      columnCount: 10
                    }
                  }
                }
              }]
            }
          });

          // Add header row to new tab
          await this.sheets.spreadsheets.values.update({
            spreadsheetId: this.spreadsheetId,
            range: `${tabName}!A1:F1`,
            valueInputOption: 'USER_ENTERED',
            resource: {
              values: [['Date', 'No', 'Company', 'Title', 'Url', 'Platform']]
            }
          });

          // Retry appending the job row
          return await this.sheets.spreadsheets.values.append({
            spreadsheetId: this.spreadsheetId,
            range: `${tabName}!A:F`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
              values: values
            }
          });
        }
        throw error;
      });

      console.log(`Google Sheets: ✅ Added job to "${tabName}" tab: ${job.platform} - ${job.company} - ${job.title} (Row #${rowNo}, Updated cells: ${response.data.updates?.updatedCells || 0})`);
      return true;
    } catch (error) {
      console.error('Google Sheets: ❌ Error adding job:', error.message);
      return false;
    }
  }

  // Test connection
  async testConnection() {
    try {
      if (!this.initialized || !this.sheets) {
        const initialized = await this.initialize();
        if (!initialized) {
          return { success: false, message: 'Failed to initialize. Check credentials.' };
        }
      }

      // Try to read the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetName}!A1:F1`, // Read header row: Date, No, Company, Title, Url, Platform
      });

      return { 
        success: true, 
        message: 'Connection successful!',
        headers: response.data.values?.[0] || []
      };
    } catch (error) {
      return { 
        success: false, 
        message: `Connection failed: ${error.message}` 
      };
    }
  }
}

module.exports = GoogleSheetsService;

