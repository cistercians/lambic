const assert = require('assert');
const { BaseCommand, CommandHandler } = require('../server/js/commands/CommandHandler');

function run() {
  const baseCommand = new BaseCommand('test');
  const okResult = baseCommand.validateArgs(['a', 'b'], 2);
  assert.strictEqual(okResult.valid, true, 'validateArgs should pass when counts match');

  const badResult = baseCommand.validateArgs(['a'], 2);
  assert.strictEqual(badResult.valid, false, 'validateArgs should fail when counts mismatch');
  assert.ok(badResult.message.includes('Expected 2 arguments'), 'validateArgs should include error message');

  const handler = new CommandHandler();
  let lastMessage = null;
  const socket = {
    write: (payload) => { lastMessage = payload; }
  };

  handler.execute('unknowncmd', { inventory: {} }, socket);
  assert.ok(lastMessage && lastMessage.includes('Unknown command'), 'should report unknown command');

  console.log('commandHandler.test.js passed');
}

run();
