const http = require('http');
const fs = require('fs');
const path = require('path');

const LogParser = require('../LogParser');
const ReportGenerator = require('../ReportGenerator');
const MetaReportGenerator = require('../MetaReportGenerator');

const CombatExtractor = require('../extractors/CombatExtractor');
const EconomicExtractor = require('../extractors/EconomicExtractor');
const ErrorExtractor = require('../extractors/ErrorExtractor');
const PerformanceExtractor = require('../extractors/PerformanceExtractor');
const SerfExtractor = require('../extractors/SerfExtractor');
const FactionAIExtractor = require('../extractors/FactionAIExtractor');
const FactionAIReportExtractor = require('../extractors/FactionAIReportExtractor');
const EventManagerExtractor = require('../extractors/EventManagerExtractor');
const BuildingExtractor = require('../extractors/BuildingExtractor');
const NetworkExtractor = require('../extractors/NetworkExtractor');
const TempusExtractor = require('../extractors/TempusExtractor');
const SummaryExtractor = require('../extractors/SummaryExtractor');
const StrategyExtractor = require('../extractors/StrategyExtractor');
const MiscGameplayExtractor = require('../extractors/MiscGameplayExtractor');
const EnvironmentExtractor = require('../extractors/EnvironmentExtractor');
const UnrecognizedExtractor = require('../extractors/UnrecognizedExtractor');

const PORT = process.env.LOG_PARSER_PORT || 3333;
const PUBLIC_DIR = path.join(__dirname, 'public');

function loadConfig(configPath) {
  const raw = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(raw);
}

function buildExtractors(config) {
  const cfg = config.extractors || {};
  return [
    new CombatExtractor(cfg.combat || {}),
    new EconomicExtractor(cfg.economy || {}),
    new ErrorExtractor(cfg.errors || {}),
    new PerformanceExtractor(cfg.performance || {}),
    new SerfExtractor(cfg.serf || {}),
    new FactionAIExtractor(cfg.factionAI || {}),
    new FactionAIReportExtractor(cfg.factionAIReport || {}),
    new EventManagerExtractor(cfg.eventManager || {}),
    new BuildingExtractor(cfg.building || {}),
    new NetworkExtractor(cfg.network || {}),
    new TempusExtractor(cfg.tempus || {}),
    new SummaryExtractor(cfg.summary || {}),
    new StrategyExtractor(cfg.strategy || {}),
    new MiscGameplayExtractor(cfg.miscGameplay || {}),
    new EnvironmentExtractor(cfg.environment || {})
  ];
}

function buildUnrecognizedExtractor(config) {
  const cfg = config.extractors || {};
  return new UnrecognizedExtractor(cfg.unrecognized || {});
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function collectJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleParse(req, res) {
  try {
    const payload = await collectJson(req);
    const inputPath = payload.inputPath;
    if (!inputPath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'inputPath is required' }));
      return;
    }

    const configPath = payload.configPath
      ? path.resolve(payload.configPath)
      : path.join(__dirname, '..', 'config.json');
    const config = loadConfig(configPath);
    const extractors = buildExtractors(config);
    const unrecognizedExtractor = buildUnrecognizedExtractor(config);
    const parser = new LogParser({
      extractors,
      unrecognizedExtractor,
      parserVersion: config.parserVersion || '1.0.0'
    });
    const reportData = await parser.parseFile(path.resolve(inputPath));

    const reportsDir = path.resolve(process.cwd(), 'reports');
    const generator = new ReportGenerator({ reportsDir });
    const { runDir, reportJsonPath, reportTxtPath } = await generator.generate(reportData);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      runDir,
      reportJsonPath,
      reportTxtPath,
      meta: reportData.meta
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || String(error) }));
  }
}

async function handleMeta(req, res) {
  try {
    const payload = await collectJson(req);
    const reportsDir = path.resolve(process.cwd(), 'reports');
    const metaGenerator = new MetaReportGenerator({ reportsDir });
    const { outputPath } = await metaGenerator.generate({ from: payload.from, to: payload.to });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ outputPath }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message || String(error) }));
  }
}

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (req.method === 'GET' && url === '/') {
    serveFile(res, path.join(PUBLIC_DIR, 'index.html'), 'text/html');
    return;
  }

  if (req.method === 'GET' && url === '/app.js') {
    serveFile(res, path.join(PUBLIC_DIR, 'app.js'), 'text/javascript');
    return;
  }

  if (req.method === 'GET' && url === '/styles.css') {
    serveFile(res, path.join(PUBLIC_DIR, 'styles.css'), 'text/css');
    return;
  }

  if (req.method === 'POST' && url === '/api/parse') {
    handleParse(req, res);
    return;
  }

  if (req.method === 'POST' && url === '/api/meta') {
    handleMeta(req, res);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Log parser GUI running at http://localhost:${PORT}`);
});
