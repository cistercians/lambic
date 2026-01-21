const BaseExtractor = require('./BaseExtractor');

class FactionAIReportExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('factionAIReport', config);
    this._resetState();
  }

  initializeStats() {
    return {
      totalReports: 0,
      errorCount: 0,
      errorsByFaction: {},
      errorsByGoal: {},
      blockersByReason: {}
    };
  }

  reset() {
    super.reset();
    this._resetState();
  }

  _resetState() {
    this.inReport = false;
    this.reportStartLine = null;
    this.seenContent = false;
    this.currentSection = null;
    this.currentReport = null;
    this.currentError = null;
    this.currentDecision = null;
    this.currentAction = null;
    this.currentGoalChain = null;
    this.currentFailureContext = null;
    this.currentInfo = null;
    this.currentReportState = null;
  }

  extract(line, context) {
    // Try both formats: "FACTION AI REPORT - Faction - Day N" and "REPORT ID: Faction-dayN-timestamp"
    let headerMatch = line.match(/^FACTION AI REPORT - (.+?) - Day (\d+)/);
    if (headerMatch) {
      this._finalizeError();
      this._startReport(headerMatch, context);
      return true;
    }

    // Handle REPORT ID format
    if (line.match(/^REPORT ID:/)) {
      this._finalizeError();
      if (this._startReportFromLine(line, context)) {
        return true;
      }
    }

    if (!this.inReport) return false;

    if (line.startsWith('=') && this.seenContent && context.lineNumber > this.reportStartLine + 1) {
      this._finalizeSectionItems();
      // Finalize report state if we have it
      if (this.currentReportState && this.currentReport) {
        this._finalizeReportState();
      }
      this._resetState();
      return true;
    }

    const sectionMatch = line.match(/^([A-Z][A-Z\s]+):$/);
    if (sectionMatch) {
      this._finalizeSectionItems();
      const sectionName = sectionMatch[1].trim();
      this.currentSection = sectionName;
      this.seenContent = true;
      
      // If we're starting a new section and have report state, finalize it
      if (this.currentReportState && this.currentReport) {
        this._finalizeReportState();
      }
      return true;
    }

    if (this.currentSection === 'ERRORS') {
      return this._parseErrorLine(line, context);
    }

    if (this.currentSection === 'GOAL CHAIN') {
      return this._parseGoalChainLine(line);
    }

    if (this.currentSection === 'DECISIONS MADE') {
      return this._parseDecisionLine(line, context);
    }

    if (this.currentSection === 'ACTIONS TAKEN') {
      return this._parseActionLine(line, context);
    }

    if (this.currentSection === 'GOAL FAILURE CONTEXT') {
      return this._parseFailureContextLine(line, context);
    }

    if (this.currentSection === 'INFO') {
      return this._parseInfoLine(line, context);
    }

    // Handle REPORT ID format sections (CURRENT STATE)
    if (this.currentSection === 'CURRENT STATE' || !this.currentSection) {
      // Try to parse state information lines
      const resourcesMatch = line.match(/^\s+Resources:\s+(.+)$/);
      if (resourcesMatch) {
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        this.currentReportState.resources = this._parseResourceString(resourcesMatch[1]);
        return true;
      }

      const buildingsMatch = line.match(/^\s+Buildings:\s+(.+)$/);
      if (buildingsMatch) {
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        this.currentReportState.buildings = this._parseBuildingString(buildingsMatch[1]);
        return true;
      }

      const territoryMatch = line.match(/^\s+Territory:\s+(.+)$/);
      if (territoryMatch) {
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        this.currentReportState.territory = this._parseTerritoryString(territoryMatch[1]);
        return true;
      }

      const militaryMatch = line.match(/^\s+Military:\s+(.+)$/);
      if (militaryMatch) {
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        this.currentReportState.military = this._parseMilitaryString(militaryMatch[1]);
        return true;
      }

      const totalSerfsMatch = line.match(/^\s+Total Serfs:\s+(\d+)$/);
      if (totalSerfsMatch) {
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        this.currentReportState.totalSerfs = Number(totalSerfsMatch[1]);
        return true;
      }

      const byBuildingTypeMatch = line.match(/^\s+By Building Type:\s+(.+)$/);
      if (byBuildingTypeMatch) {
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        this.currentReportState.byBuildingType = this._parseBuildingString(byBuildingTypeMatch[1]);
        return true;
      }

      const recentSpawnsMatch = line.match(/^\s+Recent Spawns Today:\s+(\d+)\s+serf\(s\)\s+spawned$/);
      if (recentSpawnsMatch) {
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        this.currentReportState.recentSpawns = Number(recentSpawnsMatch[1]);
        return true;
      }

      // Check for CURRENT STATE section header
      if (line.match(/^\s*CURRENT STATE:\s*$/)) {
        this.currentSection = 'CURRENT STATE';
        this.seenContent = true;
        if (!this.currentReportState) {
          this.currentReportState = {};
        }
        return true;
      }
    }

    return false;
  }

  _parseResourceString(str) {
    const resources = {};
    const parts = str.split(',').map(s => s.trim());
    for (const part of parts) {
      const match = part.match(/(\w+):\s*(\d+)/);
      if (match) {
        resources[match[1]] = Number(match[2]);
      }
    }
    return resources;
  }

  _parseBuildingString(str) {
    if (str.toLowerCase() === 'none') {
      return {};
    }
    const buildings = {};
    const parts = str.split(',').map(s => s.trim());
    for (const part of parts) {
      const match = part.match(/(\w+):\s*(\d+)/);
      if (match) {
        buildings[match[1]] = Number(match[2]);
      }
    }
    return buildings;
  }

  _parseTerritoryString(str) {
    const territory = {};
    const matches = str.matchAll(/(\w+):\s*(\d+)/g);
    for (const match of matches) {
      territory[match[1]] = Number(match[2]);
    }
    return territory;
  }

  _parseMilitaryString(str) {
    const military = {};
    const matches = str.matchAll(/(\w+):\s*(\d+)/g);
    for (const match of matches) {
      military[match[1]] = Number(match[2]);
    }
    return military;
  }

  _startReport(headerMatch, context) {
    const faction = headerMatch[1].trim();
    const day = Number(headerMatch[2]);
    // Generate report ID - actual ID will be parsed if REPORT ID format is used
    const reportId = `${faction}-${day}-${context.lineNumber}`;
    this.inReport = true;
    this.reportStartLine = context.lineNumber;
    this.seenContent = false;
    this.currentSection = null;
    this.currentReport = { faction, day, reportId, chainId: null };
    this.currentReportState = null;
    this.stats.totalReports += 1;
  }

  _startReportFromLine(line, context) {
    // Called when we encounter REPORT ID: line directly
    const reportIdMatch = line.match(/^REPORT ID:\s+(.+?)-day(\d+)-(.+)$/);
    if (reportIdMatch) {
      const faction = reportIdMatch[1];
      const day = Number(reportIdMatch[2]);
      const reportId = reportIdMatch[0].replace('REPORT ID: ', '').trim();
      this.inReport = true;
      this.reportStartLine = context.lineNumber;
      this.seenContent = false;
      this.currentSection = null;
      this.currentReport = { faction, day, reportId, chainId: null };
      this.currentReportState = null;
      this.stats.totalReports += 1;
      return true;
    }
    return false;
  }

  _finalizeReportState() {
    if (!this.currentReportState || !this.currentReport) return;
    
    this.addEvent({
      type: 'faction_ai_report_state',
      faction: this.currentReport.faction,
      day: this.currentReport.day,
      reportId: this.currentReport.reportId,
      resources: this.currentReportState.resources || null,
      buildings: this.currentReportState.buildings || null,
      territory: this.currentReportState.territory || null,
      military: this.currentReportState.military || null,
      totalSerfs: this.currentReportState.totalSerfs || null,
      byBuildingType: this.currentReportState.byBuildingType || null,
      recentSpawns: this.currentReportState.recentSpawns || null
    });
    
    this.currentReportState = null;
  }

  _parseErrorLine(line, context) {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      this._finalizeError();
      this.currentError = {
        message: numberedMatch[1].trim(),
        reasoning: null,
        error: null,
        lineNumber: context.lineNumber
      };
      return true;
    }

    if (!this.currentError) return true;

    const reasoningMatch = trimmed.match(/^Reasoning:\s*(.*)$/);
    if (reasoningMatch) {
      this.currentError.reasoning = reasoningMatch[1].trim();
      return true;
    }

    const errorMatch = trimmed.match(/^Error:\s*(.*)$/);
    if (errorMatch) {
      this.currentError.error = errorMatch[1].trim();
      return true;
    }

    return true;
  }

  _parseGoalChainLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return true;

    if (!this.currentGoalChain) {
      this.currentGoalChain = {
        chainId: null,
        mainGoal: null,
        status: null,
        steps: null,
        currentStep: null
      };
    }

    const chainIdMatch = trimmed.match(/^Chain ID:\s*(.*)$/);
    if (chainIdMatch) {
      this.currentGoalChain.chainId = chainIdMatch[1].trim();
      this.currentReport.chainId = this.currentGoalChain.chainId;
      return true;
    }

    const mainGoalMatch = trimmed.match(/^Main Goal:\s*(.*)$/);
    if (mainGoalMatch) {
      this.currentGoalChain.mainGoal = mainGoalMatch[1].trim();
      return true;
    }

    const statusMatch = trimmed.match(/^Status:\s*(.*)$/);
    if (statusMatch) {
      this.currentGoalChain.status = statusMatch[1].trim();
      return true;
    }

    const chainMatch = trimmed.match(/^Chain:\s*(.*)$/);
    if (chainMatch) {
      const chainValue = chainMatch[1].trim();
      this.currentGoalChain.steps = chainValue ? chainValue.split(' -> ') : [];
      return true;
    }

    const currentStepMatch = trimmed.match(/^Current Step:\s*(.*)$/);
    if (currentStepMatch) {
      this.currentGoalChain.currentStep = currentStepMatch[1].trim();
      return true;
    }

    return true;
  }

  _parseDecisionLine(line, context) {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      this._finalizeDecision();
      this.currentDecision = {
        message: numberedMatch[1].trim(),
        goal: null,
        utility: null,
        alternatives: null,
        reasoning: null,
        lineNumber: context.lineNumber
      };
      return true;
    }

    if (!this.currentDecision) return true;

    const selectedMatch = trimmed.match(/^Selected:\s+([A-Z_]+)\s+\(utility:\s*([0-9.]+)\)/);
    if (selectedMatch) {
      this.currentDecision.goal = selectedMatch[1];
      this.currentDecision.utility = Number(selectedMatch[2]);
      return true;
    }

    const alternativesMatch = trimmed.match(/^Alternatives:\s*(.*)$/);
    if (alternativesMatch) {
      this.currentDecision.alternatives = alternativesMatch[1].trim();
      return true;
    }

    const reasoningMatch = trimmed.match(/^Reasoning:\s*(.*)$/);
    if (reasoningMatch) {
      this.currentDecision.reasoning = reasoningMatch[1].trim();
      return true;
    }

    return true;
  }

  _parseActionLine(line, context) {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      this._finalizeAction();
      this.currentAction = {
        action: numberedMatch[1].trim(),
        reasoning: null,
        status: null,
        lineNumber: context.lineNumber
      };
      return true;
    }

    if (!this.currentAction) return true;

    const reasoningMatch = trimmed.match(/^Reasoning:\s*(.*)$/);
    if (reasoningMatch) {
      this.currentAction.reasoning = reasoningMatch[1].trim();
      return true;
    }

    const statusMatch = trimmed.match(/^Status:\s*(.*)$/);
    if (statusMatch) {
      this.currentAction.status = statusMatch[1].trim();
      return true;
    }

    return true;
  }

  _parseFailureContextLine(line, context) {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const numberedMatch = trimmed.match(/^\d+\.\s+Goal:\s*(.*)$/);
    if (numberedMatch) {
      this._finalizeFailureContext();
      this.currentFailureContext = {
        goal: numberedMatch[1].trim(),
        chainId: null,
        step: null,
        reason: null,
        resourceBlocks: null,
        buildingBlocks: null,
        unitBlocks: null,
        resourceGapBlocks: null,
        locationBlocks: null,
        diagnostics: null,
        lineNumber: context.lineNumber
      };
      return true;
    }

    if (!this.currentFailureContext) return true;

    const chainIdMatch = trimmed.match(/^Chain ID:\s*(.*)$/);
    if (chainIdMatch) {
      this.currentFailureContext.chainId = chainIdMatch[1].trim();
      return true;
    }

    const stepMatch = trimmed.match(/^Step:\s*(.*)$/);
    if (stepMatch) {
      this.currentFailureContext.step = stepMatch[1].trim();
      return true;
    }

    const reasonMatch = trimmed.match(/^Reason:\s*(.*)$/);
    if (reasonMatch) {
      this.currentFailureContext.reason = reasonMatch[1].trim();
      return true;
    }

    const resourceMatch = trimmed.match(/^Resource Blocks:\s*(.*)$/);
    if (resourceMatch) {
      this.currentFailureContext.resourceBlocks = resourceMatch[1].trim();
      return true;
    }

    const buildingMatch = trimmed.match(/^Building Blocks:\s*(.*)$/);
    if (buildingMatch) {
      this.currentFailureContext.buildingBlocks = buildingMatch[1].trim();
      return true;
    }

    const unitMatch = trimmed.match(/^Unit Blocks:\s*(.*)$/);
    if (unitMatch) {
      this.currentFailureContext.unitBlocks = unitMatch[1].trim();
      return true;
    }

    const gapMatch = trimmed.match(/^Resource Gap Blocks:\s*(.*)$/);
    if (gapMatch) {
      this.currentFailureContext.resourceGapBlocks = gapMatch[1].trim();
      return true;
    }

    const locationMatch = trimmed.match(/^Location Blocks:\s*(.*)$/);
    if (locationMatch) {
      this.currentFailureContext.locationBlocks = locationMatch[1].trim();
      return true;
    }

    const diagnosticsMatch = trimmed.match(/^Diagnostics:\s*(.*)$/);
    if (diagnosticsMatch) {
      this.currentFailureContext.diagnostics = diagnosticsMatch[1].trim();
      return true;
    }

    return true;
  }

  _parseInfoLine(line, context) {
    const trimmed = line.trim();
    if (!trimmed) return true;

    const numberedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (numberedMatch) {
      this._finalizeInfo();
      this.currentInfo = {
        message: numberedMatch[1].trim(),
        context: null,
        lineNumber: context.lineNumber
      };
      return true;
    }

    if (!this.currentInfo) return true;

    const contextMatch = trimmed.match(/^Context:\s*(.*)$/);
    if (contextMatch) {
      this.currentInfo.context = contextMatch[1].trim();
      return true;
    }

    return true;
  }

  _finalizeSectionItems() {
    this._finalizeError();
    this._finalizeDecision();
    this._finalizeAction();
    this._finalizeGoalChain();
    this._finalizeFailureContext();
    this._finalizeInfo();
  }

  _finalizeError() {
    if (!this.currentError || !this.currentReport) return;
    const { faction, day, reportId, chainId } = this.currentReport;
    const { message, reasoning, error, lineNumber } = this.currentError;

    this.stats.errorCount += 1;
    this._increment(this.stats.errorsByFaction, faction);

    const goalMatch = message.match(/Goal blocked:\s+([A-Z_]+)/) ||
      message.match(/Chain validation failed:\s+([A-Z_]+)/) ||
      message.match(/Chain validation failed for\s+([A-Z_]+)/);
    if (goalMatch) {
      this._increment(this.stats.errorsByGoal, goalMatch[1]);
    }

    const reasonBucket = this._bucketReason(reasoning || message);
    if (reasonBucket) {
      this._increment(this.stats.blockersByReason, reasonBucket);
    }

    this.addError({
      severity: 'ERROR',
      category: 'faction_ai_report',
      message,
      reasoning,
      error,
      faction,
      day,
      reportId,
      chainId,
      lineNumber
    });

    this.currentError = null;
  }

  _finalizeDecision() {
    if (!this.currentDecision || !this.currentReport) return;
    const { faction, day, reportId, chainId } = this.currentReport;
    const decision = {
      type: 'faction_ai_decision',
      faction,
      day,
      reportId,
      chainId,
      message: this.currentDecision.message,
      goal: this.currentDecision.goal,
      utility: this.currentDecision.utility,
      alternatives: this.currentDecision.alternatives,
      reasoning: this.currentDecision.reasoning,
      lineNumber: this.currentDecision.lineNumber
    };
    this.addEvent(decision);
    this.currentDecision = null;
  }

  _finalizeAction() {
    if (!this.currentAction || !this.currentReport) return;
    const { faction, day, reportId, chainId } = this.currentReport;
    const action = {
      type: 'faction_ai_action',
      faction,
      day,
      reportId,
      chainId,
      action: this.currentAction.action,
      reasoning: this.currentAction.reasoning,
      status: this.currentAction.status,
      lineNumber: this.currentAction.lineNumber
    };
    this.addEvent(action);
    this.currentAction = null;
  }

  _finalizeGoalChain() {
    if (!this.currentGoalChain || !this.currentReport) return;
    const { faction, day, reportId } = this.currentReport;
    const goalChain = {
      type: 'faction_ai_goal_chain',
      faction,
      day,
      reportId,
      chainId: this.currentGoalChain.chainId || this.currentReport.chainId,
      mainGoal: this.currentGoalChain.mainGoal,
      status: this.currentGoalChain.status,
      steps: this.currentGoalChain.steps,
      currentStep: this.currentGoalChain.currentStep
    };
    this.addEvent(goalChain);
    this.currentGoalChain = null;
  }

  _finalizeFailureContext() {
    if (!this.currentFailureContext || !this.currentReport) return;
    const { faction, day, reportId, chainId } = this.currentReport;
    const contextEvent = {
      type: 'faction_ai_goal_failure',
      faction,
      day,
      reportId,
      chainId: this.currentFailureContext.chainId || chainId,
      goal: this.currentFailureContext.goal,
      step: this.currentFailureContext.step,
      reason: this.currentFailureContext.reason,
      resourceBlocks: this.currentFailureContext.resourceBlocks,
      buildingBlocks: this.currentFailureContext.buildingBlocks,
      unitBlocks: this.currentFailureContext.unitBlocks,
      resourceGapBlocks: this.currentFailureContext.resourceGapBlocks,
      locationBlocks: this.currentFailureContext.locationBlocks,
      diagnostics: this.currentFailureContext.diagnostics,
      lineNumber: this.currentFailureContext.lineNumber
    };
    this.addEvent(contextEvent);
    this.currentFailureContext = null;
  }

  _finalizeInfo() {
    if (!this.currentInfo || !this.currentReport) return;
    const { faction, day, reportId, chainId } = this.currentReport;
    let parsedContext = this.currentInfo.context;
    if (parsedContext) {
      try {
        parsedContext = JSON.parse(parsedContext);
      } catch (error) {
        parsedContext = this.currentInfo.context;
      }
    }
    this.addEvent({
      type: 'faction_ai_info',
      faction,
      day,
      reportId,
      chainId,
      message: this.currentInfo.message,
      context: parsedContext,
      lineNumber: this.currentInfo.lineNumber
    });
    this.currentInfo = null;
  }

  _bucketReason(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (lower.includes('no valid') || lower.includes('blocked by location')) return 'location';
    if (lower.includes('need ') || lower.includes('have ')) return 'resource';
    if (lower.includes('chain validation')) return 'chain_validation';
    return 'other';
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = FactionAIReportExtractor;
