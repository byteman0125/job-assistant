# Quick Start Guide - Job Searcher

## 🚀 Getting Started

### 1. Start the Application
```bash
npm start
```

### 2. First-Time Setup

#### Configure ChatGPT (Optional but Recommended)
1. Click the **Cookies** tab
2. Select "ChatGPT" from the platform dropdown
3. Paste your ChatGPT cookies in JSON format
4. Click "Save Cookies"

Example cookie format:
```json
[
  {"name":"oai-did","value":"your-value-here"},
  {"name":"__Secure-next-auth.session-token","value":"your-session-token"}
]
```

#### Configure Platform Cookies (Optional)
- Repeat for each job platform if needed
- Helps avoid bot detection

### 3. Start Scraping

1. Click **"Start Scraping"** button in the top bar
2. Watch the status change to "● Running"
3. New jobs will appear in the Jobs tab automatically
4. Check the "X jobs today" badge for daily count

### 4. View & Manage Jobs

**Jobs Tab Features:**
- 🔍 **Search**: Filter by company or job title
- 📊 **Filter**: Select specific platform
- 🔗 **Open**: Click to open job URL in browser
- 📋 **Copy**: Copy all job details to clipboard
- 🗑️ **Delete**: Remove unwanted jobs
- 🔄 **Refresh**: Reload jobs list

### 5. System Tray Features

**Right-click the tray icon for:**
- Show/Hide window
- Start/Stop scraping
- View today's job count
- Close application

**Important:** Closing the window (X button) hides to tray - app keeps running!

## 🎯 Usage Tips

### Bot Avoidance
- Scrapers use random delays (2-5 seconds)
- Rotating user agents
- Cookie persistence
- Automatic redirect following

### Action Manager
If a scraper isn't working:
1. Go to **Actions** tab
2. Select the platform
3. Update selectors if website structure changed
4. Save and restart scraping

Example selectors:
```json
{
  "jobCardSelector": ".job-listing",
  "companySelector": ".company-name",
  "titleSelector": ".job-title"
}
```

### ChatGPT Integration
The right sidebar shows ChatGPT interface:
- **Refresh**: If content freezes
- **Toggle**: Hide/show sidebar with ◀/▶ button
- **Auto-use**: Scrapers will send job data to ChatGPT for classification

## 📦 Building for Production

### Build All Platforms
```bash
npm run build
```

### Build Specific Platform
```bash
npm run build:win    # Windows .exe
npm run build:mac    # macOS .dmg
npm run build:linux  # Linux .AppImage/.deb
```

Output will be in the `dist/` folder.

## 🔧 Troubleshooting

### Application Won't Start
- Check console for errors
- Verify all dependencies installed: `npm install`
- Try deleting `node_modules` and reinstalling

### No Jobs Found
- Check internet connection
- Verify platforms are accessible
- Try adding cookies for authentication
- Check Actions tab for correct selectors

### Scraper Errors
- Platform website may have changed structure
- Update selectors in Actions tab
- Check if cookies are expired
- Some platforms may have bot detection - add delays

### ChatGPT Not Loading
- Check cookies are saved correctly
- Try refreshing the webview
- Verify you're logged into ChatGPT in a browser first

## 📊 Database Location

SQLite database is stored at:
- **Windows**: `C:\Users\{username}\AppData\Roaming\job-searcher\jobs.db`
- **macOS**: `~/Library/Application Support/job-searcher/jobs.db`
- **Linux**: `~/.config/job-searcher/jobs.db`

## 🎨 Customization

### Icons
Replace files in `assets/`:
- `icon.png` (512x512) - Main app icon
- `tray-icon.png` (32x32) - System tray icon
- Then rebuild the app

### Add New Platforms
1. Create new scraper in `src/main/scrapers/platforms/`
2. Extend `BaseScraper` class
3. Add to `scraperManager.js`
4. Update UI dropdowns in `index.html`

## 🔐 Security

- Cookies are encrypted using AES-256
- Database is local-only (no cloud sync)
- No data is sent anywhere except to platforms being scraped
- ChatGPT integration uses your existing session

## 📝 Notes

- Scraping runs every 30 minutes by default
- Processes up to 20 jobs per platform per cycle
- Duplicates are automatically prevented
- US-only and fully remote filters applied
- Redirected URLs are automatically followed and saved

Enjoy your automated job search! 🎉

