const express = require('express');
const { ObjectId } = require('mongodb');
const { getDb } = require('../mongo');
const router = express.Router();

// GET /groups
router.get('/groups', async (_req, res) => {
  const db = getDb();
  const list = await db.collection('groups')
    .find({}, { projection: { name:1, creatorId:1, users:1, joinRequests:1, channels:1 } })
    .toArray();
  res.json(list.map(g => ({ id: g._id.toString(), ...g })));
});

// POST /groups { name, creatorId }
router.post('/groups', async (req, res) => {
  const { name, creatorId } = req.body || {};
  if (!name || !creatorId) return res.status(400).json({ error: 'name and creatorId required' });
  const db = getDb();
  const doc = { name, creatorId, users: [creatorId], joinRequests: [], channels: [] };
  const r = await db.collection('groups').insertOne(doc);
  res.status(201).json({ id: r.insertedId.toString(), ...doc });
});

// POST /groups/:groupId/channels { name }
router.post('/groups/:groupId/channels', async (req, res) => {
  const { groupId } = req.params;
  const { name } = req.body || {};
  const db = getDb();
  const group = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const channel = {
    id: new ObjectId().toString(),
    name,
    members: [...(group.users || [])],
    bannedUserIds: [],
    bannedUsernames: []
  };
  await db.collection('groups').updateOne(
    { _id: new ObjectId(groupId) },
    { $push: { channels: channel } }
  );
  res.status(201).json(channel);
});

// DELETE /groups/:groupId/channels/:channelId
router.delete('/groups/:groupId/channels/:channelId', async (req, res) => {
  const { groupId, channelId } = req.params;
  const db = getDb();
  const r = await db.collection('groups').updateOne(
    { _id: new ObjectId(groupId) },
    { $pull: { channels: { id: channelId } } }
  );
  res.json({ ok: r.modifiedCount > 0 });
});

// POST /groups/:groupId/leave { userId }
router.post('/groups/:groupId/leave', async (req, res) => {
  const { groupId } = req.params;
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ ok:false, error:'userId required' });

  const db = getDb();
  const g = await db.collection('groups').findOne({ _id: new ObjectId(groupId) });
  if (!g) return res.status(404).json({ ok:false, error:'group not found' });

  await db.collection('groups').updateOne(
    { _id: g._id },
    {
      $pull: { users: userId, joinRequests: userId },
      $set: {
        channels: (g.channels || []).map(ch => ({
          ...ch, members: (ch.members || []).filter(id => id !== userId)
        }))
      }
    }
  );
  res.json({ ok:true });
});

module.exports = router;
