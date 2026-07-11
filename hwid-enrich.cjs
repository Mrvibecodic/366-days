'use strict';
// Inject the per-user HWID device usage (actual / limit) into the
// subscription-page data.
//
// Remnawave's /api/sub/{shortUuid}/info response (rendered by the page as
// panelData) has no HWID fields. The admin API does:
//   GET /api/users/by-username/{username}  -> user.uuid, user.hwidDeviceLimit
//   GET /api/hwid/devices/{userUuid}        -> { total }  actual device count
// When enabled (env HWID_DEVICES=on) this preload attaches a response
// interceptor to the backend's axios instance: on every sub-info payload it
// makes TWO extra admin requests to the panel (reusing the same baseURL /
// API token / reverse-proxy headers) and injects hwidDeviceLimit +
// hwidDeviceCount so the frontend renders "count / limit".
// NOTE: this performs separate calls to the panel admin API — the panel's
// REMNAWAVE_API_TOKEN must have permission to read users and HWID devices.
// Best-effort: any failure leaves the page untouched.
try {
  const on = String(process.env.HWID_DEVICES || '').toLowerCase();
  if (on === 'on' || on === 'true' || on === '1' || on === 'yes') {
    const axios = require('/opt/app/node_modules/axios');
    const realCreate = axios.create.bind(axios);
    axios.create = function patchedCreate(config) {
      const instance = realCreate(config);
      instance.interceptors.response.use(async function (resp) {
        try {
          const cfg = (resp && resp.config) || {};
          const url = String(cfg.url || '');
          if (url.indexOf('/by-username/') !== -1 || url.indexOf('/hwid/devices/') !== -1) {
            return resp; // never recurse into our own admin lookups
          }
          const data = resp && resp.data;
          const user = data && data.response && data.response.user;
          const missing = user && typeof user === 'object' && user.username &&
            (user.hwidDeviceLimit === undefined || user.hwidDeviceLimit === null);
          if (!missing) return resp;

          const uname = encodeURIComponent(String(user.username));
          const admin = await instance.get('/api/users/by-username/' + uname);
          const full = admin && admin.data && admin.data.response;
          if (!full || full.hwidDeviceLimit === undefined || full.hwidDeviceLimit === null) {
            return resp;
          }
          user.hwidDeviceLimit = full.hwidDeviceLimit;

          if (full.uuid) {
            try {
              const dev = await instance.get('/api/hwid/devices/' + encodeURIComponent(String(full.uuid)));
              const total = dev && dev.data && dev.data.response && dev.data.response.total;
              if (typeof total === 'number') user.hwidDeviceCount = total;
            } catch (e) { /* device count is optional */ }
          }
        } catch (e) { /* best-effort: leave the response untouched */ }
        return resp;
      });
      return instance;
    };
  }
} catch (e) { /* axios not resolvable — no-op */ }
