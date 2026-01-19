# Lambic Blockchain System

## Overview

Lambic features a custom proof-of-work blockchain where the in-game currency "Gold" is a real cryptocurrency with monetary value. Each game server acts as a node in a distributed peer-to-peer network, mining blocks, validating transactions, and maintaining consensus. In-game gold circulation is governed by a Game Wallet ledger, while on-chain activity is limited to rewards distribution and withdrawals.

## Architecture

### Core Components

1. **Block** (`server/js/blockchain/Block.js`)
   - Contains timestamp, transactions, previous hash, and nonce
   - Implements SHA-256 hashing and proof-of-work mining

2. **Transaction** (`server/js/blockchain/Transaction.js`)
   - Supports three types: `mining`, `transfer`, `reward`
   - Uses elliptic curve cryptography (secp256k1) for signatures
   - Validates sender signatures and balances

3. **Blockchain** (`server/js/blockchain/Blockchain.js`)
   - Maintains the chain of blocks
   - Validates chain integrity
   - Manages pending transactions
   - Calculates wallet balances

4. **P2P Network** (`server/js/blockchain/P2PNetwork.js`)
   - WebSocket-based peer-to-peer communication
   - Broadcasts new transactions and blocks
   - Synchronizes chains across nodes
   - Implements consensus (longest valid chain wins)

5. **Mining Manager** (`server/js/blockchain/MiningManager.js`)
   - Mines new blocks using proof-of-work
   - Adjusts difficulty based on block time
   - Distributes mining rewards to Server Wallet and Game Wallet (75/25 split)

6. **Wallet Manager** (`server/js/blockchain/WalletManager.js`)
   - Creates wallets for players (custodial)
   - Manages public/private key pairs
   - Encrypts private keys for storage
   - Signs transactions

7. **Game Wallet Ledger** (`server/js/blockchain/GameWalletLedger.js`)
   - Tracks in-game gold circulation (player subwallets + world items)
   - Enforces 1:1 backing by Game Wallet on-chain balance
   - Provides ledger transfers for pickup, drop, and trades

8. **Balance Sync** (`server/js/blockchain/BalanceSync.js`)
   - Reconciles inventory against Game Wallet ledger
   - Logs mismatches instead of overwriting inventory

8. **Blockchain Storage** (`server/js/blockchain/BlockchainStorage.js`)
   - Saves blockchain to disk (`data/blockchain.json`)
   - Loads blockchain on server startup
   - Auto-saves every 5 minutes

## How It Works

### Player Wallets

When a player logs in, a blockchain wallet is automatically created:
- **Public Key**: Used as the wallet address (visible to everyone)
- **Private Key**: Encrypted and stored securely (used for signing transactions)

Players can view their wallet with `/wallet` or `/blockchain` command.

### Gold Mining (In-Game Gold Availability)

Gold items are introduced into the game world only when Game Wallet on-chain balance exceeds current in-game circulation:
1. The server mines blocks and receives mining rewards
2. Rewards are split 75% to Server Wallet and 25% to Game Wallet
3. Mining logic allows gold ore drops only while `GameWallet balance > in-game circulation`
4. In-game pickups are ledger transfers, not on-chain minting

### Player-to-Player Trading

1. Trade is executed as a Game Wallet ledger transfer
2. Both players see immediate inventory update
3. No on-chain transaction is created

### Withdrawals (On-Chain Transfers)

1. Player requests withdrawal to an external address
2. Game Wallet ledger debits player subwallet
3. Game Wallet signs an on-chain transaction to the destination
4. Transaction is broadcast and confirmed on-chain

### Block Mining

Every ~30 seconds (configurable):
1. Server collects pending transactions
2. Creates a new block with transactions + mining reward split
3. Performs proof-of-work (finds hash with N leading zeros)
4. Broadcasts new block to peer nodes
5. All nodes validate and add block to their chain

### Consensus

- Nodes always accept the longest valid chain
- If a node receives a longer chain, it replaces its own
- Chain validation checks:
  - All hashes are correct
  - Blocks are properly linked
  - Proof-of-work is valid
  - All transactions are signed and valid

## Configuration

### Environment Variables

Create a `.env` file or set these variables:

```bash
# Blockchain network port
BLOCKCHAIN_PORT=6001

# Bootstrap peer nodes (comma-separated)
BOOTSTRAP_PEERS=ws://server1.example.com:6001,ws://server2.example.com:6001

# Mining difficulty (number of leading zeros)
MINING_DIFFICULTY=4

# Gold reward for mining a block
MINING_REWARD=10

# Master key for encrypting private keys (CHANGE IN PRODUCTION!)
WALLET_ENCRYPTION_KEY=your-secure-master-key-here
```

### Network Config

Edit `server/js/blockchain/NetworkConfig.js` to adjust:
- Block time target (default: 30 seconds)
- Maximum pending transactions
- Transaction timeout

## Admin Commands

### View Blockchain Status
In server console or via admin command system:
```javascript
console.log(global.blockchain.getChainLength()); // Number of blocks
console.log(global.blockchain.isChainValid()); // Validate entire chain
console.log(global.blockchain.pendingTransactions.length); // Pending txs
```

### Force Mine Block
For testing or manual intervention:
```javascript
global.miningManager.forceMine();
```

### View Wallet Balance
```javascript
global.blockchain.getBalanceOfAddress('<wallet-address>');
```

### View All Transactions for Wallet
```javascript
global.blockchain.getAllTransactionsForWallet('<wallet-address>');
```

### Server Wallet
Each server has its own wallet that receives 75% of mining rewards:
```javascript
console.log(global.serverWallet.address);
console.log(global.blockchain.getBalanceOfAddress(global.serverWallet.address));
```

### Game Wallet
Each server has a game wallet that receives 25% of mining rewards and backs in-game gold circulation:
```javascript
console.log(global.gameWallet.address);
console.log(global.blockchain.getBalanceOfAddress(global.gameWallet.address));
console.log(global.gameWalletLedger.getCirculationTotal()); // In-game gold in circulation
```

## Deployment

### Single Server Setup

1. Start the server normally:
```bash
node lambic.js
```

2. Blockchain will initialize automatically
3. Mining will begin after 2 seconds

### Multi-Server Network Setup

1. **Start First Server (Bootstrap Node)**
```bash
export BLOCKCHAIN_PORT=6001
node lambic.js
```
Note the server's IP address (e.g., 192.168.1.100)

2. **Start Additional Servers**
```bash
export BLOCKCHAIN_PORT=6001
export BOOTSTRAP_PEERS=ws://192.168.1.100:6001
node lambic.js
```

3. **Verify Connection**
Check server logs for:
- "Connected to peer: ws://..."
- "Blockchain loaded: X blocks"

### Network Topology

```
Server 1 (Bootstrap)  ←→  Server 2
      ↕                      ↕
   Server 3  ←→  Server 4  ←→  Server 5
```

All servers:
- Mine blocks competitively
- Broadcast new blocks/transactions
- Maintain identical blockchain copies
- Accept longest valid chain

## Security

### Private Key Encryption
- All private keys are encrypted using AES-256-CBC
- Master encryption key must be kept secure
- **Never commit encryption keys to version control**

### Transaction Validation
- All transactions must be signed by sender's private key
- Blockchain validates signatures before accepting transactions
- Double-spending is prevented by balance checks

### Proof-of-Work
- Prevents spam and manipulation
- Ensures distributed consensus
- Difficulty adjusts to maintain target block time

### Network Security
- WebSocket connections should use WSS (TLS) in production
- Consider implementing peer authentication
- Monitor for malicious behavior

## Monitoring

### Key Metrics

1. **Blockchain Health**
   - Chain length (should increase steadily)
   - Chain validity (should always be true)
   - Pending transactions (should be < 100)

2. **Network Health**
   - Connected peers (should have multiple)
   - Block propagation time
   - Chain sync status

3. **Mining Performance**
   - Blocks mined by this server
   - Average block time
   - Mining difficulty

### Logs

The server logs important blockchain events:
- Block mined: Hash and mining time
- New transactions received from peers
- New blocks received from peers
- Chain synchronization events
- Wallet creation for new players

## Troubleshooting

### Blockchain Not Initializing
- Check that all npm packages are installed: `npm install`
- Verify no port conflicts (default: 6001)
- Check server logs for error messages

### Peers Not Connecting
- Verify `BOOTSTRAP_PEERS` is set correctly
- Check firewall rules (allow port 6001)
- Ensure WebSocket protocol (ws://) is used
- Check network connectivity between servers

### Chain Splits (Forks)
- Multiple servers mining simultaneously may create forks
- Longest chain will eventually win
- Consider increasing block time target if frequent

### Balance Mismatch
- Balance sync runs every minute
- Logs mismatches between ledger and inventory
- Can force check: `global.BalanceSync.syncPlayerBalances()`

### High Memory Usage
- Blockchain grows over time
- Consider implementing pruning for old transactions
- Monitor disk space for `data/blockchain.json`

## Future Enhancements

Potential improvements for consideration:

1. **Transaction Fees**: Implement small fees to prevent spam
2. **Wallet Export**: Allow players to export private keys
3. **Blockchain Explorer**: Web interface to view blocks/transactions
4. **Smart Contracts**: Programmable transactions for complex trades
5. **Sharding**: Partition blockchain for better scalability
6. **Checkpoints**: Periodic snapshots to reduce chain size
7. **External Wallets**: Support for external wallet integration
8. **Market Integration**: In-game marketplace with blockchain payments

## Technical Details

### Cryptography
- **Algorithm**: Elliptic Curve Digital Signature Algorithm (ECDSA)
- **Curve**: secp256k1 (same as Bitcoin)
- **Hash**: SHA-256
- **Encryption**: AES-256-CBC for private key storage

### Block Structure
```json
{
  "timestamp": 1699488000000,
  "transactions": [...],
  "previousHash": "0000abc123...",
  "hash": "0000def456...",
  "nonce": 12345,
  "miner": "server-name"
}
```

### Transaction Structure
```json
{
  "fromAddress": "04abc123...", 
  "toAddress": "04def456...",
  "amount": 100,
  "type": "transfer",
  "metadata": {
    "fromPlayer": "Alice",
    "toPlayer": "Bob"
  },
  "timestamp": 1699488000000,
  "signature": "3045..."
}
```

### Consensus Rules
1. Longest valid chain wins
2. All blocks must have valid proof-of-work
3. All transactions must be signed (except mining rewards)
4. No double-spending allowed
5. Genesis block is hardcoded

## Support

For issues or questions:
- Check server logs for error messages
- Verify configuration settings
- Ensure all dependencies are installed
- Test with single server before multi-server setup

## License

This blockchain implementation is part of the Lambic game.

