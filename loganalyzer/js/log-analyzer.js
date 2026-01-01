// Log Analysis Dashboard - Analyzer
// Provides advanced pattern analysis and debugging recommendations

class LogAnalyzer {
    constructor() {
        this.dataManager = null;
        this.analysisCache = new Map();
        this.patternRules = this.initializePatternRules();
    }

    setDataManager(dataManager) {
        this.dataManager = dataManager;
    }

    // Initialize pattern detection rules
    initializePatternRules() {
        return {
            // Memory pressure patterns
            memory_pressure: {
                condition: (entries, stats) => {
                    const memoryErrors = entries.filter(e =>
                        e.level === 'error' || e.level === 'critical'
                    ).filter(e =>
                        e.category === 'memory' ||
                        e.message.toLowerCase().includes('heap') ||
                        e.message.toLowerCase().includes('memory')
                    );
                    return memoryErrors.length >= 3;
                },
                severity: 'high',
                title: 'Memory Pressure Detected',
                description: 'Multiple memory-related errors indicate potential memory leaks',
                recommendations: [
                    'Increase server memory allocation',
                    'Review entity cleanup in Entity.js and related modules',
                    'Check for circular references in object graphs',
                    'Monitor entity counts and implement cleanup routines'
                ],
                affectedFiles: ['server/js/Entity.js', 'server/js/core/EntityRegistry.js']
            },

            // Network instability patterns
            network_instability: {
                condition: (entries, stats) => {
                    const networkErrors = entries.filter(e =>
                        e.level === 'error' || e.level === 'critical'
                    ).filter(e =>
                        e.category === 'network' ||
                        e.message.toLowerCase().includes('connection') ||
                        e.message.toLowerCase().includes('socket') ||
                        e.message.toLowerCase().includes('timeout')
                    );
                    return networkErrors.length >= 5;
                },
                severity: 'medium',
                title: 'Network Instability',
                description: 'Frequent network errors may indicate connectivity issues',
                recommendations: [
                    'Check network connectivity and firewall settings',
                    'Review connection limits in server configuration',
                    'Monitor network latency and packet loss',
                    'Consider implementing connection pooling'
                ],
                affectedFiles: ['server/js/core/NetworkTelemetry.js', 'lambic.js']
            },

            // Combat system stress
            combat_system_stress: {
                condition: (entries, stats) => {
                    const combatErrors = entries.filter(e =>
                        e.level === 'error' || e.level === 'critical'
                    ).filter(e =>
                        e.category === 'combat' ||
                        e.message.toLowerCase().includes('combat') ||
                        e.message.toLowerCase().includes('damage') ||
                        e.message.toLowerCase().includes('target')
                    );
                    return combatErrors.length >= 3;
                },
                severity: 'medium',
                title: 'Combat System Under Stress',
                description: 'Combat-related errors suggest high concurrent combat activity',
                recommendations: [
                    'Monitor combat frequency and consider load balancing',
                    'Review target validation in SimpleCombat.js',
                    'Check map context handling for combat scenarios',
                    'Consider implementing combat rate limiting'
                ],
                affectedFiles: ['server/js/core/SimpleCombat.js', 'server/js/core/MapContextHelpers.js']
            },

            // Entity management issues
            entity_management_issues: {
                condition: (entries, stats) => {
                    const entityErrors = entries.filter(e =>
                        e.level === 'error' || e.level === 'critical'
                    ).filter(e =>
                        e.category === 'entity' ||
                        e.message.toLowerCase().includes('entity') ||
                        e.message.toLowerCase().includes('undefined') ||
                        e.message.toLowerCase().includes('null')
                    );
                    return entityErrors.length >= 5;
                },
                severity: 'high',
                title: 'Entity Management Issues',
                description: 'Frequent entity-related errors indicate lifecycle problems',
                recommendations: [
                    'Review entity creation and cleanup processes',
                    'Check for proper entity removal from global lists',
                    'Monitor entity counts and implement bounds checking',
                    'Review entity serialization/deserialization'
                ],
                affectedFiles: ['server/js/Entity.js', 'server/js/core/EntityRegistry.js']
            },

            // Pathfinding performance issues
            pathfinding_performance: {
                condition: (entries, stats) => {
                    const pathErrors = entries.filter(e =>
                        e.level === 'warn' || e.level === 'error' || e.level === 'critical'
                    ).filter(e =>
                        e.category === 'pathfinding' ||
                        e.message.toLowerCase().includes('path') ||
                        e.message.toLowerCase().includes('navigation')
                    );
                    return pathErrors.length >= 3;
                },
                severity: 'medium',
                title: 'Pathfinding Performance Issues',
                description: 'Pathfinding errors may indicate map data or algorithm issues',
                recommendations: [
                    'Review pathfinding algorithm efficiency',
                    'Check map data consistency and terrain values',
                    'Consider implementing path caching for common routes',
                    'Monitor pathfinding computation times'
                ],
                affectedFiles: ['server/js/core/PathfindingManager.js', 'server/js/genesis.js']
            },

            // Database connectivity issues
            database_connectivity: {
                condition: (entries, stats) => {
                    const dbErrors = entries.filter(e =>
                        e.level === 'error' || e.level === 'critical'
                    ).filter(e =>
                        e.category === 'database' ||
                        e.message.toLowerCase().includes('database') ||
                        e.message.toLowerCase().includes('mongo') ||
                        e.message.toLowerCase().includes('connection')
                    );
                    return dbErrors.length >= 2;
                },
                severity: 'high',
                title: 'Database Connectivity Issues',
                description: 'Database connection problems can cause data loss',
                recommendations: [
                    'Check MongoDB connection string and credentials',
                    'Verify database server availability',
                    'Review connection pooling configuration',
                    'Implement database connection retry logic'
                ],
                affectedFiles: ['server/js/Database.js', 'package.json']
            },

            // High error rate
            high_error_rate: {
                condition: (entries, stats) => {
                    return stats.averageRate > 10; // More than 10 errors per hour
                },
                severity: 'critical',
                title: 'Critical Error Rate',
                description: 'Error rate exceeds acceptable threshold',
                recommendations: [
                    'Immediate investigation required',
                    'Consider server restart if errors are cascading',
                    'Review recent code changes and deployments',
                    'Check system resources (CPU, memory, disk space)'
                ],
                affectedFiles: ['lambic.js', 'server/js/core/TelemetryLogger.js']
            },

            // Performance degradation
            performance_degradation: {
                condition: (entries, stats, metrics) => {
                    if (!metrics.performance) return false;
                    const perf = metrics.performance;
                    return perf.fps < 30 || perf.frameTime > 50; // Low FPS or high frame time
                },
                severity: 'medium',
                title: 'Performance Degradation',
                description: 'Server performance is below acceptable levels',
                recommendations: [
                    'Monitor active player count and entity density',
                    'Check for memory leaks affecting performance',
                    'Review recent code changes for performance regressions',
                    'Consider server scaling or optimization'
                ],
                affectedFiles: ['server/js/core/OptimizedGameLoop.js', 'server/js/core/TelemetryLogger.js']
            }
        };
    }

    // Analyze logs and return insights
    analyze(entries, metrics) {
        if (!entries || entries.length === 0) {
            return { insights: [], patterns: [], recommendations: [] };
        }

        const cacheKey = this.generateCacheKey(entries, metrics);
        if (this.analysisCache.has(cacheKey)) {
            return this.analysisCache.get(cacheKey);
        }

        const errorStats = this.dataManager ? this.dataManager.getErrorStats() : { total: 0 };
        const insights = this.detectPatterns(entries, errorStats, metrics);
        const recommendations = this.generateRecommendations(insights);

        const result = {
            insights,
            patterns: this.extractErrorPatterns(entries),
            recommendations
        };

        // Cache result for 30 seconds
        this.analysisCache.set(cacheKey, result);
        setTimeout(() => this.analysisCache.delete(cacheKey), 30000);

        return result;
    }

    // Detect patterns using rule-based system
    detectPatterns(entries, stats, metrics) {
        const insights = [];

        for (const [patternId, rule] of Object.entries(this.patternRules)) {
            try {
                if (rule.condition(entries, stats, metrics)) {
                    insights.push({
                        id: patternId,
                        severity: rule.severity,
                        title: rule.title,
                        description: rule.description,
                        recommendations: rule.recommendations,
                        affectedFiles: rule.affectedFiles,
                        evidence: this.getEvidenceForPattern(patternId, entries),
                        timestamp: new Date()
                    });
                }
            } catch (error) {
                console.warn(`Error evaluating pattern ${patternId}:`, error);
            }
        }

        return insights.sort((a, b) => {
            const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
            return severityOrder[b.severity] - severityOrder[a.severity];
        });
    }

    // Get evidence for a specific pattern
    getEvidenceForPattern(patternId, entries) {
        const pattern = this.patternRules[patternId];
        if (!pattern) return [];

        // Filter entries that match the pattern conditions
        const evidence = entries.filter(entry => {
            const isError = entry.level === 'error' || entry.level === 'critical';
            const matchesCategory = pattern.evidenceCategories ?
                pattern.evidenceCategories.includes(entry.category) : true;

            const matchesMessage = pattern.evidenceKeywords ?
                pattern.evidenceKeywords.some(keyword =>
                    entry.message.toLowerCase().includes(keyword)
                ) : true;

            return isError && matchesCategory && matchesMessage;
        });

        return evidence.slice(0, 10); // Return up to 10 evidence entries
    }

    // Extract error patterns from log data
    extractErrorPatterns(entries) {
        const errorMap = new Map();

        entries.filter(e => ['error', 'critical'].includes(e.level))
               .forEach(entry => {
                   // Create a pattern key based on category and simplified message
                   const messageKey = entry.message.toLowerCase()
                       .replace(/\d+/g, 'X') // Replace numbers with X
                       .replace(/[a-f0-9]{8,}/g, 'HASH') // Replace hashes
                       .substring(0, 100); // Limit length

                   const patternKey = `${entry.category}:${messageKey}`;

                   if (!errorMap.has(patternKey)) {
                       errorMap.set(patternKey, {
                           category: entry.category,
                           message: entry.message,
                           count: 0,
                           firstSeen: entry.timestamp,
                           lastSeen: entry.timestamp,
                           levels: new Set(),
                           sources: new Set()
                       });
                   }

                   const pattern = errorMap.get(patternKey);
                   pattern.count++;
                   pattern.lastSeen = entry.timestamp;
                   pattern.levels.add(entry.level);
                   if (entry.source) pattern.sources.add(entry.source);
               });

        return Array.from(errorMap.values())
            .sort((a, b) => b.count - a.count)
            .map(pattern => ({
                ...pattern,
                levels: Array.from(pattern.levels),
                sources: Array.from(pattern.sources),
                frequency: this.calculateFrequency(pattern)
            }));
    }

    // Generate specific recommendations based on insights
    generateRecommendations(insights) {
        const recommendations = [];

        insights.forEach(insight => {
            insight.recommendations.forEach(rec => {
                recommendations.push({
                    priority: insight.severity === 'critical' ? 'urgent' :
                             insight.severity === 'high' ? 'high' : 'medium',
                    category: insight.id,
                    action: rec,
                    affectedFiles: insight.affectedFiles,
                    evidence: insight.evidence.length
                });
            });
        });

        // Remove duplicates and sort by priority
        const unique = new Map();
        recommendations.forEach(rec => {
            if (!unique.has(rec.action)) {
                unique.set(rec.action, rec);
            }
        });

        return Array.from(unique.values())
            .sort((a, b) => {
                const priorityOrder = { urgent: 3, high: 2, medium: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
    }

    // Calculate error frequency (errors per hour)
    calculateFrequency(pattern) {
        const timeSpan = pattern.lastSeen - pattern.firstSeen;
        const hours = Math.max(timeSpan / (1000 * 60 * 60), 1); // At least 1 hour
        return pattern.count / hours;
    }

    // Generate cache key for analysis results
    generateCacheKey(entries, metrics) {
        if (!entries || entries.length === 0) return 'empty';

        const firstEntry = entries[0];
        const lastEntry = entries[entries.length - 1];
        const metricsKey = metrics ? JSON.stringify(metrics).substring(0, 100) : 'no-metrics';

        return `${firstEntry.timestamp.getTime()}-${lastEntry.timestamp.getTime()}-${entries.length}-${metricsKey}`;
    }

    // Get analysis summary
    getSummary(entries, metrics) {
        const analysis = this.analyze(entries, metrics);

        return {
            totalEntries: entries ? entries.length : 0,
            errorCount: entries ? entries.filter(e => e.level === 'error' || e.level === 'critical').length : 0,
            criticalInsights: analysis.insights.filter(i => i.severity === 'critical').length,
            highPriorityInsights: analysis.insights.filter(i => i.severity === 'high').length,
            recommendations: analysis.recommendations.length,
            topPatterns: analysis.patterns.slice(0, 5)
        };
    }

    // Clear analysis cache
    clearCache() {
        this.analysisCache.clear();
    }

    // Granular kill data analysis for detailed breakdowns
    analyzeKillDataGranular(entries) {
        const killEntries = entries.filter(e => e.killData);

        return {
            // Time-based breakdowns
            hourlyBreakdown: this.groupByHour(killEntries),
            dailyBreakdown: this.groupByDay(killEntries),
            weeklyBreakdown: this.groupByWeek(killEntries),

            // Entity-based breakdowns
            killerStats: this.analyzeKillers(killEntries),
            victimStats: this.analyzeVictims(killEntries),
            weaponStats: this.analyzeWeapons(killEntries),

            // Location-based analysis
            locationHeatmap: this.analyzeLocations(killEntries),

            // Behavioral patterns
            killPatterns: this.analyzePatterns(killEntries),

            // Performance metrics
            efficiencyMetrics: this.calculateEfficiency(killEntries),

            // Custom field analysis
            customFields: this.analyzeCustomFields(killEntries)
        };
    }

    groupByHour(entries) {
        const hourly = {};
        entries.forEach(entry => {
            const hour = entry.timestamp.getHours();
            const key = `${hour.toString().padStart(2, '0')}:00`;
            if (!hourly[key]) hourly[key] = { total: 0, byKiller: {}, byVictim: {} };
            hourly[key].total++;

            const killer = entry.killData.killer;
            const victim = entry.killData.victim;
            hourly[key].byKiller[killer] = (hourly[key].byKiller[killer] || 0) + 1;
            hourly[key].byVictim[victim] = (hourly[key].byVictim[victim] || 0) + 1;
        });
        return hourly;
    }

    groupByDay(entries) {
        const daily = {};
        entries.forEach(entry => {
            const date = entry.timestamp.toISOString().split('T')[0];
            if (!daily[date]) daily[date] = { total: 0, byKiller: {}, byVictim: {} };
            daily[date].total++;

            const killer = entry.killData.killer;
            const victim = entry.killData.victim;
            daily[date].byKiller[killer] = (daily[date].byKiller[killer] || 0) + 1;
            daily[date].byVictim[victim] = (daily[date].byVictim[victim] || 0) + 1;
        });
        return daily;
    }

    groupByWeek(entries) {
        const weekly = {};
        entries.forEach(entry => {
            const date = new Date(entry.timestamp);
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            const weekKey = weekStart.toISOString().split('T')[0];

            if (!weekly[weekKey]) weekly[weekKey] = { total: 0, byKiller: {}, byVictim: {} };
            weekly[weekKey].total++;

            const killer = entry.killData.killer;
            const victim = entry.killData.victim;
            weekly[weekKey].byKiller[killer] = (weekly[weekKey].byKiller[killer] || 0) + 1;
            weekly[weekKey].byVictim[victim] = (weekly[weekKey].byVictim[victim] || 0) + 1;
        });
        return weekly;
    }

    analyzeKillers(entries) {
        const killers = {};
        entries.forEach(entry => {
            const killer = entry.killData.killer;
            if (!killers[killer]) {
                killers[killer] = {
                    totalKills: 0,
                    victims: {},
                    weapons: {},
                    locations: {},
                    avgTimeBetweenKills: 0,
                    peakHours: {},
                    efficiency: 0,
                    killTimestamps: []
                };
            }

            killers[killer].totalKills++;
            killers[killer].killTimestamps.push(entry.timestamp);

            // Track victims killed by this killer
            const victim = entry.killData.victim;
            killers[killer].victims[victim] = (killers[killer].victims[victim] || 0) + 1;

            // Track weapons used
            if (entry.killData.weapon) {
                killers[killer].weapons[entry.killData.weapon] = (killers[killer].weapons[entry.killData.weapon] || 0) + 1;
            }

            // Track locations
            if (entry.killData.location) {
                const loc = `${entry.killData.location.x},${entry.killData.location.y}`;
                killers[killer].locations[loc] = (killers[killer].locations[loc] || 0) + 1;
            }

            // Track peak hours
            const hour = entry.timestamp.getHours();
            killers[killer].peakHours[hour] = (killers[killer].peakHours[hour] || 0) + 1;
        });

        // Calculate efficiency metrics
        Object.values(killers).forEach(killer => {
            if (killer.killTimestamps.length > 1) {
                const sorted = killer.killTimestamps.sort((a, b) => a - b);
                const intervals = [];
                for (let i = 1; i < sorted.length; i++) {
                    intervals.push(sorted[i] - sorted[i-1]);
                }
                killer.avgTimeBetweenKills = intervals.reduce((a, b) => a + b, 0) / intervals.length / 1000; // seconds
            }
        });

        return killers;
    }

    analyzeVictims(entries) {
        const victims = {};
        entries.forEach(entry => {
            const victim = entry.killData.victim;
            if (!victims[victim]) {
                victims[victim] = {
                    totalDeaths: 0,
                    killers: {},
                    weapons: {},
                    locations: {},
                    peakHours: {}
                };
            }

            victims[victim].totalDeaths++;

            // Track who killed this victim type
            const killer = entry.killData.killer;
            victims[victim].killers[killer] = (victims[victim].killers[killer] || 0) + 1;

            // Track weapons used against this victim
            if (entry.killData.weapon) {
                victims[victim].weapons[entry.killData.weapon] = (victims[victim].weapons[entry.killData.weapon] || 0) + 1;
            }

            // Track death locations
            if (entry.killData.location) {
                const loc = `${entry.killData.location.x},${entry.killData.location.y}`;
                victims[victim].locations[loc] = (victims[victim].locations[loc] || 0) + 1;
            }

            // Track peak death hours
            const hour = entry.timestamp.getHours();
            victims[victim].peakHours[hour] = (victims[victim].peakHours[hour] || 0) + 1;
        });

        return victims;
    }

    analyzeWeapons(entries) {
        const weapons = {};
        entries.forEach(entry => {
            if (!entry.killData.weapon) return;

            const weapon = entry.killData.weapon;
            if (!weapons[weapon]) {
                weapons[weapon] = {
                    totalKills: 0,
                    killers: {},
                    victims: {},
                    locations: {},
                    efficiency: 0
                };
            }

            weapons[weapon].totalKills++;

            // Track who uses this weapon
            const killer = entry.killData.killer;
            weapons[weapon].killers[killer] = (weapons[weapon].killers[killer] || 0) + 1;

            // Track what this weapon is used against
            const victim = entry.killData.victim;
            weapons[weapon].victims[victim] = (weapons[weapon].victims[victim] || 0) + 1;

            // Track kill locations for this weapon
            if (entry.killData.location) {
                const loc = `${entry.killData.location.x},${entry.killData.location.y}`;
                weapons[weapon].locations[loc] = (weapons[weapon].locations[loc] || 0) + 1;
            }
        });

        return weapons;
    }

    analyzeLocations(entries) {
        const locations = {};
        entries.forEach(entry => {
            if (!entry.killData.location) return;

            const loc = `${Math.floor(entry.killData.location.x / 100)},${Math.floor(entry.killData.location.y / 100)}`;
            if (!locations[loc]) {
                locations[loc] = {
                    totalKills: 0,
                    killers: {},
                    victims: {},
                    weapons: {},
                    centerX: Math.floor(entry.killData.location.x / 100) * 100 + 50,
                    centerY: Math.floor(entry.killData.location.y / 100) * 100 + 50
                };
            }

            locations[loc].totalKills++;

            const killer = entry.killData.killer;
            const victim = entry.killData.victim;
            const weapon = entry.killData.weapon;

            locations[loc].killers[killer] = (locations[loc].killers[killer] || 0) + 1;
            locations[loc].victims[victim] = (locations[loc].victims[victim] || 0) + 1;
            if (weapon) {
                locations[loc].weapons[weapon] = (locations[loc].weapons[weapon] || 0) + 1;
            }
        });

        return locations;
    }

    analyzePatterns(entries) {
        const patterns = {
            peakHuntingHours: this.findPeakHours(entries),
            weaponPreferences: this.findWeaponPreferences(entries),
            locationHotspots: this.findLocationHotspots(entries),
            behavioralClusters: this.findBehavioralClusters(entries)
        };
        return patterns;
    }

    findPeakHours(entries) {
        const hours = new Array(24).fill(0);
        entries.forEach(entry => {
            const hour = entry.timestamp.getHours();
            hours[hour]++;
        });

        const maxKills = Math.max(...hours);
        const peakHours = [];
        hours.forEach((kills, hour) => {
            if (kills > maxKills * 0.8) { // Hours with >80% of peak kills
                peakHours.push({ hour, kills });
            }
        });

        return peakHours.sort((a, b) => b.kills - a.kills);
    }

    findWeaponPreferences(entries) {
        const weaponUsage = {};
        entries.forEach(entry => {
            if (!entry.killData.weapon) return;
            const weapon = entry.killData.weapon;
            weaponUsage[weapon] = (weaponUsage[weapon] || 0) + 1;
        });

        return Object.entries(weaponUsage)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5); // Top 5 weapons
    }

    findLocationHotspots(entries) {
        const locationKills = {};
        entries.forEach(entry => {
            if (!entry.killData.location) return;
            const loc = `${Math.floor(entry.killData.location.x / 50)},${Math.floor(entry.killData.location.y / 50)}`;
            locationKills[loc] = (locationKills[loc] || 0) + 1;
        });

        return Object.entries(locationKills)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10); // Top 10 hotspots
    }

    calculateEfficiency(entries) {
        if (entries.length === 0) return { avgKillsPerHour: 0, totalKills: 0 };

        const timeSpan = entries[entries.length - 1].timestamp - entries[0].timestamp;
        const hours = Math.max(timeSpan / (1000 * 60 * 60), 1);

        return {
            avgKillsPerHour: entries.length / hours,
            totalKills: entries.length,
            timeSpanHours: hours
        };
    }

    analyzeCustomFields(entries) {
        const customFields = {};
        const sampleEntry = entries.find(e => e.killData);

        if (!sampleEntry) return customFields;

        // Find all unique keys in killData
        const allKeys = new Set();
        entries.forEach(entry => {
            Object.keys(entry.killData).forEach(key => allKeys.add(key));
        });

        // Standard fields to exclude
        const standardFields = ['killer', 'victim', 'weapon', 'location', 'timestamp'];

        allKeys.forEach(key => {
            if (!standardFields.includes(key)) {
                customFields[key] = this.analyzeCustomField(entries, key);
            }
        });

        return customFields;
    }

    analyzeCustomField(entries, fieldName) {
        const values = {};
        entries.forEach(entry => {
            const value = entry.killData[fieldName];
            if (value !== undefined && value !== null) {
                const key = typeof value === 'object' ? JSON.stringify(value) : String(value);
                values[key] = (values[key] || 0) + 1;
            }
        });

        return {
            fieldName,
            valueDistribution: values,
            uniqueValues: Object.keys(values).length,
            mostCommon: Object.entries(values).sort(([,a], [,b]) => b - a)[0]
        };
    }
}
