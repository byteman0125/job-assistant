const { google } = require('googleapis');

class GoogleSheetsService {
  constructor(database) {
    this.db = database;
    this.sheets = null;
    this.initialized = false;
  }

  // Initialize Google Sheets API
  async initialize() {
    try {
      const sheetId = this.db.getSetting('google_sheet_id');
      const credentials = this.db.getSetting('google_sheet_credentials');

      if (!sheetId) {
        console.log('📊 Google Sheets: Not configured (no sheet ID)');
        return false;
      }

      if (!credentials) {
        console.log('📊 Google Sheets: Not configured (no credentials)');
        return false;
      }

      // Parse credentials JSON
      let credentialsObj;
      try {
        credentialsObj = typeof credentials === 'string' ? JSON.parse(credentials) : credentials;
      } catch (parseErr) {
        console.error('📊 Google Sheets: Invalid credentials JSON');
        return false;
      }

      // Authenticate using Service Account
      const auth = new google.auth.GoogleAuth({
        credentials: credentialsObj,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      const authClient = await auth.getClient();
      this.sheets = google.sheets({ version: 'v4', auth: authClient });
      this.initialized = true;

      console.log('📊 Google Sheets: Initialized successfully');
      return true;
    } catch (error) {
      console.error('📊 Google Sheets: Initialization error:', error.message);
      this.initialized = false;
      return false;
    }
  }

  // Check if a job already exists in the sheet (by URL or company+title)
  async jobExistsInSheet(sheetId, job) {
    try {
      if (!this.initialized || !this.sheets) {
        return false;
      }

      // Get all rows from the sheet
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A:Z' // Read all columns
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        return false; // Sheet is empty
      }

      // Check if job exists (by URL or company+title)
      for (let i = 1; i < rows.length; i++) { // Skip header row
        const row = rows[i];
        const rowUrl = row[2] || ''; // URL is typically column C (index 2)
        const rowCompany = row[0] || ''; // Company is typically column A (index 0)
        const rowTitle = row[1] || ''; // Title is typically column B (index 1)

        // Check by URL
        if (rowUrl === job.url) {
          return true;
        }

        // Check by company + title
        if (rowCompany === job.company && rowTitle === job.title) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('📊 Google Sheets: Error checking duplicates:', error.message);
      return false; // Assume not duplicate if check fails
    }
  }

  // Append job to Google Sheet
  async appendJob(job) {
    try {
      if (!this.initialized || !this.sheets) {
        await this.initialize();
        if (!this.initialized) {
          return false;
        }
      }

      const sheetId = this.db.getSetting('google_sheet_id');
      if (!sheetId) {
        console.log('📊 Google Sheets: No sheet ID configured');
        return false;
      }

      // Check for duplicates
      const exists = await this.jobExistsInSheet(sheetId, job);
      if (exists) {
        console.log('📊 Google Sheets: Job already exists, skipping');
        return false;
      }

      // Prepare row data
      const row = [
        job.company || '',
        job.title || '',
        job.url || '',
        job.platform || '',
        job.location || '',
        job.salary || '',
        job.tech_stack || '',
        job.is_remote ? 'Yes' : 'No',
        job.is_startup ? 'Yes' : 'No',
        new Date(job.timestamp || Date.now()).toISOString().split('T')[0], // Date
        job.job_type || '',
        job.industry || ''
      ];

      // Append row to sheet
      await this.sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'A1', // Start from A1, will append after last row
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [row]
        }
      });

      console.log('📊 Google Sheets: ✅ Job saved to sheet');
      return true;
    } catch (error) {
      console.error('📊 Google Sheets: Error saving job:', error.message);
      return false;
    }
  }

  // Test connection to Google Sheet
  async testConnection() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      if (!this.initialized) {
        return { success: false, message: 'Not initialized' };
      }

      const sheetId = this.db.getSetting('google_sheet_id');
      if (!sheetId) {
        return { success: false, message: 'No sheet ID configured' };
      }

      // Try to read the sheet
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId: sheetId
      });

      return {
        success: true,
        message: `Connected to sheet: ${response.data.properties.title}`
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

