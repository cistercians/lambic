const fs = require('fs');
const path = require('path');

const LogParser = require('./LogParser');
const ReportGenerator = require('./ReportGenerator');
const MetaReportGenerator = require('./MetaReportGenerator');

const CombatExtractor = require('./extractors/CombatExtractor');
const EconomicExtractor = require('./extractors/EconomicExtractor');
const ErrorExtractor = require('./extractors/ErrorExtractor');
const PerformanceExtractor = require('./extractors/PerformanceExtractor');
const SerfExtractor = require('./extractors/SerfExtractor');
const FactionAIExtractor = require('./extractors/FactionAIExtractor');
const FactionAIReportExtractor = require('./extractors/FactionAIReportExtractor');
const EventManagerExtractor = require('./extractors/EventManagerExtractor');
const BuildingExtractor = require('./extractors/BuildingExtractor');
const NetworkExtractor = require('./extractors/NetworkExtractor');
const TempusExtractor = require('./extractors/TempusExtractor');
const SummaryExtractor = require('./extractors/SummaryExtractor');
const StrategyExtractor = require('./extractors/StrategyExtractor');
const MiscGameplayExtractor = require('./extractors/MiscGameplayExtractor');
const EnvironmentExtractor = require('./extractors/EnvironmentExtractor');
const GarrisonExtractor = require('./extractors/GarrisonExtractor');
const UnrecognizedExtractor = require('./extractors/UnrecognizedExtractor');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      args[key] = value;
      if (value !== true) i += 1;
    }
  }
  return args;
}

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
    new EnvironmentExtractor(cfg.environment || {}),
    new GarrisonExtractor(cfg.garrison || {})
  ];
}

function buildUnrecognizedExtractor(config) {
  const cfg = config.extractors || {};
  return new UnrecognizedExtractor(cfg.unrecognized || {});
}

function printUsage() {
  const usage = [
    'Usage:',
    '  node tools/logParser/index.js --input log.txt',
    '  node tools/logParser/index.js --input log.txt --config tools/logParser/config.json',
    '  node tools/logParser/index.js --meta',
    '  node tools/logParser/index.js --meta --from 2026-01-19 --to 2026-01-20',
    '',
    'Options:',
    '  --input <path>   Path to log file',
    '  --config <path>  Path to config JSON',
    '  --meta           Generate meta report from saved runs',
    '  --from <date>    Filter meta reports from date (YYYY-MM-DD)',
    '  --to <date>      Filter meta reports to date (YYYY-MM-DD)'
  ];
  console.log(usage.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv);
  const configPath = args.config
    ? path.resolve(args.config)
    : path.join(__dirname, 'config.json');
  const config = loadConfig(configPath);
  const reportsDir = path.resolve(process.cwd(), 'reports');

  if (args.meta) {
    const metaGenerator = new MetaReportGenerator({ reportsDir });
    const { outputPath } = await metaGenerator.generate({ from: args.from, to: args.to });
    console.log(`Meta report generated: ${outputPath}`);
    return;
  }

  if (!args.input) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const inputPath = path.resolve(args.input);
  const extractors = buildExtractors(config);
  const unrecognizedExtractor = buildUnrecognizedExtractor(config);
  const parser = new LogParser({
    extractors,
    unrecognizedExtractor,
    parserVersion: config.parserVersion || '1.0.0'
  });
  const reportData = await parser.parseFile(inputPath);

  const generator = new ReportGenerator({ reportsDir });
  const { reportJsonPath, reportTxtPath } = await generator.generate(reportData);
  console.log(`Report generated: ${reportTxtPath}`);
  console.log(`AI report generated: ${reportJsonPath}`);
}

main().catch((error) => {
  console.error('Log parser failed:', error);
  process.exitCode = 1;
});
