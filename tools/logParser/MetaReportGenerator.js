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

    return {
      errorRateDelta: this._delta(first.errorRate, last.errorRate),
      warningRateDelta: this._delta(first.warningRate, last.warningRate),
      combatRateDelta: this._delta(first.combatRate, last.combatRate),
      economyRateDelta: this._delta(first.economyRate, last.economyRate),
      avgFpsDelta: this._delta(first.avgFps, last.avgFps),
      history: metrics
    };
  }

  _extractMetrics(report) {
    const totalLines = report.meta.totalLines || 0;
    const errors = report.stats.errors || {};
    const combat = report.stats.combat || {};
    const economy = report.stats.economy || {};
    const performance = report.stats.performance || {};

    return {
      processedAt: report.meta.processedAt,
      errorRate: this._rate(errors.totalErrors || 0, totalLines),
      warningRate: this._rate(errors.totalWarnings || 0, totalLines),
      combatRate: this._rate(combat.totalAttacks || 0, totalLines),
      economyRate: this._rate(economy.totalDeposits || 0, totalLines),
      avgFps: performance.avgFps || null
    };
  }

  _rate(count, total) {
    if (!total) return 0;
    return Number((count / total).toFixed(6));
  }

  _delta(a, b) {
    if (a === null || b === null) return null;
    return Number((b - a).toFixed(6));
  }

  _buildDateId() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  }
}

module.exports = MetaReportGenerator;
