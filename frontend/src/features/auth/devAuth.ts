export type DevUser = {
  id: string;
  name: string;
  email: string;
  role: "support" | "admin";
  token: string;
};

const DEV_USER_KEY = "aegis-dev-user";

const DEV_USERS = {
  support: {
    id: "dev-support-user",
    name: "Support User",
    email: "support.user@aegissoftware.com",
    role: "support",
    token: "dev-support-token",
  },
  admin: {
    id: "dev-admin-user",
    name: "Admin User",
    email: "admin.user@aegissoftware.com",
    role: "admin",
    token: "dev-admin-token",
  },
} satisfies Record<
  DevUser["role"],
  DevUser
>;

/**
 * Creates and stores development user for requested role.
*/
export function signInDevUser(
  role: DevUser["role"] = "support",
): DevUser {
  const user = DEV_USERS[role];

  window.localStorage.setItem(
    DEV_USER_KEY,
    JSON.stringify(user),
  );

  return user;
}

/**
 * Returns the currently stored development user.
*/
export function getDevUser():
  DevUser | null {
  const storedUser =
    window.localStorage.getItem(
      DEV_USER_KEY,
    );

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(
      storedUser,
    ) as DevUser;
  } catch {
    window.localStorage.removeItem(
      DEV_USER_KEY,
    );

    return null;
  }
}

/**
 * Removes the current development session.
*/
export function signOutDevUser(): void {
  window.localStorage.removeItem(
    DEV_USER_KEY,
  );
}

/**
 * Returns current development API token.
*/
export function getDevToken():
  string | null {
  return getDevUser()?.token ?? null;
}