export const isBrowser = !(window as Window & { invokeNative?: unknown })
  .invokeNative;
export async function fetchNui<T = unknown>(
  event: string,
  data: unknown = {},
): Promise<T> {
  if (isBrowser) return { ok: true } as T;
  const resource =
    (
      window as Window & { GetParentResourceName?: () => string }
    ).GetParentResourceName?.() ?? "fa_target";
  const response = await fetch(`https://${resource}/${event}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(data),
  });
  return response.json() as Promise<T>;
}
