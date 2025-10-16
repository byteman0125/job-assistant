// ChatGPT Data Extractor - Uses ChatGPT with CORRECT ProseMirror handling
const { getMainWindow } = require('./windowManager');

class GPTExtractor {
  constructor() {
    this.isReady = false;
    this.lastRequestTime = 0;
    this.minDelayBetweenRequests = 5000; // 5 seconds between ChatGPT requests (more human-like)
    this.verificationCheckInterval = null;
    this.lastRefreshTime = 0;
    this.refreshCooldown = 30000; // 30 seconds cooldown between refreshes
  }

  async initialize() {
    console.log('🤖 GPT Extractor: Initializing with ProseMirror support');
    this.isReady = true;
    
    // Start periodic verification check
    this.startVerificationMonitoring();
  }
  
  startVerificationMonitoring() {
    // Check for verification every 15 seconds (more frequent to catch readiness issues)
    this.verificationCheckInterval = setInterval(async () => {
      try {
        const mainWindow = getMainWindow();
        if (mainWindow && this.isReady) {
          const needsVerification = await this.checkChatGPTVerification(mainWindow);
          if (needsVerification) {
            console.log('🔄 ChatGPT issue detected - Auto-refreshed');
          }
        }
      } catch (error) {
        // Ignore errors in monitoring
      }
    }, 15000); // Check every 15 seconds
  }
  
  stopVerificationMonitoring() {
    if (this.verificationCheckInterval) {
      clearInterval(this.verificationCheckInterval);
      this.verificationCheckInterval = null;
    }
  }
  
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const remainingWait = this.minDelayBetweenRequests - timeSinceLastRequest;
    
    if (remainingWait > 0) {
      console.log(`⏱️ Rate limit: Waiting ${Math.round(remainingWait/1000)}s before next ChatGPT request...`);
      await new Promise(r => setTimeout(r, remainingWait));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Ask ChatGPT if page is a verification/bot check page
  async isVerificationPage(pageContent, mainWindow) {
    try {
      // Quick check: If content is too small, it's likely Cloudflare/verification
      const contentLength = pageContent.bodyText?.length || 0;
      
      if (contentLength < 400) {
        console.log(`⚠️ Content too small (${contentLength} chars) - likely verification page`);
        return true;  // Skip without asking ChatGPT
      }
      
      // Wait for rate limit before asking ChatGPT
      await this.waitForRateLimit();
      
      console.log(`🤔 Asking ChatGPT: Is this a verification page? (${contentLength} chars)`);
      
      if (!mainWindow) return false;
      
      const prompt = `Look at this page content and answer with ONLY "yes" or "no":

Page Title: ${pageContent.title}

Page Content (first 1000 chars):
${pageContent.bodyText?.substring(0, 1000)}

Question: Is this a human verification page, Cloudflare challenge ("Just a moment..."), captcha, or bot check page?

Answer with ONLY one word: yes or no`;

      console.log('📤 Sending to ChatGPT...');
      console.log(`📝 Prompt preview: Title="${pageContent.title}", Content starts with: "${pageContent.bodyText?.substring(0, 100)}..."`);
      
      const sent = await this.sendToChatGPT(mainWindow, prompt);
      if (!sent) {
        console.log('⚠️ Failed to send, assuming not verification');
        return false;
      }
      
      console.log('⏳ Waiting for ChatGPT response (30s max)...');
      
      // Wait for response (30s max for simple yes/no)
      const response = await this.waitForResponse(mainWindow, 30000);
      
      if (!response) {
        console.log('⚠️ No response from ChatGPT, assuming not verification');
        return false;
      }
      
      console.log(`📥 ChatGPT full response: "${response}"`);
      
      const answer = response.toLowerCase().trim();
      const isVerification = answer.includes('yes');
      
      console.log(`📋 Final decision: ${isVerification ? 'VERIFICATION PAGE' : 'REAL JOB PAGE'}`);
      
      return isVerification;
      
    } catch (error) {
      console.error('❌ Error asking ChatGPT:', error.message);
      return false;
    }
  }

  async extractJobData(pageContent, platform, jobUrl) {
    if (!this.isReady) {
      return null;
    }

    try {
      // Wait for rate limit before sending to ChatGPT
      await this.waitForRateLimit();
      
      console.log(`📤 Sending to ChatGPT: ${platform} job at ${jobUrl}`);
      
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        return null;
      }
      
      const prompt = `Analyze this page content:

Page Title: ${pageContent.title}
URL: ${jobUrl}

Page Content:
${pageContent.bodyText?.substring(0, 5000) || ''}

STEP 1: Check if this is a verification/bot check page
- Look for: "verify", "captcha", "cloudflare", "just a moment", "checking your browser", "security check"
- If YES → Set is_verification_page: true and skip other fields
- If NO → Continue to step 2

STEP 2: Check if this job posting is EXPIRED or NO LONGER AVAILABLE
- Look for: "no longer available", "expired", "position has been filled", "job posting closed", "this job is no longer accepting applications", "removed", "404", "not found", "page not found"
- If YES → Set is_expired: true and skip other fields
- If NO → Continue to step 3

STEP 3: Check if this is a SOFTWARE/TECH job
- Is this a software development, programming, engineering, or technical position?
- Software jobs include: Developer, Engineer, Programmer, Data Scientist, DevOps, QA, Designer (UI/UX), Product Manager (tech), etc.
- NON-software jobs include: AI Trainer, Content Writer, Volunteer Coordinator, Civil Engineer (non-software), Customer Service, Sales, Marketing (non-tech), Administrative, HR, Finance, Operations, etc.
- If NOT a software/tech job → Set is_software_job: false and skip to return
- If YES → Set is_software_job: true and continue to step 4

STEP 4: Extract job information (ONLY if software job)
1. company - Company name
2. title - Job title
3. salary - Salary range or "Not specified"
4. tech_stack - Technologies mentioned (comma-separated)
5. work_type - "Fully Remote", "Hybrid", or "Onsite"
6. is_startup - "yes" or "no"
7. location - City/State or "Remote"
8. job_type - Classify into ONE of these categories:
   - "Backend" (server-side, APIs, databases, backend frameworks)
   - "Frontend" (UI, React, Vue, Angular, CSS, HTML)
   - "Full Stack" (both frontend and backend responsibilities)
   - "Mobile" (iOS, Android, React Native, Flutter)
   - "DevOps" (infrastructure, CI/CD, cloud, Docker, Kubernetes)
   - "Data Engineering" (ETL, data pipelines, big data)
   - "Data Science" (ML, AI, analytics, statistics)
   - "QA/Testing" (testing, automation, QA)
   - "Security" (cybersecurity, infosec, pentesting)
   - "Product/Design" (PM, UX, UI design)
   - "Other" (if none match)
9. industry - Classify company industry into ONE of these:
   - "Technology/Software" (SaaS, tech products, software companies)
   - "Fintech" (financial technology, banking, payments)
   - "Healthcare" (health tech, medical, biotech)
   - "E-commerce" (online retail, marketplaces)
   - "Gaming" (video games, game development)
   - "Education" (edtech, online learning, education)
   - "Enterprise" (B2B software, enterprise solutions)
   - "Consulting" (consulting firms, professional services)
   - "Government" (government, public sector, defense)
   - "Media/Entertainment" (streaming, content, media)
   - "Crypto/Web3" (blockchain, cryptocurrency, web3)
   - "Transportation" (logistics, delivery, rideshare)
   - "Real Estate" (proptech, real estate)
   - "Social Media" (social networks, community platforms)
   - "AI/ML" (AI-focused companies, ML products)
   - "Other" (if none match)

CRITICAL:
- Only mark is_software_job: true if it's a genuine software/tech position requiring programming/technical skills
- Only mark as "Fully Remote" if explicitly stated
- If mentions office/hybrid/on-site → work_type is NOT "Fully Remote"
- Classify job_type based on PRIMARY responsibilities (not just requirements)
- Classify industry based on the COMPANY'S primary business

Return ONLY valid JSON:
{
  "is_verification_page": true/false,
  "is_expired": true/false,
  "is_software_job": true/false,
  "company": "...",
  "title": "...",
  "salary": "...",
  "tech_stack": "...",
  "work_type": "...",
  "is_startup": "...",
  "location": "...",
  "job_type": "...",
  "industry": "..."
}`;

      console.log(`🤖 Prompt created with ${pageContent.bodyText?.length || 0} characters of content`);

      console.log(`🤖 Sending to ChatGPT silently...`);
      
      // Check if ChatGPT is showing verification before sending
      const needsVerification = await this.checkChatGPTVerification(mainWindow);
      if (needsVerification) {
        console.log(`🚫 ChatGPT requires human verification! Pausing...`);
        mainWindow.webContents.send('chatgpt-verification-needed');
        return null;
      }
      
      // Start new chat + send prompt
      const sent = await this.sendToChatGPT(mainWindow, prompt);
      
      if (!sent) {
        console.log(`⚠️ Failed to send`);
        return null;
      }
      
      console.log(`✅ Sent! Waiting for response (20s)...`);
      
      // Wait for response
      const response = await this.waitForResponse(mainWindow, 20000);
      
      if (!response) {
        console.log(`⏱️ Timeout`);
        return null;
      }
      
      console.log(`✅ Got response!`);
      
      // Parse
      const parsed = this.parseResponse(response);
      return parsed;
      
    } catch (error) {
      console.error('❌ GPT error:', error.message);
      return null;
    }
  }

  async checkChatGPTVerification(mainWindow) {
    try {
      const result = await mainWindow.webContents.executeJavaScript(`
        (function() {
          const chatgptView = document.getElementById('chatgptView');
          if (!chatgptView) return { needsVerification: false, isReady: false };
          
          return chatgptView.executeJavaScript(\`
            (function() {
              const bodyText = document.body.innerText.toLowerCase();
              const title = document.title.toLowerCase();
              
              // Check for verification indicators (ONLY real verification pages)
              const verificationKeywords = [
                'verify you are human',
                'verification required',
                'captcha',
                'just a moment',
                'checking your browser',
                'security check',
                'unusual activity',
                'blocked by your administrator',
                'access denied',
                'human verification',
                'please verify',
                'verify your identity',
                'suspicious activity',
                'suspicious activity alert',
                'rate limit exceeded',
                'too many requests'
              ];
              
              // ONLY detect verification if it has specific verification keywords
              const hasVerification = verificationKeywords.some(keyword => {
                return bodyText.includes(keyword) || title.includes(keyword);
              });
              
              // Check if ChatGPT has a working message input (means it's ready)
              const hasWorkingInput = document.querySelector('textarea[placeholder*="message"]') || 
                                     document.querySelector('textarea[data-testid*="input"]') ||
                                     document.querySelector('div[contenteditable="true"]') ||
                                     document.querySelector('textarea');
              
              // Only consider it verification if:
              // 1. It has verification keywords AND
              // 2. It does NOT have a working message input
              const realVerification = hasVerification && !hasWorkingInput;
              
              // Also check for Cloudflare-specific elements
              const hasCloudflare = document.querySelector('[data-ray]') || 
                                   document.querySelector('.cf-browser-verification') ||
                                   document.querySelector('#challenge-form');
              
              // Check if ChatGPT is ready (has message input area)
              const messageInput = document.querySelector('textarea[placeholder*="message"]') || 
                                   document.querySelector('textarea[placeholder*="Message"]') ||
                                   document.querySelector('textarea[data-testid*="input"]') ||
                                   document.querySelector('textarea[id*="prompt"]') ||
                                   document.querySelector('div[contenteditable="true"]') ||
                                   document.querySelector('textarea');
              
              const isReady = messageInput && messageInput.offsetParent !== null;
              
              // Try to dismiss "Suspicious Activity Alert" if present
              if (bodyText.includes('suspicious activity') || bodyText.includes('rate limit')) {
                // Look for dismiss/close buttons
                const allButtons = document.querySelectorAll('button');
                let dismissBtn = null;
                
                for (const btn of allButtons) {
                  const btnText = btn.textContent?.toLowerCase() || '';
                  const btnAria = btn.getAttribute('aria-label')?.toLowerCase() || '';
                  
                  if (btnAria.includes('close') || btnAria.includes('dismiss') || 
                      btnText.includes('ok') || btnText.includes('continue') || 
                      btnText.includes('dismiss') || btnText.includes('close')) {
                    dismissBtn = btn;
                    break;
                  }
                }
                
                if (dismissBtn) {
                  console.log('🔓 Auto-dismissing suspicious activity alert...');
                  dismissBtn.click();
                  // Wait a moment for dismissal
                  await new Promise(r => setTimeout(r, 1000));
                }
              }
              
              return { 
                needsVerification: realVerification || hasCloudflare,
                isReady: isReady,
                hasMessageInput: !!messageInput,
                bodyPreview: bodyText.substring(0, 200)
              };
            })()
          \`);
        })()
      `);
      
      // Check cooldown to prevent excessive refreshing
      const now = Date.now();
      const timeSinceLastRefresh = now - this.lastRefreshTime;
      
      if (result && result.needsVerification && timeSinceLastRefresh > this.refreshCooldown) {
        console.log(`🚫 ChatGPT verification detected: ${result.bodyPreview}`);
        
        // Auto-refresh ChatGPT when verification detected
        console.log(`🔄 Auto-refreshing ChatGPT to bypass verification...`);
        mainWindow.webContents.send('refresh-chatgpt');
        this.lastRefreshTime = now;
        
        // Wait a bit for refresh to start
        await new Promise(r => setTimeout(r, 3000));
        
        return true;
      }
      
      if (result && !result.hasMessageInput && timeSinceLastRefresh > this.refreshCooldown) {
        console.log(`⚠️ ChatGPT not ready (no message input found) - Refreshing...`);
        mainWindow.webContents.send('refresh-chatgpt');
        this.lastRefreshTime = now;
        await new Promise(r => setTimeout(r, 3000));
        return true;
      }
      
      if (timeSinceLastRefresh <= this.refreshCooldown) {
        console.log(`⏳ Refresh cooldown active (${Math.round((this.refreshCooldown - timeSinceLastRefresh)/1000)}s remaining)`);
      }
      
      return false;
    } catch (error) {
      console.log(`⚠️ Error checking ChatGPT verification: ${error.message}`);
      return false;
    }
  }
  
  async sendToChatGPT(mainWindow, prompt) {
    try {
      // Encode prompt as base64 to safely pass through executeJavaScript
      const promptBase64 = Buffer.from(prompt).toString('base64');
      
      const result = await mainWindow.webContents.executeJavaScript(`
        (async function() {
          try {
            const chatgptView = document.querySelector('webview#chatgptView');
            if (!chatgptView) return { error: 'No webview' };
            
            // Decode prompt from base64
            const promptText = atob('${promptBase64}');
            
            // Store in webview context
            await chatgptView.executeJavaScript('window.__prompt = atob("${promptBase64}");');
            
            const result = await chatgptView.executeJavaScript(\`
              (async function() {
                try {
                  const prompt = window.__prompt;
                  if (!prompt) return { error: 'No prompt' };
                  
                  // 1. Click New chat
                  await new Promise(r => setTimeout(r, 1000));
                  const newChat = document.querySelector('a[data-testid="create-new-chat-button"]');
                  if (newChat) {
                    newChat.click();
                    await new Promise(r => setTimeout(r, 1500));
                  }
                  
                  // 2. Find ProseMirror
                  const input = document.querySelector('#prompt-textarea.ProseMirror');
                  if (!input) return { error: 'Input not found' };
                  
                  // 3. Focus
                  input.focus();
                  await new Promise(r => setTimeout(r, 300));
                  
                  // 4. Insert as <p>
                  input.innerHTML = '';
                  await new Promise(r => setTimeout(r, 100));
                  
                  const p = document.createElement('p');
                  p.textContent = prompt;
                  input.appendChild(p);
                  
                  // 5. Events
                  input.dispatchEvent(new Event('input', { bubbles: true }));
                  await new Promise(r => setTimeout(r, 100));
                  input.dispatchEvent(new Event('change', { bubbles: true }));
                  
                  // 6. Wait for button
                  await new Promise(r => setTimeout(r, 800));
                  
                  // 7. Click send
                  const send = document.querySelector('button[data-testid="send-button"]') ||
                               document.querySelector('#composer-submit-button');
                  
                  if (!send || send.disabled) return { error: 'Button not ready' };
                  
                  await new Promise(r => setTimeout(r, 400));
                  send.click();
                  
                  await new Promise(r => setTimeout(r, 1000));
                  delete window.__prompt;
                  return { success: true };
                  
                } catch (err) {
                  return { error: err.message };
                }
              })();
            \`);
            
            return result;
          } catch (err) {
            return { error: err.message };
          }
        })();
      `);
      
      if (result.error) {
        console.log(`⚠️ ${result.error}`);
        return false;
      }
      
      console.log('✅ Sent!');
      return true;
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      return false;
    }
  }

  async waitForResponse(mainWindow, timeout) {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        resolve(null);
      }, timeout);
      
      let checkCount = 0;
      const checkInterval = setInterval(async () => {
        checkCount++;
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        
        try {
          const response = await mainWindow.webContents.executeJavaScript(`
            (async function() {
              const chatgptView = document.querySelector('webview#chatgptView');
              if (!chatgptView) return null;
              
              const msg = await chatgptView.executeJavaScript(\`
                (function() {
                  const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
                  if (messages.length === 0) return null;
                  
                  const lastMsg = messages[messages.length - 1];
                  const content = lastMsg.innerText || lastMsg.textContent;
                  
                  if (content.includes('{') && content.includes('}')) {
                    return content;
                  }
                  
                  return null;
                })();
              \`);
              
              return msg;
            })();
          `);
          
          if (response) {
            clearTimeout(timeoutId);
            clearInterval(checkInterval);
            console.log(`✅ Got response after ${elapsed}s (checked ${checkCount} times)`);
            resolve(response);
          }
        } catch (err) {
          // Continue
        }
      }, 500); // ⚡ Check every 0.5s for fast response detection
    });
  }

  parseResponse(responseText) {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON');
      
      const data = JSON.parse(jsonMatch[0]);
      
      // Check work_type for remote keywords
      const workType = data.work_type?.toLowerCase() || '';
      const location = data.location?.toLowerCase() || '';
      
      // Check if remote based on work_type OR location
      const isRemoteFromWorkType = workType.includes('remote') && 
                                    !workType.includes('hybrid') && 
                                    !workType.includes('onsite');
      const isRemoteFromLocation = location.includes('remote') && 
                                    !location.includes('hybrid') && 
                                    !location.includes('onsite');
      
      return {
        isVerificationPage: data.is_verification_page === true || data.is_verification_page === 'true',
        isExpired: data.is_expired === true || data.is_expired === 'true',
        isSoftwareJob: data.is_software_job === true || data.is_software_job === 'true',
        company: data.company || 'Unknown',
        title: data.title || 'Unknown',
        salary: data.salary,
        techStack: data.tech_stack,
        location: data.location,
        isRemote: isRemoteFromWorkType || isRemoteFromLocation,
        isHybrid: workType.includes('hybrid') || location.includes('hybrid'),
        isOnsite: workType.includes('onsite') || location.includes('onsite'),
        isStartup: data.is_startup === 'yes' || data.is_startup === true,
        jobType: data.job_type || 'Other',
        industry: data.industry || 'Other',
        details: data.details
      };
    } catch (err) {
      console.log(`⚠️ Parse error: ${err.message}`);
      return null;
    }
  }

  async parseResumeFile(resumePath) {
    const fs = require('fs').promises;
    const path = require('path');
    const mainWindow = getMainWindow();
    
    if (!mainWindow) {
      throw new Error('Main window not available');
    }

    try {
      console.log(`📄 Parsing resume: ${resumePath}`);
      
      // Read file content (for text extraction if needed)
      const fileExt = path.extname(resumePath).toLowerCase();
      let resumeText = '';
      
      // For now, we'll send the file path to ChatGPT and ask it to extract info
      // In a more advanced version, we could extract text from PDF/DOC files first
      
      const prompt = `I have uploaded my resume. Please analyze it and extract the following information in JSON format:
{
  "first_name": "",
  "last_name": "",
  "email": "",
  "phone": "",
  "linkedin_url": "",
  "github_url": "",
  "portfolio_url": "",
  "address": "",
  "city": "",
  "state": "",
  "zip_code": "",
  "country": "",
  "job_title": "Current or most recent job title",
  "years_experience": "Total years as a number",
  "skills": "Comma-separated list of skills",
  "summary": "Professional summary or objective",
  "work_experience": [
    {
      "company": "",
      "job_title": "",
      "location": "",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY or 'Present'",
      "is_current": false,
      "description": "Brief description of responsibilities"
    }
  ],
  "education": [
    {
      "school": "",
      "degree": "",
      "field_of_study": "",
      "location": "",
      "start_date": "MM/YYYY",
      "end_date": "MM/YYYY",
      "is_current": false,
      "gpa": "",
      "description": ""
    }
  ]
}

Please provide ONLY the JSON object, no additional text. File path: ${resumePath}`;

      // Note: This is a placeholder. In production, you'd want to either:
      // 1. Use ChatGPT's file upload API
      // 2. Extract text from the resume file first and send that text
      // 3. Use a specialized resume parsing service
      
      // For now, return a message that manual parsing is needed
      return {
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        linkedin_url: '',
        github_url: '',
        portfolio_url: '',
        address: '',
        city: '',
        state: '',
        zip_code: '',
        country: 'United States',
        job_title: '',
        years_experience: null,
        skills: '',
        summary: '',
        work_experience: [],
        education: [],
        _note: 'Resume parsing requires manual implementation with file reading and ChatGPT API integration'
      };
      
    } catch (error) {
      console.error('❌ Resume parsing error:', error);
      throw new Error(`Failed to parse resume: ${error.message}`);
    }
  }

  async close() {
    this.isReady = false;
  }
}

module.exports = GPTExtractor;

