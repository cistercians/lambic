/**
 * DailyReportGenerator - Generates condensed JSON daily reports from TelemetryLogger data
 *
 * Uses existing TelemetryLogger infrastructure to create AI-friendly JSON reports
 * that summarize key metrics, events, and issues for each in-game day.
 */

class DailyReportGenerator {
  constructor() {
    this.telemetryLogger = null;
    this.networkTelemetry = null;
  }

  /**
   * Initialize with telemetry logger instance
   * @param {TelemetryLogger} telemetryLogger - The main telemetry logger
   * @param {NetworkTelemetry} networkTelemetry - Network telemetry instance
   */
  initialize(telemetryLogger, networkTelemetry) {
    this.telemetryLogger = telemetryLogger;
    this.networkTelemetry = networkTelemetry;
  }

  /**
   * Generate a daily report for a specific day
   * @param {number} day - The in-game day number
   * @param {number} startTime - Start timestamp for this day's data (optional)
   * @param {number} endTime - End timestamp for this day's data (optional)
   * @returns {object} Condensed JSON daily report
   */
  generateDailyReport(day, startTime = null, endTime = null) {
    if (!this.telemetryLogger) {
      throw new Error('DailyReportGenerator not initialized with telemetry logger');
    }


    const report = {
      day,
      timestamp: new Date().toISOString(),
      period: {
        startTime: startTime || this.getDayStartTime(day),
        endTime: endTime || Date.now()
      },
      summary: {},
      telemetry: {},
      errors: {},
      network: {},
      performance: {},
      issues: []
    };

    try {
      // Get telemetry snapshot
      const telemetrySnapshot = this.telemetryLogger.getMetricsSnapshot();

      // Generate summary statistics
      report.summary = this.generateSummaryStats(telemetrySnapshot);

      // Extract telemetry data
      report.telemetry = {
        counters: telemetrySnapshot.counters,
        histograms: telemetrySnapshot.histograms,
        recentMetrics: telemetrySnapshot.recentMetrics,
        eventsByType: this.summarizeEventsByType(telemetrySnapshot.events),
        systemHealth: telemetrySnapshot.systemHealth,
        errorStats: telemetrySnapshot.errorStats
      };

      // Extract error analysis
      report.errors = this.generateErrorAnalysis(telemetrySnapshot);

      // Extract network statistics
      if (this.networkTelemetry) {
        report.network = this.networkTelemetry.getNetworkStats();
      }

      // Extract performance metrics
      report.performance = this.generatePerformanceAnalysis(telemetrySnapshot);

      // Identify issues and patterns
      report.issues = this.identifyIssues(telemetrySnapshot, report.errors);

      // Add metadata
      report.metadata = {
        generatedAt: Date.now(),
        telemetryVersion: '1.0',
        dataCompleteness: this.assessDataCompleteness(telemetrySnapshot)
      };

    } catch (error) {
      console.error('[DailyReportGenerator] Error generating daily report:', error);
      report.error = {
        message: error.message,
        stack: error.stack
      };
    }

    return report;
  }

  /**
   * Generate summary statistics from telemetry snapshot
   */
  generateSummaryStats(telemetrySnapshot) {
    const summary = {
      totalCounters: Object.keys(telemetrySnapshot.counters).length,
      totalHistograms: Object.keys(telemetrySnapshot.histograms).length,
      totalRecentMetrics: telemetrySnapshot.recentMetrics.length,
      totalEventTypes: Object.keys(telemetrySnapshot.events).length,
      totalEvents: 0
    };

    // Count total events
    for (const [eventType, events] of Object.entries(telemetrySnapshot.events)) {
      summary.totalEvents += events.length;
    }

    // Add derived metrics
    summary.hasErrors = Object.keys(telemetrySnapshot.counters).some(key =>
      key.includes('errors') || key.includes('error'));
    summary.hasPerformanceData = Object.keys(telemetrySnapshot.histograms).some(key =>
      key.includes('performance') || key.includes('timer'));

    // Include system health status
    if (telemetrySnapshot.systemHealth) {
      summary.systemHealth = {
        overall: telemetrySnapshot.systemHealth.overall,
        entityCount: telemetrySnapshot.systemHealth.systems ? Object.keys(telemetrySnapshot.systemHealth.systems).length : 0,
        recentErrors: telemetrySnapshot.systemHealth.recentErrors ? telemetrySnapshot.systemHealth.recentErrors.length : 0,
        recommendations: telemetrySnapshot.systemHealth.recommendations ? telemetrySnapshot.systemHealth.recommendations.length : 0
      };
    }

    return summary;
  }

  /**
   * Summarize events by type for the report
   */
  summarizeEventsByType(events) {
    const summary = {};

    for (const [eventType, eventList] of Object.entries(events)) {
      summary[eventType] = {
        count: eventList.length,
        recent: eventList.slice(-5), // Last 5 events of this type
        timeRange: this.getEventTimeRange(eventList)
      };
    }

    return summary;
  }

  /**
   * Get time range for a list of events
   */
  getEventTimeRange(events) {
    if (events.length === 0) return null;

    const timestamps = events.map(e => e.timestamp).sort();
    return {
      first: new Date(timestamps[0]).toISOString(),
      last: new Date(timestamps[timestamps.length - 1]).toISOString(),
      span: timestamps[timestamps.length - 1] - timestamps[0]
    };
  }

  /**
   * Generate error analysis from telemetry data
   */
  generateErrorAnalysis(telemetrySnapshot) {
    const errorAnalysis = {
      totalErrors: 0,
      byCategory: {},
      byType: {},
      topPatterns: [],
      timeDistribution: {}
    };

    // Extract error counters
    for (const [key, value] of Object.entries(telemetrySnapshot.counters)) {
      if (key.includes('error') || key.includes('Error')) {
        errorAnalysis.totalErrors += value;

        // Categorize by error type
        if (key.includes('.')) {
          const parts = key.split('.');
          const category = parts[parts.length - 1];
          errorAnalysis.byType[category] = (errorAnalysis.byType[category] || 0) + value;
        }
      }
    }

    // Extract error patterns (assuming counters have error patterns)
    const errorPatterns = [];
    for (const [key, value] of Object.entries(telemetrySnapshot.counters)) {
      if (key.includes('patterns') && value > 0) {
        errorPatterns.push({ pattern: key, count: value });
      }
    }

    // Sort and get top patterns
    errorAnalysis.topPatterns = errorPatterns
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return errorAnalysis;
  }

  /**
   * Generate performance analysis from telemetry data
   */
  generatePerformanceAnalysis(telemetrySnapshot) {
    const performance = {
      timers: {},
      histograms: {},
      averages: {}
    };

    // Extract histogram data (include all performance-related histograms)
    for (const [key, value] of Object.entries(telemetrySnapshot.histograms)) {
      // Include histograms that are performance-related (GameLoop, MapContext, etc.)
      if (key.includes('GameLoop') || key.includes('MapContext') || key.includes('Entity') ||
          key.includes('performance') || key.includes('timer') || key.includes('duration')) {
        performance.histograms[key] = value;

        // Calculate averages from percentiles
        if (value.p50 !== undefined) {
          performance.averages[key] = {
            p50: value.p50,
            p95: value.p95,
            p99: value.p99,
            count: value.count
          };
        }
      }
    }

    return performance;
  }

  /**
   * Identify issues and patterns from telemetry data
   */
  identifyIssues(telemetrySnapshot, errorAnalysis) {
    const issues = [];

    // Check for high error rates
    if (errorAnalysis.totalErrors > 50) {
      issues.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `High error rate detected: ${errorAnalysis.totalErrors} errors`,
        metrics: {
          totalErrors: errorAnalysis.totalErrors,
          threshold: 50
        }
      });
    } else if (errorAnalysis.totalErrors > 10) {
      issues.push({
        type: 'elevated_error_rate',
        severity: 'warning',
        message: `Elevated error rate: ${errorAnalysis.totalErrors} errors`,
        metrics: {
          totalErrors: errorAnalysis.totalErrors,
          threshold: 10
        }
      });
    }

    // Check for repeated error patterns
    for (const pattern of errorAnalysis.topPatterns) {
      if (pattern.count > 20) {
        issues.push({
          type: 'repeated_error_pattern',
          severity: 'critical',
          message: `Critical repeated error: ${pattern.pattern}`,
          metrics: {
            pattern: pattern.pattern,
            count: pattern.count,
            threshold: 20
          }
        });
      } else if (pattern.count > 5) {
        issues.push({
          type: 'frequent_error_pattern',
          severity: 'warning',
          message: `Frequent error pattern: ${pattern.pattern}`,
          metrics: {
            pattern: pattern.pattern,
            count: pattern.count,
            threshold: 5
          }
        });
      }
    }

    // Check for performance degradation (simplified)
    const performanceTimers = Object.keys(telemetrySnapshot.histograms)
      .filter(key => key.includes('performance'));

    if (performanceTimers.length === 0) {
      issues.push({
        type: 'missing_performance_data',
        severity: 'warning',
        message: 'No performance metrics collected during this period',
        metrics: {}
      });
    }

    return issues;
  }

  /**
   * Assess data completeness
   */
  assessDataCompleteness(telemetrySnapshot) {
    let score = 0;
    let totalChecks = 4;

    // Check for basic telemetry data
    if (Object.keys(telemetrySnapshot.counters).length > 0) score++;
    if (Object.keys(telemetrySnapshot.histograms).length > 0) score++;
    if (telemetrySnapshot.recentMetrics.length > 0) score++;
    if (Object.keys(telemetrySnapshot.events).length > 0) score++;

    return {
      score: score / totalChecks,
      percentage: Math.round((score / totalChecks) * 100),
      hasCounters: Object.keys(telemetrySnapshot.counters).length > 0,
      hasHistograms: Object.keys(telemetrySnapshot.histograms).length > 0,
      hasMetrics: telemetrySnapshot.recentMetrics.length > 0,
      hasEvents: Object.keys(telemetrySnapshot.events).length > 0
    };
  }

  /**
   * Estimate the start time for a given day
   * This is a simplified estimation - in a real implementation,
   * you'd track actual day boundaries
   */
  getDayStartTime(day) {
    // Simple estimation: assume 8 hours per day, adjust based on day number
    const baseTime = Date.now() - (day * 8 * 60 * 60 * 1000);
    return baseTime;
  }

  /**
   * Generate a final summary report for the current session
   * @param {Array} dailyReports - Array of daily report objects
   * @returns {object} Session summary report
   */
  generateSessionSummary(dailyReports) {
    const summary = {
      reportType: 'session_summary',
      timestamp: new Date().toISOString(),
      sessionDuration: process.uptime(),
      daysAnalyzed: dailyReports.length,
      dailyReports: dailyReports,
      aggregated: this.aggregateReports(dailyReports),
      recommendations: this.generateRecommendations(dailyReports)
    };

    return summary;
  }

  /**
   * Aggregate multiple daily reports
   */
  aggregateReports(dailyReports) {
    const aggregated = {
      totalErrors: 0,
      totalEvents: 0,
      errorCategories: {},
      performanceTrends: {},
      issuesByType: {}
    };

    for (const report of dailyReports) {
      // Aggregate errors
      aggregated.totalErrors += report.errors.totalErrors || 0;

      // Aggregate error categories
      for (const [category, count] of Object.entries(report.errors.byCategory || {})) {
        aggregated.errorCategories[category] = (aggregated.errorCategories[category] || 0) + count;
      }

      // Aggregate events
      aggregated.totalEvents += report.summary.totalEvents || 0;

      // Aggregate issues
      for (const issue of report.issues || []) {
        const type = issue.type;
        if (!aggregated.issuesByType[type]) {
          aggregated.issuesByType[type] = { count: 0, severities: {} };
        }
        aggregated.issuesByType[type].count++;
        aggregated.issuesByType[type].severities[issue.severity] =
          (aggregated.issuesByType[type].severities[issue.severity] || 0) + 1;
      }
    }

    return aggregated;
  }

  /**
   * Generate recommendations based on aggregated data
   */
  generateRecommendations(dailyReports) {
    const recommendations = [];

    const aggregated = this.aggregateReports(dailyReports);

    // High error rate recommendation
    if (aggregated.totalErrors > 100) {
      recommendations.push({
        priority: 'critical',
        category: 'errors',
        title: 'Critical: High Error Rate',
        description: `${aggregated.totalErrors} total errors across ${dailyReports.length} days`,
        action: 'Review error logs and implement fixes for top error patterns',
        evidence: {
          totalErrors: aggregated.totalErrors,
          daysAffected: dailyReports.length
        }
      });
    }

    // Performance recommendations
    const performanceIssues = dailyReports.filter(r =>
      r.issues.some(i => i.type.includes('performance'))).length;

    if (performanceIssues > dailyReports.length / 2) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Performance Issues Detected',
        description: `Performance problems in ${performanceIssues} out of ${dailyReports.length} days`,
        action: 'Review performance metrics and optimize slow operations',
        evidence: {
          daysWithIssues: performanceIssues,
          totalDays: dailyReports.length
        }
      });
    }

    return recommendations;
  }
}

module.exports = DailyReportGenerator;