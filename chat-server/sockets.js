// chat-server/sockets.js
// chat-server/sockets.js
const { Server } = require('socket.io');
const { getDb } = require('./mongo');

const roomId = (groupId, channelId) => `${groupId}:${channelId}`;

module.exports = function registerSockets(server, app) {
  const io = new Server(server, { cors: { origin: '*' } });

  // Let REST routes broadcast via req.app.get('io')
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

        // Validate against DB (ready only after Mongo init)
        let db;
        try { db = getDb(); } catch { return ack?.({ ok: false, error: 'db-not-ready' }); }

        const g = await db.collection('groups').findOne({ id: groupId });
        if (!g) return ack?.({ ok: false, error: 'group not found' });
        const ch = (g.channels || []).find(c => c.id === channelId);
        if (!ch) return ack?.({ ok: false, error: 'channel not found' });

        const banned =
          (ch.bannedUserIds || ch.bannedUsers || []).includes(userId) ||
          (ch.bannedUsernames || []).includes(username);
        if (banned) return ack?.({ ok: false, error: 'banned' });

        // Leave previous room if switching
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
      const groupId   = payload.groupId   || socket.data.groupId;
      const channelId = payload.channelId || socket.data.channelId;
      const { userId, username } = socket.data || {};
      if (!groupId || !channelId) return ack?.({ ok: false, error: 'no room' });

      const room = roomId(groupId, channelId);
      socket.leave(room);
      io.to(room).emit('userLeft', { userId, username, ts: Date.now() });
      socket.data = {};
      ack?.({ ok: true });
    });

    /**
     * MESSAGE (broadcast-only)
     * IMPORTANT: Do NOT persist here. REST /messages is the single source of truth.
     * We only mirror what the client sends so others see something immediately.
     */
    socket.on('message', (msg = {}, ack) => {
      try {
        const { groupId, channelId } = msg;
        if (!groupId || !channelId) return ack?.({ ok: false, error: 'missing group/channel' });

        const doc = {
          groupId,
          channelId,
          userId: msg.userId,
          username: msg.username,
          avatarUrl: msg.avatarUrl ?? null,
          type: msg.type ?? (msg.imageUrl ? 'image' : 'text'),
          content: msg.content ?? null,
          imageUrl: msg.imageUrl ?? null,
          timestamp: msg.timestamp || Date.now()
        };

        // Exclude sender to avoid duplicates on their screen
        socket.to(roomId(groupId, channelId)).emit('message', doc);
        ack?.({ ok: true });
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
