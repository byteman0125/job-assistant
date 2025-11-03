# Windows Setup Guide

## 📋 Prerequisites

### 1. Install Node.js
1. Download Node.js 18+ from [nodejs.org](https://nodejs.org/)
2. Run the installer (use default settings)
3. Verify installation:
```cmd
node --version
npm --version
```

### 2. Install Git (Optional, for cloning)
Download from [git-scm.com](https://git-scm.com/download/win)

## 🚀 Installation Steps

### Option A: Clone from GitHub
```cmd
git clone https://github.com/byteman0125/job-assistant.git
cd job-assistant
npm install
npx electron-rebuild
```

### Option B: Download ZIP
1. Download the project ZIP
2. Extract to a folder (e.g., `C:\job-assistant`)
3. Open Command Prompt or PowerShell
4. Navigate to the folder:
```cmd
cd C:\job-assistant
```
5. Install dependencies:
```cmd
npm install
npx electron-rebuild
```

## ▶️ Running the App

### From Command Prompt
```cmd
npm start
```

### From PowerShell
```powershell
npm start
```

The app will open automatically!

## 🔧 Setting Environment Variables

### Temporary (Current Session Only)

**Command Prompt:**
```cmd
set NODE_OPTIONS=--no-deprecation
set NODE_ENV=production
npm start
```

**PowerShell:**
```powershell
$env:NODE_OPTIONS="--no-deprecation"
$env:NODE_ENV="production"
npm start
```

### Permanent (System-Wide)

**Method 1: GUI**
1. Press `Win + R`, type `sysdm.cpl`, press Enter
2. Go to "Advanced" tab
3. Click "Environment Variables"
4. Under "User variables", click "New"
5. Variable name: `NODE_OPTIONS`
6. Variable value: `--no-deprecation`
7. Click OK

**Method 2: Command Prompt (as Administrator)**
```cmd
setx NODE_OPTIONS "--no-deprecation"
setx NODE_ENV "production"
```

**Method 3: PowerShell (as Administrator)**
```powershell
[System.Environment]::SetEnvironmentVariable("NODE_OPTIONS", "--no-deprecation", "User")
[System.Environment]::SetEnvironmentVariable("NODE_ENV", "production", "User")
```

**Note:** After setting permanent environment variables, restart your terminal/Command Prompt.

## 📦 Building for Windows

### Create .exe Installer
```cmd
npm run build:win
```

The installer will be created in `dist\` folder:
- `Job Searcher Setup x.x.x.exe` - NSIS installer

### Running the Built App
1. Navigate to `dist` folder
2. Run the `.exe` installer
3. Follow installation wizard
4. App will be installed to `C:\Users\{YourUsername}\AppData\Local\Programs\job-searcher`

## 📁 Data Locations on Windows

### Database
```
C:\Users\{YourUsername}\AppData\Roaming\job-searcher\jobs.db
```

### App Data
```
C:\Users\{YourUsername}\AppData\Roaming\job-searcher\
```

### To Open AppData Folder
1. Press `Win + R`
2. Type: `%APPDATA%\job-searcher`
3. Press Enter

## 🛠️ Troubleshooting

### Python/Visual Studio Build Tools Required

If you see errors about "python" or "Visual Studio Build Tools":

**Quick Fix:**
```cmd
npm install --global windows-build-tools
```

**Or install manually:**
1. Install Python 3.x from [python.org](https://www.python.org/downloads/)
2. Install Visual Studio Build Tools from [visualstudio.microsoft.com](https://visualstudio.microsoft.com/downloads/)
   - Select "Desktop development with C++"

### better-sqlite3 Errors

```cmd
npm install better-sqlite3 --build-from-source
npx electron-rebuild
```

### Port Already in Use

If you see "Port already in use":
1. Find the process:
```cmd
netstat -ano | findstr :3000
```
2. Kill it:
```cmd
taskkill /PID <process_id> /F
```

### App Won't Start

1. Delete `node_modules` and reinstall:
```cmd
rmdir /s /q node_modules
npm install
npx electron-rebuild
npm start
```

2. Clear npm cache:
```cmd
npm cache clean --force
```

### Permission Errors

Run Command Prompt or PowerShell as Administrator:
- Right-click → "Run as administrator"

## 🎯 Quick Command Reference

| Task | Command |
|------|---------|
| Install dependencies | `npm install` |
| Rebuild native modules | `npx electron-rebuild` |
| Start app (development) | `npm start` |
| Build Windows installer | `npm run build:win` |
| Clear cache | `npm cache clean --force` |
| Check Node version | `node --version` |
| Check npm version | `npm --version` |

## 🔥 Creating Desktop Shortcut

### After Building
The installer creates shortcuts automatically in:
- Start Menu
- Desktop (optional during install)

### During Development (before building)

**Create a batch file:**
1. Create a file named `JobSearcher.bat` on your desktop
2. Add this content:
```batch
@echo off
cd C:\path\to\job-assistant
start npm start
```
3. Double-click to run

**Or create a PowerShell script:**
1. Create `JobSearcher.ps1`:
```powershell
Set-Location "C:\path\to\job-assistant"
npm start
```
2. Right-click → "Run with PowerShell"

## 🚀 Running on Startup

### Method 1: Task Scheduler
1. Press `Win + R`, type `taskschd.msc`
2. Create Basic Task
3. Name: "Job Assistant"
4. Trigger: "When I log on"
5. Action: "Start a program"
6. Program: `C:\path\to\npm.cmd`
7. Arguments: `start`
8. Start in: `C:\path\to\job-assistant`

### Method 2: Startup Folder (Built App Only)
1. Press `Win + R`, type: `shell:startup`
2. Create shortcut to `Job Searcher.exe`
3. Paste shortcut in Startup folder

## 💡 Pro Tips

1. **Use PowerShell 7**: Better terminal experience
   - Install from Microsoft Store: "PowerShell"

2. **Windows Terminal**: Modern terminal
   - Install from Microsoft Store: "Windows Terminal"

3. **Visual Studio Code**: Best for development
   - Download from [code.visualstudio.com](https://code.visualstudio.com/)

4. **Run as Administrator**: If you encounter permission issues

5. **Antivirus**: May flag Puppeteer/Electron
   - Add folder to antivirus exclusions

## 📞 Need Help?

If you encounter issues:
1. Check error messages carefully
2. Make sure Node.js 18+ is installed
3. Try running as Administrator
4. Delete `node_modules` and reinstall
5. Check GitHub issues

Happy job hunting! 🎉

