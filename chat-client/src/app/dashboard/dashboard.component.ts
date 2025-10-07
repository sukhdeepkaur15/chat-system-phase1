/// src/app/dashboard/dashboard.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { GroupService } from '../services/group.service';
import { ChatService } from '../services/chat.service';
import { ApiService } from '../services/api.service';

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
  messages: ChatMsg[] = [];
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
    private api: ApiService,
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
      next: (msgs) => {
        this.messages = (msgs || []) as ChatMsg[];
      },
      error: () => { this.messages = []; }
    });
  }

  /** ---------- Messaging ---------- */
/** ---------- Messaging ---------- */
sendMessage() {
  if (!this.selectedGroup || !this.selectedChannel) return;

  const text = (this.newMessage || '').trim();
  if (!text) return;

  // Access checks (unchanged)
  const isChanBanned = (this.selectedChannel.bannedUsers || []).includes(this.currentUserId);
  const isMember     = (this.selectedChannel.members || []).includes(this.currentUserId);
  if (!this.isSuper && (isChanBanned || !isMember)) {
    alert('You are not allowed to post in this channel.');
    return;
  }

  const gid   = this.selectedGroup.id;
  const cid   = this.selectedChannel.id;
  const uname = this.username;
  const uid   = this.currentUser.id;

  // 🔹 Optimistic message
  const optimisticId = 'opt_' + Math.random().toString(36).slice(2, 10);
  const optimisticMsg: any = {
    username: uname,
    content: text,
    timestamp: Date.now(),
    __optimistic: true,
    __optimisticId: optimisticId
  };
  this.messages = [...(this.messages || []), optimisticMsg];

  // Clear input for snappy UX
  this.newMessage = '';

  this.chatService
    .sendMessage(gid, cid, uname, uid, text)
    .subscribe({
      next: (res: any) => {
        if (res?.ok && res.message) {
          // Replace optimistic with server message
          this.messages = (this.messages || []).map(m =>
            (m as any).__optimisticId === optimisticId ? res.message : m
          );
        }
        // Reconcile with server truth
        this.loadMessages(gid, cid);
      },
      error: (err: any) => {
        // Rollback optimistic on failure
        this.messages = (this.messages || []).filter(
          m => (m as any).__optimisticId !== optimisticId
        );
        if (err?.status === 403) {
          alert(err?.error?.error || 'You are banned from this channel.');
        } else {
          alert('Failed to send message. Please try again.');
        }
      }
    });
}

  /** ---------- Avatar upload ---------- */
  uploadAvatar(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    this.api.uploadAvatar(this.currentUserId, file).subscribe({
      next: () => {
        alert('Avatar uploaded successfully.');
      },
      error: () => alert('Failed to upload avatar.')
    });
  }

/** ---------- Upload & send image ---------- */
sendImage(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input?.files?.[0];
  if (!file || !this.selectedGroup || !this.selectedChannel) return;

  const gid = this.selectedGroup.id;
  const cid = this.selectedChannel.id;

  this.chatService
    .sendImageMessage(gid, cid, this.username, this.currentUser.id, file)
    .subscribe({
      next: (res: any) => {
        // Optimistic append if server returns a URL (helps UI & Cypress)
        if (res?.ok && res.imageUrl) {
          const imgMsg: ChatMsg = {
            username: this.username,
            content: '',              // ✅ satisfy Message.content (required)
            imageUrl: res.imageUrl,
            timestamp: Date.now(),
            type: 'image'
          };
          this.messages = [...(this.messages || []), imgMsg];
        }
        // Reconcile with server truth (covers refresh/other writers)
        this.loadMessages(gid, cid);
      },
      error: (err: any) => console.error(err)
    });
}

  /** ---------- Start video chat ---------- */
  startVideoChat() {
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

  /** ---------- Utility ---------- */
  getUserById(id: string): User | undefined {
    return this.authService.getAllUsers().find(u => u.id === id);
  }

  /** ---------- Restored helpers used by template ---------- */
  public groupMemberIds(group: any): string[] {
    const users   = Array.isArray(group?.users) ? group.users : [];
    const members = Array.isArray(group?.members) ? group.members : [];
    // unique by id
    return [...users, ...members].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i);
  }

  public channelMemberIds(ch: any): string[] {
    if (!ch) return [];
    const members: string[] = Array.isArray(ch?.members) ? ch.members : [];
    const bannedNames: string[] = Array.isArray((ch as any)?.bannedUsernames)
      ? (ch as any).bannedUsernames
      : [];
    // keep members whose username is not banned-by-name
    return members.filter(id => {
      const uname = this.getUserById(id)?.username || '';
      return !bannedNames.includes(uname);
    });
  }
}
