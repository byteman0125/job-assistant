# Google Sheets Integration Setup Guide

## 📋 Overview

This guide will help you set up Google Sheets integration to automatically save new jobs to a public Google Sheet.

## 🔑 Why Authentication is Needed

Even if your Google Sheet is **public** (anyone can view/edit via web), the **Google Sheets API** still requires authentication for programmatic write access. This is a security requirement from Google.

**Solution:** Use a **Service Account** (automated, no user interaction needed)

## 📝 Step-by-Step Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Name it: "Job Assistant" (or any name)

### Step 2: Enable APIs

1. Go to **APIs & Services** → **Library**
2. Search and enable:
   - **Google Sheets API**
   - **Google Drive API** (if needed)

### Step 3: Create Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Fill in:
   - **Service account name**: `job-assistant-sheets`
   - **Service account ID**: (auto-generated)
   - Click **Create and Continue**
4. Skip role assignment (click **Continue**)
5. Click **Done**

### Step 4: Create Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Click **Create**
6. **Download the JSON file** - this is your credentials!

### Step 5: Create Google Sheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new sheet
3. Set up headers in Row 1:
   ```
   Company | Title | URL | Platform | Location | Salary | Tech Stack | Remote | Startup | Date | Job Type | Industry
   ```
4. **Make sheet public OR share with service account:**
   - **Option A (Public):**
     - Click **Share** → **Change to anyone with the link** → **Editor**
   - **Option B (Private but shared):**
     - Click **Share**
     - Add the service account email (from JSON file: `client_email`)
     - Give it **Editor** permission

### Step 6: Get Sheet ID

From your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
```

Copy the `SHEET_ID_HERE` part.

### Step 7: Configure in Job Assistant

1. Open Job Assistant app
2. Go to **Settings** tab
3. Find **Google Sheets** section
4. Enter:
   - **Sheet ID**: Paste the sheet ID from Step 6
   - **Credentials**: Open the JSON file from Step 4, copy entire contents, paste here
5. Click **Save**
6. Click **Test Connection** to verify

## ✅ Verification

After setup:
1. Start scraping jobs
2. When a new job is found and saved to database
3. It will automatically appear in your Google Sheet
4. Check console logs for: `📊 Google Sheets: ✅ Job saved to sheet`

## 🔧 Troubleshooting

### Error: "Not initialized"
- Check if credentials JSON is valid
- Verify Sheet ID is correct

### Error: "Permission denied"
- Make sure sheet is shared with service account email
- Or make sheet public with edit permissions

### Error: "Sheet not found"
- Verify Sheet ID is correct
- Check if sheet exists and is accessible

### Jobs not appearing
- Check console logs for errors
- Verify Google Sheets API is enabled
- Test connection in Settings

## 📊 Sheet Structure

Default columns (you can customize):
1. **Company** - Company name
2. **Title** - Job title
3. **URL** - Job application URL
4. **Platform** - Source platform (Jobright, BuiltIn, etc.)
5. **Location** - Job location
6. **Salary** - Salary information
7. **Tech Stack** - Technologies required
8. **Remote** - Yes/No
9. **Startup** - Yes/No
10. **Date** - Date found (YYYY-MM-DD)
11. **Job Type** - Full-time, Contract, etc.
12. **Industry** - Industry sector

## 🔒 Security Notes

- **Service Account JSON** contains sensitive credentials
- Keep it secure - don't share publicly
- The JSON is stored encrypted in the app's database
- Service account has access only to sheets you explicitly share

## 💡 Tips

- **Duplicate Prevention**: System checks for duplicates by URL or Company+Title
- **Non-blocking**: If Google Sheets fails, database save still succeeds
- **Async**: Google Sheets save happens in background, doesn't slow down scraping
- **Public Sheet**: You can share the sheet URL with others to view jobs

## 🚀 Ready to Use!

Once configured, all new jobs will automatically sync to your Google Sheet! 🎉

