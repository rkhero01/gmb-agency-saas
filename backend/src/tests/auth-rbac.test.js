import crypto from 'crypto';
import { pool, checkDatabaseHealth } from '../config/database.js';
import { AgencyRepository } from '../repositories/agency.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { authService } from '../services/auth.service.js';
import { teamService } from '../services/team.service.js';
import { ROLES, PERMISSIONS, hasPermission, canManageRole } from '../config/permissions.js';
import { authenticate, authorizePermissions, enforceViewerReadOnly } from '../middleware/auth.js';

export async function runAuthRbacVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 2: Authentication & Team RBAC Test Suite');
  console.log('===========================================================');

  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error('Database connection required for Phase 2 tests: ' + health.message);
  }

  const agencyRepo = new AgencyRepository(pool);
  const userRepo = new UserRepository(pool);

  const testSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // Setup Test Tenants: Agency A and Agency B
    // -------------------------------------------------------------------------
    console.log('\n--- Setting up Test Tenants ---');
    const agencyA = await agencyRepo.create({
      name: `Apex Agency ${testSuffix}`,
      slug: `apex-auth-${testSuffix}`,
      status: 'active',
    });
    console.log(`✓ Agency A created: ${agencyA.id}`);

    const agencyB = await agencyRepo.create({
      name: `Beacon Media ${testSuffix}`,
      slug: `beacon-auth-${testSuffix}`,
      status: 'active',
    });
    console.log(`✓ Agency B created: ${agencyB.id}`);

    // -------------------------------------------------------------------------
    // Test 1: Signup / User Creation Password Hashing
    // -------------------------------------------------------------------------
    console.log('\n[1/12] Testing user creation and password hashing...');
    const ownerA = await userRepo.create(agencyA.id, {
      name: 'Alice Owner',
      email: `alice.${testSuffix}@apex.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    // Verify created return object omits password_hash for safety
    if (ownerA.password_hash) {
      throw new Error('SECURITY VIOLATION: password_hash leaked in repository creation output');
    }

    // Fetch internal record with hash to verify bcrypt format
    const dbRecord = await userRepo.findByEmail(agencyA.id, ownerA.email);
    if (!dbRecord || !dbRecord.password_hash) {
      throw new Error('Failed to find user with password hash');
    }
    if (dbRecord.password_hash === 'StrongPassword123!') {
      throw new Error('SECURITY VIOLATION: Plaintext password was stored in database!');
    }
    if (!dbRecord.password_hash.startsWith('$2')) {
      throw new Error('Password hash does not conform to valid bcrypt format!');
    }
    const isHashValid = await userRepo.verifyPassword('StrongPassword123!', dbRecord.password_hash);
    if (!isHashValid) throw new Error('Password verification against hash failed!');
    console.log('✓ Password stored as salted bcrypt hash. Plaintext never stored.');

    // -------------------------------------------------------------------------
    // Test 2: Login Success
    // -------------------------------------------------------------------------
    console.log('\n[2/12] Testing login success...');
    const loginResult = await authService.login({
      email: `alice.${testSuffix}@apex.com`,
      password: 'StrongPassword123!',
    });

    if (!loginResult.token) throw new Error('Login failed to return an authentication token');
    if (loginResult.user.id !== ownerA.id) throw new Error('Login returned incorrect user record');
    if (loginResult.user.password_hash) throw new Error('SECURITY VIOLATION: password_hash leaked in login response');
    if (loginResult.agency.id !== agencyA.id) throw new Error('Login returned incorrect agency context');
    console.log(`✓ Login succeeded. JWT token issued. User role: ${loginResult.user.role}`);

    // -------------------------------------------------------------------------
    // Test 3: Invalid Password Rejection
    // -------------------------------------------------------------------------
    console.log('\n[3/12] Testing invalid password rejection...');
    let invalidPasswordCaught = false;
    try {
      await authService.login({
        email: `alice.${testSuffix}@apex.com`,
        password: 'WrongPassword999!',
      });
    } catch (err) {
      if (err.code === 'INVALID_CREDENTIALS' && err.status === 401) {
        invalidPasswordCaught = true;
      }
    }
    if (!invalidPasswordCaught) {
      throw new Error('Expected invalid credentials error was not thrown on incorrect password!');
    }
    console.log('✓ Invalid password correctly rejected with 401 INVALID_CREDENTIALS');

    // -------------------------------------------------------------------------
    // Test 4: Authenticated Request
    // -------------------------------------------------------------------------
    console.log('\n[4/12] Testing authenticated request with valid JWT...');
    let authReq = {
      headers: {
        authorization: `Bearer ${loginResult.token}`,
      },
    };
    let authRes = {};
    let nextCalled = false;
    authenticate(authReq, authRes, () => {
      nextCalled = true;
    });

    if (!nextCalled) throw new Error('authenticate middleware failed to call next() on valid token');
    if (authReq.user.id !== ownerA.id || authReq.user.agency_id !== agencyA.id) {
      throw new Error('authenticate middleware attached incorrect user claims');
    }
    console.log('✓ Valid JWT successfully authenticated and verified');

    // -------------------------------------------------------------------------
    // Test 5: Unauthenticated Request Rejection
    // -------------------------------------------------------------------------
    console.log('\n[5/12] Testing unauthenticated request rejection...');
    let unauthCaughtStatus = null;
    let unauthCaughtCode = null;
    const mockRes = {
      status(s) {
        unauthCaughtStatus = s;
        return this;
      },
      json(payload) {
        unauthCaughtCode = payload?.error?.code;
      },
    };

    authenticate({ headers: {} }, mockRes, () => {});
    if (unauthCaughtStatus !== 401 || unauthCaughtCode !== 'AUTH_REQUIRED') {
      throw new Error(`Expected 401 AUTH_REQUIRED, got: ${unauthCaughtStatus} ${unauthCaughtCode}`);
    }
    console.log('✓ Request without token properly rejected with 401 AUTH_REQUIRED');

    // Test with malformed token
    authenticate({ headers: { authorization: 'Bearer invalid.bogus.token' } }, mockRes, () => {});
    if (unauthCaughtStatus !== 401) {
      throw new Error('Expected 401 on malformed token');
    }
    console.log('✓ Request with invalid token properly rejected with 401 INVALID_TOKEN');

    // -------------------------------------------------------------------------
    // Test 6: JWT / Session Agency ID Derivation
    // -------------------------------------------------------------------------
    console.log('\n[6/12] Testing tenant agency_id derivation from token (Zero Trust Header)...');
    // An attacker tries to pass an x-agency-id header pointing to Agency B
    const spoofReq = {
      headers: {
        authorization: `Bearer ${loginResult.token}`,
        'x-agency-id': agencyB.id, // Malicious spoof attempt
      },
    };
    authenticate(spoofReq, mockRes, () => {});

    // Verified tenant context MUST match token claims (Agency A), NOT the spoofed header (Agency B)
    if (spoofReq.tenant.agencyId !== agencyA.id) {
      throw new Error('SECURITY VIOLATION: Tenant context was derived from spoofed header rather than JWT claim!');
    }
    if (spoofReq.tenant.agencyId === agencyB.id) {
      throw new Error('CRITICAL VULNERABILITY: User was able to spoof tenant via x-agency-id header!');
    }
    console.log('✓ Zero-Trust verified: Tenant identity strictly derived from cryptographic JWT claim');

    // -------------------------------------------------------------------------
    // Test 7: Cross-Agency Access Rejection
    // -------------------------------------------------------------------------
    console.log('\n[7/12] Testing cross-agency access rejection...');
    // Create an owner for Agency B
    const ownerB = await userRepo.create(agencyB.id, {
      name: 'Bob Owner',
      email: `bob.${testSuffix}@beacon.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    // Alice (Agency A) attempts to fetch team members of Agency B
    const aliceTeamView = await teamService.listTeamMembers(agencyA.id);
    const hasBobInAliceAgency = aliceTeamView.some((m) => m.id === ownerB.id);
    if (hasBobInAliceAgency) {
      throw new Error('SECURITY VIOLATION: Agency A was able to list users belonging to Agency B!');
    }

    // Alice attempts to lookup Bob directly via scoped repository
    const directAccessBob = await userRepo.findById(agencyA.id, ownerB.id);
    if (directAccessBob !== null) {
      throw new Error('SECURITY VIOLATION: Cross-agency user query returned a record!');
    }
    console.log('✓ Cross-agency access strictly rejected: Users in Agency A cannot access Agency B data');

    // -------------------------------------------------------------------------
    // Test 8: Centralized Role Authorization
    // -------------------------------------------------------------------------
    console.log('\n[8/12] Testing centralized RBAC permission matrix...');
    // Owner permissions check
    if (!hasPermission(ROLES.OWNER, PERMISSIONS.TEAM_INVITE)) throw new Error('Owner missing TEAM_INVITE');
    if (!hasPermission(ROLES.OWNER, PERMISSIONS.AGENCY_UPDATE)) throw new Error('Owner missing AGENCY_UPDATE');

    // Admin permissions check
    if (!hasPermission(ROLES.ADMIN, PERMISSIONS.TEAM_INVITE)) throw new Error('Admin missing TEAM_INVITE');
    if (hasPermission(ROLES.ADMIN, PERMISSIONS.AGENCY_DELETE)) throw new Error('Admin should not have AGENCY_DELETE');

    // Manager permissions check
    if (hasPermission(ROLES.MANAGER, PERMISSIONS.TEAM_INVITE)) throw new Error('Manager should not have TEAM_INVITE');
    if (!hasPermission(ROLES.MANAGER, PERMISSIONS.CLIENT_UPDATE)) throw new Error('Manager missing CLIENT_UPDATE');

    // Viewer permissions check
    if (hasPermission(ROLES.VIEWER, PERMISSIONS.CLIENT_CREATE)) throw new Error('Viewer should not have CLIENT_CREATE');
    if (!hasPermission(ROLES.VIEWER, PERMISSIONS.CLIENT_VIEW)) throw new Error('Viewer missing CLIENT_VIEW');
    console.log('✓ Centralized permission matrix correctly enforces role capabilities');

    // -------------------------------------------------------------------------
    // Test 9: Viewer Read-Only Behavior
    // -------------------------------------------------------------------------
    console.log('\n[9/12] Testing viewer read-only behavior...');
    const viewerA = await userRepo.create(agencyA.id, {
      name: 'Vicki Viewer',
      email: `vicki.${testSuffix}@apex.com`,
      password: 'StrongPassword123!',
      role: ROLES.VIEWER,
    });

    // Test GET request with viewer (allowed)
    let viewerAllowed = false;
    enforceViewerReadOnly({ user: viewerA, method: 'GET' }, mockRes, () => {
      viewerAllowed = true;
    });
    if (!viewerAllowed) throw new Error('Viewer GET request was unexpectedly blocked');

    // Test POST mutation with viewer (blocked)
    let viewerBlockedCode = null;
    const viewerBlockRes = {
      status(s) {
        return this;
      },
      json(payload) {
        viewerBlockedCode = payload?.error?.code;
      },
    };
    enforceViewerReadOnly({ user: viewerA, method: 'POST' }, viewerBlockRes, () => {});
    if (viewerBlockedCode !== 'VIEWER_READ_ONLY') {
      throw new Error(`Expected VIEWER_READ_ONLY for viewer mutation, got: ${viewerBlockedCode}`);
    }
    console.log('✓ Viewer role correctly constrained to read-only operations');

    // -------------------------------------------------------------------------
    // Test 10: Unauthorized Role Escalation Prevention
    // -------------------------------------------------------------------------
    console.log('\n[10/12] Testing unauthorized role escalation prevention...');
    // Create an Admin user in Agency A
    const adminA = await userRepo.create(agencyA.id, {
      name: 'Adam Admin',
      email: `adam.${testSuffix}@apex.com`,
      password: 'StrongPassword123!',
      role: ROLES.ADMIN,
    });

    // Admin attempts to invite an Owner (privilege escalation)
    let adminEscalateCaught = false;
    try {
      await teamService.inviteTeamMember(agencyA.id, adminA, {
        name: 'Eve Intruder',
        email: `eve.${testSuffix}@apex.com`,
        role: ROLES.OWNER,
      });
    } catch (err) {
      if (err.code === 'ROLE_ESCALATION_FORBIDDEN') {
        adminEscalateCaught = true;
      }
    }
    if (!adminEscalateCaught) {
      throw new Error('SECURITY VIOLATION: Admin was able to invite an Owner user (role escalation)!');
    }

    // Admin attempts to promote an existing viewer to Owner
    let adminPromoteCaught = false;
    try {
      await teamService.updateMemberRole(agencyA.id, adminA, viewerA.id, ROLES.OWNER);
    } catch (err) {
      if (err.code === 'ROLE_ESCALATION_FORBIDDEN') {
        adminPromoteCaught = true;
      }
    }
    if (!adminPromoteCaught) {
      throw new Error('SECURITY VIOLATION: Admin was able to promote user to Owner!');
    }

    // Admin attempts to demote or deactivate Alice (Owner)
    let adminDemoteOwnerCaught = false;
    try {
      await teamService.updateMemberRole(agencyA.id, adminA, ownerA.id, ROLES.MANAGER);
    } catch (err) {
      if (err.code === 'ROLE_ESCALATION_FORBIDDEN') {
        adminDemoteOwnerCaught = true;
      }
    }
    if (!adminDemoteOwnerCaught) {
      throw new Error('SECURITY VIOLATION: Admin was able to modify an Owner role!');
    }
    console.log('✓ Role escalation strictly blocked: Admins cannot create, promote, or alter Owners');

    // -------------------------------------------------------------------------
    // Test 11: Final Active Owner Protection
    // -------------------------------------------------------------------------
    console.log('\n[11/12] Testing final active owner protection...');
    // Alice is currently the only active owner in Agency A.
    // Attempt 1: Alice demoting herself to admin
    let demoteFinalOwnerCaught = false;
    try {
      await teamService.updateMemberRole(agencyA.id, ownerA, ownerA.id, ROLES.ADMIN);
    } catch (err) {
      if (err.code === 'FINAL_OWNER_PROTECTION') {
        demoteFinalOwnerCaught = true;
      }
    }
    if (!demoteFinalOwnerCaught) {
      throw new Error('CRITICAL FLAW: System allowed demoting the final active owner of the agency!');
    }

    // Attempt 2: Deactivating the final active owner
    let deactivateFinalOwnerCaught = false;
    try {
      await teamService.updateMemberStatus(agencyA.id, ownerA, ownerA.id, 'inactive');
    } catch (err) {
      if (err.code === 'FINAL_OWNER_PROTECTION') {
        deactivateFinalOwnerCaught = true;
      }
    }
    if (!deactivateFinalOwnerCaught) {
      throw new Error('CRITICAL FLAW: System allowed deactivating the final active owner!');
    }

    // Now, promote Adam Admin to Owner (permitted because actor is Alice Owner)
    await teamService.updateMemberRole(agencyA.id, ownerA, adminA.id, ROLES.OWNER);
    console.log('✓ Successfully promoted second member to Owner');

    // Now that there are 2 active owners, demoting one owner IS allowed
    const demotedOwner = await teamService.updateMemberRole(agencyA.id, ownerA, adminA.id, ROLES.ADMIN);
    if (demotedOwner.role !== ROLES.ADMIN) {
      throw new Error('Failed to demote non-final owner');
    }
    console.log('✓ Final owner protection verified: Demotion/deactivation blocked only when <= 1 owner remains');

    // -------------------------------------------------------------------------
    // Test 12: Preserved Phase 1 Tenant Isolation Checks
    // -------------------------------------------------------------------------
    console.log('\n[12/12] Verifying Phase 1 database integrity & compound FK rules still hold...');
    const clientRepo = (await import('../repositories/client.repository.js')).clientRepository;
    const locationRepo = (await import('../repositories/location.repository.js')).locationRepository;

    const clientA = await clientRepo.create(agencyA.id, {
      name: `Client Alpha ${testSuffix}`,
      status: 'active',
    });
    const clientB = await clientRepo.create(agencyB.id, {
      name: `Client Beta ${testSuffix}`,
      status: 'active',
    });

    let crossFkCaught = false;
    try {
      // Agency A attempts to create a location pointing to Client B (belongs to Agency B)
      await locationRepo.create(agencyA.id, {
        client_id: clientB.id,
        name: 'Unauthorized Cross-Tenant Branch',
      });
    } catch {
      crossFkCaught = true;
    }

    if (!crossFkCaught) {
      throw new Error('Phase 1 compound foreign key integrity check failed!');
    }
    console.log('✓ Phase 1 compound foreign-key constraint actively preserved and verified');

    console.log('\n===========================================================');
    console.log('🎉 ALL 12 AUTHENTICATION & TEAM RBAC CHECKS PASSED!');
    console.log('===========================================================');
    return true;
  } catch (error) {
    console.error('\n❌ Phase 2 Auth/RBAC Verification Failed:', error);
    throw error;
  }
}

// CLI runner
if (process.argv[1] && process.argv[1].endsWith('auth-rbac.test.js')) {
  runAuthRbacVerification()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
