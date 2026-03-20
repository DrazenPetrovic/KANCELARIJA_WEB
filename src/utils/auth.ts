const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3002";

export interface User {
  username: string;
  sifraRadnika: number;
  vrstaRadnika: number;
}

let currentUser: User | null = null;

export const signIn = async (username: string, password: string) => {
  try {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      return {
        error: new Error(data.message || "Pogrešno korisničko ime ili lozinka"),
        data: null,
      };
    }

    currentUser = data.user;
    localStorage.setItem("user", JSON.stringify(data.user));

    return { data: data.user, error: null };
  } catch (error) {
    return {
      error: new Error("Greška prilikom povezivanja sa serverom"),
      data: null,
    };
  }
};

export const signOut = async () => {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }
  currentUser = null;
  localStorage.removeItem("user");
};

export const getCurrentUser = (): User | null => {
  if (currentUser) return currentUser;

  const stored = localStorage.getItem("user");
  if (stored) {
    try {
      currentUser = JSON.parse(stored);
      return currentUser;
    } catch {
      return null;
    }
  }
  return null;
};

export const verifyAuth = async (): Promise<User | null> => {
  try {
    const response = await fetch(`${API_URL}/api/auth/verify`, {
      credentials: "include",
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (data.authenticated) {
      const user: User = {
        username: data.username,
        sifraRadnika: data.sifraRadnika,
        vrstaRadnika: data.vrstaRadnika,
      };
      currentUser = user;
      localStorage.setItem("user", JSON.stringify(user));
      return user;
    }

    return null;
  } catch {
    return null;
  }
};
