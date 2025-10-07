// chat-server/peer-server.js
const express = require('express');
const http = require('http');
const { ExpressPeerServer } = require('peer');

function startPeerServer() {
  const app = express();
  const server = http.createServer(app);

  const port = Number(process.env.PEER_PORT || 4001);
  const path = '/peerjs';

  const peerServer = ExpressPeerServer(server, {
    path,
    // debug: true,
    // proxied: true, // if needed behind proxy
  });

  app.use(path, peerServer);

  // If the port is already in use, DON'T crash the whole Node app.
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`[peer] Port ${port} is in use. Skipping PeerJS startup (video calls disabled).`);
    } else {
      console.error('[peer] server error:', err);
    }
  });

  server.listen(port, () => {
    console.log(`Peer server running at http://localhost:${port}${path}`);
  });

  return server;
}

module.exports = startPeerServer;

