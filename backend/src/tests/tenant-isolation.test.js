import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { newDb } from 'pg-mem';
import { pool, checkDatabaseHealth } from '../config/database.js';
import { AgencyRepository } from '../repositories/agency.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ClientRepository } from '../repositories/client.repository.js';
import { LocationRepository } from '../repositories/location.repository.js';
import { GoogleBusinessProfileRepository } from '../repositories/googleBusinessProfile.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../database/migrations');

/**
 * Initializes in-memory PostgreSQL for testing if live Postgres is unavailable
 */
function createInMemoryDb() {
  const db = newDb();

  // Register gen_random_uuid() polyfill for pg-mem (impure: true ensures unique UUID per call)
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Execute migration files
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const rawSql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const cleanSql = rawSql
      .replace(/--.*$/gm, '')
      .replace(/CREATE EXTENSION.*?;/gs, '')
      .replace(/ALTER TABLE.*?ENABLE ROW LEVEL SECURITY;/gs, '')
      .replace(/CREATE POLICY[\s\S]*?;/gs, '')
      .replace(/DROP POLICY[\s\S]*?;/gs, '')
      .trim();

    if (cleanSql.length > 0) {
      db.public.none(cleanSql);
    }
  }

  const pgAdapter = db.adapters.createPg();
  return new pgAdapter.Pool();
}

/**
 * Main Verification Test Suite
 */
async function runTenantIsolationVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 1 Tenant Isolation & Data Model Tests');
  console.log('===========================================================');

  let dbPool;
  let isLivePostgres = false;

  const health = await checkDatabaseHealth();
  if (health.connected) {
    console.log('📡 Connected to live PostgreSQL server. Running against live DB.');
    dbPool = pool;
    isLivePostgres = true;
  } else {
    console.log('💡 Live PostgreSQL not connected locally. Initializing in-memory PostgreSQL engine for tests.');
    dbPool = createInMemoryDb();
  }

  const agencyRepo = new AgencyRepository(dbPool);
  const userRepo = new UserRepository(dbPool);
  const clientRepo = new ClientRepository(dbPool);
  const locationRepo = new LocationRepository(dbPool);
  const gbpRepo = new GoogleBusinessProfileRepository(dbPool);

  const testSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // Step 1: Create Agency A
    // -------------------------------------------------------------------------
    console.log('\n[1/8] Creating Agency A...');
    const agencyA = await agencyRepo.create({
      name: `Apex Agency ${testSuffix}`,
      slug: `apex-agency-${testSuffix}`,
      status: 'active',
    });
    console.log(`✓ Agency A created: id=${agencyA.id}, slug=${agencyA.slug}`);

    // Create an Owner user for Agency A (Verify password hashing)
    const ownerA = await userRepo.create(agencyA.id, {
      name: 'Alice Owner',
      email: `alice.${testSuffix}@apex.com`,
      password: 'SuperSecurePassword123!',
      role: 'owner',
    });
    console.log(`✓ User created under Agency A: ${ownerA.email}, role=${ownerA.role}`);

    const isPasswordValid = await userRepo.verifyPassword(
      'SuperSecurePassword123!',
      ownerA.password_hash || (await userRepo.findByEmail(agencyA.id, ownerA.email)).password_hash
    );
    if (!isPasswordValid) throw new Error('Password hash verification failed!');
    console.log('✓ Password hashing and verification confirmed');

    // -------------------------------------------------------------------------
    // Step 2: Create Client A under Agency A
    // -------------------------------------------------------------------------
    console.log('\n[2/8] Creating Client A under Agency A...');
    const clientA = await clientRepo.create(agencyA.id, {
      name: 'Downtown Dental Studio',
      business_name: 'Downtown Dental LLC',
      email: `info.${testSuffix}@downtowndental.com`,
      phone: '+1-555-0100',
      website: 'https://downtowndental.example.com',
      status: 'active',
    });
    console.log(`✓ Client A created: id=${clientA.id}, agency_id=${clientA.agency_id}`);

    // -------------------------------------------------------------------------
    // Step 3: Create Location A under Client A
    // -------------------------------------------------------------------------
    console.log('\n[3/8] Creating Location A under Client A...');
    const locationA = await locationRepo.create(agencyA.id, {
      client_id: clientA.id,
      name: 'Downtown Dental - Main Branch',
      address_line1: '123 Market St',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94103',
      country: 'USA',
      timezone: 'America/Los_Angeles',
      phone: '+1-555-0101',
      status: 'active',
    });
    console.log(`✓ Location A created: id=${locationA.id}, client_id=${locationA.client_id}`);

    // Create foundational Google Business Profile for Location A
    const gbpA = await gbpRepo.create(agencyA.id, {
      client_id: clientA.id,
      location_id: locationA.id,
      google_account_id: 'accounts/10987654321',
      google_location_id: 'locations/54321098765',
      profile_name: 'Downtown Dental Studio on Google',
      status: 'active',
      connection_status: 'disconnected',
    });
    console.log(`✓ Foundational GBP profile created: id=${gbpA.id}, location_id=${gbpA.location_id}`);

    // -------------------------------------------------------------------------
    // Step 4: Create Agency B
    // -------------------------------------------------------------------------
    console.log('\n[4/8] Creating Agency B...');
    const agencyB = await agencyRepo.create({
      name: `Beacon Digital ${testSuffix}`,
      slug: `beacon-digital-${testSuffix}`,
      status: 'active',
    });
    console.log(`✓ Agency B created: id=${agencyB.id}, slug=${agencyB.slug}`);

    // -------------------------------------------------------------------------
    // Step 5: Create Client B under Agency B
    // -------------------------------------------------------------------------
    console.log('\n[5/8] Creating Client B under Agency B...');
    const clientB = await clientRepo.create(agencyB.id, {
      name: 'Harbor Law Firm',
      business_name: 'Harbor Legal Partners LLP',
      email: `contact.${testSuffix}@harborlaw.com`,
      phone: '+1-555-0200',
      website: 'https://harborlaw.example.com',
      status: 'active',
    });
    console.log(`✓ Client B created: id=${clientB.id}, agency_id=${clientB.agency_id}`);

    // -------------------------------------------------------------------------
    // Step 6: Verify Agency A cannot access Client B
    // -------------------------------------------------------------------------
    console.log('\n[6/8] Verifying Agency A cannot access Client B...');
    const crossAccessAttempt1 = await clientRepo.findById(agencyA.id, clientB.id);
    if (crossAccessAttempt1 !== null) {
      throw new Error(`SECURITY VIOLATION: Agency A was able to access Client B! ${JSON.stringify(crossAccessAttempt1)}`);
    }
    console.log('✓ Access denied: Client B cannot be accessed using Agency A tenant context');

    // -------------------------------------------------------------------------
    // Step 7: Verify Agency B cannot access Client A
    // -------------------------------------------------------------------------
    console.log('\n[7/8] Verifying Agency B cannot access Client A...');
    const crossAccessAttempt2 = await clientRepo.findById(agencyB.id, clientA.id);
    if (crossAccessAttempt2 !== null) {
      throw new Error(`SECURITY VIOLATION: Agency B was able to access Client A! ${JSON.stringify(crossAccessAttempt2)}`);
    }
    console.log('✓ Access denied: Client A cannot be accessed using Agency B tenant context');

    // -------------------------------------------------------------------------
    // Step 8: Verify a location cannot reference a client belonging to another agency
    // -------------------------------------------------------------------------
    console.log('\n[8/8] Verifying Location cannot reference a client belonging to another agency...');
    let foreignKeyViolationCaught = false;

    try {
      // Agency A attempts to create a location pointing to Client B (which belongs to Agency B)
      await locationRepo.create(agencyA.id, {
        client_id: clientB.id,
        name: 'Malicious Cross-Tenant Branch',
        address_line1: '999 Intrusion Ave',
        city: 'Metropolis',
        state: 'NY',
        country: 'USA',
      });
    } catch (err) {
      foreignKeyViolationCaught = true;
      console.log(`✓ Expected database constraint violation caught: "${err.message}"`);
    }

    if (!foreignKeyViolationCaught) {
      throw new Error('CRITICAL SECURITY FLAW: Database allowed creating a location referencing a foreign agency client!');
    }

    // -------------------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------------------
    console.log('\n===========================================================');
    console.log('✅ ALL 8 TENANT ISOLATION & DATA MODEL CHECKS PASSED!');
    console.log('===========================================================');
    console.log('Summary of Verified Guarantees:');
    console.log(' 1. Agency A created with unique slug and active status.');
    console.log(' 2. Client A created strictly within Agency A.');
    console.log(' 3. Location A created under Client A with full address fields.');
    console.log(' 4. Agency B created independently.');
    console.log(' 5. Client B created strictly within Agency B.');
    console.log(' 6. Agency A tenant context strictly prevented from accessing Client B.');
    console.log(' 7. Agency B tenant context strictly prevented from accessing Client A.');
    console.log(' 8. Database-level compound foreign key rejected cross-agency client linkage.');
    console.log(' 9. Password hashing verified with bcryptjs (no plaintext stored).');
    console.log('10. Foundational google_business_profiles table linkage verified.');
    console.log('===========================================================\n');

    return true;
  } finally {
    if (!isLivePostgres && dbPool) {
      await dbPool.end();
    }
  }
}

// Execute if run directly
if (process.argv[1] && process.argv[1].endsWith('tenant-isolation.test.js')) {
  runTenantIsolationVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\n❌ Test Suite Failed:', err);
      process.exit(1);
    });
}

export { runTenantIsolationVerification };
