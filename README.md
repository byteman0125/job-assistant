# Job Searcher

Automated job search application for finding remote positions across multiple platforms.

## Features

- ✅ **Multi-Platform Scraping**: Searches across 7 job platforms
  - Himalayas (startup focused)
  - Jobgether (remote-first)
  - BuiltIn (tech/startup)
  - ZipRecruiter (volume + variety)
  - Jobright.ai (AI-powered)
  - RemoteOK (pure remote tech)
  - We Work Remotely (quality remote)

- ✅ **Smart Scraping**: Bot avoidance with user-agent rotation and random delays
- ✅ **Redirect Following**: Automatically follows job URLs to final destinations
- ✅ **Deduplication**: Prevents saving duplicate jobs
- ✅ **System Tray**: Runs in background with status notifications
- ✅ **ChatGPT Integration**: AI-powered data extraction and job classification
- ✅ **Cookie Management**: Secure cookie storage for authentication
- ✅ **Action Manager**: Configurable scraper selectors per platform
- ✅ **Modern UI**: Dark theme with intuitive interface
- ✅ **Cross-Platform**: Windows, macOS, and Linux support

## Prerequisites

**Important**: Job Assistant now requires an **external Ollama service** to be running.

### 1. Install and Start Ollama Service
```bash
# Option A: Use the deployment script (recommended)
cd /path/to/Job\ Radar1.3/
sudo ./llama-service-deploy.sh

# Option B: Manual setup
ollama serve  # In a separate terminal/service
```

### 2. Ensure Model is Available
```bash
ollama pull llama3.2:3b
```

## Installation

```bash
# Install dependencies
npm install

# Run in development (requires external Ollama service)
npm start

# Build for production
npm run build

# Build for specific platform
npm run build:win   # Windows
npm run build:mac   # macOS
npm run build:linux # Linux
```

**Note**: The `start-manual` script no longer starts Ollama automatically. You must start the Ollama service separately.

## Usage

1. **Start Application**: Launch Job Searcher
2. **Configure Cookies** (optional): Add cookies for ChatGPT and job platforms
3. **Start Scraping**: Click "Start Scraping" button
4. **View Jobs**: Browse found jobs in the Jobs tab
5. **Copy Job Info**: Click copy button to save job details to clipboard
6. **System Tray**: App runs in background, check tray icon for new job count

## Configuration

### Cookies
Navigate to Cookies tab and paste JSON formatted cookies:
```json
[
  {"name":"cookie_name","value":"cookie_value"},
  {"name":"session","value":"abc123"}
]
```

### Actions
Configure platform-specific selectors in the Actions tab:
```json
{
  "jobCardSelector": ".job-card",
  "companySelector": ".company-name",
  "titleSelector": ".job-title"
}
```

## Database

Uses SQLite with better-sqlite3 for fast, offline storage.

**Schema:**
- Jobs: company, title, url, platform, timestamp, salary, tech_stack, is_remote, is_startup, location
- Cookies: platform-specific encrypted cookies
- Actions: platform-specific scraper configurations

## Development

Project structure:
```
job-searcher/
├── src/
│   ├── main/
│   │   ├── main.js           # Main Electron process
│   │   ├── database.js       # SQLite database
│   │   └── scrapers/         # Platform scrapers
│   └── renderer/
│       ├── index.html        # Main UI
│       ├── styles.css        # Styling
│       └── renderer.js       # UI logic
├── assets/                   # Icons
└── package.json
```

## Requirements

- Node.js 18+
- Windows 10+, macOS 10.13+, or Linux

## License

ISC

