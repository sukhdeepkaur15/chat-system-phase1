import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@angular/core';
import { Group, Channel } from '../models/group.model';


@Injectable({ providedIn: 'root' })
export class GroupService {
 public groups: Group[] = [];

  constructor() {
    this.loadGroups(); // ✅ load saved groups when service starts
  }


   
  // -------- Persistence --------
  saveGroups(): void {
    localStorage.setItem('groups', JSON.stringify(this.groups));
  }
  
  loadGroups(): void {
    const data = localStorage.getItem('groups');
    this.groups = data ? JSON.parse(data) : [];
    this.groups.forEach(g => {
      g.users = g.users || [];
      g.channels = g.channels || [];
      g.joinRequests = g.joinRequests || [];
      g.channels.forEach(ch => {
        ch.members = ch.members || [];
        ch.messages = ch.messages || [];
      });
    });
  }

  getGroups(): Group[] {
    return this.groups;
  }

  getGroup(id: string): Group | undefined {
    return this.groups.find(g => g.id === id);
  }

  createGroup(name: string, creatorId: string): Group {
    const group: Group = {
      id: uuidv4(),
      name,
      creatorId,
      users: [creatorId],
      joinRequests: [],
      channels: []
    };
    this.groups.push(group);
    this.saveGroups();
    return group;
  }

createChannel(groupId: string, channelName: string): Channel | null {
    const group = this.getGroup(groupId);
    if (!group) return null;

    const channel: Channel = {
      id: uuidv4(),
      name: channelName,
      members: [...(group.users || [])],
      messages: []
    };

    group.channels.push(channel);
    this.saveGroups();
    return channel;
  }
  
// -------- Join requests (exact names you asked for) --------
  requestToJoin(groupId: string, userId: string): void {
    const g = this.getGroup(groupId);
    if (!g) return;
    if (!g.users.includes(userId) && !g.joinRequests.includes(userId)) {
      g.joinRequests.push(userId);
      this.saveGroups();  // persist
    }
  }

  approveJoinRequest(groupId: string, userId: string): void {
    const g = this.getGroup(groupId);
    if (!g) return;

    g.joinRequests = g.joinRequests.filter(id => id !== userId);
    if (!g.users.includes(userId)) g.users.push(userId);

    (g.channels || []).forEach(ch => {
      ch.members = ch.members || [];
      if (!ch.members.includes(userId)) ch.members.push(userId);
    });

    this.saveGroups(); // persist
  }

  rejectJoinRequest(groupId: string, userId: string): void {
    const g = this.getGroup(groupId);
    if (!g) return;
    g.joinRequests = g.joinRequests.filter(id => id !== userId);
    this.saveGroups(); // persist
  }

  // Leave a group: remove user from group.users, channel.members, and pending requests
leaveGroup(groupId: string, userId: string): boolean {
  const g = this.getGroup(groupId);
  if (!g) return false;

  // Remove from group members
  g.users = (g.users || []).filter(id => id !== userId);

  // Remove from any pending requests
  g.joinRequests = (g.joinRequests || []).filter(id => id !== userId);

  // Remove from all channel memberships
  (g.channels || []).forEach(ch => {
     ch.members = ch.members || [];
      ch.members = ch.members.filter(id => id !== userId);
  });

  this.saveGroups();
  return true;
}

// Delete a group ONLY if requester is the creator (component can allow Super override)
deleteGroup(groupId: string, requesterId: string): boolean {
    const idx = this.groups.findIndex(g => g.id === groupId);
    if (idx === -1) return false;
    if (this.groups[idx].creatorId !== requesterId) return false;
    this.groups.splice(idx, 1);
    this.saveGroups();
    return true;
}

// Remove a channel ONLY if requester is the creator of the group
removeChannel(groupId: string, channelId: string, requesterId: string): boolean {
  const g = this.getGroup(groupId);
  if (!g) return false;
  if (g.creatorId !== requesterId) {
    return false;
  }
  g.channels = (g.channels || []).filter(ch => ch.id !== channelId);
  this.saveGroups();
  return true;
}

}
