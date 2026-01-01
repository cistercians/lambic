// Log Analysis Dashboard - Visualizer
// Handles charts, visualizations, and real-time display updates

class LogVisualizer {
    constructor() {
        this.dataManager = null;
        this.charts = {};
        this.autoScroll = true;
        this.maxLogEntries = 500; // Show last 500 entries
        this.updateInterval = null;
        this.lastPerformanceUpdate = 0; // Throttle performance chart updates
        this.lastErrorTrendsUpdate = 0; // Throttle error trends updates

        this.setupCharts();
        this.setupEventListeners();
        this.startPeriodicUpdates();
    }

    setDataManager(dataManager) {
        this.dataManager = dataManager;
    }

    setAnalyzer(analyzer) {
        this.analyzer = analyzer;
    }

    setupCharts() {
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js not loaded, charts will not be available');
            // Create placeholder elements
            this.createChartPlaceholders();
            return;
        }

        try {
            // Error trends chart
            const errorCtx = document.getElementById('error-trends-chart');
            if (errorCtx) {
                // Set fixed canvas size
                errorCtx.style.height = '200px';
                errorCtx.style.width = '100%';

                this.charts.errorTrends = new Chart(errorCtx, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Errors',
                            data: [],
                            borderColor: '#ff4444',
                            backgroundColor: 'rgba(255, 68, 68, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: false, // Disable responsive to maintain fixed size
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { precision: 0 },
                                title: { display: true, text: 'Error Count' }
                            },
                            x: {
                                display: true,
                                title: { display: true, text: 'Time' }
                            }
                        },
                        plugins: {
                            legend: { display: false }
                        },
                        animation: { duration: 0 }, // Disable animations for real-time updates
                        elements: {
                            point: { radius: 2, hoverRadius: 4 }
                        }
                    }
                });
            }

            // Performance chart
            const perfCtx = document.getElementById('performance-chart');
            if (perfCtx) {
                // Set fixed canvas size
                perfCtx.style.height = '200px';
                perfCtx.style.width = '100%';

                this.charts.performance = new Chart(perfCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'FPS',
                        data: [],
                        borderColor: '#44ff44',
                        backgroundColor: 'rgba(68, 255, 68, 0.1)',
                        yAxisID: 'y',
                        tension: 0.4,
                        fill: false
                    }, {
                        label: 'Frame Time (ms)',
                        data: [],
                        borderColor: '#4444ff',
                        backgroundColor: 'rgba(68, 68, 255, 0.1)',
                        yAxisID: 'y1',
                        tension: 0.4,
                        fill: false
                    }]
                },
                options: {
                    responsive: false, // Disable responsive to maintain fixed size
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: { display: true, text: 'FPS' },
                            beginAtZero: true
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: { display: true, text: 'Frame Time (ms)' },
                            grid: { drawOnChartArea: false },
                            beginAtZero: true
                        }
                    },
                    plugins: {
                        legend: { display: true, position: 'bottom' }
                    },
                    animation: { duration: 0 },
                    elements: {
                        point: { radius: 2, hoverRadius: 4 }
                    }
                }
            });
            }
        } catch (error) {
            console.error('Failed to initialize charts:', error);
            this.createChartPlaceholders();
        }
    }

    createChartPlaceholders() {
        // Create placeholder messages for when charts fail to load
        const errorChartEl = document.getElementById('error-trends-chart');
        if (errorChartEl && !errorChartEl.hasChildNodes()) {
            errorChartEl.style.display = 'flex';
            errorChartEl.style.alignItems = 'center';
            errorChartEl.style.justifyContent = 'center';
            errorChartEl.style.backgroundColor = '#252525';
            errorChartEl.style.color = '#666';
            errorChartEl.style.fontSize = '0.9rem';
            errorChartEl.innerHTML = 'Charts unavailable<br>(Chart.js not loaded)';
        }

        const perfChartEl = document.getElementById('performance-chart');
        if (perfChartEl && !perfChartEl.hasChildNodes()) {
            perfChartEl.style.display = 'flex';
            perfChartEl.style.alignItems = 'center';
            perfChartEl.style.justifyContent = 'center';
            perfChartEl.style.backgroundColor = '#252525';
            perfChartEl.style.color = '#666';
            perfChartEl.style.fontSize = '0.9rem';
            perfChartEl.innerHTML = 'Charts unavailable<br>(Chart.js not loaded)';
        }
    }

    setupEventListeners() {
        document.addEventListener('dataUpdated', (e) => {
            this.updateVisualizations(e.detail);
        });
    }

    startPeriodicUpdates() {
        // Removed periodic chart updates to prevent memory leaks
        // Charts now only update when new data arrives
        this.updateInterval = null;
    }

    updateVisualizations(data) {

        this.updateHealthOverview(data.metrics);
        this.updateCharts();
        this.updateErrorPatterns(data.entries);
        this.updateLogEntries(data.entries);

        // Check if we have kill data for granular analysis
        const hasKillData = data.entries && data.entries.some(e => e.killData);
        if (hasKillData && this.analyzer) {
            console.log('Visualizer: performing granular kill data analysis');
            const analysis = this.analyzer.analyzeKillDataGranular(data.entries);
            this.updateGranularVisualizations(analysis);
        }

        console.log('Visualizer: updateVisualizations completed');
    }

    updateHealthOverview(metrics) {
        // Update server status
        const serverStatus = document.getElementById('server-status');
        if (serverStatus) {
            let status = 'healthy';
            let statusText = 'Healthy';

            if (metrics && metrics.health) {
                status = metrics.health.overall || 'unknown';
                statusText = status.charAt(0).toUpperCase() + status.slice(1);
            }

            serverStatus.innerHTML = `
                <span class="status-dot status-${status}"></span>
                <span>${statusText}</span>
            `;
        }

        // Update active players
        const activePlayers = document.getElementById('active-players');
        if (activePlayers) {
            const count = metrics && metrics.entities ? metrics.entities.players || 0 : 0;
            activePlayers.textContent = count;
        }

        // Update memory usage
        const memoryUsage = document.getElementById('memory-usage');
        if (memoryUsage) {
            let memoryMB = 0;
            if (metrics && metrics.server && metrics.server.memory) {
                memoryMB = Math.round(metrics.server.memory.heapUsed / 1024 / 1024);
            }
            memoryUsage.textContent = `${memoryMB} MB`;
        }

        // Update error rate
        const errorRate = document.getElementById('error-rate');
        if (errorRate) {
            const stats = this.dataManager.getErrorStats();
            const rate = Math.round(stats.averageRate * 10) / 10; // Round to 1 decimal
            errorRate.textContent = `${rate}/h`;
        }
    }

    updateCharts() {
        if (!this.dataManager) return;

        this.updateErrorTrendsChart();
        this.updatePerformanceChart();
    }

    updateErrorTrendsChart() {
        // Throttle updates - only update error trends every 30 seconds
        const now = Date.now();
        if (now - (this.lastErrorTrendsUpdate || 0) < 30000) {
            return;
        }
        this.lastErrorTrendsUpdate = now;

        const errorEntries = this.dataManager.filteredEntries.filter(e =>
            ['error', 'critical'].includes(e.level)
        );

        // Group errors by 5-minute intervals
        const timeBuckets = this.bucketByTime(errorEntries, 5 * 60 * 1000);

        // Convert to chart data
        const labels = Object.keys(timeBuckets).sort();
        const data = labels.map(label => timeBuckets[label]);

        // Update chart safely
        if (this.charts.errorTrends && typeof this.charts.errorTrends.update === 'function') {
            try {
                this.charts.errorTrends.data.labels = labels;
                this.charts.errorTrends.data.datasets[0].data = data;

                // Force consistent canvas size
                const canvas = this.charts.errorTrends.canvas;
                if (canvas) {
                    canvas.style.height = '200px'; // Fixed height to prevent expansion
                }

                this.charts.errorTrends.update('none');
            } catch (error) {
                console.warn('Error updating error trends chart:', error);
            }
        }
    }

    updatePerformanceChart() {
        if (!this.dataManager.metricsData.performance) return;

        const perf = this.dataManager.metricsData.performance;

        // Throttle updates - only update performance chart every 10 seconds
        const lastUpdate = this.lastPerformanceUpdate || 0;
        const nowTime = Date.now();

        if (nowTime - lastUpdate < 10000) {
            return;
        }

        this.lastPerformanceUpdate = nowTime;

        // Generate time label
        const now = new Date().toLocaleTimeString();

        // Safely update chart data
        if (this.charts.performance && typeof this.charts.performance.update === 'function') {
            try {
                // Add new data points
                this.charts.performance.data.labels.push(now);
                this.charts.performance.data.datasets[0].data.push(perf.fps || 0);
                this.charts.performance.data.datasets[1].data.push(perf.frameTime || 0);

                // Keep exactly 20 data points for the chart
                const maxPoints = 20;
                if (this.charts.performance.data.labels.length > maxPoints) {
                    this.charts.performance.data.labels = this.charts.performance.data.labels.slice(-maxPoints);
                    this.charts.performance.data.datasets[0].data = this.charts.performance.data.datasets[0].data.slice(-maxPoints);
                    this.charts.performance.data.datasets[1].data = this.charts.performance.data.datasets[1].data.slice(-maxPoints);
                }

                // Force resize to maintain consistent dimensions
                const canvas = this.charts.performance.canvas;
                if (canvas) {
                    const container = canvas.parentElement;
                    if (container) {
                        const rect = container.getBoundingClientRect();
                        canvas.style.width = rect.width + 'px';
                        canvas.style.height = '200px'; // Fixed height to prevent expansion
                    }
                }

                // Update chart with minimal animation for performance
                this.charts.performance.update('none');

            } catch (error) {
                console.warn('Error updating performance chart:', error);
                // Reset chart data on error to prevent accumulation
                if (this.charts.performance.data) {
                    this.charts.performance.data.labels = [];
                    this.charts.performance.data.datasets.forEach(ds => ds.data = []);
                }
            }
        }
    }

    updateErrorPatterns(entries) {
        const patterns = this.analyzeErrorPatterns(entries);
        const container = document.getElementById('error-patterns-list');

        if (!container) return;

        // Clear existing patterns
        container.innerHTML = '';

        // Show top 5 patterns
        patterns.slice(0, 5).forEach(pattern => {
            const patternEl = document.createElement('div');
            patternEl.className = 'error-pattern';

            patternEl.innerHTML = `
                <div class="pattern-header">
                    <span class="pattern-type">${pattern.category}</span>
                    <span class="pattern-count">${pattern.count} occurrences</span>
                </div>
                <div class="pattern-message">${pattern.message}</div>
                <div class="pattern-recommendation">${pattern.recommendation}</div>
            `;

            container.appendChild(patternEl);
        });

        // Show message if no patterns
        if (patterns.length === 0) {
            container.innerHTML = '<div class="error-pattern">No error patterns detected in current time range.</div>';
        }
    }

    updateLogEntries(entries) {
        const container = document.getElementById('log-entries');
        if (!container) {
            console.error('Visualizer: log-entries container not found!');
            return;
        }


        // Get recent entries
        const recentEntries = entries.slice(-this.maxLogEntries);
        console.log(`Visualizer: showing ${recentEntries.length} of ${entries.length} total entries (limited to last ${this.maxLogEntries})`);

        // Clear and rebuild log entries
        const html = recentEntries.map(entry => `
            <div class="log-entry log-${entry.level}">
                <span class="log-time">${entry.timestamp.toLocaleTimeString()}</span>
                <span class="log-level">${entry.level.toUpperCase()}</span>
                <span class="log-category">${entry.category}</span>
                <span class="log-message">${this.escapeHtml(entry.message)}</span>
            </div>
        `).join('');
        console.log('Visualizer: setting container HTML, length:', html.length, 'first 200 chars:', html.substring(0, 200));
        container.innerHTML = html;
        console.log('Visualizer: container innerHTML set, child count:', container.children.length);

        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            container.scrollTop = container.scrollHeight;
        }

        // Update entry count
        const logCount = document.getElementById('log-count');
        if (logCount) {
            logCount.textContent = `${entries.length} entries`;
        }
    }

    // Update granular visualizations for kill data analysis
    updateGranularVisualizations(analysis) {
        if (!analysis) return;

        this.updateGranularCharts(analysis);
        this.updateGranularTables(analysis);
        this.updateGranularMetrics(analysis);
    }

    // Update granular charts
    updateGranularCharts(analysis) {
        try {
            this.createHourlyBreakdownChart(analysis.hourlyBreakdown);
            this.createKillerEfficiencyChart(analysis.killerStats);
            this.createWeaponUsageChart(analysis.weaponStats);
            this.createLocationHeatmap(analysis.locationHeatmap);
        } catch (error) {
            console.error('Error updating granular charts:', error);
        }
    }

    // Create hourly breakdown chart
    createHourlyBreakdownChart(hourlyData) {
        const ctx = document.getElementById('error-trends-chart'); // Reuse existing chart
        if (!ctx) return;

        const labels = Object.keys(hourlyData).sort();
        const data = labels.map(hour => hourlyData[hour].total);

        if (this.charts['hourly-breakdown']) {
            this.charts['hourly-breakdown'].destroy();
        }

        this.charts['hourly-breakdown'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Kills per Hour',
                    data: data,
                    borderColor: '#4a9eff',
                    backgroundColor: 'rgba(74, 158, 255, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Hourly Kill Distribution'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Kills'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    }
                }
            }
        });
    }

    // Create killer efficiency chart
    createKillerEfficiencyChart(killerStats) {
        const ctx = document.getElementById('performance-chart'); // Reuse existing chart
        if (!ctx) return;

        const sortedKillers = Object.entries(killerStats)
            .sort(([,a], [,b]) => b.totalKills - a.totalKills)
            .slice(0, 10); // Top 10 killers

        const labels = sortedKillers.map(([killer]) => killer);
        const data = sortedKillers.map(([,stats]) => stats.totalKills);

        if (this.charts['killer-efficiency']) {
            this.charts['killer-efficiency'].destroy();
        }

        this.charts['killer-efficiency'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Total Kills',
                    data: data,
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Top Killers by Efficiency'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Number of Kills'
                        }
                    }
                }
            }
        });
    }

    // Create weapon usage chart
    createWeaponUsageChart(weaponStats) {
        // Create a new canvas for weapon usage
        let weaponCanvas = document.getElementById('weapon-usage-chart');
        if (!weaponCanvas) {
            // Create new canvas in the error patterns area
            const patternsList = document.getElementById('error-patterns-list');
            if (patternsList) {
                weaponCanvas = document.createElement('canvas');
                weaponCanvas.id = 'weapon-usage-chart';
                weaponCanvas.style.width = '100%';
                weaponCanvas.style.height = '200px';
                patternsList.innerHTML = '';
                patternsList.appendChild(weaponCanvas);
            }
        }

        if (!weaponCanvas) return;

        const sortedWeapons = Object.entries(weaponStats)
            .sort(([,a], [,b]) => b.totalKills - a.totalKills)
            .slice(0, 8); // Top 8 weapons

        const labels = sortedWeapons.map(([weapon]) => weapon);
        const data = sortedWeapons.map(([,stats]) => stats.totalKills);

        if (this.charts['weapon-usage']) {
            this.charts['weapon-usage'].destroy();
        }

        this.charts['weapon-usage'] = new Chart(weaponCanvas, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
                    ]
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Weapon Usage Distribution'
                    },
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    // Create location heatmap visualization
    createLocationHeatmap(locationData) {
        // For now, create a simple table-based heatmap
        const patternsList = document.getElementById('error-patterns-list');
        if (!patternsList) return;

        const heatmapHtml = `
            <h4>Location Kill Density</h4>
            <div style="max-height: 200px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr>
                            <th style="border: 1px solid #333; padding: 4px;">Location</th>
                            <th style="border: 1px solid #333; padding: 4px;">Kills</th>
                            <th style="border: 1px solid #333; padding: 4px;">Top Killer</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(locationData)
                            .sort(([,a], [,b]) => b.totalKills - a.totalKills)
                            .slice(0, 10)
                            .map(([loc, data]) => {
                                const topKiller = Object.entries(data.killers)
                                    .sort(([,a], [,b]) => b - a)[0];
                                return `
                                    <tr>
                                        <td style="border: 1px solid #333; padding: 4px;">${loc}</td>
                                        <td style="border: 1px solid #333; padding: 4px;">${data.totalKills}</td>
                                        <td style="border: 1px solid #333; padding: 4px;">${topKiller ? topKiller[0] : 'N/A'}</td>
                                    </tr>
                                `;
                            }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        // Append to existing content
        const weaponCanvas = document.getElementById('weapon-usage-chart');
        if (weaponCanvas) {
            patternsList.innerHTML = weaponCanvas.outerHTML + heatmapHtml;
        } else {
            patternsList.innerHTML = heatmapHtml;
        }
    }

    // Update granular tables
    updateGranularTables(analysis) {
        this.createKillerBreakdownTable(analysis.killerStats);
        this.createWeaponBreakdownTable(analysis.weaponStats);
        this.createVictimBreakdownTable(analysis.victimStats);
    }

    // Create detailed killer breakdown table
    createKillerBreakdownTable(killerStats) {
        // Create a new table in a dedicated area or reuse existing space
        let tableContainer = document.getElementById('killer-breakdown-table');
        if (!tableContainer) {
            // Create new container after the log entries
            const logDetails = document.querySelector('.log-details');
            if (logDetails) {
                tableContainer = document.createElement('div');
                tableContainer.id = 'killer-breakdown-table';
                tableContainer.style.marginTop = '2rem';
                tableContainer.style.maxHeight = '300px';
                tableContainer.style.overflowY = 'auto';
                logDetails.appendChild(tableContainer);
            }
        }

        if (!tableContainer) return;

        const sortedKillers = Object.entries(killerStats)
            .sort(([,a], [,b]) => b.totalKills - a.totalKills)
            .slice(0, 20); // Top 20 killers

        const tableHtml = `
            <h4 style="color: #66b3ff; margin-bottom: 1rem;">Detailed Killer Statistics</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                <thead>
                    <tr style="background-color: #333;">
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Killer</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Total Kills</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Unique Victims</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Weapons Used</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Avg Time Between Kills</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedKillers.map(([killer, stats]) => `
                        <tr style="background-color: #252525;">
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0;">${killer}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #66b3ff; text-align: center;">${stats.totalKills}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0; text-align: center;">${Object.keys(stats.victims).length}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0; text-align: center;">${Object.keys(stats.weapons).length}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0; text-align: center;">
                                ${stats.avgTimeBetweenKills ? stats.avgTimeBetweenKills.toFixed(1) + 's' : 'N/A'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tableHtml;
    }

    // Create weapon breakdown table
    createWeaponBreakdownTable(weaponStats) {
        let tableContainer = document.getElementById('weapon-breakdown-table');
        if (!tableContainer) {
            const killerTable = document.getElementById('killer-breakdown-table');
            if (killerTable) {
                tableContainer = document.createElement('div');
                tableContainer.id = 'weapon-breakdown-table';
                tableContainer.style.marginTop = '2rem';
                killerTable.parentNode.insertBefore(tableContainer, killerTable.nextSibling);
            }
        }

        if (!tableContainer) return;

        const sortedWeapons = Object.entries(weaponStats)
            .sort(([,a], [,b]) => b.totalKills - a.totalKills)
            .slice(0, 15); // Top 15 weapons

        const tableHtml = `
            <h4 style="color: #66b3ff; margin-bottom: 1rem;">Weapon Usage Statistics</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                <thead>
                    <tr style="background-color: #333;">
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Weapon</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Total Kills</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Unique Users</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Victim Types</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedWeapons.map(([weapon, stats]) => `
                        <tr style="background-color: #252525;">
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0;">${weapon}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #66b3ff; text-align: center;">${stats.totalKills}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0; text-align: center;">${Object.keys(stats.killers).length}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0; text-align: center;">${Object.keys(stats.victims).length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tableHtml;
    }

    // Create victim breakdown table
    createVictimBreakdownTable(victimStats) {
        let tableContainer = document.getElementById('victim-breakdown-table');
        if (!tableContainer) {
            const weaponTable = document.getElementById('weapon-breakdown-table');
            if (weaponTable) {
                tableContainer = document.createElement('div');
                tableContainer.id = 'victim-breakdown-table';
                tableContainer.style.marginTop = '2rem';
                weaponTable.parentNode.insertBefore(tableContainer, weaponTable.nextSibling);
            }
        }

        if (!tableContainer) return;

        const sortedVictims = Object.entries(victimStats)
            .sort(([,a], [,b]) => b.totalDeaths - a.totalDeaths)
            .slice(0, 15); // Top 15 victim types

        const tableHtml = `
            <h4 style="color: #66b3ff; margin-bottom: 1rem;">Victim Statistics</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                <thead>
                    <tr style="background-color: #333;">
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Victim Type</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Total Deaths</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Unique Killers</th>
                        <th style="border: 1px solid #555; padding: 8px; color: #e0e0e0;">Weapons Used</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedVictims.map(([victim, stats]) => `
                        <tr style="background-color: #252525;">
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0;">${victim}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #ff6b6b; text-align: center;">${stats.totalDeaths}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0; text-align: center;">${Object.keys(stats.killers).length}</td>
                            <td style="border: 1px solid #333; padding: 6px; color: #e0e0e0; text-align: center;">${Object.keys(stats.weapons).length}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        tableContainer.innerHTML = tableHtml;
    }

    // Update granular metrics cards
    updateGranularMetrics(analysis) {
        const efficiency = analysis.efficiencyMetrics;

        // Update existing metric cards with kill data
        const activePlayersCard = document.querySelector('.metric-card:nth-child(1)');
        if (activePlayersCard) {
            const valueDiv = activePlayersCard.querySelector('.metric-value');
            if (valueDiv) {
                valueDiv.textContent = Object.keys(analysis.killerStats).length;
                activePlayersCard.querySelector('h4').textContent = 'Active Killers';
            }
        }

        const memoryCard = document.querySelector('.metric-card:nth-child(2)');
        if (memoryCard) {
            const valueDiv = memoryCard.querySelector('.metric-value');
            if (valueDiv) {
                valueDiv.textContent = efficiency.avgKillsPerHour.toFixed(1) + '/hr';
                memoryCard.querySelector('h4').textContent = 'Avg Kill Rate';
            }
        }

        const errorCard = document.querySelector('.metric-card:nth-child(3)');
        if (errorCard) {
            const valueDiv = errorCard.querySelector('.metric-value');
            if (valueDiv) {
                const totalKills = Object.values(analysis.killerStats).reduce((sum, k) => sum + k.totalKills, 0);
                valueDiv.textContent = totalKills;
                errorCard.querySelector('h4').textContent = 'Total Kills';
            }
        }
    }

    // Group entries by time buckets
    bucketByTime(entries, intervalMs) {
        const buckets = {};
        const now = new Date();

        entries.forEach(entry => {
            // Calculate bucket key (relative to current time)
            const timeDiff = now - entry.timestamp;
            const bucketIndex = Math.floor(timeDiff / intervalMs);
            const bucketTime = new Date(now - (bucketIndex * intervalMs));
            const label = bucketTime.toLocaleTimeString();

            buckets[label] = (buckets[label] || 0) + 1;
        });

        return buckets;
    }

    // Analyze error patterns
    analyzeErrorPatterns(entries) {
        const errorMap = {};

        entries.filter(e => ['error', 'critical'].includes(e.level))
               .forEach(entry => {
                   const key = `${entry.category}:${entry.message.substring(0, 50)}`;
                   if (!errorMap[key]) {
                       errorMap[key] = {
                           category: entry.category,
                           message: entry.message,
                           count: 0,
                           recommendation: this.getRecommendation(entry.category, entry.message),
                           level: entry.level
                       };
                   }
                   errorMap[key].count++;
               });

        return Object.values(errorMap).sort((a, b) => b.count - a.count);
    }

    // Get recommendations based on error patterns
    getRecommendation(category, message) {
        const msg = message.toLowerCase();

        if (category === 'combat' && msg.includes('target validation')) {
            return 'Review map context validation in SimpleCombat.js';
        }
        if (category === 'memory' && (msg.includes('heap') || msg.includes('memory'))) {
            return 'Consider increasing server memory or optimizing entity cleanup';
        }
        if (category === 'network' && (msg.includes('connection') || msg.includes('socket'))) {
            return 'Check network connectivity and connection limits';
        }
        if (category === 'entity' && msg.includes('undefined')) {
            return 'Check entity lifecycle management and cleanup';
        }
        if (category === 'pathfinding' && (msg.includes('path') || msg.includes('navigation'))) {
            return 'Review pathfinding algorithm and map data consistency';
        }
        if (category === 'database' && msg.includes('connection')) {
            return 'Check database connectivity and connection pooling';
        }

        return 'Investigate error details for specific resolution steps';
    }

    // Toggle auto-scroll
    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        return this.autoScroll;
    }

    // HTML escape utility
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Reset chart data to prevent memory issues
    resetChartData() {
        try {
            // Reset error trends chart
            if (this.charts.errorTrends && this.charts.errorTrends.data) {
                this.charts.errorTrends.data.labels = [];
                this.charts.errorTrends.data.datasets[0].data = [];
                this.charts.errorTrends.update('none');
            }

            // Reset performance chart
            if (this.charts.performance && this.charts.performance.data) {
                this.charts.performance.data.labels = [];
                this.charts.performance.data.datasets.forEach(ds => ds.data = []);
                this.charts.performance.update('none');
            }
        } catch (error) {
            console.warn('Error resetting chart data:', error);
        }
    }

    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Reset data first
        this.resetChartData();

        // Destroy charts safely
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                try {
                    chart.destroy();
                } catch (error) {
                    console.warn('Error destroying chart:', error);
                }
            }
        });
        this.charts = {};
    }
}
