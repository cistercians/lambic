// Faction AI Logger
// Centralized logging utility for consistent formatting and easy enable/disable

class FactionAILogger {
  constructor(house) {
    this.house = house;
    // Only enable logging for specific factions: Teutons, Goths, Celts, Franks
    const allowedFactions = ['Teutons', 'Goths', 'Celts', 'Franks'];
    const baseName = (house.name || house.type || '').toString().replace(/\s+\d+$/, '').trim(); // Remove trailing numbers
    // Case-insensitive matching
    const baseNameLower = baseName.toLowerCase();
    const allowedLower = allowedFactions.map(f => f.toLowerCase());
    this.enabled = allowedLower.includes(baseNameLower);
    this.logLevel = 'INFO'; // DEBUG, INFO, DECISION, ACTION, ERROR
    
    // Report data collection
    this.reportData = null;
    this.reportStarted = false;
  }
  
  // Set log level (DEBUG, INFO, DECISION, ACTION, ERROR)
  setLogLevel(level) {
    this.logLevel = level;
  }
  
  // Enable/disable logging
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  
  // Check if should log at this level
  shouldLog(level) {
    if (!this.enabled) return false;
    
    const levels = ['DEBUG', 'INFO', 'DECISION', 'ACTION', 'ERROR'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const requestedLevelIndex = levels.indexOf(level);
    
    return requestedLevelIndex >= currentLevelIndex;
  }
  
  // Get current day
  getDay() {
    return global.day || 1;
  }
  
  // Get faction name
  getFactionName() {
    return this.house.name || this.house.type || 'unknown';
  }
  
  // Get building summary
  getBuildingSummary() {
    if (!this.house.ai || !this.house.ai.buildingService) {
      return {};
    }
    
    const buildingTypes = ['mill', 'farm', 'mine', 'lumbermill', 'forge', 'garrison'];
    const summary = {};
    
    for (const type of buildingTypes) {
      summary[type] = this.house.ai.buildingService.getBuildingCount(type);
    }
    
    return summary;
  }
  
  // Get territory summary
  getTerritorySummary() {
    if (!this.house.ai || !this.house.ai.territory) {
      return {};
    }
    
    const territory = this.house.ai.territory;
    return {
      center: territory.coreBase?.center || null,
      radius: territory.coreBase?.radius || null,
      buildingCount: territory.coreBase?.buildings?.length || 0,
      outpostCount: territory.outposts?.length || 0
    };
  }
  
  // Get military summary
  getMilitarySummary() {
    if (!this.house.ai) {
      return {};
    }
    
    const militaryUnits = this.house.ai.getMilitaryUnits ? this.house.ai.getMilitaryUnits() : [];
    return {
      unitCount: militaryUnits.length,
      scoutingParties: this.house.ai.militaryManager?.activeScoutingParties?.length || 0,
      attackForces: this.house.ai.militaryManager?.activeAttackForces?.length || 0
    };
  }
  
  // Get current context (resources, buildings, territory, military)
  getContext() {
    return {
      day: this.getDay(),
      resources: { ...this.house.stores },
      buildings: this.getBuildingSummary(),
      territory: this.getTerritorySummary(),
      military: this.getMilitarySummary()
    };
  }
  
  // Format log message
  formatLog(component, category, message, context = {}) {
    const timestamp = new Date().toISOString();
    const faction = this.getFactionName();
    const day = this.getDay();
    
    // Base log line
    const logLine = `[${component}] [${timestamp}] [${faction}] [day ${day}] [${category}] ${message}`;
    
    // Include context if provided and valid
    if (context && typeof context === 'object' && Object.keys(context).length > 0) {
      return `${logLine}\n  Context: ${JSON.stringify(context, null, 2)}`;
    }
    
    return logLine;
  }
  
  // Log decision point with context (simplified - also collects for report)
  logDecision(category, message, context = {}) {
    // Collect for report
    this.collectDecision(category, message, context);
    
    // Also log immediately if enabled (for backward compatibility)
    if (!this.shouldLog('DECISION')) return;
    
    // Ensure context is an object
    if (!context || typeof context !== 'object') {
      context = {};
    }
    
    // Extract only essential info: summary and reasoning
    const summary = {
      reasoning: context.reasoning || context.reason || null
    };
    
    // Add minimal essential context for key decisions
    if (context.selectedGoal) {
      summary.goal = context.selectedGoal;
      summary.utility = context.utility;
    }
    if (context.goal) {
      summary.goal = context.goal;
    }
    if (context.buildingType) {
      summary.building = context.buildingType;
    }
    
    // Add alternatives/options if available
    if (context.allCandidates && Array.isArray(context.allCandidates)) {
      summary.alternatives = context.allCandidates.map(c => `${c.type} (${c.utility})`).join(', ');
    }
    if (context.rankedGoals && Array.isArray(context.rankedGoals)) {
      summary.alternatives = context.rankedGoals.map(g => `${g.type} (${g.utility})`).join(', ');
    }
    
    const logLine = this.formatLog('FactionAI', category, message, summary.reasoning || summary.alternatives ? summary : {});
    console.log(logLine);
  }
  
  // Log action taken (simplified - also collects for report)
  logAction(action, details = {}) {
    // Collect for report
    this.collectAction(action, details);
    
    // Don't log immediately if report collection is active (avoid duplicates)
    if (this.reportStarted) return;
    
    // Also log immediately if enabled (for backward compatibility when report not active)
    if (!this.shouldLog('ACTION')) return;
    
    // Ensure details is an object
    if (!details || typeof details !== 'object') {
      details = {};
    }
    
    // Extract only essential info
    const summary = {
      reasoning: details.reasoning || null
    };
    
    if (details.goal) summary.goal = details.goal;
    if (details.buildingType) summary.building = details.buildingType;
    
    const logLine = this.formatLog('FactionAI', 'ACTION', action, summary.reasoning ? summary : {});
    console.log(logLine);
  }
  
  // Log reasoning (simplified - also collects for report)
  logReasoning(reason, data = {}) {
    // Collect for report
    this.collectInfo(reason, data);
    
    // Also log immediately if enabled (for backward compatibility)
    if (!this.shouldLog('INFO')) return;
    
    const logLine = this.formatLog('FactionAI', 'REASONING', reason, {});
    console.log(logLine);
  }
  
  // Log info message (simplified - also collects for report)
  logInfo(message, context = {}) {
    // Collect for report
    this.collectInfo(message, context);
    
    // Don't log immediately if report collection is active (avoid duplicates)
    if (this.reportStarted) return;
    
    // Also log immediately if enabled (for backward compatibility when report not active)
    if (!this.shouldLog('INFO')) return;
    
    const logLine = this.formatLog('FactionAI', 'INFO', message, {});
    console.log(logLine);
  }
  
  // Log debug message (disabled for reduced verbosity)
  logDebug(message, context = {}) {
    // Disabled - too verbose
    return;
  }
  
  // Log error (always logged regardless of level, simplified)
  logError(message, error = null, context = {}) {
    // Ensure context is an object
    if (!context || typeof context !== 'object') {
      context = {};
    }
    
    // Always collect for report
    this.collectError(message, error, context);
    
    // Always log errors immediately (even during report collection) for debugging
    const summary = {
      reasoning: context.reasoning || null
    };
    
    if (error) {
      summary.error = error.message || String(error);
    }
    
    const logLine = this.formatLog('FactionAI', 'ERROR', message, summary.reasoning || summary.error ? summary : {});
    console.error(logLine);
    if (error && error.stack) {
      console.error(error.stack);
    }
  }
  
  // ============================================================================
  // REPORT COLLECTION METHODS
  // ============================================================================
  
  // Start report collection for a new evaluation cycle
  startReport() {
    if (!this.enabled) return;
    
    this.reportData = {
      day: this.getDay(),
      faction: this.getFactionName(),
      timestamp: new Date().toISOString(),
      currentState: this.getContext(),
      goalChain: null,
      decisions: [],
      actions: [],
      errors: [],
      info: []
    };
    this.reportStarted = true;
  }
  
  // Collect decision data
  collectDecision(category, message, context = {}) {
    if (!this.enabled || !this.reportStarted) return;
    
    // Ensure context is an object
    if (!context || typeof context !== 'object') {
      context = {};
    }
    
    const decision = {
      category,
      message,
      reasoning: context.reasoning || context.reason || null,
      alternatives: null
    };
    
    // Extract alternatives if available
    if (context.allCandidates && Array.isArray(context.allCandidates)) {
      decision.alternatives = context.allCandidates.map(c => `${c.type} (${c.utility})`).join(', ');
    }
    if (context.rankedGoals && Array.isArray(context.rankedGoals)) {
      decision.alternatives = context.rankedGoals.map(g => `${g.type} (${g.utility})`).join(', ');
    }
    
    // Add goal/utility info if available
    if (context.selectedGoal || context.goal) {
      decision.goal = context.selectedGoal || context.goal;
      decision.utility = context.utility || null;
    }
    if (context.buildingType) {
      decision.building = context.buildingType;
    }
    
    this.reportData.decisions.push(decision);
  }
  
  // Collect action data
  collectAction(action, details = {}) {
    if (!this.enabled || !this.reportStarted) return;
    
    // Ensure details is an object
    if (!details || typeof details !== 'object') {
      details = {};
    }
    
    const actionData = {
      action,
      reasoning: details.reasoning || null,
      goal: details.goal || null,
      building: details.buildingType || null,
      status: details.status || 'COMPLETED'
    };
    
    this.reportData.actions.push(actionData);
  }
  
  // Collect info message
  collectInfo(message, context = {}) {
    if (!this.enabled || !this.reportStarted) return;
    
    this.reportData.info.push({
      message,
      context: context || {}
    });
  }
  
  // Collect error data
  collectError(message, error = null, context = {}) {
    if (!this.enabled || !this.reportStarted) return;
    
    // Ensure context is an object
    if (!context || typeof context !== 'object') {
      context = {};
    }
    
    const errorData = {
      message,
      error: error ? (error.message || String(error)) : null,
      reasoning: context.reasoning || null
    };
    
    this.reportData.errors.push(errorData);
  }
  
  // Update goal chain information
  updateGoalChain(goalChain) {
    if (!this.enabled || !this.reportStarted || !goalChain) return;
    
    this.reportData.goalChain = {
      mainGoal: goalChain.mainGoal?.type || 'unknown',
      steps: goalChain.steps.map(s => s.type),
      currentStep: goalChain.currentStep,
      totalSteps: goalChain.steps.length,
      status: goalChain.isComplete() ? 'COMPLETE' : (goalChain.isFailed() ? 'FAILED' : 'IN_PROGRESS'),
      currentGoal: goalChain.getCurrentGoal()?.type || null
    };
  }
  
  // Generate and output the complete report
  generateReport() {
    if (!this.enabled || !this.reportStarted || !this.reportData) return;
    
    const report = this.formatReport(this.reportData);
    console.log(report);
  }
  
  // Format the report as structured text
  formatReport(data) {
    const lines = [];
    
    // Header
    lines.push('='.repeat(80));
    lines.push(`FACTION AI REPORT - ${data.faction} - Day ${data.day}`);
    lines.push('='.repeat(80));
    lines.push('');
    
    // Current State
    lines.push('CURRENT STATE:');
    const resources = Object.entries(data.currentState.resources || {})
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`  Resources: ${resources || 'none'}`);
    
    const buildings = Object.entries(data.currentState.buildings || {})
      .filter(([_, v]) => v > 0)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    lines.push(`  Buildings: ${buildings || 'none'}`);
    
    const territory = data.currentState.territory || {};
    if (territory.radius) {
      lines.push(`  Territory: radius: ${territory.radius}, buildings: ${territory.buildingCount || 0}, outposts: ${territory.outpostCount || 0}`);
    }
    
    const military = data.currentState.military || {};
    lines.push(`  Military: units: ${military.unitCount || 0}, scouting: ${military.scoutingParties || 0}, attacks: ${military.attackForces || 0}`);
    lines.push('');
    
    // Goal Chain
    if (data.goalChain) {
      lines.push('GOAL CHAIN:');
      lines.push(`  Main Goal: ${data.goalChain.mainGoal}`);
      lines.push(`  Status: ${data.goalChain.status} (step ${data.goalChain.currentStep + 1} of ${data.goalChain.totalSteps})`);
      if (data.goalChain.steps.length > 0) {
        lines.push(`  Chain: ${data.goalChain.steps.join(' -> ')}`);
      }
      if (data.goalChain.currentGoal) {
        lines.push(`  Current Step: ${data.goalChain.currentGoal}`);
      }
      lines.push('');
    } else {
      lines.push('GOAL CHAIN: None');
      lines.push('');
    }
    
    // Decisions Made
    if (data.decisions.length > 0) {
      lines.push('DECISIONS MADE:');
      data.decisions.forEach((decision, index) => {
        lines.push(`  ${index + 1}. ${decision.message}`);
        if (decision.goal && decision.utility !== null && decision.utility !== undefined) {
          lines.push(`     Selected: ${decision.goal} (utility: ${decision.utility})`);
        }
        if (decision.alternatives) {
          lines.push(`     Alternatives: ${decision.alternatives}`);
        }
        if (decision.reasoning) {
          lines.push(`     Reasoning: ${decision.reasoning}`);
        }
      });
      lines.push('');
    }
    
    // Actions Taken
    if (data.actions.length > 0) {
      lines.push('ACTIONS TAKEN:');
      data.actions.forEach((action, index) => {
        lines.push(`  ${index + 1}. ${action.action}`);
        if (action.reasoning) {
          lines.push(`     Reasoning: ${action.reasoning}`);
        }
        if (action.status) {
          lines.push(`     Status: ${action.status}`);
        }
      });
      lines.push('');
    }
    
    // Errors
    if (data.errors.length > 0) {
      lines.push('ERRORS:');
      data.errors.forEach((error, index) => {
        lines.push(`  ${index + 1}. ${error.message}`);
        if (error.reasoning) {
          lines.push(`     Reasoning: ${error.reasoning}`);
        }
        if (error.error) {
          lines.push(`     Error: ${error.error}`);
        }
      });
      lines.push('');
    }
    
    // Reasoning Summary
    const reasoningPoints = [];
    data.decisions.forEach(d => {
      if (d.reasoning) {
        reasoningPoints.push(`- ${d.message}: ${d.reasoning}`);
      }
    });
    data.actions.forEach(a => {
      if (a.reasoning) {
        reasoningPoints.push(`- ${a.action}: ${a.reasoning}`);
      }
    });
    
    if (reasoningPoints.length > 0) {
      lines.push('REASONING SUMMARY:');
      reasoningPoints.forEach(point => lines.push(`  ${point}`));
      lines.push('');
    }
    
    lines.push('='.repeat(80));
    
    return lines.join('\n');
  }
  
  // Clear report data for next evaluation
  clearReport() {
    this.reportData = null;
    this.reportStarted = false;
  }
}

module.exports = FactionAILogger;


