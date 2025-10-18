// AI Data Extractor - Uses Ollama with llama3.2:3b model (local, offline)
const axios = require('axios');
const os = require('os');
const { spawn } = require('child_process');
const path = require('path');

class GPTExtractor {
  constructor() {
    this.isReady = false;
    this.lastRequestTime = 0;
    this.minDelayBetweenRequests = 3000; // 3 seconds between Ollama requests (medium model needs more time)
    this.ollamaInitialized = false;
    this.ollamaUrl = 'http://localhost:11434';
    this.model = 'llama3.2:3b'; // Medium model (~2GB) - better quality, balanced performance
    this.maxRetries = 3;
    this.gpuAvailable = false;
    this.ollamaProcess = null; // Reference to Ollama server process
  }

  async initialize() {
    console.log('🤖 AI Extractor: Initializing with Ollama support');
    try {
      // Check if Ollama is available and install model if needed
      await this.checkOllamaAvailability();
      await this.checkGPUAvailability();
      await this.ensureModelInstalled();
      
      // Test AI connection to ensure it's working
      const aiTestResult = await this.testAIConnection();
      if (aiTestResult) {
        console.log(`✅ AI Extractor: Ollama is ready for job analysis (${this.gpuAvailable ? 'GPU' : 'CPU'} mode)`);
        this.ollamaInitialized = true;
      } else {
        console.log('⚠️ AI test failed, but Ollama server is running - will retry during job processing');
        this.ollamaInitialized = false;
      }
      
      this.isReady = true;
    } catch (error) {
      console.log('⚠️ Ollama initialization failed:', error.message);
      console.log('💡 Continuing without AI extraction - jobs will be processed with basic data');
      this.isReady = true;
      this.ollamaInitialized = false;
    }
  }

  // Check if Ollama server is running, start it if not
  async checkOllamaAvailability() {
    console.log('🔍 Checking Ollama server availability...');
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
          timeout: 3000,
        });
        
        console.log('✅ Ollama server is running');
        this.ollamaInitialized = true;
        return true;
      } catch (error) {
        console.log(`⏳ Ollama server check attempt ${attempt}/${this.maxRetries}: ${error.message}`);
        
        if (attempt === 1) {
          // Try to start Ollama server on first attempt
          console.log('🚀 Attempting to start Ollama server...');
          try {
            await this.startOllamaServer();
            console.log('⏳ Waiting 5 seconds for Ollama server to start...');
            await new Promise(resolve => setTimeout(resolve, 5000));
          } catch (startError) {
            console.log(`⚠️ Could not start Ollama server: ${startError.message}`);
          }
        }
        
        if (attempt === this.maxRetries) {
          throw new Error(`Ollama server not available after ${this.maxRetries} attempts. Please ensure Ollama is installed and start it manually: ollama serve`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  // Start Ollama server automatically
  async startOllamaServer() {
    return new Promise((resolve, reject) => {
      console.log('🔧 Starting Ollama server in background...');
      
      const ollamaProcess = spawn('ollama', ['serve'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true // Allow server to continue running after this process
      });
      
      // Store reference to kill later if needed
      this.ollamaProcess = ollamaProcess;
      
      let started = false;
      
      ollamaProcess.stdout.on('data', (data) => {
        const message = data.toString();
        if (!started && (message.includes('listening') || message.includes('server'))) {
          console.log('✅ Ollama server started successfully');
          started = true;
          resolve();
        }
      });
      
      ollamaProcess.stderr.on('data', (data) => {
        const message = data.toString();
        console.log(`🔧 Ollama: ${message.trim()}`);
      });
      
      ollamaProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('Ollama command not found. Please install Ollama first: https://ollama.ai'));
        } else {
          reject(error);
        }
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!started) {
          console.log('⏰ Ollama server starting... (may take a moment)');
          resolve(); // Don't reject, let the retry mechanism handle it
        }
      }, 10000);
      
      // Detach the process so it can run independently
      ollamaProcess.unref();
    });
  }

  // Ensure the model is installed
  async ensureModelInstalled() {
    console.log(`🔍 Checking if model '${this.model}' is installed...`);
    
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: 5000,
      });
      
      const models = response.data.models || [];
      const modelExists = models.some(model => model.name.includes(this.model));
      
      if (modelExists) {
        console.log(`✅ Model '${this.model}' is already installed`);
        return;
      }
      
      console.log(`📥 Model '${this.model}' not found. Installing...`);
      await this.installModel();
      
    } catch (error) {
      throw new Error(`Failed to check/install model: ${error.message}`);
    }
  }

  // Check if GPU is available through Ollama
  async checkGPUAvailability() {
    try {
      console.log('🔍 Checking GPU availability...');
      
      const response = await axios.get(`${this.ollamaUrl}/api/ps`, {
        timeout: 5000,
      });
      
      // Check if Ollama reports any GPU usage
      if (response.data && response.data.length > 0) {
        // If there are running models, check their GPU usage
        this.gpuAvailable = true; // Will be properly detected during actual inference
        console.log('🔍 GPU detection: Will be determined during model inference');
      }
    } catch (error) {
      console.log('⚠️ Could not check GPU status:', error.message);
    }
  }

  // Install the required model
  async installModel() {
    console.log(`📥 Installing Ollama model: ${this.model}`);
    
    return new Promise((resolve, reject) => {
      const ollamaProcess = spawn('ollama', ['pull', this.model], {
        stdio: ['inherit', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      ollamaProcess.stdout.on('data', (data) => {
        const message = data.toString();
        output += message;
        console.log(`📥 Ollama: ${message.trim()}`);
      });
      
      ollamaProcess.stderr.on('data', (data) => {
        const message = data.toString();
        errorOutput += message;
        console.log(`⚠️ Ollama: ${message.trim()}`);
      });
      
      ollamaProcess.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Model '${this.model}' installed successfully`);
          resolve();
        } else {
          reject(new Error(`Model installation failed with code ${code}: ${errorOutput}`));
        }
      });
      
      ollamaProcess.on('error', (error) => {
        if (error.code === 'ENOENT') {
          reject(new Error('Ollama command not found. Please install Ollama first: https://ollama.ai'));
        } else {
          reject(new Error(`Failed to start Ollama process: ${error.message}`));
        }
      });
    });
  }

  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const remainingWait = this.minDelayBetweenRequests - timeSinceLastRequest;
    
    if (remainingWait > 0) {
      console.log(`⏱️ Rate limit: Waiting ${Math.round(remainingWait/1000)}s before next Ollama request...`);
      await new Promise(r => setTimeout(r, remainingWait));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Test Ollama connection
  async testAIConnection() {
    try {
      console.log('📡 Testing Ollama AI connection...');
      
      const testResponse = await this.sendToOllama('Hello! Please respond with just "AI is working" to confirm connection.');
      
      if (testResponse && testResponse.toLowerCase().includes('working')) {
        console.log('✅ Ollama AI test successful');
        return true;
      } else {
        console.log('⚠️ Ollama AI test failed - unexpected response');
        return false;
      }
    } catch (error) {
      console.error('❌ Ollama AI test failed:', error.message);
      return false;
    }
  }

  // Ask Ollama if page is a verification/bot check page
  async isVerificationPage(pageContent, platform) {
    try {
      const contentLength = pageContent.bodyText?.length || 0;
      
      if (contentLength < 100) {
        console.log(`⚠️ Content too short (${contentLength} chars) - assuming verification page`);
        return true;  // Skip without asking Ollama
      }

      // Wait for rate limit before asking Ollama
      await this.waitForRateLimit();
      console.log(`🤔 Asking Ollama AI: Is this a verification page? (${contentLength} chars)`);
      
      if (!this.ollamaInitialized) {
        console.log('⚠️ Ollama not initialized, assuming not verification');
        return false;
      }

      const prompt = `Analyze this web page content and determine if it's a verification page, captcha, bot detection, or similar blocking page.

Look for indicators like:
- "Verify you are human"
- "Please complete the captcha"
- "Access denied"
- "Bot detection"
- "Cloudflare" protection messages

Page content:
${pageContent.bodyText?.substring(0, 2000) || 'No content available'}

Respond with ONLY: "yes" if this is a verification/bot check page, or "no" if it's a normal job page.`;

      console.log('📤 Sending to Ollama AI...');
      const response = await this.sendToOllama(prompt);
      
      if (!response) {
        console.log('⚠️ No response from Ollama AI, assuming not verification');
        return false;
      }
      
      console.log(`📥 Ollama AI full response: "${response}"`);
      
      const answer = response.toLowerCase().trim();
      const isVerification = answer.includes('yes') && !answer.includes('no');
      
      console.log(`🤖 Ollama AI says: ${isVerification ? 'YES - verification page' : 'NO - normal page'}`);
      return isVerification;
      
    } catch (error) {
      console.error('❌ Error asking Ollama AI:', error.message);
      return false;
    }
  }

  // Main extraction method
  async extractJobData(pageContent, platform, jobUrl) {
    if (!this.isReady) {
      console.log('⚠️ AI Extractor not ready yet');
      return null;
    }
    
    if (!this.ollamaInitialized) {
      console.log(`⚠️ Ollama not initialized, skipping AI extraction for ${platform} job`);
      return null;
    }

    // Retry logic for more robust AI analysis
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Wait for rate limit before sending to Ollama
        await this.waitForRateLimit();
        
        if (attempt > 1) {
          console.log(`🔄 Retry attempt ${attempt}/${this.maxRetries} for ${platform} job`);
        } else {
          console.log(`📤 Sending to Ollama AI: ${platform} job at ${jobUrl}`);
        }
        
        const prompt = this.createJobAnalysisPrompt(pageContent, platform, jobUrl);
        console.log(`🤖 Prompt created with ${pageContent.bodyText?.length || 0} characters of content`);

        console.log(`🤖 Sending to Ollama AI...`);
        
        // Send prompt to Ollama AI
        const response = await this.sendToOllama(prompt);
        
        if (!response) {
          console.log(`⚠️ Failed to get response from Ollama AI (attempt ${attempt})`);
          if (attempt < this.maxRetries) continue;
          return null;
        }
        
        console.log(`✅ Got response from Ollama AI!`);
        console.log(`📄 Raw AI Response: ${response.substring(0, 300)}${response.length > 300 ? '...' : ''}`);
        
        // Parse response
        const parsed = this.parseResponse(response);
        
        if (parsed) {
          console.log(`🎯 AI analysis successful:`);
          console.log(`   📋 Company: "${parsed.company}"`);
          console.log(`   📋 Title: "${parsed.title}"`);
          console.log(`   💰 Salary: ${parsed.salary || 'Not specified'}`);
          console.log(`   🏠 Location: ${parsed.location || 'Unknown'}`);
          console.log(`   🖥️ Work Type: ${parsed.isRemote ? 'Remote' : parsed.isHybrid ? 'Hybrid' : parsed.isOnsite ? 'Onsite' : 'Unknown'}`);
          console.log(`   🚀 Startup: ${parsed.isStartup ? 'Yes' : 'No'}`);
          console.log(`   💼 Job Type: ${parsed.jobType || 'Unknown'}`);
          console.log(`   🏭 Industry: ${parsed.industry || 'Unknown'}`);
          console.log(`   💻 Tech Stack: [${parsed.techStack.join(', ') || 'None detected'}]`);
          console.log(`   📝 Details: ${parsed.details || 'No details'}`);
          console.log(`   ✅ Software Job: ${parsed.isSoftwareJob ? 'Yes' : 'No'}`);
          console.log(`   ⚠️ Expired: ${parsed.isExpired ? 'Yes' : 'No'}`);
          console.log(`   🔒 Verification Page: ${parsed.isVerificationPage ? 'Yes' : 'No'}`);
          return parsed;
        } else {
          console.log(`⚠️ Failed to parse AI response (attempt ${attempt})`);
          if (attempt < this.maxRetries) {
            console.log(`🔄 Retrying in 2 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
        }
        
      } catch (error) {
        console.error(`❌ Ollama AI error (attempt ${attempt}):`, error.message);
        if (attempt < this.maxRetries) {
          console.log(`🔄 Retrying in 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
      }
    }
    
    console.log(`❌ All ${this.maxRetries} attempts failed for AI analysis`);
    return null;
  }

  // Send prompt to Ollama AI using local API
  async sendToOllama(prompt) {
    try {
      console.log('📤 Sending prompt to Ollama AI...');
      
      const requestData = {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.1, // Lower temperature for more consistent results
          top_p: 0.9,
          num_ctx: 2048, // Context window
          // Ollama automatically uses GPU if available (CUDA/ROCm), otherwise CPU
          // No explicit GPU configuration needed - Ollama handles this automatically
        }
      };
      
      const response = await axios.post(`${this.ollamaUrl}/api/generate`, requestData, {
        timeout: 45000, // 45 second timeout (medium model may need more time)
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.data || !response.data.response) {
        console.log('⚠️ No response from Ollama AI');
        return null;
      }
      
      console.log('✅ Got response from Ollama AI');
      return response.data.response;
      
    } catch (error) {
      console.error('❌ Error sending to Ollama AI:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        console.error('💡 Tip: Make sure Ollama server is running (ollama serve)');
      } else if (error.code === 'ETIMEDOUT') {
        console.error('💡 Tip: Request timed out - try again or check Ollama server');
      }
      
      return null;
    }
  }

  // Create job analysis prompt
  createJobAnalysisPrompt(pageContent, platform, jobUrl) {
    // Sanitize content to prevent prompt injection
    const safeContent = (pageContent.bodyText || 'No content available')
      .substring(0, 4000)
      .replace(/```/g, '')
      .replace(/\{|\}/g, '');
    
    const safeTitle = (pageContent.title || 'Unknown')
      .substring(0, 200)
      .replace(/```/g, '')
      .replace(/\{|\}/g, '');

    return `You are an AI assistant that extracts job information from web pages. Analyze this job posting and extract the following information in JSON format.

Job URL: ${jobUrl}
Platform: ${platform}
Page Title: ${safeTitle}

Page Content:
${safeContent}

Instructions:
1. Check if this is a verification/protection page (Cloudflare, "access denied", etc.) - if so, set "is_verification_page": true
2. Check if the job posting is expired or no longer available - if so, set "is_expired": true
3. Extract the following information and return ONLY a valid JSON object with these exact fields:

{
  "company": "Company name from the page",
  "title": "Job title from the page", 
  "salary": "Salary information if visible, otherwise null",
  "tech_stack": ["array", "of", "technologies", "mentioned"],
  "work_type": "remote/hybrid/onsite based on content analysis",
  "is_startup": true/false,
  "location": "Job location or 'Remote' if remote position",
  "job_type": "full-time/part-time/contract based on content",
  "industry": "Industry/sector if mentioned, otherwise 'Technology'",
  "details": "Brief summary of job description (max 200 chars)",
  "is_expired": false,
  "is_verification_page": false,
  "is_software_job": true
}

Return ONLY the JSON object, no other text.`;
  }

  // Parse Ollama response
  parseResponse(responseText) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      
      const data = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!data.company || !data.title) {
        throw new Error('Missing required fields: company or title');
      }
      
      // Handle tech_stack properly - could be array, string, or comma-separated string
      let techStack = [];
      if (Array.isArray(data.tech_stack)) {
        techStack = data.tech_stack;
      } else if (typeof data.tech_stack === 'string' && data.tech_stack.trim()) {
        // Handle comma-separated string or single string
        techStack = data.tech_stack.split(',').map(tech => tech.trim()).filter(tech => tech);
      }
      
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
      
      // Clean and validate company/title
      const cleanCompany = (data.company || 'Unknown').trim();
      const cleanTitle = (data.title || 'Unknown').trim();
      
      return {
        isVerificationPage: data.is_verification_page === true || data.is_verification_page === 'true',
        isExpired: data.is_expired === true || data.is_expired === 'true',
        isSoftwareJob: data.is_software_job === true || data.is_software_job === 'true',
        company: cleanCompany,
        title: cleanTitle,
        salary: data.salary || null,
        techStack: techStack,
        location: data.location || 'Unknown',
        isRemote: isRemoteFromWorkType || isRemoteFromLocation,
        isHybrid: workType.includes('hybrid') || location.includes('hybrid'),
        isOnsite: workType.includes('onsite') || location.includes('onsite'),
        isStartup: data.is_startup === true || data.is_startup === 'yes',
        jobType: data.job_type || 'Other',
        industry: data.industry || 'Technology',
        details: data.details || null
      };
    } catch (err) {
      console.log(`❌ Parse error: ${err.message}`);
      console.log(`📄 Full raw response: ${responseText}`);
      console.log(`🔍 Response length: ${responseText.length} characters`);
      return null;
    }
  }

  // Resume parsing method (placeholder for now)
  async parseResumeFile(resumePath) {
    // This could be implemented later if needed
    console.log(`📄 Resume parsing not implemented yet: ${resumePath}`);
    return {
      experience: '5+ years',
      skills: ['JavaScript', 'React', 'Node.js'],
      education: 'Bachelor\'s Degree',
      _note: 'Resume parsing requires additional implementation'
    };
  }

  // Cleanup method to handle app shutdown
  cleanup() {
    if (this.ollamaProcess && !this.ollamaProcess.killed) {
      console.log('🧹 Cleaning up Ollama server process...');
      try {
        this.ollamaProcess.kill();
      } catch (error) {
        console.log('⚠️ Could not clean up Ollama process:', error.message);
      }
    }
  }
}

module.exports = GPTExtractor;