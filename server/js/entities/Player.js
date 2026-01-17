function getPlayerConstructor() {
  return global.Player;
}

module.exports = {
  get Player() {
    return global.Player;
  },
  getPlayerConstructor
};
