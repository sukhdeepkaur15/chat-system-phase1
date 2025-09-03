// index.js
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'data.json');

function load() {
  if (!fs.existsSync(DATA_FILE)) {
    const seed = { users: [], groups: [] };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
    return seed;
  }
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

let db = load();

// Simple health check
app.get('/health', (req, res) => res.json({ ok: true }));

/** ---------- Groups ---------- **/
app.get('/groups', (req, res) => {
  res.json(db.groups);
});

app.post('/groups', (req, res) => {
  const { name, creatorId } = req.body;
  if (!name || !creatorId) return res.status(400).json({ error: 'name and creatorId required' });
  const group = {
    id: uuid(),
    name,
    creatorId,
    users: [creatorId],
    joinRequests: [],
    channels: []
  };
  db.groups.push(group);
  save(db);
  res.status(201).json(group);
});

app.delete('/groups/:groupId', (req, res) => {
  const { groupId } = req.params;
  const idx = db.groups.findIndex(g => g.id === groupId);
  if (idx === -1) return res.status(404).json({ ok: false });
  db.groups.splice(idx, 1);
  save(db);
  res.json({ ok: true });
});

/** ---------- Channels ---------- **/
app.post('/groups/:groupId/channels', (req, res) => {
  const { groupId } = req.params;
  const { name } = req.body;
  const group = db.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'group not found' });
  const channel = { id: uuid(), name, members: [...group.users], messages: [] };
  group.channels.push(channel);
  save(db);
  res.status(201).json(channel);
});

app.delete('/groups/:groupId/channels/:channelId', (req, res) => {
  const { groupId, channelId } = req.params;
  const group = db.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ ok: false });
  group.channels = (group.channels || []).filter(ch => ch.id !== channelId);
  save(db);
  res.json({ ok: true });
});

/** ---------- Join Requests ---------- **/
app.post('/groups/:groupId/join', (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body;
  const g = db.groups.find(gr => gr.id === groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });
  if (!g.users.includes(userId) && !g.joinRequests.includes(userId)) {
    g.joinRequests.push(userId);
    save(db);
  }
  res.json({ ok: true });
});

app.put('/groups/:groupId/approve/:userId', (req, res) => {
  const { groupId, userId } = req.params;
  const g = db.groups.find(gr => gr.id === groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });
  g.joinRequests = g.joinRequests.filter(id => id !== userId);
  if (!g.users.includes(userId)) g.users.push(userId);
  (g.channels || []).forEach(ch => {
    ch.members = ch.members || [];
    if (!ch.members.includes(userId)) ch.members.push(userId);
  });
  save(db);
  res.json(g);
});

app.put('/groups/:groupId/reject/:userId', (req, res) => {
  const { groupId, userId } = req.params;
  const g = db.groups.find(gr => gr.id === groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });
  g.joinRequests = g.joinRequests.filter(id => id !== userId);
  save(db);
  res.json(g);
});

/** ---------- Messages ---------- **/
app.get('/messages', (req, res) => {
  const { groupId, channelId } = req.query;
  const g = db.groups.find(gr => gr.id === groupId);
  const ch = g?.channels.find(c => c.id === channelId);
  res.json(ch?.messages || []);
});

app.post('/messages', (req, res) => {
  const { groupId, channelId, username, content } = req.body;
  const g = db.groups.find(gr => gr.id === groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });
  const ch = g.channels.find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'channel not found' });
  const msg = { username, content, timestamp: Date.now() };
  ch.messages = ch.messages || [];
  ch.messages.push(msg);
  save(db);
  res.status(201).json({ ok: true, message: msg });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
