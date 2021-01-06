var USE_DB = true;
var mongojs = USE_DB ? require('mongojs') : null;
var db = USE_DB ? mongojs('localhost:27017/stronghodl',['account','progress']) : null;

isValidPassword = function(data,cb){
  if(!USE_DB){
    return cb(true);
  } else {
    db.account.find({username:data.name,password:data.password},function(err,res){
      if(res.length > 0)
        cb(true);
      else
        cb(false);
    });
  }
};

isUsernameTaken = function(data,cb){
  if(!USE_DB){
    return cb(true);
  } else {
    db.account.find({username:data.name},function(err,res){
      if(res.length > 0)
        cb(true);
      else
        cb(false);
    });
  }
};

addUser = function(data,cb){
  if(!USE_DB){
    return cb();
  } else {
    db.account.insert({username:data.name,password:data.password},function(err){
      cb();
    });
  }
};

getPlayerProgress = function(username,cb){
  if(!USE_DB){
    return cb({});
  } else {
    db.progress.findOne({username:username},function(err,res){
      cb({});
    })
  }
};

savePlayerProgress = function(data,cb){
  cb = cb || function(){};
  if(!USE_DB){
    return cb();
  } else {
    db.progress.update({username:data.name},data,{upsert:true},cb);
  }
};
