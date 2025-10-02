const express = require('express');
const multer = require('multer');
const path = require('path');
const { getDb } = require('../mongo');
const { ObjectId } = require('mongodb');

const router = express.Router();

const avatarStore = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'avatars'),
  filename: (_req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g,'-');
    cb(null, safe);
  }
});
const chatStore = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads', 'chat'),
  filename: (_req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g,'-');
    cb(null, safe);
  }
});
const uploadAvatar = multer({ storage: avatarStore });
const uploadChat   = multer({ storage: chatStore });

// POST /upload/avatar  (form-data: file, userId)
router.post('/upload/avatar', uploadAvatar.single('file'), async (req, res) => {
  const { userId } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const url = `/uploads/avatars/${req.file.filename}`;

  const db = getDb();
  await db.collection('users').updateOne(
    { _id: new ObjectId(userId) },
    { $set: { avatarUrl: url } },
    { upsert: false }
  );
  res.json({ ok:true, avatarUrl: url });
});

// POST /upload/chat  (form-data: file, groupId, channelId, userId, username)
router.post('/upload/chat', uploadChat.single('file'), async (req, res) => {
  const { groupId, channelId, userId, username, avatarUrl } = req.body || {};
  if (!req.file) return res.status(400).json({ error: 'file required' });
  const url = `/uploads/chat/${req.file.filename}`;

  const db = getDb();
  const doc = { groupId, channelId, userId, username, avatarUrl, type: 'image', imageUrl: url, timestamp: Date.now() };
  await db.collection('messages').insertOne(doc);

  // optional: emit on sockets room here if you keep a shared io instance
  res.json({ ok:true, imageUrl: url });
});

module.exports = router;
