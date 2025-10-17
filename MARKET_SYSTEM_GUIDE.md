# Market Orderbook System - Complete Guide

**Status**: ✅ FULLY IMPLEMENTED  
**Date**: October 17, 2025

---

## How to Use the Market

### 1. **View the Orderbook**
- Enter any Market building
- Go to the **first floor (z=1)**
- Hit **SPACEBAR** on any of the **Goods displays** (Goods1, Goods2, Goods3, Goods4)
- The orderbook will appear in chat showing:
  - Current sell orders (asks) - lowest prices first
  - Current buy orders (bids) - highest prices first
  - Emoji icons for each resource

### 2. **Place Orders**

#### Buy Order (Limit Order)
```
/buy [amount] [item] [price]
```
**Examples:**
- `/buy 100 grain 5` - Buy up to 100 grain at 5 silver each
- `/buy 50 ironore 12` - Buy up to 50 iron ore at 12 silver each

**What happens:**
1. System finds best sell orders ≤ your price
2. Fills immediately at those prices (you pay THEIR price, not yours)
3. Remaining amount goes on orderbook at YOUR price
4. Silver is reserved for queued orders

#### Sell Order (Limit Order)
```
/sell [amount] [item] [price]
```
**Examples:**
- `/sell 75 wood 10` - Sell up to 75 wood at 10 silver each
- `/sell 30 diamond 100` - Sell up to 30 diamonds at 100 silver each

**What happens:**
1. System finds best buy orders ≥ your price
2. Fills immediately at those prices (you get THEIR price, not yours)
3. Remaining amount goes on orderbook at YOUR price
4. Resources are reserved for queued orders

### 3. **View Your Orders**
```
/orders
```
Shows all your active buy and sell orders with:
- Resource type (with emoji)
- Amount remaining
- Price per unit
- Order ID (first 8 characters)

### 4. **Cancel Orders**
```
/cancel [orderID]
```
**Example:**
- `/cancel m123n456` - Use first 8 chars from `/orders`

**What happens:**
- Buy order: Silver is returned
- Sell order: Resources are returned

### 5. **Price Check** 💰
```
$[item]
```
**Examples:**
- `$ironore` - Show best buy/sell prices for iron ore
- `$grain` - Show grain prices
- `$diamond` - Show diamond prices

**What you see:**
- Best ask (lowest sell price) with available amount
- Best bid (highest buy price) with wanted amount
- Spread (difference between ask and bid)

**Example output:**
```
⛏️ IRONORE PRICES
SELL (Ask): 12 silver (30 available)
BUY (Bid): 8 silver (50 wanted)
Spread: 4 silver
```

### 6. **Market Broadcasting** 📢
When inside a Market building (z=1 or z=2), you'll see real-time updates:
- **Order fills**: `📊 PlayerName bought 50 🌾 grain @ 5 silver`
- **New bids**: `📊 New BID: PlayerName wants 100 🪵 wood @ 8 silver`
- **New asks**: `📊 New ASK: PlayerName selling 75 🪨 stone @ 10 silver`

This keeps all traders informed of market activity!

---

## Resource Types & Emojis

| Resource | Emoji | Name in Command |
|----------|-------|-----------------|
| Grain | 🌾 | `grain` |
| Wood | 🪵 | `wood` |
| Stone | 🪨 | `stone` |
| Iron Ore | ⛏️ | `ironore` |
| Silver Ore | ⚪ | `silverore` |
| Gold Ore | 🟡 | `goldore` |
| Diamonds | 💎 | `diamond` |
| Iron Bars | ⚔️ | `iron` |

---

## How Limit Orders Work

### Example 1: Partial Fill Buy Order
```
Current Orderbook:
  🌾 GRAIN
    SELL: 30 @ 8 silver
    SELL: 50 @ 12 silver

You: /buy 100 grain 10

Result:
  ✅ Instantly bought 30 @ 8 silver = 240 silver
  ⏳ Queued 70 @ 10 silver (reserved 700 silver)
```

### Example 2: Partial Fill Sell Order
```
Current Orderbook:
  🪵 WOOD
    BUY: 40 @ 12 silver
    BUY: 20 @ 10 silver

You: /sell 100 wood 8

Result:
  ✅ Instantly sold 40 @ 12 silver = 480 silver
  ✅ Instantly sold 20 @ 10 silver = 200 silver
  ⏳ Queued 40 @ 8 silver (reserved 40 wood)
```

### Example 3: Full Immediate Fill
```
Current Orderbook:
  ⛏️ IRONORE
    SELL: 50 @ 8 silver
    SELL: 50 @ 9 silver

You: /buy 80 ironore 10

Result:
  ✅ Instantly bought 50 @ 8 silver = 400 silver
  ✅ Instantly bought 30 @ 9 silver = 270 silver
  Total: 80 iron ore for 670 silver
  Nothing queued!
```

---

## Chat Feedback Messages

### ✅ **Successful Order**
- Shows what filled immediately (amount, price per fill)
- Shows what was queued (amount, price, reserved amount)
- Total cost/earned

### ❌ **Error Messages**
- `No market found nearby` - You need to be near a market building
- `Invalid resource` - Check spelling (must be exact)
- `Not enough silver` - Can't afford the order
- `Not enough [resource]` - Don't have enough to sell
- `Usage: /buy [amount] [item] [price]` - Command format help

### 📊 **Order Notifications**
When YOUR queued order fills:
- **Buyer**: `✅ Bought [amount] [emoji] [resource] @ [price] silver = [total] silver`
- **Seller**: `✅ Sold [amount] [emoji] [resource] @ [price] silver = [total] silver`

---

## Technical Details

### Order Matching Rules
1. **Buy orders** match against sell orders from LOWEST to HIGHEST price
2. **Sell orders** match against buy orders from HIGHEST to LOWEST price
3. Orders execute at the **maker's price** (the order already on the book)
4. Partial fills are supported - remainder goes on orderbook

### Resource Reservation
- **Buy orders**: Silver is reserved (deducted from stores)
- **Sell orders**: Resources are reserved (deducted from stores)
- **Cancellation**: Reserved amounts are returned immediately

### Order IDs
- Generated using timestamp + random string
- Unique across all orders
- First 8 characters are sufficient for `/cancel` command

### Market Proximity
- Orders can be placed from anywhere near a market
- System finds nearest market automatically
- No distance limit (just need market to exist)

---

## Usage Examples

### Morning Routine - Sell Yesterday's Harvest
```
/orders                      # Check existing orders
/sell 200 grain 6            # Sell grain at 6 silver
/sell 150 wood 8             # Sell wood at 8 silver
```

### Buying Resources for Construction
```
$stone                        # Quick price check
$iron                         # Check iron prices
/buy 500 stone 10             # Buy stone for building
/buy 100 iron 15              # Buy iron for garrison
```

### Managing Orders
```
/orders                       # See all active orders
/cancel m123n456              # Cancel a specific order
```

### Trading in the Market (Live Broadcasting)
When you're inside the market, you'll see real-time activity:
```
You: /sell 100 grain 6

[Your message]
✅ SELL ORDER: 🌾 GRAIN
Queued 100 @ 6 silver

[Everyone in market sees]
📊 New ASK: YourName selling 100 🌾 grain @ 6 silver

[When someone buys]
📊 SomeBuyer bought 50 🌾 grain @ 6 silver
```

---

## Tips for Trading

1. **Use quick price checks** - Type `$item` for instant price info before trading
2. **Trade inside the market** - See real-time activity and market sentiment
3. **Check the orderbook first** - Hit spacebar on Goods displays for full orderbook
4. **Price competitively** - Orders closer to market price fill faster
5. **Partial fills are normal** - Your order might fill across multiple prices
6. **Reserve buffers** - Keep extra silver/resources for queued orders
7. **Cancel unused orders** - Free up reserved resources if plans change
8. **Watch market broadcasts** - Learn from other traders' pricing strategies

---

## Building Requirements

- **Market building** must be built (`/build market`)
- **First floor (z=1)**: Goods displays for orderbook viewing
- **Second floor (z=2)**: Desks for banking (future feature)

---

**Ready to trade!** 📊💰


