/**
 * CatchEmojiRenderer - Renders catch emojis above players
 * 
 * Extracted from client.js for better organization.
 */

class CatchEmojiRenderer {
  constructor() {
    // Dependencies would be injected here
  }

  /**
   * Render catch emojis above players
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {object} config - Configuration { PlayerList, viewport }
   */
  render(ctx, config) {
    const { PlayerList, viewport } = config;

    for (const id in PlayerList) {
      const player = PlayerList[id];
      if (!player || !player.catchEmoji) continue;

      // Check if emoji should still be displayed (1 second duration)
      if (Date.now() - (player.catchEmojiTime || 0) >= 1000) {
        continue;
      }

      // Calculate screen position
      const screenX = player.x - (viewport ? (viewport.x || 0) : 0);
      const screenY = player.y - (viewport ? (viewport.y || 0) : 0);

      // Render emoji above player
      ctx.save();
      ctx.font = '32px Arial';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(player.catchEmoji, screenX, screenY - 40);
      ctx.fillText(player.catchEmoji, screenX, screenY - 40);
      ctx.restore();
    }
  }
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.CatchEmojiRenderer = CatchEmojiRenderer;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CatchEmojiRenderer;
}
