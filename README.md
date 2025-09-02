Chat System – Phase 1

Name: Sukhdeep Kaur (s5388440)
Software Frameworks (3813ICT_3255)

1) Git Repository Organization & Usage

Structure

chat-client/ – Angular frontend (standalone components, routing).

server/ – (Phase-1 optional) Node/Express scaffold for future MongoDB phase.

.gitignore excludes node_modules/, build artefacts.

Practices

Branching: feature branches like feat/auth, feat/groups, fix/guards.

Commit frequency: small, descriptive commits per feature/fix.

Separation: frontend and (optional) server kept in separate folders for clarity.

2) Data Structures (Client & Server)
Client models (TypeScript)
// users
interface User {
  id: string;               // UUID
  username: string;         // unique
  email: string;
  roles: string[];          // 'super' | 'groupAdmin' | 'user'
  groups: string[];         // group IDs the user belongs to
}

// chat messages
interface Message {
  username: string;         // sender username
  content: string;
  timestamp: number;        // ms since epoch
}

// channel (subgroup)
interface Channel {
  id: string;
  name: string;
  members: string[];        // user IDs who can access this channel
  messages: Message[];      // chronological list
}

// group (top-level container)
interface Group {
  id: string;
  name: string;
  creatorId: string;        // user ID of the GA/Super who created it
  users: string[];          // member IDs
  joinRequests: string[];   // pending user IDs
  channels: Channel[];
}

Server-side (Phase 1)

Persistence: Phase-1 uses browser LocalStorage for data (as permitted).

(Optional stub) data.json structure mirrors the client models for Phase 2 migration.

3) Angular Architecture
Components

LoginComponent

Username/password form (Phase-1 simple check).

On success, persists currentUser in LocalStorage; routes to /dashboard.

DashboardComponent

Lists groups relevant to the user (Super sees all; GA sees created/owned and joined; User sees all with “Request to Join”).

Per-group actions based on role: request/approve/reject, add channel, leave group, delete group, remove channel.

Channel view with messages and send box.

Services

AuthService

login(username, password) / logout()

getUser() / role helpers isSuper(), isGroupAdmin()

User management for Super: create, promote, delete.

Stores session and users in LocalStorage.

GroupService

loadGroups() / saveGroups() to/from LocalStorage.

Group CRUD: createGroup, deleteGroup

Join flow: requestToJoin, approveJoinRequest, rejectJoinRequest

Membership: addUserToGroup, removeUserFromGroup, leaveGroup

Channels: createChannel, removeChannel

ChatService

sendMessage(groupId, channelId, username, content)

getMessages(groupId, channelId)

Messages are stored inside the channel’s messages[] (in groups persisted via GroupService).

Models

user.model.ts, group.model.ts define the interfaces above.

Routes

/login → LoginComponent

/dashboard → DashboardComponent (guarded by auth)

4) Node Server Architecture (Phase 1)

Phase-1 requirement allows LocalStorage; a minimal server is scaffolded for Phase-2 migration.

Files (optional in Phase-1):

server/index.js (Express app placeholder)

server/data.json (JSON persistence placeholder)

Modules

Express, CORS, JSON body parsing

Functions

load() / save() to read/write JSON (Phase-2)

Globals

None beyond the loaded JSON object in the stub

(For Phase-1, the Angular app does not depend on the server; data is kept in LocalStorage.)

5) Server-Side Routes (Defined for Phase-2 Migration; Optional in Phase-1)
Method	Route	Body / Params	Returns	Purpose
POST	/api/auth/login	{ username, password }	{ user }	Authenticate; return user (role info).
GET	/api/users	–	User[]	List users (Super only).
POST	/api/users	{ id, username, email, roles }	{ ok: true }	Create user (Super).
DELETE	/api/users/:id	id path	{ ok: true }	Delete user (Super).
GET	/api/groups	–	Group[]	List groups.
POST	/api/groups	Group	{ ok: true }	Create group.
PUT	/api/groups/:groupId	Group	{ ok: true }	Update group (channels/members/etc.).
DELETE	/api/groups/:groupId	groupId path	{ ok: true }	Delete group (Super or creator).
POST	/api/groups/:groupId/join	{ userId }	{ ok: true }	Request to join.
PUT	/api/groups/:groupId/approve/:userId	–	{ ok: true }	Approve join request.
PUT	/api/groups/:groupId/reject/:userId	–	{ ok: true }	Reject join request.
POST	/api/groups/:groupId/channels	{ name }	Channel	Create channel.
DELETE	/api/groups/:groupId/channels/:cid	groupId, cid path	{ ok: true }	Remove channel.
POST	/api/messages	{ groupId, channelId, message }	{ ok: true }	Send message to channel.

In Phase-1, the equivalent mutations are done client-side and persisted with localStorage.

6) Client–Server Interaction & UI Updates (Phase 1 workflow)

Because Phase-1 uses LocalStorage, “server-side” below refers to GroupService/AuthService state persisted to LocalStorage. The following describes how each UI action changes data and updates views:

Authentication

LoginComponent calls AuthService.login(username, password).

On success, currentUser is saved to LocalStorage and the app navigates to /dashboard.

DashboardComponent reads currentUser and loads groups via GroupService.loadGroups().

Group Visibility

Super Admin: sees all groups (groups = getGroups()).

Group Admin: sees groups they created and any they joined.

User: sees all groups but cannot access channels unless a member (will see “Request to Join”).

Request to Join

User clicks Request to Join → GroupService.requestToJoin(groupId, userId) pushes userId into group.joinRequests and persists with saveGroups().

Dashboard re-reads groups (or the component state updates) and shows “Request pending…” for that group.

Approve / Reject

Super or Group Creator (GA) opens the group panel and sees pending requests.

Clicking Approve → GroupService.approveJoinRequest(groupId, userId):

Removes userId from joinRequests

Adds userId to users

(Optional) Adds to each channel’s members by default, or keeps channels opt-in

Calls saveGroups()

Component refreshes its groups list; the user now sees channels for groups they’re in.

Channels

Admins (Super or GA of that group) can add/remove channels:

Add → GroupService.createChannel(groupId, name) → push to group.channels → saveGroups() → UI visibleChannels updates.

Remove → GroupService.removeChannel(groupId, channelId, requesterId) → saveGroups() → UI updates.

Access Control & Visibility

A user cannot see channels unless:

They are in group.users, and

Their userId is in channel.members (or the app auto-adds members on approve).

Dashboard computes visibleChannels = channels where currentUser.id ∈ channel.members.

Messaging

Selecting a channel calls ChatService.getMessages(groupId, channelId) to display messages[].

Sending a message calls ChatService.sendMessage(...) which appends {username, content, timestamp} to that channel’s messages[], then persists via GroupService.saveGroups().

The messages panel rebinds to the updated array and shows the new message.

Leaving / Deleting

Leave Group: GroupService.leaveGroup(groupId, userId) removes membership and channel access; saveGroups(); UI hides the group’s channels for that user.

Delete Group: allowed for Super or group creator only; removes the group; UI refreshes group list.

Conclusion

This Phase 1 implementation provides:

User authentication and role-based UI.

Group and channel management.

Join request and approval workflow.

Message storage and retrieval.

LocalStorage persistence (to be replaced by MongoDB in Phase 2).
