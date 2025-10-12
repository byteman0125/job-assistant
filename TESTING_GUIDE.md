# Testing Guide - Job Searcher

## ✅ Recent Updates

### Scraper Engine Rewrite
- **Replaced Puppeteer with Electron BrowserWindow** for more reliable scraping
- All 7 platform scrapers updated to use native Electron APIs
- Better bot avoidance with Electron's built-in capabilities
- Faster and more stable scraping

## 🧪 Testing Each Platform

### How to Test

1. **Start the application**: `npm start`
2. **Open Console**: In the app, press `Ctrl+Shift+I` (Windows) or `Cmd+Option+I` (Mac)
3. **Click "Start Scraping"** button
4. **Monitor console output** for each platform's progress

### Platform Status Checklist

#### ✅ Himalayas
- **URL**: https://himalayas.app/jobs
- **Expected**: Startup-focused remote jobs
- **Selectors**: 
  - Job cards: `a[href*="/jobs/"]`
  - Company: `.company-name, [data-company], .text-dark-aaaa`
  - Title: `.job-title, h3, .font-medium`
- **Test**: Should find 1-20 remote jobs

#### ✅ RemoteOK
- **URL**: https://remoteok.com/remote-dev-jobs
- **Expected**: Tech remote jobs
- **Selectors**:
  - Job rows: `tr.job`
  - Company: `h3`
  - Title: `h2`
  - Link: `a.preventLink`
- **Test**: Should find dev jobs quickly

#### ✅ We Work Remotely
- **URL**: https://weworkremotely.com
- **Expected**: High-quality remote positions
- **Selectors**:
  - Jobs: `li.feature a, section.jobs article a`
  - Company: `.company`
  - Title: `.title`
- **Test**: Should find North America jobs

#### ⚠️ Jobgether
- **URL**: https://jobgether.com/offers
- **Expected**: International remote jobs (filtered for US)
- **Note**: May need updated selectors if website structure changed
- **Test**: Check if any jobs are found

#### ⚠️ BuiltIn
- **URL**: https://builtin.com/jobs/remote
- **Expected**: Tech/startup jobs
- **Note**: May have bot detection, check if loading properly
- **Test**: Monitor console for errors

#### ⚠️ ZipRecruiter
- **URL**: https://www.ziprecruiter.com
- **Expected**: Large volume of jobs
- **Note**: Has moderate bot detection
- **Test**: May need cookies or updated selectors

#### ⚠️ Jobright
- **URL**: https://jobright.ai/jobs
- **Expected**: AI-matched jobs
- **Note**: Newer platform, selectors may need updates
- **Test**: Check if website structure matches selectors

## 🔧 Updating Selectors

If a platform isn't working:

### Method 1: Through UI

1. Go to **Actions** tab
2. Select the problematic platform
3. Click **Load Actions** to see current selectors
4. Open the platform website in a browser
5. Right-click → Inspect element
6. Find the correct selectors
7. Update in the Actions tab
8. Click **Save Actions**
9. Restart scraping

### Method 2: Direct Code Update

Edit the platform file in `src/main/scrapers/platforms/`:

```javascript
if (!actions) {
  actions = {
    jobCardSelector: 'YOUR_SELECTOR_HERE',
    companySelector: 'YOUR_SELECTOR_HERE',
    titleSelector: 'YOUR_SELECTOR_HERE'
  };
}
```

## 📊 Expected Console Output

When working correctly, you should see:

```
Himalayas: Navigating to https://himalayas.app/jobs...
Himalayas: Found 15 job listings
Himalayas: Processing job 1/15
Himalayas: Saved job - Acme Corp - Senior Developer
...
RemoteOK: Navigating to https://remoteok.com...
RemoteOK: Found 20 job listings
RemoteOK: Saved job - Tech Co - Full Stack Engineer
```

## 🐛 Common Issues & Fixes

### Issue: "No jobs found"
**Cause**: Selectors don't match website structure
**Fix**: Update selectors in Actions tab or platform file

### Issue: "Navigation timeout"
**Cause**: Website loading slowly or blocking
**Fix**: 
- Check internet connection
- Add platform cookies for authentication
- Increase delay times

### Issue: "Cannot find module"
**Cause**: Missing dependencies
**Fix**: Run `npm install`

### Issue: Scraper hangs on one platform
**Cause**: Website changed or bot detection triggered
**Fix**: 
- Stop scraping
- Update selectors
- Clear cookies and restart

### Issue: Jobs are duplicates
**Cause**: Database unique constraint working (this is good!)
**Fix**: No fix needed - system is preventing duplicates

## 🎯 Manual Testing Steps

### Test 1: Single Platform
```javascript
// In console (Ctrl+Shift+I), run:
const { ipcRenderer } = require('electron');
ipcRenderer.invoke('start-scraping');
// Watch console output for 5 minutes
```

### Test 2: Database Integrity
1. Let scraper run for 10 minutes
2. Go to Jobs tab
3. Check for:
   - No duplicate company+title combinations
   - All URLs are final (not tracking URLs)
   - Companies and titles are extracted correctly

### Test 3: Cookie Management
1. Go to Cookies tab
2. Paste test cookie: `[{"name":"test","value":"123"}]`
3. Select a platform
4. Click Save
5. Click Load - should show same cookie

### Test 4: System Tray
1. Close main window (X button)
2. Check tray icon is still there
3. Right-click tray → Show (window should reappear)
4. Right-click tray → Close (app should quit)

### Test 5: ChatGPT Integration
1. Paste ChatGPT cookies in Cookies tab
2. Toggle ChatGPT sidebar open (▶ button)
3. Check if ChatGPT loads
4. Try refreshing if content is frozen

## 📝 Performance Metrics

**Expected Performance:**
- 5-20 jobs per platform per cycle
- 2-5 seconds between job navigations
- ~30 minutes per complete cycle (all 7 platforms)
- 0-5% duplicate rate

**Monitoring:**
- Check "X jobs today" badge for daily count
- Jobs should appear in real-time in Jobs tab
- Console should show progress for each platform

## 🚀 Next Steps for User

1. **Test each platform** and note which ones work
2. **Update selectors** for platforms that fail
3. **Add cookies** for platforms with authentication
4. **Run overnight** to collect jobs automatically
5. **Report issues** with specific platform and error messages

## 🛠️ Developer Mode Testing

To test a single scraper in isolation:

1. Open `src/main/scrapers/platforms/himalayas.js` (or any platform)
2. Add console.log statements for debugging
3. Restart app
4. Watch console for detailed output

Example debug code:
```javascript
console.log('DEBUG: jobLinks =', jobLinks);
console.log('DEBUG: company =', company);
console.log('DEBUG: title =', title);
```

## ✨ Success Indicators

You'll know everything is working when:
- ✅ Multiple platforms show "Saved job" messages
- ✅ Jobs tab populates with new entries
- ✅ "X jobs today" badge increases
- ✅ No repeated error messages
- ✅ System tray shows notifications

---

**Current Version:** 1.0.0  
**Last Updated:** After scraper engine rewrite  
**Status:** Ready for testing

