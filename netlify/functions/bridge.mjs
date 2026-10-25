// GameHub Neo ESP32 bridge. Netlify Functions + Netlify Blobs.
// The website is static; this function is the server-side pairing and command relay.
// Requires a Netlify build that bundles @netlify/blobs; no third-party cloud account.
import { getStore } from '@netlify/blobs';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SHA = (s) => createHash('sha256').update(s).digest('hex');
const store = () => getStore({ name: 'gamehub-mini-pair-v1', consistency: 'strong' });
const now = () => Date.now();
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});
const bad = (code, status=400) => json({ok:false, error:code},status);
const validDevice = (s) => typeof s === 'string' && /^[0-9a-f]{16}$/.test(s);
const validSecret = (s) => typeof s === 'string' && /^[0-9a-f]{48}$/.test(s);
const validPin = (s) => typeof s === 'string' && /^\d{6}$/.test(s);
const validToken = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const keys = new Set(['UP','DOWN','LEFT','RIGHT','A','B','START','SELECT']);
const read = async (s,k) => await s.get(k, {type:'json',consistency:'strong'});
const write = async (s,k,x) => await s.setJSON(k,x);
const sameHash = (a,b) => {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a,'hex'), Buffer.from(b,'hex'));
};
const allowedIp = async (s,req) => {
  // Best-effort per-IP guessing throttle. Not a high-assurance authentication product.
  const ip = req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const key = 'rate-'+SHA(ip).slice(0,32);
  const old = await read(s,key);
  const t = now();
  const next = old && t-old.window < 600000 ? old : {window:t,count:0};
  next.count += 1;
  await write(s,key,next);
  return next.count <= 8;
};
const verifyDevice = async (s,b) => {
  if (!validDevice(b.device) || !validSecret(b.secret)) return null;
  const device = await read(s,'dev-'+b.device);
  if (!device || !sameHash(device.hash,SHA(b.secret))) return null;
  return device;
};
const verifySession = async (s,token) => {
  if (!validToken(token)) return null;
  const v = await read(s,'sess-'+SHA(token));
  return v && v.expires > now() ? v : null;
};

export default async (req) => {
  if (req.method === 'GET') return json({ok:true, service:'GameHub Mini bridge v1', paired:false});
  if (req.method !== 'POST') return bad('method_not_allowed',405);
  let b;
  try {
    if (Number(req.headers.get('content-length')||0)>2048) return bad('too_large',413);
    const raw = await req.text();
    if (raw.length>2048) return bad('too_large',413);
    b=JSON.parse(raw);
    if (!b || typeof b !== 'object' || Array.isArray(b)) return bad('bad_request');
  } catch { return bad('bad_json'); }
  const action=b.action;
  try {
    const s=store();
    if (action==='announce') {
      if (!validDevice(b.device)||!validSecret(b.secret)||!validPin(b.pin)) return bad('invalid_device_data');
      const key='dev-'+b.device;
      const previous=await read(s,key);
      const hash=SHA(b.secret);
      if (previous && !sameHash(previous.hash,hash)) return bad('device_owned',403);
      const t=now();
      const obj={hash,pin:b.pin,pinExpires:t+10*60*1000,lastSeen:t,
                 screen: b.screen === 'ILI9341 320x240' ? b.screen : 'SH1106 128x64',mode: String(b.mode||'menu').slice(0,24)};
      await write(s,key,obj);
      await write(s,'pin-'+b.pin,{device:b.device,expires:obj.pinExpires});
      return json({ok:true,expires_in:600});
    }
    if (action==='pair') {
      if (!validPin(b.pin)) return bad('invalid_pin');
      if (!await allowedIp(s,req)) return bad('too_many_attempts',429);
      const mapped=await read(s,'pin-'+b.pin);
      if (!mapped || mapped.expires < now()) return bad('pin_expired_or_invalid',404);
      const device=await read(s,'dev-'+mapped.device);
      if (!device || device.pin!==b.pin || device.pinExpires<now() || now()-device.lastSeen>60000)
        return bad('device_offline_or_pin_expired',404);
      const token=randomBytes(32).toString('hex');
      await write(s,'sess-'+SHA(token),{device:mapped.device,expires:now()+6*60*60*1000});
      return json({ok:true,token,device:mapped.device,expires_in:21600});
    }
    if (action==='status') {
      const sess=await verifySession(s,b.token);
      if (!sess) return bad('pair_again',401);
      const device=await read(s,'dev-'+sess.device);
      return json({ok:true,device:sess.device,online:!!device && now()-device.lastSeen<45000,
                   last_seen_seconds:device?Math.round((now()-device.lastSeen)/1000):null,
                   mode:device?.mode||'unknown',screen:device?.screen||'unknown'});
    }
    if (action==='command') {
      const sess=await verifySession(s,b.token);
      if (!sess) return bad('pair_again',401);
      if (!keys.has(b.key)) return bad('invalid_button');
      const dev=await read(s,'dev-'+sess.device);
      if (!dev || now()-dev.lastSeen>45000) return bad('device_offline',409);
      // Latest button wins. Netlify Blobs is not an ordered real-time queue.
      await write(s,'cmd-'+sess.device,{id:randomBytes(8).toString('hex'),key:b.key,until:now()+12000});
      return json({ok:true,queued:true});
    }
    if (action==='poll') {
      const dev=await verifyDevice(s,b);
      if (!dev) return bad('device_not_authorized',403);
      const c=await read(s,'cmd-'+b.device);
      if (c && c.until>now() && c.id!==b.last_id) return json({ok:true,command:{id:c.id,key:c.key}});
      return json({ok:true,command:null});
    }
    return bad('unknown_action');
  } catch (err) {
    console.error('GameHub bridge failure',err);
    return bad('bridge_unavailable',503);
  }
};
