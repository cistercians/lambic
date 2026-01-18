/**
 * ContextHelper - Client-side map context checks
 * Ensures entities are filtered by battleground context when applicable.
 */
class ContextHelper {
  constructor() {}
  _lastLogAt = 0;
  _logIntervalMs = 2000;

  getCurrentContext(config) {
    const { selfId, PlayerList } = config || {};
    const inBattleground = typeof window !== 'undefined' && window.inBattleground;
    const matchIdFromWindow = typeof window !== 'undefined' ? window.currentBattlegroundMatchId : null;
    const player = selfId && PlayerList ? PlayerList[selfId] : null;
    const matchIdFromPlayer = player ? player.battlegroundMatchId : null;
    const matchId = matchIdFromWindow || matchIdFromPlayer || null;

    return {
      inBattleground: !!(inBattleground && matchId),
      battlegroundMatchId: matchId
    };
  }

  isEntityInContext(entity, context) {
    if (!entity) return false;
    const ctx = context || { inBattleground: false, battlegroundMatchId: null };
    const entityInBG = !!(entity.inBattleground && entity.battlegroundMatchId);
    const entityMatchId = entity.battlegroundMatchId || null;

    if (ctx.inBattleground) {
      const ok = entityInBG && entityMatchId === ctx.battlegroundMatchId;
      if (!ok && typeof window !== 'undefined' && window.DEBUG_CONTEXT) {
        this._maybeLog(entity, ctx);
      }
      return ok;
    }
    const ok = !entityInBG;
    if (!ok && typeof window !== 'undefined' && window.DEBUG_CONTEXT) {
      this._maybeLog(entity, ctx);
    }
    return ok;
  }

  isEntityInCurrentContext(entity, config) {
    const context = this.getCurrentContext(config);
    return this.isEntityInContext(entity, context);
  }

  _maybeLog(entity, ctx) {
    const now = Date.now();
    if (now - this._lastLogAt < this._logIntervalMs) return;
    this._lastLogAt = now;
    const id = entity.id !== undefined ? entity.id : 'unknown';
    console.warn('[ContextHelper] Entity outside context', {
      id,
      type: entity.type,
      class: entity.class,
      entityMatchId: entity.battlegroundMatchId || null,
      context: ctx
    });
  }
}

if (typeof window !== 'undefined') {
  window.ContextHelper = ContextHelper;
  window.contextHelper = new ContextHelper();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextHelper;
}
