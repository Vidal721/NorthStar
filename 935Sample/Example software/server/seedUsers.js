import fs from "fs";
import bcrypt from "bcrypt";

const USERS_FILE = "users.json";

async function seed() {
  const saltRounds = 10;

  // Hash our test passwords
  const adminHash = await bcrypt.hash("admin1234", saltRounds);
  const scouterHash = await bcrypt.hash("scout1234", saltRounds);

  const initialUsers = [
    {
      username: "admin_user",
      passwordHash: adminHash,
      role: "admin"
    },
    {
      username: "scouter_user",
      passwordHash: scouterHash,
      role: "scouter"
    }
  ];

  fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2));
  console.log("Successfully created users.json with encrypted passwords!");
}

seed();