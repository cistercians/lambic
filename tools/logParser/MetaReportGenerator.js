const fs = require('fs').promises;
const path = require('path');

class MetaReportGenerator {
  constructor({ reportsDir }) {
    this.reportsDir = reportsDir;
  }

  async generate({ from, to } = {}) {
    const reports = await this._loadReports();
    const filtered = this._filterByDate(reports, from, to);
    const trends = this._buildTrends(filtered);
    const metaReport = {
      generatedAt: new Date().toISOString(),
      reportCount: filtered.length,
      dateRange: { from: from || null, to: to || null },
      trends,
      runs: filtered.map((report) => ({
        processedAt: report.meta.processedAt,
        logFile: report.meta.logFile,
        totalLines: report.meta.totalLines,
        metrics: this._extractMetrics(report)
      }))
    };

    const fileName = `meta_report_${this._buildDateId()}.json`;
    const outputPath = path.join(this.reportsDir, fileName);
    await fs.writeFile(outputPath, JSON.stringify(metaReport, null, 2), 'utf8');
    return { outputPath, metaReport };
  }

  async _loadReports() {
    const entries = await fs.readdir(this.reportsDir, { withFileTypes: true });
    const runDirs = entries.filter((entry) => entry.isDirectory() && entry.name.startsWith('run_'));
    const reports = [];

    for (const dir of runDirs) {
      const reportPath = path.join(this.reportsDir, dir.name, 'report.json');
      try {
        const raw = await fs.readFile(reportPath, 'utf8');
        reports.push(JSON.parse(raw));
      } catch (error) {
        // Skip invalid or missing report files.
      }
    }

    return reports.sort((a, b) => new Date(a.meta.processedAt) - new Date(b.meta.processedAt));
  }

  _filterByDate(reports, from, to) {
    if (!from && !to) return reports;
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;

    return reports.filter((report) => {
      const date = new Date(report.meta.processedAt);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }

  _buildTrends(reports) {
    if (!reports.length) {
      return { summary: 'No reports available for trend analysis.' };
    }

    const metrics = reports.map((report) => this._extractMetrics(report));
    const first = metrics[0];
    const last = metrics[metrics.length - 1];

    const trends = {
      errorRateDelta: this._delta(first.errorRate, last.errorRate),
      warningRateDelta: this._delta(first.warningRate, last.warningRate),
      combatRateDelta: this._delta(first.combatRate, last.combatRate),
      economyRateDelta: this._delta(first.economyRate, last.economyRate),
      avgFpsDelta: this._delta(first.avgFps, last.avgFps),
      blockerDeltas: this._deltaByKey(first.blockersByReason, last.blockersByReason),
      goalFailureDeltas: this._deltaByKey(first.goalFailuresByGoal, last.goalFailuresByGoal),
      // EventManager event trends
      eventManagerRateDelta: this._delta(first.eventManagerRate, last.eventManagerRate),
      eventManagerCategoryDeltas: this._deltaByKey(first.eventManagerByCategory, last.eventManagerByCategory),
      anomalyCountDelta: this._delta(first.anomalyCount, last.anomalyCount),
      history: metrics
    };

    // Add degradation detection
    const degradation = this._detectDegradation(metrics);
    if (degradation.issues.length > 0) {
      trends.degradation = degradation;
    }

    // Add baseline comparison (first 25% vs last 25% of reports)
    const baselineComparison = this._compareBaseline(metrics);
    if (baselineComparison.differences.length > 0) {
      trends.baselineComparison = baselineComparison;
    }

    return trends;
  }

  _extractMetrics(report) {
    const totalLines = report.meta.totalLines || 0;
    const errors = report.stats.errors || {};
    const combat = report.stats.combat || {};
    const economy = report.stats.economy || {};
    const performance = report.stats.performance || {};
    const factionAIReport = report.stats.factionAIReport || {};
    const eventManager = report.stats.eventManager || {};

    return {
      processedAt: report.meta.processedAt,
      errorRate: this._rate(errors.totalErrors || 0, totalLines),
      warningRate: this._rate(errors.totalWarnings || 0, totalLines),
      combatRate: this._rate(combat.totalAttacks || 0, totalLines),
      economyRate: this._rate(economy.totalDeposits || 0, totalLines),
      avgFps: performance.avgFps || null,
      blockersByReason: factionAIReport.blockersByReason || {},
      goalFailuresByGoal: factionAIReport.errorsByGoal || {},
      goalFailuresByFaction: factionAIReport.errorsByFaction || {},
      // EventManager metrics
      eventManagerRate: this._rate(eventManager.totalEvents || 0, totalLines),
      eventManagerByCategory: eventManager.byCategory || {},
      eventManagerTotalEvents: eventManager.totalEvents || 0,
      anomalyCount: (report.anomalies || []).length,
      // Category-specific metrics
      combatEvents: eventManager.combat?.totalAttacks || 0,
      deathEvents: eventManager.death?.totalDeaths || 0,
      buildingEvents: eventManager.building?.totalCompletions || 0,
      socialEvents: eventManager.social?.totalSpeech || 0,
      militaryEvents: eventManager.military?.totalRecruitments || 0,
      // Communication mode metrics
      visibleEvents: this._countVisibleEvents(eventManager.byCommunicationMode || {}),
      totalVisibleEvents: eventManager.totalEvents || 0
    };
  }

  _countVisibleEvents(byCommunicationMode) {
    let visible = 0;
    Object.keys(byCommunicationMode).forEach(mode => {
      if (mode !== 'None' && mode !== 'none') {
        visible += byCommunicationMode[mode] || 0;
      }
    });
    return visible;
  }

  _rate(count, total) {
    if (!total) return 0;
    return Number((count / total).toFixed(6));
  }

  _delta(a, b) {
    if (a === null || b === null) return null;
    return Number((b - a).toFixed(6));
  }

  _deltaByKey(a = {}, b = {}) {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    const deltas = {};
    for (const key of keys) {
      const start = a[key] || 0;
      const end = b[key] || 0;
      deltas[key] = end - start;
    }
    return deltas;
  }

  _detectDegradation(metrics) {
    const degradation = {
      issues: [],
      severity: 'none'
    };

    if (metrics.length < 3) {
      return degradation; // Need at least 3 data points
    }

    // Calculate trends over last 3+ reports
    const recentMetrics = metrics.slice(-5); // Last 5 reports
    const olderMetrics = metrics.slice(0, Math.min(5, metrics.length - recentMetrics.length));
    
    if (olderMetrics.length === 0) {
      return degradation;
    }

    // Average error rate trend
    const oldErrorRate = olderMetrics.reduce((sum, m) => sum + (m.errorRate || 0), 0) / olderMetrics.length;
    const newErrorRate = recentMetrics.reduce((sum, m) => sum + (m.errorRate || 0), 0) / recentMetrics.length;
    if (newErrorRate > oldErrorRate * 1.5 && oldErrorRate > 0) {
      degradation.issues.push({
        type: 'error_rate_increase',
        summary: `Error rate increased from ${oldErrorRate.toFixed(6)} to ${newErrorRate.toFixed(6)} (${((newErrorRate / oldErrorRate - 1) * 100).toFixed(1)}% increase)`,
        severity: 'high',
        oldValue: oldErrorRate,
        newValue: newErrorRate,
        change: ((newErrorRate / oldErrorRate - 1) * 100)
      });
      degradation.severity = 'high';
    }

    // Anomaly count trend
    const oldAnomalyCount = olderMetrics.reduce((sum, m) => sum + (m.anomalyCount || 0), 0) / olderMetrics.length;
    const newAnomalyCount = recentMetrics.reduce((sum, m) => sum + (m.anomalyCount || 0), 0) / recentMetrics.length;
    if (newAnomalyCount > oldAnomalyCount * 2 && oldAnomalyCount > 0) {
      degradation.issues.push({
        type: 'anomaly_increase',
        summary: `Anomaly count increased from ${oldAnomalyCount.toFixed(1)} to ${newAnomalyCount.toFixed(1)} (${((newAnomalyCount / oldAnomalyCount - 1) * 100).toFixed(1)}% increase)`,
        severity: 'medium',
        oldValue: oldAnomalyCount,
        newValue: newAnomalyCount,
        change: ((newAnomalyCount / oldAnomalyCount - 1) * 100)
      });
      if (degradation.severity !== 'high') {
        degradation.severity = 'medium';
      }
    }

    // FPS degradation
    const oldFps = olderMetrics.filter(m => m.avgFps !== null).map(m => m.avgFps);
    const newFps = recentMetrics.filter(m => m.avgFps !== null).map(m => m.avgFps);
    if (oldFps.length > 0 && newFps.length > 0) {
      const oldAvgFps = oldFps.reduce((sum, fps) => sum + fps, 0) / oldFps.length;
      const newAvgFps = newFps.reduce((sum, fps) => sum + fps, 0) / newFps.length;
      if (newAvgFps < oldAvgFps * 0.9 && oldAvgFps > 0) {
        degradation.issues.push({
          type: 'fps_degradation',
          summary: `Average FPS decreased from ${oldAvgFps.toFixed(1)} to ${newAvgFps.toFixed(1)} (${((1 - newAvgFps / oldAvgFps) * 100).toFixed(1)}% decrease)`,
          severity: 'medium',
          oldValue: oldAvgFps,
          newValue: newAvgFps,
          change: ((1 - newAvgFps / oldAvgFps) * 100)
        });
        if (degradation.severity === 'none') {
          degradation.severity = 'medium';
        }
      }
    }

    // Event volume spike (may indicate issues)
    const oldEventRate = olderMetrics.reduce((sum, m) => sum + (m.eventManagerRate || 0), 0) / olderMetrics.length;
    const newEventRate = recentMetrics.reduce((sum, m) => sum + (m.eventManagerRate || 0), 0) / recentMetrics.length;
    if (newEventRate > oldEventRate * 3 && oldEventRate > 0) {
      degradation.issues.push({
        type: 'event_volume_spike',
        summary: `Event rate spiked from ${oldEventRate.toFixed(6)} to ${newEventRate.toFixed(6)} (${((newEventRate / oldEventRate - 1) * 100).toFixed(1)}% increase)`,
        severity: 'low',
        oldValue: oldEventRate,
        newValue: newEventRate,
        change: ((newEventRate / oldEventRate - 1) * 100)
      });
    }

    return degradation;
  }

  _compareBaseline(metrics) {
    const comparison = {
      differences: [],
      baselinePeriod: 'first_25pct',
      currentPeriod: 'last_25pct'
    };

    if (metrics.length < 4) {
      return comparison; // Need at least 4 data points
    }

    const baselineSize = Math.max(1, Math.floor(metrics.length * 0.25));
    const baseline = metrics.slice(0, baselineSize);
    const current = metrics.slice(-baselineSize);

    // Compare error rates
    const baselineErrorRate = baseline.reduce((sum, m) => sum + (m.errorRate || 0), 0) / baseline.length;
    const currentErrorRate = current.reduce((sum, m) => sum + (m.errorRate || 0), 0) / current.length;
    const errorRateChange = ((currentErrorRate / baselineErrorRate - 1) * 100);
    if (Math.abs(errorRateChange) > 20 && baselineErrorRate > 0) {
      comparison.differences.push({
        metric: 'error_rate',
        baseline: baselineErrorRate,
        current: currentErrorRate,
        change: errorRateChange,
        significance: errorRateChange > 0 ? 'worsening' : 'improving'
      });
    }

    // Compare anomaly counts
    const baselineAnomalies = baseline.reduce((sum, m) => sum + (m.anomalyCount || 0), 0) / baseline.length;
    const currentAnomalies = current.reduce((sum, m) => sum + (m.anomalyCount || 0), 0) / current.length;
    const anomalyChange = ((currentAnomalies / baselineAnomalies - 1) * 100);
    if (Math.abs(anomalyChange) > 30 && baselineAnomalies > 0) {
      comparison.differences.push({
        metric: 'anomaly_count',
        baseline: baselineAnomalies,
        current: currentAnomalies,
        change: anomalyChange,
        significance: anomalyChange > 0 ? 'worsening' : 'improving'
      });
    }

    // Compare FPS
    const baselineFps = baseline.filter(m => m.avgFps !== null).map(m => m.avgFps);
    const currentFps = current.filter(m => m.avgFps !== null).map(m => m.avgFps);
    if (baselineFps.length > 0 && currentFps.length > 0) {
      const baselineAvgFps = baselineFps.reduce((sum, fps) => sum + fps, 0) / baselineFps.length;
      const currentAvgFps = currentFps.reduce((sum, fps) => sum + fps, 0) / currentFps.length;
      const fpsChange = ((1 - currentAvgFps / baselineAvgFps) * 100);
      if (Math.abs(fpsChange) > 10 && baselineAvgFps > 0) {
        comparison.differences.push({
          metric: 'avg_fps',
          baseline: baselineAvgFps,
          current: currentAvgFps,
          change: fpsChange,
          significance: fpsChange > 0 ? 'worsening' : 'improving'
        });
      }
    }

    // Compare event rates
    const baselineEventRate = baseline.reduce((sum, m) => sum + (m.eventManagerRate || 0), 0) / baseline.length;
    const currentEventRate = current.reduce((sum, m) => sum + (m.eventManagerRate || 0), 0) / current.length;
    const eventRateChange = ((currentEventRate / baselineEventRate - 1) * 100);
    if (Math.abs(eventRateChange) > 50 && baselineEventRate > 0) {
      comparison.differences.push({
        metric: 'event_rate',
        baseline: baselineEventRate,
        current: currentEventRate,
        change: eventRateChange,
        significance: eventRateChange > 0 ? 'increase' : 'decrease'
      });
    }

    return comparison;
  }

  _buildDateId() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  }
}

module.exports = MetaReportGenerator;
