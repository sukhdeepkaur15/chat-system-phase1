// chat-server/sockets.js
const { Server } = require('socket.io');
const { getDb } = require('./mongo');

const roomId = (groupId, channelId) => `${groupId}:${channelId}`;

module.exports = function registerSockets(server, app) {
  const io = new Server(server, { cors: { origin: '*' } });

  // Allow REST routes to broadcast: req.app.get('io')
  if (app && typeof app.set === 'function') app.set('io', io);

  io.on('connection', (socket) => {
    socket.data = {}; // { groupId, channelId, userId, username, room }

    /** JOIN CHANNEL */
    socket.on('joinChannel', async (payload = {}, ack) => {
      try {
        const { groupId, channelId, userId, username } = payload;
        if (!groupId || !channelId || !userId || !username) {
          return ack?.({ ok: false, error: 'groupId, channelId, userId, username are required' });
        }

        // ✅ Call getDb() *here* (inside the handler)
        let db;
        try { db = getDb(); } catch { return ack?.({ ok: false, error: 'db-not-ready' }); }

        const g = await db.collection('groups').findOne({ id: groupId });
        if (!g) return ack?.({ ok: false, error: 'group not found' });
        const ch = (g.channels || []).find(c => c.id === channelId);
        if (!ch) return ack?.({ ok: false, error: 'channel not found' });

        const banned =
          (ch.bannedUserIds || []).includes(userId) ||
          (ch.bannedUsernames || []).includes(username);
        if (banned) return ack?.({ ok: false, error: 'banned' });

        // leave previous room if switching
        if (socket.data.room && socket.data.room !== roomId(groupId, channelId)) {
          const prev = socket.data.room;
          socket.leave(prev);
          io.to(prev).emit('userLeft', {
            userId: socket.data.userId,
            username: socket.data.username,
            ts: Date.now()
          });
        }

        const room = roomId(groupId, channelId);
        socket.join(room);
        socket.data = { groupId, channelId, userId, username, room };

        io.to(room).emit('userJoined', { userId, username, ts: Date.now() });
        ack?.({ ok: true });
      } catch (e) {
        console.error('[joinChannel] error', e);
        ack?.({ ok: false, error: 'internal' });
      }
    });

    /** LEAVE CHANNEL */
    socket.on('leaveChannel', (payload = {}, ack) => {
      const groupId = payload.groupId || socket.data.groupId;
      const channelId = payload.channelId || socket.data.channelId;
      const { userId, username } = socket.data || {};
      if (!groupId || !channelId) return ack?.({ ok: false, error: 'no room' });

      const room = roomId(groupId, channelId);
      socket.leave(room);
      io.to(room).emit('userLeft', { userId, username, ts: Date.now() });
      socket.data = {};
      ack?.({ ok: true });
    });

    /** MESSAGE (persist -> emit) */
    socket.on('message', async (msg = {}, ack) => {
      try {
        const {
          groupId, channelId, userId, username,
          avatarUrl = null, type = 'text', content = null, imageUrl = null
        } = msg;

        if (!groupId || !channelId || !userId || !username) {
          return ack?.({ ok: false, error: 'groupId, channelId, userId, username are required' });
        }
        if (type === 'text' && !content)   return ack?.({ ok: false, error: 'content required for text message' });
        if (type === 'image' && !imageUrl) return ack?.({ ok: false, error: 'imageUrl required for image message' });

        // ✅ Call getDb() *here* (inside the handler)
        let db;
        try { db = getDb(); } catch { return ack?.({ ok: false, error: 'db-not-ready' }); }

        const g = await db.collection('groups').findOne({ id: groupId });
        if (!g) return ack?.({ ok: false, error: 'group not found' });
        const ch = (g.channels || []).find(c => c.id === channelId);
        if (!ch) return ack?.({ ok: false, error: 'channel not found' });

        const banned =
          (ch.bannedUserIds || []).includes(userId) ||
          (ch.bannedUsernames || []).includes(username);
        if (banned) return ack?.({ ok: false, error: 'banned' });

        const doc = {
          groupId, channelId, userId, username,
          avatarUrl, type, content, imageUrl,
          timestamp: Date.now()
        };
        await db.collection('messages').insertOne(doc);

        io.to(roomId(groupId, channelId)).emit('message', doc);
        ack?.({ ok: true, message: doc });
      } catch (e) {
        console.error('[socket message] error', e);
        ack?.({ ok: false, error: 'internal' });
      }
    });

    /** DISCONNECT */
    socket.on('disconnecting', () => {
      const { room, userId, username } = socket.data || {};
      if (room) io.to(room).emit('userLeft', { userId, username, ts: Date.now() });
    });
  });

  return io;
};
