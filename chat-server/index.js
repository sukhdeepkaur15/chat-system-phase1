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

function addReport({ groupId, channelId, targetUserId, targetUsername, actorUserId, reason = 'ban-in-channel' }) {
  const report = {
    id: uuid(),
    createdAt: Date.now(),
    groupId, channelId,
    targetUserId: targetUserId || null,
    targetUsername: targetUsername || null,
    actorUserId: actorUserId || null,  // the group admin who acted
    reason,                             // "ban-in-channel"
    status: 'open'                      // 'open' | 'resolved'
  };
  db.reports.push(report);
  save(db);
  return report;
}

let db = load();
db.reports = db.reports || [];

// Simple health check
app.get('/health', (_req, res) => res.json({ ok: true }));

/** ---------- Groups ---------- **/
app.get('/groups', (_req, res) => {
  res.json(db.groups);
});

// List reports (Super Admins would call this; phase-1: no auth check)
app.get('/reports', (req, res) => {
  res.json(db.reports || []);
});

// Create a report (if you ever want to send them manually)
app.post('/reports', (req, res) => {
  const r = addReport(req.body || {});
  res.status(201).json(r);
});

// Resolve a report
app.put('/reports/:id/resolve', (req, res) => {
  const idx = (db.reports || []).findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok:false });
  db.reports[idx].status = 'resolved';
  db.reports[idx].resolvedAt = Date.now();
  save(db);
  res.json({ ok:true, report: db.reports[idx] });
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
// Create channel in a group (with per-channel ban arrays)
app.post('/groups/:groupId/channels', (req, res) => {
  const { groupId } = req.params;
  const { name } = req.body;

  const group = db.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const channel = {
    id: uuid(),
    name,
    // new channel initially visible to current group members
    members: [...(group.users || [])],
    messages: [],
    bannedUserIds: [],      // per-channel ban by id
    bannedUsernames: []     // per-channel ban by username
  };

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

/** ---------- Channel Bans (REQUIRED by spec) ---------- **/
// Ban a user from a channel (by userId or username)
app.post('/groups/:groupId/channels/:channelId/ban', (req, res) => {
  const { groupId, channelId } = req.params;
  const { userId, username, actorUserId, report } = req.body || {};

  const group = db.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const ch = (group.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });

  ch.bannedUserIds = ch.bannedUserIds || [];
  ch.bannedUsernames = ch.bannedUsernames || [];
  ch.members = ch.members || [];

  if (userId && !ch.bannedUserIds.includes(userId)) ch.bannedUserIds.push(userId);
  if (username && !ch.bannedUsernames.includes(username)) ch.bannedUsernames.push(username);

  // if we banned by id, also remove membership
  if (userId) ch.members = ch.members.filter(id => id !== userId);

  if (report) {
    addReport({
      groupId, channelId,
      targetUserId: userId || null,
      targetUsername: username || null,
      actorUserId: actorUserId || null,
      reason: 'ban-in-channel'
    });
  }
  save(db);
  res.json({ ok: true, channel: ch });
});

// Unban a user from a channel (accept JSON body or query string)
app.delete('/groups/:groupId/channels/:channelId/ban', (req, res) => {
  const { groupId, channelId } = req.params;
  const source = (req.body && Object.keys(req.body).length) ? req.body : req.query;
  const { userId, username } = source || {};

  const group = db.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const ch = (group.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });

  ch.bannedUserIds = (ch.bannedUserIds || []).filter(id => id !== userId);
  ch.bannedUsernames = (ch.bannedUsernames || []).filter(u => u !== username);

  save(db);
  res.json({ ok: true, channel: ch });
});

// List banned users for a channel
app.get('/groups/:groupId/channels/:channelId/banned', (req, res) => {
  const { groupId, channelId } = req.params;
  const group = db.groups.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const ch = (group.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });

  res.json({
    bannedUserIds: ch.bannedUserIds || [],
    bannedUsernames: ch.bannedUsernames || []
  });
});

/** ---------- Leave Group ---------- **/
app.post('/groups/:groupId/leave', (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });

  const g = db.groups.find(gr => gr.id === groupId);
  if (!g) return res.status(404).json({ ok: false, error: 'group not found' });

  g.users = (g.users || []).filter(id => id !== userId);
  (g.channels || []).forEach(ch => {
    ch.members = (ch.members || []).filter(id => id !== userId);
  });
  g.joinRequests = (g.joinRequests || []).filter(id => id !== userId);

  save(db);
  res.json({ ok: true });
});

/** ---------- Messages ---------- **/
app.get('/messages', (req, res) => {
  const { groupId, channelId } = req.query;
  const g = db.groups.find(gr => gr.id === groupId);
  const ch = g?.channels.find(c => c.id === channelId);
  res.json(ch?.messages || []);
});

app.post('/messages', (req, res) => {
  const { groupId, channelId, username, userId, content } = req.body;
  const g = db.groups.find(gr => gr.id === groupId);
  if (!g) return res.status(404).json({ error: 'group not found' });
  const ch = g.channels.find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'channel not found' });

  // Enforce channel bans (by username or by userId)
  if ((ch.bannedUsernames || []).includes(username) ||
      (ch.bannedUserIds || []).includes(userId)) {
    return res.status(403).json({ error: 'User is banned from this channel' });
  }

  const msg = { username, content, timestamp: Date.now() };
  ch.messages = ch.messages || [];
  ch.messages.push(msg);
  save(db);
  res.status(201).json({ ok: true, message: msg });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
