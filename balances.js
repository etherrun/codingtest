class Balances {
  constructor() {
    this.balanceMap = new Map();
  }  
  cleanup() {
    this.balanceMap = new Map();
  }
  knownAssets() {
    return Array.from(this.balanceMap.keys());
  }
  hasAsset(asset) {
    return this.balanceMap.has(asset);
  }
  setBalance(asset, value) {
    this.balanceMap.set(asset, value);
  }
  getBalance(asset) {
    if (this.hasAsset(asset) === false) {
      throw `Unknown asset ${asset}`
    }
    return this.balanceMap.get(asset);
  }
  changeBalanceBy(asset, change) {
    if (this.hasAsset(asset) === false) {
      throw `Unknown asset ${asset}`
    }
    this.setBalance(asset, this.getBalance(asset)+change);
  }
}

const balances = new Balances();

module.exports = balances;
