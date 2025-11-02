const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { app } = require('electron');

class JobDatabase {
  constructor() {
    // Store database in project data folder
    const dataDir = path.join(process.cwd(), 'data');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      console.log('Created data directory:', dataDir);
    }
    
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
        job_type TEXT,
        industry TEXT,
        applied BOOLEAN DEFAULT 0,
        applied_by TEXT DEFAULT 'None',
        applied_date INTEGER,
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
    
    // Add applied_by column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE jobs ADD COLUMN applied_by TEXT DEFAULT 'None'`);
    } catch (err) {
      // Column already exists, ignore
    }
    
    // Add applied_date column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE jobs ADD COLUMN applied_date INTEGER`);
    } catch (err) {
      // Column already exists, ignore
    }
    
    // Add job_type column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE jobs ADD COLUMN job_type TEXT`);
    } catch (err) {
      // Column already exists, ignore
    }
    
    // Add industry column if it doesn't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE jobs ADD COLUMN industry TEXT`);
    } catch (err) {
      // Column already exists, ignore
    }

    // Cookies table (encrypted) - legacy single set per platform
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cookies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT UNIQUE NOT NULL,
        cookies_encrypted TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Cookie sets table - multiple cookie sets per platform
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cookie_sets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        label TEXT,
        cookies_encrypted TEXT NOT NULL,
        is_active BOOLEAN DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        last_used INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_cookie_sets_platform ON cookie_sets(platform);`);

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

    // Profile table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profile (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name TEXT,
        last_name TEXT,
        email TEXT,
        phone TEXT,
        linkedin_url TEXT,
        github_url TEXT,
        portfolio_url TEXT,
        address TEXT,
        city TEXT,
        state TEXT,
        zip_code TEXT,
        country TEXT,
        job_title TEXT,
        years_experience INTEGER,
        skills TEXT,
        summary TEXT,
        work_authorization TEXT,
        sponsorship_required TEXT,
        desired_salary INTEGER,
        min_salary_annual INTEGER,
        min_salary_monthly INTEGER,
        min_salary_hourly INTEGER,
        notice_period TEXT,
        work_type TEXT,
        employment_type TEXT,
        resume_path TEXT,
        cover_letter_path TEXT,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
    
    // Add salary columns if they don't exist (for existing databases)
    try {
      this.db.exec(`ALTER TABLE profile ADD COLUMN min_salary_annual INTEGER`);
    } catch (e) { /* Column already exists */ }
    try {
      this.db.exec(`ALTER TABLE profile ADD COLUMN min_salary_monthly INTEGER`);
    } catch (e) { /* Column already exists */ }
    try {
      this.db.exec(`ALTER TABLE profile ADD COLUMN min_salary_hourly INTEGER`);
    } catch (e) { /* Column already exists */ }

    // Work Experience table (kept for profile purposes, not linked to resumes)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_experience (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company TEXT NOT NULL,
        job_title TEXT NOT NULL,
        location TEXT,
        start_date TEXT,
        end_date TEXT,
        is_current BOOLEAN DEFAULT 0,
        description TEXT,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Education table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS education (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        school TEXT NOT NULL,
        degree TEXT NOT NULL,
        field_of_study TEXT,
        location TEXT,
        start_date TEXT,
        end_date TEXT,
        is_current BOOLEAN DEFAULT 0,
        gpa TEXT,
        description TEXT,
        order_index INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Resumes table - Support multiple resumes with tech stack labels
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS resumes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        tech_stack TEXT,
        description TEXT,
        work_experiences_json TEXT,
        is_primary BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
    
    // Add work_experiences_json column to existing resumes table
    try {
      this.db.exec(`ALTER TABLE resumes ADD COLUMN work_experiences_json TEXT`);
    } catch (err) {
      // Column already exists, ignore
    }

    // Bug Reports table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS bug_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        platform TEXT NOT NULL,
        error_type TEXT NOT NULL,
        error_message TEXT NOT NULL,
        error_stack TEXT,
        url TEXT,
        job_title TEXT,
        job_company TEXT,
        status TEXT DEFAULT 'open',
        occurrence_count INTEGER DEFAULT 1,
        first_seen INTEGER DEFAULT (strftime('%s', 'now')),
        last_seen INTEGER DEFAULT (strftime('%s', 'now')),
        notes TEXT
      )
    `);
    
    // Create index for faster duplicate detection
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_bug_deduplication 
      ON bug_reports(platform, error_type, error_message);
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
      (company, title, url, platform, timestamp, salary, tech_stack, is_remote, is_startup, location, job_type, industry)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      job.location ? String(job.location) : null,
      job.job_type ? String(job.job_type) : null,
      job.industry ? String(job.industry) : null
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

  updateJobDetails(id, jobData) {
    const stmt = this.db.prepare(`
      UPDATE jobs SET
        salary = ?,
        tech_stack = ?,
        is_remote = ?,
        is_startup = ?,
        location = ?,
        job_type = ?,
        industry = ?
      WHERE id = ?
    `);
    const result = stmt.run(
      jobData.salary || null,
      jobData.tech_stack || null,
      jobData.is_remote !== undefined ? (jobData.is_remote ? 1 : 0) : null,
      jobData.is_startup !== undefined ? (jobData.is_startup ? 1 : 0) : null,
      jobData.location || null,
      jobData.job_type || null,
      jobData.industry || null,
      id
    );
    return result.changes > 0;
  }

  updateJobAppliedStatus(id, applied, appliedBy = 'User') {
    const appliedDate = applied ? Date.now() : null;
    const appliedByValue = applied ? appliedBy : 'None';
    const stmt = this.db.prepare('UPDATE jobs SET applied = ?, applied_by = ?, applied_date = ? WHERE id = ?');
    const result = stmt.run(applied ? 1 : 0, appliedByValue, appliedDate, id);
    return result.changes > 0;
  }

  updateMultipleJobsAppliedStatus(ids, applied, appliedBy = 'User') {
    const appliedDate = applied ? Date.now() : null;
    const appliedByValue = applied ? appliedBy : 'None';
    const stmt = this.db.prepare('UPDATE jobs SET applied = ?, applied_by = ?, applied_date = ? WHERE id = ?');
    const transaction = this.db.transaction((jobIds) => {
      for (const id of jobIds) {
        stmt.run(applied ? 1 : 0, appliedByValue, appliedDate, id);
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

  // Cookie sets operations (multiple per platform)
  saveCookieSet(platform, label, cookies) {
    const cookiesJson = JSON.stringify(cookies);
    const encrypted = this.encrypt(cookiesJson);
    const now = Math.floor(Date.now() / 1000);
    const existingCount = this.db.prepare('SELECT COUNT(1) AS cnt FROM cookie_sets WHERE platform = ?').get(platform).cnt;
    const isActive = existingCount === 0 ? 1 : 0;
    const stmt = this.db.prepare(`
      INSERT INTO cookie_sets (platform, label, cookies_encrypted, is_active, usage_count, last_used, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, 0, ?, ?)
    `);
    const res = stmt.run(platform, label || null, encrypted, isActive, now, now);
    return res.lastInsertRowid;
  }

  getCookieSets(platform) {
    const rows = this.db.prepare('SELECT * FROM cookie_sets WHERE platform = ? ORDER BY is_active DESC, last_used ASC, id ASC').all(platform);
    return rows.map(r => ({
      id: r.id,
      platform: r.platform,
      label: r.label,
      is_active: !!r.is_active,
      usage_count: r.usage_count,
      last_used: r.last_used,
      created_at: r.created_at,
      updated_at: r.updated_at
    }));
  }

  getActiveCookieSet(platform) {
    const row = this.db.prepare('SELECT * FROM cookie_sets WHERE platform = ? AND is_active = 1 LIMIT 1').get(platform);
    if (!row) return null;
    try {
      const decrypted = this.decrypt(row.cookies_encrypted);
      return { id: row.id, cookies: JSON.parse(decrypted) };
    } catch (e) {
      console.error('Error decrypting active cookie set:', e);
      return null;
    }
  }

  rotateCookieSet(platform) {
    const next = this.db.prepare('SELECT id FROM cookie_sets WHERE platform = ? ORDER BY last_used ASC, id ASC LIMIT 1').get(platform);
    if (!next) return null;
    const now = Math.floor(Date.now() / 1000);
    const tx = this.db.transaction(() => {
      this.db.prepare('UPDATE cookie_sets SET is_active = 0 WHERE platform = ?').run(platform);
      this.db.prepare('UPDATE cookie_sets SET is_active = 1, updated_at = ? WHERE id = ?').run(now, next.id);
    });
    tx();
    return this.getActiveCookieSet(platform);
  }

  markCookieSetUsed(id) {
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare('UPDATE cookie_sets SET usage_count = usage_count + 1, last_used = ?, updated_at = ? WHERE id = ?').run(now, now, id);
  }

  deleteCookieSet(id) {
    const stmt = this.db.prepare('DELETE FROM cookie_sets WHERE id = ?');
    const res = stmt.run(id);
    return res.changes > 0;
  }

  clearCookies(platform) {
    // Remove legacy single-set cookies and all cookie_sets for platform
    this.db.prepare('DELETE FROM cookies WHERE platform = ?').run(platform);
    this.db.prepare('DELETE FROM cookie_sets WHERE platform = ?').run(platform);
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

  // Profile methods
  saveProfile(profileData) {
    // Check if profile exists
    const existing = this.db.prepare('SELECT id FROM profile LIMIT 1').get();
    
    if (existing) {
      // Update existing profile
      const stmt = this.db.prepare(`
        UPDATE profile SET
          first_name = ?,
          last_name = ?,
          email = ?,
          phone = ?,
          linkedin_url = ?,
          github_url = ?,
          portfolio_url = ?,
          address = ?,
          city = ?,
          state = ?,
          zip_code = ?,
          country = ?,
          job_title = ?,
          years_experience = ?,
          skills = ?,
          summary = ?,
          work_authorization = ?,
          sponsorship_required = ?,
          desired_salary = ?,
          min_salary_annual = ?,
          min_salary_monthly = ?,
          min_salary_hourly = ?,
          notice_period = ?,
          work_type = ?,
          employment_type = ?,
          resume_path = ?,
          cover_letter_path = ?,
          updated_at = ?
        WHERE id = ?
      `);
      
      stmt.run(
        profileData.first_name || null,
        profileData.last_name || null,
        profileData.email || null,
        profileData.phone || null,
        profileData.linkedin_url || null,
        profileData.github_url || null,
        profileData.portfolio_url || null,
        profileData.address || null,
        profileData.city || null,
        profileData.state || null,
        profileData.zip_code || null,
        profileData.country || null,
        profileData.job_title || null,
        profileData.years_experience || null,
        profileData.skills || null,
        profileData.summary || null,
        profileData.work_authorization || null,
        profileData.sponsorship_required || null,
        profileData.desired_salary || null,
        profileData.min_salary_annual || null,
        profileData.min_salary_monthly || null,
        profileData.min_salary_hourly || null,
        profileData.notice_period || null,
        profileData.work_type || null,
        profileData.employment_type || null,
        profileData.resume_path || null,
        profileData.cover_letter_path || null,
        Math.floor(Date.now() / 1000),
        existing.id
      );
    } else {
      // Insert new profile
      const stmt = this.db.prepare(`
        INSERT INTO profile (
          first_name, last_name, email, phone,
          linkedin_url, github_url, portfolio_url,
          address, city, state, zip_code, country,
          job_title, years_experience, skills, summary,
          work_authorization, sponsorship_required,
          desired_salary, min_salary_annual, min_salary_monthly, min_salary_hourly,
          notice_period, work_type,
          employment_type, resume_path, cover_letter_path,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        profileData.first_name || null,
        profileData.last_name || null,
        profileData.email || null,
        profileData.phone || null,
        profileData.linkedin_url || null,
        profileData.github_url || null,
        profileData.portfolio_url || null,
        profileData.address || null,
        profileData.city || null,
        profileData.state || null,
        profileData.zip_code || null,
        profileData.country || null,
        profileData.job_title || null,
        profileData.years_experience || null,
        profileData.skills || null,
        profileData.summary || null,
        profileData.work_authorization || null,
        profileData.sponsorship_required || null,
        profileData.desired_salary || null,
        profileData.min_salary_annual || null,
        profileData.min_salary_monthly || null,
        profileData.min_salary_hourly || null,
        profileData.notice_period || null,
        profileData.work_type || null,
        profileData.employment_type || null,
        profileData.resume_path || null,
        profileData.cover_letter_path || null,
        Math.floor(Date.now() / 1000)
      );
    }
  }

  getProfile() {
    return this.db.prepare('SELECT * FROM profile LIMIT 1').get() || null;
  }

  clearProfile() {
    this.db.prepare('DELETE FROM profile').run();
  }

  // ========================================
  // Work Experience Methods (for profile only, not resume-specific)
  // ========================================
  
  getAllWorkExperience() {
    return this.db.prepare('SELECT * FROM work_experience ORDER BY order_index ASC, created_at DESC').all();
  }

  saveWorkExperience(expData) {
    const stmt = this.db.prepare(`
      INSERT INTO work_experience (company, job_title, location, start_date, end_date, is_current, description, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      expData.company,
      expData.job_title,
      expData.location || null,
      expData.start_date || null,
      expData.end_date || null,
      expData.is_current ? 1 : 0,
      expData.description || null,
      expData.order_index || 0
    );
    return result.lastInsertRowid;
  }

  updateWorkExperience(id, expData) {
    const stmt = this.db.prepare(`
      UPDATE work_experience 
      SET company = ?, job_title = ?, location = ?, start_date = ?, end_date = ?, 
          is_current = ?, description = ?, order_index = ?
      WHERE id = ?
    `);
    stmt.run(
      expData.company,
      expData.job_title,
      expData.location || null,
      expData.start_date || null,
      expData.end_date || null,
      expData.is_current ? 1 : 0,
      expData.description || null,
      expData.order_index || 0,
      id
    );
  }

  deleteWorkExperience(id) {
    this.db.prepare('DELETE FROM work_experience WHERE id = ?').run(id);
  }

  clearAllWorkExperience() {
    this.db.prepare('DELETE FROM work_experience').run();
  }

  // ========================================
  // Education Methods
  // ========================================
  
  getAllEducation() {
    return this.db.prepare('SELECT * FROM education ORDER BY order_index ASC, created_at DESC').all();
  }

  saveEducation(eduData) {
    const stmt = this.db.prepare(`
      INSERT INTO education (school, degree, field_of_study, location, start_date, end_date, is_current, gpa, description, order_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      eduData.school,
      eduData.degree,
      eduData.field_of_study || null,
      eduData.location || null,
      eduData.start_date || null,
      eduData.end_date || null,
      eduData.is_current ? 1 : 0,
      eduData.gpa || null,
      eduData.description || null,
      eduData.order_index || 0
    );
    return result.lastInsertRowid;
  }

  updateEducation(id, eduData) {
    const stmt = this.db.prepare(`
      UPDATE education 
      SET school = ?, degree = ?, field_of_study = ?, location = ?, start_date = ?, 
          end_date = ?, is_current = ?, gpa = ?, description = ?, order_index = ?
      WHERE id = ?
    `);
    stmt.run(
      eduData.school,
      eduData.degree,
      eduData.field_of_study || null,
      eduData.location || null,
      eduData.start_date || null,
      eduData.end_date || null,
      eduData.is_current ? 1 : 0,
      eduData.gpa || null,
      eduData.description || null,
      eduData.order_index || 0,
      id
    );
  }

  deleteEducation(id) {
    this.db.prepare('DELETE FROM education WHERE id = ?').run(id);
  }

  clearAllEducation() {
    this.db.prepare('DELETE FROM education').run();
  }

  // ========================================
  // Bug Report Methods
  // ========================================
  
  reportBug(bugData) {
    // Check for duplicate (same platform, error_type, and error_message)
    const existing = this.db.prepare(`
      SELECT * FROM bug_reports 
      WHERE platform = ? AND error_type = ? AND error_message = ? AND status != 'resolved'
    `).get(bugData.platform, bugData.error_type, bugData.error_message);
    
    if (existing) {
      // Update existing bug: increment count and update last_seen
      this.db.prepare(`
        UPDATE bug_reports 
        SET occurrence_count = occurrence_count + 1,
            last_seen = strftime('%s', 'now'),
            url = COALESCE(?, url),
            job_title = COALESCE(?, job_title),
            job_company = COALESCE(?, job_company)
        WHERE id = ?
      `).run(bugData.url || null, bugData.job_title || null, bugData.job_company || null, existing.id);
      
      return existing.id;
    } else {
      // Insert new bug
      const stmt = this.db.prepare(`
        INSERT INTO bug_reports (platform, error_type, error_message, error_stack, url, job_title, job_company)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        bugData.platform,
        bugData.error_type,
        bugData.error_message,
        bugData.error_stack || null,
        bugData.url || null,
        bugData.job_title || null,
        bugData.job_company || null
      );
      return result.lastInsertRowid;
    }
  }
  
  getAllBugs(filter = {}) {
    let query = 'SELECT * FROM bug_reports WHERE 1=1';
    const params = [];
    
    if (filter.platform) {
      query += ' AND platform = ?';
      params.push(filter.platform);
    }
    
    if (filter.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    
    if (filter.error_type) {
      query += ' AND error_type = ?';
      params.push(filter.error_type);
    }
    
    query += ' ORDER BY last_seen DESC';
    
    return this.db.prepare(query).all(...params);
  }
  
  getBugById(id) {
    return this.db.prepare('SELECT * FROM bug_reports WHERE id = ?').get(id);
  }
  
  updateBugStatus(id, status, notes = null) {
    const stmt = this.db.prepare(`
      UPDATE bug_reports 
      SET status = ?, notes = COALESCE(?, notes)
      WHERE id = ?
    `);
    stmt.run(status, notes, id);
  }
  
  deleteBug(id) {
    this.db.prepare('DELETE FROM bug_reports WHERE id = ?').run(id);
  }
  
  clearAllBugs() {
    this.db.prepare('DELETE FROM bug_reports').run();
  }
  
  getBugStats() {
    const stats = this.db.prepare(`
      SELECT 
        platform,
        error_type,
        status,
        COUNT(*) as count,
        SUM(occurrence_count) as total_occurrences
      FROM bug_reports
      GROUP BY platform, error_type, status
    `).all();
    
    return stats;
  }

  // ========================================
  // Resume Methods
  // ========================================
  
  addResume(resumeData) {
    const stmt = this.db.prepare(`
      INSERT INTO resumes (label, file_name, file_path, tech_stack, description, work_experiences_json, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      resumeData.label,
      resumeData.file_name,
      resumeData.file_path,
      resumeData.tech_stack || null,
      resumeData.description || null,
      resumeData.work_experiences_json || null,
      resumeData.is_primary || 0
    );
    
    // If this is marked as primary, unset other primaries
    if (resumeData.is_primary) {
      this.db.prepare(`
        UPDATE resumes SET is_primary = 0 WHERE id != ?
      `).run(result.lastInsertRowid);
    }
    
    return result.lastInsertRowid;
  }
  
  getAllResumes() {
    return this.db.prepare('SELECT * FROM resumes ORDER BY is_primary DESC, created_at DESC').all();
  }
  
  getResumeById(id) {
    return this.db.prepare('SELECT * FROM resumes WHERE id = ?').get(id);
  }
  
  getPrimaryResume() {
    return this.db.prepare('SELECT * FROM resumes WHERE is_primary = 1 LIMIT 1').get();
  }
  
  updateResume(id, resumeData) {
    const stmt = this.db.prepare(`
      UPDATE resumes SET
        label = ?,
        tech_stack = ?,
        description = ?,
        work_experiences_json = ?,
        is_primary = ?,
        updated_at = strftime('%s', 'now')
      WHERE id = ?
    `);
    stmt.run(
      resumeData.label,
      resumeData.tech_stack || null,
      resumeData.description || null,
      resumeData.work_experiences_json || null,
      resumeData.is_primary || 0,
      id
    );
    
    // If this is marked as primary, unset other primaries
    if (resumeData.is_primary) {
      this.db.prepare(`
        UPDATE resumes SET is_primary = 0 WHERE id != ?
      `).run(id);
    }
  }
  
  deleteResume(id) {
    this.db.prepare('DELETE FROM resumes WHERE id = ?').run(id);
  }
  
  // Get best matching resume for a job based on tech stack
  getMatchingResume(jobTechStack) {
    if (!jobTechStack) {
      return this.getPrimaryResume();
    }
    
    // Get all resumes and calculate match score
    const resumes = this.getAllResumes();
    if (resumes.length === 0) return null;
    
    const jobTechs = jobTechStack.toLowerCase().split(/[,\s]+/).filter(t => t.length > 0);
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const resume of resumes) {
      if (!resume.tech_stack) continue;
      
      const resumeTechs = resume.tech_stack.toLowerCase().split(/[,\s]+/).filter(t => t.length > 0);
      
      // Calculate match score (number of matching technologies)
      let score = 0;
      for (const jobTech of jobTechs) {
        for (const resumeTech of resumeTechs) {
          if (jobTech.includes(resumeTech) || resumeTech.includes(jobTech)) {
            score++;
          }
        }
      }
      
      // Boost primary resume slightly
      if (resume.is_primary) {
        score += 0.5;
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = resume;
      }
    }
    
    // If no match found, return primary resume
    return bestMatch || this.getPrimaryResume();
  }

  close() {
    this.db.close();
  }
}

module.exports = JobDatabase;

