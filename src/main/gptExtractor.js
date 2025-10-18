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
  }

  async initialize() {
    console.log('🤖 AI Extractor: Initializing with Ollama support');
    try {
      // Check if Ollama is available and install model if needed
      await this.checkOllamaAvailability();
      await this.checkGPUAvailability();
      await this.ensureModelInstalled();
      
      this.isReady = true;
      console.log(`✅ AI Extractor: Ollama is ready for job analysis (${this.gpuAvailable ? 'GPU' : 'CPU'} mode)`);
    } catch (error) {
      console.log('⚠️ Ollama initialization failed:', error.message);
      console.log('💡 Continuing without AI extraction - jobs will be processed with basic data');
      this.isReady = true;
      this.ollamaInitialized = false;
    }
  }

  // Check if Ollama server is running
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
        
        if (attempt === this.maxRetries) {
          throw new Error(`Ollama server not available after ${this.maxRetries} attempts. Please start Ollama server.`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
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

    try {
      // Wait for rate limit before sending to Ollama
      await this.waitForRateLimit();
      console.log(`📤 Sending to Ollama AI: ${platform} job at ${jobUrl}`);
      
      const prompt = this.createJobAnalysisPrompt(pageContent, platform, jobUrl);
      console.log(`🤖 Prompt created with ${pageContent.bodyText?.length || 0} characters of content`);

      console.log(`🤖 Sending to Ollama AI silently...`);
      
      // Send prompt to Ollama AI
      const response = await this.sendToOllama(prompt);
      
      if (!response) {
        console.log(`⚠️ Failed to get response from Ollama AI`);
        return null;
      }
      
      console.log(`✅ Got response from Ollama AI!`);
      
      // Parse response
      const parsed = this.parseResponse(response);
      return parsed;
      
    } catch (error) {
      console.error('❌ Ollama AI error:', error.message);
      return null;
    }
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
    return `You are an AI assistant that extracts job information from web pages. Analyze this job posting and extract the following information in JSON format.

Job URL: ${jobUrl}
Platform: ${platform}
Page Title: ${pageContent.title || 'Unknown'}

Page Content:
${pageContent.bodyText?.substring(0, 4000) || 'No content available'}

Extract and return ONLY a valid JSON object with these exact fields:
{
  "company": "Company name from the page",
  "title": "Job title from the page",
  "salary": "Salary information if visible, otherwise null",
  "tech_stack": "Array of technologies mentioned, or empty array",
  "work_type": "remote/hybrid/onsite based on content",
  "is_startup": "yes/no - determine if this appears to be a startup company",
  "location": "Job location or 'Remote' if remote position",
  "job_type": "full-time/part-time/contract based on content",
  "industry": "Industry/sector if mentioned, otherwise 'Technology'",
  "details": "Brief summary of job description (max 200 chars)",
  "is_expired": false,
  "is_software_job": true
}`;
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
        techStack: Array.isArray(data.tech_stack) ? data.tech_stack : [],
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
      console.log(`Raw response: ${responseText.substring(0, 500)}...`);
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
}

module.exports = GPTExtractor;