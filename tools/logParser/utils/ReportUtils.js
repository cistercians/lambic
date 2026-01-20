function limitArray(items, limit) {
  if (!Array.isArray(items)) return [];
  if (!Number.isFinite(limit)) return items;
  return items.slice(0, limit);
}

function summarizeCounts(map, topN = 5) {
  if (!map) return [];
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, value]) => ({ key, value }));
}

module.exports = {
  limitArray,
  summarizeCounts
};
