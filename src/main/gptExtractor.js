// GPT Data Extractor - Uses Puter.js with gpt-5-nano model
const { getMainWindow } = require('./windowManager');

class GPTExtractor {
  constructor() {
    this.isReady = false;
    this.lastRequestTime = 0;
    this.minDelayBetweenRequests = 5000; // 5 seconds between Puter requests (more human-like)
    this.puterInitialized = false;
  }

  async initialize() {
    console.log('🤖 GPT Extractor: Initializing with Puter.js support');
    await this.initializePuter();
    this.isReady = true;
  }

  async initializePuter() {
    try {
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        throw new Error('Main window not available');
      }

      // Initialize Puter.js SDK
      await mainWindow.webContents.executeJavaScript(`
        // Load Puter.js SDK if not already loaded
        if (typeof puter === 'undefined') {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://js.puter.com/v2/';
            script.onload = () => {
              console.log('✅ Puter.js SDK loaded');
              resolve(true);
            };
            script.onerror = () => {
              console.error('❌ Failed to load Puter.js SDK');
              reject(new Error('Failed to load Puter.js SDK'));
            };
            document.head.appendChild(script);
          });
        } else {
          console.log('✅ Puter.js SDK already loaded');
          return true;
        }
      `);

      this.puterInitialized = true;
      console.log('✅ Puter.js initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Puter.js:', error.message);
      throw error;
    }
  }
  
  
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const remainingWait = this.minDelayBetweenRequests - timeSinceLastRequest;
    
    if (remainingWait > 0) {
      console.log(`⏱️ Rate limit: Waiting ${Math.round(remainingWait/1000)}s before next Puter request...`);
      await new Promise(r => setTimeout(r, remainingWait));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Ask Puter AI if page is a verification/bot check page
  async isVerificationPage(pageContent, mainWindow) {
    try {
      // Quick check: If content is too small, it's likely Cloudflare/verification
      const contentLength = pageContent.bodyText?.length || 0;
      
      if (contentLength < 400) {
        console.log(`⚠️ Content too small (${contentLength} chars) - likely verification page`);
        return true;  // Skip without asking Puter
      }
      
      // Wait for rate limit before asking Puter
      await this.waitForRateLimit();
      
      console.log(`🤔 Asking Puter AI: Is this a verification page? (${contentLength} chars)`);
      
      if (!mainWindow || !this.puterInitialized) return false;
      
      const prompt = `Look at this page content and answer with ONLY "yes" or "no":

Page Title: ${pageContent.title}

Page Content (first 1000 chars):
${pageContent.bodyText?.substring(0, 1000)}

Question: Is this a human verification page, Cloudflare challenge ("Just a moment..."), captcha, or bot check page?

Answer with ONLY one word: yes or no`;

      console.log('📤 Sending to Puter AI...');
      console.log(`📝 Prompt preview: Title="${pageContent.title}", Content starts with: "${pageContent.bodyText?.substring(0, 100)}..."`);
      
      const response = await this.sendToPuter(mainWindow, prompt);
      
      if (!response) {
        console.log('⚠️ No response from Puter AI, assuming not verification');
        return false;
      }
      
      console.log(`📥 Puter AI full response: "${response}"`);
      
      const answer = response.toLowerCase().trim();
      const isVerification = answer.includes('yes');
      
      console.log(`📋 Final decision: ${isVerification ? 'VERIFICATION PAGE' : 'REAL JOB PAGE'}`);
      
      return isVerification;
      
    } catch (error) {
      console.error('❌ Error asking Puter AI:', error.message);
      return false;
    }
  }

  async extractJobData(pageContent, platform, jobUrl) {
    if (!this.isReady) {
      return null;
    }

    try {
      // Wait for rate limit before sending to Puter
      await this.waitForRateLimit();
      
      console.log(`📤 Sending to Puter AI: ${platform} job at ${jobUrl}`);
      
      const mainWindow = getMainWindow();
      if (!mainWindow || !this.puterInitialized) {
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

      console.log(`🤖 Sending to Puter AI silently...`);
      
      // Send prompt to Puter AI
      const response = await this.sendToPuter(mainWindow, prompt);
      
      if (!response) {
        console.log(`⚠️ Failed to get response from Puter AI`);
        return null;
      }
      
      console.log(`✅ Got response from Puter AI!`);
      
      // Parse
      const parsed = this.parseResponse(response);
      return parsed;
      
    } catch (error) {
      console.error('❌ GPT error:', error.message);
      return null;
    }
  }

  // Send prompt to Puter AI using gpt-5-nano model
  async sendToPuter(mainWindow, prompt) {
    try {
      console.log('📤 Sending prompt to Puter AI...');
      
      // Encode prompt as base64 to safely pass through executeJavaScript
      const promptBase64 = Buffer.from(prompt).toString('base64');
      
      const response = await mainWindow.webContents.executeJavaScript(`
        (async function() {
          try {
            // Check if Puter.js is available
            if (typeof puter === 'undefined') {
              throw new Error('Puter.js SDK not loaded');
            }
            
            // Decode prompt from base64
            const promptText = atob('${promptBase64}');
            
            // Use Puter AI chat with gpt-5-nano model
            const response = await puter.ai.chat(promptText, {
              model: 'gpt-5-nano',
            });
            
            console.log('✅ Puter AI response received');
            return response;
            
          } catch (error) {
            console.error('❌ Puter AI error:', error.message);
            throw error;
          }
        })();
      `);
      
      if (!response) {
        console.log('⚠️ No response from Puter AI');
        return null;
      }
      
      console.log('✅ Got response from Puter AI');
      return response;
      
    } catch (error) {
      console.error('❌ Error sending to Puter AI:', error.message);
      return null;
    }
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
    this.puterInitialized = false;
  }
}

module.exports = GPTExtractor;

