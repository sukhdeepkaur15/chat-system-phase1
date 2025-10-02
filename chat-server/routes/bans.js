const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../mongo');
const router = express.Router();

router.post('/groups/:groupId/channels/:channelId/ban', async (req, res) => {
  const { groupId, channelId } = req.params;
  const { userId, username } = req.body || {};
  const db = getDb();
  const g = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
  if (!g) return res.status(404).json({ error: 'Group not found' });

  const channels = (g.channels || []).map(ch => {
    if (ch.id !== channelId) return ch;
    ch.bannedUserIds = ch.bannedUserIds || [];
    ch.bannedUsernames = ch.bannedUsernames || [];
    if (userId && !ch.bannedUserIds.includes(userId)) ch.bannedUserIds.push(userId);
    if (username && !ch.bannedUsernames.includes(username)) ch.bannedUsernames.push(username);
    if (userId) ch.members = (ch.members || []).filter(id => id !== userId);
    return ch;
  });

  await db.collection('groups').updateOne({ _id: g._id }, { $set: { channels } });
  res.json({ ok:true });
});

router.delete('/groups/:groupId/channels/:channelId/ban', async (req, res) => {
  const { groupId, channelId } = req.params;
  const { userId, username } = Object.keys(req.body||{}).length ? req.body : req.query;
  const db = getDb();
  const g = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
  if (!g) return res.status(404).json({ error: 'Group not found' });

  const channels = (g.channels || []).map(ch => {
    if (ch.id !== channelId) return ch;
    ch.bannedUserIds = (ch.bannedUserIds || []).filter(id => id !== userId);
    ch.bannedUsernames = (ch.bannedUsernames || []).filter(u => u !== username);
    return ch;
  });

  await db.collection('groups').updateOne({ _id: g._id }, { $set: { channels } });
  res.json({ ok:true });
});

module.exports = router;
