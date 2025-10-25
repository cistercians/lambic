// Name Generator System
// Generates names for geographic features and faction towns from surnames.txt

const fs = require('fs');
const path = require('path');

class NameGenerator {
  constructor() {
    this.usedNames = new Set();
    this.availableNames = [];
    this.loadSurnames();
  }

  // Load and filter surnames from surnames.txt
  loadSurnames() {
    try {
      const surnamesPath = path.join(__dirname, '../../../surnames.txt');
      const surnamesContent = fs.readFileSync(surnamesPath, 'utf8');
      const surnames = surnamesContent.split('\n')
        .map(name => name.trim())
        .filter(name => name.length > 0)
        .filter(name => name.length >= 5 && name.length <= 8) // 5-8 letters
        .filter(name => /^[a-zA-Z]+$/.test(name)); // Only letters
      
      this.availableNames = surnames;
    } catch (error) {
      console.error('❌ Failed to load surnames.txt:', error);
      // Fallback names
      this.availableNames = [
        'Thornwick', 'Shadowhaven', 'Ironhold', 'Goldcrest', 'Silverbrook',
        'Blackstone', 'Whitecliff', 'Redwood', 'Greenfield', 'Bluewater',
        'Northgate', 'Southport', 'Eastford', 'Westbrook', 'Centralton'
      ];
    }
  }

  // Generate a unique name for a geographic feature
  generateFeatureName(feature) {
    const baseName = this.getRandomName();
    const formattedName = this.formatFeatureName(feature.type, baseName);
    
    // Ensure uniqueness
    let finalName = formattedName;
    let counter = 1;
    
    while (this.usedNames.has(finalName)) {
      // Try different approaches for uniqueness
      if (counter <= 10) {
        finalName = `${formattedName} ${counter}`;
      } else {
        // Fallback to timestamp-based naming if too many duplicates
        const timestamp = Date.now().toString().slice(-4);
        finalName = `${formattedName} ${timestamp}`;
      }
      counter++;
    }
    
    this.usedNames.add(finalName);
    return finalName;
  }

  // Generate a unique name for a faction town
  generateTownName() {
    const baseName = this.getRandomName();
    
    // Ensure uniqueness
    let finalName = baseName;
    let counter = 1;
    
    while (this.usedNames.has(finalName)) {
      finalName = `${baseName} ${counter}`;
      counter++;
    }
    
    this.usedNames.add(finalName);
    return finalName;
  }

  // Format feature name based on type
  formatFeatureName(type, baseName) {
    switch (type) {
      case 'lake':
        return `Lake ${baseName}`;
      case 'sea':
        return `${baseName} Sea`;
      case 'woods':
        return `${baseName} Woods`;
      case 'forest':
        return `${baseName} Forest`;
      case 'plains':
        return `${baseName} Plains`;
      case 'mountain':
        return `Mount ${baseName}`;
      case 'mountain_range':
        return `${baseName} Mountains`;
      case 'mountain_peak':
        return `Mount ${baseName}`;
      case 'hill':
        return `${baseName} Hill`;
      case 'hill_group':
        return `${baseName} Hills`;
      case 'hill_cluster':
        return `${baseName} Hills`;
      case 'hill_peak':
        return `${baseName} Hill`;
      case 'island':
        return `${baseName} Island`;
      case 'meadow':
        return `${baseName} Meadow`;
      case 'water':
        return `${baseName} Waters`;
      default:
        return baseName;
    }
  }

  // Format feature name with directional prefix
  formatFeatureNameWithDirection(baseName, featureType, direction) {
    const baseFormatted = this.formatFeatureName(baseName, featureType);
    
    // Add directional prefix
    switch (direction) {
      case 'North':
        return `North ${baseFormatted}`;
      case 'South':
        return `South ${baseFormatted}`;
      case 'East':
        return `East ${baseFormatted}`;
      case 'West':
        return `West ${baseFormatted}`;
      default:
        return baseFormatted;
    }
  }

  // Get a random name from available surnames
  getRandomName() {
    if (this.availableNames.length === 0) {
      return `Place${Math.floor(Math.random() * 1000)}`;
    }
    
    // Use crypto.randomInt for better randomization if available, otherwise Math.random
    let randomIndex;
    if (typeof crypto !== 'undefined' && crypto.randomInt) {
      randomIndex = crypto.randomInt(0, this.availableNames.length);
    } else {
      randomIndex = Math.floor(Math.random() * this.availableNames.length);
    }
    
    return this.availableNames[randomIndex];
  }

  // Assign names to all features, handling compound naming
  assignNames(features) {
    // Sort features by size (larger features get names first)
    const sortedFeatures = features.sort((a, b) => b.size - a.size);
    
    // Assign names to features
    sortedFeatures.forEach(feature => {
      if (!feature.name) {
        feature.name = this.generateFeatureName(feature);
      }
    });
    
    // Handle compound naming for adjacent features
    this.assignCompoundNames(sortedFeatures);
    
    return sortedFeatures;
  }

  // Assign compound names to adjacent features
  assignCompoundNames(features) {
    // Disable compound naming for now to prevent duplicates
    // This was causing adjacent features to get the same name
    return;
    
    features.forEach(feature => {
      if (feature.adjacentFeatures && feature.adjacentFeatures.length > 0) {
        // Find the largest adjacent feature to share the base name
        let largestAdjacent = null;
        let largestSize = 0;
        
        feature.adjacentFeatures.forEach(adjId => {
          const adjFeature = features.find(f => f.id === adjId);
          if (adjFeature && adjFeature.size > largestSize) {
            largestAdjacent = adjFeature;
            largestSize = adjFeature.size;
          }
        });
        
        if (largestAdjacent && largestAdjacent.name) {
          // Extract base name from the largest feature
          const baseName = this.extractBaseName(largestAdjacent.name, largestAdjacent.type);
          
          // Reassign name using the same base name
          feature.name = this.formatFeatureName(feature.type, baseName);
          
          // Mark the base name as used
          this.usedNames.add(feature.name);
        }
      }
    });
  }

  // Extract base name from a formatted feature name
  extractBaseName(formattedName, type) {
    switch (type) {
      case 'lake':
        return formattedName.replace('Lake ', '');
      case 'sea':
        return formattedName.replace(' Sea', '');
      case 'woods':
        return formattedName.replace(' Woods', '');
      case 'forest':
        return formattedName.replace(' Forest', '');
      case 'plains':
        return formattedName.replace(' Plains', '');
      case 'mountain':
        return formattedName.replace('Mount ', '');
      case 'mountain_range':
        return formattedName.replace(' Mountains', '');
      case 'mountain_peak':
        return formattedName.replace('Mount ', '');
      case 'hill':
        return formattedName.replace(' Hill', '');
      case 'hill_group':
        return formattedName.replace(' Hills', '');
      case 'hill_cluster':
        return formattedName.replace(' Hills', '');
      case 'hill_peak':
        return formattedName.replace(' Hill', '');
      case 'island':
        return formattedName.replace(' Island', '');
      case 'meadow':
        return formattedName.replace(' Meadow', '');
      case 'water':
        return formattedName.replace(' Waters', '');
      default:
        return formattedName;
    }
  }

  // Check if a name is already used
  isNameUsed(name) {
    return this.usedNames.has(name);
  }

  // Get statistics about name usage
  getStats() {
    return {
      totalNamesUsed: this.availableNames.length,
      namesUsed: this.usedNames.size,
      namesAvailable: this.availableNames.length - this.usedNames.size
    };
  }
}

module.exports = NameGenerator;
