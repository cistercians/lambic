const EC = require('elliptic').ec;
const ec = new EC('secp256k1');
const crypto = require('crypto');

class WalletManager {
  static createWallet(playerId) {
    // Generate key pair
    const key = ec.genKeyPair();
    const publicKey = key.getPublic('hex');
    const privateKey = key.getPrivate('hex');
    
    // Encrypt private key for storage
    const encryptedPrivateKey = this.encryptPrivateKey(
      privateKey,
      process.env.WALLET_ENCRYPTION_KEY || 'default-master-key-change-in-production'
    );
    
    return {
      playerId: playerId,
      address: publicKey, // Public key is the wallet address
      encryptedPrivateKey: encryptedPrivateKey,
      createdAt: Date.now()
    };
  }
  
  static encryptPrivateKey(privateKey, masterKey) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(masterKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted;
  }
  
  static decryptPrivateKey(encryptedKey, masterKey) {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(masterKey, 'salt', 32);
    
    // Extract IV and encrypted data
    const parts = encryptedKey.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  
  static signTransaction(privateKeyHex, transaction) {
    const signingKey = ec.keyFromPrivate(privateKeyHex, 'hex');
    transaction.signTransaction(signingKey);
  }
  
  static getBalance(address) {
    if (!global.blockchain) {
      return 0;
    }
    return global.blockchain.getBalanceOfAddress(address);
  }
}

module.exports = WalletManager;

