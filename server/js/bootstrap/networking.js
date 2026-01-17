function generateServerName(fsSync) {
  try {
    const surnames = fsSync.readFileSync('./surnames.txt', 'utf-8').split('\n').filter(name => name.trim());
    // Filter names between 4-5 letters
    const validNames = surnames.filter(name => {
      const trimmed = name.trim();
      return trimmed.length >= 4 && trimmed.length <= 5;
    });

    if (validNames.length > 0) {
      const randomName = validNames[Math.floor(Math.random() * validNames.length)].trim();
      return randomName;
    }
    return 'Lambic'; // Fallback name
  } catch (error) {
    return 'Lambic';
  }
}

function initializeNetworking({ express, sockjs, fsSync, rootDir, gameState, existingIo }) {
  const app = express();
  const serv = require('http').Server(app);

  // Add CORS headers to allow connections from any origin
  app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.get('/', function(req, res) {
    res.sendFile(rootDir + '/client/index.html');
  });

  // Serve static files
  app.use('/client', express.static(rootDir + '/client'));

  // Initialize server name (generates fresh on each startup)
  const serverName = generateServerName(fsSync);
  gameState.serverName = serverName;
  global.serverName = serverName;

  // Initialize SockJS server BEFORE CLI runs (so message appears before user input)
  let io = existingIo;
  if (!io) {
    io = sockjs.createServer();
    io.installHandlers(serv, { prefix: '/io' });

    serv.listen(2000, '0.0.0.0', function() {
      const addr = serv.address();
      console.log('SockJS v0.3.24 bound to \"/io\" on ' + addr.address + ':' + addr.port);
    });

    // Suppress any duplicate messages from the library
    const originalLog = console.log;
    let sockjsMessageSuppressed = false;
    console.log = function(...args) {
      const msg = args[0];
      if (typeof msg === 'string' && msg.includes('SockJS') && msg.includes('bound to')) {
        if (!sockjsMessageSuppressed) {
          sockjsMessageSuppressed = true;
          return; // Suppress - we already printed it
        }
      }
      originalLog.apply(console, args);
    };

    // Restore after a brief moment to catch any async library messages
    setTimeout(() => {
      console.log = originalLog;
    }, 50);
  }

  return { app, serv, io, serverName };
}

module.exports = { initializeNetworking };
