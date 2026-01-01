// Log Analysis Dashboard - Data Manager
// Handles data ingestion, WebSocket connections, and data filtering

class LogDataManager {
    constructor() {
        this.logEntries = [];
        this.metricsData = {};
        this.filters = {
            timeRange: 'all',
            categories: [], // Empty means show all categories
            severity: [], // Empty means show all severity levels
            searchText: '',
            startTime: null,
            endTime: null,
            // Granular kill-specific filters
            killFilters: {
                killer: [],      // Filter by specific killers
                victim: [],      // Filter by victim types
                weapon: [],      // Filter by weapons used
                location: null,  // Location-based filtering
                timeOfDay: [],   // Hour ranges (0-23)
                dayOfWeek: [],   // Days of week (0-6)
                customField: {}  // Dynamic fields from JSON
            }
        };
        this.isConnected = false;
        this.websocket = null;
        this.fileInput = null;
        this.lastUpdate = new Date();

        this.setupWebSocket();
        this.setupFileInput();
    }

    // WebSocket connection to server telemetry
    // Note: Server doesn't currently expose a telemetry WebSocket endpoint
    setupWebSocket() {
        // Server doesn't have a telemetry WebSocket endpoint
        // This is a placeholder for future implementation
        console.log('Note: Live telemetry connection not available - server needs WebSocket telemetry endpoint');

        // Mark as not connected since we can't connect
        this.isConnected = false;
        this.updateConnectionStatus();
    }

    // Disconnect from WebSocket
    disconnectWebSocket() {
        if (this.websocket) {
            console.log('Disconnecting from server telemetry...');
            this.websocket.close(1000, 'User disconnected'); // 1000 = normal closure
            this.websocket = null;
        }
        this.isConnected = false;
        this.updateConnectionStatus();
    }

    // File input for offline analysis
    setupFileInput() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.log,.txt,.json';
        input.style.display = 'none';
        document.body.appendChild(input);
        this.fileInput = input;
    }

    // Process incoming telemetry data
    processIncomingData(data) {
        if (data.type === 'log') {
            // Individual log entry
            const entry = this.parseLogEntry(data);
            if (entry) {
                this.logEntries.push(entry);
                this.lastUpdate = new Date();
            }
        } else if (data.type === 'metrics') {
            // Metrics snapshot
            this.metricsData = { ...this.metricsData, ...data.metrics };
            this.lastUpdate = new Date();
        } else if (data.type === 'health') {
            // System health data
            this.metricsData.health = data.health;
            this.lastUpdate = new Date();
        } else if (data.type === 'bulk_logs') {
            // Bulk log entries
            if (Array.isArray(data.entries)) {
                data.entries.forEach(entry => {
                    const parsed = this.parseLogEntry(entry);
                    if (parsed) {
                        this.logEntries.push(parsed);
                    }
                });
            }
            this.lastUpdate = new Date();
        }

        // Keep log entries bounded (max 10,000 entries)
        if (this.logEntries.length > 10000) {
            this.logEntries = this.logEntries.slice(-5000);
        }

        this.applyFilters();
        this.notifyDataUpdate();
    }

    // Parse individual log entry
    parseLogEntry(data) {
        try {
            if (typeof data === 'string') {
                return this.parseLogLine(data);
            } else if (data.timestamp && data.message) {
                return {
                    timestamp: new Date(data.timestamp),
                    level: data.level || 'info',
                    category: data.category || 'unknown',
                    message: data.message,
                    source: data.source || 'server',
                    raw: data.raw || data.message,
                    context: data.context || {}
                };
            }
        } catch (error) {
            console.warn('Failed to parse log entry:', error);
        }
        return null;
    }

    // Parse log line from string format: [HH:MM:SS] [LEVEL] [CATEGORY] message
    parseLogLine(line) {
        if (typeof line !== 'string' || !line.trim()) return null;

        // Parse timestamp format: [HH:MM:SS]
        const timestampMatch = line.match(/\[(\d{1,2}:\d{1,2}:\d{1,2})\]/); // Allow 1-2 digits for flexibility
        const levelMatch = line.match(/\[([A-Z][A-Z]*)\]/); // Allow multiple uppercase letters
        const categoryMatch = line.match(/\[([A-Za-z][A-Za-z]*)\]/); // Allow alphanumeric category names

        if (timestampMatch && levelMatch && categoryMatch) {
            // Create timestamp for today with the time from the log
            const today = new Date();
            const timeParts = timestampMatch[1].split(':');
            today.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), parseInt(timeParts[2]), 0);

            return {
                timestamp: today,
                level: levelMatch[1].toLowerCase(),
                category: categoryMatch[1].toLowerCase(),
                message: line.replace(/^\[.*?\]\s*\[.*?\]\s*\[.*?\]\s*/, ''),
                source: 'file',
                raw: line
            };
        }

        // Fallback: try to parse JSON
        try {
            const jsonData = JSON.parse(line);
            return this.parseLogEntry(jsonData);
        } catch {
            // Not JSON, try alternative log formats
            return this.tryAlternativeParsing(line);
        }
    }

    // Try alternative log parsing formats
    tryAlternativeParsing(line) {
        // Try format: HH:MM:SS LEVEL CATEGORY message
        const altMatch = line.match(/^(\d{1,2}:\d{1,2}:\d{1,2})\s+(\w+)\s+(\w+)\s+(.+)$/);
        if (altMatch) {
            const [, timeStr, level, category, message] = altMatch;
            const today = new Date();
            const timeParts = timeStr.split(':');
            today.setHours(parseInt(timeParts[0]), parseInt(timeParts[1] || 0), parseInt(timeParts[2] || 0), 0);

            return {
                timestamp: today,
                level: level.toLowerCase(),
                category: category.toLowerCase(),
                message: message,
                source: 'file',
                raw: line
            };
        }

        // Try format: [timestamp] level - message (common Node.js format)
        const nodeMatch = line.match(/\[([^\]]+)\]\s+(\w+)\s+-\s+(.+)/);
        if (nodeMatch) {
            const [, timestampStr, level, message] = nodeMatch;
            let timestamp;
            try {
                timestamp = new Date(timestampStr);
                if (isNaN(timestamp.getTime())) {
                    // If parsing fails, use current time
                    timestamp = new Date();
                }
            } catch {
                timestamp = new Date();
            }

            return {
                timestamp: timestamp,
                level: level.toLowerCase(),
                category: 'unknown',
                message: message,
                source: 'file',
                raw: line
            };
        }

        // Try format: timestamp level message (simple format)
        const simpleMatch = line.match(/^([^\s]+)\s+(\w+)\s+(.+)/);
        if (simpleMatch) {
            const [, timestampStr, level, message] = simpleMatch;
            let timestamp;
            try {
                timestamp = new Date(timestampStr);
                if (isNaN(timestamp.getTime())) {
                    timestamp = new Date();
                }
            } catch {
                timestamp = new Date();
            }

            return {
                timestamp: timestamp,
                level: level.toLowerCase(),
                category: 'unknown',
                message: message,
                source: 'file',
                raw: line
            };
        }

        // Final fallback: treat any non-empty line as a log entry
        // This handles server console output and other unstructured logs
        if (line.trim()) {
            return {
                timestamp: new Date(),
                level: 'info',
                category: 'server',
                message: line.trim(),
                source: 'file',
                raw: line
            };
        }

        // If no format matches, skip this line
        return null;
    }

    // Load log files for analysis
    async loadLogFiles(files) {
        console.log(`Loading ${files.length} log files...`);

        for (const file of files) {
            try {
                const content = await file.text();
                const entries = this.parseLogFile(content, file.name);
                this.logEntries.push(...entries);
                console.log(`Loaded ${entries.length} entries from ${file.name}`);
            } catch (error) {
                console.warn(`Failed to load file ${file.name}:`, error);
            }
        }

        this.applyFilters();
        this.notifyDataUpdate();
        console.log(`Total entries loaded: ${this.logEntries.length}`);
    }

    // Parse different log formats
    parseLogFile(content, filename) {
        const entries = [];
        const lines = content.split('\n');

        let parsedCount = 0;
        let failedCount = 0;
        const categoryCounts = {};
        const levelCounts = {};

        for (const line of lines) {
            if (line.trim()) {
                const entry = this.parseLogLine(line);
                if (entry) {
                    entry.source = filename;
                    parsedCount++;
                    categoryCounts[entry.category] = (categoryCounts[entry.category] || 0) + 1;
                    levelCounts[entry.level] = (levelCounts[entry.level] || 0) + 1;
                    entries.push(entry);
                } else {
                    failedCount++;
                }
            }
        }

        console.log('Parsing summary:', {
            totalLines: lines.length,
            parsed: parsedCount,
            failed: failedCount,
            categories: categoryCounts,
            levels: levelCounts
        });
        return entries;
    }

    // Apply current filters
    applyFilters() {
        let filtered = [...this.logEntries];

        // Time range filter
        if (this.filters.timeRange !== 'all') {
            const now = new Date();
            let timeLimit;

            if (this.filters.timeRange === 'custom' && this.filters.startTime && this.filters.endTime) {
                // Custom time range
                filtered = filtered.filter(entry =>
                    entry.timestamp >= this.filters.startTime &&
                    entry.timestamp <= this.filters.endTime
                );
            } else {
                // Quick time range
                timeLimit = this.getTimeLimit(this.filters.timeRange);
                filtered = filtered.filter(entry =>
                    entry.timestamp > new Date(now - timeLimit)
                );
            }
        }

        // Category filter
        // Category filter
        if (this.filters.categories.length > 0) {
            console.log('Applying category filter, allowed categories:', this.filters.categories);
            const beforeCategoryFilter = filtered.length;
            filtered = filtered.filter(entry => {
                const included = this.filters.categories.includes(entry.category);
                if (!included) {
                    console.log('Filtering out entry with category:', entry.category, 'entry:', entry);
                }
                return included;
            });
            console.log('Category filter: before =', beforeCategoryFilter, 'after =', filtered.length);
        }

        // Severity filter
        if (this.filters.severity.length > 0) {
            console.log('Applying severity filter, allowed levels:', this.filters.severity);
            const beforeSeverityFilter = filtered.length;
            filtered = filtered.filter(entry => {
                const included = this.filters.severity.includes(entry.level);
                if (!included) {
                    console.log('Filtering out entry with level:', entry.level, 'entry:', entry);
                }
                return included;
            });
            console.log('Severity filter: before =', beforeSeverityFilter, 'after =', filtered.length);
        }

        // Granular kill filters
        if (this.hasActiveKillFilters()) {
            console.log('Applying granular kill filters:', this.filters.killFilters);
            const beforeKillFilter = filtered.length;

            filtered = filtered.filter(entry => {
                // Only apply kill filters to entries that have kill data
                if (!entry.killData) return true;

                const data = entry.killData;

                // Killer filter
                if (this.filters.killFilters.killer.length > 0 &&
                    !this.filters.killFilters.killer.includes(data.killer)) {
                    return false;
                }

                // Victim filter
                if (this.filters.killFilters.victim.length > 0 &&
                    !this.filters.killFilters.victim.includes(data.victim)) {
                    return false;
                }

                // Weapon filter
                if (this.filters.killFilters.weapon.length > 0 &&
                    (!data.weapon || !this.filters.killFilters.weapon.includes(data.weapon))) {
                    return false;
                }

                // Time of day filter
                if (this.filters.killFilters.timeOfDay.length > 0) {
                    const hour = entry.timestamp.getHours();
                    if (!this.filters.killFilters.timeOfDay.includes(hour)) {
                        return false;
                    }
                }

                // Day of week filter
                if (this.filters.killFilters.dayOfWeek.length > 0) {
                    const day = entry.timestamp.getDay();
                    if (!this.filters.killFilters.dayOfWeek.includes(day)) {
                        return false;
                    }
                }

                // Custom field filters
                for (const [field, values] of Object.entries(this.filters.killFilters.customField)) {
                    if (values.length > 0 && !values.includes(data[field])) {
                        return false;
                    }
                }

                return true;
            });

            console.log('Kill filter: before =', beforeKillFilter, 'after =', filtered.length);
        }

        // Search filter
        if (this.filters.searchText) {
            const search = this.filters.searchText.toLowerCase();
            filtered = filtered.filter(entry =>
                entry.message.toLowerCase().includes(search) ||
                entry.category.toLowerCase().includes(search) ||
                entry.level.toLowerCase().includes(search)
            );
        }

        this.filteredEntries = filtered;
        return filtered;
    }

    // Check if any kill filters are active
    hasActiveKillFilters() {
        const kf = this.filters.killFilters;
        return (
            kf.killer.length > 0 ||
            kf.victim.length > 0 ||
            kf.weapon.length > 0 ||
            kf.timeOfDay.length > 0 ||
            kf.dayOfWeek.length > 0 ||
            Object.values(kf.customField).some(arr => arr.length > 0)
        );
    }

    // Update filters and refresh data
    updateFilters(newFilters) {
        this.filters = { ...this.filters, ...newFilters };
        this.applyFilters();
        this.notifyDataUpdate();
    }

    // Get time limit in milliseconds
    getTimeLimit(range) {
        const multipliers = {
            '5m': 5 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000
        };
        return multipliers[range] || 24 * 60 * 60 * 1000; // Default to 24h
    }

    // Get metrics snapshot
    getMetricsSnapshot() {
        return {
            ...this.metricsData,
            logCount: this.logEntries.length,
            filteredCount: this.filteredEntries ? this.filteredEntries.length : 0,
            lastUpdate: this.lastUpdate,
            connectionStatus: this.isConnected
        };
    }

    // Clear all data
    clearAllData() {
        this.logEntries = [];
        this.metricsData = {};
        this.filteredEntries = [];
        this.lastUpdate = new Date();
        this.notifyDataUpdate();
    }

    // Get error statistics
    getErrorStats(timeWindow = 60 * 60 * 1000) {
        const now = new Date();
        const cutoff = new Date(now - timeWindow);
        const recentEntries = this.filteredEntries.filter(entry => entry.timestamp > cutoff);

        const errorEntries = recentEntries.filter(entry =>
            ['error', 'critical'].includes(entry.level)
        );

        const stats = {
            total: errorEntries.length,
            byCategory: {},
            byLevel: {},
            timeWindow: timeWindow,
            averageRate: errorEntries.length / (timeWindow / 1000 / 60 / 60) // errors per hour
        };

        // Group by category
        errorEntries.forEach(entry => {
            stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1;
            stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1;
        });

        return stats;
    }

    // Notify listeners of data updates
    notifyDataUpdate() {
        const event = new CustomEvent('dataUpdated', {
            detail: {
                entries: this.filteredEntries,
                metrics: this.getMetricsSnapshot()
            }
        });
        document.dispatchEvent(event);

        // Update status display
        this.updateStatusDisplay();
    }

    // Update connection status display
    updateConnectionStatus() {
        const statusEl = document.getElementById('connection-status');
        if (statusEl) {
            statusEl.textContent = this.isConnected ? 'Connected' : 'Offline Mode';
            statusEl.className = this.isConnected ? 'connected' : 'disconnected';
        }

        // Update connect/disconnect button states
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');

        if (connectBtn) {
            connectBtn.textContent = this.isConnected ? 'Connected' : 'Connect to Server';
            connectBtn.disabled = this.isConnected;
        }

        if (disconnectBtn) {
            disconnectBtn.style.display = this.isConnected ? 'inline-block' : 'none';
        }
    }

    // Update status bar information
    updateStatusDisplay() {
        const lastUpdateEl = document.getElementById('last-update');
        const dataPointsEl = document.getElementById('data-points');

        if (lastUpdateEl) {
            lastUpdateEl.textContent = this.lastUpdate.toLocaleTimeString();
        }

        if (dataPointsEl) {
            const count = this.filteredEntries ? this.filteredEntries.length : 0;
            dataPointsEl.textContent = count.toLocaleString();
        }
    }

    // Export data for analysis
    exportData() {
        return {
            logEntries: this.logEntries,
            filteredEntries: this.filteredEntries,
            metrics: this.metricsData,
            filters: this.filters,
            timestamp: new Date().toISOString()
        };
    }
}
