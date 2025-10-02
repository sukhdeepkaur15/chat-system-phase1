// chat-server/index.js
const express = require('express');
const cors = require('cors');
const { v4: uuid } = require('uuid');
const { connectMongo, getDb } = require('./mongo');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

/** -------------------- Mongo -------------------- **/
(async () => {
  try {
    await connectMongo();
    const db = getDb();
    await db.collection('groups').createIndex({ id: 1 }, { unique: true });
    await db.collection('reports').createIndex({ id: 1 }, { unique: true });
    console.log('[init] Mongo connected & indexes ensured');
  } catch (err) {
    console.error('Failed to connect to Mongo:', err);
    process.exit(1);
  }
})();

/** -------------------- Helpers -------------------- **/
function now() { return Date.now(); }

async function getGroup(groupId) {
  const db = getDb();
  return db.collection('groups').findOne({ id: groupId });
}

async function saveGroup(group) {
  const db = getDb();
  await db.collection('groups').updateOne(
    { id: group.id },
    { $set: group },
    { upsert: true }
  );
}

async function addReportMongo({ groupId, channelId, targetUserId, targetUsername, actorUserId, reason = 'ban-in-channel' }) {
  const db = getDb();
  const report = {
    id: uuid(),
    createdAt: now(),
    groupId, channelId,
    targetUserId: targetUserId || null,
    targetUsername: targetUsername || null,
    actorUserId: actorUserId || null,
    reason,
    status: 'open'
  };
  await db.collection('reports').insertOne(report);
  return report;
}

/** -------------------- Health -------------------- **/
app.get('/health', (_req, res) => res.json({ ok: true }));

/** -------------------- Groups -------------------- **/
// list groups
app.get('/groups', async (_req, res) => {
  const db = getDb();
  const groups = await db.collection('groups').find({}).toArray();
  res.json(groups);
});

// create group
app.post('/groups', async (req, res) => {
  const { name, creatorId } = req.body || {};
  if (!name || !creatorId) return res.status(400).json({ error: 'name and creatorId required' });

  const group = {
    id: uuid(),
    name,
    creatorId,
    users: [creatorId],
    joinRequests: [],
    channels: []
  };
  const db = getDb();
  await db.collection('groups').insertOne(group);
  res.status(201).json(group);
});

// delete group
app.delete('/groups/:groupId', async (req, res) => {
  const db = getDb();
  const result = await db.collection('groups').deleteOne({ id: req.params.groupId });
  if (result.deletedCount === 0) return res.status(404).json({ ok: false });
  res.json({ ok: true });
});

/** -------------------- Reports (Super Admin) -------------------- **/
app.get('/reports', async (_req, res) => {
  const db = getDb();
  const reports = await db.collection('reports').find({}).sort({ createdAt: -1 }).toArray();
  res.json(reports);
});

app.post('/reports', async (req, res) => {
  const r = await addReportMongo(req.body || {});
  res.status(201).json(r);
});

app.put('/reports/:id/resolve', async (req, res) => {
  const db = getDb();
  const result = await db.collection('reports').findOneAndUpdate(
    { id: req.params.id },
    { $set: { status: 'resolved', resolvedAt: now() } },
    { returnDocument: 'after' }
  );
  if (!result.value) return res.status(404).json({ ok: false });
  res.json({ ok: true, report: result.value });
});

/** -------------------- Channels -------------------- **/
// create channel (initial members = current group users)
app.post('/groups/:groupId/channels', async (req, res) => {
  const { groupId } = req.params;
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });

  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'Group not found' });

  g.channels = g.channels || [];
  const channel = {
    id: uuid(),
    name,
    members: [...(g.users || [])],
    messages: [],
    bannedUserIds: [],
    bannedUsernames: []
  };
  g.channels.push(channel);
  await saveGroup(g);
  res.status(201).json(channel);
});

// remove channel
app.delete('/groups/:groupId/channels/:channelId', async (req, res) => {
  const { groupId, channelId } = req.params;
  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ ok: false });

  g.channels = (g.channels || []).filter(c => c.id !== channelId);
  await saveGroup(g);
  res.json({ ok: true });
});

/** -------------------- Join Requests -------------------- **/
app.post('/groups/:groupId/join', async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });

  g.joinRequests = g.joinRequests || [];
  g.users = g.users || [];
  if (!g.users.includes(userId) && !g.joinRequests.includes(userId)) {
    g.joinRequests.push(userId);
    await saveGroup(g);
  }
  res.json({ ok: true });
});

app.put('/groups/:groupId/approve/:userId', async (req, res) => {
  const { groupId, userId } = req.params;
  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });

  g.joinRequests = (g.joinRequests || []).filter(id => id !== userId);
  g.users = g.users || [];
  if (!g.users.includes(userId)) g.users.push(userId);

  (g.channels || []).forEach(ch => {
    ch.members = ch.members || [];
    if (!ch.members.includes(userId)) ch.members.push(userId);
  });

  await saveGroup(g);
  res.json(g);
});

app.put('/groups/:groupId/reject/:userId', async (req, res) => {
  const { groupId, userId } = req.params;
  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });

  g.joinRequests = (g.joinRequests || []).filter(id => id !== userId);
  await saveGroup(g);
  res.json(g);
});

/** -------------------- Channel Bans -------------------- **/
app.post('/groups/:groupId/channels/:channelId/ban', async (req, res) => {
  const { groupId, channelId } = req.params;
  const { userId, username, actorUserId, report } = req.body || {};

  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const ch = (g.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });

  ch.bannedUserIds = ch.bannedUserIds || [];
  ch.bannedUsernames = ch.bannedUsernames || [];
  ch.members = ch.members || [];

  if (userId && !ch.bannedUserIds.includes(userId)) ch.bannedUserIds.push(userId);
  if (username && !ch.bannedUsernames.includes(username)) ch.bannedUsernames.push(username);

  // remove membership when banning by id
  if (userId) ch.members = ch.members.filter(id => id !== userId);

  if (report) {
    await addReportMongo({
      groupId, channelId,
      targetUserId: userId || null,
      targetUsername: username || null,
      actorUserId: actorUserId || null,
      reason: 'ban-in-channel'
    });
  }

  await saveGroup(g);
  res.json({ ok: true, channel: ch });
});

app.delete('/groups/:groupId/channels/:channelId/ban', async (req, res) => {
  const { groupId, channelId } = req.params;
  const source = (req.body && Object.keys(req.body).length) ? req.body : req.query;
  const { userId, username } = source || {};

  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const ch = (g.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });

  ch.bannedUserIds = (ch.bannedUserIds || []).filter(id => id !== userId);
  ch.bannedUsernames = (ch.bannedUsernames || []).filter(u => u !== username);

  await saveGroup(g);
  res.json({ ok: true, channel: ch });
});

app.get('/groups/:groupId/channels/:channelId/banned', async (req, res) => {
  const { groupId, channelId } = req.params;
  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const ch = (g.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });

  res.json({
    bannedUserIds: ch.bannedUserIds || [],
    bannedUsernames: ch.bannedUsernames || []
  });
});

/** -------------------- Leave Group -------------------- **/
app.post('/groups/:groupId/leave', async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });

  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ ok: false, error: 'group not found' });

  g.users = (g.users || []).filter(id => id !== userId);
  (g.channels || []).forEach(ch => {
    ch.members = (ch.members || []).filter(id => id !== userId);
  });
  g.joinRequests = (g.joinRequests || []).filter(id => id !== userId);

  await saveGroup(g);
  res.json({ ok: true });
});

/** -------------------- Messages -------------------- **/
app.get('/messages', async (req, res) => {
  const { groupId, channelId } = req.query || {};
  const g = await getGroup(groupId);
  const ch = g?.channels?.find(c => c.id === channelId);
  res.json(ch?.messages || []);
});

app.post('/messages', async (req, res) => {
  const { groupId, channelId, username, userId, content } = req.body || {};
  if (!groupId || !channelId || !username || !content) {
    return res.status(400).json({ error: 'groupId, channelId, username, content required' });
  }

  const g = await getGroup(groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });

  const ch = (g.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'channel not found' });

  // Enforce channel bans
  if ((ch.bannedUsernames || []).includes(username) ||
      (ch.bannedUserIds || []).includes(userId)) {
    return res.status(403).json({ error: 'User is banned from this channel' });
  }

  const msg = { username, content, timestamp: now() };
  ch.messages = ch.messages || [];
  ch.messages.push(msg);

  await saveGroup(g);
  res.status(201).json({ ok: true, message: msg });
});

//** -------------------- Server Boot -------------------- **/
const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// start Express API always
server.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});

// start PeerJS server on a separate port
if (process.env.NODE_ENV !== 'test') {
  require('./peer-server')(); // this starts peer on 4001
}

module.exports = { app, server };


