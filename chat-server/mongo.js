// chat-server/mongo.js
const { MongoClient } = require('mongodb');

let client, db;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.DB_NAME || 'chat_system_phase2';

async function connectMongo() {
  if (db) return db;
  client = new MongoClient(MONGO_URL, { ignoreUndefined: true });
  await client.connect();
  db = client.db(DB_NAME);
  console.log(`[mongo] connected to ${MONGO_URL}/${DB_NAME}`);
  return db;
}

function getDb() {
  if (!db) throw new Error('Mongo not initialised. Call connectMongo() first.');
  return db;
}

async function closeMongo() {
  if (client) await client.close();
  client = db = undefined;
}

module.exports = { connectMongo, getDb, closeMongo };
