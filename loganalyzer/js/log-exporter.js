// Log Analysis Dashboard - Exporter
// Handles report generation and data export functionality

class LogExporter {
    constructor() {
        this.dataManager = null;
        this.analyzer = null;
        this.visualizer = null;
    }

    setDataManager(dataManager) {
        this.dataManager = dataManager;
        this.analyzer = window.analyzer;
        this.visualizer = window.visualizer;
    }

    // Generate comprehensive analysis report
    generateAnalysisReport() {
        if (!this.dataManager) {
            return 'Error: Data manager not available';
        }

        const report = {
            header: this.generateReportHeader(),
            summary: this.generateSummarySection(),
            insights: this.generateInsightsSection(),
            patterns: this.generatePatternsSection(),
            recommendations: this.generateRecommendationsSection(),
            systemHealth: this.generateSystemHealthSection(),
            rawData: this.generateRawDataSection()
        };

        return this.formatReportAsText(report);
    }

    // Generate report header
    generateReportHeader() {
        return {
            title: 'Lambic Server Log Analysis Report',
            generatedAt: new Date().toISOString(),
            timeRange: this.getTimeRangeDescription(),
            dataSource: this.dataManager.isConnected ? 'Live Server' : 'Log Files'
        };
    }

    // Generate summary section
    generateSummarySection() {
        const metrics = this.dataManager.getMetricsSnapshot();
        const errorStats = this.dataManager.getErrorStats();

        return {
            totalEntries: metrics.logCount || 0,
            filteredEntries: metrics.filteredCount || 0,
            errorCount: errorStats.total,
            errorRate: `${errorStats.averageRate.toFixed(2)} errors/hour`,
            connectionStatus: metrics.connectionStatus ? 'Connected' : 'Disconnected',
            lastUpdate: metrics.lastUpdate ? metrics.lastUpdate.toLocaleString() : 'Never'
        };
    }

    // Generate insights section
    generateInsightsSection() {
        if (!this.analyzer) return { insights: [] };

        const entries = this.dataManager.filteredEntries;
        const metrics = this.dataManager.getMetricsSnapshot();
        const analysis = this.analyzer.analyze(entries, metrics);

        return {
            insights: analysis.insights.map(insight => ({
                severity: insight.severity.toUpperCase(),
                title: insight.title,
                description: insight.description,
                evidenceCount: insight.evidence ? insight.evidence.length : 0,
                affectedFiles: insight.affectedFiles,
                recommendations: insight.recommendations
            })),
            totalInsights: analysis.insights.length,
            criticalCount: analysis.insights.filter(i => i.severity === 'critical').length,
            highCount: analysis.insights.filter(i => i.severity === 'high').length
        };
    }

    // Generate error patterns section
    generatePatternsSection() {
        if (!this.analyzer) return { patterns: [] };

        const entries = this.dataManager.filteredEntries;
        const analysis = this.analyzer.analyze(entries, {});

        return {
            patterns: analysis.patterns.slice(0, 20).map(pattern => ({
                category: pattern.category,
                message: pattern.message.substring(0, 100) + (pattern.message.length > 100 ? '...' : ''),
                count: pattern.count,
                frequency: `${pattern.frequency.toFixed(2)} errors/hour`,
                levels: pattern.levels,
                firstSeen: pattern.firstSeen.toLocaleString(),
                lastSeen: pattern.lastSeen.toLocaleString()
            })),
            totalPatterns: analysis.patterns.length
        };
    }

    // Generate recommendations section
    generateRecommendationsSection() {
        if (!this.analyzer) return { recommendations: [] };

        const entries = this.dataManager.filteredEntries;
        const metrics = this.dataManager.getMetricsSnapshot();
        const analysis = this.analyzer.analyze(entries, metrics);

        return {
            recommendations: analysis.recommendations.map(rec => ({
                priority: rec.priority.toUpperCase(),
                category: rec.category.replace(/_/g, ' ').toUpperCase(),
                action: rec.action,
                affectedFiles: rec.affectedFiles,
                evidenceCount: rec.evidence
            })),
            totalRecommendations: analysis.recommendations.length,
            urgentCount: analysis.recommendations.filter(r => r.priority === 'urgent').length,
            highCount: analysis.recommendations.filter(r => r.priority === 'high').length
        };
    }

    // Generate system health section
    generateSystemHealthSection() {
        const metrics = this.dataManager.getMetricsSnapshot();

        return {
            serverStatus: metrics.health ? metrics.health.overall : 'Unknown',
            memoryUsage: this.getMemoryUsage(metrics),
            activePlayers: metrics.entities ? metrics.entities.players || 0 : 0,
            performance: this.getPerformanceMetrics(metrics),
            recommendations: metrics.health && metrics.health.recommendations ?
                metrics.health.recommendations : []
        };
    }

    // Generate raw data section (summary)
    generateRawDataSection() {
        return {
            filterSettings: this.dataManager.filters,
            exportTimestamp: new Date().toISOString(),
            dataPoints: this.dataManager.filteredEntries ? this.dataManager.filteredEntries.length : 0
        };
    }

    // Helper methods
    getTimeRangeDescription() {
        const filters = this.dataManager.filters;

        if (filters.timeRange === 'custom') {
            const start = filters.startTime ? filters.startTime.toLocaleString() : 'Unknown';
            const end = filters.endTime ? filters.endTime.toLocaleString() : 'Unknown';
            return `${start} to ${end}`;
        } else {
            return `Last ${filters.timeRange}`;
        }
    }

    getMemoryUsage(metrics) {
        if (metrics.server && metrics.server.memory) {
            const mem = metrics.server.memory;
            return {
                used: Math.round(mem.heapUsed / 1024 / 1024),
                total: Math.round(mem.heapTotal / 1024 / 1024),
                percentage: Math.round((mem.heapUsed / mem.heapTotal) * 100)
            };
        }
        return { used: 0, total: 0, percentage: 0 };
    }

    getPerformanceMetrics(metrics) {
        if (metrics.performance) {
            return {
                fps: metrics.performance.fps || 0,
                frameTime: `${metrics.performance.frameTime || 0}ms`,
                status: (metrics.performance.fps || 0) >= 30 ? 'Good' : 'Poor'
            };
        }
        return { fps: 0, frameTime: '0ms', status: 'Unknown' };
    }

    // Format report as readable text
    formatReportAsText(report) {
        let output = '';

        // Header
        output += '='.repeat(80) + '\n';
        output += ` ${report.header.title}\n`;
        output += '='.repeat(80) + '\n\n';
        output += `Generated: ${new Date(report.header.generatedAt).toLocaleString()}\n`;
        output += `Time Range: ${report.header.timeRange}\n`;
        output += `Data Source: ${report.header.dataSource}\n\n`;

        // Summary
        output += 'SUMMARY\n';
        output += '-'.repeat(40) + '\n';
        output += `Total Log Entries: ${report.summary.totalEntries.toLocaleString()}\n`;
        output += `Filtered Entries: ${report.summary.filteredEntries.toLocaleString()}\n`;
        output += `Error Count: ${report.summary.errorCount.toLocaleString()}\n`;
        output += `Error Rate: ${report.summary.errorRate}\n`;
        output += `Connection Status: ${report.summary.connectionStatus}\n`;
        output += `Last Update: ${report.summary.lastUpdate}\n\n`;

        // Insights
        if (report.insights.insights.length > 0) {
            output += 'KEY INSIGHTS\n';
            output += '-'.repeat(40) + '\n';
            output += `Total Insights: ${report.insights.totalInsights}\n`;
            output += `Critical: ${report.insights.criticalCount}, High: ${report.insights.highCount}\n\n`;

            report.insights.insights.forEach((insight, index) => {
                output += `${index + 1}. [${insight.severity}] ${insight.title}\n`;
                output += `   ${insight.description}\n`;
                output += `   Evidence: ${insight.evidenceCount} related log entries\n`;
                if (insight.affectedFiles.length > 0) {
                    output += `   Affected Files: ${insight.affectedFiles.join(', ')}\n`;
                }
                output += `   Recommendations:\n`;
                insight.recommendations.forEach(rec => {
                    output += `     • ${rec}\n`;
                });
                output += '\n';
            });
        }

        // Error Patterns
        if (report.patterns.patterns.length > 0) {
            output += 'TOP ERROR PATTERNS\n';
            output += '-'.repeat(40) + '\n';

            report.patterns.patterns.forEach((pattern, index) => {
                output += `${index + 1}. ${pattern.category.toUpperCase()}\n`;
                output += `   Message: ${pattern.message}\n`;
                output += `   Count: ${pattern.count}, Frequency: ${pattern.frequency}\n`;
                output += `   Levels: ${pattern.levels.join(', ')}\n`;
                output += `   First Seen: ${pattern.firstSeen}\n`;
                output += `   Last Seen: ${pattern.lastSeen}\n\n`;
            });
        }

        // Recommendations
        if (report.recommendations.recommendations.length > 0) {
            output += 'RECOMMENDATIONS\n';
            output += '-'.repeat(40) + '\n';
            output += `Total: ${report.recommendations.totalRecommendations}\n`;
            output += `Urgent: ${report.recommendations.urgentCount}, High: ${report.recommendations.highCount}\n\n`;

            report.recommendations.recommendations.forEach((rec, index) => {
                output += `${index + 1}. [${rec.priority}] ${rec.action}\n`;
                if (rec.affectedFiles.length > 0) {
                    output += `   Files: ${rec.affectedFiles.join(', ')}\n`;
                }
                output += '\n';
            });
        }

        // System Health
        output += 'SYSTEM HEALTH\n';
        output += '-'.repeat(40) + '\n';
        output += `Server Status: ${report.systemHealth.serverStatus}\n`;
        output += `Memory Usage: ${report.systemHealth.memoryUsage.used}MB / ${report.systemHealth.memoryUsage.total}MB (${report.systemHealth.memoryUsage.percentage}%)\n`;
        output += `Active Players: ${report.systemHealth.activePlayers}\n`;

        if (report.systemHealth.performance) {
            output += `Performance: ${report.systemHealth.performance.fps} FPS, ${report.systemHealth.performance.frameTime} frame time (${report.systemHealth.performance.status})\n`;
        }

        if (report.systemHealth.recommendations.length > 0) {
            output += '\nSystem Recommendations:\n';
            report.systemHealth.recommendations.forEach(rec => {
                output += `  • ${rec.action}\n`;
            });
        }
        output += '\n';

        // Footer
        output += '='.repeat(80) + '\n';
        output += 'End of Report\n';

        return output;
    }

    // Export raw data as JSON
    exportRawData() {
        const data = {
            metadata: {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                source: 'LogAnalysisDashboard'
            },
            filters: this.dataManager.filters,
            entries: this.dataManager.logEntries,
            metrics: this.dataManager.getMetricsSnapshot(),
            analysis: this.analyzer ? this.analyzer.analyze(
                this.dataManager.filteredEntries,
                this.dataManager.getMetricsSnapshot()
            ) : null
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        this.downloadBlob(blob, `lambic-log-analysis-${Date.now()}.json`);
    }

    // Export filtered logs as text
    exportFilteredLogs() {
        const entries = this.dataManager.filteredEntries || [];
        let content = '';

        entries.forEach(entry => {
            content += `[${entry.timestamp.toISOString()}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}\n`;
        });

        const blob = new Blob([content], {
            type: 'text/plain'
        });

        this.downloadBlob(blob, `filtered-logs-${Date.now()}.txt`);
    }

    // Helper to download blob as file
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Copy report to clipboard
    async copyReportToClipboard() {
        const report = this.generateAnalysisReport();

        try {
            await navigator.clipboard.writeText(report);
            return true;
        } catch (error) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = report;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                return true;
            } catch (fallbackError) {
                console.error('Failed to copy to clipboard:', fallbackError);
                return false;
            } finally {
                document.body.removeChild(textArea);
            }
        }
    }
}
