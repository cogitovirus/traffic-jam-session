// locks/redis-locker.js
const { getRedis } = require("../redis-client");

// key formats:
//   user-lock:<username>
//   company-lock:<company>

async function tryLock(key, ttlSeconds = 5) {
  const redis = await getRedis();
  // SETNX + EXPIRE in one atomic command
  return redis.set(key, "locked", {
    NX: true,
    EX: ttlSeconds
  });
}

async function waitForLock(key, ttlSeconds = 5, timeoutMs = 5000) {
  const start = Date.now();

  while (true) {
    const locked = await tryLock(key, ttlSeconds);

    if (locked) return true;

    if (Date.now() - start >= timeoutMs) {
      return false; // timeout
    }

    await new Promise(r => setTimeout(r, 200)); // backoff
  }
}

async function releaseLock(key) {
  const redis = await getRedis();
  await redis.del(key);
}

module.exports = {
  tryLock,
  waitForLock,
  releaseLock
};
