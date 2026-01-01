# Log Analysis Dashboard - Lambic Server

A standalone web-based tool for real-time monitoring, analysis, and debugging of Lambic game server logs. Built following the same modular architecture as MapModeler.

## Features

- **Offline Analysis**: Load log files or paste log text for comprehensive analysis
- **Real-time Monitoring**: Live WebSocket connection (requires server telemetry endpoint)
- **Interactive Charts**: Error trends and performance metrics with Chart.js visualizations
- **Advanced Filtering**: Filter logs by time range, categories, severity, and search terms
- **Pattern Recognition**: Automated detection of error patterns and system issues
- **Smart Recommendations**: Context-aware debugging suggestions based on log analysis
- **Export Reports**: Generate detailed analysis reports for documentation
- **Offline Analysis**: Load and analyze saved log files without server connection

## Quick Start

### Primary: Offline Log Analysis
1. Open `index.html` in a web browser
2. Click "Load Data" to open the data input modal
3. **Choose your input method:**
   - **Upload Files**: Drag & drop or browse for `.log`, `.txt`, or `.json` files
   - **Paste Text**: Switch to the "Paste Text" tab and copy log output from terminal/console
4. Click "Process Data" to analyze the input
5. Use filters to analyze specific time periods or error types
6. Export analysis reports for documentation

## Interface Overview

### Dashboard Layout
```
┌─────────────────────────────────────────────────────────────┐
│ Server Health │ Error Rate │ Memory │ Active Players       │
├────────────────────────┼───────────────────┼───────────────┤
│                                                               │
│ Error Trends Chart │ Performance Metrics Chart               │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ Error Pattern Analysis │ Log Entry Details                   │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│ Connection Status │ Last Update │ Data Points                │
└─────────────────────────────────────────────────────────────┘
```

### Control Panel (Left Side)
- **Load Data**: Opens modal with choice between file upload or text paste
- **Reset Charts**: Clears performance and error trend chart data to fix display issues
- **Time Range**: Quick presets (All Time*, 5m, 1h, 24h, 7d) or custom date range
- **Categories**: Filter by log categories (all shown by default*)
- **Severity**: Filter by error levels (all shown by default*)
- **Search**: Text search across all log messages

*All checkboxes checked by default - uncheck to filter out specific types

### Data Input Modal
- **Upload Files Tab**: Drag & drop interface or browse for log files
- **Paste Text Tab**: Direct text input with keyboard shortcuts (Ctrl+Enter)
- **File Validation**: Automatic filtering for supported formats (.log, .txt, .json)
- **Batch Processing**: Handle multiple files simultaneously

### Visualization Panel (Right Side)
- **System Health**: Real-time server status indicators
- **Charts**: Interactive error trends and performance graphs
- **Error Patterns**: Top recurring error patterns with recommendations
- **Log Viewer**: Real-time log entries with auto-scroll controls

## Log Categories

The dashboard recognizes and categorizes logs from your existing telemetry system:

- **Combat**: Damage events, target validation, combat state issues
- **Network**: Connection handling, WebSocket events, timeouts
- **Memory**: Heap usage, garbage collection, memory leaks
- **Entity**: Player/NPC management, entity lifecycle issues
- **Pathfinding**: Navigation algorithms, path calculation errors
- **Database**: MongoDB connections, query failures

## Pattern Recognition

The analyzer automatically detects common issues:

### Memory Pressure
- Multiple heap/memory-related errors
- Recommendation: Increase server memory or optimize entity cleanup

### Network Instability
- Frequent connection/socket errors
- Recommendation: Check connectivity and connection limits

### Combat System Stress
- Combat validation failures or damage calculation errors
- Recommendation: Monitor combat frequency and load balancing

### Entity Management Issues
- Entity lifecycle problems (undefined/null references)
- Recommendation: Review entity creation/cleanup processes

## Usage Examples

### Debugging Combat Issues
1. Filter by "combat" category
2. Set time range to last hour
3. Look for error patterns in the analysis panel
4. Check recommendations for specific fixes

### Monitoring Performance
1. Watch the performance chart for FPS/frame time trends
2. Use error rate indicator for overall system health
3. Export reports when performance degrades

### Investigating Memory Leaks
1. Filter by "memory" category
2. Look for increasing error frequency over time
3. Check system health memory usage
4. Review entity counts and cleanup recommendations

## Troubleshooting

### Chart Display Issues
- **Charts expanding**: Click "Reset Charts" to clear chart data and fix display
- **Performance lag**: Charts update every 10-30 seconds to prevent memory issues
- **Charts not loading**: Ensure Chart.js CDN is accessible
- **Chart corruption**: Use "Reset Charts" or refresh the page

### Connection Issues
- **WebSocket fails**: Dashboard works offline with file/text input
- **No real-time data**: Check server telemetry endpoint (ws://localhost:2000/logs)
- **Connection spam**: Errors are throttled to prevent console flooding

### Performance Issues
- **Slow loading**: Limit data to recent time ranges
- **Memory usage**: Dashboard processes up to 10,000 log entries
- **Chart updates**: Throttled to prevent excessive CPU usage

## Input Methods

### Direct Text Pasting
- Copy log output directly from your terminal/console
- Paste into the textarea in the "Paste Log Text" section
- Click "Process Logs" or use `Ctrl+Enter` (Windows/Linux) / `Cmd+Enter` (Mac)
- No need to save files - perfect for quick analysis

### File Upload
- Supports `.log`, `.txt`, and `.json` file formats
- Batch processing of multiple files
- Automatic parsing of your server log format: `[HH:MM:SS] [LEVEL] [CATEGORY] message`

## Export Options

### Analysis Report
- Comprehensive analysis with insights and recommendations
- Error pattern summaries
- System health status
- Copy to clipboard or save as text file

### Raw Data Export
- Complete log data in JSON format
- All entries, metrics, and analysis results
- Suitable for external analysis tools

### Filtered Logs
- Export only the currently filtered log entries
- Plain text format matching your log format

## Server Integration

## Live Telemetry Connection

**Note**: Live telemetry connection is not currently implemented on the server. The dashboard works primarily in offline mode.

To enable live monitoring in the future, the server would need a WebSocket telemetry endpoint:

```javascript
// In your server configuration
process.env.TELEMETRY_ENABLED = 'true';

// WebSocket telemetry endpoint (connects to server port 2000)
const telemetryLogger = require('./server/js/core/TelemetryLogger');

// Server would need to expose: ws://localhost:2000/telemetry
```

The dashboard connects to `ws://localhost:2000/logs` by default.

## File Structure

```
loganalyzer/
├── index.html              # Main dashboard interface
├── css/
│   └── log-dashboard.css   # Styling and layout
├── js/
│   ├── log-data-manager.js # Data handling and WebSocket
│   ├── log-visualizer.js   # Charts and visualizations
│   ├── log-controls.js     # UI controls and filtering
│   ├── log-analyzer.js     # Pattern analysis engine
│   └── log-exporter.js     # Report generation
└── README.md              # This file
```

## Technical Details

- **No Server Required**: Runs entirely in the browser
- **WebSocket Support**: Real-time data streaming from server
- **Chart.js Integration**: Professional visualizations
- **Modular Architecture**: Easy to extend and customize
- **Responsive Design**: Works on desktop and mobile
- **Offline Capable**: Analyze saved log files without network

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires WebSocket support for live monitoring and Clipboard API for report copying.

## Troubleshooting

### Connection Issues
- Ensure server is running with telemetry enabled
- Check WebSocket port (default: 2000)
- Verify firewall allows WebSocket connections

### Chart Not Loading
- Check browser console for Chart.js errors
- Ensure stable internet connection for CDN loading
- Try refreshing the page

### Export Not Working
- Check browser permissions for clipboard access
- Use "Save As" if clipboard fails
- Ensure popup blockers aren't interfering

### Performance Issues
- Limit time range for large datasets
- Use category filters to reduce data volume
- Close other browser tabs to free memory

## Development

The tool is built with vanilla JavaScript and HTML5. Key libraries:
- **Chart.js**: For data visualizations
- **WebSocket API**: For real-time server connection
- **Clipboard API**: For report copying

To extend the tool:
1. Add new pattern rules in `log-analyzer.js`
2. Create new chart types in `log-visualizer.js`
3. Add filter controls in `log-controls.js`

## Integration with Your Workflow

### During Development
- Run the dashboard alongside your server
- Monitor error patterns during testing
- Use export reports for bug documentation

### In Production
- Set up dedicated monitoring instances
- Use automated alerting for critical patterns
- Generate daily health reports

### Post-Deployment
- Analyze logs after incidents
- Identify performance bottlenecks
- Plan optimization efforts based on recommendations

## License

This tool is part of the Lambic game project. Built following the MapModeler architecture pattern.
