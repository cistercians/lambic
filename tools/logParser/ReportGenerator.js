const fs = require('fs').promises;
const path = require('path');
const { summarizeCounts } = require('./utils/ReportUtils');

class ReportGenerator {
  constructor({ reportsDir }) {
    this.reportsDir = reportsDir;
  }

  async generate(reportData) {
    const runId = this._buildRunId();
    const runDir = path.join(this.reportsDir, `run_${runId}`);
    await fs.mkdir(runDir, { recursive: true });

    const aiReport = this._buildAiReport(reportData);
    const humanReport = this._buildHumanReport(reportData);

    const reportJsonPath = path.join(runDir, 'report.json');
    const reportTxtPath = path.join(runDir, 'report.txt');
    const metadataPath = path.join(runDir, 'metadata.json');

    await fs.writeFile(reportJsonPath, JSON.stringify(aiReport, null, 2), 'utf8');
    await fs.writeFile(reportTxtPath, humanReport, 'utf8');
    await fs.writeFile(metadataPath, JSON.stringify(aiReport.meta, null, 2), 'utf8');

    return { runDir, reportJsonPath, reportTxtPath, metadataPath };
  }

  _buildAiReport(reportData) {
    const errors = reportData.stats.errors || {};
    const factionAiErrors = reportData.stats.factionAIReport?.errorCount || 0;
    const totalErrors = (errors.totalErrors || 0) + factionAiErrors;
    const totalWarnings = errors.totalWarnings || 0;
    const failureSummaries = this._buildFailureSummaries(reportData);
    const eventSummaries = this._buildEventSummaries(reportData);
    const actionableInsights = this._buildActionableInsights(reportData);
    const visualizationData = this._buildVisualizationData(reportData);
    const troubleshootingGuide = this._buildTroubleshootingGuide(reportData);

    const runSummary = {
      narrative: `Processed ${reportData.meta.totalLines} lines. ` +
        `Errors: ${totalErrors}, warnings: ${totalWarnings}. ` +
        `Total events: ${reportData.stats.eventManager?.totalEvents || 0}.`,
      keyRisks: reportData.anomalies.map((anomaly) => anomaly.summary || anomaly.type),
      openQuestions: actionableInsights.recommendations.map(r => r.question || '')
    };

    return {
      meta: reportData.meta,
      highlights: reportData.highlights,
      stats: reportData.stats,
      anomalies: reportData.anomalies,
      evidence: reportData.evidence,
      summaries: {
        failureSummaries,
        eventSummaries
      },
      actionableInsights,
      visualizationData,
      troubleshootingGuide,
      runSummary
    };
  }

  _buildHumanReport(reportData) {
    const lines = [];
    const { meta, stats, anomalies } = reportData;

    lines.push('LAMBIC LOG REPORT');
    lines.push('==================');
    lines.push(`Processed at: ${meta.processedAt}`);
    lines.push(`Log file: ${meta.logFile}`);
    lines.push(`Total lines: ${meta.totalLines}`);
    if (meta.timeRange.start || meta.timeRange.end) {
      lines.push(`Time range: ${meta.timeRange.start || 'unknown'} -> ${meta.timeRange.end || 'unknown'}`);
    }
    lines.push('');

    lines.push('SUMMARY');
    lines.push('-------');
    const errors = stats.errors || {};
    const factionAiErrors = stats.factionAIReport?.errorCount || 0;
    lines.push(`Errors: ${(errors.totalErrors || 0) + factionAiErrors}`);
    lines.push(`Warnings: ${errors.totalWarnings || 0}`);
    lines.push(`Combat events: ${(stats.combat && stats.combat.totalAttacks) || 0} attacks, ${(stats.combat && stats.combat.totalDeaths) || 0} deaths`);
    lines.push(`Economic deposits: ${(stats.economy && stats.economy.totalDeposits) || 0}`);
    const serfSpawning = stats.eventManager && stats.eventManager.serfSpawning;
    if (serfSpawning) {
      lines.push(`Serf spawning: ${serfSpawning.spawnsSuccessful || 0} successful (${serfSpawning.totalSerfsSpawned || 0} serfs), ${serfSpawning.spawnsFailed || 0} failed, ${serfSpawning.tallyStarts || 0} tallies`);
    }
    lines.push(`Unrecognized lines: ${(stats.unrecognized && stats.unrecognized.totalUnrecognized) || 0}`);
    lines.push('');

    const failureSummaries = this._buildFailureSummaries(reportData);
    if (failureSummaries.goalFailures) {
      lines.push('FAILURE SUMMARY');
      lines.push('---------------');
      const byFaction = failureSummaries.goalFailures.byFaction || [];
      const byGoal = failureSummaries.goalFailures.byGoal || [];
      const byReason = failureSummaries.goalFailures.byReason || [];
      if (byFaction.length) {
        lines.push(`Top factions: ${byFaction.map(item => `${item.key} (${item.value})`).join(', ')}`);
      }
      if (byGoal.length) {
        lines.push(`Top goals: ${byGoal.map(item => `${item.key} (${item.value})`).join(', ')}`);
      }
      if (byReason.length) {
        lines.push(`Top blockers: ${byReason.map(item => `${item.key} (${item.value})`).join(', ')}`);
      }
      if (!byFaction.length && !byGoal.length && !byReason.length) {
        lines.push('No faction AI goal failures detected.');
      }
      lines.push('');
    }

    const eventSummaries = this._buildEventSummaries(reportData);
    if (eventSummaries.eventManager) {
      const byCategory = eventSummaries.eventManager.byCategory || [];
      const byAction = eventSummaries.eventManager.byAction || [];
      lines.push('EVENT SUMMARY');
      lines.push('-------------');
      if (byCategory.length) {
        lines.push(`Top categories: ${byCategory.map(item => `${item.key} (${item.value})`).join(', ')}`);
      }
      if (byAction.length) {
        lines.push(`Top actions: ${byAction.map(item => `${item.key} (${item.value})`).join(', ')}`);
      }
      if (!byCategory.length && !byAction.length) {
        lines.push('No EventManager events detected.');
      }
      lines.push('');

      // Serf spawning summary
      const serfSpawning = eventSummaries.eventManager.serfSpawning;
      if (serfSpawning) {
        lines.push('SERF SPAWNING SUMMARY');
        lines.push('---------------------');
        lines.push(`Tally starts: ${serfSpawning.tallyStarts || 0}`);
        lines.push(`Spawn attempts: ${serfSpawning.spawnAttempts || 0}`);
        lines.push(`Successful spawns: ${serfSpawning.spawnsSuccessful || 0} (${serfSpawning.totalSerfsSpawned || 0} serfs)`);
        lines.push(`Failed spawns: ${serfSpawning.spawnsFailed || 0}`);
        if (serfSpawning.byHouse && Object.keys(serfSpawning.byHouse).length > 0) {
          const topHouses = Object.entries(serfSpawning.byHouse)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([house, count]) => `${house} (${count})`)
            .join(', ');
          lines.push(`Top houses: ${topHouses}`);
        }
        if (serfSpawning.byBuildingType && Object.keys(serfSpawning.byBuildingType).length > 0) {
          const topBuildings = Object.entries(serfSpawning.byBuildingType)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([type, count]) => `${type} (${count})`)
            .join(', ');
          lines.push(`Top building types: ${topBuildings}`);
        }
        if (serfSpawning.failedReasons && Object.keys(serfSpawning.failedReasons).length > 0) {
          const topReasons = Object.entries(serfSpawning.failedReasons)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([reason, count]) => `${reason} (${count})`)
            .join(', ');
          lines.push(`Top failure reasons: ${topReasons}`);
        }
        lines.push('');
      }
    }

    lines.push('DETAILS');
    lines.push('-------');
    lines.push(this._formatSection('Combat', stats.combat));
    lines.push(this._formatSection('Economy', stats.economy));
    lines.push(this._formatSection('Errors', stats.errors));
    lines.push(this._formatSection('Performance', stats.performance));
    lines.push(this._formatSection('Serf', stats.serf));
    lines.push(this._formatSection('Faction AI', stats.factionAI));
    lines.push(this._formatSection('Event Manager', stats.eventManager));
    lines.push(this._formatSection('Unrecognized', stats.unrecognized));

    if (anomalies.length) {
      lines.push('');
      lines.push('ANOMALIES');
      lines.push('---------');
      anomalies.forEach((anomaly, index) => {
        lines.push(`${index + 1}. ${anomaly.summary || anomaly.type} (count: ${anomaly.count || 'n/a'})`);
      });
      lines.push('');
    }

    // Add actionable insights section
    const eventStats = stats.eventManager || {};
    if (eventStats.totalEvents > 0 || anomalies.length > 0) {
      lines.push('ACTIONABLE INSIGHTS');
      lines.push('-------------------');
      
      // Performance bottlenecks
      const spikeAnomalies = anomalies.filter(a => a.type === 'event_spike');
      if (spikeAnomalies.length > 0) {
        lines.push(`Performance: ${spikeAnomalies.length} event rate spike(s) detected`);
        spikeAnomalies.slice(0, 3).forEach(spike => {
          lines.push(`  - ${spike.category || 'Unknown'} category: ${spike.spikeRatio}x increase (lines ${spike.windowStart}-${spike.windowEnd})`);
        });
      }
      
      // System health
      const missingEvents = anomalies.filter(a => a.type && a.type.includes('missing'));
      if (missingEvents.length > 0) {
        lines.push(`System Health: ${missingEvents.length} missing expected event(s)`);
        missingEvents.slice(0, 3).forEach(missing => {
          lines.push(`  - ${missing.summary || missing.type}`);
        });
      }
      
      // Communication mode analysis
      if (eventStats.byCommunicationMode) {
        const totalEvents = eventStats.totalEvents || 0;
        const noneEvents = eventStats.byCommunicationMode.None || eventStats.byCommunicationMode.none || 0;
        if (totalEvents > 0) {
          const visibilityRatio = ((totalEvents - noneEvents) / totalEvents * 100).toFixed(1);
          lines.push(`Visibility: ${visibilityRatio}% of events are visible to players`);
        }
      }
      
      // Hotspots summary
      if (eventStats.hotspots) {
        Object.keys(eventStats.hotspots).forEach(category => {
          const hotspots = eventStats.hotspots[category] || [];
          if (hotspots.length > 0) {
            const topHotspot = hotspots.sort((a, b) => b.count - a.count)[0];
            lines.push(`${category} hotspots: ${hotspots.length} active regions, top region at [${topHotspot.x}, ${topHotspot.y}] (${topHotspot.count} events)`);
          }
        });
      }
      
      lines.push('');
    }

    return lines.join('\n');
  }

  _formatSection(title, data) {
    if (!data) return `${title}: no data`;
    return `${title}:\n${JSON.stringify(data, null, 2)}`;
  }

  _buildFailureSummaries(reportData) {
    const aiStats = reportData.stats.factionAIReport || {};
    const byFaction = summarizeCounts(aiStats.errorsByFaction, 5);
    const byGoal = summarizeCounts(aiStats.errorsByGoal, 5);
    const byReason = summarizeCounts(aiStats.blockersByReason, 5);
    return {
      goalFailures: {
        byFaction,
        byGoal,
        byReason
      }
    };
  }

  _buildEventSummaries(reportData) {
    const eventStats = reportData.stats.eventManager || {};
    const byCategory = summarizeCounts(eventStats.byCategory, 5);
    const byAction = summarizeCounts(eventStats.byAction, 5);
    const serfSpawning = eventStats.serfSpawning || {};
    return {
      eventManager: {
        byCategory,
        byAction,
        serfSpawning: {
          tallyStarts: serfSpawning.tallyStarts || 0,
          spawnAttempts: serfSpawning.spawnAttempts || 0,
          spawnsSuccessful: serfSpawning.spawnsSuccessful || 0,
          spawnsFailed: serfSpawning.spawnsFailed || 0,
          totalSerfsSpawned: serfSpawning.totalSerfsSpawned || 0,
          byHouse: serfSpawning.byHouse || {},
          byBuildingType: serfSpawning.byBuildingType || {},
          failedReasons: serfSpawning.failedReasons || {}
        }
      }
    };
  }

  _buildActionableInsights(reportData) {
    const insights = {
      performanceBottlenecks: [],
      systemHealth: [],
      gameplayPatterns: [],
      recommendations: []
    };
    
    const eventStats = reportData.stats.eventManager || {};
    const anomalies = reportData.anomalies || [];
    
    // Performance bottlenecks - event volume spikes
    const spikeAnomalies = anomalies.filter(a => a.type === 'event_spike');
    if (spikeAnomalies.length > 0) {
      insights.performanceBottlenecks.push({
        type: 'event_spike',
        summary: 'Event rate spikes detected',
        severity: 'high',
        count: spikeAnomalies.length,
        details: spikeAnomalies.map(a => ({
          ratio: a.spikeRatio,
          category: a.category,
          window: `${a.windowStart}-${a.windowEnd}`
        }))
      });
      
      insights.recommendations.push({
        type: 'performance',
        priority: 'high',
        action: 'Investigate event generation code during spike windows',
        question: 'What triggered the event rate spike?',
        details: 'Event volume increased significantly during specific log ranges'
      });
    }
    
    // System health - missing events
    const missingEvents = anomalies.filter(a => 
      a.type.startsWith('missing_') || a.type.includes('missing')
    );
    if (missingEvents.length > 0) {
      insights.systemHealth.push({
        type: 'missing_events',
        summary: 'Expected events not occurring',
        severity: 'medium',
        count: missingEvents.length,
        details: missingEvents.map(a => ({
          type: a.type,
          summary: a.summary
        }))
      });
      
      insights.recommendations.push({
        type: 'system',
        priority: 'medium',
        action: 'Check event scheduling and timing logic',
        question: 'Why are expected events not occurring?',
        details: 'Regular events (hour changes, daily recaps) are missing'
      });
    }
    
    // Gameplay patterns - category dominance
    const dominanceAnomalies = anomalies.filter(a => 
      a.type === 'category_dominance' || a.type.includes('dominance')
    );
    if (dominanceAnomalies.length > 0) {
      dominanceAnomalies.forEach(anomaly => {
        insights.gameplayPatterns.push({
          type: 'category_dominance',
          category: anomaly.category,
          ratio: anomaly.ratio,
          summary: `${anomaly.category} events dominate activity`
        });
        
        insights.recommendations.push({
          type: 'gameplay',
          priority: 'low',
          action: `Monitor ${anomaly.category} event patterns for balance`,
          question: `Is ${anomaly.category} activity unusually high?`,
          details: `${anomaly.category} represents ${(anomaly.ratio * 100).toFixed(1)}% of events`
        });
      });
    }
    
    // High failure rates
    const failureAnomalies = anomalies.filter(a => 
      a.type.includes('failure') || a.type.includes('failure_rate')
    );
    if (failureAnomalies.length > 0) {
      failureAnomalies.forEach(anomaly => {
        insights.systemHealth.push({
          type: 'high_failure_rate',
          summary: anomaly.summary,
          severity: 'medium',
          failureRate: anomaly.failureRate
        });
        
        insights.recommendations.push({
          type: 'system',
          priority: 'medium',
          action: 'Review failure reasons and improve success conditions',
          question: `Why is ${anomaly.type} failing at ${(anomaly.failureRate * 100).toFixed(1)}%?`,
          details: anomaly.summary
        });
      });
    }
    
    // Combat dominance patterns
    const combatAnomalies = anomalies.filter(a => 
      a.type === 'killer_dominance' || a.type === 'combat_dominance'
    );
    if (combatAnomalies.length > 0) {
      combatAnomalies.forEach(anomaly => {
        insights.gameplayPatterns.push({
          type: 'combat_imbalance',
          entity: anomaly.killer || anomaly.actor,
          ratio: anomaly.ratio,
          summary: anomaly.summary
        });
      });
    }
    
    // Communication mode analysis
    if (eventStats.byCommunicationMode) {
      const commModeStats = eventStats.byCommunicationMode;
      const totalEvents = eventStats.totalEvents || 0;
      const noneEvents = commModeStats.None || commModeStats.none || 0;
      
      if (totalEvents > 0 && noneEvents / totalEvents > 0.8) {
        insights.gameplayPatterns.push({
          type: 'visibility_concern',
          summary: 'Most events are system-only (not visible to players)',
          ratio: (noneEvents / totalEvents).toFixed(2),
          details: `${noneEvents}/${totalEvents} events have NONE communication mode`
        });
        
        insights.recommendations.push({
          type: 'gameplay',
          priority: 'low',
          action: 'Review event communication modes for player visibility',
          question: 'Should more events be visible to players?',
          details: 'Consider increasing player-facing events for better engagement'
        });
      }
    }
    
    return insights;
  }

  _buildVisualizationData(reportData) {
    const eventStats = reportData.stats.eventManager || {};
    const events = reportData.evidence?.events || [];
    
    // Build timeline of events
    const timeline = events
      .filter(e => e.type === 'event_manager' && e.timestamp)
      .map(e => ({
        timestamp: e.timestamp,
        category: e.category,
        action: e.action,
        lineNumber: e.lineNumber
      }))
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    // Build heatmap data for position-based events
    const heatmaps = {};
    if (eventStats.hotspots) {
      Object.keys(eventStats.hotspots).forEach(category => {
        const hotspots = eventStats.hotspots[category] || [];
        heatmaps[category] = hotspots
          .sort((a, b) => b.count - a.count)
          .slice(0, 50) // Top 50 hotspots
          .map(h => ({
            x: h.x,
            y: h.y,
            z: h.z || 0,
            count: h.count,
            key: h.key
          }));
      });
    }
    
    // Build trend data (events by day/hour)
    const trends = {
      byDay: eventStats.byDay || {},
      byHour: eventStats.byHour || {},
      byCategory: {}
    };
    
    // Group events by category over time
    if (events.length > 0) {
      const categoryTimeline = {};
      events.forEach(e => {
        if (e.category && e.timestamp) {
          if (!categoryTimeline[e.category]) {
            categoryTimeline[e.category] = [];
          }
          categoryTimeline[e.category].push({
            timestamp: e.timestamp,
            action: e.action
          });
        }
      });
      trends.byCategory = categoryTimeline;
    }
    
    // Build entity relationship graph data
    const relationships = {
      kills: eventStats.entityRelationships?.kills || {},
      attacks: eventStats.entityRelationships?.attacks || {},
      interactions: eventStats.entityRelationships?.interactions || {}
    };
    
    return {
      timeline,
      heatmaps,
      trends,
      relationships
    };
  }

  _buildTroubleshootingGuide(reportData) {
    const guide = {
      anomalies: [],
      commonIssues: []
    };
    
    const anomalies = reportData.anomalies || [];
    
    // Map each anomaly type to troubleshooting guidance
    anomalies.forEach(anomaly => {
      const entry = {
        type: anomaly.type,
        summary: anomaly.summary,
        potentialCauses: [],
        suggestedActions: []
      };
      
      switch (anomaly.type) {
        case 'event_spike':
          entry.potentialCauses = [
            'Sudden increase in player activity',
            'Spawn wave triggered',
            'Combat escalation',
            'Event generation loop'
          ];
          entry.suggestedActions = [
            'Check log lines around spike window',
            'Review event generation code',
            'Monitor system resources during spike',
            'Look for cascading event triggers'
          ];
          break;
          
        case 'missing_hour_changes':
        case 'missing_daily_recaps':
          entry.potentialCauses = [
            'Clock/timing system issue',
            'Event scheduler not running',
            'Conditional logic preventing event',
            'Log truncation'
          ];
          entry.suggestedActions = [
            'Verify timing system is functioning',
            'Check event scheduler status',
            'Review conditional logic for event generation',
            'Confirm log file is complete'
          ];
          break;
          
        case 'killer_dominance':
        case 'combat_dominance':
          entry.potentialCauses = [
            'Powerful entity spawned',
            'Combat balance issue',
            'AI behavior anomaly',
            'Exploit or bug'
          ];
          entry.suggestedActions = [
            'Review entity stats and abilities',
            'Check combat balance parameters',
            'Investigate AI decision making',
            'Look for exploit patterns'
          ];
          break;
          
        case 'high_failure_rate':
          entry.potentialCauses = [
            'Resource constraints',
            'Invalid conditions',
            'System state issues',
            'Configuration problems'
          ];
          entry.suggestedActions = [
            'Review failure reasons in metadata',
            'Check resource availability',
            'Validate system state',
            'Review configuration settings'
          ];
          break;
          
        case 'category_dominance':
          entry.potentialCauses = [
            'Normal gameplay pattern',
            'System stress on specific category',
            'Player behavior pattern',
            'Bug causing excessive events'
          ];
          entry.suggestedActions = [
            'Compare with expected patterns',
            'Check for event generation loops',
            'Review player activity',
            'Monitor for system issues'
          ];
          break;
          
        default:
          entry.potentialCauses = ['Unknown cause - requires investigation'];
          entry.suggestedActions = ['Review anomaly details', 'Check related event logs'];
      }
      
      guide.anomalies.push(entry);
    });
    
    // Common issues based on stats
    const eventStats = reportData.stats.eventManager || {};
    
    // High event volume
    if (eventStats.totalEvents > 100000) {
      guide.commonIssues.push({
        issue: 'Very high event volume',
        severity: 'medium',
        action: 'Consider event filtering or aggregation',
        details: `${eventStats.totalEvents} events detected - may impact performance`
      });
    }
    
    // Low event diversity
    const categoryCount = Object.keys(eventStats.byCategory || {}).length;
    if (eventStats.totalEvents > 1000 && categoryCount < 5) {
      guide.commonIssues.push({
        issue: 'Low event category diversity',
        severity: 'low',
        action: 'Check if all event types are being used',
        details: `Only ${categoryCount} categories out of 11 possible`
      });
    }
    
    // High anomaly count
    if (anomalies.length > 10) {
      guide.commonIssues.push({
        issue: 'High number of anomalies',
        severity: 'high',
        action: 'Review system health and stability',
        details: `${anomalies.length} anomalies detected - system may be unstable`
      });
    }
    
    return guide;
  }

  _buildRunId() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}

module.exports = ReportGenerator;
