#!/usr/bin/env node
/**
 * Wean – Appwrite setup script
 * Creates the database, collections, and attributes required by the service.
 *
 * Usage:
 *   node appwrite/setup.js
 *
 * Environment variables (or .env in repo root):
 *   APPWRITE_ENDPOINT        e.g. http://localhost/v1
 *   APPWRITE_PROJECT_ID
 *   APPWRITE_API_KEY         Server-side key with full database permissions
 */

'use strict';

const { Client, Databases, Permission, Role, IndexType, ID } = require('node-appwrite');
const path = require('path');

// ─── Load .env from project root ──────────────────────────────────────────────
try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch (_) {
  // dotenv is optional; env vars may already be set
}

// ─── Config ───────────────────────────────────────────────────────────────────
const ENDPOINT   = process.env.APPWRITE_ENDPOINT    || 'http://localhost/v1';
const PROJECT_ID = process.env.APPWRITE_PROJECT_ID  || 'wean_project';
const API_KEY    = process.env.APPWRITE_API_KEY      || '';
const DB_ID      = process.env.APPWRITE_DB_ID        || 'wean_db';
const DB_NAME    = 'Wean Database';

if (!API_KEY) {
  console.error('[setup] ERROR: APPWRITE_API_KEY is not set.');
  process.exit(1);
}

// ─── Client ───────────────────────────────────────────────────────────────────
const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const db = new Databases(client);

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create a database; skip if it already exists.
 */
async function ensureDatabase() {
  try {
    await db.get(DB_ID);
    console.log(`[setup] Database "${DB_ID}" already exists — skipping.`);
  } catch (err) {
    if (err.code === 404) {
      await db.create(DB_ID, DB_NAME);
      console.log(`[setup] Created database "${DB_ID}".`);
    } else {
      throw err;
    }
  }
}

/**
 * Create a collection; skip if it already exists.
 * Returns the collection document.
 */
async function ensureCollection(collectionId, name, permissions) {
  try {
    const existing = await db.getCollection(DB_ID, collectionId);
    console.log(`[setup] Collection "${collectionId}" already exists — skipping.`);
    return existing;
  } catch (err) {
    if (err.code === 404) {
      const col = await db.createCollection(DB_ID, collectionId, name, permissions);
      console.log(`[setup] Created collection "${collectionId}".`);
      return col;
    }
    throw err;
  }
}

/**
 * Create a string attribute; skip 409 conflicts.
 */
async function addStringAttr(collectionId, key, size, required, defaultValue = null, array = false) {
  try {
    await db.createStringAttribute(DB_ID, collectionId, key, size, required, defaultValue, array);
    console.log(`  [attr] ${collectionId}.${key} (string, size=${size})`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`  [attr] ${collectionId}.${key} already exists — skipping.`);
    } else {
      throw err;
    }
  }
}

/**
 * Create a float attribute; skip 409 conflicts.
 */
async function addFloatAttr(collectionId, key, required, min = null, max = null, defaultValue = null) {
  try {
    await db.createFloatAttribute(DB_ID, collectionId, key, required, min, max, defaultValue);
    console.log(`  [attr] ${collectionId}.${key} (float)`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`  [attr] ${collectionId}.${key} already exists — skipping.`);
    } else {
      throw err;
    }
  }
}

/**
 * Create an integer attribute; skip 409 conflicts.
 */
async function addIntAttr(collectionId, key, required, min = null, max = null, defaultValue = null) {
  try {
    await db.createIntegerAttribute(DB_ID, collectionId, key, required, min, max, defaultValue);
    console.log(`  [attr] ${collectionId}.${key} (integer)`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`  [attr] ${collectionId}.${key} already exists — skipping.`);
    } else {
      throw err;
    }
  }
}

/**
 * Create a boolean attribute; skip 409 conflicts.
 */
async function addBoolAttr(collectionId, key, required, defaultValue = null) {
  try {
    await db.createBooleanAttribute(DB_ID, collectionId, key, required, defaultValue);
    console.log(`  [attr] ${collectionId}.${key} (boolean)`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`  [attr] ${collectionId}.${key} already exists — skipping.`);
    } else {
      throw err;
    }
  }
}

/**
 * Create a datetime attribute; skip 409 conflicts.
 */
async function addDatetimeAttr(collectionId, key, required, defaultValue = null) {
  try {
    await db.createDatetimeAttribute(DB_ID, collectionId, key, required, defaultValue);
    console.log(`  [attr] ${collectionId}.${key} (datetime)`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`  [attr] ${collectionId}.${key} already exists — skipping.`);
    } else {
      throw err;
    }
  }
}

/**
 * Create an index; skip 409 conflicts.
 */
async function addIndex(collectionId, key, type, attributes, orders) {
  try {
    await db.createIndex(DB_ID, collectionId, key, type, attributes, orders);
    console.log(`  [idx]  ${collectionId}.${key} (${type})`);
  } catch (err) {
    if (err.code === 409) {
      console.log(`  [idx]  ${collectionId}.${key} already exists — skipping.`);
    } else {
      throw err;
    }
  }
}

// ─── Collection definitions ───────────────────────────────────────────────────

async function setupUsersCollection() {
  const collectionId = 'users';
  const permissions = [
    Permission.read(Role.any()),
    Permission.write(Role.any()),
  ];

  await ensureCollection(collectionId, 'Users', permissions);
  // Wait for Appwrite to finish provisioning
  await sleep(500);

  await addStringAttr(collectionId, 'phone_number',    20,  true);   // E.164 without +
  await addStringAttr(collectionId, 'display_name',    128, false);
  await addStringAttr(collectionId, 'language',        10,  false, 'ar');
  await addStringAttr(collectionId, 'whatsapp_jid',    64,  false);  // remoteJid
  await addIntAttr(   collectionId, 'total_searches',  false, 0, null, 0);
  await addBoolAttr(  collectionId, 'is_active',       false, true);
  await addDatetimeAttr(collectionId, 'first_seen',    false);
  await addDatetimeAttr(collectionId, 'last_seen',     false);

  await sleep(1000); // let attributes stabilise before creating indexes
  await addIndex(collectionId, 'idx_phone', IndexType.Unique, ['phone_number'], ['ASC']);
  await addIndex(collectionId, 'idx_last_seen', IndexType.Key, ['last_seen'], ['DESC']);
}

async function setupSessionsCollection() {
  const collectionId = 'sessions';
  const permissions = [
    Permission.read(Role.any()),
    Permission.write(Role.any()),
  ];

  await ensureCollection(collectionId, 'Sessions', permissions);
  await sleep(500);

  await addStringAttr(collectionId,   'phone_number',  20,  true);
  // Session FSM state: idle | awaiting_place_type | searching | done
  await addStringAttr(collectionId,   'state',         32,  false, 'idle');
  await addFloatAttr( collectionId,   'latitude',      false, -90,  90);
  await addFloatAttr( collectionId,   'longitude',     false, -180, 180);
  await addStringAttr(collectionId,   'last_place_type', 64, false);
  await addStringAttr(collectionId,   'last_reply',    2000, false);
  await addIntAttr(   collectionId,   'message_count', false, 0, null, 0);
  await addDatetimeAttr(collectionId, 'created_at',    false);
  await addDatetimeAttr(collectionId, 'updated_at',    false);
  // TTL flag: background job can clean up sessions older than 24 h
  await addBoolAttr(  collectionId,   'expired',       false, false);

  await sleep(1000);
  await addIndex(collectionId, 'idx_phone',   IndexType.Unique, ['phone_number'], ['ASC']);
  await addIndex(collectionId, 'idx_state',   IndexType.Key,    ['state'],        ['ASC']);
  await addIndex(collectionId, 'idx_updated', IndexType.Key,    ['updated_at'],   ['DESC']);
}

async function setupSearchesCollection() {
  const collectionId = 'searches';
  const permissions = [
    Permission.read(Role.any()),
    Permission.write(Role.any()),
  ];

  await ensureCollection(collectionId, 'Searches', permissions);
  await sleep(500);

  await addStringAttr(collectionId,   'phone_number',    20,   true);
  await addFloatAttr( collectionId,   'latitude',        true, -90,  90);
  await addFloatAttr( collectionId,   'longitude',       true, -180, 180);
  await addStringAttr(collectionId,   'place_type',      64,   true);
  await addStringAttr(collectionId,   'place_type_ar',   64,   false);
  await addIntAttr(   collectionId,   'radius_meters',   false, 100, 50000, 2000);
  await addIntAttr(   collectionId,   'results_count',   false, 0, null, 0);
  // Store the top-5 place names as a JSON string (avoids array attribute limits)
  await addStringAttr(collectionId,   'results_json',    8000,  false);
  await addStringAttr(collectionId,   'formatted_message', 4000, false);
  await addBoolAttr(  collectionId,   'cache_hit',       false, false);
  await addDatetimeAttr(collectionId, 'timestamp',       true);

  await sleep(1000);
  await addIndex(collectionId, 'idx_phone',     IndexType.Key, ['phone_number'], ['ASC']);
  await addIndex(collectionId, 'idx_place_type',IndexType.Key, ['place_type'],   ['ASC']);
  await addIndex(collectionId, 'idx_timestamp', IndexType.Key, ['timestamp'],    ['DESC']);
  // Geospatial-style index for analytics (not true geo, but useful for filtering)
  await addIndex(collectionId, 'idx_lat_lng',   IndexType.Key, ['latitude', 'longitude'], ['ASC', 'ASC']);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║   Wean – Appwrite Setup Script       ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`Endpoint:   ${ENDPOINT}`);
  console.log(`Project ID: ${PROJECT_ID}`);
  console.log(`Database:   ${DB_ID}`);
  console.log('');

  try {
    // 1. Ensure database
    await ensureDatabase();
    await sleep(500);

    // 2. Create collections
    console.log('\n[setup] Setting up "users" collection…');
    await setupUsersCollection();

    console.log('\n[setup] Setting up "sessions" collection…');
    await setupSessionsCollection();

    console.log('\n[setup] Setting up "searches" collection…');
    await setupSearchesCollection();

    console.log('\n✅  Appwrite setup complete!');
    console.log('');
    console.log('Collections created:');
    console.log('  • users    – user profiles and preferences');
    console.log('  • sessions – WhatsApp conversation state machine');
    console.log('  • searches – search history and analytics');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Set APPWRITE_DB_ID=wean_db in your .env');
    console.log('  2. Set APPWRITE_SESSIONS_COLLECTION=sessions');
    console.log('  3. Set APPWRITE_SEARCHES_COLLECTION=searches');
    console.log('  4. Set APPWRITE_USERS_COLLECTION=users');
    console.log('');
  } catch (err) {
    console.error('\n❌  Setup failed:', err.message || err);
    if (err.response) {
      console.error('   Response:', JSON.stringify(err.response, null, 2));
    }
    process.exit(1);
  }
}

main();
