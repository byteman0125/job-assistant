// ChatGPT Data Extractor - Uses ChatGPT with CORRECT ProseMirror handling
const { getMainWindow } = require('./windowManager');

class GPTExtractor {
  constructor() {
    this.isReady = false;
  }

  async initialize() {
    console.log('🤖 GPT Extractor: Initializing with ProseMirror support');
    this.isReady = true;
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

STEP 2: Extract job information (ONLY if not verification page)
1. company - Company name
2. title - Job title
3. salary - Salary range or "Not specified"
4. tech_stack - Technologies mentioned (comma-separated)
5. work_type - "Fully Remote", "Hybrid", or "Onsite"
6. is_startup - "yes" or "no"
7. location - City/State or "Remote"

CRITICAL:
- Only mark as "Fully Remote" if explicitly stated
- If mentions office/hybrid/on-site → work_type is NOT "Fully Remote"

Return ONLY valid JSON:
{
  "is_verification_page": true/false,
  "company": "...",
  "title": "...",
  "salary": "...",
  "tech_stack": "...",
  "work_type": "...",
  "is_startup": "...",
  "location": "..."
}`;

      console.log(`🤖 Prompt created with ${pageContent.bodyText?.length || 0} characters of content`);

      console.log(`🤖 Sending to ChatGPT silently...`);
      
      // Start new chat + send prompt
      const sent = await this.sendToChatGPT(mainWindow, prompt);
      
      if (!sent) {
        console.log(`⚠️ Failed to send`);
        return null;
      }
      
      console.log(`✅ Sent! Waiting for response (120s)...`);
      
      // Wait for response
      const response = await this.waitForResponse(mainWindow, 120000);
      
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
      
      return {
        isVerificationPage: data.is_verification_page === true || data.is_verification_page === 'true',
        company: data.company || 'Unknown',
        title: data.title || 'Unknown',
        salary: data.salary,
        techStack: data.tech_stack,
        location: data.location,
        isRemote: data.work_type?.toLowerCase().includes('fully remote') || false,
        isHybrid: data.work_type?.toLowerCase().includes('hybrid') || false,
        isOnsite: data.work_type?.toLowerCase().includes('onsite') || false,
        isStartup: data.is_startup === 'yes' || data.is_startup === true,
        details: data.details
      };
    } catch (err) {
      console.log(`⚠️ Parse error: ${err.message}`);
      return null;
    }
  }

  async close() {
    this.isReady = false;
  }
}

module.exports = GPTExtractor;

