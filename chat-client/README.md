**Chat System – Phase 1 (3813ICT Assignment 1)**
**Table of Contents**
-- Overview
-- Repository Layout
-- Git Usage
-- Data Structures
-- Angular Architecture
-- Node.js Server Architecture
-- REST API Reference
-- Client–Server Interaction
-- Local Storage
-- screenshots
-- How to Run

**Overview**
This project implements Phase 1 of a MEAN-stack chat system with authentication and role-based UI.

**Roles:**
Super Admin → manage all users, promote admins, remove users
Group Admin → manage groups, channels, ban/unban users
User → join groups/channels, send messages

Phase 1 uses JSON + localStorage instead of MongoDB. Phase 2 will add sockets and MongoDB.

**in short ## Repository Layout**
  chat-client/` → Angular frontend
  chat-server/` → Express backend with data.json persistence
  docs/` → README.md + Word copy

**Repository layout***
chat-system-phase1/
├─ chat-client/      # Angular frontend
│  ├─ src/app/
│  │  ├─ services/ (api.service.ts, auth.service.ts)
│  │  ├─ models/   (user.ts, group.ts, channel.ts)
│  │  ├─ pages/    (login, dashboard, channel, admin)
│  │  └─ shared/   (header component)
├─ chat-server/      # Node.js + Express backend
│  ├─ index.js
│  ├─ data.json
│  └─ package.json
└─ docs/
   ├─ README.md
   └─ README.docx

## Git Usage
- Branching:
  - main branch contains stable working code
  - feature branches are used for new features (e.g. feature/ban-user, feature/ui-cleanup)
- Commits:
  - Made frequently during development (not all on one day)
  - Commit messages are descriptive and follow a pattern:
    - feat(auth): add localStorage persistence
    - fix(groups): prevent duplicate group names
    - docs(readme): add REST API table
- Collaboration:
  - Each feature was developed and tested on its own branch
  - Merged into `main` only after testing

**Data Structures**
**User**
{
  id: string,
  username: string,
  email: string,
  roles: string[],     // ["USER"], ["GROUP_ADMIN"], ["SUPER_ADMIN"]
  groups: string[]     // group IDs
}

**Group**
{
  id: string,
  name: string,
  creatorId: string,
  users: string[],
  channels: Channel[]
}

**Channel**
{
  id: string,
  name: string,
  members: string[],
  messages: Message[],
  bannedUserIds: string[],
  bannedUsernames: string[]
}
Banned users are stored in bannedUsernames[] (and bannedUserIds[] if available). When posting messages, backend checks this list and rejects with HTTP 403

**Message**
{
  username: string,
  content: string,
  timestamp: number
}

**Angular Architecture
Components**
login.component` → input: username/password; output: login event → calls `AuthService`.
dashboard.component` → input: logged-in user; output: navigation to channels.
channel.component` → input: groupId, channelId; output: chat messages (via ChatService), admin ban/unban.
admin.component` → input: none (Super/Group admin only); output: create/delete users, groups, channels.
header.component` → input: current user; output: logout.


**Services**
auth.service.ts` → manages localStorage, login/logout, role checks.
api.service.ts` → handles REST calls.
chat.service.ts` → (Phase 2) manages socket.io/PeerJS connections.

**Models**
user.ts, group.ts, channel.ts

**Node.js Server Architecture**
-- index.js
-- Uses express, cors, uuid
-- Reads/writes data.json on every change
-- Routes grouped by: health, users, groups, channels, messages, bans

**Functions**
load() → load DB from JSON
save(db) → write DB to JSON

**REST API Reference**
| Method | Route                                        | Params/Body                            | Returns       | Role  |
| ------ | -------------------------------------------- | -------------------------------------- | ------------- | ----- |
| GET    | `/health`                                    | –                                      | `{ok:true}`   | All   |
| GET    | `/groups`                                    | –                                      | all groups    | All   |
| POST   | `/groups`                                    | `{name, creatorId}`                    | new group     | Admin |
| DELETE | `/groups/:id`                                | –                                      | `{ok:true}`   | Admin |
| POST   | `/groups/:id/channels`                       | `{name}`                               | new channel   | Admin |
| DELETE | `/groups/:gid/channels/:cid`                 | –                                      | `{ok:true}`   | Admin |
| POST   | `/groups/:gid/join`                          | `{userId}`                             | `{ok:true}`   | User  |
| PUT    | `/groups/:gid/approve/:uid`                  | –                                      | updated group | Admin |
| PUT    | `/groups/:gid/reject/:uid`                   | –                                      | updated group | Admin |
| GET    | `/messages?groupId&channelId`                | query params                           | messages\[]   | All   |
| POST   | `/messages`                                  | `{groupId,channelId,username,content}` | message       | All   |
| POST   | `/groups/:gid/channels/:cid/ban`             | `{userId?, username?}`                 | channel       | Admin |
| DELETE | `/groups/:gid/channels/:cid/ban/username/:u` | –                                      | channel       | Admin |
| DELETE | `/groups/:gid/channels/:cid/ban/user/:id`    | –                                      | channel       | Admin |
| GET    | `/groups/:gid/channels/:cid/banned`          | –                                      | banned lists  | Admin |


**Client–Server Interaction**
Login → auth.service.ts → localStorage → role-based UI.
Groups & channels load from REST API (api.service.ts).
When admin bans a user → Angular ChannelComponent calls banUserFromChannel() → server updates bannedUsernames → future POST /messages rejects with 403.
JSON always saved to data.json.

**Local Storage**
Key: currentUser → {username, role, groups[]}
On login: saved to localStorage.
On logout: cleared.
Guards: UI only shows buttons allowed by role.

**Screenshots**

📸 Add screenshots for:

Login page
Dashboard (groups/channels)
Channel view (chat + ban/unban panel)
Admin panel (Super Admin creating users/groups)
data.json file after changes
Network tab showing 403 when banned user tries to send a message

**How to Run**
Backend
cd chat-system-phase1/chat-server
npm install
npm start
# API at http://localhost:4000

Frontend
cd chat-system-phase1/chat-client/chat-client
npm install
npx ng serve -o
# UI at http://localhost:4200




