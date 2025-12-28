// AI System Constants
// Centralized configuration values for the Faction AI system

// Utility thresholds for goal selection
const UTILITY_THRESHOLDS = {
  HIGH: 50,                    // High utility threshold (BUILD_GARRISON, ESTABLISH_OUTPOST, etc.)
  FORCED_MIN: 60,              // Minimum utility for forced goals
  FALLBACK_SCOUT: 65,          // Utility for fallback scout goals
  RECOVERY: 70,                // Utility for recovery goals
  MINIMUM: 10,                 // Minimum utility threshold (don't go below this)
  FALLBACK_MILL: 30,           // Utility for fallback mill goals
  FALLBACK_FARM: 20            // Utility for fallback farm goals
};

// Resource thresholds for balance analysis
const RESOURCE_THRESHOLDS = {
  STONE_SCARCE: 50,            // Stone is critically low
  STONE_VERY_LOW: 20,          // Stone is very low (triggers additional boost)
  STONE_NEEDED: 100,           // Need stone for forge/garrison
  WOOD_NEEDED: 50,             // Need wood for basic buildings
  GRAIN_NEEDED: 50,            // Need grain for military
  LARGE_DEFICIT: 100,          // Large resource deficit (build additional buildings)
  PRODUCTION_ISSUE_CHECK: 50   // Check for production issues when resource below this
};

// Resource ratio thresholds
const RESOURCE_RATIOS = {
  WOOD_STONE_EXCESSIVE: 20,    // Wood is 20x more than stone (excessive)
  GRAIN_STONE_EXCESSIVE: 10    // Grain is 10x more than stone (excessive)
};

// Production rates per building per day (simplified estimates)
const PRODUCTION_RATES = {
  STONE: 5,                    // per stone mine per day
  WOOD: 8,                     // per lumbermill per day
  GRAIN: 10,                   // per farm per day
  IRONORE: 3,                  // per cave mine per day
  SILVERORE: 2,                // per cave mine per day
  GOLDORE: 1,                  // per cave mine per day
  IRON: 3,                     // per cave mine per day (alias)
  SILVER: 2,                   // per cave mine per day (alias)
  GOLD: 1                      // per cave mine per day (alias)
};

// Production efficiency factor (accounts for serfs not always working optimally)
const PRODUCTION_EFFICIENCY = 0.5; // 50% efficiency assumption

// Time thresholds (in days)
const TIME_THRESHOLDS = {
  PRODUCTION_ISSUE_DAYS: 2,           // Trigger recovery after 2 days of production issues
  FAILURE_COOLDOWN_DAYS: 2,           // Cooldown period after failure
  MAX_GATHERING_DAYS: 10,             // Maximum reasonable time to gather resources
  GOAL_FORCE_CONSIDERATIONS: 3,       // Force goal selection after 3 considerations
  AVOID_GOAL_DAYS: 1,                 // Avoid goal if failed within last day
  AVOID_CHAIN_GOAL_DAYS: 2,           // Avoid chain goal if failed within last 2 days
  GOAL_ABANDONMENT_COOLDOWN: 10       // Days before abandoned goal can be reconsidered
};

// Utility adjustment multipliers and penalties
const UTILITY_ADJUSTMENTS = {
  STONE_SCARCE_BOOST: 1.5,            // 50% boost when stone is scarce
  STONE_VERY_LOW_BOOST: 1.3,          // Additional 30% boost when stone is very low
  WOOD_SCARCE_BOOST: 1.3,             // 30% boost when wood is scarce
  FAILURE_PENALTY_PER_FAILURE: 0.1,   // -10% per failure
  FAILURE_PENALTY_MAX: 0.5,           // Maximum -50% penalty
  CONSECUTIVE_FAILURE_PENALTY: 0.1,   // -10% per consecutive failure (max 10%)
  LOCATION_BLOCK_PENALTY: 0.5,        // -50% if location-blocked 3+ times
  LOCATION_BLOCK_THRESHOLD: 3,        // Number of location blocks before penalty
  COOLDOWN_PENALTY: 0.2               // -20% if failed recently (within cooldown period)
};

// Failure thresholds
const FAILURE_THRESHOLDS = {
  AVOID_GOAL_CONSECUTIVE: 3,          // Avoid goal if 3+ consecutive failures
  GOAL_ABANDONMENT_FAILURES: 15,      // Abandon goal after 15 consecutive failures (increased from 10)
  GOAL_ABANDONMENT_DAYS: 20           // Abandon goal if failed for 20+ days total (increased from 15)
};

// Display constants
const DISPLAY = {
  TOP_GOALS_COUNT: 3,                 // Number of top goals to display in logs
  PROGRESS_PERCENTAGE_MULTIPLIER: 100 // Multiply by 100 for percentage display
};

module.exports = {
  UTILITY_THRESHOLDS,
  RESOURCE_THRESHOLDS,
  RESOURCE_RATIOS,
  PRODUCTION_RATES,
  PRODUCTION_EFFICIENCY,
  TIME_THRESHOLDS,
  UTILITY_ADJUSTMENTS,
  FAILURE_THRESHOLDS,
  DISPLAY
};

