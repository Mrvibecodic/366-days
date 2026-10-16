'use strict';
try {
  const on = String(process.env.HWID_DEVICES || '').toLowerCase();
  if (on === 'on' || on === 'true' || on === '1' || on === 'yes') {
    let axios = null;
    const paths = ['/opt/app/dist/node_modules/axios', '/opt/app/node_modules/axios', 'axios'];
    for (let i = 0; i < paths.length && !axios; i++) {
      try { axios = require(paths[i]); } catch (e) {}
    }
    if (!axios || typeof axios.create !== 'function') return;
    const TTL = 60000;
    const cache = new Map();
    const cached = async function (key, load) {
      const hit = cache.get(key);
      if (hit && Date.now() - hit.t < TTL) return hit.v;
      let v = null;
      try { v = await load(); } catch (e) { v = null; }
      cache.set(key, { t: Date.now(), v: v });
      return v;
    };
    const pickHwid = function (obj) {
      const hw = obj && obj.hwidSettings;
      return hw && typeof hw === 'object' && typeof hw.enabled === 'boolean' ? hw : null;
    };
    const realCreate = axios.create.bind(axios);
    axios.create = function patchedCreate(config) {
      const instance = realCreate(config);
      instance.interceptors.response.use(async function (resp) {
        try {
          const cfg = (resp && resp.config) || {};
          const url = String(cfg.url || '');
          if (url.indexOf('/by-username/') !== -1 ||
              url.indexOf('/hwid/devices/') !== -1 ||
              url.indexOf('/subscription-settings') !== -1 ||
              url.indexOf('/external-squads/') !== -1) {
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

          let hw = await cached('global', async function () {
            const st = await instance.get('/api/subscription-settings');
            return pickHwid(st && st.data && st.data.response);
          });
          const squad = full.externalSquadUuid;
          if (typeof squad === 'string' && squad !== '') {
            const own = await cached('squad:' + squad, async function () {
              const sq = await instance.get('/api/external-squads/' + encodeURIComponent(squad));
              return pickHwid(sq && sq.data && sq.data.response);
            });
            if (own) hw = own;
          }
          if (hw && !hw.enabled) return resp;

          let limit = full.hwidDeviceLimit;
          if ((limit === undefined || limit === null) && hw && typeof hw.fallbackDeviceLimit === 'number') {
            limit = hw.fallbackDeviceLimit;
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
