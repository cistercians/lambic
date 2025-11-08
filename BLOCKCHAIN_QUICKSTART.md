# Blockchain Quick Start Guide

## Getting Started in 5 Minutes

### 1. Install Dependencies

```bash
npm install
```

Required packages:
- `ws` - WebSocket for P2P network
- `elliptic` - Cryptography for signatures
- `crypto-js` - Encryption

### 2. Configure Environment (Optional)

Create a `.env` file in the project root:

```bash
# Basic configuration
BLOCKCHAIN_PORT=6001
MINING_DIFFICULTY=4
MINING_REWARD=10
WALLET_ENCRYPTION_KEY=your-secure-master-key-change-this

# For multi-server setup, add bootstrap peers:
# BOOTSTRAP_PEERS=ws://192.168.1.100:6001,ws://192.168.1.101:6001
```

**Note**: If no `.env` file exists, defaults will be used.

### 3. Start the Server

```bash
node lambic.js
```

You should see:
```
Initializing blockchain...
Server wallet created: 0455fb2f...
Blockchain initialization complete
###################################

     ♜  S T R O N G H O D L ♜

   A SOLIS ORTV VSQVE AD OCCASVM
```

### 4. Test In-Game

1. **Login** to the game as a player

2. **Check your wallet**:
   ```
   /wallet
   ```
   You should see your wallet address and balance.

3. **Get some gold**:
   - Find and pick up gold items in the game
   - Each pickup creates a blockchain "mining" transaction

4. **Trade with another player**:
   ```
   /sendgold PlayerName 100
   ```

5. **Watch the blockchain**:
   - Transactions are added to pending pool
   - Every ~30 seconds, a block is mined
   - Balances are synced after each block

## Testing the Blockchain

### Create Test Gold Items

In the server console or via admin command:

```javascript
// Spawn gold for testing
const gold = global.itemFactory.create('gold', {
  x: 100,
  y: 100,
  z: 0,
  qty: 50
});
```

### Check Blockchain Status

```javascript
// View blockchain info
console.log('Chain length:', global.blockchain.getChainLength());
console.log('Pending transactions:', global.blockchain.pendingTransactions.length);
console.log('Chain valid:', global.blockchain.isChainValid());

// View a player's balance
const player = global.Player.list['some-player-id'];
if (player && player.wallet) {
  console.log('Balance:', global.blockchain.getBalanceOfAddress(player.wallet.address));
}
```

### Force Mine a Block

```javascript
// Manually trigger block mining
global.miningManager.forceMine();
```

## Multi-Server Setup

### Server 1 (Bootstrap Node)

```bash
export BLOCKCHAIN_PORT=6001
node lambic.js
```

Note the IP address (e.g., 192.168.1.100)

### Server 2

```bash
export BLOCKCHAIN_PORT=6001
export BOOTSTRAP_PEERS=ws://192.168.1.100:6001
node lambic.js
```

You should see:
```
Connected to peer: ws://192.168.1.100:6001
```

### Server 3

```bash
export BLOCKCHAIN_PORT=6001
export BOOTSTRAP_PEERS=ws://192.168.1.100:6001,ws://192.168.1.101:6001
node lambic.js
```

## Verification Checklist

✅ Server starts without errors  
✅ "Blockchain initialization complete" message appears  
✅ Players can use `/wallet` command  
✅ Gold pickups create transactions  
✅ Blocks are mined every ~30 seconds  
✅ `/sendgold` command works  
✅ Blockchain data saved to `data/blockchain.json`  

## Common Issues

### "Cannot find module 'ws'"

**Solution**: Install dependencies
```bash
npm install
```

### Port 6001 already in use

**Solution**: Change the port
```bash
export BLOCKCHAIN_PORT=6002
node lambic.js
```

### Peers not connecting

**Solution**: Check firewall and network
```bash
# Test connectivity
telnet 192.168.1.100 6001
```

### Balance not updating

**Solution**: Wait for next block or force sync
```javascript
global.BalanceSync.syncPlayerBalances();
```

## Next Steps

- Read the full [BLOCKCHAIN_README.md](BLOCKCHAIN_README.md) for detailed documentation
- Configure multiple servers for a distributed network
- Set up monitoring for blockchain health
- Implement custom gold distribution mechanisms
- Create marketplace or trading systems using blockchain

## Support

If you encounter issues:
1. Check server logs for error messages
2. Verify all dependencies are installed
3. Test with a single server first
4. Review the configuration settings

## Security Reminder

🔐 **IMPORTANT**: Change the `WALLET_ENCRYPTION_KEY` before deploying to production!

The default key is insecure and should only be used for development/testing.

