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
}

export interface Group {
  id: string;
  name: string;
  channels: Channel[];
  users: string[];
  joinRequests: string[];
  creatorId: string; 
}