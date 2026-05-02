const BaseExtractor = require('./BaseExtractor');

class GarrisonExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('garrison', config);
    this.lastFaction = null;
    this.pendingOutcome = null;
  }

  initializeStats() {
    return {
      passive: {
        attempts: 0,
        successes: 0,
        failures: 0,
        byFaction: {},
        byGarrison: {},
        failuresByReason: {},
        attemptsByDay: {},
        successesByDay: {},
        failuresByDay: {}
      },
      trainMilitary: {
        successes: 0,
        failures: 0,
        successesByFaction: {},
        failuresByFaction: {},
        failuresByReason: {}
      }
    };
  }

  reset() {
    super.reset();
    this.lastFaction = null;
    this.pendingOutcome = null;
  }

  extract(line, context) {
    this._updateFactionContext(line);

    if (this.pendingOutcome && this._consumePendingDetail(line, context)) {
      return true;
    }

    if (this._extractPassiveAttempt(line, context)) return true;
    if (this._extractPassiveSuccess(line, context)) return true;
    if (this._extractPassiveFailure(line, context)) return true;
    if (this._extractTrainMilitaryFailure(line, context)) return true;
    if (this._extractTrainMilitarySuccess(line, context)) return true;

    return false;
  }

  _updateFactionContext(line) {
    const factionMatch = line.match(/FACTION AI REPORT - (.+?) - Day/);
    if (factionMatch) {
      this.lastFaction = factionMatch[1].trim();
    }
  }

  _extractPassiveAttempt(line, context) {
    if (!line.includes('[Garrison] Production timer triggered')) return false;

    const garrisonId = this._matchValue(line, /garrisonId:\s*([^,}]+)/);
    const houseId = this._matchValue(line, /house:\s*([^,}]+)/);

    this.stats.passive.attempts += 1;
    if (garrisonId) this._increment(this.stats.passive.byGarrison, garrisonId);
    if (context.currentDay !== null) this._increment(this.stats.passive.attemptsByDay, context.currentDay);

    this.addEvent({
      type: 'garrison_production_attempt',
      garrisonId,
      houseId,
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null
    });

    return true;
  }

  _extractPassiveSuccess(line, context) {
    if (!line.includes('[Garrison] Unit produced successfully')) return false;

    this.stats.passive.successes += 1;
    if (context.currentDay !== null) this._increment(this.stats.passive.successesByDay, context.currentDay);
    this.pendingOutcome = {
      type: 'success',
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null,
      unitClass: null,
      faction: null
    };

    return true;
  }

  _extractPassiveFailure(line, context) {
    if (!line.includes('[Garrison] Production failed:')) return false;

    const reasonMatch = line.match(/\[Garrison\] Production failed:\s*([^{]+)/);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'unknown';

    this.stats.passive.failures += 1;
    this._increment(this.stats.passive.failuresByReason, reason);
    if (context.currentDay !== null) this._increment(this.stats.passive.failuresByDay, context.currentDay);

    this.pendingOutcome = {
      type: 'failure',
      reason,
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null,
      faction: null
    };

    return true;
  }

  _extractTrainMilitaryFailure(line, context) {
    if (!line.includes('[TRAIN_MILITARY]') || !line.includes('Error executing goal:')) return false;

    const factionMatch = line.match(/\]\s+\[([^\]]+)\]\s+\[TRAIN_MILITARY\]/);
    const faction = factionMatch ? factionMatch[1] : this.lastFaction || 'Unknown';
    const reasonMatch = line.match(/Error executing goal:\s*(.*)$/);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'unknown';

    this.stats.trainMilitary.failures += 1;
    this._increment(this.stats.trainMilitary.failuresByFaction, faction);
    this._increment(this.stats.trainMilitary.failuresByReason, reason);

    this.addEvent({
      type: 'train_military_failure',
      faction,
      reason,
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null
    });

    return true;
  }

  _extractTrainMilitarySuccess(line, context) {
    if (!line.match(/^\s*\d+\.\s+TRAIN_MILITARY completed\b/)) return false;

    const faction = this.lastFaction || 'Unknown';
    this.stats.trainMilitary.successes += 1;
    this._increment(this.stats.trainMilitary.successesByFaction, faction);

    this.addEvent({
      type: 'train_military_success',
      faction,
      lineNumber: context.lineNumber,
      day: context.currentDay || null,
      hour: context.currentHour || null
    });

    return true;
  }

  _consumePendingDetail(line, context) {
    const factionMatch = line.match(/house:\s*'([^']+)'/);
    const unitMatch = line.match(/unitClass:\s*'([^']+)'/);

    if (factionMatch) {
      this.pendingOutcome.faction = factionMatch[1];
    }
    if (unitMatch) {
      this.pendingOutcome.unitClass = unitMatch[1];
    }

    if (line.trim() !== '}') {
      return true;
    }

    const outcome = this.pendingOutcome;
    this.pendingOutcome = null;

    if (outcome.type === 'success') {
      if (outcome.faction) this._increment(this.stats.passive.byFaction, outcome.faction);
      this.addHighlight({
        type: 'garrison_unit_produced',
        summary: `${outcome.faction || 'Unknown'} produced ${outcome.unitClass || 'a military unit'} from a garrison`,
        house: outcome.faction || null,
        unitClass: outcome.unitClass || null,
        day: outcome.day,
        hour: outcome.hour
      });
    } else if (outcome.type === 'failure') {
      if (outcome.faction) this._increment(this.stats.passive.byFaction, outcome.faction);
      this.addSample({
        type: 'garrison_production_failure',
        reason: outcome.reason,
        faction: outcome.faction || null,
        lineNumber: outcome.lineNumber,
        day: outcome.day,
        hour: outcome.hour
      });
    }

    return true;
  }

  _matchValue(line, regex) {
    const match = line.match(regex);
    if (!match) return null;
    return String(match[1]).replace(/^['"]|['"]$/g, '').trim();
  }

  _increment(bucket, key) {
    const normalizedKey = key === null || typeof key === 'undefined' ? 'unknown' : String(key);
    bucket[normalizedKey] = (bucket[normalizedKey] || 0) + 1;
  }
}

module.exports = GarrisonExtractor;
