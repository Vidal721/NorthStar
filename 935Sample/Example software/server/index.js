// Use 'import' instead of 'require'
import express from "express";
import fs from "fs";
import cors from "cors";

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

function getUsers() {
  const users = JSON.parse(fs.readFileSync("users.json", "utf8"));

  return users;
}

app.get("/users/:id", (req, res) => {

  const id = Number(req.params.id);

  const user = getUsers().find((user) => user.id === id);
  res.json(user);
});

app.get("/users/", (req, res) => {
  const users = getUsers()

  res.json(users);
})

app.post("/users", (req, res) => {
  const users = JSON.parse(
    fs.readFileSync("users.json","utf8")  
  )

  const newUser = {
    id: Date.now(),
    name: req.body.name,
    age: req.body.age
  }

  users.push(newUser)

  fs.writeFileSync("users.json", JSON.stringify(users, null, 2))

  res.status(201).json(newUser);
})

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
