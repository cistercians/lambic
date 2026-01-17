const assert = require('assert');
const PathfindingRequestQueue = require('../server/js/core/PathfindingRequestQueue');

async function run() {
  const mockPathfinder = {
    findPath: (start, end) => [start, end]
  };

  const queue = new PathfindingRequestQueue(mockPathfinder);
  queue.maxQueueSize = 2;
  queue.maxRequestsPerFrame = 1;
  queue.frameTimeBudget = 50;

  await queue.requestPath([0, 0], [1, 1], 0, {}, 'low');
  await queue.requestPath([1, 1], [2, 2], 0, {}, 'low');

  let dropped = false;
  await queue.requestPath([2, 2], [3, 3], 0, {}, 'low').catch(() => {
    dropped = true;
  });
  assert.strictEqual(dropped, true, 'low priority request should be dropped when queue is full');

  queue.processQueue();
  assert.strictEqual(queue.stats.processedThisFrame, 1, 'should process only one request per frame');
  assert.strictEqual(queue.stats.queuedRequests, 1, 'one request should remain in queue');

  console.log('pathfindingRequestQueue.test.js passed');
}

run();
