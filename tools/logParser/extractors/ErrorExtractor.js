const BaseExtractor = require('./BaseExtractor');

class ErrorExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('errors', config);
    this.stats = this.initializeStats();
    this.warningCounts = {};
    this.inErrorsSection = false;
    this.currentError = null;
    this.lastFaction = null;
    this.eventLineCount = 0; // Track number of [EVENT] lines seen for debug logging
  }

  initializeStats() {
    return {
      totalErrors: 0,
      totalWarnings: 0,
      byCategory: {},
      byMessage: {}
    };
  }

  reset() {
    super.reset();
    this.inErrorsSection = false;
    this.currentError = null;
    this.lastFaction = null;
    this.eventLineCount = 0; // Reset event line counter
  }

  extract(line, context) {
    const trimmed = line.trim();
    const isEventLine = trimmed.startsWith('[EVENT]');
    let shouldLog = false;
    
    if (isEventLine) {
      this.eventLineCount += 1;
      shouldLog = this.eventLineCount <= 5; // Log first 5 [EVENT] lines encountered
    }
    
    if (shouldLog) {
      console.log(`[DEBUG] ErrorExtractor.extract() called for [EVENT] line ${context.lineNumber} (event #${this.eventLineCount})`);
    }
    
    // Detect "ERRORS:" section header
    if (trimmed === 'ERRORS:') {
      this.inErrorsSection = true;
      this.currentError = null;
      return true; // Claim this line but don't process as error
    }

    // Check for section boundaries that end the ERRORS section
    if (this.inErrorsSection) {
      if (trimmed === '' || 
          trimmed.startsWith('REASONING SUMMARY:') ||
          trimmed.startsWith('GOAL CHAIN:') ||
          trimmed.startsWith('DECISIONS MADE:') ||
          trimmed.startsWith('ACTIONS TAKEN:') ||
          trimmed.startsWith('GOAL FAILURE CONTEXT:') ||
          trimmed.startsWith('INFO:') ||
          /^=+$/.test(trimmed)) {
        this._finalizeCurrentError(context);
        this.inErrorsSection = false;
        return false; // Let other extractors handle these
      }

      // Process numbered error lines within ERRORS section
      const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (numberedMatch) {
        this._finalizeCurrentError(context);
        this.currentError = {
          message: numberedMatch[1].trim(),
          reasoning: null,
          error: null,
          lineNumber: context.lineNumber
        };
        return true;
      }

      // Process indented error details
      if (this.currentError) {
        const errorMatch = trimmed.match(/^Error:\s*(.*)$/);
        if (errorMatch) {
          this.currentError.error = errorMatch[1].trim();
          return true;
        }

        const reasoningMatch = trimmed.match(/^Reasoning:\s*(.*)$/);
        if (reasoningMatch) {
          this.currentError.reasoning = reasoningMatch[1].trim();
          return true;
        }
      }
    }

    // Update faction context from Faction AI report headers
    const factionMatch = line.match(/FACTION AI REPORT - (.+?) - Day/);
    if (factionMatch) {
      this.lastFaction = factionMatch[1].trim();
    }

    // Standard error detection
    const severity = this._detectSeverity(line, shouldLog);
    if (!severity) {
      if (shouldLog) {
        console.log(`[DEBUG]   ErrorExtractor returning false (no severity detected)`);
      }
      return false;
    }
    
    if (shouldLog) {
      console.log(`[DEBUG]   ErrorExtractor detected severity: ${severity} - returning true`);
    }

    const { category, message } = this._parseCategoryAndMessage(line, context);
    const key = message || line;

    if (severity === 'ERROR') {
      this.stats.totalErrors += 1;
    } else {
      this.stats.totalWarnings += 1;
    }

    this._increment(this.stats.byCategory, category);
    this._increment(this.stats.byMessage, key);

    this.addError({
      severity,
      category,
      message,
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null,
      faction: this.lastFaction || null
    });

    if (message) {
      const warningKey = `${severity}:${message}`;
      this.warningCounts[warningKey] = (this.warningCounts[warningKey] || 0) + 1;
      if (this.warningCounts[warningKey] === 10) {
        this.addAnomaly({
          type: 'repeat_warning',
          summary: message,
          count: this.warningCounts[warningKey]
        });
      }
    }
    return true;
  }

  _finalizeCurrentError(context) {
    if (!this.currentError) return;

    const { message, reasoning, error, lineNumber } = this.currentError;
    const fullMessage = error ? `${message} (${error})` : message;
    const category = this._extractCategoryFromMessage(message);
    
    this.stats.totalErrors += 1;
    this._increment(this.stats.byCategory, category);
    this._increment(this.stats.byMessage, fullMessage);

    this.addError({
      severity: 'ERROR',
      category,
      message: fullMessage,
      reasoning: reasoning || null,
      lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null,
      faction: this.lastFaction || null
    });

    this.currentError = null;
  }

  _detectSeverity(line, shouldLog = false) {
    const upperLine = line.toUpperCase();
    const isEventLine = line.trim().startsWith('[EVENT]');
    
    if (shouldLog) {
      console.log(`[DEBUG] ErrorExtractor._detectSeverity() called for [EVENT] line`);
    }
    
    // Standard severity markers
    if (line.includes('[SerfLogger:WARN]') || line.includes('[WARN]')) {
      if (shouldLog) console.log(`[DEBUG]   Matched: [WARN] marker`);
      return 'WARN';
    }
    
    // Check for [ERROR] explicitly first
    if (line.includes('[ERROR]')) {
      if (shouldLog) console.log(`[DEBUG]   Matched: [ERROR] marker`);
      return 'ERROR';
    }
    
    // Don't match [EVENT] lines - check for ERROR but exclude EVENT
    if (upperLine.includes('ERROR') && !upperLine.includes('[EVENT]')) {
      if (shouldLog) console.log(`[DEBUG]   Matched: ERROR in upperLine but excluded [EVENT]`);
      return 'ERROR';
    }
    
    if (line.includes('Exception') || line.includes('exception')) {
      if (shouldLog) console.log(`[DEBUG]   Matched: Exception`);
      return 'ERROR';
    }
    
    if (line.includes('Error') && line.includes(']')) {
      if (shouldLog) console.log(`[DEBUG]   Matched: Error with ]`);
      return 'ERROR';
    }
    
    // Detect "Error:" pattern (with colon) even without brackets
    if (/Error:\s*/.test(line)) {
      if (shouldLog) console.log(`[DEBUG]   Matched: Error: pattern`);
      return 'ERROR';
    }
    
    // Detect numbered error lines (pattern: " 1. Error...")
    if (/^\s*\d+\.\s+.*[Ee]rror/.test(line)) {
      if (shouldLog) console.log(`[DEBUG]   Matched: numbered error line`);
      return 'ERROR';
    }
    
    // Case-insensitive error detection for lines containing error keywords
    // But exclude [EVENT] lines
    if (upperLine.includes('ERROR') && !upperLine.includes('NO ERROR') && !upperLine.includes('[EVENT]')) {
      if (shouldLog) console.log(`[DEBUG]   Matched: ERROR keyword (excluded [EVENT])`);
      return 'ERROR';
    }
    
    if (shouldLog) {
      console.log(`[DEBUG]   No match - returning null`);
    }
    
    return null;
  }

  _parseCategoryAndMessage(line, context = {}) {
    // Try bracket pattern first
    const bracketMatch = line.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (bracketMatch) {
      const rawCategory = bracketMatch[1];
      const message = bracketMatch[2].trim();
      const category = rawCategory.split(':')[0];
      return { category, message };
    }

    // Extract category from message content
    const trimmed = line.trim();
    const category = this._extractCategoryFromMessage(trimmed);
    
    // Clean up the message
    let message = trimmed;
    
    // Remove numbered list prefix if present
    message = message.replace(/^\d+\.\s+/, '');
    
    // Remove "Error:" prefix if present
    message = message.replace(/^Error:\s*/, '');
    
    return { category, message: message.trim() || trimmed };
  }

  _extractCategoryFromMessage(message) {
    const upperMessage = message.toUpperCase();
    
    // Goal chain related errors
    if (upperMessage.includes('CHAIN VALIDATION FAILED') || 
        upperMessage.includes('CHAIN CREATION ERRORS') ||
        upperMessage.includes('CHAIN') && upperMessage.includes('BLOCKED')) {
      return 'GoalChain';
    }
    
    // Goal execution errors
    if (upperMessage.includes('ERROR EXECUTING GOAL') ||
        upperMessage.includes('EXECUTING GOAL')) {
      return 'GoalExecutor';
    }
    
    // Type errors
    if (upperMessage.includes('CANNOT READ PROPERTIES') ||
        upperMessage.includes('TYPEERROR') ||
        upperMessage.includes('UNDEFINED')) {
      return 'TypeError';
    }
    
    // Extract goal name if present (e.g., BUILD_MILL, BUILD_MINE)
    const goalMatch = message.match(/\b(BUILD_[A-Z_]+|SCOUT_[A-Z_]+|ATTACK_[A-Z_]+)\b/);
    if (goalMatch) {
      // Return category with goal context
      const baseCategory = upperMessage.includes('CHAIN') ? 'GoalChain' : 
                          upperMessage.includes('EXECUTING') ? 'GoalExecutor' : 'GoalError';
      return baseCategory;
    }
    
    // Faction AI related
    if (upperMessage.includes('FACTION') || upperMessage.includes('AI')) {
      return 'FactionAI';
    }
    
    // Default to unknown if no pattern matches
    return 'unknown';
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = ErrorExtractor;
