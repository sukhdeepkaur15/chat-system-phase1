# Chat System -- Phase 1 Documentation

## Repository Organisation and Git Usage

The repository is organised into two main folders:

\- chat-server/: Node/Express server with Socket.IO, REST endpoints, and
JSON storage.

\- chat-client/: Angular frontend application with components, services,
and models.

Additional files:

\- .gitignore excludes node_modules and build artifacts.

\- README.md contains documentation.

\- package.json in both client and server directories for dependencies.

Git approach:

\- Branch: main branch for development.

\- Frequent commits with descriptive messages (e.g., "Add ban management
in dashboard", "Fix group join request logic").

\- Clear separation between frontend and backend commits.

## Data Structures

Client (Angular, LocalStorage Phase 1)

User

{

id: string;

username: string;

email: string;

roles: string\[\]; // e.g. \[\"user\"\], \[\"groupAdmin\"\],
\[\"super\"\]

groups: string\[\];

}

Stored in localStorage under key users. Current session user stored
under currentUser.

Server (data.json)

Group

{

\"id\": \"g1\",

\"name\": \"Group 1\",

\"creatorId\": \"u1\",

\"users\": \[\"u1\", \"u2\"\],

\"joinRequests\": \[\"u3\"\],

\"channels\": \[\...\]

}

Channel

{

\"id\": \"c1\",

\"name\": \"General\",

\"members\": \[\"u1\", \"u2\"\],

\"bannedUsers\": \[\"u4\"\],

\"bannedUsernames\": \[\"spamUser\"\],

\"messages\": \[\...\]

}

Message

{

\"id\": \"m1\",

\"username\": \"jack\",

\"content\": \"Hello world\",

\"timestamp\": \"2025-09-01T12:00:00Z\"

}

Bans:

\- Managed per-channel.

\- Two lists maintained:

\- bannedUsers → by user ID.

\- bannedUsernames → by username.

\- On ban: user removed from members and added to banned list.

\- On unban: user is removed from banned list; they may rejoin the
channel.

## Angular Architecture

Components

\- login/: Login form with authentication.

\- dashboard/: Main interface for groups, channels, chat, and admin
functions.

Services

\- auth.service.ts -- manages localStorage users, login/logout, role
checks.

\- group.service.ts -- handles groups, channels, join requests, bans
(via REST).

\- chat.service.ts -- manages messages, sockets.

Models

\- user.model.ts -- structure for User.

\- group.model.ts -- structures for Group, Channel, Message.

Routes

{ path: \'login\', component: LoginComponent }

{ path: \'dashboard\', component: DashboardComponent }

{ path: \'\', redirectTo: \'login\', pathMatch: \'full\' }

## Node Server Architecture

Files

\- server.js → entry point; configures Express and Socket.IO.

\- routes/groups.js → REST endpoints for groups/channels.

\- routes/auth.js → basic user authentication endpoints (Phase 2).

\- data.json → persistent JSON storage.

Functions

\- createGroup(name, creatorId)

\- deleteGroup(id)

\- createChannel(groupId, name)

\- removeChannel(groupId, channelId)

\- banUserInChannel(groupId, channelId, userId?, username?)

\- unbanUserInChannel(\...)

\- sendMessage(groupId, channelId, message)

Global variables

\- groupsCache in group.service.ts -- cached groups client-side.

\- Server reads/writes data.json on updates.

## REST API

Route \| Method \| Params \| Returns \| Purpose

/groups \| GET \| -- \| \[Group\] \| Fetch all groups

/groups \| POST \| {name, creatorId} \| Group \| Create new group

/groups/:id \| DELETE \| -- \| {ok} \| Delete a group

/groups/:id/channels \| POST \| {name} \| Channel \| Create channel

/groups/:id/channels/:cid \| DELETE \| -- \| {ok} \| Remove channel

/groups/:id/join \| POST \| {userId} \| {ok} \| Request to join

/groups/:id/approve/:uid \| PUT \| -- \| Group \| Approve join

/groups/:id/reject/:uid \| PUT \| -- \| Group \| Reject join

/groups/:id/channels/:cid/ban \| POST \| {userId?, username?} \| {ok} \|
Ban user

/groups/:id/channels/:cid/ban \| DELETE \| {userId?, username?} \| {ok}
\| Unban user

/groups/:id/channels/:cid/messages \| GET \| -- \| \[Message\] \| Fetch
messages

/groups/:id/channels/:cid/messages \| POST \| {username, content} \|
{ok} \| Send message

## Client--Server Interaction

1\. Join request:

\- Client sends /groups/:id/join → server adds to joinRequests.

\- Dashboard shows request to group admin/super for approval.

2\. Ban:

\- GroupAdmin clicks "Ban at Channel" → POST /ban.

\- Server updates bannedUsers / bannedUsernames.

\- Client refreshes group → user disappears from members.

\- If banned user tries to send a message, server rejects with 403 →
client shows yellow warning.

3\. Unban:

\- Super/GA clicks "Unban" → DELETE /ban.

\- Server removes from banned list.

\- Client refresh updates and member reappears.

## Notes on Storage

Users: localStorage until MongoDB is added (Phase 2).

Groups/Channels/Messages/Bans: stored in server/data.json.

## Summary

The system supports all required features:

\- Multi-level roles (super, group admin, user).

\- Group creation, join requests, approval/rejection.

\- Channels inside groups.

\- Per-channel bans with reporting to super admins.

\- Local storage + server JSON persistence.

\- Angular frontend + Node/Express backend with REST + sockets.
