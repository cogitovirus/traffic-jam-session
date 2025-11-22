const { tryLock, waitForLock, releaseLock } = require("./locks/redis-locker");

// mock external user/company list (replace with real source)
const USERS = {
  "XYC Inc": ["User 1", "User 2", "User 3", "User 4", "User 5"],
  "ABC Corp": ["User 1", "User 2", "User 3", "User 4", "User 5"]
};

class UserAgent {
  constructor(opts = {}) {
    this.username = opts.username || null;
    this.company = opts.company || null;

    this.ownedLocks = []; // store keys we locked
  }

  // pick a random user from a company
  _pickRandomUser(company) {
    const arr = USERS[company];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  _userKey(username) {
    return `user-lock:${username}`;
  }

  _companyKey(company) {
    return `company-lock:${company}`;
  }

  async init() {
    // CASE 1: A specific username was provided
    if (this.username) {
      const key = this._userKey(this.username);

      const ok = await waitForLock(key, 5, 5000);
      if (!ok) throw new Error(`Timeout: user ${this.username} still locked`);

      this.ownedLocks.push(key);
      return;
    }

    // CASE 2: Company provided → lock company → pick a user inside it
    if (this.company) {
      const compKey = this._companyKey(this.company);

      const ok = await waitForLock(compKey, 5, 5000);
      if (!ok) throw new Error(`Timeout: company ${this.company} still locked`);

      this.ownedLocks.push(compKey);

      // pick random user and lock it
      const user = this._pickRandomUser(this.company);
      const userKey = this._userKey(user);

      const ok2 = await waitForLock(userKey, 5, 5000);
      if (!ok2) throw new Error(`Timeout: user ${user} still locked`);

      this.username = user;
      this.ownedLocks.push(userKey);
      return;
    }

    // CASE 3: No company, no username → pick random company → lock user
    const companyNames = Object.keys(USERS);
    const randomCompany = companyNames[Math.floor(Math.random() * companyNames.length)];

    const compKey = this._companyKey(randomCompany);
    const ok = await waitForLock(compKey, 5, 5000);
    if (!ok) throw new Error(`Timeout: company ${randomCompany} still locked`);
    this.ownedLocks.push(compKey);

    const user = this._pickRandomUser(randomCompany);
    const userKey = this._userKey(user);

    const ok2 = await waitForLock(userKey, 5, 5000);
    if (!ok2) throw new Error(`Timeout: user ${user} still locked`);

    this.company = randomCompany;
    this.username = user;
    this.ownedLocks.push(userKey);
  }

  async disconnect() {
    // release all locks we took
    for (const key of this.ownedLocks) {
      await releaseLock(key);
    }
    this.ownedLocks = [];
  }
}

module.exports = { UserAgent };
