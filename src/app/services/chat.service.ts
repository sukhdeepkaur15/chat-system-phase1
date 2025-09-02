import { Injectable } from '@angular/core';
import { GroupService } from './group.service';
import { Message } from '../models/group.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  constructor(private groupService: GroupService) {}

  sendMessage(groupId: string, channelId: string, username: string, content: string) {
    const group = this.groupService.getGroup(groupId);
    if (!group) return;
    const channel = group.channels.find(c => c.id === channelId);
    if (!channel) return;
    const msg: Message = { username, content, timestamp: Date.now() };
    channel.messages.push(msg);
    localStorage.setItem('groups', JSON.stringify(this.groupService.getGroups()));
  }

  getMessages(groupId: string, channelId: string): Message[] {
    const group = this.groupService.getGroup(groupId);
    if (!group) return [];
    const channel = group.channels.find(c => c.id === channelId);
    return channel?.messages || [];
  }
}
