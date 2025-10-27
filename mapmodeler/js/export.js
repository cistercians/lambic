// MapModeler Export functionality
// Handles report generation and clipboard operations

class MapExporter {
  constructor(mapControls, mapViewer) {
    this.mapControls = mapControls;
    this.mapViewer = mapViewer;
  }
  
  generateDetailedReport() {
    const timestamp = new Date().toISOString();
    const params = this.mapControls.getCurrentParams();
    const mapData = this.mapViewer.getCurrentMapData();
    
    let report = `// MapModeler Detailed Export Report\n`;
    report += `// Generated: ${timestamp}\n`;
    report += `// Map Size: ${mapData.mapSize}x${mapData.mapSize} tiles\n`;
    report += `// Canvas Size: ${mapData.canvasSize.width}x${mapData.canvasSize.height} pixels\n\n`;
    
    // Parameter section
    report += `// ============================================================================\n`;
    report += `// NOISE PARAMETERS\n`;
    report += `// ============================================================================\n\n`;
    
    report += `// RED CHANNEL: Controls large-scale features (continents/oceans/water boundaries)\n`;
    report += `// Lower frequency = larger landmasses, Higher frequency = more islands/fractured coastlines\n`;
    report += `var redFrequencyX = ${params.redFrequencyX};  // Horizontal scale for large features\n`;
    report += `var redFrequencyY = ${params.redFrequencyY};  // Vertical scale for large features\n`;
    report += `var redAmplitude = ${params.redAmplitude};  // Controls contrast between land/water\n`;
    report += `var redOffset = ${params.redOffset};     // Baseline shift\n\n`;
    
    report += `// GREEN CHANNEL: Controls medium-scale features (biomes/terrain patches)\n`;
    report += `// Lower frequency = larger biome regions, Higher frequency = more varied/mixed terrain\n`;
    report += `var greenFrequencyX = ${params.greenFrequencyX}; // Horizontal scale for biome features\n`;
    report += `var greenFrequencyY = ${params.greenFrequencyY}; // Vertical scale for biome features\n`;
    report += `var greenAmplitude = ${params.greenAmplitude}; // Controls biome contrast\n`;
    report += `var greenOffset = ${params.greenOffset};   // Baseline shift for biome distribution\n\n`;
    
    report += `// BLUE CHANNEL: Controls fine details and local variation\n`;
    report += `// Lower frequency = smoother terrain, Higher frequency = more detailed/noisy terrain\n`;
    report += `var blueFrequencyX = ${params.blueFrequencyX};  // Horizontal scale for fine details\n`;
    report += `var blueFrequencyY = ${params.blueFrequencyY};  // Vertical scale for fine details\n`;
    report += `var blueAmplitude = ${params.blueAmplitude}; // Controls detail intensity\n`;
    report += `var blueOffset = ${params.blueOffset};       // No baseline shift for details\n\n`;
    
    report += `// ============================================================================\n`;
    report += `// TERRAIN CLASSIFICATION THRESHOLDS\n`;
    report += `// ============================================================================\n\n`;
    
    report += `// These thresholds convert HSV values from noise into terrain types\n`;
    report += `// Lower thresholds = more of that terrain type, Higher thresholds = less of that terrain type\n\n`;
    
    report += `var waterThreshold = ${params.waterThreshold};    // Hue threshold for water\n`;
    report += `var mountainThreshold = ${params.mountainThreshold};  // Value threshold for mountains\n`;
    report += `var rocksThreshold = ${params.rocksThreshold};     // Value threshold for rocks\n`;
    report += `var brushThreshold = ${params.brushThreshold};     // Hue threshold for brush\n`;
    report += `var lightForestThreshold = ${params.lightForestThreshold}; // Hue threshold for light forest\n\n`;
    
    // Terrain distribution section
    if (mapData.distribution) {
      report += `// ============================================================================\n`;
      report += `// TERRAIN DISTRIBUTION ANALYSIS\n`;
      report += `// ============================================================================\n\n`;
      
      const totalTiles = mapData.mapSize * mapData.mapSize;
      const dist = mapData.distribution;
      
      report += `// Total tiles: ${totalTiles}\n`;
      report += `// Water: ${dist.water} tiles (${((dist.water / totalTiles) * 100).toFixed(1)}%)\n`;
      report += `// Heavy Forest: ${dist.heavyForest} tiles (${((dist.heavyForest / totalTiles) * 100).toFixed(1)}%)\n`;
      report += `// Light Forest: ${dist.lightForest} tiles (${((dist.lightForest / totalTiles) * 100).toFixed(1)}%)\n`;
      report += `// Brush: ${dist.brush} tiles (${((dist.brush / totalTiles) * 100).toFixed(1)}%)\n`;
      report += `// Rocks: ${dist.rocks} tiles (${((dist.rocks / totalTiles) * 100).toFixed(1)}%)\n`;
      report += `// Mountain: ${dist.mountain} tiles (${((dist.mountain / totalTiles) * 100).toFixed(1)}%)\n`;
      report += `// Cave Entrances: ${dist.caveEntrance} tiles\n\n`;
      
      // Analysis
      report += `// ANALYSIS:\n`;
      const waterPercent = (dist.water / totalTiles) * 100;
      const landPercent = 100 - waterPercent;
      
      if (waterPercent > 60) {
        report += `// This is a water-heavy map (${waterPercent.toFixed(1)}% water)\n`;
      } else if (waterPercent < 30) {
        report += `// This is a land-heavy map (${landPercent.toFixed(1)}% land)\n`;
      } else {
        report += `// This is a balanced map (${waterPercent.toFixed(1)}% water, ${landPercent.toFixed(1)}% land)\n`;
      }
      
      const forestPercent = ((dist.heavyForest + dist.lightForest) / totalTiles) * 100;
      if (forestPercent > 40) {
        report += `// Forest-dominant terrain (${forestPercent.toFixed(1)}% forest)\n`;
      } else if (forestPercent < 20) {
        report += `// Sparse forest coverage (${forestPercent.toFixed(1)}% forest)\n`;
      } else {
        report += `// Moderate forest coverage (${forestPercent.toFixed(1)}% forest)\n`;
      }
      
      const mountainPercent = (dist.mountain / totalTiles) * 100;
      if (mountainPercent > 10) {
        report += `// Mountainous terrain (${mountainPercent.toFixed(1)}% mountains)\n`;
      } else if (mountainPercent < 2) {
        report += `// Flat terrain (${mountainPercent.toFixed(1)}% mountains)\n`;
      } else {
        report += `// Moderate elevation (${mountainPercent.toFixed(1)}% mountains)\n`;
      }
    }
    
    // Usage instructions
    report += `\n// ============================================================================\n`;
    report += `// USAGE INSTRUCTIONS\n`;
    report += `// ============================================================================\n\n`;
    
    report += `// To use these parameters in your game:\n`;
    report += `// 1. Copy the parameter values above\n`;
    report += `// 2. Paste them into server/js/genesis.js\n`;
    report += `// 3. Replace the existing parameter declarations\n`;
    report += `// 4. Restart your game server to generate new maps\n\n`;
    
    report += `// Note: These parameters were optimized for a 192x192 tile map.\n`;
    report += `// Adjust canvasSize parameter if using different map dimensions.\n`;
    
    return report;
  }
  
  generateCompactReport() {
    const params = this.mapControls.getCurrentParams();
    const mapData = this.mapViewer.getCurrentMapData();
    
    let report = `// MapModeler Compact Export - ${new Date().toLocaleString()}\n\n`;
    
    report += `// Red Channel\n`;
    report += `${params.redFrequencyX}, ${params.redFrequencyY}, ${params.redAmplitude}, ${params.redOffset}\n\n`;
    
    report += `// Green Channel\n`;
    report += `${params.greenFrequencyX}, ${params.greenFrequencyY}, ${params.greenAmplitude}, ${params.greenOffset}\n\n`;
    
    report += `// Blue Channel\n`;
    report += `${params.blueFrequencyX}, ${params.blueFrequencyY}, ${params.blueAmplitude}, ${params.blueOffset}\n\n`;
    
    report += `// Thresholds\n`;
    report += `${params.waterThreshold}, ${params.mountainThreshold}, ${params.rocksThreshold}, ${params.brushThreshold}, ${params.lightForestThreshold}\n`;
    
    return report;
  }
  
  generateJSONReport() {
    const params = this.mapControls.getCurrentParams();
    const mapData = this.mapViewer.getCurrentMapData();
    
    const report = {
      timestamp: new Date().toISOString(),
      parameters: params,
      mapInfo: {
        size: mapData.mapSize,
        canvasSize: mapData.canvasSize
      },
      distribution: mapData.distribution
    };
    
    return JSON.stringify(report, null, 2);
  }
  
  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      return false;
    }
  }
  
  downloadReport(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MapExporter;
} else {
  window.MapExporter = MapExporter;
}

