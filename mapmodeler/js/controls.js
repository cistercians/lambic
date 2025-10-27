// MapModeler Controls
// Handles slider controls, parameter management, and UI interactions

class MapControls {
  constructor() {
    this.mapViewer = null;
    this.currentParams = {};
    this.autoRegenerate = true;
    this.regenerateTimeout = null;
    
    // Default parameters
    this.defaultParams = {
      redFrequencyX: 200,
      redFrequencyY: 150,
      redAmplitude: 1.25,
      redOffset: 0.25,
      greenFrequencyX: 12,
      greenFrequencyY: 12,
      greenAmplitude: 0.75,
      greenOffset: 0.25,
      blueFrequencyX: 8,
      blueFrequencyY: 8,
      blueAmplitude: 0.35,
      blueOffset: 0,
      waterThreshold: 0.55,
      mountainThreshold: 0.97,
      rocksThreshold: 0.86,
      brushThreshold: 0.26,
      lightForestThreshold: 0.31
    };
    
    this.currentParams = { ...this.defaultParams };
    this.savedPresets = this.loadSavedPresets();
    this.setupEventListeners();
    this.updateSliderValues();
    this.renderSavedPresets();
  }
  
  setMapViewer(mapViewer) {
    this.mapViewer = mapViewer;
  }
  
  setupEventListeners() {
    // Generate button
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => this.generateMap());
    }
    
    // Reset button
    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetToDefaults());
    }
    
    // Export button
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.showExportModal());
    }
    
    // Preset buttons
    const presetButtons = document.querySelectorAll('.btn-preset');
    presetButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = e.target.getAttribute('data-preset');
        this.applyPreset(preset);
      });
    });
    
    // Save preset button
    const savePresetBtn = document.getElementById('save-preset-btn');
    if (savePresetBtn) {
      savePresetBtn.addEventListener('click', () => this.saveCurrentPreset());
    }
    
    // Preset name input - allow Enter key to save
    const presetNameInput = document.getElementById('preset-name');
    if (presetNameInput) {
      presetNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.saveCurrentPreset();
        }
      });
    }
    
    // Slider event listeners
    this.setupSliderListeners();
    
    // Modal close
    const modal = document.getElementById('export-modal');
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
    
    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
    
    // Copy button
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyToClipboard());
    }
    
    // Window resize
    window.addEventListener('resize', () => {
      if (this.mapViewer) {
        this.mapViewer.handleResize();
      }
    });
  }
  
  setupSliderListeners() {
    const sliderMappings = {
      'redFreqX': 'redFrequencyX',
      'redFreqY': 'redFrequencyY',
      'redAmp': 'redAmplitude',
      'redOffset': 'redOffset',
      'greenFreqX': 'greenFrequencyX',
      'greenFreqY': 'greenFrequencyY',
      'greenAmp': 'greenAmplitude',
      'greenOffset': 'greenOffset',
      'blueFreqX': 'blueFrequencyX',
      'blueFreqY': 'blueFrequencyY',
      'blueAmp': 'blueAmplitude',
      'blueOffset': 'blueOffset',
      'waterThreshold': 'waterThreshold',
      'mountainThreshold': 'mountainThreshold',
      'rocksThreshold': 'rocksThreshold',
      'brushThreshold': 'brushThreshold',
      'lightForestThreshold': 'lightForestThreshold'
    };
    
    Object.keys(sliderMappings).forEach(sliderId => {
      const slider = document.getElementById(sliderId);
      const valueSpan = document.getElementById(sliderId + '-value');
      const paramKey = sliderMappings[sliderId];
      
      if (slider && valueSpan) {
        slider.addEventListener('input', (e) => {
          const value = parseFloat(e.target.value);
          this.currentParams[paramKey] = value;
          valueSpan.textContent = value.toFixed(2);
          
          // Debounced regeneration
          this.scheduleRegeneration();
        });
      }
    });
  }
  
  scheduleRegeneration() {
    if (!this.autoRegenerate) return;
    
    // Clear existing timeout
    if (this.regenerateTimeout) {
      clearTimeout(this.regenerateTimeout);
    }
    
    // Schedule new regeneration
    this.regenerateTimeout = setTimeout(() => {
      this.generateMap();
    }, 300); // 300ms debounce
  }
  
  generateMap() {
    if (!this.mapViewer) {
      console.error('MapViewer not initialized');
      return;
    }
    
    const startTime = Date.now();
    
    try {
      // Generate map with current parameters
      const mapData = window.MapModelerGenesis.generateMap(this.currentParams);
      mapData.generationTime = startTime;
      
      // Render the map
      this.mapViewer.renderMap(mapData);
      
      console.log('Map generated successfully');
    } catch (error) {
      console.error('Error generating map:', error);
    }
  }
  
  resetToDefaults() {
    this.currentParams = { ...this.defaultParams };
    this.updateSliderValues();
    this.generateMap();
  }
  
  updateSliderValues() {
    const sliderMappings = {
      'redFreqX': 'redFrequencyX',
      'redFreqY': 'redFrequencyY',
      'redAmp': 'redAmplitude',
      'redOffset': 'redOffset',
      'greenFreqX': 'greenFrequencyX',
      'greenFreqY': 'greenFrequencyY',
      'greenAmp': 'greenAmplitude',
      'greenOffset': 'greenOffset',
      'blueFreqX': 'blueFrequencyX',
      'blueFreqY': 'blueFrequencyY',
      'blueAmp': 'blueAmplitude',
      'blueOffset': 'blueOffset',
      'waterThreshold': 'waterThreshold',
      'mountainThreshold': 'mountainThreshold',
      'rocksThreshold': 'rocksThreshold',
      'brushThreshold': 'brushThreshold',
      'lightForestThreshold': 'lightForestThreshold'
    };
    
    Object.keys(sliderMappings).forEach(sliderId => {
      const slider = document.getElementById(sliderId);
      const valueSpan = document.getElementById(sliderId + '-value');
      const paramKey = sliderMappings[sliderId];
      
      if (slider && valueSpan && this.currentParams[paramKey] !== undefined) {
        slider.value = this.currentParams[paramKey];
        valueSpan.textContent = this.currentParams[paramKey].toFixed(2);
      }
    });
  }
  
  applyPreset(presetName) {
    const presets = {
      default: {
        redFrequencyX: 200,
        redFrequencyY: 150,
        redAmplitude: 1.25,
        redOffset: 0.25,
        greenFrequencyX: 12,
        greenFrequencyY: 12,
        greenAmplitude: 0.75,
        greenOffset: 0.25,
        blueFrequencyX: 8,
        blueFrequencyY: 8,
        blueAmplitude: 0.35,
        blueOffset: 0,
        waterThreshold: 0.55,
        mountainThreshold: 0.97,
        rocksThreshold: 0.86,
        brushThreshold: 0.26,
        lightForestThreshold: 0.31
      },
      islands: {
        redFrequencyX: 100,
        redFrequencyY: 80,
        redAmplitude: 1.4,
        redOffset: 0.3,
        greenFrequencyX: 18,
        greenFrequencyY: 18,
        greenAmplitude: 0.6,
        greenOffset: 0.2,
        blueFrequencyX: 12,
        blueFrequencyY: 12,
        blueAmplitude: 0.25,
        blueOffset: 0,
        waterThreshold: 0.45,
        mountainThreshold: 0.95,
        rocksThreshold: 0.82,
        brushThreshold: 0.24,
        lightForestThreshold: 0.28
      },
      continents: {
        redFrequencyX: 80,
        redFrequencyY: 60,
        redAmplitude: 0.85,
        redOffset: 0.44,
        greenFrequencyX: 25,
        greenFrequencyY: 25,
        greenAmplitude: 0.5,
        greenOffset: 0.25,
        blueFrequencyX: 20,
        blueFrequencyY: 20,
        blueAmplitude: 0.15,
        blueOffset: 0,
        waterThreshold: 0.6,
        mountainThreshold: 0.97,
        rocksThreshold: 0.86,
        brushThreshold: 0.26,
        lightForestThreshold: 0.31
      },
      varied: {
        redFrequencyX: 120,
        redFrequencyY: 90,
        redAmplitude: 1.0,
        redOffset: 0.4,
        greenFrequencyX: 14,
        greenFrequencyY: 14,
        greenAmplitude: 0.7,
        greenOffset: 0.25,
        blueFrequencyX: 8,
        blueFrequencyY: 8,
        blueAmplitude: 0.35,
        blueOffset: 0,
        waterThreshold: 0.55,
        mountainThreshold: 0.96,
        rocksThreshold: 0.88,
        brushThreshold: 0.22,
        lightForestThreshold: 0.26
      }
    };
    
    if (presets[presetName]) {
      this.currentParams = { ...presets[presetName] };
      this.updateSliderValues();
      this.generateMap();
    }
  }
  
  showExportModal() {
    const modal = document.getElementById('export-modal');
    const exportText = document.getElementById('export-text');
    
    if (modal && exportText) {
      const report = this.generateReport();
      exportText.value = report;
      modal.style.display = 'block';
    }
  }
  
  generateReport() {
    const timestamp = new Date().toISOString();
    const mapData = this.mapViewer ? this.mapViewer.getCurrentMapData() : null;
    
    let report = `// MapModeler Export Report\n`;
    report += `// Generated: ${timestamp}\n\n`;
    
    report += `// RED CHANNEL (Continents/Oceans)\n`;
    report += `var redFrequencyX = ${this.currentParams.redFrequencyX};\n`;
    report += `var redFrequencyY = ${this.currentParams.redFrequencyY};\n`;
    report += `var redAmplitude = ${this.currentParams.redAmplitude};\n`;
    report += `var redOffset = ${this.currentParams.redOffset};\n\n`;
    
    report += `// GREEN CHANNEL (Biomes/Terrain)\n`;
    report += `var greenFrequencyX = ${this.currentParams.greenFrequencyX};\n`;
    report += `var greenFrequencyY = ${this.currentParams.greenFrequencyY};\n`;
    report += `var greenAmplitude = ${this.currentParams.greenAmplitude};\n`;
    report += `var greenOffset = ${this.currentParams.greenOffset};\n\n`;
    
    report += `// BLUE CHANNEL (Fine Details)\n`;
    report += `var blueFrequencyX = ${this.currentParams.blueFrequencyX};\n`;
    report += `var blueFrequencyY = ${this.currentParams.blueFrequencyY};\n`;
    report += `var blueAmplitude = ${this.currentParams.blueAmplitude};\n`;
    report += `var blueOffset = ${this.currentParams.blueOffset};\n\n`;
    
    report += `// TERRAIN THRESHOLDS\n`;
    report += `var waterThreshold = ${this.currentParams.waterThreshold};\n`;
    report += `var mountainThreshold = ${this.currentParams.mountainThreshold};\n`;
    report += `var rocksThreshold = ${this.currentParams.rocksThreshold};\n`;
    report += `var brushThreshold = ${this.currentParams.brushThreshold};\n`;
    report += `var lightForestThreshold = ${this.currentParams.lightForestThreshold};\n\n`;
    
    if (mapData && mapData.distribution) {
      report += `// TERRAIN DISTRIBUTION\n`;
      report += `// Water: ${mapData.distribution.water} tiles (${((mapData.distribution.water / (mapData.mapSize * mapData.mapSize)) * 100).toFixed(1)}%)\n`;
      report += `// Heavy Forest: ${mapData.distribution.heavyForest} tiles (${((mapData.distribution.heavyForest / (mapData.mapSize * mapData.mapSize)) * 100).toFixed(1)}%)\n`;
      report += `// Light Forest: ${mapData.distribution.lightForest} tiles (${((mapData.distribution.lightForest / (mapData.mapSize * mapData.mapSize)) * 100).toFixed(1)}%)\n`;
      report += `// Brush: ${mapData.distribution.brush} tiles (${((mapData.distribution.brush / (mapData.mapSize * mapData.mapSize)) * 100).toFixed(1)}%)\n`;
      report += `// Rocks: ${mapData.distribution.rocks} tiles (${((mapData.distribution.rocks / (mapData.mapSize * mapData.mapSize)) * 100).toFixed(1)}%)\n`;
      report += `// Mountain: ${mapData.distribution.mountain} tiles (${((mapData.distribution.mountain / (mapData.mapSize * mapData.mapSize)) * 100).toFixed(1)}%)\n`;
      report += `// Cave Entrances: ${mapData.distribution.caveEntrance} tiles\n`;
    }
    
    return report;
  }
  
  async copyToClipboard() {
    const exportText = document.getElementById('export-text');
    if (exportText) {
      try {
        await navigator.clipboard.writeText(exportText.value);
        // Show success feedback
        const copyBtn = document.getElementById('copy-btn');
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        // Fallback for older browsers
        exportText.select();
        document.execCommand('copy');
      }
    }
  }
  
  getCurrentParams() {
    return { ...this.currentParams };
  }
  
  // Preset Management Functions
  loadSavedPresets() {
    const saved = localStorage.getItem('mapmodeler-presets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to load saved presets:', e);
        return {};
      }
    }
    return {};
  }
  
  saveSavedPresets() {
    localStorage.setItem('mapmodeler-presets', JSON.stringify(this.savedPresets));
  }
  
  saveCurrentPreset() {
    const presetNameInput = document.getElementById('preset-name');
    if (!presetNameInput) return;
    
    const presetName = presetNameInput.value.trim();
    if (!presetName) {
      alert('Please enter a preset name');
      return;
    }
    
    if (this.savedPresets[presetName]) {
      if (!confirm(`Preset "${presetName}" already exists. Overwrite?`)) {
        return;
      }
    }
    
    // Save current parameters
    this.savedPresets[presetName] = {
      ...this.currentParams,
      createdAt: new Date().toISOString()
    };
    
    this.saveSavedPresets();
    this.renderSavedPresets();
    
    // Clear input
    presetNameInput.value = '';
    
    // Show success feedback
    const saveBtn = document.getElementById('save-preset-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = originalText;
    }, 2000);
  }
  
  renderSavedPresets() {
    const savedPresetsContainer = document.getElementById('saved-presets');
    if (!savedPresetsContainer) return;
    
    savedPresetsContainer.innerHTML = '';
    
    const presetNames = Object.keys(this.savedPresets).sort();
    
    if (presetNames.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.style.color = '#888';
      emptyMsg.style.fontSize = '0.9rem';
      emptyMsg.style.fontStyle = 'italic';
      emptyMsg.textContent = 'No saved presets';
      savedPresetsContainer.appendChild(emptyMsg);
      return;
    }
    
    presetNames.forEach(name => {
      const presetItem = document.createElement('div');
      presetItem.className = 'preset-item';
      
      const presetName = document.createElement('div');
      presetName.className = 'preset-item-name';
      presetName.textContent = name;
      presetName.addEventListener('click', () => this.loadPreset(name));
      
      const actions = document.createElement('div');
      actions.className = 'preset-actions';
      
      const loadBtn = document.createElement('button');
      loadBtn.className = 'btn-preset-action';
      loadBtn.textContent = 'Load';
      loadBtn.addEventListener('click', () => this.loadPreset(name));
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-preset-action delete';
      deleteBtn.textContent = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePreset(name);
      });
      
      actions.appendChild(loadBtn);
      actions.appendChild(deleteBtn);
      
      presetItem.appendChild(presetName);
      presetItem.appendChild(actions);
      
      savedPresetsContainer.appendChild(presetItem);
    });
  }
  
  loadPreset(name) {
    const preset = this.savedPresets[name];
    if (!preset) {
      console.error('Preset not found:', name);
      return;
    }
    
    // Load parameters (exclude metadata like createdAt)
    const { createdAt, ...params } = preset;
    this.currentParams = { ...params };
    
    // Update sliders
    this.updateSliderValues();
    
    // Generate map with loaded parameters
    this.generateMap();
    
    console.log(`Loaded preset: ${name}`);
  }
  
  deletePreset(name) {
    if (!confirm(`Delete preset "${name}"?`)) {
      return;
    }
    
    delete this.savedPresets[name];
    this.saveSavedPresets();
    this.renderSavedPresets();
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapControls;
} else {
  window.MapControls = MapControls;
}

