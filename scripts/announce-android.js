#!/usr/bin/env node
// Sends the "Emuna is now on Android" announcement to the given Expo push tokens,
// then waits a few seconds and checks the delivery receipts.
//
// Usage:
//   node scripts/announce-android.js "ExponentPushToken[xxxx]" ["ExponentPushToken[yyyy]" ...]

const MESSAGE = {
  title: 'אמונה הגיעה לאנדרואיד! 🎉',
  body: 'הציטוט היומי שלך עכשיו גם בגוגל פליי. שתפו את מי שאתם אוהבים ותנו להם להתחיל כל בוקר עם קצת אמונה 💙',
  sound: 'default',
  priority: 'high',
  data: { kind: 'announcement', topic: 'android-launch' },
};

const tokens = process.argv.slice(2);
if (tokens.length === 0) {
  console.error('Usage: node scripts/announce-android.js "ExponentPushToken[...]" ...');
  process.exit(1);
}

const post = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
  return json;
};

(async () => {
  const { data: tickets } = await post(
    'https://exp.host/--/api/v2/push/send',
    tokens.map((to) => ({ to, ...MESSAGE })),
  );

  const ids = [];
  tickets.forEach((t, i) => {
    if (t.status === 'ok') ids.push(t.id);
    console.log(`send   ${tokens[i]} -> ${t.status}${t.message ? ` (${t.message})` : ''}`);
  });
  if (ids.length === 0) return;

  // Receipts are only available after Expo hands the message to FCM/APNs.
  await new Promise((r) => setTimeout(r, 5000));
  const { data: receipts } = await post('https://exp.host/--/api/v2/push/getReceipts', { ids });
  for (const id of ids) {
    const r = receipts[id];
    console.log(
      `receipt ${id} -> ${r ? r.status : 'not ready yet'}${r?.details?.error ? ` (${r.details.error})` : ''}`,
    );
  }
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
