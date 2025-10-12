# Cookie Storage - How It Works

## ✅ **YES - Cookies Are Saved Persistently!**

### Storage Location:
```
C:\Users\byteb\AppData\Roaming\job-searcher\jobs.db
```

### How It Works:

#### 1. **When You Save Cookies:**
```
You paste cookies → Encrypted with AES-256 → Saved to SQLite database
```

#### 2. **When App Starts:**
```
App reads database → Decrypts cookies → Loads into ChatGPT webview/scrapers
```

#### 3. **Security:**
- ✅ **AES-256 Encryption** - Military-grade encryption
- ✅ **Local Storage Only** - Never sent anywhere
- ✅ **Persistent** - Survives app restarts, computer reboots
- ✅ **Per Platform** - Separate storage for ChatGPT, Himalayas, etc.

### Cookie Persistence Features:

| Feature | Status |
|---------|--------|
| Survives app restart | ✅ YES |
| Survives computer reboot | ✅ YES |
| Encrypted at rest | ✅ YES |
| Separate per platform | ✅ YES |
| Auto-loads on startup | ✅ YES |
| Can update anytime | ✅ YES |

### How ChatGPT Cookies Work:

1. **You Save Cookies (One Time):**
   - Go to Cookies tab
   - Select "ChatGPT"
   - Paste your cookie JSON
   - Click "Save Cookies"
   - ✅ Saved permanently!

2. **Every Time App Starts:**
   - App loads ChatGPT webview
   - Automatically injects saved cookies
   - ChatGPT loads with your session
   - ✅ No need to login again!

3. **If Session Expires:**
   - Get new cookies from browser
   - Paste in Cookies tab
   - Save again
   - ✅ Updated permanently!

### ChatGPT Sidebar:

**Now Permanently Visible:**
- ✅ Can't be closed
- ✅ Always available on the right
- ✅ Refresh button to reload if needed
- ✅ 450px wide for comfortable viewing

### Cookie Format:

```json
[
  {"name":"oai-did","value":"your-value"},
  {"name":"__Secure-next-auth.session-token","value":"your-session-token"},
  {"name":"other-cookies","value":"..."}
]
```

### Important Notes:

1. **Cookies Are Platform-Specific:**
   - ChatGPT cookies stay with ChatGPT
   - Himalayas cookies stay with Himalayas
   - Never mixed or shared

2. **Automatic Loading:**
   - Scrapers automatically load their cookies
   - ChatGPT automatically loads its cookies
   - No manual action needed after first save

3. **Database Location:**
   - Same place as your job records
   - Backed up with your regular backups
   - Can be moved/copied to other computers

### Testing Cookie Storage:

1. **Save cookies** in Cookies tab
2. **Close the app completely**
3. **Restart the app**
4. **Go to Cookies tab**
5. **Click "Load Cookies"**
6. ✅ Your cookies should appear!

### Troubleshooting:

**Cookies not loading?**
- Check database file exists
- Verify JSON format was correct
- Try saving again

**ChatGPT not logged in?**
- Cookies may have expired
- Get fresh cookies from browser
- Save them again

**Want to remove cookies?**
- Clear the JSON in Cookies tab
- Save empty array: `[]`
- Or delete database file to reset everything

---

**Summary:** Your cookies are 100% persistent, encrypted, and automatically loaded every time the app starts!

