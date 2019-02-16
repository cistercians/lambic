EvalCmd = function(data){
  var socket = SOCKET_LIST[data.id];
  var player = Player.list[data.id];

  // BUILDING
  if(data.cmd[0] === 'b' && data.cmd[1] === ' '){
    var loc = getLoc(player.x,player.y);
    var z = player.z;
    var c = loc[0];
    var r = loc[1];
    // farm
    if(data.cmd.slice(data.cmd.indexOf(' ') + 1) === 'farm' && z === 0){
      var plot = [[c,r],[c+1,r],[c+2,r],[c,r-1],[c+1,r-1],[c+2,r-1],[c,r-2],[c+1,r-2],[c+2,r-2]];
      var count = 0;
      for(i = 0; i < 9; i++){
        var n = plot[i];
        if(getTile(0,n[0],n[1]) === 7){
          count++;
        }
      }
      if(count === 9){
        player.working = true;
        setTimeout(function(){
          if(player.working){
            for(i = 0; i < 9; i++){
              var n = plot[i];
              world[0][n[1]][n[0]] = 8;
            }
            player.working = false;
            io.emit('mapEdit',world);
            Building({
              owner:player.id,
              x:0,
              y:player.y,
              z:player.z,
              type:'farm',
              dimension:tileSize*3,
              plot:plot,
              mats:null,
              hp:100
            });
          }
        },6000);
      } else {
        socket.emit('addToChat','DM: You cannot build that there.');
      }
    } // other buildings here...
  }
}
