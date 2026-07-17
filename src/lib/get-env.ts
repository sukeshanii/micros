let _cfEnv: any | null = null;

export async function getCloudflareEnv(): Promise<any> {
  if (_cfEnv !== null) return _cfEnv;
  try {
    const mod = await import('cloudflare:workers');
    _cfEnv = mod.env || {};
  } catch {
    _cfEnv = {};
  }
  return _cfEnv;
}
