/**
 * KillCommand - Stops the game loop and generates comprehensive telemetry report
 *
 * Command: /kill
 * Aliases: /stop, /endgame
 *
 * Stops the OptimizedGameLoop and generates a final report with:
 * - Human-readable console output
 * - AI-friendly JSON output for copy/paste into Cursor
 */

const BaseCommand = require('../BaseCommand');

class KillCommand extends BaseCommand {
  constructor() {
    super();
    this.name = 'kill';
    this.aliases = ['stop', 'endgame'];
    this.description = 'Stop the game loop and generate comprehensive telemetry report';
    this.requiresAdmin = true; // Requires admin privileges

    // Dependencies (lazy-loaded)
    this.dependencyResolver = null;
    this.reportAggregator = null;
    this.dailyReportStore = null;
    this.dailyReportGenerator = null;
  }

  /**
   * Execute the kill command
   * @param {object} data - Command data
   * @param {object} data.socket - Player socket
   * @param {string} data.id - Player ID
   * @returns {boolean} Success
   */
  execute(data) {
    try {
      const socket = data.socket;
      const playerId = data.id;

      // Validate player permissions (could be extended)
      if (!this._validatePermissions(socket, playerId)) {
        this._sendError(socket, 'Insufficient permissions to execute kill command');
        return true;
      }

      // Initialize dependencies
      if (!this._initializeDependencies()) {
        this._sendError(socket, 'Monitoring system not available');
        return true;
      }

      // Generate final daily report for current day (if any telemetry data exists)
      console.log('[KillCommand] Generating final daily report for current day...');
      const currentDayReport = this._generateCurrentDayReport();

      // Generate final aggregated report
      console.log('[KillCommand] Aggregating all daily reports...');
      const finalReport = this.reportAggregator.generateFinalReport(currentDayReport);

      // Stop the game loop
      console.log('[KillCommand] Stopping game loop...');
      const gameLoopStopped = this._stopGameLoop();

      if (!gameLoopStopped) {
        console.warn('[KillCommand] Warning: Could not stop game loop gracefully');
      }

      // Generate and display reports
      this._displayReports(socket, finalReport);

      // Send confirmation to player
      this._sendConfirmation(socket, finalReport, gameLoopStopped);

      console.log('[KillCommand] Kill command completed successfully');
      return true;

    } catch (error) {
      console.error('[KillCommand] Error executing kill command:', error);
      this._sendError(data.socket, `Kill command failed: ${error.message}`);
      return true;
    }
  }

  /**
   * Validate player permissions
   * @private
   * @param {object} socket - Player socket
   * @param {string} playerId - Player ID
   * @returns {boolean} Has permission
   */
  _validatePermissions(socket, playerId) {
    // For now, allow any player to execute (in development)
    // In production, this should check for admin status
    return true;
  }

  /**
   * Initialize required dependencies
   * @private
   * @returns {boolean} Success
   */
  _initializeDependencies() {
    try {
      // Initialize monitoring components
      this.dailyReportStore = this._getDailyReportStore();
      this.dailyReportGenerator = this._getDailyReportGenerator();
      this.reportAggregator = this._getReportAggregator();

      // Initialize aggregator with dependencies
      if (this.reportAggregator && this.dailyReportStore && this.dailyReportGenerator) {
        this.reportAggregator.initialize(this.dailyReportStore, this.dailyReportGenerator);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[KillCommand] Failed to initialize dependencies:', error);
      return false;
    }
  }

  /**
   * Get DailyReportStore instance
   * @private
   * @returns {DailyReportStore|null}
   */
  _getDailyReportStore() {
    try {
      // Try to get from global registry first
      if (global.dailyReportStore) {
        return global.dailyReportStore;
      }

      // Create new instance if not exists
      const DailyReportStore = require('../../../core/monitoring/DailyReportStore');
      const store = new DailyReportStore();
      global.dailyReportStore = store;
      return store;
    } catch (error) {
      console.error('[KillCommand] Failed to get DailyReportStore:', error);
      return null;
    }
  }

  /**
   * Get DailyReportGenerator instance
   * @private
   * @returns {DailyReportGenerator|null}
   */
  _getDailyReportGenerator() {
    try {
      // Try to get from global registry first
      if (global.dailyReportGenerator) {
        return global.dailyReportGenerator;
      }

      // Create new instance if not exists
      const DailyReportGenerator = require('../../../core/monitoring/DailyReportGenerator');
      const generator = new DailyReportGenerator();

      // Initialize with telemetry logger and network telemetry
      const telemetryLogger = require('../../../core/TelemetryLogger');
      const networkTelemetry = require('../../../core/NetworkTelemetry');
      generator.initialize(telemetryLogger, networkTelemetry);

      global.dailyReportGenerator = generator;
      return generator;
    } catch (error) {
      console.error('[KillCommand] Failed to get DailyReportGenerator:', error);
      return null;
    }
  }

  /**
   * Get ReportAggregator instance
   * @private
   * @returns {ReportAggregator|null}
   */
  _getReportAggregator() {
    try {
      // Try to get from global registry first
      if (global.reportAggregator) {
        return global.reportAggregator;
      }

      // Create new instance if not exists
      const ReportAggregator = require('../../../core/monitoring/ReportAggregator');
      const aggregator = new ReportAggregator();
      global.reportAggregator = aggregator;
      return aggregator;
    } catch (error) {
      console.error('[KillCommand] Failed to get ReportAggregator:', error);
      return null;
    }
  }

  /**
   * Generate final daily report for current day
   * @private
   * @returns {object|null} Current day report data
   */
  _generateCurrentDayReport() {
    try {
      if (!this.dailyReportGenerator) return null;

      // Generate report for current day
      const currentDay = global.day || 1;
      const currentDayReport = this.dailyReportGenerator.generateDailyReport(currentDay);

      // Store it if we have data
      if (currentDayReport && this.dailyReportStore) {
        this.dailyReportStore.store(currentDay, currentDayReport);
      }

      return currentDayReport;
    } catch (error) {
      console.error('[KillCommand] Failed to generate current day report:', error);
      return null;
    }
  }

  /**
   * Stop the game loop
   * @private
   * @returns {boolean} Success
   */
  _stopGameLoop() {
    try {
      // Try multiple ways to stop the game loop

      // Method 1: Via global reference (primary method used in lambic.js)
      if (global.optimizedGameLoop && typeof global.optimizedGameLoop.stop === 'function') {
        global.optimizedGameLoop.stop();
        console.log('[KillCommand] Successfully stopped OptimizedGameLoop');
        return true;
      }

      // Method 2: Alternative global references
      if (global.gameLoop && typeof global.gameLoop.stop === 'function') {
        global.gameLoop.stop();
        console.log('[KillCommand] Successfully stopped gameLoop');
        return true;
      }

      // Method 3: Via system registry if available
      if (global.systemRegistry) {
        const gameLoop = global.systemRegistry.get('gameLoop') ||
                        global.systemRegistry.get('optimizedGameLoop');
        if (gameLoop && typeof gameLoop.stop === 'function') {
          gameLoop.stop();
          console.log('[KillCommand] Successfully stopped gameLoop via systemRegistry');
          return true;
        }
      }

      console.warn('[KillCommand] Could not find game loop to stop - available globals:', Object.keys(global).filter(key => key.includes('GameLoop') || key.includes('gameLoop')));
      return false;

    } catch (error) {
      console.error('[KillCommand] Error stopping game loop:', error);
      return false;
    }
  }

  /**
   * Display both console and JSON reports
   * @private
   * @param {object} socket - Player socket
   * @param {object} finalReport - Final aggregated report
   */
  _displayReports(socket, finalReport) {
    try {
      // Generate console output
      const consoleOutput = this.reportAggregator.generateConsoleOutput(finalReport);

      // Display console report
      console.log(consoleOutput);

      // Display JSON report header
      console.log('\n' + '='.repeat(80));
      console.log('🤖 AI-FRIENDLY JSON REPORT (Copy/paste into Cursor for analysis):');
      console.log('='.repeat(80));

      // Display JSON report (formatted for copy/paste)
      console.log(JSON.stringify(finalReport, null, 2));

      console.log('='.repeat(80));

      // Send summary to player
      if (socket && typeof socket.write === 'function') {
        const summaryMessage = `<div style="color: #00ff00; font-weight: bold;">
          ✅ Game loop stopped. Report generated.<br>
          📊 ${finalReport.summary.totalDays} days analyzed, ${finalReport.summary.totalErrors} errors, ${finalReport.summary.totalIssues} issues detected.<br>
          📋 Check server console for detailed report.
        </div>`;

        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: summaryMessage
        }));
      }

    } catch (error) {
      console.error('[KillCommand] Error displaying reports:', error);
      this._sendError(socket, 'Error generating report output');
    }
  }

  /**
   * Send confirmation message to player
   * @private
   * @param {object} socket - Player socket
   * @param {object} finalReport - Final report
   * @param {boolean} gameLoopStopped - Whether game loop was stopped
   */
  _sendConfirmation(socket, finalReport, gameLoopStopped) {
    try {
      if (!socket || typeof socket.write !== 'function') return;

      const statusIcon = gameLoopStopped ? '🛑' : '⚠️';
      const statusText = gameLoopStopped ? 'STOPPED' : 'WARNING: Not stopped';

      const confirmationMessage = `<div style="color: #ffff00; font-weight: bold; border: 1px solid #ffff00; padding: 10px; margin: 5px 0;">
        ${statusIcon} SERVER STATUS: ${statusText}<br>
        📈 Session Report Generated<br>
        ⏱️ Duration: ${this._formatDuration(finalReport.sessionInfo.serverUptime)}<br>
        📊 Days: ${finalReport.summary.totalDays}, Errors: ${finalReport.summary.totalErrors}, Issues: ${finalReport.summary.totalIssues}<br>
        💾 Server remains running - use Ctrl+C to fully shutdown
      </div>`;

      socket.write(JSON.stringify({
        msg: 'addToChat',
        message: confirmationMessage
      }));

    } catch (error) {
      console.error('[KillCommand] Error sending confirmation:', error);
    }
  }

  /**
   * Send error message to player
   * @private
   * @param {object} socket - Player socket
   * @param {string} message - Error message
   */
  _sendError(socket, message) {
    try {
      if (socket && typeof socket.write === 'function') {
        socket.write(JSON.stringify({
          msg: 'addToChat',
          message: `<span style="color: #ff4444;">❌ ${message}</span>`
        }));
      }
    } catch (error) {
      console.error('[KillCommand] Error sending error message:', error);
    }
  }

  /**
   * Format duration in seconds to readable string
   * @private
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  _formatDuration(seconds) {
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
   * Get help text for the command
   * @returns {string} Help text
   */
  getHelp() {
    return `<b>/kill</b> - Stop the game loop and generate comprehensive telemetry report<br>
            <b>Aliases:</b> /stop, /endgame<br>
            <b>Effect:</b> Stops game simulation, generates daily reports, outputs console + JSON reports<br>
            <b>Note:</b> Server remains running, use Ctrl+C for full shutdown`;
  }
}

module.exports = KillCommand;