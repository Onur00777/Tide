const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({ testDir: './tests/browser', workers: 1, use: { baseURL: 'http://127.0.0.1:57372', channel: 'msedge', headless: true, viewport: { width: 1440, height: 900 } }, webServer: { command: 'node tools/serve.cjs', url: 'http://127.0.0.1:57372', reuseExistingServer: false } });
