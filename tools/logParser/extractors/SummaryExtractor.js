const BaseExtractor = require('./BaseExtractor');

class SummaryExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('summary', config);
    this.stats = this.initializeStats();
    this.inSummarySection = false;
    this.currentSummary = null;
  }

  initializeStats() {
    return {
      totalSummaries: 0,
      summaries: []
    };
  }

  extract(line, context) {
    // Check if we're entering a SERF SPAWNING SUMMARY section
    const summaryStartMatch = line.match(/^\[SERF SPAWNING SUMMARY\]\s+Day\s+(\d+):/);
    if (summaryStartMatch) {
      const day = Number(summaryStartMatch[1]);
      this.inSummarySection = true;
      this.currentSummary = {
        day,
        lineNumber: context.lineNumber,
        data: {}
      };
      return true;
    }

    // If we're in a summary section, parse the data lines
    if (this.inSummarySection) {
      // Tally starts
      const tallyMatch = line.match(/^\s+Tally\s+starts?:\s+(\d+)/);
      if (tallyMatch) {
        this.currentSummary.data.tallyStarts = Number(tallyMatch[1]);
        return true;
      }

      // Spawn attempts
      const attemptsMatch = line.match(/^\s+Spawn\s+attempts?:\s+(\d+)/);
      if (attemptsMatch) {
        this.currentSummary.data.spawnAttempts = Number(attemptsMatch[1]);
        return true;
      }

      // Successful spawns
      const successMatch = line.match(/^\s+Successful\s+spawns?:\s+(\d+)\s+\((\d+)\s+serfs?\)/);
      if (successMatch) {
        this.currentSummary.data.successfulSpawns = Number(successMatch[1]);
        this.currentSummary.data.serfsSpawned = Number(successMatch[2]);
        return true;
      }

      // Failed spawns
      const failedMatch = line.match(/^\s+Failed\s+spawns?:\s+(\d+)/);
      if (failedMatch) {
        this.currentSummary.data.failedSpawns = Number(failedMatch[1]);
        return true;
      }

      // By house: Goths: 4, Franks: 4, Teutons: 4
      const byHouseMatch = line.match(/^\s+By\s+house:\s+(.+)$/);
      if (byHouseMatch) {
        this.currentSummary.data.byHouse = byHouseMatch[1];
        return true;
      }

      // By building type: mill: 4, lumbermill: 8
      const byBuildingTypeMatch = line.match(/^\s+By\s+building\s+type:\s+(.+)$/);
      if (byBuildingTypeMatch) {
        this.currentSummary.data.byBuildingType = byBuildingTypeMatch[1];
        return true;
      }

      // Check if we've moved out of the summary section
      // Summary section ends when we hit a line that doesn't start with spaces
      // and isn't part of the summary format
      if (!line.match(/^\s/) && !line.match(/^\[SERF SPAWNING SUMMARY\]/)) {
        // Save the summary before exiting
        if (this.currentSummary && Object.keys(this.currentSummary.data).length > 0) {
          this.stats.totalSummaries += 1;
          this.stats.summaries.push({
            ...this.currentSummary.data,
            day: this.currentSummary.day,
            lineNumber: this.currentSummary.lineNumber
          });
        }
        this.inSummarySection = false;
        this.currentSummary = null;
        return false; // Let other extractors handle this line
      }

      // Return true for any line that's part of the summary section (starts with spaces)
      // or empty lines within the section
      if (line.match(/^\s/) || line.trim() === '') {
        return true;
      }
    }

    return false;
  }

  reset() {
    super.reset();
    this.inSummarySection = false;
    this.currentSummary = null;
  }
}

module.exports = SummaryExtractor;
