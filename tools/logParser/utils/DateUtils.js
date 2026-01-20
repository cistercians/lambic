function parseIso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDateOnly(value) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(date) {
  if (!date) return 'unknown';
  return new Date(date).toISOString();
}

module.exports = {
  parseIso,
  parseDateOnly,
  formatDateTime
};
