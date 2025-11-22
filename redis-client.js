const { createClient } = require("redis");

let client = null;

async function getRedis() {
  if (!client) {
    client = createClient();
    await client.connect();
  }
  return client;
}

module.exports = { getRedis };
