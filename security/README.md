# Command Injection Reproduction Notes for `wdproxy.js`

## Summary

This document describes a command injection issue in:

`f2etest-client/f2etest-webdriver/webdriver/wdproxy.js`

The vulnerable code constructs shell command strings using user-controllable input from the `/wd/hub/session` request body and executes them with `child_process.execSync(...)`.

In particular, the following flow is relevant:

- HTTP request to `/wd/hub/session`
- `desiredCapabilities.proxy.httpProxy`
- `setProxy(proxyHost)`
- `cp.execSync('... "' + proxyHost + '" ...')`

Because `proxyHost` is concatenated directly into a command string, attacker-controlled input may lead to OS command injection.


## Root Cause

The issue is caused by unsafe shell command construction in the following function:

```js
function setProxy(proxyHost){
    cp.execSync('reg add "'+proxyPath+'" /v "ProxyEnable" /t REG_DWORD /d "1" /f >nul');
    cp.execSync('reg add "'+proxyPath+'" /v "AutoConfigURL" /d "" /f >nul');
    cp.execSync('reg add "'+proxyPath+'" /v "ProxyServer" /d "'+proxyHost+'" /f >nul');
    console.log('System proxy inited:', proxyHost);
}
```

# Reproduction Material

A minimal reproduction script is provided in: `security/poc_wdproxy.js`

This Proof of Concept (PoC) is intended to demonstrate that external input can reach dangerous command execution logic through the vulnerable code path. For safety and easier local reproduction, the PoC hooks `child_process.spawn()` so that the Selenium Java process is not actually started during testing.


## What the PoC Does

The PoC performs the following steps:

1. **Loads the vulnerable file:** It loads `wdproxy.js` from the repository.
2. **Safely hooks the process:** It hooks `child_process.spawn()` to prevent the Selenium standalone server from actually launching.
3. **Initializes the service:** It lets `wdproxy.js` start its local HTTP service as usual.
4. **Sends the crafted payload:** It sends a malicious `POST` request to `/wd/hub/session`.
* The request contains a controlled `desiredCapabilities.proxy.httpProxy` value.


5. **Triggers the vulnerable function:** Because the browser is set to `internet explorer` and the proxy type is set to `manual`, the vulnerable code calls `setProxy(httpProxy)`.
6. **Executes the command:** The supplied proxy value is then concatenated into a shell command and passed to `execSync(...)`.


## How to Run

**Run from the project root:**

```bash
node security/poc_wdproxy.js 127.0.0.1:9999 1 ie 60

```

## Expected Output

When the PoC runs, you should see output similar to:

```text
F2etest WebDriver proxy is ready: 4001
[POC] spawn would run:
 java [ ... ]

[POC] sending createSession to port 4001
```
In the vulnerable version, after the crafted request is processed, the local machine will launch the Calculator application as a benign demonstration effect.
This shows that the attacker-controlled desiredCapabilities.proxy.httpProxy value can influence command execution behavior through the vulnerable setProxy() path.

## Patch Explanation

This branch also includes a patched version of `wdproxy.js` intended to mitigate the command injection risk described above.

### What the patch changes

The patch adds strict validation before proxy-related values are used by the following functions:

- `setProxy(proxyHost)`
- `setPac(pacUrl)`

In the vulnerable version, user-controlled values such as:

- `desiredCapabilities.proxy.httpProxy`
- `desiredCapabilities.proxy.proxyAutoconfigUrl`

could reach `child_process.execSync(...)` through string concatenation without validation.

The patched version introduces input checks before these values are passed into command execution logic.

### Validation introduced by the patch
For proxy host values, the patch only allows typical host / port style input such as:
127.0.0.1:8080
proxy.example.com:3128
Unexpected characters are rejected.
For PAC URL values, the patch checks that:
the value is a string
the value length is reasonable
the value matches an expected http:// or https:// URL format
If validation fails, the value is rejected instead of being passed into command execution.