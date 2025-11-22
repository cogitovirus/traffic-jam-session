const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || 'redis://redis:6379';

app.use(express.json());

// Redis client
let redisClient;

// Initialize Redis connection
async function initRedis() {
  redisClient = createClient({
    url: REDIS_URL
  });

  redisClient.on('error', (err) => console.error('Redis Client Error', err));
  redisClient.on('connect', () => console.log('Redis Client Connected'));

  await redisClient.connect();
}

// Mutex Lock Manager
class MutexManager {
  constructor(redisClient) {
    this.redis = redisClient;
    this.lockPrefix = 'lock:';
    this.defaultTTL = 30; // 30 seconds default TTL
  }

  // Generate lock keys
  getUserLockKey(userId) {
    return `${this.lockPrefix}user:${userId}`;
  }

  getCompanyLockKey(companyId) {
    return `${this.lockPrefix}company:${companyId}`;
  }

  getContractLockKey(contractId) {
    return `${this.lockPrefix}contract:${contractId}`;
  }

  // Acquire lock with TTL
  async acquireLock(lockKey, processId, ttl = this.defaultTTL) {
    try {
      // SET NX: Set if Not eXists, with expiration
      const result = await this.redis.set(lockKey, processId, {
        NX: true,
        EX: ttl
      });
      return result === 'OK';
    } catch (error) {
      console.error(`Error acquiring lock for ${lockKey}:`, error);
      return false;
    }
  }

  // Release lock (atomic check-and-delete using Lua script)
  async releaseLock(lockKey, processId) {
    try {
      // Use Lua script to atomically check and delete
      // Returns 1 if deleted, 0 if not owned by this process
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      const result = await this.redis.eval(luaScript, {
        keys: [lockKey],
        arguments: [processId]
      });
      return result === 1;
    } catch (error) {
      console.error(`Error releasing lock for ${lockKey}:`, error);
      return false;
    }
  }

  // Check if locked
  async isLocked(lockKey) {
    try {
      const exists = await this.redis.exists(lockKey);
      return exists === 1;
    } catch (error) {
      console.error(`Error checking lock for ${lockKey}:`, error);
      return false;
    }
  }

  // Get lock holder
  async getLockHolder(lockKey) {
    try {
      return await this.redis.get(lockKey);
    } catch (error) {
      console.error(`Error getting lock holder for ${lockKey}:`, error);
      return null;
    }
  }

  // Lock a user
  async lockUser(userId, processId, ttl) {
    const lockKey = this.getUserLockKey(userId);
    return await this.acquireLock(lockKey, processId, ttl);
  }

  // Unlock a user
  async unlockUser(userId, processId) {
    const lockKey = this.getUserLockKey(userId);
    return await this.releaseLock(lockKey, processId);
  }

  // Lock entire company (locks all users in the company with rollback on failure)
  async lockCompany(companyId, userIds, processId, ttl) {
    const companyLockKey = this.getCompanyLockKey(companyId);
    
    // First, try to acquire company-level lock
    const companyLocked = await this.acquireLock(companyLockKey, processId, ttl);
    if (!companyLocked) {
      return { success: false, message: 'Company already locked' };
    }

    // Try to lock all users
    const userLocks = [];
    const lockedUsers = [];
    
    for (const userId of userIds) {
      const userLockKey = this.getUserLockKey(userId);
      const locked = await this.acquireLock(userLockKey, processId, ttl);
      userLocks.push({ userId, locked });
      
      if (locked) {
        lockedUsers.push(userId);
      } else {
        // Rollback: release all locks acquired so far
        console.error(`Failed to lock user ${userId}, rolling back...`);
        
        // Release all user locks acquired so far
        for (const lockedUserId of lockedUsers) {
          const userLockKey = this.getUserLockKey(lockedUserId);
          await this.releaseLock(userLockKey, processId);
        }
        
        // Release company lock
        await this.releaseLock(companyLockKey, processId);
        
        return { 
          success: false, 
          message: `Failed to lock user ${userId}, all locks rolled back`,
          failedUser: userId
        };
      }
    }

    return { 
      success: true, 
      companyLocked: true, 
      userLocks 
    };
  }

  // Unlock entire company
  async unlockCompany(companyId, userIds, processId) {
    const companyLockKey = this.getCompanyLockKey(companyId);
    
    // Release company-level lock
    const companyUnlocked = await this.releaseLock(companyLockKey, processId);

    // Release all user locks
    const userUnlocks = [];
    for (const userId of userIds) {
      const userLockKey = this.getUserLockKey(userId);
      const unlocked = await this.releaseLock(userLockKey, processId);
      userUnlocks.push({ userId, unlocked });
    }

    return { 
      companyUnlocked, 
      userUnlocks 
    };
  }

  // Lock a contract
  async lockContract(contractId, processId, ttl) {
    const lockKey = this.getContractLockKey(contractId);
    return await this.acquireLock(lockKey, processId, ttl);
  }

  // Unlock a contract
  async unlockContract(contractId, processId) {
    const lockKey = this.getContractLockKey(contractId);
    return await this.releaseLock(lockKey, processId);
  }

  // Check user lock status
  async checkUserLock(userId) {
    const lockKey = this.getUserLockKey(userId);
    const locked = await this.isLocked(lockKey);
    const holder = locked ? await this.getLockHolder(lockKey) : null;
    return { locked, holder };
  }

  // Check company lock status
  async checkCompanyLock(companyId) {
    const lockKey = this.getCompanyLockKey(companyId);
    const locked = await this.isLocked(lockKey);
    const holder = locked ? await this.getLockHolder(lockKey) : null;
    return { locked, holder };
  }

  // Check contract lock status
  async checkContractLock(contractId) {
    const lockKey = this.getContractLockKey(contractId);
    const locked = await this.isLocked(lockKey);
    const holder = locked ? await this.getLockHolder(lockKey) : null;
    return { locked, holder };
  }
}

let mutexManager;

// API Endpoints

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', redis: redisClient?.isReady ? 'connected' : 'disconnected' });
});

// Lock a user
app.post('/lock/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { processId, ttl } = req.body;

  if (!processId) {
    return res.status(400).json({ error: 'processId is required' });
  }

  const locked = await mutexManager.lockUser(userId, processId, ttl);
  
  if (locked) {
    res.json({ success: true, message: `User ${userId} locked by process ${processId}` });
  } else {
    res.status(409).json({ success: false, message: `User ${userId} is already locked` });
  }
});

// Unlock a user
app.post('/unlock/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const { processId } = req.body;

  if (!processId) {
    return res.status(400).json({ error: 'processId is required' });
  }

  const unlocked = await mutexManager.unlockUser(userId, processId);
  
  if (unlocked) {
    res.json({ success: true, message: `User ${userId} unlocked by process ${processId}` });
  } else {
    res.status(403).json({ success: false, message: `User ${userId} is not locked by process ${processId}` });
  }
});

// Check user lock status
app.get('/lock/user/:userId', async (req, res) => {
  const { userId } = req.params;
  const status = await mutexManager.checkUserLock(userId);
  res.json({ userId, ...status });
});

// Lock entire company
app.post('/lock/company/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const { processId, userIds, ttl } = req.body;

  if (!processId) {
    return res.status(400).json({ error: 'processId is required' });
  }

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: 'userIds array is required' });
  }

  const result = await mutexManager.lockCompany(companyId, userIds, processId, ttl);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(409).json(result);
  }
});

// Unlock entire company
app.post('/unlock/company/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const { processId, userIds } = req.body;

  if (!processId) {
    return res.status(400).json({ error: 'processId is required' });
  }

  if (!userIds || !Array.isArray(userIds)) {
    return res.status(400).json({ error: 'userIds array is required' });
  }

  const result = await mutexManager.unlockCompany(companyId, userIds, processId);
  res.json(result);
});

// Check company lock status
app.get('/lock/company/:companyId', async (req, res) => {
  const { companyId } = req.params;
  const status = await mutexManager.checkCompanyLock(companyId);
  res.json({ companyId, ...status });
});

// Lock a contract
app.post('/lock/contract/:contractId', async (req, res) => {
  const { contractId } = req.params;
  const { processId, ttl } = req.body;

  if (!processId) {
    return res.status(400).json({ error: 'processId is required' });
  }

  const locked = await mutexManager.lockContract(contractId, processId, ttl);
  
  if (locked) {
    res.json({ success: true, message: `Contract ${contractId} locked by process ${processId}` });
  } else {
    res.status(409).json({ success: false, message: `Contract ${contractId} is already locked` });
  }
});

// Unlock a contract
app.post('/unlock/contract/:contractId', async (req, res) => {
  const { contractId } = req.params;
  const { processId } = req.body;

  if (!processId) {
    return res.status(400).json({ error: 'processId is required' });
  }

  const unlocked = await mutexManager.unlockContract(contractId, processId);
  
  if (unlocked) {
    res.json({ success: true, message: `Contract ${contractId} unlocked by process ${processId}` });
  } else {
    res.status(403).json({ success: false, message: `Contract ${contractId} is not locked by process ${processId}` });
  }
});

// Check contract lock status
app.get('/lock/contract/:contractId', async (req, res) => {
  const { contractId } = req.params;
  const status = await mutexManager.checkContractLock(contractId);
  res.json({ contractId, ...status });
});

// Start server
async function start() {
  try {
    await initRedis();
    mutexManager = new MutexManager(redisClient);
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Redis URL: ${REDIS_URL}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});

start();
