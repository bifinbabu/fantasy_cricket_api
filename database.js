// Database Details
const DB_USER = process.env["DB_USER"];
const DB_PWD = process.env["DB_PWD"];
const DB_URL = process.env["DB_URL"];
const DB_NAME = "task-jeff";
const DB_COLLECTION_NAME = "players";
const DB_MATCH_COLLECTION_NAME = "match";

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri =
  "mongodb+srv://" +
  DB_USER +
  ":" +
  DB_PWD +
  "@" +
  DB_URL +
  "/?retryWrites=true&w=majority";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    db = client.db(DB_NAME);

    console.log("You successfully connected to MongoDB!");
    return db;
  } finally {
  }
}

// Sample create document
async function sampleCreate() {
  const demo_doc = {
    demo: "doc demo",
    hello: "world",
  };
  const demo_create = await db
    .collection(DB_COLLECTION_NAME)
    .insertOne(demo_doc);

  console.log("Added!");
  console.log(demo_create.insertedId);
}

function getDb() {
  return db;
}

module.exports = {
  run,
  sampleCreate,
  getDb,
  DB_COLLECTION_NAME,
  DB_MATCH_COLLECTION_NAME,
};
