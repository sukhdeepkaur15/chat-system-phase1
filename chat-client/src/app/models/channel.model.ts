export interface Channel {
  id: string;
  groupId?: string;            // keep if you use it elsewhere
  name: string;
  members?: string[];
  messages?: any[];

  bannedUsers?: string[];
  bannedUsernames?: string[];
  bannedUserIds?: string[];
}
