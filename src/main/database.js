const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

class JobDatabase {
  constructor() {
    // Store database in project data folder
    const dataDir = path.join(process.cwd(), 'data');
    const dbPath = path.join(dataDir, 'jobs.db');
    this.db = new Database(dbPath);
    this.initTables();
    console.log('Database opened at:', dbPath);
  }

  initTables() {
    // Jobs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT UNIQUE NOT NULL,
        platform TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        salary TEXT,
        tech_stack TEXT,
        is_remote BOOLEAN DEFAULT 1,
        is_startup BOOLEAN DEFAULT 0,
        location TEXT,
        applied BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        UNIQUE(company, title)
      )
    `);
    
    // Add applied column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE jobs ADD COLUMN applied BOOLEAN DEFAULT 0`);
    } catch (err) {
      // Column already exists, ignore
    }

    // Cookies table (encrypted)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cookies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT UNIQUE NOT NULL,
        cookies_encrypted TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Actions table (scraper configurations)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT UNIQUE NOT NULL,
        actions TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Settings table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_jobs_timestamp ON jobs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_jobs_platform ON jobs(platform);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    `);
    
    // Initialize default settings if not exists
    this.initializeDefaultSettings();
  }

  // Encryption/Decryption for cookies
  encrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('job-searcher-secret-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(text) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync('job-searcher-secret-key', 'salt', 32);
    const parts = text.split(':');
    const iv = Buffer.from(parts.shift(), 'hex');
    const encryptedText = parts.join(':');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // Jobs operations
  addJob(job) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO jobs 
      (company, title, url, platform, timestamp, salary, tech_stack, is_remote, is_startup, location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    // Ensure all values are proper types for SQLite
    const result = stmt.run(
      String(job.company || 'Unknown'),
      String(job.title || 'Unknown'),
      String(job.url || ''),
      String(job.platform || ''),
      Number(job.timestamp || Date.now()),
      job.salary ? String(job.salary) : null,
      job.tech_stack ? String(job.tech_stack) : null,
      job.is_remote !== undefined ? (job.is_remote ? 1 : 0) : 1,
      job.is_startup !== undefined ? (job.is_startup ? 1 : 0) : 0,
      job.location ? String(job.location) : null
    );
    
    return result.changes > 0;
  }

  getAllJobs() {
    const stmt = this.db.prepare('SELECT * FROM jobs ORDER BY timestamp DESC');
    return stmt.all();
  }

  getJobsToday() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const timestamp = todayStart.getTime();
    
    const stmt = this.db.prepare('SELECT * FROM jobs WHERE created_at >= ? ORDER BY created_at DESC');
    return stmt.all(Math.floor(timestamp / 1000));
  }

  deleteJob(id) {
    const stmt = this.db.prepare('DELETE FROM jobs WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  updateJobAppliedStatus(id, applied) {
    const stmt = this.db.prepare('UPDATE jobs SET applied = ? WHERE id = ?');
    const result = stmt.run(applied ? 1 : 0, id);
    return result.changes > 0;
  }

  updateMultipleJobsAppliedStatus(ids, applied) {
    const stmt = this.db.prepare('UPDATE jobs SET applied = ? WHERE id = ?');
    const transaction = this.db.transaction((jobIds) => {
      for (const id of jobIds) {
        stmt.run(applied ? 1 : 0, id);
      }
    });
    transaction(ids);
    return true;
  }

  getJobsByAppliedStatus(appliedStatus = null) {
    let query = 'SELECT * FROM jobs';
    let params = [];
    
    if (appliedStatus !== null) {
      query += ' WHERE applied = ?';
      params.push(appliedStatus ? 1 : 0);
    }
    
    query += ' ORDER BY timestamp DESC';
    
    const stmt = this.db.prepare(query);
    return params.length > 0 ? stmt.all(...params) : stmt.all();
  }

  // Cookies operations
  saveCookies(platform, cookies) {
    const cookiesJson = JSON.stringify(cookies);
    const encrypted = this.encrypt(cookiesJson);
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cookies (platform, cookies_encrypted, updated_at)
      VALUES (?, ?, strftime('%s', 'now'))
    `);
    
    stmt.run(platform, encrypted);
    return true;
  }

  getCookies(platform) {
    const stmt = this.db.prepare('SELECT cookies_encrypted FROM cookies WHERE platform = ?');
    const row = stmt.get(platform);
    
    if (!row) return null;
    
    try {
      const decrypted = this.decrypt(row.cookies_encrypted);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Error decrypting cookies:', error);
      return null;
    }
  }

  getAllCookies() {
    const stmt = this.db.prepare('SELECT platform, cookies_encrypted FROM cookies');
    const rows = stmt.all();
    
    const cookies = {};
    rows.forEach(row => {
      try {
        const decrypted = this.decrypt(row.cookies_encrypted);
        cookies[row.platform] = JSON.parse(decrypted);
      } catch (error) {
        console.error(`Error decrypting cookies for ${row.platform}:`, error);
      }
    });
    
    return cookies;
  }

  // Actions operations
  saveActions(platform, actions) {
    const actionsJson = JSON.stringify(actions);
    
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO actions (platform, actions, updated_at)
      VALUES (?, ?, strftime('%s', 'now'))
    `);
    
    stmt.run(platform, actionsJson);
    return true;
  }

  getActions(platform) {
    const stmt = this.db.prepare('SELECT actions FROM actions WHERE platform = ?');
    const row = stmt.get(platform);
    
    if (!row) return null;
    
    try {
      return JSON.parse(row.actions);
    } catch (error) {
      console.error('Error parsing actions:', error);
      return null;
    }
  }

  getAllActions() {
    const stmt = this.db.prepare('SELECT platform, actions FROM actions');
    const rows = stmt.all();
    
    const actions = {};
    rows.forEach(row => {
      try {
        actions[row.platform] = JSON.parse(row.actions);
      } catch (error) {
        console.error(`Error parsing actions for ${row.platform}:`, error);
      }
    });
    
    return actions;
  }

  // Settings operations
  initializeDefaultSettings() {
    const defaults = {
      'enabled_platforms': JSON.stringify(['Jobright']),
      'ignore_keywords': JSON.stringify([]),
      'ignore_domains': JSON.stringify(['indeed.com', 'linkedin.com', 'dice.com']),
      'min_salary_annual': '120000',
      'min_salary_monthly': '',
      'min_salary_hourly': ''
    };
    
    for (const [key, value] of Object.entries(defaults)) {
      const existing = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      if (!existing) {
        this.db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(key, value);
      }
    }
  }

  getSetting(key) {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    if (!row) return null;
    
    try {
      return JSON.parse(row.value);
    } catch (err) {
      return row.value;
    }
  }

  saveSetting(key, value) {
    const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
    this.db.prepare(`
      INSERT OR REPLACE INTO settings (key, value, updated_at)
      VALUES (?, ?, strftime('%s', 'now'))
    `).run(key, valueStr);
    return true;
  }

  getAllSettings() {
    const rows = this.db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    rows.forEach(row => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch (err) {
        settings[row.key] = row.value;
      }
    });
    return settings;
  }

  close() {
    this.db.close();
  }
}

module.exports = JobDatabase;

