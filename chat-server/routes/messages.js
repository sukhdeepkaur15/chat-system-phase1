const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../mongo');
const router = express.Router();

// GET /messages?groupId=&channelId=&limit=50
router.get('/messages', async (req, res) => {
  const { groupId, channelId, limit = 50 } = req.query;
  const db = getDb();
  const msgs = await db.collection('messages')
    .find({ groupId, channelId })
    .sort({ timestamp: -1 })
    .limit(parseInt(limit,10))
    .toArray();
  res.json(msgs.reverse());
});

// POST /messages { groupId, channelId, userId, username, avatarUrl?, type?, content?, imageUrl? }
router.post('/messages', async (req, res) => {
  const { groupId, channelId, userId, username, avatarUrl, type = 'text', content, imageUrl } = req.body || {};
  const db = getDb();

  const g = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
  if (!g) return res.status(404).json({ error: 'group not found' });
  const ch = (g.channels || []).find(c => c.id === channelId);
  if (!ch) return res.status(404).json({ error: 'channel not found' });

  if ((ch.bannedUsernames || []).includes(username) || (ch.bannedUserIds || []).includes(userId)) {
    return res.status(403).json({ error: 'User is banned from this channel' });
  }

  const msg = { groupId, channelId, userId, username, avatarUrl, type, content, imageUrl, timestamp: Date.now() };
  await db.collection('messages').insertOne(msg);

  // Socket broadcast happens in sockets.js; we’ll emit from there via server-side hook (see below)
  res.status(201).json({ ok: true });
});

module.exports = router;
