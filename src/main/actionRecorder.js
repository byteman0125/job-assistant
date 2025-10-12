// Action Recorder - Records user actions for teaching the scraper
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ActionRecorder {
  constructor() {
    this.isRecording = false;
    this.currentPlatform = null;
    this.recordedActions = [];
    this.actionsFilePath = path.join(app.getPath('userData'), 'recorded-actions.json');
    this.loadRecordedActions();
  }

  loadRecordedActions() {
    try {
      if (fs.existsSync(this.actionsFilePath)) {
        const data = fs.readFileSync(this.actionsFilePath, 'utf8');
        this.recordedActions = JSON.parse(data);
        console.log(`Loaded ${Object.keys(this.recordedActions).length} platform actions from file`);
      } else {
        this.recordedActions = {};
      }
    } catch (error) {
      console.error('Error loading recorded actions:', error);
      this.recordedActions = {};
    }
  }

  saveRecordedActions() {
    try {
      fs.writeFileSync(
        this.actionsFilePath,
        JSON.stringify(this.recordedActions, null, 2),
        'utf8'
      );
      console.log('Recorded actions saved to:', this.actionsFilePath);
      return true;
    } catch (error) {
      console.error('Error saving recorded actions:', error);
      return false;
    }
  }

  startRecording(platform) {
    this.isRecording = true;
    this.currentPlatform = platform;
    
    if (!this.recordedActions[platform]) {
      this.recordedActions[platform] = {
        steps: [],
        lastUpdated: Date.now()
      };
    }
    
    console.log(`📹 Started recording actions for ${platform}`);
  }

  recordAction(action) {
    if (!this.isRecording || !this.currentPlatform) {
      return;
    }

    this.recordedActions[this.currentPlatform].steps.push({
      ...action,
      timestamp: Date.now()
    });

    console.log(`📝 Recorded action for ${this.currentPlatform}:`, action.type);
  }

  stopRecording() {
    if (this.isRecording && this.currentPlatform) {
      this.recordedActions[this.currentPlatform].lastUpdated = Date.now();
      this.saveRecordedActions();
      console.log(`✅ Stopped recording for ${this.currentPlatform}. Saved ${this.recordedActions[this.currentPlatform].steps.length} actions`);
    }
    
    this.isRecording = false;
    this.currentPlatform = null;
  }

  getActionsFor(platform) {
    return this.recordedActions[platform] || null;
  }

  hasActionsFor(platform) {
    return !!this.recordedActions[platform] && this.recordedActions[platform].steps.length > 0;
  }

  clearActionsFor(platform) {
    if (this.recordedActions[platform]) {
      delete this.recordedActions[platform];
      this.saveRecordedActions();
      console.log(`🗑️ Cleared recorded actions for ${platform}`);
    }
  }

  getAllPlatforms() {
    return Object.keys(this.recordedActions);
  }
}

module.exports = ActionRecorder;

