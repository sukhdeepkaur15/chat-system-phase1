const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../mongo');
const { ObjectId } = require('mongodb');

const router = express.Router();

/* ---------- Ensure upload directories exist ---------- */
const AVATARS_DIR = path.join(__dirname, '..', 'uploads', 'avatars');
const CHAT_DIR    = path.join(__dirname, '..', 'uploads', 'chat');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(AVATARS_DIR);
ensureDir(CHAT_DIR);

/* ---------- Multer storage + filters ---------- */
function safeName(original) {
  return `${Date.now()}-${original.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.\-_]/g, '')}`;
}

const imageOnly = (_req, file, cb) => {
  if ((file.mimetype || '').startsWith('image/')) return cb(null, true);
  cb(new Error('Only image uploads are allowed'));
};

const avatarStore = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
  filename: (_req, file, cb) => cb(null, safeName(file.originalname))
});
const chatStore = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, CHAT_DIR),
  filename: (_req, file, cb) => cb(null, safeName(file.originalname))
});

const uploadAvatar = multer({
  storage: avatarStore, fileFilter: imageOnly, limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});
const uploadChat = multer({
  storage: chatStore, fileFilter: imageOnly, limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/* ---------- Helpers ---------- */
async function findUserQuery(db, { userId, username }) {
  const or = [];
  if (userId) {
    // your users use a custom "id" (uuid) field
    or.push({ id: userId });
    // also allow Mongo _id if caller passes it
    if (ObjectId.isValid(userId)) or.push({ _id: new ObjectId(userId) });
  }
  if (username) or.push({ username });
  if (or.length === 0) return null;
  return { $or: or };
}

/* =================== AVATAR UPLOAD =================== */
/** POST /upload/avatar  (form-data: file, userId? OR username?) */
router.post('/upload/avatar', uploadAvatar.single('file'), async (req, res) => {
  try {
    const { userId, username } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'file required' });

    const url = `/uploads/avatars/${req.file.filename}`;
    const db = getDb();

    const query = await findUserQuery(db, { userId, username });
    if (!query) return res.status(400).json({ error: 'userId or username required' });

    const result = await db.collection('users').updateOne(query, { $set: { avatarUrl: url } });
    if (result.matchedCount === 0) return res.status(404).json({ error: 'user not found' });

    res.json({ ok: true, avatarUrl: url });
  } catch (err) {
    console.error('[upload/avatar] error', err);
    res.status(500).json({ error: 'internal' });
  }
});

/* ================ CHAT IMAGE UPLOAD ================= */
/**
 * POST /upload/chat
 * form-data: file, groupId, channelId, userId, username, avatarUrl(optional)
 * Saves an image message and broadcasts to the room.
 */
router.post('/upload/chat', uploadChat.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file required' });

    const { groupId, channelId, userId, username, avatarUrl = null } = req.body || {};
    if (!groupId || !channelId || !userId || !username) {
      return res.status(400).json({ error: 'groupId, channelId, userId, username are required' });
    }

    const url = `/uploads/chat/${req.file.filename}`;
    const db = getDb();

    // Validate group/channel & bans (groups use custom "id", not _id)
    const g = await db.collection('groups').findOne({ id: groupId });
    if (!g) return res.status(404).json({ error: 'group not found' });
    const ch = (g.channels || []).find(c => c.id === channelId);
    if (!ch) return res.status(404).json({ error: 'channel not found' });

    const banned =
      (ch.bannedUserIds || []).includes(userId) ||
      (ch.bannedUsernames || []).includes(username);
    if (banned) return res.status(403).json({ error: 'User is banned from this channel' });

    // Persist image message
    const doc = {
      groupId, channelId, userId, username,
      avatarUrl, type: 'image', content: null,
      imageUrl: url, timestamp: Date.now()
    };
    await db.collection('messages').insertOne(doc);

    // Broadcast to channel room if sockets are registered
    const io = req.app.get('io');
    if (io) {
      io.to(`${groupId}:${channelId}`).emit('message', doc);
    }

    res.json({ ok: true, imageUrl: url, message: doc });
  } catch (err) {
    console.error('[upload/chat] error', err);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
