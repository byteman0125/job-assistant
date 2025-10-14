# Software Job Filtering Feature

## Overview
The application now automatically filters out non-software/tech jobs during scraping. ChatGPT analyzes each job to determine if it's a genuine software development position.

## What Gets Filtered Out

### ❌ Non-Software Jobs (Auto-Skipped):
- AI Trainers / Content Evaluators
- Content Writers / Copywriters
- Volunteer Coordinators
- Customer Service Representatives
- Sales and Marketing (non-tech)
- Administrative Assistants
- HR Positions
- Finance / Accounting
- Civil Engineers (non-software)
- Operations Managers
- General Labor positions

### ✅ Software Jobs (Processed):
- Software Developers / Engineers
- Frontend / Backend / Full Stack Developers
- Mobile Developers (iOS, Android, React Native, Flutter)
- DevOps Engineers
- Data Scientists / Data Engineers
- QA / Test Engineers
- Security Engineers
- UI/UX Designers
- Technical Product Managers
- System Architects

## How It Works

### 1. ChatGPT Analysis
Every job page is analyzed by ChatGPT with a specific prompt that asks:
- **STEP 1:** Is this a verification/bot check page? (Skip if yes)
- **STEP 2:** Is this a SOFTWARE/TECH job requiring programming/technical skills?
- **STEP 3:** Extract job details (only for software jobs)

### 2. Automatic Filtering
If ChatGPT determines `is_software_job: false`, the scraper:
1. **Logs the skip** with reason "Not a software/tech job"
2. **Saves to database** with salary field: `"Skipped: Not software/tech job"`
3. **Marks as applied** by Bot (so it won't be scraped again)
4. **Removes from feed** (clicks "Not Interested" on Jobright)
5. **Continues to next job**

### 3. Audit Trail
All filtered jobs are still saved to the database so you can:
- See what was filtered in the Jobs tab
- Review if filtering is working correctly
- Analyze patterns in job postings
- Track filter effectiveness in Metrics tab

## Changes Made

### `src/main/gptExtractor.js`
- Updated ChatGPT prompt to include STEP 2: Software job check
- Added clear examples of software vs non-software positions
- Modified `parseResponse()` to extract `isSoftwareJob` boolean field
- Returns `isSoftwareJob` in the result object

### `src/main/scrapers/platforms/jobright.js`
- Added software job check BEFORE remote/salary checks
- Prioritizes software filtering (most important filter)
- Includes skip reason in saved job's salary field
- Logs clear message: "⚠️ Skipping - Not a software/tech job"
- Enhanced skip reason tracking:
  - "Not software/tech job"
  - "Onsite" / "Hybrid"
  - "Blocked: [platform]"
  - "Salary below minimum"

### `src/main/scrapers/platforms/himalayas.js`
- Added software job check after GPT extraction
- Saves filtered jobs with skip reason
- Marks as applied by bot
- Includes GPT data (job_type, industry, salary, tech_stack) when available
- Uses `continue` to skip non-software jobs cleanly

## Example Console Output

```
Jobright: 🤖 Analyzing with ChatGPT...
Jobright: ✅ ChatGPT analysis complete
Jobright: ⚠️ Skipping - Not a software/tech job
Jobright: 🚀 Using FAST method - clicking "Not Interested" button
Jobright: 💾 Saved and marked as applied by Bot (Reason: Not software/tech job)
Jobright: ✅ Tab closed
Jobright: ✅ Back on job list
```

## Benefits

### ✅ Time Saving
- No manual review of non-relevant jobs
- Focuses scraping on actual software positions
- Reduces database clutter

### ✅ Accuracy
- AI-powered classification is more accurate than keyword matching
- Understands context (e.g., "AI Trainer" is not a software job despite having "AI" in the title)
- Adapts to various job descriptions

### ✅ Transparency
- All filtered jobs are logged and saved
- Clear skip reasons in database
- Audit trail for reviewing filtering decisions

### ✅ Performance
- Happens early in the filtering pipeline
- Saves time on unnecessary analysis
- Prevents processing of irrelevant jobs

## Testing

To verify the feature is working:

1. **Start scraping** from a platform (Himalayas or Jobright)
2. **Watch console logs** for "⚠️ Skipping - Not a software/tech job" messages
3. **Check Jobs tab** for entries with salary: "Skipped: Not software/tech job"
4. **Verify** these jobs are marked as "Applied by Bot"
5. **Review Bug Reports tab** to ensure no errors from the new filtering

## Configuration

Currently, there's no setting to disable this filter because:
- The app is specifically for software job searching
- Non-software jobs are still saved (just marked as skipped)
- You can review filtered jobs in the database

If you want to include non-software jobs, you would need to modify the code in:
- `src/main/scrapers/platforms/jobright.js` (remove the `isSoftwareJob` check)
- `src/main/scrapers/platforms/himalayas.js` (remove the `isSoftwareJob` check)

## Future Enhancements

Potential improvements:
- Add a setting to enable/disable software job filtering
- Allow user to define custom job categories to accept/reject
- Machine learning to improve classification over time
- Whitelist certain non-software roles (e.g., Technical Writer, Developer Advocate)

