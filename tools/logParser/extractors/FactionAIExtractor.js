const BaseExtractor = require('./BaseExtractor');

class FactionAIExtractor extends BaseExtractor {
  constructor(config = {}) {
    super('factionAI', config);
    this.stats = this.initializeStats();
  }

  initializeStats() {
    return {
      totalEvents: 0,
      byComponent: {},
      chainErrors: 0,
      decisions: 0,
      goalChainEvents: 0,
      scoutGoalEvents: 0
    };
  }

  extract(line, context) {
    // Check for GoalChain logs
    const goalChainMatch = line.match(/^\[GoalChain\]\s+(.+)$/);
    if (goalChainMatch) {
      this.stats.totalEvents += 1;
      this.stats.goalChainEvents += 1;
      this._increment(this.stats.byComponent, 'GoalChain');

      const message = goalChainMatch[1];
      let faction = null;
      let goal = null;
      let depth = null;
      let reason = null;

      // Extract faction if present
      const factionMatch = message.match(/faction:\s+(\w+)/i);
      if (factionMatch) faction = factionMatch[1];

      // Extract goal if present
      const goalMatch = message.match(/([A-Z_]+)\s*\(/);
      if (goalMatch) goal = goalMatch[1];

      // Extract depth if present
      const depthMatch = message.match(/depth:\s+(\d+)/i);
      if (depthMatch) depth = Number(depthMatch[1]);

      // Extract reason if present
      const reasonMatch = message.match(/reason:\s+([^,)]+)/i);
      if (reasonMatch) reason = reasonMatch[1].trim();

      this.addEvent({
        type: 'goal_chain',
        component: 'GoalChain',
        message,
        faction,
        goal,
        depth,
        reason,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Check for SCOUT GOAL logs
    const scoutGoalMatch = line.match(/^\[SCOUT GOAL\]\s+(\w+):\s+(.+)$/);
    if (scoutGoalMatch) {
      this.stats.totalEvents += 1;
      this.stats.scoutGoalEvents += 1;
      this._increment(this.stats.byComponent, 'SCOUT GOAL');

      const faction = scoutGoalMatch[1];
      const message = scoutGoalMatch[2];

      this.addEvent({
        type: 'scout_goal',
        component: 'SCOUT GOAL',
        message,
        faction,
        day: context.currentDay || null,
        hour: context.currentHour || null,
        lineNumber: context.lineNumber
      });
      return true;
    }

    // Original patterns
    if (!line.includes('[FactionAI]') &&
        !line.includes('[GoalExecutor]') &&
        !line.includes('[COMBAT RECORDER]') &&
        !line.includes('Goal chain') &&
        !line.includes('Chain creation errors')) {
      return false;
    }

    this.stats.totalEvents += 1;

    const componentMatch = line.match(/^\[([^\]]+)\]/);
    const component = componentMatch ? componentMatch[1] : 'unknown';
    this._increment(this.stats.byComponent, component);

    if (line.includes('Chain creation errors') || line.includes('Goal chain')) {
      this.stats.chainErrors += 1;
    }

    if (line.includes('[DECISION]') || line.includes('Decision')) {
      this.stats.decisions += 1;
    }

    this.addEvent({
      type: 'faction_ai',
      component,
      message: line,
      day: context.currentDay || null,
      hour: context.currentHour || null,
      lineNumber: context.lineNumber
    });
    return true;
  }

  _increment(map, key, amount = 1) {
    if (!key) return;
    map[key] = (map[key] || 0) + amount;
  }
}

module.exports = FactionAIExtractor;
