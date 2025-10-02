// src/app/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { GroupService } from '../services/group.service';
import { ChatService } from '../services/chat.service';
import { ApiService } from '../services/api.service';   // ✅ added

import { User } from '../models/user.model';
import { Group, Channel, Message } from '../models/group.model';

type ChatMsg = Message & {
  avatarUrl?: string;
  imageUrl?: string;
  type?: 'text' | 'image';
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  username = '';
  role: string[] = [];
  currentUser!: User;

  groups: Group[] = [];
  selectedGroup: Group | null = null;
  selectedChannel: Channel | null = null;
  messages: Message[] = [];
  newMessage = '';

  // Super admin user management
  allUsers: User[] = [];
  newUsername = '';
  newEmail = '';
  newRole: 'user' | 'groupAdmin' | 'super' = 'user';

  reports: any[] = [];

  constructor(
    private authService: AuthService,
    private groupService: GroupService,
    private chatService: ChatService,
    private api: ApiService,                // ✅ added
    private router: Router
  ) {}

  // Role helpers
  get isSuper(): boolean {
    const r = this.role || [];
    return r.includes('super') || r.includes('superAdmin');
  }
  get isGroupAdmin(): boolean {
    const r = this.role || [];
    return r.includes('groupAdmin');
  }

  isMember(group: any): boolean {
    return Array.isArray(group?.users) ? group.users.includes(this.currentUserId) : false;
  }
  hasRequested(group: any): boolean {
    return Array.isArray(group?.joinRequests) ? group.joinRequests.includes(this.currentUserId) : false;
  }
  canModerate(group: any): boolean {
    if (!group) return false;
    if (this.isSuper) return true;
    return this.isGroupAdmin && group.creatorId === this.currentUserId;
  }

  get isBannedHere(): boolean {
    if (!this.selectedGroup || !this.selectedChannel) return false;
    const byIdChan   = (this.selectedChannel.bannedUsers || []).includes(this.currentUserId);
    const byNameChan = (this.selectedChannel as any).bannedUsernames?.includes(this.username) || false;
    return byIdChan || byNameChan;
  }

  get currentUserId(): string { return this.currentUser?.id ?? ''; }
  get roleDisplay(): string { return (this.role || []).join(', '); }
  get greetingTitle(): string {
    if (this.isSuper) return 'Super Admin';
    if (this.isGroupAdmin) return 'Group Admin';
    return 'User';
  }

  trackById(_: number, item: { id: string }) { return item.id; }

  get visibleChannels(): Channel[] {
    if (!this.selectedGroup) return [];
    const g = this.selectedGroup;
    if (this.isSuper) return g.channels || [];
    return (g.channels || []).filter(ch =>
      !(ch.bannedUsers || []).includes(this.currentUserId) &&
      (ch.members || []).includes(this.currentUserId)
    );
  }

  ngOnInit() {
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.currentUser = user;
    this.username = user.username;
    this.role = user.roles || [];

    this.refreshGroups();
    if (this.isSuper) {
      this.allUsers = this.authService.getAllUsers();
      this.loadReports();
    }
  }

  private loadGroups(): void {
    this.groupService.getGroups().subscribe({
      next: (allGroups) => {
        this.groups = allGroups || [];
        if (this.selectedGroup) {
          this.selectedGroup = this.groups.find(g => g.id === this.selectedGroup!.id) ?? null;
        }
        if (this.selectedGroup && this.selectedChannel) {
          this.selectedChannel =
            (this.selectedGroup.channels || []).find(c => c.id === this.selectedChannel!.id) ?? null;
          if (this.selectedGroup && this.selectedChannel) {
            this.loadMessages(this.selectedGroup.id, this.selectedChannel.id);
          } else {
            this.messages = [];
          }
        }
      },
      error: () => {
        this.groups = [];
        this.selectedGroup = null;
        this.selectedChannel = null;
        this.messages = [];
      }
    });
  }
  private refreshGroups(): void { this.loadGroups(); }

  /** ---------- Reports (Super Admin) ---------- */
  loadReports() {
    if (!this.isSuper) return;
    this.groupService.getReports().subscribe({
      next: r => this.reports = r || [],
      error: () => this.reports = []
    });
  }
  resolveReport(r: any) {
    if (!this.isSuper) return;
    this.groupService.resolveReport(r.id).subscribe({
      next: () => this.loadReports()
    });
  }

  /** ---------- Auth ---------- */
  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /** ---------- Selection ---------- */
  selectGroup(group: Group) {
    this.selectedGroup = this.groups.find(g => g.id === group.id) ?? group;
    this.selectedChannel = null;
    this.messages = [];
  }
  selectChannel(channel: Channel) {
    if (!this.selectedGroup) return;
    const isChanBanned = (channel.bannedUsers || []).includes(this.currentUserId);
    const isMember = (channel.members || []).includes(this.currentUserId);
    if (!this.isSuper && (isChanBanned || !isMember)) {
      alert('You are not allowed to access this channel.');
      return;
    }
    this.selectedChannel = channel;
    this.loadMessages(this.selectedGroup.id, channel.id);
  }
  private loadMessages(groupId: string, channelId: string) {
    this.chatService.getMessages(groupId, channelId).subscribe({
      next: (msgs) => this.messages = msgs || [],
      error: () => { this.messages = []; }
    });
  }

  /** ---------- Messaging ---------- */
  sendMessage() {
    if (!this.selectedGroup || !this.selectedChannel || !this.newMessage.trim()) return;
    const isChanBanned = (this.selectedChannel.bannedUsers || []).includes(this.currentUserId);
    const isMember = (this.selectedChannel.members || []).includes(this.currentUserId);
    if (!this.isSuper && (isChanBanned || !isMember)) {
      alert('You are not allowed to post in this channel.');
      return;
    }
    this.chatService
      .sendMessage(
        this.selectedGroup.id, 
        this.selectedChannel.id, 
        this.username,
        this.currentUser.id, 
        this.newMessage.trim()
      )
      .subscribe({
        next: () => {
          this.newMessage = '';
          this.loadMessages(this.selectedGroup!.id, this.selectedChannel!.id);
        },
        error: (err: any) => {
          if (err?.status === 403) {
            alert(err?.error?.error || 'You are banned from this channel.');
          } else {
            alert('Failed to send message. Please try again.');
          }
        }
      });
  }

  /** ---------- Avatar upload (fixes template error) ---------- */
  uploadAvatar(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.api.uploadAvatar(this.currentUserId, file).subscribe({
      next: (res: any) => {
        // If your auth service stores avatar locally, update it here
        // (res could contain { ok, url } depending on your server)
        alert('Avatar uploaded successfully.');
      },
      error: () => alert('Failed to upload avatar.')
    });
  }

  /** ---------- NEW: Upload & send image ---------- */
  sendImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (!file || !this.selectedGroup || !this.selectedChannel) return;

  this.chatService
    .sendImageMessage(
      this.selectedGroup.id,
      this.selectedChannel.id,
      this.username,
      this.currentUser.id,
      file
    )
    .subscribe({
      next: () => console.log('image uploaded'),
      error: (err: any) => console.error(err)
    });
}

/** ---------- Start video chat ---------- */
  startVideoChat() {
    // Navigate to your VideoChat component route or open a panel
    this.router.navigate(['/video']);
  }

  /** ---------- Users (Super local) ---------- */
  createUser() {
    if (!this.newUsername || !this.newEmail) return;
    const user = this.authService.createUser(this.newUsername, this.newEmail, this.newRole);
    if (user) this.allUsers.push(user);
    this.newUsername = '';
    this.newEmail = '';
  }
  promoteUser(user: User, role: 'groupAdmin' | 'super') {
    this.authService.promoteUser(user.id, role);
  }
  deleteUser(user: User) {
    this.authService.deleteUser(user.id);
    this.allUsers = this.allUsers.filter(u => u.id !== user.id);
  }

  /** ---------- Groups & Channels ---------- */
  createGroup(groupName: string) {
    if (!groupName.trim()) return;
    this.groupService.createGroup(groupName.trim(), this.currentUser.id).subscribe({
      next: () => this.refreshGroups()
    });
  }

  addChannelToGroup(group: Group, channelName: string) {
    if (!channelName.trim()) return;
    if (!this.canModerate(group)) { alert('Not allowed to add channels to this group.'); return; }

    this.groupService.createChannel(group.id, channelName.trim()).subscribe({
      next: () => {
        const keepId = group.id;
        this.refreshGroups();
        setTimeout(() => {
          const g = this.groups.find(x => x.id === keepId);
          if (g) this.selectGroup(g);
        });
      }
    });
  }

  requestToJoin(group: Group) {
    this.groupService.requestToJoin(group.id, this.currentUser.id).subscribe({
      next: () => this.refreshGroups()
    });
  }
  approveJoinRequest(group: Group, userId: string) {
    this.groupService.approveJoinRequest(group.id, userId).subscribe({
      next: () => this.refreshGroups()
    });
  }
  rejectJoinRequest(group: Group, userId: string) {
    this.groupService.rejectJoinRequest(group.id, userId).subscribe({
      next: () => this.refreshGroups()
    });
  }

  leaveGroup(group: Group) {
    this.groupService.leaveGroup(group.id, this.currentUser.id).subscribe({
      next: (res) => {
        if (res?.ok) {
          if (this.selectedGroup?.id === group.id) {
            this.selectedGroup = null;
            this.selectedChannel = null;
            this.messages = [];
          }
          this.refreshGroups();
        } else {
          alert('Unable to leave the group.');
        }
      }
    });
  }

  deleteGroup(group: Group) {
    if (!this.canModerate(group)) { alert('Not allowed to delete this group.'); return; }

    this.groupService.deleteGroup(group.id).subscribe({
      next: (res) => {
        if (res?.ok) {
          if (this.selectedGroup?.id === group.id) {
            this.selectedGroup = null;
            this.selectedChannel = null;
            this.messages = [];
          }
          this.groups = this.groups.filter(g => g.id !== group.id);
        } else {
          alert('Unable to delete this group.');
        }
      }
    });
  }

  removeChannel(group: Group, channelId: string) {
    if (!this.canModerate(group)) { alert('Not allowed to remove channels in this group.'); return; }

    this.groupService.removeChannel(group.id, channelId).subscribe({
      next: (res) => {
        if (res?.ok) {
          const g = this.groups.find(x => x.id === group.id);
          if (g) {
            g.channels = (g.channels || []).filter(c => c.id !== channelId);
            if (this.selectedChannel?.id === channelId) {
              this.selectedChannel = null;
              this.messages = [];
            }
            if (this.selectedGroup?.id === g.id) this.selectGroup(g);
          } else {
            this.refreshGroups();
          }
        } else {
          alert('Unable to remove channel.');
        }
      }
    });
  }

  /** Ban/unban by username (Ban Management) */
  banUser(group: Group | null, channel: Channel | null, username: string) {
    if (!group || !channel) { alert('Pick a channel first (click a channel name), then ban.'); return; }
    if (!this.canModerate(group)) { alert('Not allowed to ban in this channel.'); return; }
    const name = (username || '').trim();
    if (!name) { alert('Enter a username'); return; }

    this.groupService
      .banUserInChannel(group.id, channel.id, undefined, name)
      .subscribe({
        next: () => {
          if (!this.isSuper && this.isGroupAdmin) {
            this.groupService.reportToSuper({
              groupId: group.id,
              channelId: channel.id,
              username: name,
              actorUserId: this.currentUserId,
              actorUsername: this.username,
              reason: 'Channel ban by username (GA)'
            }).subscribe(() => {
              if (this.isSuper) this.loadReports();
            });
          }
          this.refreshGroups();
        }
      });
  }

  unbanUser(group: Group | null, channel: Channel | null, username: string) {
    if (!group || !channel) { alert('Pick a channel first (click a channel name), then unban.'); return; }
    if (!this.canModerate(group)) { alert('Not allowed to unban in this channel.'); return; }
    const name = (username || '').trim();
    if (!name) { alert('Enter a username'); return; }
    this.groupService
      .unbanUserInChannel(group.id, channel.id, undefined, name)
      .subscribe({ next: () => this.refreshGroups() });
  }

  /** Utility */
  getUserById(id: string): User | undefined {
    return this.authService.getAllUsers().find(u => u.id === id);
  }
}

