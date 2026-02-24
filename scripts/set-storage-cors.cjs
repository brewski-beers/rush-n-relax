/* eslint-disable */
// Run with: node scripts/set-storage-cors.cjs
'use strict';

const { GoogleAuth } = require('../functions/node_modules/google-auth-library');
const https = require('https');
const fs = require('fs');

const cors = JSON.parse(fs.readFileSync('./storage.cors.json', 'utf8'));
const bucket = 'rush-n-relax.firebasestorage.app';

async function run() {
  const auth = new GoogleAuth({
    keyFile: './serviceAccountKey.json',
    scopes: ['https://www.googleapis.com/auth/devstorage.full_control'],
  });

  const client = await auth.getClient();
  const tokenResp = await client.getAccessToken();
  const token = tokenResp.token;

  const body = JSON.stringify({ cors });

  const options = {
    hostname: 'storage.googleapis.com',
    path: '/storage/v1/b/' + encodeURIComponent(bucket) + '?fields=cors',
    method: 'PATCH',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log(data);
        resolve();
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
