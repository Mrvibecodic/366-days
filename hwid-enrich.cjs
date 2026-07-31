'use strict';
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
          if (url.indexOf('/by-username/') !== -1 ||
              url.indexOf('/hwid/devices/') !== -1 ||
              url.indexOf('/subscription-settings') !== -1) {
            return resp;
          }
          const data = resp && resp.data;
          const user = data && data.response && data.response.user;
          const missing = user && typeof user === 'object' && user.username &&
            (user.hwidDeviceLimit === undefined || user.hwidDeviceLimit === null);
          if (!missing) return resp;

          const uname = encodeURIComponent(String(user.username));
          const admin = await instance.get('/api/users/by-username/' + uname);
          const full = admin && admin.data && admin.data.response;
          if (!full) return resp;

          let limit = full.hwidDeviceLimit;
          if (limit === undefined || limit === null) {
            try {
              const st = await instance.get('/api/subscription-settings');
              const hw = st && st.data && st.data.response && st.data.response.hwidSettings;
              if (hw && hw.enabled && typeof hw.fallbackDeviceLimit === 'number') {
                limit = hw.fallbackDeviceLimit;
              }
            } catch (e) {}
          }
          if (limit === undefined || limit === null) return resp;
          user.hwidDeviceLimit = limit;

          const uid = full.uuid !== undefined && full.uuid !== null && full.uuid !== ''
            ? full.uuid
            : full.id;
          if (uid !== undefined && uid !== null && uid !== '') {
            try {
              const dev = await instance.get('/api/hwid/devices/' + encodeURIComponent(String(uid)));
              const body = dev && dev.data && dev.data.response;
              let total = body && body.total;
              if (typeof total !== 'number' && body && Array.isArray(body.devices)) {
                total = body.devices.length;
              }
              if (typeof total === 'number') user.hwidDeviceCount = total;
            } catch (e) {}
          }
        } catch (e) {}
        return resp;
      });
      return instance;
    };
  }
} catch (e) {}
