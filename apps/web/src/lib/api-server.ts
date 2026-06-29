import { cookies } from "next/headers";

const INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://petition-api-dev:8000";

export async function apiServer<T>(path: string): Promise<T | null> {
  const cookieStore = cookies();
  const token = cookieStore.get("access_token")?.value;

  try {
    const res = await fetch(`${INTERNAL_URL}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Cookie: `access_token=${token}` } : {}),
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}
