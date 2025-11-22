const { UserAgent } = require("./user-agent");

function generateRandomNumber() {
  return Math.floor(10000 + Math.random() * 90000);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const id = process.argv[2];
  
//   for (let i = 0; i < 5; i++) {
//     const randomNumber = generateRandomNumber();
//     console.log(`Thread ${id}: ${randomNumber}`);
//     await sleep(100);
//   }

  const user1 = new UserAgent("XYC Inc:User 1");
  const user2 = new UserAgent("XYC Inc:User 2");

  const ok1 = await user1.claimContract("C001");
  console.log("User1 claimed:", ok1);

  const ok2 = await user2.claimContract("C001");
  console.log("User2 claimed:", ok2);

  const owner = await user1.whoHas("C001");
  console.log("Current owner:", owner);
}

main();
