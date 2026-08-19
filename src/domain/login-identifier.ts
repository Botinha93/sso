import type { User } from "./models.js";

export const normalizeLoginIdentifier = (identifier: string) => identifier.trim();

export const loginIdentifierLooksLikeEmail = (identifier: string) => identifier.includes("@");

export const uniqueUsers = (users: Array<User | undefined | null>): User[] => {
  const byId = new Map<string, User>();
  for (const user of users) {
    if (user) {
      byId.set(user.id, user);
    }
  }
  return [...byId.values()];
};

export const pickUserForLoginIdentifier = (identifier: string, users: User[]): User | undefined => {
  if (users.length === 0) {
    return undefined;
  }
  if (users.length === 1) {
    return users[0];
  }

  const needle = normalizeLoginIdentifier(identifier).toLowerCase();
  if (loginIdentifierLooksLikeEmail(identifier)) {
    return users.find((user) => user.email.toLowerCase() === needle) ?? users[0];
  }
  return users.find((user) => user.username.toLowerCase() === needle) ?? users[0];
};
