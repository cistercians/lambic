TAFFY = require('taffy');

ACCOUNTS = TAFFY([
  {"name":"lol","pass":"lol"}
]);

isValidPassword = function(data,cb){
  if(ACCOUNTS({name:data.name,pass:data.pass}).count() > 0){
    cb(true);
  } else {
    cb(false);
  }
};

isUsernameTaken = function(data,cb){
  if(ACCOUNTS({name:data}).count() > 0){
    cb(true)
  } else {
    cb(false)
  }
};

addUser = function(data,cb){
  ACCOUNTS.insert({name:data.name,pass:data.pass});
  cb();
};
