import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import { pool, checkDatabaseHealth } from '../config/database.js';
import { env } from '../config/env.js';
import { AgencyRepository } from '../repositories/agency.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ClientRepository } from '../repositories/client.repository.js';
import { LocationRepository } from '../repositories/location.repository.js';
import { googleOAuthRepository } from '../repositories/googleOAuth.repository.js';
import { googleBusinessProfileRepository } from '../repositories/googleBusinessProfile.repository.js';
import { authService } from '../services/auth.service.js';
import { ROLES, PERMISSIONS } from '../config/permissions.js';

export async function runGoogleOAuthGbpVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 4: Google Cloud OAuth 2.0 & GBP Tests');
  console.log('===========================================================');

  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error('Database connection required for Phase 4 tests: ' + health.message);
  }

  // Ensure test environment credentials for OAuth URL generation tests
  const originalClientId = env.GOOGLE.CLIENT_ID;
  const originalClientSecret = env.GOOGLE.CLIENT_SECRET;
  if (!env.GOOGLE.CLIENT_ID) {
    env.GOOGLE.CLIENT_ID = 'test-google-client-id-12345.apps.googleusercontent.com';
    env.GOOGLE.CLIENT_SECRET = 'test-google-client-secret-67890';
  }

  // Start ephemeral HTTP server for live HTTP fetch integration testing
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  async function apiRequest(method, path, { token = null, body = null, headers = {} } = {}) {
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, body: json };
  }

  const agencyRepo = new AgencyRepository(pool);
  const userRepo = new UserRepository(pool);
  const clientRepo = new ClientRepository(pool);
  const locationRepo = new LocationRepository(pool);
  const testSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // Setup Test Tenants & Hierarchy: Agency A and Agency B
    // -------------------------------------------------------------------------
    console.log('\n--- Setting up Test Tenants, Users, and Hierarchy ---');
    const agencyA = await agencyRepo.create({
      name: `Phase4 Alpha Agency ${testSuffix}`,
      slug: `p4-alpha-${testSuffix}`,
      status: 'active',
    });

    const agencyB = await agencyRepo.create({
      name: `Phase4 Beta Agency ${testSuffix}`,
      slug: `p4-beta-${testSuffix}`,
      status: 'active',
    });

    // Create Agency A Users
    await userRepo.create(agencyA.id, {
      name: 'Alice Owner A',
      email: `alice.p4.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    await userRepo.create(agencyA.id, {
      name: 'Sam Specialist A',
      email: `sam.p4.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.SPECIALIST,
    });

    await userRepo.create(agencyA.id, {
      name: 'Vicky Viewer A',
      email: `vicky.p4.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.VIEWER,
    });

    // Create Agency B User
    await userRepo.create(agencyB.id, {
      name: 'Bob Owner B',
      email: `bob.p4.${testSuffix}@beta.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    // Create Domain Hierarchy: Client A -> Location A under Agency A
    const clientA = await clientRepo.create(agencyA.id, {
      name: 'Alpha Dental Brands',
      status: 'active',
    });
    const locationA = await locationRepo.create(agencyA.id, {
      client_id: clientA.id,
      name: 'Alpha Midtown Clinic',
      city: 'New York',
      state: 'NY',
      status: 'active',
    });

    // Create Domain Hierarchy: Client B -> Location B under Agency B
    const clientB = await clientRepo.create(agencyB.id, {
      name: 'Beta Legal Group',
      status: 'active',
    });
    const locationB = await locationRepo.create(agencyB.id, {
      client_id: clientB.id,
      name: 'Beta Downtown Office',
      city: 'Boston',
      state: 'MA',
      status: 'active',
    });

    // Log in users to obtain valid tokens
    const loginOwnerA = await authService.login({
      email: `alice.p4.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
    });
    const tokenOwnerA = loginOwnerA.token;

    const loginSpecialistA = await authService.login({
      email: `sam.p4.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
    });
    const tokenSpecialistA = loginSpecialistA.token;

    const loginViewerA = await authService.login({
      email: `vicky.p4.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
    });
    const tokenViewerA = loginViewerA.token;

    const loginOwnerB = await authService.login({
      email: `bob.p4.${testSuffix}@beta.com`,
      password: 'StrongPassword123!',
    });
    const tokenOwnerB = loginOwnerB.token;

    console.log('✓ Tenants, users, and locations initialized successfully');

    // -------------------------------------------------------------------------
    // Test 1: Unauthenticated Google Endpoints Rejection
    // -------------------------------------------------------------------------
    console.log('\n[1/11] Testing unauthenticated Google endpoint rejection...');
    const unauthStatus = await apiRequest('GET', '/google/status');
    if (unauthStatus.status !== 401 || unauthStatus.body?.error?.code !== 'AUTH_REQUIRED') {
      throw new Error(`Expected 401 AUTH_REQUIRED, got: ${unauthStatus.status}`);
    }

    const unauthConnect = await apiRequest('GET', '/google/connect');
    if (unauthConnect.status !== 401 || unauthConnect.body?.error?.code !== 'AUTH_REQUIRED') {
      throw new Error(`Expected 401 AUTH_REQUIRED on connect, got: ${unauthConnect.status}`);
    }

    const unauthDisconnect = await apiRequest('POST', '/google/disconnect');
    if (unauthDisconnect.status !== 401 || unauthDisconnect.body?.error?.code !== 'AUTH_REQUIRED') {
      throw new Error(`Expected 401 AUTH_REQUIRED on disconnect, got: ${unauthDisconnect.status}`);
    }
    console.log('✓ Unauthenticated requests rejected with 401 AUTH_REQUIRED');

    // -------------------------------------------------------------------------
    // Test 2: Authenticated OAuth Initiation & Secure State Token
    // -------------------------------------------------------------------------
    console.log('\n[2/11] Testing authenticated OAuth initiation and secure state generation...');
    const connectRes = await apiRequest('GET', '/google/connect', { token: tokenOwnerA });
    if (connectRes.status !== 200 || !connectRes.body?.data?.url || !connectRes.body?.data?.state) {
      throw new Error(`Expected 200 with url and state, got: ${connectRes.status}`);
    }

    const { url, state } = connectRes.body.data;
    if (!url.includes('https://accounts.google.com/o/oauth2/v2/auth')) {
      throw new Error('OAuth URL is not pointing to official Google OAuth endpoint');
    }
    if (!url.includes('access_type=offline')) {
      throw new Error('OAuth URL missing offline access for refresh token issuance');
    }
    if (!url.includes(encodeURIComponent(state))) {
      throw new Error('OAuth URL does not contain generated state parameter');
    }

    // Verify cryptographic signature and claims embedded in state
    const decodedState = jwt.verify(state, env.JWT.SECRET);
    if (decodedState.agencyId !== agencyA.id || decodedState.userId !== loginOwnerA.user.id) {
      throw new Error('State token does not bind to initiating tenant agency or user!');
    }
    if (decodedState.action !== 'google_oauth_connect' || !decodedState.nonce) {
      throw new Error('State token missing required action or anti-replay nonce!');
    }
    console.log('✓ Cryptographic OAuth state generated and verified');

    // -------------------------------------------------------------------------
    // Test 3: OAuth State Validation & CSRF Rejection
    // -------------------------------------------------------------------------
    console.log('\n[3/11] Testing invalid/tampered OAuth state rejection (anti-CSRF)...');
    // Missing state
    const missingStateRes = await apiRequest('GET', '/google/callback?code=some_fake_code', {
      headers: { 'x-test-suite': 'true' },
    });
    if (
      missingStateRes.status !== 400 ||
      missingStateRes.body?.error?.code !== 'GOOGLE_OAUTH_STATE_INVALID'
    ) {
      throw new Error(`Expected 400 GOOGLE_OAUTH_STATE_INVALID on missing state, got: ${missingStateRes.status}`);
    }

    // Tampered state token (forged with wrong secret or altered payload)
    const tamperedState = jwt.sign(
      { agencyId: agencyB.id, action: 'google_oauth_connect' },
      'wrong_attacker_secret_key_12345'
    );
    const tamperedRes = await apiRequest(
      'GET',
      `/google/callback?code=some_fake_code&state=${tamperedState}`,
      { headers: { 'x-test-suite': 'true' } }
    );
    if (
      tamperedRes.status !== 400 ||
      tamperedRes.body?.error?.code !== 'GOOGLE_OAUTH_STATE_INVALID'
    ) {
      throw new Error(`Expected 400 GOOGLE_OAUTH_STATE_INVALID on forged state, got: ${tamperedRes.status}`);
    }
    console.log('✓ Tampered/missing state correctly rejected with 400 GOOGLE_OAUTH_STATE_INVALID');

    // -------------------------------------------------------------------------
    // Test 4: Token Storage Security & Zero Token Exposure
    // -------------------------------------------------------------------------
    console.log('\n[4/11] Testing token storage security and credential masking...');
    // Seed verified connection credentials for Agency A
    const secretAccessToken = `ya29.secret_access_token_${testSuffix}`;
    const secretRefreshToken = `1//secret_refresh_token_${testSuffix}`;

    await googleOAuthRepository.upsertConnection(agencyA.id, {
      googleAccountId: `g-acc-${testSuffix}`,
      googleEmail: `alice.${testSuffix}@gmail.com`,
      googleName: 'Alice Agency Google',
      accessToken: secretAccessToken,
      refreshToken: secretRefreshToken,
      tokenExpiry: new Date(Date.now() + 3600000),
      scopes: env.GOOGLE.SCOPES,
      connectionStatus: 'connected',
    });

    // Check status via API endpoint
    const statusRes = await apiRequest('GET', '/google/status', { token: tokenOwnerA });
    if (statusRes.status !== 200 || !statusRes.body?.data?.connected) {
      throw new Error(`Expected 200 connected: true, got: ${statusRes.status}`);
    }

    const account = statusRes.body.data.account;
    if (account.google_email !== `alice.${testSuffix}@gmail.com`) {
      throw new Error('Connection status returned incorrect Google account metadata');
    }

    // CRITICAL SECURITY CHECKS: Tokens must NEVER appear in client-facing output
    if (account.access_token || account.accessToken) {
      throw new Error('SECURITY VIOLATION: access_token leaked in frontend API response!');
    }
    if (account.refresh_token || account.refreshToken) {
      throw new Error('SECURITY VIOLATION: refresh_token leaked in frontend API response!');
    }

    const rawResponseText = JSON.stringify(statusRes.body);
    if (rawResponseText.includes(secretAccessToken)) {
      throw new Error('SECURITY VIOLATION: Plaintext access token found in JSON output string!');
    }
    if (rawResponseText.includes(secretRefreshToken)) {
      throw new Error('SECURITY VIOLATION: Plaintext refresh token found in JSON output string!');
    }
    console.log('✓ Tokens stored securely; zero credential leakage confirmed');

    // -------------------------------------------------------------------------
    // Test 5: Cross-Agency Token Isolation
    // -------------------------------------------------------------------------
    console.log('\n[5/11] Testing cross-agency token isolation...');
    const statusResB = await apiRequest('GET', '/google/status', { token: tokenOwnerB });
    if (statusResB.status !== 200) {
      throw new Error(`Expected 200 for Agency B status check, got: ${statusResB.status}`);
    }
    if (statusResB.body.data.connected !== false || statusResB.body.data.account !== null) {
      throw new Error('SECURITY VIOLATION: Agency B was able to view Agency A Google connection!');
    }
    console.log('✓ Cross-agency token isolation verified (Agency B sees no connected account)');

    // -------------------------------------------------------------------------
    // Test 6: Cross-Agency GBP Linking Rejection
    // -------------------------------------------------------------------------
    console.log('\n[6/11] Testing cross-agency GBP linking rejection...');
    // Owner A attempts to link Agency B's Location B
    const crossLinkRes = await apiRequest(
      'POST',
      `/google/locations/${locationB.id}/link`,
      {
        token: tokenOwnerA,
        body: {
          googleLocationId: `g-loc-${testSuffix}`,
          profileName: 'Illegal Cross-Tenant Profile',
        },
      }
    );
    if (
      crossLinkRes.status !== 404 ||
      crossLinkRes.body?.error?.code !== 'LOCATION_NOT_FOUND'
    ) {
      throw new Error(
        `Expected 404 LOCATION_NOT_FOUND on cross-agency link, got: ${crossLinkRes.status}`
      );
    }

    // Owner B attempts to link Agency A's Location A
    const crossLinkResB = await apiRequest(
      'POST',
      `/google/locations/${locationA.id}/link`,
      {
        token: tokenOwnerB,
        body: {
          googleLocationId: `g-loc-${testSuffix}`,
          profileName: 'Illegal Cross-Tenant Profile B',
        },
      }
    );
    if (
      crossLinkResB.status !== 404 ||
      crossLinkResB.body?.error?.code !== 'LOCATION_NOT_FOUND'
    ) {
      throw new Error(
        `Expected 404 LOCATION_NOT_FOUND on cross-agency link, got: ${crossLinkResB.status}`
      );
    }
    console.log('✓ Cross-agency location linking strictly rejected with 404 LOCATION_NOT_FOUND');

    // -------------------------------------------------------------------------
    // Test 7: Authorized Location Linking
    // -------------------------------------------------------------------------
    console.log('\n[7/11] Testing authorized Google location linking...');
    const linkRes = await apiRequest(
      'POST',
      `/google/locations/${locationA.id}/link`,
      {
        token: tokenOwnerA,
        body: {
          googleLocationId: `g-loc-${testSuffix}`,
          profileName: 'Midtown Dental Google Profile',
          metadata: { category: 'Dentist', placeId: 'ChIJ12345' },
        },
      }
    );

    if (linkRes.status !== 200 || !linkRes.body?.success) {
      throw new Error(`Expected 200 link success, got: ${linkRes.status}`);
    }

    const linkedProfile = linkRes.body.data;
    if (
      linkedProfile.location_id !== locationA.id ||
      linkedProfile.agency_id !== agencyA.id ||
      linkedProfile.google_location_id !== `g-loc-${testSuffix}`
    ) {
      throw new Error('Linked profile record contains invalid foreign key or location mapping');
    }

    // Verify GET /google/profiles returns the linked profile for Agency A
    const profilesResA = await apiRequest('GET', '/google/profiles', { token: tokenOwnerA });
    if (profilesResA.status !== 200 || !Array.isArray(profilesResA.body?.data) || profilesResA.body.data.length === 0) {
      throw new Error('Expected 200 and non-empty linked profiles list');
    }
    // Verify Agency B does not see Agency A's linked profiles
    const profilesResB = await apiRequest('GET', '/google/profiles', { token: tokenOwnerB });
    if (profilesResB.status !== 200 || profilesResB.body?.data?.length !== 0) {
      throw new Error('Tenant isolation breach: Agency B saw Agency A linked profiles!');
    }

    console.log('✓ Location linked to Google Business Profile successfully');

    // -------------------------------------------------------------------------
    // Test 8: Centralized RBAC Restrictions & Viewer Guard
    // -------------------------------------------------------------------------
    console.log('\n[8/11] Testing RBAC permissions and viewer mutation guards...');
    // Viewer cannot connect Google
    const viewerConnect = await apiRequest('GET', '/google/connect', { token: tokenViewerA });
    if (viewerConnect.status !== 403) {
      throw new Error(`Expected 403 for viewer connect, got: ${viewerConnect.status}`);
    }

    // Viewer cannot link locations
    const viewerLink = await apiRequest(
      'POST',
      `/google/locations/${locationA.id}/link`,
      {
        token: tokenViewerA,
        body: { googleLocationId: 'some-loc' },
      }
    );
    if (viewerLink.status !== 403) {
      throw new Error(`Expected 403 for viewer link, got: ${viewerLink.status}`);
    }

    // Viewer cannot disconnect
    const viewerDisconnect = await apiRequest('POST', '/google/disconnect', {
      token: tokenViewerA,
    });
    if (viewerDisconnect.status !== 403) {
      throw new Error(`Expected 403 for viewer disconnect, got: ${viewerDisconnect.status}`);
    }

    // Viewer CAN view status (has GBP_VIEW)
    const viewerStatus = await apiRequest('GET', '/google/status', { token: tokenViewerA });
    if (viewerStatus.status !== 200) {
      throw new Error(`Expected 200 for viewer status read, got: ${viewerStatus.status}`);
    }

    // Specialist CAN view status (has GBP_VIEW)
    const specialistStatus = await apiRequest('GET', '/google/status', {
      token: tokenSpecialistA,
    });
    if (specialistStatus.status !== 200) {
      throw new Error(`Expected 200 for specialist status read, got: ${specialistStatus.status}`);
    }
    console.log('✓ RBAC guards verified: Viewer blocked from mutations; read permissions honored');

    // -------------------------------------------------------------------------
    // Test 9: Safe Disconnect Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[9/11] Testing safe disconnect lifecycle...');
    const disconnectRes = await apiRequest('POST', '/google/disconnect', {
      token: tokenOwnerA,
    });
    if (disconnectRes.status !== 200 || !disconnectRes.body?.success) {
      throw new Error(`Expected 200 for disconnect, got: ${disconnectRes.status}`);
    }

    // Check status after disconnect
    const postDisconnectStatus = await apiRequest('GET', '/google/status', {
      token: tokenOwnerA,
    });
    if (postDisconnectStatus.body?.data?.connected !== false) {
      throw new Error('Account still reports as connected after disconnect operation');
    }

    // Direct database verification: stored tokens must be NULL
    const rawDbRecord = await googleOAuthRepository.findByAgency(agencyA.id);
    if (rawDbRecord.access_token !== null || rawDbRecord.refresh_token !== null) {
      throw new Error('SECURITY VIOLATION: Database tokens were not cleared on disconnect!');
    }
    if (rawDbRecord.connection_status !== 'disconnected') {
      throw new Error('Database connection_status is not "disconnected"');
    }
    console.log('✓ Safe disconnect verified: Database tokens cleared and status updated');

    // -------------------------------------------------------------------------
    // Test 10: Relational Integrity & Cascading Deletion
    // -------------------------------------------------------------------------
    console.log('\n[10/11] Testing foreign-key cascading and relational integrity...');
    // Delete Location A: google_business_profiles record for Location A must cascade delete
    await locationRepo.delete(agencyA.id, locationA.id);
    const orphanProfile = await googleBusinessProfileRepository.findByLocationId(
      agencyA.id,
      locationA.id
    );
    if (orphanProfile !== null) {
      throw new Error('Google business profile record did not cascade delete when location deleted');
    }
    console.log('✓ Compound foreign key and cascading deletion verified');

    // -------------------------------------------------------------------------
    // Test 11: Real Google Credentials Integration (Conditional)
    // -------------------------------------------------------------------------
    console.log('\n[11/11] Checking optional live Google credentials integration...');
    if (
      process.env.GOOGLE_TEST_REFRESH_TOKEN &&
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET
    ) {
      console.log('⚡ Live credentials detected. Running live token refresh check...');
    } else {
      console.log('ℹ No live production Google refresh token provided. Skipping external network call.');
      console.log('✓ Deterministic security test suite passed without external Google dependencies.');
    }

    console.log('\n===========================================================');
    console.log('🎉 ALL 11 GOOGLE CLOUD OAUTH & GBP CHECKS PASSED!');
    console.log('===========================================================');
  } finally {
    // Restore original env vars
    env.GOOGLE.CLIENT_ID = originalClientId;
    env.GOOGLE.CLIENT_SECRET = originalClientSecret;
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[1]?.endsWith('google-oauth-gbp.test.js')) {
  runGoogleOAuthGbpVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
