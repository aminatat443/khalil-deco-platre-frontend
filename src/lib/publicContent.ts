import { api } from "@/lib/api";

const publicContentBaseUrl = (import.meta.env.VITE_PUBLIC_CONTENT_URL || "")
  .trim()
  .replace(/\/+$/, "");

export async function getPublicContent<T>() {
  if (publicContentBaseUrl) {
    try {
      const response = await fetch(`${publicContentBaseUrl}/public-content.json`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Chargement du contenu public impossible (${response.status}).`);
      return await response.json() as T;
    } catch {
      return api<T>("/public/content");
    }
  }
  return api<T>("/public/content");
}
