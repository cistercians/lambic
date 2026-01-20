const fs = require('fs').promises;
const path = require('path');

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
    const totalErrors = errors.totalErrors || 0;
    const totalWarnings = errors.totalWarnings || 0;

    const runSummary = {
      narrative: `Processed ${reportData.meta.totalLines} lines. ` +
        `Errors: ${totalErrors}, warnings: ${totalWarnings}.`,
      keyRisks: reportData.anomalies.map((anomaly) => anomaly.summary || anomaly.type),
      openQuestions: []
    };

    return {
      meta: reportData.meta,
      highlights: reportData.highlights,
      stats: reportData.stats,
      anomalies: reportData.anomalies,
      evidence: reportData.evidence,
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
    lines.push(`Errors: ${errors.totalErrors || 0}`);
    lines.push(`Warnings: ${errors.totalWarnings || 0}`);
    lines.push(`Combat events: ${(stats.combat && stats.combat.totalAttacks) || 0} attacks, ${(stats.combat && stats.combat.totalDeaths) || 0} deaths`);
    lines.push(`Economic deposits: ${(stats.economy && stats.economy.totalDeposits) || 0}`);
    lines.push('');

    lines.push('DETAILS');
    lines.push('-------');
    lines.push(this._formatSection('Combat', stats.combat));
    lines.push(this._formatSection('Economy', stats.economy));
    lines.push(this._formatSection('Errors', stats.errors));
    lines.push(this._formatSection('Performance', stats.performance));
    lines.push(this._formatSection('Serf', stats.serf));
    lines.push(this._formatSection('Faction AI', stats.factionAI));

    if (anomalies.length) {
      lines.push('');
      lines.push('ANOMALIES');
      lines.push('---------');
      anomalies.forEach((anomaly, index) => {
        lines.push(`${index + 1}. ${anomaly.summary || anomaly.type} (count: ${anomaly.count || 'n/a'})`);
      });
    }

    return lines.join('\n');
  }

  _formatSection(title, data) {
    if (!data) return `${title}: no data`;
    return `${title}:\n${JSON.stringify(data, null, 2)}`;
  }

  _buildRunId() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}

module.exports = ReportGenerator;
