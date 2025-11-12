// PathfindingRequestQueue.js - Batched pathfinding with frame budget
class PathfindingRequestQueue {
  constructor(pathfindingSystem) {
    this.pathfindingSystem = pathfindingSystem;
    this.queue = [];
    this.maxRequestsPerFrame = 10; // Limit pathfinding operations per frame
    this.frameTimeBudget = 5; // Max 5ms per frame for pathfinding
    this.priorityWeights = {
      high: 3,
      medium: 2,
      low: 1
    };
    
    // Stats
    this.stats = {
      totalRequests: 0,
      processedThisFrame: 0,
      queuedRequests: 0,
      droppedRequests: 0,
      avgProcessingTime: 0,
      processingTimes: []
    };
    
    this.maxQueueSize = 200; // Drop low priority requests if queue exceeds this
  }
  
  // Request pathfinding (returns promise)
  requestPath(start, end, layer, options = {}, priority = 'medium') {
    return new Promise((resolve, reject) => {
      const request = {
        start,
        end,
        layer,
        options,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      };
      
      // Check queue size - drop low priority if full
      if (this.queue.length >= this.maxQueueSize) {
        if (priority === 'low') {
          this.stats.droppedRequests++;
          reject(new Error('Queue full, request dropped'));
          return;
        }
        
        // Remove oldest low priority request
        const lowPriorityIndex = this.queue.findIndex(r => r.priority === 'low');
        if (lowPriorityIndex > -1) {
          const dropped = this.queue.splice(lowPriorityIndex, 1)[0];
          dropped.reject(new Error('Queue full, lower priority request dropped'));
          this.stats.droppedRequests++;
        }
      }
      
      this.queue.push(request);
      this.stats.totalRequests++;
      this.stats.queuedRequests = this.queue.length;
      
      // Sort queue by priority (high priority first)
      this.sortQueue();
    });
  }
  
  // Sort queue by priority and age
  sortQueue() {
    this.queue.sort((a, b) => {
      // First by priority
      const priorityDiff = this.priorityWeights[b.priority] - this.priorityWeights[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by age (older first)
      return a.timestamp - b.timestamp;
    });
  }
  
  // Process queued requests within frame budget
  processQueue() {
    if (this.queue.length === 0) {
      this.stats.processedThisFrame = 0;
      return;
    }
    
    const frameStartTime = Date.now();
    let processed = 0;
    
    while (this.queue.length > 0 && processed < this.maxRequestsPerFrame) {
      // Check time budget
      const elapsed = Date.now() - frameStartTime;
      if (elapsed >= this.frameTimeBudget) {
        break;
      }
      
      // Process next request
      const request = this.queue.shift();
      const requestStartTime = Date.now();
      
      try {
        const path = this.pathfindingSystem.findPath(
          request.start,
          request.end,
          request.layer,
          request.options
        );
        
        const requestTime = Date.now() - requestStartTime;
        this.stats.processingTimes.push(requestTime);
        if (this.stats.processingTimes.length > 100) {
          this.stats.processingTimes.shift();
        }
        
        request.resolve(path);
        processed++;
      } catch (error) {
        request.reject(error);
      }
    }
    
    this.stats.processedThisFrame = processed;
    this.stats.queuedRequests = this.queue.length;
    
    // Update average processing time
    if (this.stats.processingTimes.length > 0) {
      this.stats.avgProcessingTime = 
        this.stats.processingTimes.reduce((a, b) => a + b, 0) / this.stats.processingTimes.length;
    }
  }
  
  // Get request priority based on entity type and distance
  suggestPriority(entityType, distance) {
    // Players get high priority
    if (entityType === 'player') {
      return 'high';
    }
    
    // Close NPCs get medium priority
    if (distance < 500) {
      return 'medium';
    }
    
    // Far NPCs get low priority
    return 'low';
  }
  
  // Clear all pending requests
  clearQueue() {
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
    this.stats.queuedRequests = 0;
  }
  
  // Get statistics
  getStats() {
    return {
      totalRequests: this.stats.totalRequests,
      queuedRequests: this.stats.queuedRequests,
      processedThisFrame: this.stats.processedThisFrame,
      droppedRequests: this.stats.droppedRequests,
      avgProcessingTime: this.stats.avgProcessingTime.toFixed(2) + 'ms',
      maxQueueSize: this.maxQueueSize,
      maxRequestsPerFrame: this.maxRequestsPerFrame,
      frameTimeBudget: this.frameTimeBudget + 'ms'
    };
  }
  
  // Adjust parameters based on performance
  autoTune(avgFrameTime) {
    // If frames are slow, reduce budget
    if (avgFrameTime > 16) {
      this.maxRequestsPerFrame = Math.max(5, this.maxRequestsPerFrame - 1);
      this.frameTimeBudget = Math.max(3, this.frameTimeBudget - 0.5);
    }
    // If frames are fast and queue is building, increase budget
    else if (avgFrameTime < 10 && this.queue.length > 20) {
      this.maxRequestsPerFrame = Math.min(20, this.maxRequestsPerFrame + 1);
      this.frameTimeBudget = Math.min(10, this.frameTimeBudget + 0.5);
    }
  }
}

module.exports = PathfindingRequestQueue;


