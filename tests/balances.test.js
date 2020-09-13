const balances = require("../balances");

describe("balances", () => {
  it("should know no assets after setup", (done) => {
    balances.cleanup();
    expect(balances.knownAssets().length).toBe(0);
    done();
  });
  it("should know assets with correct balances", (done) => {
    balances.setBalance("USD",2000.0);
    expect(balances.knownAssets().length).toBe(1);
    expect(balances.hasAsset("USD")).toBe(true);
    expect(balances.getBalance("USD")).toBe(2000.0);
    expect(balances.hasAsset("ETH")).toBe(false);
    balances.setBalance("ETH",10.0);
    expect(balances.knownAssets().length).toBe(2);
    expect(balances.hasAsset("ETH")).toBe(true);
    expect(balances.getBalance("ETH")).toBe(10.0);
    done();
  });
  it("should increase and decrease balances correctly", (done) => {
    expect(balances.getBalance("ETH")).toBe(10.0);
    balances.changeBalanceBy("ETH", 1.0);
    expect(balances.getBalance("ETH")).toBe(11.0);
    balances.changeBalanceBy("ETH", -2.0);
    expect(balances.getBalance("ETH")).toBe(9.0);
    done();
  });
  it("should fail for unknown assets", (done) => {
    expect(() => balances.getBalance("XYZ")).toThrow();
    expect(() => balances.changeBalanceBy("XYZ", 5.0)).toThrow();
    done();
  });
});
