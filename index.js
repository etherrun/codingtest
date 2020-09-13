const fetch = require("node-fetch");

// orders placed will have a random price 5% around the best bid/ask
const RANDOM_PERCENT = 5;
// we place 5 bids and asks
const NUM_ORDERS = 5;
// The random size was not specified. I pick a range:
const MINIMUM_AMOUNT=0.1
const MAXIMUM_AMOUNT=2.0;
// Display balances every 30 seconds
const BALANCES_INTERVAL = 30*1000;
// refresh orderbook every 5 seconds
const ORDERBOOK_INTERVAL = 5*1000;
// Wether or not filled orders will be replenished
const REPLENISH_ORDERS = true;
// Wether or not unfilled orders will be cancelled after each orderbook update
// Set to true if you want more action (i.e. lose money faster)
// As this is a market making bot, the bids/asks should probably change every time the market moves.
const CANCEL_UNFILLED = true;
// Not required, but for my viewing pleasure:
const FORMAT_VALUES = true;
const SHOW_PROFIT_LOSS = true;

const BASE_ASSET = "ETH"; // base asset
const COUNTER_ASSET = "USD"; // counter asset

// keep track of balances per asset
const balances = require("./balances");
balances.setBalance(BASE_ASSET, 10.0);
balances.setBalance(COUNTER_ASSET, 2000.0);

// Not as per specification, but I want to see any profit/loss
let midPrice;
let initialValue;

// Format displayed values to show less decimals. Not required, but output is easier on the eye
function format(value) {
  if (FORMAT_VALUES) {
     return `${value > 0.0 ? "+":""}${value.toFixed(4)}`;
  }
  return value;
}

// the asset balances need to be displayed every thirty seconds
// call function immediately
(function displayBalances() {
  function profitLoss() {
    if (SHOW_PROFIT_LOSS && initialValue !== undefined && midPrice !== undefined) {
      const currentValue = balances.getBalance(COUNTER_ASSET) + balances.getBalance(BASE_ASSET)*midPrice;
      const profit = currentValue - initialValue;
      return `P&L:${format(profit)}`;
    }
    return "";
  }
  // display the balances
  console.log(`BALANCES: ${BASE_ASSET}:${format(balances.getBalance(BASE_ASSET))} ${COUNTER_ASSET}:${format(balances.getBalance(COUNTER_ASSET))} ${profitLoss()}`);
  // schedule next balance display in 30 seconds
  setTimeout(displayBalances, BALANCES_INTERVAL);
})();

// based on the sample code from the API doc.
// returns the orderbook on success or 'undefined' otherwise
async function requestOrderbook () {
  try {
    const parameter = {
      Symbol: `t${BASE_ASSET}${COUNTER_ASSET}`,
      Precision: "P0",
    };
    const url = `https://api.deversifi.com/bfx/v2/book/${parameter.Symbol}/${parameter.Precision}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });
    const orderbook = await response.json();
    return orderbook;
  } catch(error) {
    // always catch errors
    console.log(`ERROR: Could not fetch orderbook: ${error.message}`)
  }
  return undefined;
}

// for readability later on we define a few utility functions
const orderPrice = (order) => { return order[0]; } // first entry is the price
const orderCount = (order) => { return order[1]; } // second entry is the order count
const orderAmount = (order) => { return order[2]; } // thirs entry is the amount
const isBid = (order) => { return orderAmount(order) > 0; } // amount > 0 means it's a bid
const isAsk = (order) => { return orderAmount(order) < 0; } // amount < 0 means it's an ask

// request the orderbook, determine the top of market, notify callback
async function requestTopOfMarket(callback) {
  try {
    let bestBid = undefined;
    let bestAsk = undefined;
    // request orderbook via API call
    const orderbook = await requestOrderbook();
    if (orderbook !== undefined) {
      // looks at all orders and determine best bid and ask
      for (order of orderbook) {
        if (isBid(order)) { 
          if (bestBid === undefined || orderPrice(bestBid) < orderPrice(order)) {
            bestBid = order;
          }
        } else if (isAsk(order)) {
          if (bestAsk === undefined || orderPrice(bestBid) < orderPrice(order)) {
            bestAsk = order;
            // We could possibly stop the search here - needs clarification
            // The documentation doesn't explicitly state that the orderbook is ordered
          }
        } else {
          // Neither bid nor ask? Ignore for now - might log warning or error
        }
      } 
      // Not required, but allows calculation of profit/loss
      if (bestBid !== undefined && bestAsk !== undefined) {
        midPrice = (orderPrice(bestBid) + orderPrice(bestAsk)) / 2.0;
        if (initialValue === undefined) {
          initialValue = balances.getBalance(COUNTER_ASSET) + balances.getBalance(BASE_ASSET)*midPrice;
          //console.log(`Initial value: ${format(initialValue)}`);
        }
      }
      callback(bestBid,bestAsk);
    }
  } catch  (error) {
    console.error(`Error: Unable to determine top of market. ${error.message}`);
  }
  // after the first invocation we change the callback to the orderbook update handler
  // we determine a new top of market every 5 seconds
  setTimeout(() => requestTopOfMarket(handleOrderbookUpdate), ORDERBOOK_INTERVAL);
};

// Keep track of the random orders placed
const bidsPlaced = new Array(NUM_ORDERS);
const asksPlaced = new Array(NUM_ORDERS);

// place 5 random bids and asks as per specification
// Called after the first orderbook update is received
function placeOrders(bestBid, bestAsk) {
  function randomValue(minimum, maximum) { 
    return Math.random() * (maximum - minimum) + minimum; // (incl. minimum, excl. maximum)
  }
  function randomPrice(bestPrice) {
    const minimum = bestPrice * (1.0 - RANDOM_PERCENT/100.0); // 5 percent below best price
    const maximum = bestPrice * (1.0 + RANDOM_PERCENT/100.0); // 5 percent above best price
    return randomValue(minimum, maximum);
  }
  // place 5 random bids within 5 percent of best bid price
  for (let index = 0; index < NUM_ORDERS; index += 1) {
    // We fill all undefined orders in case this function should be reused to replenish orders later
    if (bidsPlaced[index] === undefined) {
      const price = randomPrice(orderPrice(bestBid));
      // the random amount is not well specified - let's pick a number between...
      const amount = randomValue(MINIMUM_AMOUNT, MAXIMUM_AMOUNT);
      bidsPlaced[index] = { price: price, amount: amount};
      console.log(`PLACE  BID @ ${format(price)} ${format(amount)}`);
    }
  }
  // place 5 random asks within 5 percent of best ask price
  for (let index = 0; index < NUM_ORDERS; index += 1) {
    if (asksPlaced[index] === undefined) {
      const price = randomPrice(orderPrice(bestAsk));
      // the random amount is not well specified - let's pick a number between...
      // amount for asks is negative - that's how bids and asks are distinguished
      const amount = -randomValue(MINIMUM_AMOUNT, MAXIMUM_AMOUNT);
      asksPlaced[index] = { price: price, amount: amount};
      console.log(`PLACE  ASK @ ${format(price)} ${format(amount)}`);
    }
  }
}

// once the orderbook has been received, this function determines which orders
// have been filled and if desired cancels unfilled orders or places new ones.
async function handleOrderbookUpdate(bestBid, bestAsk) {
  function orderFilled(order) {
    // handles both cases:
    // a) Our bid was filled. We buy amount ETH at that USD price
    // b) Our ask was filled. We sell amount ETH for that USD price
    const baseAssetChange = order.amount;
    const counterAssetChange = -order.amount*order.price;
    console.log(`FILLED ${order.amount > 0 ? "BID" : "ASK"} @ ${format(order.price)} ${format(order.amount)} (${BASE_ASSET} ${format(baseAssetChange)} ${COUNTER_ASSET} ${format(counterAssetChange)})`);
    balances.changeBalanceBy(BASE_ASSET, baseAssetChange);
    balances.changeBalanceBy(COUNTER_ASSET, counterAssetChange);
  }
  // Any bid orders that are above the best bid or sell orders that are below the best ask
  // should be considered filled and logged accordingly  
  for (let index = 0; index < NUM_ORDERS; index += 1) {
    const bid = bidsPlaced[index];
    if (bid !== undefined && bid.price > orderPrice(bestBid)) {
      orderFilled(bid);
      // remove the filled bid
      bidsPlaced[index] = undefined;
    }
  }
  for (let index = 0; index < NUM_ORDERS; index += 1) {
    const ask = asksPlaced[index];
    if (ask !== undefined && ask.price < orderPrice(bestAsk)) {
      orderFilled(ask);
      // remove the filled ask
      asksPlaced[index] = undefined;
    }
  }
  // If you you don't cancel unfilled orders the bot will get a bit boring after a short time
  if (CANCEL_UNFILLED) {
    for (let index = 0; index < NUM_ORDERS; index += 1) {
      bidsPlaced[index] = undefined;
      asksPlaced[index] = undefined;
    }
  }
  // It was not sure if the orders should be replenished or not, but it's more interesting if they are
  if (REPLENISH_ORDERS) {
    placeOrders(bestBid, bestAsk);
  }
}

// request the initial top of the market, place orders when done
requestTopOfMarket(placeOrders);
