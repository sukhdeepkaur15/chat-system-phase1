export interface Message {
  username: string;
  content: string;
  timestamp: number;
}

export interface Channel {
  id: string;
  name: string;
  members: string[];
  messages: Message[];

  // NEW (match server)
  bannedUsers?: string[];       // legacy client-side bans by userId
  bannedUsernames?: string[];   // server ban-by-username
  bannedUserIds?: string[];     // server ban-by-userId
}

export interface Group {
  id: string;
  name: string;
  channels: Channel[];
  users: string[];
  joinRequests: string[];
  creatorId: string;

  // OPTIONAL (for group-wide ban fan-out UI)
  bannedUsers?: string[];
}
