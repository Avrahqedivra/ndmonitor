# NDMonitor

NDMonitor is a Node.js/TypeScript dashboard service for FreeDMR and HBLink systems. It connects to an HBLink/FreeDMR TCP reporting socket, builds live JSON state, and serves a browser dashboard with real-time traffic, last-heard data, bridges, diagnostics, APRS/map views, subscribers, talkgroup information, and statistics.

The project is inspired by HBMon/HBMonv2 and keeps the frontend mostly static and easy to customize through HTML, CSS, JavaScript, image assets, and TypeScript configuration.

## Features

- Live FreeDMR/HBLink dashboard over HTTP or HTTPS.
- WebSocket updates for dashboard pages.
- Last-heard traffic log and JSON history generation.
- Homebrew peer, bridge, talkgroup, subscriber, APRS, and map views.
- Optional Basic Auth using generated passcodes.
- Optional diagnostics for TCP hosts, ping checks, and Linux services.
- Automatic RadioID peer/subscriber database downloads.
- Static page templates and assets that can be edited without a frontend build tool.

## Requirements

- Node.js 18 or newer.
- npm.
- A reachable HBLink or FreeDMR reporting socket.
- Network access to RadioID database URLs if automatic ID downloads are enabled.

## Installation

```bash
git clone https://github.com/Avrahqedivra/ndmonitor.git
cd ndmonitor
npm install
```

## Configuration

Create your local TypeScript configuration from the sample:

```bash
cp src/config_sample.txt src/config.ts
```

Then edit `src/config.ts` for your system. The most important settings are:

```ts
export let testMode = false

export const __system_name__ = "NDMonitor for HBLink/FreeDMR"

export const hblink_server_host = "127.0.0.1"
export const hblink_server_port = 4321

export const __monitor_webserver_port__ = 9990
export const __socketServerPort__ = 9020

export const __https__ = false
export const __path__ = "./"
export const __log_path__ = "./log/"
```

Notes:

- `testMode = true` binds the web server to `localhost` and connects the reporter to `hblink_server_host`.
- `testMode = false` binds the web server to `hblink_server_host` and connects the reporter to `localhost`.
- `__monitor_webserver_port__` is the dashboard HTTP/HTTPS port.
- `__socketServerPort__` is the realtime WebSocket port when HTTPS mode is disabled.
- `__path__` and `__log_path__` must end with `/`.
- HTTPS mode reads `__privateKey__` and `__certificate__`.

## Build

```bash
npm run build
```

The TypeScript compiler writes JavaScript and source maps to `dist/`.

## Run

After building, start the monitor with:

```bash
node ./dist/monitor.js
```

Then open:

```text
http://<monitor-host>:<__monitor_webserver_port__>/
```

For the default sample configuration:

```text
http://127.0.0.1:9990/
```

The current `npm start` script points to `monitor.js` in the project root. Until that script is changed, use `node ./dist/monitor.js` after building.

## Authentication

NDMonitor can protect the dashboard with HTTP Basic Auth. Enable it in `src/config.ts`:

```ts
export const __web_auth__ = true
export const __web_secret_key__ = ["change-this-secret"]
```

Generate a passcode for a callsign or login:

```bash
node ./dist/gencode.js MYCALL
```

The username is the callsign/login you passed to `gencode`; the password is the generated numeric passcode. No password database is stored.

Useful options:

```bash
node ./dist/gencode.js -c mycall
node ./dist/gencode.js -m MYCALL
node ./dist/gencode.js MYCALL -s0
```

## Data Files

NDMonitor uses several JSON files to resolve IDs and display labels:

- `peer_ids.json`
- `subscriber_ids.json`
- `talkgroup_ids.json`
- `local_peer_ids.json`
- `local_subscriber_ids.json`
- `local_talkgroup_ids.json`

The global peer and subscriber files can be downloaded automatically from RadioID URLs configured in `src/config.ts`. Local files are optional and are merged with the downloaded dictionaries when configured.

Runtime logs and generated state are written under `__log_path__`, including files such as:

- `lastheard.log`
- `lastheard.json`
- `analytics.json`
- `contacts_fr_dept.json`

## Pages And Assets

The web dashboard is served directly by the Node.js service:

- `pages/` contains HTML page templates.
- `css/` contains dashboard styles.
- `scripts/` contains browser JavaScript.
- `images/` contains icons, logos, markers, and dashboard images.
- `assets/` contains downloadable or generated data exposed by the service.

Template placeholders such as `__SYSTEM_NAME__`, `__SOCKET_SERVER_PORT__`, `__TGID_ORDER__`, and `__FOOTER__` are replaced at request time using values from `src/config.ts`.

## Diagnostics

The `__to_be_monitored__` array in `src/config.ts` defines checks displayed by the diagnostics view. Supported actions include:

- `connect`: test a TCP connection to `ip` and `port`.
- `ping`: run one system ping to `ip`.
- `service`: check a Linux systemd service with `systemctl is-active`.

Service checks return a disabled status on Windows.

## Development

Common commands:

```bash
npm install
npm run build
node ./dist/monitor.js
node ./dist/gencode.js MYCALL
```

There is currently no automated test suite configured; `npm test` exits with the default placeholder error.

Project layout:

```text
src/       TypeScript source
dist/      Compiled JavaScript output
pages/     HTML dashboard pages
css/       CSS used by served pages
scripts/   Browser-side JavaScript
images/    Dashboard images and icons
assets/    Runtime/static data assets
log*/      Runtime logs and generated JSON
```

## Deployment Notes

- Run from the project root so relative paths in `src/config.ts` resolve correctly.
- Use ports above `1024` when running without root/admin privileges.
- For long-running Linux deployments, run `node ./dist/monitor.js` under systemd, pm2, Docker, or another process supervisor.
- Make sure the configured HBLink/FreeDMR reporting socket is reachable from the NDMonitor process.
- If HTTPS is enabled, verify that the configured certificate and key files are readable by the process.

## Credits

NDMonitor is based on work from:

- HBMon v1, a web dashboard for HBLink by N0MJS.
- HBMon v2 by SP2ONG: <https://github.com/sp2ong/HBMonv2>

Copyright (c) 2023-2026 Jean-Michel Cohen, F4JDN.

## License

The repository currently contains mixed license metadata: `package.json` declares `ISC`, source headers contain an MIT-style permission notice, and older README text referenced GPL terms. Before publishing a release, align the repository metadata and add a single `LICENSE` file.
