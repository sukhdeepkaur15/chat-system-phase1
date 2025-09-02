Chat System – Phase 1

Name: Sukhdeep Kaur (s5388440)
Software Frameworks (3813ICT_3255)


Version Control (Git & GitHub)

Git was used throughout the development of this project to ensure incremental progress, traceability, and collaboration-readiness. The project is hosted on a private GitHub repository, with my tutor added as a collaborator.

Repository Layout

chat-client/ → Angular front end

chat-server/ → Node.js/Express back end

README.md → Documentation

.gitignore → Ensures node_modules/ and build artifacts are excluded

Workflow

Development started with git init inside the project folders.

Frequent commits were made with descriptive messages to capture incremental changes. Examples:

feat(auth): add login/logout service

fix(groups): persist join requests in localStorage

refactor(dashboard): role-based UI conditions

GitHub was used as the remote repository (git remote add origin ...).

The main branch was kept stable, while feature experiments were committed directly.

Regular git push ensured GitHub history reflected the ongoing work.

Benefits

Provided a timeline of progress for my tutor/marker.

Allowed me to rollback if needed.

Ensured a clean and logical repository layout as required in the assignment.
Introduction

This repository contains the implementation for Assignment Phase 1 of the Chat System project.
The system allows users to communicate in groups and channels with three levels of permissions:

Super Admin

Group Admin

User

The stack used is the MEAN stack (MongoDB, Express, Angular, Node.js), along with placeholders for Socket.io and Peer.js (to be introduced in Phase 2). For Phase 1, data is persisted using JSON text files on the server.

--Git Repository Organization
/chat-client   # Angular frontend
/chat-server   # Node/Express backend
README.md      # Documentation

Git usage

Frequent commits were made to track development progress.

Commit messages follow a meaningful pattern, e.g.:

feat(auth): add login/logout

feat(groups): persist groups to JSON

fix(ui): prevent duplicate join buttons

Branching strategy: main branch kept stable, experimental features developed in feature/* branches.

-- Data Structures
User
{
  "id": "uuid",
  "username": "string",
  "email": "string",
  "roles": ["super" | "groupAdmin" | "user"],
  "groups": ["groupId1", "groupId2"]
}

Group
{
  "id": "uuid",
  "name": "string",
  "creatorId": "userId",
  "users": ["userId1", "userId2"],
  "channels": ["channelId1", "channelId2"],
  "joinRequests": ["userId3"]
}

Channel
{
  "id": "uuid",
  "name": "string",
  "messages": [ { "username": "string", "content": "string", "timestamp": 12345678 } ]
}

Message
{
  "username": "string",
  "content": "string",
  "timestamp": "number"
}

--Angular Architecture

Components

LoginComponent: Handles authentication.

DashboardComponent: Main UI showing groups, channels, and messages.

Services

AuthService: Manages login/logout, user creation, promotions.

GroupService: Manages groups, channels, join requests.

ChatService: Handles message send/retrieve.

Models

User, Group, Channel, Message.

Routing

/login → Login page

/dashboard → Main chat dashboard

⚙️ Node/Express Architecture

Files

index.js: Main server file.

data.json: Persistent storage of users, groups, channels.

Modules/Functions

loadData(): Reads from JSON file at startup.

saveData(data): Writes updates back to JSON file.

Routes handle authentication, user management, groups, and channels.

Global Variables

data: Object storing users, groups, channels in memory.

--REST API Routes
Method	Route	Body	Returns	Purpose
POST	/api/auth/login	{ username, password }	{ user }	Authenticate user
GET	/api/users	–	[users]	List all users
POST	/api/users	{ username, email, roles }	{ user }	Create new user
DELETE	/api/users/:id	–	{ success }	Delete user
POST	/api/users/:id/promote	{ role }	{ user }	Promote user role
GET	/api/groups	–	[groups]	List all groups
POST	/api/groups	{ name, creatorId }	{ group }	Create new group
POST	/api/groups/:id/channels	{ name }	{ channel }	Create channel in group
POST	/api/groups/:id/join	{ userId }	{ success }	Request to join
POST	/api/groups/:id/approve	{ userId }	{ success }	Approve join request
POST	/api/groups/:id/reject	{ userId }	{ success }	Reject join request
POST	/api/groups/:id/leave	{ userId }	{ success }	Leave group
GET	/api/groups/:id/channels/:channelId/messages	–	[messages]	Get messages
POST	/api/groups/:id/channels/:channelId/messages	{ username, content }	{ message }	Send message
-- Client–Server Interaction

Login

Angular → POST /api/auth/login

Server validates user and returns user object.

Group/Channel Loading

Angular → GET /api/groups

Groups filtered based on user role/membership.

Join Request

Angular → POST /api/groups/:id/join

Group Admin/Super can approve or reject.

Messaging

Angular → POST /api/groups/:id/channels/:channelId/messages

Server saves to data.json, reloads messages via GET.

--Data Storage

Server: Data is stored in data.json.

Every change (user creation, group/channel creation, join, messages) is immediately written to disk with saveData().

On server start, loadData() initializes in-memory structures.

--Client–Server Interaction & UI Updates (Phase 1 workflow)

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
