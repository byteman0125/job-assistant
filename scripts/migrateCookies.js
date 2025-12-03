const path = require('path');
const JobDatabase = require('../src/main/database');

function log(...args) {
  // Simple prefixed logger for the migration script
  console.log('[migrate:cookies]', ...args);
}

async function run() {
  try {
    log('Starting cookie migration to cookie_sets...');

    const db = new JobDatabase();

    // Read all legacy single-set cookies from the cookies table
    const allCookies = db.getAllCookies(); // { platform: [ { name, value, ... }, ... ] }

    if (!allCookies || Object.keys(allCookies).length === 0) {
      log('No legacy cookies found. Nothing to migrate.');
      return;
    }

    for (const [platform, cookies] of Object.entries(allCookies)) {
      if (!Array.isArray(cookies) || cookies.length === 0) {
        log(`Skipping platform "${platform}": no cookies in legacy table.`);
        continue;
      }

      const existingSets = db.getCookieSets(platform);
      if (Array.isArray(existingSets) && existingSets.length > 0) {
        log(
          `Skipping platform "${platform}": already has ${existingSets.length} cookie set(s) in cookie_sets.`
        );
        continue;
      }

      // Create a default set name that can be edited later
      const label = 'Set 1';
      const id = db.saveCookieSet(platform, label, cookies);
      log(
        `Created cookie set "${label}" (id=${id}) for platform "${platform}" with ${cookies.length} cookie(s).`
      );
    }

    log('Cookie migration completed.');
  } catch (err) {
    console.error('[migrate:cookies] Error during migration:', err);
    process.exitCode = 1;
  }
}

run();


