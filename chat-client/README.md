Chat System — Phases 1 & 2 Documentation
Node/Express + MongoDB server • Angular client • Socket.IO • PeerJS

1.	Overview
This repository document both the Phase 1 and the Phase 2 portion of the Chat System. The application is an Express.js API with a MongoDB data layer, with an Angular based client. Chat is implemented with real-time messaging via Socket.IO and video calling with PeerJS. Phase 2 includes image uploading, content moderation reporting, message pagination, and testing (Mocha/Chai on the server and Karma/Jasmine unit tests on the client, along with Cypress end-to-end tests).


2. Git Repository Organization & Usage
LINK - https://github.com/sukhdeepkaur15/chat-system-phase1
layout:
•	chat-server/: Express API, Socket.IO, PeerJS bootstrap, Mongo access, tests.
•	chat-client/: Angular app with components, services, models, and Cypress tests.
•	README.md at repo root: setup, run, test, and architectural notes.
•	Do not commit node_modules/. Use .gitignore.
Recommended Git usage during development:
Create a branch per feature (e.g., feature/uploads, feature/reports).
Commit early and often with descriptive messages (e.g., "server: add /upload/chat and tests").
Open pull requests to review changes; squash-merge to keep history clean.

3. Data Structures
Server-side MongoDB collections and typical document shapes:
users: {
  _id: ObjectId,
  id: string,                // uuid for app-level identifier
  username: string,          // unique
  password?: string,         // simple per brief
  email?: string,
  roles: string[],           // ['user'] | ['groupAdmin'] | ['super']
  groups: string[],          // group ids the user belongs to
  avatarUrl?: string,        // set by /upload/avatar
  createdAt: number
}
groups: {
  _id: ObjectId,
  id: string,                // uuid
  name: string,
  creatorId: string,         // user id
  users: string[],           // user ids (members)
  joinRequests: string[],    // pending user ids
  channels: [{
    id: string, name: string,
    members: string[],       // user ids allowed to post/read
    messages?: any[],        // (phase1) kept for compatibility
    bannedUserIds: string[],
    bannedUsernames: string[]
  }]
}
messages: {
  _id: ObjectId,
  groupId: string,
  channelId: string,
  userId: string,
  username: string,
  avatarUrl?: string,
  type: 'text' | 'image',
  content?: string,
  imageUrl?: string,
  timestamp: number          // indexed for pagination
}
reports: {
  _id: ObjectId,
  id: string,                // uuid
  groupId: string,
  channelId: string,
  targetUserId?: string,
  targetUsername?: string,
  actorUserId?: string,
  reason: string,            // e.g. 'ban-in-channel'
  status: 'open' | 'resolved',
  createdAt: number,
  resolvedAt?: number
}
Client-side models mirror these structures using TypeScript interfaces (User, Group, Channel, Message).


4. Division of Responsibilities
Server responsibilities:
•	Expose REST API (JSON) for groups, channels, messages, reports, upload, etc.
•	Enforce membership and bans on server-side (403 on forbidden).
•	Persist messages and files; maintain indexes; seed super user.
•	Broadcast real-time events via Socket.IO rooms (groupId:channelId).
•	Run PeerJS server for WebRTC signalling on port 4001.
Client responsibilities:
•	Authenticate locally (per brief), load groups/channels, and render UI.
•	Call REST endpoints for CRUD and uploads; use Socket.IO for live messages.
•	Use PeerJS for video calls; handle basic moderation UI (ban/unban, reports).
Method	Path	URL Params	Body	Returns	Purpose
GET	/health		—	{ ok: true }	Service health check
GET	/groups		—	Group[]	List all groups
POST	/groups		{ name, creatorId }	Group	Create a group
DELETE	/groups/:groupId	groupId	—	{ ok }	Delete a group
POST	/groups/:groupId/channels	groupId	{ name }	Channel	Create a channel in group
DELETE	/groups/:groupId/channels/:channelId	groupId,channelId	—	{ ok }	Remove a channel
POST	/groups/:groupId/join	groupId	{ userId }	{ ok }	Request to join group
PUT	/groups/:groupId/approve/:userId	groupId,userId	—	Group	Approve a request
PUT	/groups/:groupId/reject/:userId	groupId,userId	—	Group	Reject a request
GET	/groups/:groupId/channels/:channelId/banned	groupId,channelId	—	{ bannedUserIds, bannedUsernames }	List bans
POST	/groups/:groupId/channels/:channelId/ban	groupId,channelId	{ userId?, username?, actorUserId?, report? }	{ ok, channel }	Ban by id/name; optionally create report
DELETE	/groups/:groupId/channels/:channelId/ban	groupId,channelId	{ userId?, username? }	{ ok, channel }	Unban by id/name
POST	/groups/:groupId/leave	groupId	{ userId }	{ ok }	Leave group
GET	/messages	groupId, channelId, limit?, before?	—	Message[]	List messages (paged oldest→newest)
POST	/messages		{ groupId, channelId, username, userId, content }	{ ok, message }	Post text message (REST)
GET	/reports		—	Report[]	List reports (super admin)
POST	/reports		{ ... }	Report	Create a report (used by GA ban with report:true)
PUT	/reports/:id/resolve	id	—	{ ok, report }	Mark report as resolved
POST	/upload/avatar		FormData(file,userId)	{ ok, avatarUrl }	Upload profile avatar
POST	/upload/chat		FormData(file,groupId,channelId,username,userId)	{ ok, imageUrl }	Upload chat image and persist image message
 
Static files are served from /uploads (avatars under /uploads/avatars and chat images under /uploads/chat).


6. Socket.IO Events
Events exposed by the server (sockets.js):
Event	Payload	Ack/Emit	Notes
joinChannel	{ groupId, channelId, userId, username }	ack { ok|error }	Joins room groupId:channelId; validates bans/membership.
leaveChannel	{ groupId?, channelId? }	ack { ok }	Leaves current room and emits 'userLeft'.
message	{ groupId, channelId, userId, username, type, content?, imageUrl?, avatarUrl? }	ack { ok, message }	Persists to Mongo then emits 'message' to room.
userJoined (emit)	{ userId, username, ts }	—	Broadcast when someone joins the room.
userLeft (emit)	{ userId, username, ts }	—	Broadcast when someone leaves the room.


7. Angular Architecture
Key pieces:
•	Components: LoginComponent, DashboardComponent (groups/channels/chat/video).
•	Services: ApiService (REST), GroupService (groups/channels/bans), ChatService (messages + sockets + uploads), AuthService (local auth + users).
•	Models: User, Group, Channel, Message (interfaces).
•	Routes: /login, /dashboard (guarded).
DashboardComponent wires message history via ApiService/ChatService, renders avatars/images, and controls PeerJS for video calls (start, call by remote ID, end).


8. Client–Server Interaction Flows
Examples of flows:
•	Send text message:
Client: POST /messages  { groupId, channelId, username, userId, content }
Server: validate bans → persist to messages → return { ok, message } → emit 'message' over Socket.IO to room.
•	Upload image to chat:
Client: POST /upload/chat  (FormData: file, groupId, channelId, username, userId)
Server: store file → insert image message → emit to room → return { ok, imageUrl }
•	Ban user in channel:
Client: POST /groups/:gid/channels/:cid/ban  { userId? or username?, actorUserId, report: true }
Server: add to banned lists; remove from members; if report=true, insert a report; return { ok, channel }


9. Video Chat (PeerJS)
The PeerJS server runs at http://localhost:4001/peerjs. The client creates one Peer instance when the user opens the dashboard, then calls getUserMedia to attach local video, display 'My ID', and call a remote by ID. Incoming calls are answered with local media if available.


10. Testing
Server (Mocha + Chai):
•	groups.test.js: health, create/list/approve/leave/delete flows.
•	messages.test.js: pagination and bans for REST messages.
•	reports.test.js: create & resolve reports.
•	upload.test.js: avatar upload and /upload/chat + broadcast.
 
(screenshot in docx)

Client unit (Karma + Jasmine):
•	api.service.spec.ts: base URL prefixing, POST aliases, upload form-data keys.
•	chat.service.spec.ts: getMessages/sendMessage/use uploadChatImage delegation.

(screenshot in docx) 
 
E2E (Cypress):
•	login.cy.js: login flow.
•	groups.cy.js: create channels, join/approve.
•	chat-send.cy.js: stub POST /messages; assert UI shows message.
•	chat-upload.cy.js: stub /upload/chat; assert image appears.

 (screenshot in docx)

 
11. Running & Environment
Server:
cd chat-server
npm install
# ensure MongoDB is running locally
npm start   # API on :4000, PeerJS on :4001
npm test    # mocha tests
Client:
cd chat-client
npm install
npm start   # Angular dev server (default :4200)
npm test    # Karma unit tests
npm run e2e:open   # Cypress
Environment variables (example .env):
MONGO_URL=mongodb://127.0.0.1:27017/chat_system_phase2
PORT=4000
PEER_PORT=4001
CORS_ORIGIN=http://localhost:4200
