// chat-server/routes/messages.js
const express = require('express');
const { getDb } = require('../mongo');

const router = express.Router();

// room helper must match sockets.js
const roomId = (groupId, channelId) => `${groupId}:${channelId}`;

/**
 * Parse an optional "before" value:
 * - number (ms) → use as-is
 * - ISO string  → Date.parse
 * - missing/invalid → now
 */
function parseBefore(v) {
  if (!v) return Date.now();
  const asNum = Number(v);
  if (!Number.isNaN(asNum)) return asNum;
  const t = Date.parse(v);
  return Number.isNaN(t) ? Date.now() : t;
}

/**
 * GET /messages?groupId=&channelId=&limit=50&before=<ms|ISO>
 * Returns the last N messages before "before" (default now), oldest→newest.
 */
router.get('/messages', async (req, res) => {
  try {
    const { groupId, channelId } = req.query;
    let { limit } = req.query;
    const before = parseBefore(req.query.before);

    if (!groupId || !channelId) {
      return res.status(400).json({ error: 'groupId and channelId are required' });
    }

    // sanitize limit: 1..100 (default 50)
    let n = parseInt(String(limit ?? 50), 10);
    if (Number.isNaN(n)) n = 50;
    n = Math.max(1, Math.min(n, 100));

    const db = getDb();

    // Optional but useful: ensure group & channel exist
    const g = await db.collection('groups').findOne({ id: groupId });
    if (!g) return res.status(404).json({ error: 'group not found' });
    const ch = (g.channels || []).find(c => c.id === channelId);
    if (!ch) return res.status(404).json({ error: 'channel not found' });

    const msgs = await db.collection('messages')
      .find({ groupId, channelId, timestamp: { $lt: before } })
      .sort({ timestamp: -1 })    // newest first
      .limit(n)
      .toArray();

    // return oldest → newest
    res.json(msgs.reverse());
  } catch (err) {
    console.error('[GET /messages] error', err);
    res.status(500).json({ error: 'internal' });
  }
});

/**
 * POST /messages
 * body: { groupId, channelId, userId, username, avatarUrl?, type? ('text'|'image'), content?, imageUrl? }
 * NOTE: REST is the single source of truth. We emit to the socket room AFTER saving.
 */
router.post('/messages', async (req, res) => {
  try {
    const {
      groupId,
      channelId,
      userId,
      username,
      avatarUrl,
      type = 'text',
      content,
      imageUrl
    } = req.body || {};

    if (!groupId || !channelId || !userId || !username) {
      return res.status(400).json({ error: 'groupId, channelId, userId, username are required' });
    }
    if (type === 'text' && !content) {
      return res.status(400).json({ error: 'content required for text messages' });
    }
    if (type === 'image' && !imageUrl) {
      return res.status(400).json({ error: 'imageUrl required for image messages' });
    }

    const db = getDb();
    const g = await db.collection('groups').findOne({ id: groupId });
    if (!g) return res.status(404).json({ error: 'group not found' });

    const ch = (g.channels || []).find(c => c.id === channelId);
    if (!ch) return res.status(404).json({ error: 'channel not found' });

    // Enforce channel bans (support both legacy and new keys)
    const banned =
      (ch.bannedUsernames || []).includes(username) ||
      (ch.bannedUserIds || ch.bannedUsers || []).includes(userId);
    if (banned) {
      return res.status(403).json({ error: 'User is banned from this channel' });
    }

    const doc = {
      groupId,
      channelId,
      userId,
      username,
      avatarUrl: avatarUrl ?? null,
      type,                         // 'text' | 'image'
      content: content ?? null,
      imageUrl: imageUrl ?? null,
      timestamp: Date.now()
    };

    await db.collection('messages').insertOne(doc);

    // Emit exactly once to the same room sockets use
    const io = req.app && req.app.get && req.app.get('io');
    if (io) io.to(roomId(groupId, channelId)).emit('message', doc);

    res.status(201).json({ ok: true, message: doc });
  } catch (err) {
    console.error('[POST /messages] error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;

