import { api } from "./api";
import type { User } from "./types";

export async function getMe(): Promise<User | null> {
  try {
    return await api.get<User>("/v1/auth/me");
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await api.post("/v1/auth/logout", {});
}
