# Google Sheets Setup Guide

This guide will walk you through getting Google Service Account credentials to enable automatic job syncing to your Google Sheet.

## Step 1: Access Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account (the same account that owns the Google Sheet)

## Step 2: Create a New Project (or Select Existing)

1. Click on the project dropdown at the top of the page (next to "Google Cloud")
2. Click **"NEW PROJECT"**
3. Enter a project name (e.g., "Job Assistant")
4. Click **"CREATE"**
5. Wait for the project to be created, then select it from the dropdown

## Step 3: Enable Google Sheets API

1. In the left sidebar, click **"APIs & Services"** → **"Library"**
2. Search for **"Google Sheets API"**
3. Click on **"Google Sheets API"** from the results
4. Click **"ENABLE"** button
5. Wait for it to enable (usually takes a few seconds)

## Step 4: Create a Service Account

1. In the left sidebar, go to **"IAM & Admin"** → **"Service Accounts"**
2. Click **"CREATE SERVICE ACCOUNT"** button at the top
3. Fill in the details:
   - **Service account name**: `job-assistant-sheets` (or any name you prefer)
   - **Service account ID**: Will auto-fill (you can change it if needed)
   - **Description**: `Service account for Job Assistant Google Sheets integration`
4. Click **"CREATE AND CONTINUE"**
5. **Skip** the "Grant this service account access to project" step (click **"CONTINUE"**)
6. **Skip** the "Grant users access to this service account" step (click **"DONE"**)

## Step 5: Create and Download JSON Key

1. You should now see your service account in the list
2. Click on the service account email (it will look like: `job-assistant-sheets@your-project-id.iam.gserviceaccount.com`)
3. Go to the **"KEYS"** tab
4. Click **"ADD KEY"** → **"Create new key"**
5. Select **"JSON"** as the key type
6. Click **"CREATE"**
7. A JSON file will automatically download to your computer (usually to your Downloads folder)
8. **IMPORTANT**: Keep this file secure! It contains credentials that allow access to your Google Sheet.

## Step 6: Get the Service Account Email

1. In the Service Account details page, you'll see the **"Email"** field
2. Copy this email address (it looks like: `job-assistant-sheets@your-project-id.iam.gserviceaccount.com`)
3. You'll need this to share the Google Sheet

## Step 7: Share Google Sheet with Service Account

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/1hBW6XlTRz5wiFKF3g4FE_aRpGJ4g-DRLRBIynJ0rwMY/edit
2. Click the **"Share"** button (top right)
3. In the "Add people and groups" field, paste the **Service Account email** you copied in Step 6
4. Make sure the permission is set to **"Editor"** (not Viewer or Commenter)
5. **Uncheck** "Notify people" (service accounts don't have email)
6. Click **"Share"**

## Step 8: Get the JSON Credentials Content

1. Open the downloaded JSON file (from Step 5) in a text editor
2. The file will look something like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "job-assistant-sheets@your-project-id.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

3. **Copy the entire JSON content** (all of it, from `{` to `}`)

## Step 9: Add Credentials to Job Assistant App

1. Open the Job Assistant app
2. Go to the **"Settings"** tab
3. Scroll down to **"📊 Google Sheets Integration"** section
4. Paste the **entire JSON content** into the **"Service Account JSON Credentials"** textarea
5. Click **"🔍 Test Connection"** to verify it works
6. If successful, you'll see: **"✅ Connection successful!"**
7. Make sure **"Enable Google Sheets sync"** checkbox is checked
8. Click **"💾 Save All Settings"**

## Troubleshooting

### Test Connection Fails

- **"No credentials found"**: Make sure you pasted the entire JSON content
- **"Invalid credentials"**: Check that the JSON is valid (no extra characters, proper formatting)
- **"Permission denied"**: Make sure you shared the Google Sheet with the service account email (Step 7)
- **"API not enabled"**: Go back to Step 3 and make sure Google Sheets API is enabled

### Jobs Not Syncing to Sheet

- Check that **"Enable Google Sheets sync"** is checked in Settings
- Check the app console/logs for any error messages
- Verify the service account has Editor access to the sheet
- Make sure the sheet name is "Sheet1" (or update the code if you use a different name)

## Security Notes

⚠️ **Important Security Information:**

- The JSON key file gives full access to your Google Sheet
- Never share this file publicly or commit it to version control
- If the key is compromised, you can delete it in Google Cloud Console and create a new one
- The credentials are stored encrypted in the app's database

## Quick Checklist

- [ ] Created Google Cloud project
- [ ] Enabled Google Sheets API
- [ ] Created Service Account
- [ ] Downloaded JSON key file
- [ ] Shared Google Sheet with service account email (Editor permission)
- [ ] Pasted JSON credentials into app Settings
- [ ] Tested connection successfully
- [ ] Enabled Google Sheets sync
- [ ] Saved settings

Once all steps are complete, new jobs saved to the database will automatically sync to your Google Sheet! 🎉

