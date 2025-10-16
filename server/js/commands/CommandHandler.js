// Base Command Class
class BaseCommand {
  constructor(name) {
    this.name = name;
  }
  
  execute(player, args, socket) {
    throw new Error(`Command ${this.name} not implemented`);
  }
  
  validateArgs(args, expectedCount) {
    if (args.length !== expectedCount) {
      return { valid: false, message: `Expected ${expectedCount} arguments, got ${args.length}` };
    }
    return { valid: true };
  }
  
  sendMessage(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message }));
  }
  
  sendError(socket, message) {
    this.sendMessage(socket, `<i>Error: ${message}</i>`);
  }
}

// Drop Command - Handles all item dropping
class DropCommand extends BaseCommand {
  constructor() {
    super('drop');
  }
  
  execute(player, args, socket) {
    if (args.length < 2) {
      this.sendError(socket, 'Usage: /drop <item> <quantity>');
      return;
    }
    
    const [itemType, quantity] = args;
    const qty = parseInt(quantity);
    
    if (isNaN(qty) || qty <= 0) {
      this.sendError(socket, 'Quantity must be a positive number');
      return;
    }
    
    if (!player.inventory[itemType] || player.inventory[itemType] < qty) {
      this.sendError(socket, 'You do not have that many items');
      return;
    }
    
    // Get drop location based on player facing direction
    const dropLocation = this.getDropLocation(player);
    
    // Create the item using global factory
    if (!global.itemFactory) {
      this.sendError(socket, 'Item factory not initialized');
      return;
    }
    
    const item = global.itemFactory.createItem(itemType, {
      x: dropLocation.x,
      y: dropLocation.y,
      z: dropLocation.z,
      qty: qty,
      parent: player.id
    });
    
    if (item) {
      // Remove from player inventory
      player.inventory[itemType] -= qty;
      
      this.sendMessage(socket, `<i>You dropped ${qty} ${itemType}</i>`);
    } else {
      this.sendError(socket, `Unknown item type: ${itemType}`);
    }
  }
  
  getDropLocation(player) {
    const offsets = {
      up: { x: 0, y: -64 },
      down: { x: 0, y: 64 },
      left: { x: -64, y: 0 },
      right: { x: 64, y: 0 }
    };
    
    const offset = offsets[player.facing] || offsets.down;
    return {
      x: player.x + offset.x,
      y: player.y + offset.y,
      z: player.z
    };
  }
}

// Give Command - Gives items to player
class GiveCommand extends BaseCommand {
  constructor() {
    super('give');
  }
  
  execute(player, args, socket) {
    if (args.length < 2) {
      this.sendError(socket, 'Usage: /give <item> <quantity>');
      return;
    }
    
    const [itemType, quantity] = args;
    const qty = parseInt(quantity);
    
    if (isNaN(qty) || qty <= 0) {
      this.sendError(socket, 'Quantity must be a positive number');
      return;
    }
    
    // Add to player inventory
    if (!player.inventory[itemType]) {
      player.inventory[itemType] = 0;
    }
    
    player.inventory[itemType] += qty;
    this.sendMessage(socket, `<i>You received ${qty} ${itemType}</i>`);
  }
}

// Bag Command - Shows inventory
class BagCommand extends BaseCommand {
  constructor() {
    super('bag');
  }
  
  execute(player, args, socket) {
    const items = [];
    
    for (const key in player.inventory) {
      if (player.inventory[key] > 0 && key !== 'keyRing') {
        const displayName = key.charAt(0).toUpperCase() + key.slice(1);
        items.push(`<b>${displayName}</b>: ${player.inventory[key]}`);
      }
    }
    
    if (items.length === 0) {
      this.sendMessage(socket, '<i>You have nothing in your bag.</i>');
    } else {
      this.sendMessage(socket, `<p>${items.join('<br>')}</p>`);
    }
  }
}

// Test Item Command - Spawns test items
class TestItemCommand extends BaseCommand {
  constructor() {
    super('testitem');
  }

  execute(player, args, socket) {
    if (!global.getLoc || !global.getCoords) {
      this.sendError(socket, 'Game systems not initialized');
      return;
    }

    const loc = global.getLoc(player.x, player.y);
    const coords = global.getCoords(loc[0], loc[1]);

    // Spawn test items around player
    const testItems = [
      { type: 'wood', qty: 5, x: coords[0] + 50, y: coords[1] },
      { type: 'stone', qty: 3, x: coords[0] - 50, y: coords[1] },
      { type: 'iron', qty: 2, x: coords[0], y: coords[1] + 50 }
    ];

    if (global.itemFactory) {
      testItems.forEach(itemData => {
        global.itemFactory.createItem(itemData.type, {
          x: itemData.x,
          y: itemData.y,
          z: player.z,
          qty: itemData.qty,
          parent: player.id
        });
      });
    } else {
      this.sendError(socket, 'Item factory not initialized');
      return;
    }

    this.sendMessage(socket, '<i>Test items spawned around you. Press P to pick them up!</i>');
  }
}

// Fire Command - Lights torch
class FireCommand extends BaseCommand {
  constructor() {
    super('fire');
  }

  execute(player, args, socket) {
    if (player.inventory.torch > 0) {
      player.inventory.torch--;
      player.hasTorch = true;
      this.sendMessage(socket, '<i>You light a torch</i>');
    } else {
      this.sendError(socket, 'You need a torch to light');
    }
  }
}

// Equip Command - Equips weapons and armor
class EquipCommand extends BaseCommand {
  constructor() {
    super('equip');
  }

  execute(player, args, socket) {
    if (args.length < 1) {
      this.sendError(socket, 'Usage: /equip <item>');
      return;
    }

    const item = args[0].toLowerCase();
    
    if (!player.inventory[item] || player.inventory[item] <= 0) {
      this.sendError(socket, `You don't have a ${item}`);
      return;
    }

    // Define equipment categories
    const weapons = ['huntingknife', 'dague', 'rondel', 'misericorde', 'bastardsword', 'longsword', 'zweihander', 'morallta', 'bow', 'welshlongbow', 'knightlance', 'rusticlance', 'paladinlance'];
    const armor = ['brigandine', 'lamellar', 'maille', 'hauberk', 'brynja', 'cuirass', 'steelplate', 'greenwichplate', 'gothicplate', 'clericrobe', 'monkcowl', 'blackcloak'];
    const accessories = ['crown'];

    if (weapons.includes(item)) {
      if (!player.gear.weapon) {
        player.gear.weapon = item;
        player.inventory[item]--;
        this.sendMessage(socket, `<i>You equip ${item}</i>`);
      } else {
        this.sendError(socket, 'You already have a weapon equipped. Use /unequip weapon first.');
      }
    } else if (armor.includes(item)) {
      if (!player.gear.armor) {
        player.gear.armor = item;
        player.inventory[item]--;
        this.sendMessage(socket, `<i>You equip ${item}</i>`);
      } else {
        this.sendError(socket, 'You already have armor equipped. Use /unequip armor first.');
      }
    } else if (accessories.includes(item)) {
      if (!player.gear.accessory) {
        player.gear.accessory = item;
        player.inventory[item]--;
        this.sendMessage(socket, `<i>You equip ${item}</i>`);
      } else {
        this.sendError(socket, 'You already have an accessory equipped. Use /unequip accessory first.');
      }
    } else {
      this.sendError(socket, `${item} cannot be equipped`);
    }
  }
}

// Unequip Command - Unequips gear
class UnequipCommand extends BaseCommand {
  constructor() {
    super('unequip');
  }

  execute(player, args, socket) {
    if (args.length < 1) {
      this.sendError(socket, 'Usage: /unequip <slot>');
      return;
    }

    const slot = args[0].toLowerCase();

    if (slot === 'weapon' && player.gear.weapon) {
      player.inventory[player.gear.weapon]++;
      player.gear.weapon = null;
      this.sendMessage(socket, '<i>You unequip your weapon</i>');
    } else if (slot === 'armor' && player.gear.armor) {
      player.inventory[player.gear.armor]++;
      player.gear.armor = null;
      this.sendMessage(socket, '<i>You unequip your armor</i>');
    } else if (slot === 'accessory' && player.gear.accessory) {
      player.inventory[player.gear.accessory]++;
      player.gear.accessory = null;
      this.sendMessage(socket, '<i>You unequip your accessory</i>');
    } else {
      this.sendError(socket, `Nothing equipped in ${slot} slot`);
    }
  }
}

// Take Command - Takes items from containers
class TakeCommand extends BaseCommand {
  constructor() {
    super('take');
  }

  execute(player, args, socket) {
    if (args.length < 1) {
      this.sendError(socket, 'Usage: /take <item>');
      return;
    }

    const item = args[0].toLowerCase();
    const loc = global.getLoc(player.x, player.y);
    
    // Find nearby chests/containers
    for (const i in global.Item.list) {
      const container = global.Item.list[i];
      if (container.z === player.z && 
          Math.abs(container.x - player.x) < 64 && 
          Math.abs(container.y - player.y) < 64) {
        
        if (container.inventory && container.inventory[item] > 0) {
          const qty = Math.min(container.inventory[item], 10); // Take up to 10
          container.inventory[item] -= qty;
          player.inventory[item] = (player.inventory[item] || 0) + qty;
          this.sendMessage(socket, `<i>You take ${qty} ${item}</i>`);
          return;
        }
      }
    }
    
    this.sendError(socket, `No ${item} found nearby`);
  }
}

// Train Command - Trains units
class TrainCommand extends BaseCommand {
  constructor() {
    super('train');
  }

  execute(player, args, socket) {
    if (args.length < 1) {
      this.sendError(socket, 'Usage: /train <unit_type>');
      return;
    }

    const unitType = args[0].toLowerCase();
    const loc = global.getLoc(player.x, player.y);
    const building = global.getBuilding(player.x, player.y);
    
    if (!building || !global.Building.list[building]) {
      this.sendError(socket, 'You must be at a building to train units');
      return;
    }

    const b = global.Building.list[building];
    
    if (unitType === 'skirmisher') {
      if (player.inventory.wood >= 10 && player.inventory.stone >= 5) {
        player.inventory.wood -= 10;
        player.inventory.stone -= 5;
        // Create skirmisher unit logic would go here
        this.sendMessage(socket, '<i>Skirmisher trained</i>');
      } else {
        this.sendError(socket, 'Need 10 wood and 5 stone to train skirmisher');
      }
    } else if (unitType === 'cavalier') {
      if (player.inventory.wood >= 20 && player.inventory.iron >= 10) {
        player.inventory.wood -= 20;
        player.inventory.iron -= 10;
        // Create cavalier unit logic would go here
        this.sendMessage(socket, '<i>Cavalier trained</i>');
      } else {
        this.sendError(socket, 'Need 20 wood and 10 iron to train cavalier');
      }
    } else {
      this.sendError(socket, `Unknown unit type: ${unitType}`);
    }
  }
}

// House Command - Manages house/kingdom
class HouseCommand extends BaseCommand {
  constructor() {
    super('house');
  }

  execute(player, args, socket) {
    if (args.length < 1) {
      this.sendError(socket, 'Usage: /house <action>');
      return;
    }

    const action = args[0].toLowerCase();
    
    if (action === 'join') {
      if (args.length < 2) {
        this.sendError(socket, 'Usage: /house join <house_name>');
        return;
      }
      
      const houseName = args[1];
      player.house = houseName;
      this.sendMessage(socket, `<i>Joined house: ${houseName}</i>`);
    } else if (action === 'leave') {
      player.house = null;
      this.sendMessage(socket, '<i>Left your house</i>');
    } else if (action === 'info') {
      const houseInfo = player.house ? `House: ${player.house}` : 'No house';
      const kingdomInfo = player.kingdom ? `Kingdom: ${player.kingdom}` : 'No kingdom';
      this.sendMessage(socket, `<i>${houseInfo}<br>${kingdomInfo}</i>`);
    } else {
      this.sendError(socket, `Unknown house action: ${action}`);
    }
  }
}

// Teleport Command - Teleports player to specified coordinates
class TeleportCommand extends BaseCommand {
  constructor() {
    super('tport');
  }

  execute(player, args, socket) {
    if (args.length < 3) {
      this.sendError(socket, 'Usage: /tport <z> <x> <y>');
      return;
    }

    const z = Number(args[0]);
    const x = Number(args[1]);
    const y = Number(args[2]);

    if (isNaN(z) || isNaN(x) || isNaN(y)) {
      this.sendError(socket, 'All coordinates must be numbers');
      return;
    }

    // Convert tile coordinates to pixel coordinates
    const coords = global.getCenter(x, y);
    
    player.z = z;
    player.x = coords[0];
    player.y = coords[1];

    this.sendMessage(socket, `<i>Teleported to z:${z}, x:${x}, y:${y}</i>`);
  }
}

// Command Handler - Manages all commands
class CommandHandler {
  constructor() {
    this.commands = new Map();
    this.registerCommands();
  }
  
  registerCommands() {
    this.commands.set('drop', new DropCommand());
    this.commands.set('give', new GiveCommand());
    this.commands.set('bag', new BagCommand());
    this.commands.set('testitem', new TestItemCommand());
    this.commands.set('tport', new TeleportCommand());
    this.commands.set('fire', new FireCommand());
    this.commands.set('equip', new EquipCommand());
    this.commands.set('unequip', new UnequipCommand());
    this.commands.set('take', new TakeCommand());
    this.commands.set('train', new TrainCommand());
    this.commands.set('house', new HouseCommand());
  }
  
  execute(cmd, player, socket) {
    const [commandName, ...args] = cmd.split(' ');
    const command = this.commands.get(commandName);
    
    if (!command) {
      this.sendError(socket, `Unknown command: ${commandName}`);
      return;
    }
    
    try {
      command.execute(player, args, socket);
    } catch (error) {
      console.error(`Error executing command ${commandName}:`, error);
      this.sendError(socket, 'Command execution failed');
    }
  }
  
  sendError(socket, message) {
    socket.write(JSON.stringify({ msg: 'addToChat', message: `<i>Error: ${message}</i>` }));
  }
}

// Export for use in main server
module.exports = {
  BaseCommand,
  DropCommand,
  GiveCommand,
  BagCommand,
  TestItemCommand,
  TeleportCommand,
  FireCommand,
  EquipCommand,
  UnequipCommand,
  TakeCommand,
  TrainCommand,
  HouseCommand,
  CommandHandler
};
