export interface SDKPortalApp {
  id: string;
  name: string;
  description: string;
  icon?: string;
  imageUrl?: string;
  url?: string;
}

export interface SDKPortalRolePermissions {
  id: string;
  name: string;
  scope: "platform" | "tenant";
  appId?: string;
  permissions: string[];
}

export interface SDKPortalAppInheritanceSource {
  appId: string;
  groupId: string;
  groupName: string;
}

export interface SDKPortalMe {
  id: string;
  email: string;
  username: string;
  givenName: string;
  familyName: string;
  avatarUrl?: string;
  customAttributes: Record<string, string>;
  appId?: string;
  appIds?: string[];
  directAppIds?: string[];
  inheritedAppIds?: string[];
  inheritedAppSources?: SDKPortalAppInheritanceSource[];
  roles: string[];
  groups: string[];
  permissions: string[];
  rolePermissions: SDKPortalRolePermissions[];
  apps: SDKPortalApp[];
}

export interface UpdatePortalProfileInput {
  givenName?: string;
  familyName?: string;
  avatarUrl?: string;
  email?: string;
  username?: string;
  customAttributes?: Record<string, string>;
}

export interface ChangePortalPasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UploadPortalAvatarResult {
  avatarUrl: string;
}

export interface PortalAPI {
  /** Gets the current logged-in portal user's profile, apps, roles, and permissions. */
  getMe(): Promise<SDKPortalMe>;
  /** Updates the current logged-in portal user's profile. */
  updateProfile(input: UpdatePortalProfileInput): Promise<void>;
  /** Changes the current logged-in portal user's password. */
  changePassword(input: ChangePortalPasswordInput): Promise<void>;
  /** Deletes the current logged-in portal user's account. */
  deleteAccount(): Promise<void>;
  /** Uploads a new avatar image for the current logged-in portal user. */
  uploadAvatar(file: Blob | File): Promise<UploadPortalAvatarResult>;
}
