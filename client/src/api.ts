export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  const body = await res.json().catch(() => ({ error: '无法读取服务响应，请检查网络连接' }));
  if (!res.ok) throw new Error([body.error || '请求失败', ...(body.details || [])].join('\n'));
  return body as T;
}
export const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
