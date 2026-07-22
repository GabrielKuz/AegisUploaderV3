export type DevUser = {
  id: string;
  name: string;
  email: string;
  role: "support" | "customer" | "admin";
  token: string;
};

const DEV_USER_KEY = "aegis-dev-user";

export function signInDevUser(role: DevUser["role"] = "support"): DevUser {
  const users: Record<DevUser["role"], DevUser> = {
    support: {
      id: "dev-support-user",
      name: "Support User",
      email: "support.user@aegissoftware.com",
      role: "support",
      token: "dev-support-token",
    },
    customer: {
      id: "dev-customer-user",
      name: "Customer User",
      email: "customer.user@example.com",
      role: "customer",
      token: "dev-customer-token",
    },
    admin: {
      id: "dev-admin-user",
      name: "Admin User",
      email: "admin.user@aegissoftware.com",
      role: "admin",
      token: "dev-admin-token",
    },
  };

  const user = users[role];

  window.localStorage.setItem(DEV_USER_KEY, JSON.stringify(user));

  return user;
}

export function getDevUser(): DevUser | null {
  const storedUser = window.localStorage.getItem(DEV_USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as DevUser;
  } catch {
    window.localStorage.removeItem(DEV_USER_KEY);
    return null;
  }
}

export function signOutDevUser(): void {
  window.localStorage.removeItem(DEV_USER_KEY);
}

export function getDevToken(): string | null {
  const user = getDevUser();
  return user?.token ?? null;
}
