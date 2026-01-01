// Log Analysis Dashboard - Controls
// Handles UI controls, user interactions, and filter management

class LogControls {
    constructor() {
        this.dataManager = null;
        this.paused = false;
        this.initializeFilters();
        this.setupEventListeners();
    }

    setDataManager(dataManager) {
        this.dataManager = dataManager;
    }

    setupEventListeners() {
        // Connect button
        const connectBtn = document.getElementById('connect-btn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.connectToServer();
            });
        }

        // Disconnect button
        const disconnectBtn = document.getElementById('disconnect-btn');
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                this.disconnectFromServer();
            });
        }

        // Load logs button - now opens the data input modal
        const loadLogsBtn = document.getElementById('load-logs-btn');
        if (loadLogsBtn) {
            loadLogsBtn.addEventListener('click', () => {
                this.showDataInputModal();
            });
        }

        // Export report button
        const exportBtn = document.getElementById('export-report-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.showExportModal();
            });
        }

        // Clear data button
        const clearBtn = document.getElementById('clear-data-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearAllData();
            });
        }

        // Reset charts button
        const resetChartsBtn = document.getElementById('reset-charts-btn');
        if (resetChartsBtn) {
            resetChartsBtn.addEventListener('click', () => {
                this.resetCharts();
            });
        }

        // Filter controls
        this.setupFilterListeners();

        // Log controls
        this.setupLogControls();

        // Data input modal
        this.setupDataInputModal();
    }

    connectToServer() {
        alert('Live telemetry connection is not currently available.\n\nThe server needs a WebSocket telemetry endpoint to enable real-time monitoring.\n\nUse "Load Data" to import log files or paste log text for analysis.');

        // Update button text to indicate limitation
        const connectBtn = document.getElementById('connect-btn');
        if (connectBtn) {
            connectBtn.textContent = 'Live Connection Unavailable';
            connectBtn.disabled = true;

            // Re-enable after showing message
            setTimeout(() => {
                connectBtn.textContent = 'Connect to Server';
                connectBtn.disabled = false;
            }, 100);
        }
    }

    disconnectFromServer() {
        if (this.dataManager) {
            this.dataManager.disconnectWebSocket();
        }
    }

    loadLogFiles() {
        if (this.dataManager && this.dataManager.fileInput) {
            this.dataManager.fileInput.click();
        } else {
            alert('File input not available');
        }
    }

    setupFilterListeners() {
        // Time range selector
        const timeRangeSelect = document.getElementById('time-range');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', (e) => {
                this.handleTimeRangeChange(e.target.value);
            });
        }

        // Custom time range inputs
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');

        if (startTimeInput) {
            startTimeInput.addEventListener('change', () => {
                this.updateCustomTimeRange();
            });
        }

        if (endTimeInput) {
            endTimeInput.addEventListener('change', () => {
                this.updateCustomTimeRange();
            });
        }

        // Category checkboxes
        const categoryCheckboxes = document.querySelectorAll('input[type="checkbox"][value]');
        categoryCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateCategoryFilters();
            });
        });

        // Search input
        const searchBtn = document.getElementById('search-btn');
        const searchText = document.getElementById('search-text');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performSearch();
            });
        }

        if (searchText) {
            searchText.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch();
                }
            });
        }

        // Kill filter controls
        this.setupKillFilterControls();
    }

    setupLogControls() {
        // Auto-scroll toggle
        const autoScrollBtn = document.getElementById('auto-scroll-btn');
        if (autoScrollBtn) {
            autoScrollBtn.addEventListener('click', () => {
                this.toggleAutoScroll();
            });
        }

        // Pause/Resume updates
        const pauseBtn = document.getElementById('pause-updates-btn');
        if (pauseBtn) {
            pauseBtn.addEventListener('click', () => {
                this.togglePause();
            });
        }
    }

    setupDataInputModal() {
        // Modal elements
        this.dataInputModal = document.getElementById('data-input-modal');
        this.selectedFiles = [];

        // Tab switching
        const fileTab = document.getElementById('file-tab');
        const pasteTab = document.getElementById('paste-tab');

        if (fileTab) {
            fileTab.addEventListener('click', () => this.switchToTab('file'));
        }
        if (pasteTab) {
            pasteTab.addEventListener('click', () => this.switchToTab('paste'));
        }

        // File input handling
        this.setupFileInputHandling();

        // Process data button
        const processBtn = document.getElementById('process-data-btn');
        if (processBtn) {
            processBtn.addEventListener('click', () => {
                this.processDataInput();
            });
        }

        // Cancel button
        const cancelBtn = document.getElementById('cancel-input-btn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.hideDataInputModal();
            });
        }

        // Modal close handlers
        if (this.dataInputModal) {
            const closeBtn = this.dataInputModal.querySelector('.close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    this.hideDataInputModal();
                });
            }

            // Close on outside click
            this.dataInputModal.addEventListener('click', (e) => {
                if (e.target === this.dataInputModal) {
                    this.hideDataInputModal();
                }
            });

            // Close on Escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.dataInputModal.style.display === 'block') {
                    this.hideDataInputModal();
                }
            });
        }

        // Allow Enter key to process in paste mode (Ctrl+Enter for multi-line)
        const textarea = document.getElementById('paste-textarea');
        if (textarea) {
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    this.processDataInput();
                }
            });
        }
    }

    handleTimeRangeChange(range) {
        const customRangeDiv = document.getElementById('custom-time-range');

        if (range === 'custom') {
            if (customRangeDiv) {
                customRangeDiv.classList.remove('hidden');
            }
            // Don't update filters yet - wait for custom time selection
        } else {
            if (customRangeDiv) {
                customRangeDiv.classList.add('hidden');
            }
            this.updateFilters({ timeRange: range });
        }
    }

    updateCustomTimeRange() {
        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');

        if (startTimeInput && endTimeInput) {
            const startTime = startTimeInput.value ? new Date(startTimeInput.value) : null;
            const endTime = endTimeInput.value ? new Date(endTimeInput.value) : null;

            if (startTime && endTime && startTime < endTime) {
                this.updateFilters({
                    timeRange: 'custom',
                    startTime: startTime,
                    endTime: endTime
                });
            }
        }
    }

    updateCategoryFilters() {
        const categories = Array.from(document.querySelectorAll('input[type="checkbox"][value]:checked'))
                               .map(cb => cb.value);

        // Map UI categories to data manager categories
        const categoryMap = {
            'combat': 'combat',
            'network': 'network',
            'memory': 'memory',
            'entity': 'entity',
            'pathfinding': 'pathfinding',
            'database': 'database'
        };

        const dataCategories = categories.map(cat => categoryMap[cat] || cat);
        this.updateFilters({ categories: dataCategories });
    }

    performSearch() {
        const searchText = document.getElementById('search-text');
        if (searchText) {
            const searchValue = searchText.value.trim();
            this.updateFilters({ searchText: searchValue });
        }
    }

    updateFilters(newFilters) {
        if (this.dataManager) {
            this.dataManager.updateFilters(newFilters);
        }
    }

    toggleAutoScroll() {
        const visualizer = window.visualizer;
        if (visualizer) {
            const isEnabled = visualizer.toggleAutoScroll();
            const autoScrollBtn = document.getElementById('auto-scroll-btn');

            if (autoScrollBtn) {
                autoScrollBtn.textContent = isEnabled ? 'Auto-scroll' : 'Manual scroll';
                autoScrollBtn.classList.toggle('active', isEnabled);
            }
        }
    }

    togglePause() {
        this.paused = !this.paused;
        const pauseBtn = document.getElementById('pause-updates-btn');

        if (pauseBtn) {
            pauseBtn.textContent = this.paused ? 'Resume' : 'Pause';
            pauseBtn.classList.toggle('active', this.paused);
        }

        // Note: In a real implementation, you'd want to pause/resume data updates
        // For now, this just updates the UI
    }

    showExportModal() {
        const modal = document.getElementById('export-modal');
        const exportText = document.getElementById('export-text');

        if (!modal || !exportText) return;

        // Generate export content
        let exportContent = this.generateExportReport();

        exportText.value = exportContent;
        modal.style.display = 'block';

        // Setup modal close
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
            };
        }

        // Close modal when clicking outside
        window.onclick = (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    }

    generateExportReport() {
        if (!this.dataManager) return 'No data available';

        const metrics = this.dataManager.getMetricsSnapshot();
        const errorStats = this.dataManager.getErrorStats();
        const visualizer = window.visualizer;

        let report = `LOG ANALYSIS REPORT\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;

        report += `SUMMARY\n`;
        report += `========\n`;
        report += `Total Log Entries: ${metrics.logCount || 0}\n`;
        report += `Filtered Entries: ${metrics.filteredCount || 0}\n`;
        report += `Connection Status: ${metrics.connectionStatus ? 'Connected' : 'Disconnected'}\n`;
        report += `Last Update: ${metrics.lastUpdate ? metrics.lastUpdate.toLocaleString() : 'Never'}\n\n`;

        report += `ERROR STATISTICS (Last Hour)\n`;
        report += `=============================\n`;
        report += `Total Errors: ${errorStats.total}\n`;
        report += `Error Rate: ${errorStats.averageRate.toFixed(2)} errors/hour\n\n`;

        if (Object.keys(errorStats.byCategory).length > 0) {
            report += `Errors by Category:\n`;
            Object.entries(errorStats.byCategory)
                  .sort(([,a], [,b]) => b - a)
                  .forEach(([category, count]) => {
                      report += `  ${category}: ${count}\n`;
                  });
            report += '\n';
        }

        if (visualizer) {
            const patterns = visualizer.analyzeErrorPatterns(this.dataManager.filteredEntries);
            if (patterns.length > 0) {
                report += `TOP ERROR PATTERNS\n`;
                report += `===================\n`;
                patterns.slice(0, 10).forEach((pattern, index) => {
                    report += `${index + 1}. ${pattern.category}: ${pattern.message}\n`;
                    report += `   Occurrences: ${pattern.count}\n`;
                    report += `   Recommendation: ${pattern.recommendation}\n\n`;
                });
            }
        }

        report += `SYSTEM HEALTH\n`;
        report += `=============\n`;
        if (metrics.health) {
            report += `Overall Status: ${metrics.health.overall || 'Unknown'}\n`;
            if (metrics.health.recommendations) {
                report += `Recommendations:\n`;
                metrics.health.recommendations.forEach(rec => {
                    report += `  - ${rec.action}\n`;
                });
            }
        } else {
            report += `No health data available\n`;
        }
        report += '\n';

        report += `CURRENT FILTERS\n`;
        report += `===============\n`;
        report += `Time Range: ${this.dataManager.filters.timeRange}\n`;
        report += `Categories: ${this.dataManager.filters.categories.join(', ')}\n`;
        report += `Severity Levels: ${this.dataManager.filters.severity.join(', ')}\n`;
        if (this.dataManager.filters.searchText) {
            report += `Search Text: "${this.dataManager.filters.searchText}"\n`;
        }

        return report;
    }

    clearAllData() {
        if (confirm('Are you sure you want to clear all log data? This cannot be undone.')) {
            if (this.dataManager) {
                this.dataManager.clearAllData();
            }
        }
    }

    resetCharts() {
        if (confirm('Reset all chart data? This will clear the performance and error trend graphs.')) {
            if (window.visualizer) {
                window.visualizer.resetChartData();
                alert('Charts have been reset.');
            }
        }
    }

    initializeFilters() {
        // Set default custom time range to last 24 hours
        const now = new Date();
        const yesterday = new Date(now - 24 * 60 * 60 * 1000);

        const startTimeInput = document.getElementById('start-time');
        const endTimeInput = document.getElementById('end-time');

        if (startTimeInput) {
            startTimeInput.value = yesterday.toISOString().slice(0, 16);
        }

        if (endTimeInput) {
            endTimeInput.value = now.toISOString().slice(0, 16);
        }
    }

    // Modal management methods
    showDataInputModal() {
        if (this.dataInputModal) {
            // Reset to file tab by default
            this.switchToTab('file');
            // Clear any previous state
            this.selectedFiles = [];
            this.updateFileList();
            const textarea = document.getElementById('paste-textarea');
            if (textarea) textarea.value = '';

            this.dataInputModal.style.display = 'block';
        }
    }

    hideDataInputModal() {
        if (this.dataInputModal) {
            this.dataInputModal.style.display = 'none';
            this.selectedFiles = [];
        }
    }

    switchToTab(tabName) {
        const fileTab = document.getElementById('file-tab');
        const pasteTab = document.getElementById('paste-tab');
        const fileSection = document.getElementById('file-input-section');
        const pasteSection = document.getElementById('paste-input-section');

        if (tabName === 'file') {
            fileTab.classList.add('active');
            pasteTab.classList.remove('active');
            fileSection.classList.remove('hidden');
            pasteSection.classList.add('hidden');
        } else if (tabName === 'paste') {
            pasteTab.classList.add('active');
            fileTab.classList.remove('active');
            pasteSection.classList.remove('hidden');
            fileSection.classList.add('hidden');
        }
    }

    setupFileInputHandling() {
        const dropZone = document.getElementById('file-drop-zone');
        const browseBtn = document.getElementById('browse-files-btn');

        // Browse button click
        if (browseBtn) {
            browseBtn.addEventListener('click', () => {
                this.triggerFileInput();
            });
        }

        // Drag and drop handling
        if (dropZone) {
            dropZone.addEventListener('click', () => {
                this.triggerFileInput();
            });

            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            });

            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('dragover');
            });

            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');

                const files = Array.from(e.dataTransfer.files);
                this.addFiles(files);
            });
        }
    }

    triggerFileInput() {
        // Create a temporary file input
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.log,.txt,.json';

        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            this.addFiles(files);
        });

        input.click();
    }

    addFiles(files) {
        // Filter for allowed file types
        const allowedExtensions = ['.log', '.txt', '.json'];
        const validFiles = files.filter(file => {
            const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
            return allowedExtensions.includes(extension);
        });

        if (validFiles.length !== files.length) {
            alert(`${files.length - validFiles.length} file(s) were skipped due to unsupported format. Only .log, .txt, and .json files are supported.`);
        }

        // Add valid files to selection
        validFiles.forEach(file => {
            if (!this.selectedFiles.some(f => f.name === file.name && f.size === file.size)) {
                this.selectedFiles.push(file);
            }
        });

        this.updateFileList();
    }

    updateFileList() {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;

        fileList.innerHTML = '';

        if (this.selectedFiles.length === 0) {
            fileList.innerHTML = '<div class="no-files">No files selected</div>';
            return;
        }

        this.selectedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            const size = this.formatFileSize(file.size);

            fileItem.innerHTML = `
                <span class="file-item-name">${file.name}</span>
                <span class="file-item-size">${size}</span>
                <button class="file-item-remove" data-index="${index}">×</button>
            `;

            // Remove button handler
            const removeBtn = fileItem.querySelector('.file-item-remove');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeFile(index);
            });

            fileList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.selectedFiles.splice(index, 1);
        this.updateFileList();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    processDataInput() {
        const activeTab = document.querySelector('.tab-btn.active');
        if (!activeTab) return;

        const tabId = activeTab.id;

        if (tabId === 'file-tab') {
            this.processFileInput();
        } else if (tabId === 'paste-tab') {
            this.processPasteInput();
        }
    }

    processFileInput() {
        if (this.selectedFiles.length === 0) {
            alert('Please select at least one file to process.');
            return;
        }

        console.log(`Processing ${this.selectedFiles.length} selected files...`);
        this.hideDataInputModal();

        // Use the existing loadLogFiles method but with our selected files
        if (this.dataManager) {
            this.dataManager.loadLogFiles(this.selectedFiles).then(() => {
                alert(`Successfully processed ${this.selectedFiles.length} file(s)!`);
            }).catch(error => {
                console.error('Error processing files:', error);
                alert('Error processing files. Please check the console for details.');
            });
        }
    }

    processPasteInput() {
        const textarea = document.getElementById('paste-textarea');
        if (!textarea) return;

        const pastedText = textarea.value.trim();

        if (!pastedText) {
            alert('Please paste some log text first.');
            return;
        }

        if (!this.dataManager) {
            alert('Data manager not initialized');
            return;
        }

        console.log('Processing pasted log text...');

        try {
            console.log('About to parse pasted text, length:', pastedText.length);

            // Parse the pasted text as if it were a file
            const entries = this.dataManager.parseLogFile(pastedText, 'pasted-text');

            console.log('Parsing complete, found entries:', entries.length);

            if (entries.length === 0) {
                alert('No valid log entries found in the pasted text. Please check the format.\n\nExpected format: [HH:MM:SS] [LEVEL] [CATEGORY] message');
                return;
            }

            console.log('Adding entries to dataManager...');
            // Add entries to the data manager
            this.dataManager.logEntries.push(...entries);

            console.log('Applying filters...');
            this.dataManager.applyFilters();

            console.log('Notifying data update...');
            this.dataManager.notifyDataUpdate();

            // Populate kill filter dropdowns with available data
            this.populateKillFilters();

            console.log('Hiding modal...');
            // Hide modal and show success message
            this.hideDataInputModal();

            console.log('Process complete!');
            alert(`Successfully processed ${entries.length} log entries!`);

        } catch (error) {
            console.error('Error processing pasted logs:', error);
            alert('Error processing pasted logs. Please check the console for details.');
        }
    }

    // Setup kill filter controls
    setupKillFilterControls() {
        // Hour range controls
        const hourStart = document.getElementById('hour-start');
        const hourEnd = document.getElementById('hour-end');
        const hourDisplay = document.getElementById('hour-range-display');

        if (hourStart && hourEnd && hourDisplay) {
            const updateHourDisplay = () => {
                const start = parseInt(hourStart.value);
                const end = parseInt(hourEnd.value);
                hourDisplay.textContent = `${start.toString().padStart(2, '0')}:00 - ${end.toString().padStart(2, '0')}:59`;
            };

            hourStart.addEventListener('input', updateHourDisplay);
            hourEnd.addEventListener('input', updateHourDisplay);
            updateHourDisplay(); // Initial display
        }

        // Apply kill filters button
        const applyBtn = document.getElementById('apply-kill-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyKillFilters();
            });
        }

        // Clear kill filters button
        const clearBtn = document.getElementById('clear-kill-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearKillFilters();
            });
        }

        // Export kill analysis button
        const exportBtn = document.getElementById('export-kill-analysis');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportKillAnalysis();
            });
        }

        // Time range filter
        const timeRangeFilter = document.getElementById('time-range-filter');
        if (timeRangeFilter) {
            timeRangeFilter.addEventListener('change', () => {
                this.updateTimeRangeFilter();
            });
        }
    }

    // Apply kill filters
    applyKillFilters() {
        if (!this.dataManager) return;

        const killerFilter = document.getElementById('killer-filter');
        const victimFilter = document.getElementById('victim-filter');
        const weaponFilter = document.getElementById('weapon-filter');
        const hourStart = document.getElementById('hour-start');
        const hourEnd = document.getElementById('hour-end');

        // Get selected values
        const killers = killerFilter ? Array.from(killerFilter.selectedOptions).map(opt => opt.value).filter(v => v) : [];
        const victims = victimFilter ? Array.from(victimFilter.selectedOptions).map(opt => opt.value).filter(v => v) : [];
        const weapons = weaponFilter ? Array.from(weaponFilter.selectedOptions).map(opt => opt.value).filter(v => v) : [];

        // Get hour range
        const timeOfDay = [];
        if (hourStart && hourEnd) {
            const start = parseInt(hourStart.value);
            const end = parseInt(hourEnd.value);
            for (let h = start; h <= end; h++) {
                timeOfDay.push(h);
            }
        }

        // Update filters
        this.dataManager.updateFilters({
            killFilters: {
                killer: killers,
                victim: victims,
                weapon: weapons,
                timeOfDay: timeOfDay,
                dayOfWeek: [], // Not implemented in UI yet
                customField: {}
            }
        });

        console.log('Applied kill filters:', { killers, victims, weapons, timeOfDay });
    }

    // Clear kill filters
    clearKillFilters() {
        // Reset select elements
        const killerFilter = document.getElementById('killer-filter');
        const victimFilter = document.getElementById('victim-filter');
        const weaponFilter = document.getElementById('weapon-filter');
        const hourStart = document.getElementById('hour-start');
        const hourEnd = document.getElementById('hour-end');

        if (killerFilter) killerFilter.selectedIndex = -1;
        if (victimFilter) victimFilter.selectedIndex = -1;
        if (weaponFilter) weaponFilter.selectedIndex = -1;
        if (hourStart) hourStart.value = 0;
        if (hourEnd) hourEnd.value = 23;

        // Update hour display
        const hourDisplay = document.getElementById('hour-range-display');
        if (hourDisplay) hourDisplay.textContent = '00:00 - 23:59';

        // Clear filters in data manager
        this.dataManager.updateFilters({
            killFilters: {
                killer: [],
                victim: [],
                weapon: [],
                timeOfDay: [],
                dayOfWeek: [],
                customField: {}
            }
        });

        console.log('Cleared kill filters');
    }

    // Update time range filter
    updateTimeRangeFilter() {
        const timeRangeFilter = document.getElementById('time-range-filter');
        if (!timeRangeFilter || !this.dataManager) return;

        const value = timeRangeFilter.value;
        let timeRange = 'all';

        switch (value) {
            case 'hour':
                timeRange = '1h';
                break;
            case 'day':
                timeRange = '24h';
                break;
            case 'week':
                timeRange = '7d';
                break;
            case 'custom':
                // Custom range would be handled separately
                break;
            default:
                timeRange = 'all';
        }

        this.dataManager.updateFilters({ timeRange });
        console.log('Updated time range filter:', timeRange);
    }

    // Export kill analysis
    exportKillAnalysis() {
        if (!this.dataManager || !this.analyzer) {
            alert('No data available for export');
            return;
        }

        try {
            const analysis = this.analyzer.analyzeKillDataGranular(this.dataManager.filteredEntries);

            // Create workbook
            const wb = XLSX.utils.book_new();

            // Killers sheet
            const killerData = Object.entries(analysis.killerStats).map(([killer, stats]) => ({
                Killer: killer,
                TotalKills: stats.totalKills,
                UniqueVictims: Object.keys(stats.victims).length,
                UniqueWeapons: Object.keys(stats.weapons).length,
                UniqueLocations: Object.keys(stats.locations).length,
                AvgTimeBetweenKills: stats.avgTimeBetweenKills ? stats.avgTimeBetweenKills.toFixed(2) + 's' : 'N/A'
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(killerData), 'Killers');

            // Hourly breakdown
            const hourlyData = Object.entries(analysis.hourlyBreakdown).map(([hour, data]) => ({
                Hour: hour,
                TotalKills: data.total,
                UniqueKillers: Object.keys(data.byKiller).length,
                UniqueVictims: Object.keys(data.byVictim).length
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hourlyData), 'Hourly');

            // Weapons analysis
            const weaponData = Object.entries(analysis.weaponStats).map(([weapon, stats]) => ({
                Weapon: weapon,
                TotalKills: stats.totalKills,
                UniqueKillers: Object.keys(stats.killers).length,
                UniqueVictims: Object.keys(stats.victims).length,
                UniqueLocations: Object.keys(stats.locations).length
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(weaponData), 'Weapons');

            // Victims analysis
            const victimData = Object.entries(analysis.victimStats).map(([victim, stats]) => ({
                Victim: victim,
                TotalDeaths: stats.totalDeaths,
                UniqueKillers: Object.keys(stats.killers).length,
                UniqueWeapons: Object.keys(stats.weapons).length,
                UniqueLocations: Object.keys(stats.locations).length
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(victimData), 'Victims');

            // Download file
            XLSX.writeFile(wb, `kill-analysis-${new Date().toISOString().split('T')[0]}.xlsx`);
            alert('Kill analysis exported successfully!');

        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed: ' + error.message);
        }
    }

    // Populate kill filter dropdowns with available data
    populateKillFilters() {
        if (!this.dataManager) return;

        const killEntries = this.dataManager.logEntries.filter(e => e.killData);

        // Get unique values
        const killers = [...new Set(killEntries.map(e => e.killData.killer))].sort();
        const victims = [...new Set(killEntries.map(e => e.killData.victim))].sort();
        const weapons = [...new Set(killEntries.map(e => e.killData.weapon).filter(w => w))].sort();

        // Populate killer filter
        const killerFilter = document.getElementById('killer-filter');
        if (killerFilter) {
            killerFilter.innerHTML = '<option value="">All Killers</option>' +
                killers.map(k => `<option value="${k}">${k}</option>`).join('');
        }

        // Populate victim filter
        const victimFilter = document.getElementById('victim-filter');
        if (victimFilter) {
            victimFilter.innerHTML = '<option value="">All Victims</option>' +
                victims.map(v => `<option value="${v}">${v}</option>`).join('');
        }

        // Populate weapon filter
        const weaponFilter = document.getElementById('weapon-filter');
        if (weaponFilter) {
            weaponFilter.innerHTML = '<option value="">All Weapons</option>' +
                weapons.map(w => `<option value="${w}">${w}</option>`).join('');
        }

        console.log('Populated kill filters:', { killers: killers.length, victims: victims.length, weapons: weapons.length });
    }
}
