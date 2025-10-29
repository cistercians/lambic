// Lazy loader for performance monitoring tools
// Only loads when Shift+P is pressed

let loaded = false;

function loadPerformanceTools() {
  if (loaded) return;
  loaded = true;
  
  // Dynamically load scripts
  const scripts = [
    '/client/js/TimerManager.js',
    '/client/js/ListenerManager.js',
    '/client/js/PerformanceHUD.js'
  ];
  
  let loadedCount = 0;
  scripts.forEach(src => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      loadedCount++;
      if (loadedCount === scripts.length) {
        // All scripts loaded, initialize HUD
        if (!window.performanceHUD) {
          window.performanceHUD = new PerformanceHUD();
        }
        window.performanceHUD.toggle();
      }
    };
    document.head.appendChild(script);
  });
}

// Global key handler for Shift+P - loads tools on demand
document.addEventListener('keydown', (e) => {
  if (e.shiftKey && (e.key === 'P' || e.key === 'p')) {
    loadPerformanceTools();
  }
});

