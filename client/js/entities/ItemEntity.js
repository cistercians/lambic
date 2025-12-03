function ItemEntity(initPack){
  // Ensure Item.list exists (preserve from early initialization)
  if(!Item.list) Item.list = {};
  var self = {};
  self.id = initPack.id;
  self.type = initPack.type;
  self.x = initPack.x;
  self.y = initPack.y;
  self.z = initPack.z;
  self.qty = initPack.qty;
  self.innaWoods = initPack.innaWoods;
  self.sunk = initPack.sunk || false;

  // Item rendering extracted to ItemRenderer.js
  // Use ItemRenderer.render() instead
  self.draw = function(){
    if (typeof ItemRenderer !== 'undefined' && ItemRenderer.render) {
      // Pass animation frame arrays for animated items (Furnace, Fireplace, etc.)
      var animatedFrames = {
        torchFlame: typeof torchFlame !== 'undefined' ? torchFlame : [],
        wtorchFlame: typeof wtorchFlame !== 'undefined' ? wtorchFlame : [],
        fireFlame: typeof fireFlame !== 'undefined' ? fireFlame : [],
        firepitFlame: typeof firepitFlame !== 'undefined' ? firepitFlame : [],
        fireplaceFlame: typeof fireplaceFlame !== 'undefined' ? fireplaceFlame : [],
        forgeFlame: typeof forgeFlame !== 'undefined' ? forgeFlame : [],
        frameIndex: typeof flm !== 'undefined' ? flm : 0
      };
      var cameraPos = getCameraPosition();
      return ItemRenderer.render(self, ctx, {
        Img: Img,
        cameraPos: cameraPos,
        WIDTH: WIDTH,
        HEIGHT: HEIGHT,
        tileSize: tileSize,
        animatedFrames: animatedFrames
      });
    }
    // Legacy fallback - keep minimal implementation for backward compatibility
    var cameraPos = getCameraPosition();
    if(self.type == 'Wood'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.wood3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.wood2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.wood1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Stone'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.stone2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.stone1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Grain'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 9){
        ctx.drawImage(
        Img.grain3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.grain2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.grain1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'IronOre'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.ore1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Iron'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.ironbars,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.ironbar,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Steel'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.steelbars,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.steelbar,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'BoarHide'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.boarhides,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.boarhide,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Leather'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.leathers,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.leather,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'SilverOre'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.ore1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Silver'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 999){
        ctx.drawImage(
        Img.silver9,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 499){
        ctx.drawImage(
        Img.silver8,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 249){
        ctx.drawImage(
        Img.silver7,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 99){
        ctx.drawImage(
        Img.silver6,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 49){
        ctx.drawImage(
        Img.silver5,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 24){
        ctx.drawImage(
        Img.silver4,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 9){
        ctx.drawImage(
        Img.silver3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.silver2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.silver1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'GoldOre'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.ore2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Gold'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 999){
        ctx.drawImage(
        Img.gold9,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 499){
        ctx.drawImage(
        Img.gold8,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 249){
        ctx.drawImage(
        Img.gold7,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 99){
        ctx.drawImage(
        Img.gold6,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 49){
        ctx.drawImage(
        Img.gold5,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 24){
        ctx.drawImage(
        Img.gold4,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 9){
        ctx.drawImage(
        Img.gold3,
        x,
        y,
        tileSize,
        tileSize
        );
      } else if(self.qty > 4){
        ctx.drawImage(
        Img.gold2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.gold1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Diamond'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.diamonds,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.diamond,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'HuntingKnife'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger1,
      x,
      y,
      tileSize,
      tileSize
      );
    }else if(self.type == 'Dague'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Rondel'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Misericorde'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dagger3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'BastardSword'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Longsword'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Zweihander'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Morallta'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sword3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Bow'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.bow,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'WelshLongbow'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.longbow,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'KnightLance'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.lance1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'RusticLance'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.lance1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'PaladinLance'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.lance2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Brigandine'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.leathergarb,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Lamellar'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.leathergarb,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Maille'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Hauberk'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Brynja'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chainmail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Cuirass'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'SteelPlate'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'GreenwichPlate'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'GothicPlate'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.plate3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'ClericRobe'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.robe1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'MonkCowl'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.robe2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'BlackCloak'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.robe3,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Tome'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.tome,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'RunicScroll'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.scroll,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'SacredText'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.sacredtext,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Stoneaxe' || self.type == 'IronAxe'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.axe,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Pickaxe'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.pickaxe,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Key'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.key,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Torch'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
        Img.torch,
        x,
        y,
        tileSize,
        tileSize
      );
    } else if(self.type == 'LitTorch'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      torchFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'WallTorch'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      wtorchFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Campfire'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      fireFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Firepit'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      firepitFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Fireplace'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      fireplaceFlame[flm],
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Furnace'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      forgeFlame[flm],
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Barrel'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.barrel,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Crates'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.crates,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Bookshelf'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.bookshelf,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'SuitArmor'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.suitarmor,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Anvil'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.anvil,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Runestone'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.runestone,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Dummy'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.dummy,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Cross'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.cross,
      x,
      y,
      tileSize * 2,
      tileSize * 1.5
      );
    } else if(self.type == 'Skeleton1'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.skeleton1,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Skeleton2'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.skeleton2,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'shipwreckage'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      // Use death1 (floating) or death2 (sunk) based on sunk property
      var wreckageImg = self.sunk ? Img.shipwreckagesunk : Img.shipwreckage;
      ctx.drawImage(
        wreckageImg,
        x,
        y,
        tileSize * 2, // Wreckage is 2x2 tiles like the ship was
        tileSize * 2
      );
    } else if(self.type == 'Goods1'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods1,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Goods2'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods2,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Goods3'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods3,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Goods4'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.goods4,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Stash1'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.stash1,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Stash2'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.stash2,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Desk'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.desk,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Swordrack'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.swordrack,
      x,
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Bed'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.bed,
      x,
      y,
      tileSize * 2,
      tileSize * 2
      );
    } else if(self.type == 'Jail'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.jail,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'JailDoor'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.jaildoor,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Chains'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chains,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Throne'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.throne,
      x + (tileSize/2),
      y,
      tileSize,
      tileSize * 1.5
      );
    } else if(self.type == 'Banner'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.banner,
      x ,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'StagHead'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.staghead,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Blood'){ // MUST ONLY SEE WITH TRACKER SKILL !!!
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.blood,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Chest'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chest,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'LockedChest'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.chest,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Bread'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.breads,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bread,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Fish'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.fishes,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.fish,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Lamb'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'BoarMeat'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Venison'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.rawmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.rawmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'PoachedFish'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.poachedfishes,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.poachedfish,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'LambChop'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'BoarShank'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'VenisonLoin'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 4){
        ctx.drawImage(
        Img.cookedmeats,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.cookedmeat,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Mead' || self.type == 'Saison'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.beers,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.beer,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Flanders' || self.type == 'BiereDeGarde'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.bottles1,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bottle1,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Bordeaux' || self.type == 'Bourgogne' || self.type == 'Chianti'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      if(self.qty > 2){
        ctx.drawImage(
        Img.bottles2,
        x,
        y,
        tileSize,
        tileSize
        );
      } else {
        ctx.drawImage(
        Img.bottle2,
        x,
        y,
        tileSize,
        tileSize
        );
      }
    } else if(self.type == 'Crown'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.crown,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Arrows'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.arrows,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'WorldMap'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.map,
      x,
      y,
      tileSize,
      tileSize
      );
    } else if(self.type == 'Relic'){
      var x = self.x - cameraPos.x + WIDTH/2;
      var y = self.y - cameraPos.y + HEIGHT/2;
      ctx.drawImage(
      Img.relic,
      x,
      y,
      tileSize,
      tileSize
      );
    }
  }

  Item.list[self.id] = self;
  return self;
}

// Expose to global scope for browser use
if (typeof window !== 'undefined') {
  window.ItemEntity = ItemEntity;
}

// Node.js export for server-side testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ItemEntity;
}
