Chat System – Phase 1

Name: Sukhdeep Kaur (s5388440)
Software Frameworks (3813ICT_3255)

-- Repository Organization

/chat-client/ → Angular frontend (login, dashboard, chat).

/server/ → Node.js + Express backend (auth, groups, channels).

README.md → Documentation (this file).

.gitignore → Excludes node_modules/ and build artifacts.

Git was used throughout development:

git init to initialize repo.

Frequent commits for features (auth, groups, channels).

Branching for testing features before merging.

Final push to GitHub private repo (shared with tutor).

-- Data Structures
User
{
  id: string;
  username: string;
  email: string;
  roles: string[]; // ['super'], ['groupAdmin'], ['user']
  groups: string[]; // IDs of groups the user belongs to
}

Group
{
  id: string;
  name: string;
  creatorId: string;
  users: string[];
  channels: Channel[];
  joinRequests: string[];
}

Channel
{
  id: string;
  name: string;
  messages: Message[];
}

Message
{
  username: string;
  content: string;
  timestamp: number;
}


Data is stored in browser localStorage (temporary persistence for Phase 1).

--Angular Architecture

Components

LoginComponent → login form, authentication.

DashboardComponent → groups, channels, messaging, admin panels.

Services

AuthService → login/logout, role checks, user management.

GroupService → create groups, channels, join requests.

ChatService → send/get messages in channels.

Models

user.model.ts, group.model.ts.

Routes

/login → LoginComponent.

/dashboard → DashboardComponent.

-- Node Server Architecture

server.js → Express app entry point.

Routes

/api/auth → login.

/api/groups → group CRUD.

/api/channels → channel management.

Sockets

Placeholder for socket.io & Peer.js (Phase 2 real-time).

Data

Stored temporarily in arrays or localStorage fallback.

--Server-Side Routes
Method	Route	Params	Purpose
POST	/api/auth	{ username, password}	Authenticate user
GET	/api/groups	–	Get all groups
POST	/api/groups	{ name }	Create new group
POST	/api/channels	{ groupId, name }	Create channel in group
POST	/api/messages	{ groupId, channelId}	Send message to channel
- Client–Server Interaction

Login:
Angular LoginComponent → AuthService → POST /api/auth.
On success, user info stored in localStorage.

Dashboard load:
Angular loads groups from GroupService (localStorage sync).

Join request:
User requests → added to joinRequests[].
Group Admin / Super can approve/reject → updates users[].

Channel + Chat:
Selecting group → shows channels.
Sending message → ChatService updates localStorage, re-renders messages.

--Client–Server Interaction

Angular calls server REST APIs via api.service.ts.

Server updates in-memory data and responds with JSON.

Client updates component state and view (dashboard or login).

localStorage ensures persistence between sessions (until MongoDB in Phase 2).
--Data Storage

Phase 1: Browser localStorage.

Phase 2: MongoDB (not yet implemented).

--  Git Usage

Repo initialized with git init.

Regular commits for each feature:

auth-service-setup

group-join-requests

chat-service-messages

Pushed to private GitHub repo.

Tutor given access.

-- Features Implemented

Authentication with roles (Super, Group Admin, User).

Super Admin: promote, delete, manage users.

Group Admin: create/manage own groups & channels.

User: request to join, leave group, send messages.

Join request/approval system.

LocalStorage persistence.

