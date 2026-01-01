/**
 * ReportAggregator - Combines daily reports into master JSON report with recommendations
 *
 * Aggregates all daily reports and generates AI-friendly JSON output with
 * trends, insights, and actionable recommendations.
 */

class ReportAggregator {
  constructor() {
    this.dailyReportStore = null;
    this.dailyReportGenerator = null;
  }

  /**
   * Initialize with required dependencies
   * @param {DailyReportStore} dailyReportStore - Store of daily reports
   * @param {DailyReportGenerator} dailyReportGenerator - Report generator
   */
  initialize(dailyReportStore, dailyReportGenerator) {
    this.dailyReportStore = dailyReportStore;
    this.dailyReportGenerator = dailyReportGenerator;
  }

  /**
   * Generate a final aggregated report from all daily reports
   * @param {object} currentDayData - Current day telemetry data (optional)
   * @returns {object} Master JSON report
   */
  generateFinalReport(currentDayData = null) {
    if (!this.dailyReportStore) {
      throw new Error('ReportAggregator not initialized with daily report store');
    }

    const allReports = this.dailyReportStore.getAll();
    const reportDays = Array.from(allReports.keys()).sort((a, b) => a - b);

    const report = {
      reportType: 'final_aggregated',
      timestamp: new Date().toISOString(),
      sessionInfo: this.generateSessionInfo(),
      summary: this.generateOverallSummary(allReports, currentDayData),
      dailyReports: this.prepareDailyReports(allReports),
      aggregated: this.aggregateAllData(allReports, currentDayData),
      trends: this.analyzeTrends(allReports),
      recommendations: this.generateRecommendations(allReports, currentDayData),
      systemInfo: this.generateSystemInfo(),
      metadata: {
        generatedAt: Date.now(),
        totalDays: reportDays.length,
        dateRange: reportDays.length > 0 ? {
          first: reportDays[0],
          last: reportDays[reportDays.length - 1]
        } : null,
        dataCompleteness: this.assessOverallCompleteness(allReports)
      }
    };

    return report;
  }

  /**
   * Generate session information
   */
  generateSessionInfo() {
    return {
      serverUptime: process.uptime(),
      serverUptimeFormatted: this.formatDuration(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      memoryUsage: process.memoryUsage(),
      pid: process.pid
    };
  }

  /**
   * Generate overall summary across all days
   */
  generateOverallSummary(allReports, currentDayData) {
    const summary = {
      totalDays: allReports.size,
      totalErrors: 0,
      totalEvents: 0,
      totalIssues: 0,
      criticalIssues: 0,
      warningIssues: 0,
      infoIssues: 0,
      averageErrorsPerDay: 0,
      averageEventsPerDay: 0,
      dataCompleteness: 0
    };

    let totalCompleteness = 0;
    let daysWithData = 0;

    for (const [day, report] of allReports.entries()) {
      summary.totalErrors += report.errors?.totalErrors || 0;
      summary.totalEvents += report.summary?.totalEvents || 0;
      summary.totalIssues += report.issues?.length || 0;

      // Count issues by severity
      if (report.issues) {
        for (const issue of report.issues) {
          switch (issue.severity) {
            case 'critical': summary.criticalIssues++; break;
            case 'warning': summary.warningIssues++; break;
            case 'info': summary.infoIssues++; break;
          }
        }
      }

      // Track data completeness
      if (report.metadata?.dataCompleteness?.percentage !== undefined) {
        totalCompleteness += report.metadata.dataCompleteness.percentage;
        daysWithData++;
      }
    }

    // Calculate averages
    if (allReports.size > 0) {
      summary.averageErrorsPerDay = Math.round(summary.totalErrors / allReports.size);
      summary.averageEventsPerDay = Math.round(summary.totalEvents / allReports.size);
    }

    // Calculate overall data completeness
    if (daysWithData > 0) {
      summary.dataCompleteness = Math.round(totalCompleteness / daysWithData);
    }

    return summary;
  }

  /**
   * Prepare daily reports for inclusion in final report
   */
  prepareDailyReports(allReports) {
    const dailyReports = [];

    for (const [day, report] of allReports.entries()) {
      // Include condensed version of each daily report
      dailyReports.push({
        day: report.day,
        timestamp: report.timestamp,
        summary: report.summary,
        errors: {
          totalErrors: report.errors?.totalErrors || 0,
          byCategory: report.errors?.byCategory || {},
          topPatterns: report.errors?.topPatterns?.slice(0, 3) || [] // Top 3 patterns
        },
        performance: report.performance,
        issues: report.issues || [],
        dataCompleteness: report.metadata?.dataCompleteness?.percentage || 0
      });
    }

    return dailyReports.sort((a, b) => a.day - b.day);
  }

  /**
   * Aggregate all data across days
   */
  aggregateAllData(allReports, currentDayData) {
    const aggregated = {
      errors: this.aggregateErrors(allReports),
      events: this.aggregateEvents(allReports),
      performance: this.aggregatePerformance(allReports),
      issues: this.aggregateIssues(allReports),
      network: this.aggregateNetwork(allReports),
      systemHealth: this.aggregateSystemHealth(allReports, currentDayData)
    };

    return aggregated;
  }

  /**
   * Aggregate system health data across all days
   */
  aggregateSystemHealth(allReports, currentDayData) {
    const healthAgg = {
      overallHealthTrend: [],
      entityCountTrends: {},
      errorTrends: [],
      recommendations: [],
      criticalPeriods: []
    };

    // Aggregate health snapshots from each day
    for (const [day, report] of allReports.entries()) {
      if (report.telemetry?.systemHealth) {
        const health = report.telemetry.systemHealth;
        healthAgg.overallHealthTrend.push({
          day,
          health: health.overall,
          entityCount: health.systems ? Object.keys(health.systems).length : 0,
          errorCount: health.recentErrors ? health.recentErrors.length : 0
        });

        // Collect recommendations
        if (health.recommendations) {
          health.recommendations.forEach(rec => {
            healthAgg.recommendations.push({
              day,
              ...rec
            });
          });
        }
      }
    }

    // Include current day data if available
    if (currentDayData?.telemetry?.systemHealth) {
      const health = currentDayData.telemetry.systemHealth;
      healthAgg.overallHealthTrend.push({
        day: 'current',
        health: health.overall,
        entityCount: health.systems ? Object.keys(health.systems).length : 0,
        errorCount: health.recentErrors ? health.recentErrors.length : 0
      });

      if (health.recommendations) {
        health.recommendations.forEach(rec => {
          healthAgg.recommendations.push({
            day: 'current',
            ...rec
          });
        });
      }
    }

    // Identify critical periods (when health was not 'healthy')
    healthAgg.criticalPeriods = healthAgg.overallHealthTrend.filter(h =>
      h.health !== 'healthy'
    );

    return healthAgg;
  }

  /**
   * Aggregate error data across all days
   */
  aggregateErrors(allReports) {
    const errorAgg = {
      totalErrors: 0,
      byCategory: {},
      byType: {},
      topPatterns: [],
      dailyDistribution: {},
      errorSequences: []
    };

    const patternCounts = new Map();

    for (const [day, report] of allReports.entries()) {
      const dayErrors = report.errors?.totalErrors || 0;
      errorAgg.totalErrors += dayErrors;
      errorAgg.dailyDistribution[day] = dayErrors;

      // Aggregate by category
      if (report.errors?.byCategory) {
        for (const [category, count] of Object.entries(report.errors.byCategory)) {
          errorAgg.byCategory[category] = (errorAgg.byCategory[category] || 0) + count;
        }
      }

      // Aggregate by type
      if (report.errors?.byType) {
        for (const [type, count] of Object.entries(report.errors.byType)) {
          errorAgg.byType[type] = (errorAgg.byType[type] || 0) + count;
        }
      }

      // Collect top patterns
      if (report.errors?.topPatterns) {
        for (const pattern of report.errors.topPatterns) {
          const key = pattern.pattern;
          patternCounts.set(key, (patternCounts.get(key) || 0) + pattern.count);
        }
      }
    }

    // Convert pattern counts to sorted array
    errorAgg.topPatterns = Array.from(patternCounts.entries())
      .map(([pattern, count]) => ({ pattern, totalCount: count }))
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 10); // Top 10 patterns

    return errorAgg;
  }

  /**
   * Aggregate event data across all days
   */
  aggregateEvents(allReports) {
    const eventAgg = {
      totalEvents: 0,
      byType: {},
      dailyDistribution: {},
      topEventTypes: []
    };

    const eventTypeCounts = new Map();

    for (const [day, report] of allReports.entries()) {
      const dayEvents = report.summary?.totalEvents || 0;
      eventAgg.totalEvents += dayEvents;
      eventAgg.dailyDistribution[day] = dayEvents;

      // Aggregate by type
      if (report.telemetry?.eventsByType) {
        for (const [type, typeData] of Object.entries(report.telemetry.eventsByType)) {
          eventAgg.byType[type] = (eventAgg.byType[type] || 0) + (typeData.count || 0);
          eventTypeCounts.set(type, (eventTypeCounts.get(type) || 0) + (typeData.count || 0));
        }
      }
    }

    // Get top event types
    eventAgg.topEventTypes = Array.from(eventTypeCounts.entries())
      .map(([type, count]) => ({ type, totalCount: count }))
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 10);

    return eventAgg;
  }

  /**
   * Aggregate performance data across all days
   */
  aggregatePerformance(allReports) {
    const perfAgg = {
      timers: {},
      histograms: {},
      trends: {},
      averages: {}
    };

    // Simple aggregation - take averages across days
    const timerData = {};
    const histogramData = {};

    for (const [day, report] of allReports.entries()) {
      // Aggregate timer data
      if (report.performance?.averages) {
        for (const [timerName, data] of Object.entries(report.performance.averages)) {
          if (!timerData[timerName]) {
            timerData[timerName] = [];
          }
          timerData[timerName].push({ day, ...data });
        }
      }
    }

    // Calculate trends for key timers
    for (const [timerName, dayData] of Object.entries(timerData)) {
      if (dayData.length > 1) {
        perfAgg.trends[timerName] = this.calculateTrend(dayData.map(d => ({ day: d.day, value: d.p50 })));
      }
      perfAgg.averages[timerName] = this.calculateAverage(dayData.map(d => d.p50));
    }

    return perfAgg;
  }

  /**
   * Aggregate issues across all days
   */
  aggregateIssues(allReports) {
    const issueAgg = {
      totalIssues: 0,
      byType: {},
      bySeverity: {},
      dailyDistribution: {},
      mostCommon: []
    };

    const issueTypeCounts = new Map();
    const issueSeverityCounts = new Map();

    for (const [day, report] of allReports.entries()) {
      const dayIssues = report.issues?.length || 0;
      issueAgg.totalIssues += dayIssues;
      issueAgg.dailyDistribution[day] = dayIssues;

      if (report.issues) {
        for (const issue of report.issues) {
          // Count by type
          issueTypeCounts.set(issue.type, (issueTypeCounts.get(issue.type) || 0) + 1);

          // Count by severity
          issueSeverityCounts.set(issue.severity, (issueSeverityCounts.get(issue.severity) || 0) + 1);
        }
      }
    }

    issueAgg.byType = Object.fromEntries(issueTypeCounts);
    issueAgg.bySeverity = Object.fromEntries(issueSeverityCounts);

    // Get most common issues
    issueAgg.mostCommon = Array.from(issueTypeCounts.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return issueAgg;
  }

  /**
   * Aggregate network data across all days
   */
  aggregateNetwork(allReports) {
    const networkAgg = {
      totalConnections: 0,
      totalMessages: 0,
      averageBandwidth: 0,
      errorRates: {},
      dailyStats: {}
    };

    let totalBandwidth = 0;
    let daysWithNetworkData = 0;

    for (const [day, report] of allReports.entries()) {
      if (report.network) {
        const net = report.network;
        networkAgg.totalConnections += net.connections?.active || 0;
        networkAgg.totalMessages += (net.bandwidth?.messagesSent || 0) + (net.bandwidth?.messagesReceived || 0);
        totalBandwidth += net.bandwidth?.bytesPerSecond || 0;
        daysWithNetworkData++;

        networkAgg.dailyStats[day] = {
          connections: net.connections?.active || 0,
          messages: (net.bandwidth?.messagesSent || 0) + (net.bandwidth?.messagesReceived || 0),
          bandwidth: net.bandwidth?.bytesPerSecond || 0
        };
      }
    }

    if (daysWithNetworkData > 0) {
      networkAgg.averageBandwidth = totalBandwidth / daysWithNetworkData;
    }

    return networkAgg;
  }

  /**
   * Analyze trends across days
   */
  analyzeTrends(allReports) {
    const trends = {
      errorTrend: this.calculateTrend(Array.from(allReports.entries()).map(([day, report]) =>
        ({ day, value: report.errors?.totalErrors || 0 }))),
      eventTrend: this.calculateTrend(Array.from(allReports.entries()).map(([day, report]) =>
        ({ day, value: report.summary?.totalEvents || 0 }))),
      performanceTrend: 'stable' // Would need more sophisticated analysis
    };

    return trends;
  }

  /**
   * Generate actionable recommendations based on aggregated data
   */
  generateRecommendations(allReports, currentDayData) {
    const recommendations = [];
    const aggregated = this.aggregateAllData(allReports, currentDayData);
    const trends = this.analyzeTrends(allReports);

    // High error rate recommendation
    if (aggregated.errors.totalErrors > 100) {
      recommendations.push({
        priority: 'critical',
        category: 'errors',
        title: 'Critical Error Rate',
        description: `${aggregated.errors.totalErrors} total errors across ${allReports.size} days (${Math.round(aggregated.errors.totalErrors / allReports.size)} per day)`,
        evidence: {
          totalErrors: aggregated.errors.totalErrors,
          daysAnalyzed: allReports.size,
          errorsPerDay: Math.round(aggregated.errors.totalErrors / allReports.size),
          topErrorPatterns: aggregated.errors.topPatterns.slice(0, 3)
        },
        action: 'Review and fix top error patterns. Consider implementing additional error handling and validation.',
        impact: 'Reduces system instability and improves user experience'
      });
    }

    // Performance degradation
    if (trends.errorTrend === 'increasing') {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Increasing Error Trend',
        description: 'Error rates are trending upward over time',
        evidence: {
          trend: trends.errorTrend,
          recentDays: Array.from(allReports.entries()).slice(-3).map(([day, report]) =>
            ({ day, errors: report.errors?.totalErrors || 0 }))
        },
        action: 'Investigate recent changes that may have introduced new error conditions',
        impact: 'Prevents further degradation and identifies root causes'
      });
    }

    // Network issues
    if (aggregated.network.errorRates && Object.keys(aggregated.network.errorRates).length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'network',
        title: 'Network Connectivity Issues',
        description: 'Network errors detected during monitoring period',
        evidence: aggregated.network.errorRates,
        action: 'Review network configuration and implement connection retry logic',
        impact: 'Improves connection stability and user experience'
      });
    }

    // Data completeness issues
    const avgCompleteness = Array.from(allReports.values())
      .reduce((sum, report) => sum + (report.metadata?.dataCompleteness?.percentage || 0), 0) / allReports.size;

    if (avgCompleteness < 70) {
      recommendations.push({
        priority: 'medium',
        category: 'monitoring',
        title: 'Incomplete Monitoring Data',
        description: `Average data completeness: ${Math.round(avgCompleteness)}%`,
        evidence: {
          averageCompleteness: Math.round(avgCompleteness),
          daysAnalyzed: allReports.size
        },
        action: 'Review telemetry configuration and ensure all monitoring systems are properly initialized',
        impact: 'Provides more comprehensive insights for debugging and optimization'
      });
    }

    // System health issues
    if (aggregated.systemHealth) {
      const criticalPeriods = aggregated.systemHealth.criticalPeriods || [];
      if (criticalPeriods.length > 0) {
        recommendations.push({
          priority: 'high',
          category: 'system_health',
          title: 'System Health Degradation',
          description: `${criticalPeriods.length} periods of poor system health detected`,
          evidence: {
            criticalPeriods: criticalPeriods,
            healthTrend: aggregated.systemHealth.overallHealthTrend,
            recommendations: aggregated.systemHealth.recommendations
          },
          action: 'Review system health trends and implement the suggested recommendations',
          impact: 'Improves overall system stability and performance'
        });
      }

      // High entity counts
      const entityTrends = aggregated.systemHealth.entityCountTrends || {};
      const maxEntities = Math.max(...Object.values(entityTrends).flat());
      if (maxEntities > 1000) {
        recommendations.push({
          priority: 'medium',
          category: 'performance',
          title: 'High Entity Load',
          description: `Peak entity count reached ${maxEntities} entities`,
          evidence: {
            maxEntities,
            entityTrends
          },
          action: 'Consider implementing entity culling, pagination, or server scaling',
          impact: 'Reduces server load and improves performance'
        });
      }
    }

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  /**
   * Generate system information for the report
   */
  generateSystemInfo() {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      architecture: process.arch,
      uptime: process.uptime(),
      memoryUsage: {
        rss: process.memoryUsage().rss,
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      cpuUsage: process.cpuUsage(),
      loadAverage: require('os')?.loadavg?.() || 'N/A'
    };
  }

  /**
   * Assess overall data completeness
   */
  assessOverallCompleteness(allReports) {
    if (allReports.size === 0) return 0;

    let totalCompleteness = 0;
    let validReports = 0;

    for (const report of allReports.values()) {
      if (report.metadata?.dataCompleteness?.percentage !== undefined) {
        totalCompleteness += report.metadata.dataCompleteness.percentage;
        validReports++;
      }
    }

    return validReports > 0 ? Math.round(totalCompleteness / validReports) : 0;
  }

  /**
   * Calculate trend from time series data
   * @param {Array} dataPoints - Array of {day, value} objects
   * @returns {string} Trend description
   */
  calculateTrend(dataPoints) {
    if (dataPoints.length < 2) return 'insufficient_data';

    // Simple linear regression to determine trend
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point, index) => sum + index, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
    const sumXY = dataPoints.reduce((sum, point, index) => sum + (index * point.value), 0);
    const sumXX = dataPoints.reduce((sum, point, index) => sum + (index * index), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    if (slope > 1) return 'increasing';
    if (slope < -1) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate average of array
   */
  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Format duration in seconds to human readable string
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0) parts.push(`${secs}s`);

    return parts.join(' ') || '0s';
  }

  /**
   * Generate human-readable console output from final report
   * @param {object} finalReport - The final aggregated report
   * @returns {string} Formatted console output
   */
  generateConsoleOutput(finalReport) {
    const lines = [];

    lines.push('='.repeat(80));
    lines.push('🎯 LAMBIC SESSION REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    // Session info
    lines.push('📊 SESSION SUMMARY');
    lines.push(`   Duration: ${finalReport.sessionInfo.serverUptimeFormatted}`);
    lines.push(`   Days Analyzed: ${finalReport.summary.totalDays}`);
    lines.push(`   Node.js: ${finalReport.sessionInfo.nodeVersion}`);
    lines.push('');

    // Overall statistics
    lines.push('📈 OVERALL STATISTICS');
    lines.push(`   Total Errors: ${finalReport.summary.totalErrors}`);
    lines.push(`   Total Events: ${finalReport.summary.totalEvents}`);
    lines.push(`   Total Issues: ${finalReport.summary.totalIssues}`);
    lines.push(`   Avg Errors/Day: ${finalReport.summary.averageErrorsPerDay}`);
    lines.push(`   Avg Events/Day: ${finalReport.summary.averageEventsPerDay}`);
    lines.push(`   Data Completeness: ${finalReport.summary.dataCompleteness}%`);
    lines.push('');

    // Issues breakdown
    if (finalReport.summary.criticalIssues > 0 || finalReport.summary.warningIssues > 0) {
      lines.push('🚨 ISSUES DETECTED');
      if (finalReport.summary.criticalIssues > 0) {
        lines.push(`   🔴 Critical: ${finalReport.summary.criticalIssues}`);
      }
      if (finalReport.summary.warningIssues > 0) {
        lines.push(`   🟡 Warnings: ${finalReport.summary.warningIssues}`);
      }
      if (finalReport.summary.infoIssues > 0) {
        lines.push(`   ℹ️  Info: ${finalReport.summary.infoIssues}`);
      }
      lines.push('');
    }

    // Top error patterns
    if (finalReport.aggregated.errors.topPatterns.length > 0) {
      lines.push('🐛 TOP ERROR PATTERNS');
      finalReport.aggregated.errors.topPatterns.slice(0, 5).forEach((pattern, index) => {
        lines.push(`   ${index + 1}. ${pattern.pattern.substring(0, 60)} (${pattern.totalCount} occurrences)`);
      });
      lines.push('');
    }

    // Recommendations
    if (finalReport.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS');
      finalReport.recommendations.forEach((rec, index) => {
        const priority = rec.priority.toUpperCase();
        lines.push(`   ${index + 1}. [${priority}] ${rec.title}`);
        lines.push(`      ${rec.description}`);
        lines.push(`      → ${rec.action}`);
        lines.push('');
      });
    }

    // Trends
    lines.push('📉 KEY TRENDS');
    lines.push(`   Error Trend: ${finalReport.trends.errorTrend}`);
    lines.push(`   Event Trend: ${finalReport.trends.eventTrend}`);
    lines.push('');

    lines.push('='.repeat(80));

    return lines.join('\n');
  }
}

module.exports = ReportAggregator;