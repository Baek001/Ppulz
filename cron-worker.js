export default {
  async scheduled(event, env, ctx) {
    const baseUrl = env.CRON_TARGET_URL;
    if (!baseUrl) {
      console.error('Missing CRON_TARGET_URL for cron worker.');
      return;
    }

    const url = new URL('/api/cron/ingest', baseUrl);
    const headers = {};
    if (env.CRON_SECRET) {
      headers['x-cron-secret'] = env.CRON_SECRET;
    }

    const response = await fetch(url.toString(), { headers });
    if (!response.ok) {
      const text = await response.text();
      console.error(`Cron ingest failed: ${response.status} ${text}`);
    }
  },
};
