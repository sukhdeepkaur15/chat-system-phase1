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
  username: string = '';
  role: string[] = [];
  currentUser!: User; 
  groups: Group[] = [];
  selectedGroup: Group | null = null;
  selectedChannel: Channel | null = null;
  messages: Message[] = [];
  newMessage: string = '';

  // Role helpers
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
// Show only channels the current user is a member of
get visibleChannels(): Channel[] {
  if (!this.selectedGroup) return [];
  const chans = this.selectedGroup.channels || [];
  if (this.isSuper) return chans;
  return chans.filter(ch => (ch.members || []).includes(this.currentUserId));
}

// Membership helpers
isMember(group: Group): boolean {
  return !!group.users?.includes(this.currentUserId);
}
hasRequested(group: Group): boolean {
  return !!group.joinRequests?.includes(this.currentUserId);
}


  // Super admin user management
  allUsers: User[] = [];
  newUsername: string = '';
  newEmail: string = '';
  newRole: string = 'user';

  constructor(
    private authService: AuthService,
    private groupService: GroupService,
    private chatService: ChatService,
    private router: Router
  ) {}

  ngOnInit() {
    // ✅ make sure currentUser is loaded
    const user = this.authService.getUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUser = user;
    this.username = this.currentUser.username;
    this.role = this.currentUser.roles || [];

    // ✅ load groups from localStorage before filtering
    this.groupService.loadGroups();
    this.loadGroups();

    // Load all users if Super
    if (this.authService.isSuper()) {
      this.allUsers = this.authService.getAllUsers();
    }
  }

  // ✅ filter groups depending on role
  private loadGroups() {
    const allGroups = this.groupService.getGroups();

    if (this.authService.isSuper()) {
      this.groups = allGroups; // super sees all
    } else if (this.authService.isGroupAdmin()) {
      this.groups = allGroups;
    } else {
      // normal users see all groups but must request to join
      this.groups = allGroups;
    }
  }

  private refreshGroups() {
    this.groupService.saveGroups();
    this.loadGroups();
  }

  logout() {
    this.authService.logout();
  }

  // Select group
  selectGroup(group: Group) {
    this.selectedGroup = group;
    this.selectedChannel = null;
    this.messages = [];
  }

  // Select channel and load messages
  selectChannel(channel: Channel) {
  if (!this.selectedGroup) return;

  // Super bypass
  if (!this.isSuper && !(channel.members || []).includes(this.currentUserId)) {
    alert('You are not a member of this channel.');
    return;
  }

  this.selectedChannel = channel;
  this.messages = this.chatService.getMessages(this.selectedGroup.id, channel.id);
}

  // Send message
  sendMessage() {
  if (!this.selectedGroup || !this.selectedChannel || !this.newMessage) return;

  // Super bypass
  if (!this.isSuper && !(this.selectedChannel.members || []).includes(this.currentUserId)) {
    alert('You are not a member of this channel.');
    return;
  }
    const msg: Message = {
      username: this.username,
      content: this.newMessage,
      timestamp: Date.now()
    };

    this.chatService.sendMessage(
      this.selectedGroup.id,
      this.selectedChannel.id,
      msg.username,
      msg.content
    );

    this.messages = this.chatService.getMessages(this.selectedGroup.id, this.selectedChannel.id);
    this.newMessage = '';
  }

  // Super Admin: create new users
  createUser() {
    if (!this.newUsername || !this.newEmail) return;

    const user = this.authService.createUser(
      this.newUsername,
      this.newEmail,
      this.newRole as 'user' | 'groupAdmin' | 'super'
    );

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

  // Group Admin: create new groups
  createGroup(groupName: string) {
    if (!groupName) return;

    const group = this.groupService.createGroup(groupName, this.currentUser.id);
    group.users.push(this.currentUser.id); 
    this.groupService.saveGroups(); // ✅ persist
    this.refreshGroups();
  }

  // Group Admin: create channel in group
  addChannelToGroup(group: Group, channelName: string) {
    if (!channelName) return;
    // Only Super or the group creator can add channels
  if (!(this.isSuper || (this.isGroupAdmin && group.creatorId === this.currentUserId))) {
    alert('You are not allowed to add channels to this group.');
    return;
  }
    this.groupService.createChannel(group.id, channelName);
    this.groupService.saveGroups(); // ✅ persist
    this.selectGroup(group);
  }

  // User: request to join a group
  requestToJoin(group: Group) {
    if (!group.joinRequests.includes(this.currentUser.id)) {
      group.joinRequests.push(this.currentUser.id);
      this.groupService.saveGroups(); // ✅ persist
    }

    this.groupService.requestToJoin(group.id, this.currentUser.id);
    alert(`Join request sent to ${group.name}`);
  }

  approveJoinRequest(group: Group, userId: string) {
    this.groupService.approveJoinRequest(group.id, userId);
    group.users.push(userId);
    group.joinRequests = group.joinRequests.filter(id => id !== userId);
    this.groupService.saveGroups(); 
    this.refreshGroups();
  }

  rejectJoinRequest(group: Group, userId: string) {
    this.groupService.rejectJoinRequest(group.id, userId);
    group.joinRequests = group.joinRequests.filter(id => id !== userId);
    this.groupService.saveGroups(); 
    this.refreshGroups();
  }

  getUserById(id: string): User | undefined {
    return this.authService.getAllUsers().find(u => u.id === id);
  }

  // User action: leave a group
leaveGroup(group: Group) {
  if (!this.currentUser) return;
  const ok = this.groupService.leaveGroup(group.id, this.currentUser.id);
  if (ok) {
    // if you were viewing it, deselect
    if (this.selectedGroup?.id === group.id) {
      this.selectedGroup = null;
      this.selectedChannel = null;
      this.messages = [];
    }
    this.loadGroups(); // refresh list per role
  } else {
    alert('Unable to leave the group.');
  }
}

// Admin action: delete group (Super OR creator only)
deleteGroup(group: Group) {
  const requesterId = this.currentUserId;
  const canDelete = this.isSuper || (this.isGroupAdmin && group.creatorId === requesterId);
  if (!canDelete) {
    alert('You are not allowed to delete this group.');
    return;
  }
  // If Super: bypass service check by temporarily spoofing requester as creator
  const ok = this.isSuper
    ? (() => {
        // Super override: directly remove without creator check
        const idx = this.groupService.groups.findIndex(g => g.id === group.id);
        if (idx === -1) return false;
        this.groupService.groups.splice(idx, 1);
        this.groupService.saveGroups();
        return true;
      })()
    : this.groupService.deleteGroup(group.id, requesterId);

  if (ok) {
    if (this.selectedGroup?.id === group.id) {
      this.selectedGroup = null;
      this.selectedChannel = null;
      this.messages = [];
    }
    this.loadGroups();
  } else {
    alert('Unable to delete this group.');
  }
}

// Admin action: remove a channel (Super OR creator only)
removeChannel(group: Group, channelId: string) {
  const requesterId = this.currentUserId;
  const canRemove = this.isSuper || (this.isGroupAdmin && group.creatorId === requesterId);
  if (!canRemove) {
    alert('You are not allowed to remove channels in this group.');
    return;
  }
  const ok = this.isSuper
    ? (() => {
        // Super override: directly remove channel
        const g = this.groupService.getGroup(group.id);
        if (!g) return false;
        g.channels = (g.channels || []).filter(c => c.id !== channelId);
        this.groupService.saveGroups();
        return true;
      })()
    : this.groupService.removeChannel(group.id, channelId, requesterId);

  if (ok && this.selectedChannel?.id === channelId) {
    this.selectedChannel = null;
    this.messages = [];
  }
  this.selectGroup(group); // refresh visible channels
}

}
