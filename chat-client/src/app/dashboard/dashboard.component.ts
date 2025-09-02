import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { GroupService } from '../services/group.service';
import { ChatService } from '../services/chat.service';

import { User } from '../models/user.model';
import { Group, Channel, Message } from '../models/group.model';

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

  // Super admin user management (Phase 1 local)
  allUsers: User[] = [];
  newUsername = '';
  newEmail = '';
  newRole: 'user' | 'groupAdmin' | 'super' = 'user';

  /** ---------- Role helpers ---------- */
  get isSuper(): boolean {
    return this.authService.isSuper();
  }
  get isGroupAdmin(): boolean {
    return this.authService.isGroupAdmin();
  }
  get currentUserId(): string {
    return this.currentUser?.id ?? '';
  }
  get roleDisplay(): string {
    return (this.role || []).join(', ');
  }
  get greetingTitle(): string {
  if (this.isSuper) return 'Super Admin';
  if (this.isGroupAdmin) return 'Group Admin';
  return 'User';
}

  trackById(_: number, item: { id: string }) { return item.id; }

  /** Channels user can see in the selected group */
  get visibleChannels(): Channel[] {
    if (!this.selectedGroup) return [];
    const chans = this.selectedGroup.channels || [];
    if (this.isSuper) return chans; // super sees all channels
    return chans.filter(ch => (ch.members || []).includes(this.currentUserId));
  }

  /** ---------- Membership helpers ---------- */
  isMember(group: Group): boolean {
    return !!group.users?.includes(this.currentUserId);
  }
  hasRequested(group: Group): boolean {
    return !!group.joinRequests?.includes(this.currentUserId);
  }

  constructor(
    private authService: AuthService,
    private groupService: GroupService,
    private chatService: ChatService,
    private router: Router
  ) {}

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
    }
  }

  /** Fetch groups from server then filter by role (no local pushes) */
  private loadGroups(): void {
    this.groupService.getGroups().subscribe({
      next: (allGroups) => {
        if (this.isSuper) {
          this.groups = allGroups;             // Super sees everything
        } else if (this.isGroupAdmin) {
          // GA sees groups they created OR belong to (and can request to join others)
          this.groups = allGroups;
        } else {
          // Users see all groups (request/approve flow controls access)
          this.groups = allGroups;
        }

        // Rebind selections to fresh instances
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
      error: (err) => {
        console.error('Failed to load groups', err);
        this.groups = [];
        this.selectedGroup = null;
        this.selectedChannel = null;
        this.messages = [];
      }
    });
  }

  /** Simple helper that just re-fetches from server. */
  private refreshGroups(): void {
    this.loadGroups();
  }

  logout() {
    this.authService.logout();
  }

  /** ---------- Group & Channel selection ---------- */
  selectGroup(group: Group) {
    // always use the instance from the current groups array
    this.selectedGroup = this.groups.find(g => g.id === group.id) ?? group;
    this.selectedChannel = null;
    this.messages = [];
  }

  selectChannel(channel: Channel) {
    if (!this.selectedGroup) return;

    // membership guard (Super bypasses)
    if (!this.isSuper && !(channel.members || []).includes(this.currentUserId)) {
      alert('You are not a member of this channel.');
      return;
    }

    this.selectedChannel = channel;
    this.loadMessages(this.selectedGroup.id, channel.id);
  }

  private loadMessages(groupId: string, channelId: string) {
    // If ChatService uses HttpClient (Observable)
    this.chatService.getMessages(groupId, channelId).subscribe({
      next: (msgs) => this.messages = msgs || [],
      error: (err) => {
        console.error('Load messages failed', err);
        this.messages = [];
      }
    });
  }

  /** ---------- Messaging ---------- */
  sendMessage() {
    if (!this.selectedGroup || !this.selectedChannel || !this.newMessage.trim()) return;

    // membership guard (Super bypass)
    if (!this.isSuper && !(this.selectedChannel.members || []).includes(this.currentUserId)) {
      alert('You are not a member of this channel.');
      return;
    }

    this.chatService
      .sendMessage(this.selectedGroup.id, this.selectedChannel.id, this.username, this.newMessage.trim())
      .subscribe({
        next: () => {
          this.newMessage = '';
          this.loadMessages(this.selectedGroup!.id, this.selectedChannel!.id);
        },
        error: (err) => console.error('Send message failed', err)
      });
  }

  /** ---------- Super Admin: user management (local Phase 1) ---------- */
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

  /** ---------- Group management (server) ---------- */
  createGroup(groupName: string) {
    if (!groupName.trim()) return;
    this.groupService.createGroup(groupName.trim(), this.currentUser.id).subscribe({
      next: () => this.refreshGroups(),               // don’t push locally — refetch
      error: (err) => console.error('Create group failed', err)
    });
  }

  addChannelToGroup(group: Group, channelName: string) {
    if (!channelName.trim()) return;

    if (!(this.isSuper || (this.isGroupAdmin && group.creatorId === this.currentUserId))) {
      alert('You are not allowed to add channels to this group.');
      return;
    }

    this.groupService.createChannel(group.id, channelName.trim()).subscribe({
      next: () => {
        const keepId = group.id;
        this.refreshGroups();
        // re-select the group after refresh
        setTimeout(() => {
          const g = this.groups.find(x => x.id === keepId);
          if (g) this.selectGroup(g);
        });
      },
      error: (err) => console.error('Create channel failed', err)
    });
  }

  /** ---------- Membership requests (server) ---------- */
  requestToJoin(group: Group) {
    this.groupService.requestToJoin(group.id, this.currentUser.id).subscribe({
      next: () => this.refreshGroups(),
      error: (err) => console.error('Request to join failed', err)
    });
  }

  approveJoinRequest(group: Group, userId: string) {
    this.groupService.approveJoinRequest(group.id, userId).subscribe({
      next: () => this.refreshGroups(),
      error: (err) => console.error('Approve failed', err)
    });
  }

  rejectJoinRequest(group: Group, userId: string) {
    this.groupService.rejectJoinRequest(group.id, userId).subscribe({
      next: () => this.refreshGroups(),
      error: (err) => console.error('Reject failed', err)
    });
  }

  /** ---------- Leave / Delete / Remove channel (server) ---------- */
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
      },
      error: (err) => console.error('Leave group failed', err)
    });
  }

  deleteGroup(group: Group) {
    const canDelete = this.isSuper || (this.isGroupAdmin && group.creatorId === this.currentUserId);
    if (!canDelete) {
      alert('You are not allowed to delete this group.');
      return;
    }

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
      },
      error: (err) => console.error('Delete group failed', err)
    });
  }

  removeChannel(group: Group, channelId: string) {
    const canRemove = this.isSuper || (this.isGroupAdmin && group.creatorId === this.currentUserId);
    if (!canRemove) {
      alert('You are not allowed to remove channels in this group.');
      return;
    }

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
      },
      error: (err) => console.error('Remove channel failed', err)
    });
  }

  /** Utility (Super panel) */
  getUserById(id: string): User | undefined {
    return this.authService.getAllUsers().find(u => u.id === id);
  }
}
