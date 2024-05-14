const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const { run, sampleCreate } = require("./database");

const app = express();
app.use(express.json({ limit: "50mb" }));
const port = 3000;

// Endpoints
app.get("/", async (req, res) => {
  res.send("Hello World!");
});

app.get("/demo", async (req, res) => {
  await sampleCreate();
  res.send({ status: 1, message: "demo" });
});

// Routes
const teamRoutes = require("./routes/team/teamRoutes");
app.use(teamRoutes);

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});

run();
