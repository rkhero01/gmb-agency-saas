import http from 'http';
import app from '../app.js';
import { pool, checkDatabaseHealth } from '../config/database.js';
import { AgencyRepository } from '../repositories/agency.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { authService } from '../services/auth.service.js';
import { ROLES } from '../config/permissions.js';

export async function runClientLocationCrudVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 3: Client & Location Management CRUD Tests');
  console.log('===========================================================');

  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error('Database connection required for Phase 3 tests: ' + health.message);
  }

  // Start ephemeral HTTP server for genuine HTTP fetch integration testing
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
  const testSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // Setup Test Tenants: Agency A (multi-role) and Agency B (cross-tenant)
    // -------------------------------------------------------------------------
    console.log('\n--- Setting up Test Tenants and Multi-Role Users ---');
    const agencyA = await agencyRepo.create({
      name: `Phase3 Alpha Agency ${testSuffix}`,
      slug: `p3-alpha-${testSuffix}`,
      status: 'active',
    });

    const agencyB = await agencyRepo.create({
      name: `Phase3 Beta Agency ${testSuffix}`,
      slug: `p3-beta-${testSuffix}`,
      status: 'active',
    });

    // Create Agency A Users
    await userRepo.create(agencyA.id, {
      name: 'Alice Owner',
      email: `alice.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    await userRepo.create(agencyA.id, {
      name: 'Mark Manager',
      email: `mark.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.MANAGER,
    });

    await userRepo.create(agencyA.id, {
      name: 'Sam Specialist',
      email: `sam.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.SPECIALIST,
    });

    await userRepo.create(agencyA.id, {
      name: 'Vicky Viewer',
      email: `vicky.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.VIEWER,
    });

    // Create Agency B User
    await userRepo.create(agencyB.id, {
      name: 'Bob Owner B',
      email: `bob.p3.${testSuffix}@beta.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    // Log in all users to obtain JWTs
    const loginOwnerA = await authService.login({
      email: `alice.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
    });
    const tokenOwnerA = loginOwnerA.token;

    const loginManagerA = await authService.login({
      email: `mark.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
    });
    const tokenManagerA = loginManagerA.token;

    const loginSpecialistA = await authService.login({
      email: `sam.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
    });
    const tokenSpecialistA = loginSpecialistA.token;

    const loginViewerA = await authService.login({
      email: `vicky.p3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
    });
    const tokenViewerA = loginViewerA.token;

    const loginOwnerB = await authService.login({
      email: `bob.p3.${testSuffix}@beta.com`,
      password: 'StrongPassword123!',
    });
    const tokenOwnerB = loginOwnerB.token;

    console.log('✓ Tenants and role tokens initialized successfully');

    // -------------------------------------------------------------------------
    // Test 1: Unauthenticated Request Rejection
    // -------------------------------------------------------------------------
    console.log('\n[1/10] Testing unauthenticated request rejection...');
    const unauthClients = await apiRequest('GET', '/clients');
    if (unauthClients.status !== 401 || unauthClients.body?.error?.code !== 'AUTH_REQUIRED') {
      throw new Error(`Expected 401 AUTH_REQUIRED, got: ${unauthClients.status}`);
    }

    const invalidTokenRes = await apiRequest('GET', '/clients', { token: 'invalid.jwt.token' });
    if (invalidTokenRes.status !== 401 || invalidTokenRes.body?.error?.code !== 'INVALID_TOKEN') {
      throw new Error(`Expected 401 INVALID_TOKEN, got: ${invalidTokenRes.status}`);
    }
    console.log('✓ Unauthenticated and invalid token requests properly rejected (401)');

    // -------------------------------------------------------------------------
    // Test 2: Authenticated Client Creation & Agency ID Anti-Spoofing
    // -------------------------------------------------------------------------
    console.log('\n[2/10] Testing client creation and agency_id anti-spoofing...');
    // Owner A creates client and maliciously passes agency_id = Agency B
    const createClientRes = await apiRequest('POST', '/clients', {
      token: tokenOwnerA,
      body: {
        name: 'Apex Dental Care',
        business_name: 'Apex Dental Care LLC',
        email: 'contact@apexdental.com',
        phone: '+1-555-1000',
        website: 'https://apexdental.com',
        status: 'active',
        agency_id: agencyB.id, // Malicious spoof attempt
      },
    });

    if (createClientRes.status !== 201 || !createClientRes.body?.success) {
      throw new Error(`Expected 201 Created for client, got: ${createClientRes.status}`);
    }

    const clientA = createClientRes.body.data;
    if (clientA.agency_id !== agencyA.id) {
      throw new Error('SECURITY VIOLATION: Client was created under wrong agency!');
    }
    if (clientA.agency_id === agencyB.id) {
      throw new Error('CRITICAL VULNERABILITY: Client allowed agency_id spoofing in payload!');
    }
    console.log('✓ Client created successfully with anti-spoofing enforcement');

    // -------------------------------------------------------------------------
    // Test 3: Client Retrieval & Listing
    // -------------------------------------------------------------------------
    console.log('\n[3/10] Testing client retrieval by ID and listing...');
    const getClientRes = await apiRequest('GET', `/clients/${clientA.id}`, { token: tokenOwnerA });
    if (getClientRes.status !== 200 || getClientRes.body?.data?.id !== clientA.id) {
      throw new Error(`Expected 200 getClientById, got: ${getClientRes.status}`);
    }

    const listClientsRes = await apiRequest('GET', '/clients', { token: tokenOwnerA });
    if (listClientsRes.status !== 200 || !Array.isArray(listClientsRes.body?.data)) {
      throw new Error(`Expected 200 listClients, got: ${listClientsRes.status}`);
    }
    const foundInList = listClientsRes.body.data.some((c) => c.id === clientA.id);
    if (!foundInList) {
      throw new Error('Created client not found in agency client list');
    }
    console.log('✓ Client retrieval and listByAgency verified');

    // -------------------------------------------------------------------------
    // Test 4: Client Partial Update
    // -------------------------------------------------------------------------
    console.log('\n[4/10] Testing client partial update...');
    const updateClientRes = await apiRequest('PATCH', `/clients/${clientA.id}`, {
      token: tokenOwnerA,
      body: {
        business_name: 'Apex Dental Partners Global',
        phone: '+1-555-9999',
      },
    });

    if (updateClientRes.status !== 200 || updateClientRes.body?.data?.phone !== '+1-555-9999') {
      throw new Error(`Expected 200 client update, got: ${updateClientRes.status}`);
    }
    if (updateClientRes.body.data.name !== 'Apex Dental Care') {
      throw new Error('Unmodified fields were altered during partial update');
    }
    console.log('✓ Client partial update verified');

    // -------------------------------------------------------------------------
    // Test 5: Cross-Agency Client Access Rejection
    // -------------------------------------------------------------------------
    console.log('\n[5/10] Testing cross-agency client access rejection...');
    const crossGetClient = await apiRequest('GET', `/clients/${clientA.id}`, { token: tokenOwnerB });
    if (crossGetClient.status !== 404 || crossGetClient.body?.error?.code !== 'CLIENT_NOT_FOUND') {
      throw new Error(`Expected 404 CLIENT_NOT_FOUND for cross-agency get, got: ${crossGetClient.status}`);
    }

    const crossPatchClient = await apiRequest('PATCH', `/clients/${clientA.id}`, {
      token: tokenOwnerB,
      body: { name: 'Hacked Client' },
    });
    if (crossPatchClient.status !== 404 || crossPatchClient.body?.error?.code !== 'CLIENT_NOT_FOUND') {
      throw new Error(`Expected 404 CLIENT_NOT_FOUND for cross-agency update, got: ${crossPatchClient.status}`);
    }

    const crossDeleteClient = await apiRequest('DELETE', `/clients/${clientA.id}`, { token: tokenOwnerB });
    if (crossDeleteClient.status !== 404 || crossDeleteClient.body?.error?.code !== 'CLIENT_NOT_FOUND') {
      throw new Error(`Expected 404 CLIENT_NOT_FOUND for cross-agency delete, got: ${crossDeleteClient.status}`);
    }
    console.log('✓ Cross-agency client access strictly denied with 404 CLIENT_NOT_FOUND');

    // -------------------------------------------------------------------------
    // Test 6: Location Creation under Client & Cross-Agency Client Guard
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Testing location creation and cross-tenant client guard...');
    // Create a client for Agency B first
    const clientBRes = await apiRequest('POST', '/clients', {
      token: tokenOwnerB,
      body: { name: 'Beta Tech Services', status: 'active' },
    });
    const clientB = clientBRes.body.data;

    // Owner A tries to create a location pointing to Agency B's client -> must be rejected 404
    const crossClientLocRes = await apiRequest('POST', `/clients/${clientB.id}/locations`, {
      token: tokenOwnerA,
      body: {
        name: 'Illegal Cross-Tenant Branch',
        city: 'New York',
        state: 'NY',
      },
    });
    if (crossClientLocRes.status !== 404 || crossClientLocRes.body?.error?.code !== 'CLIENT_NOT_FOUND') {
      throw new Error(
        `Expected 404 CLIENT_NOT_FOUND when linking cross-agency client, got: ${crossClientLocRes.status}`
      );
    }

    // Owner A creates location under Client A -> success
    const createLocRes = await apiRequest('POST', `/clients/${clientA.id}/locations`, {
      token: tokenOwnerA,
      body: {
        name: 'Apex Dental Manhattan Clinic',
        address_line1: '500 5th Avenue',
        city: 'New York',
        state: 'NY',
        postal_code: '10110',
        country: 'US',
        timezone: 'America/New_York',
        phone: '+1-212-555-0199',
        status: 'active',
      },
    });

    if (createLocRes.status !== 201 || !createLocRes.body?.success) {
      throw new Error(`Expected 201 Created for location, got: ${createLocRes.status}`);
    }
    const locationA = createLocRes.body.data;
    if (locationA.client_id !== clientA.id || locationA.agency_id !== agencyA.id) {
      throw new Error('Location created with incorrect tenant or client linkage');
    }
    console.log('✓ Location created with cross-tenant client guard verified');

    // -------------------------------------------------------------------------
    // Test 7: Location Listing & Retrieval
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Testing location listing and retrieval by ID...');
    const listLocsRes = await apiRequest('GET', `/clients/${clientA.id}/locations`, { token: tokenOwnerA });
    if (listLocsRes.status !== 200 || !Array.isArray(listLocsRes.body?.data) || listLocsRes.body.data.length === 0) {
      throw new Error(`Expected 200 listLocationsByClient, got: ${listLocsRes.status}`);
    }

    const getLocRes = await apiRequest('GET', `/locations/${locationA.id}`, { token: tokenOwnerA });
    if (getLocRes.status !== 200 || getLocRes.body?.data?.id !== locationA.id) {
      throw new Error(`Expected 200 getLocationById, got: ${getLocRes.status}`);
    }
    console.log('✓ Location listing and retrieval verified');

    // -------------------------------------------------------------------------
    // Test 8: Location Partial Update & Cross-Agency Isolation
    // -------------------------------------------------------------------------
    console.log('\n[8/10] Testing location partial update and cross-agency isolation...');
    const updateLocRes = await apiRequest('PATCH', `/locations/${locationA.id}`, {
      token: tokenOwnerA,
      body: {
        address_line2: 'Floor 18, Suite 1801',
        status: 'pending',
      },
    });

    if (updateLocRes.status !== 200 || updateLocRes.body?.data?.address_line2 !== 'Floor 18, Suite 1801') {
      throw new Error(`Expected 200 location update, got: ${updateLocRes.status}`);
    }

    // Cross-agency attempts by Owner B on Location A
    const crossGetLoc = await apiRequest('GET', `/locations/${locationA.id}`, { token: tokenOwnerB });
    if (crossGetLoc.status !== 404 || crossGetLoc.body?.error?.code !== 'LOCATION_NOT_FOUND') {
      throw new Error(`Expected 404 LOCATION_NOT_FOUND for cross-agency get, got: ${crossGetLoc.status}`);
    }

    const crossPatchLoc = await apiRequest('PATCH', `/locations/${locationA.id}`, {
      token: tokenOwnerB,
      body: { name: 'Hacked Location' },
    });
    if (crossPatchLoc.status !== 404 || crossPatchLoc.body?.error?.code !== 'LOCATION_NOT_FOUND') {
      throw new Error(`Expected 404 LOCATION_NOT_FOUND for cross-agency patch, got: ${crossPatchLoc.status}`);
    }

    const crossDeleteLoc = await apiRequest('DELETE', `/locations/${locationA.id}`, { token: tokenOwnerB });
    if (crossDeleteLoc.status !== 404 || crossDeleteLoc.body?.error?.code !== 'LOCATION_NOT_FOUND') {
      throw new Error(`Expected 404 LOCATION_NOT_FOUND for cross-agency delete, got: ${crossDeleteLoc.status}`);
    }
    console.log('✓ Cross-agency location isolation strictly enforced (404 LOCATION_NOT_FOUND)');

    // -------------------------------------------------------------------------
    // Test 9: RBAC Matrix Restrictions & Viewer Mutation Rejection
    // -------------------------------------------------------------------------
    console.log('\n[9/10] Testing RBAC restrictions and viewer mutation rejection...');
    // 9a. Viewer cannot perform mutations
    const viewerCreateClient = await apiRequest('POST', '/clients', {
      token: tokenViewerA,
      body: { name: 'Viewer Illegal Client' },
    });
    if (viewerCreateClient.status !== 403) {
      throw new Error(`Expected 403 for viewer client creation, got: ${viewerCreateClient.status}`);
    }

    const viewerPatchLoc = await apiRequest('PATCH', `/locations/${locationA.id}`, {
      token: tokenViewerA,
      body: { name: 'Viewer Illegal Update' },
    });
    if (viewerPatchLoc.status !== 403) {
      throw new Error(`Expected 403 for viewer location update, got: ${viewerPatchLoc.status}`);
    }

    // 9b. Specialist cannot create clients or locations, but CAN update location
    const specialistCreateClient = await apiRequest('POST', '/clients', {
      token: tokenSpecialistA,
      body: { name: 'Specialist Illegal Client' },
    });
    if (specialistCreateClient.status !== 403) {
      throw new Error(`Expected 403 for specialist client creation, got: ${specialistCreateClient.status}`);
    }

    const specialistCreateLoc = await apiRequest('POST', `/clients/${clientA.id}/locations`, {
      token: tokenSpecialistA,
      body: { name: 'Specialist Illegal Location' },
    });
    if (specialistCreateLoc.status !== 403) {
      throw new Error(`Expected 403 for specialist location creation, got: ${specialistCreateLoc.status}`);
    }

    const specialistUpdateLoc = await apiRequest('PATCH', `/locations/${locationA.id}`, {
      token: tokenSpecialistA,
      body: { phone: '+1-212-555-7777' },
    });
    if (specialistUpdateLoc.status !== 200) {
      throw new Error(`Expected 200 for specialist location update, got: ${specialistUpdateLoc.status}`);
    }

    // 9c. Manager CAN create location, CANNOT delete client or location
    const managerCreateLoc = await apiRequest('POST', `/clients/${clientA.id}/locations`, {
      token: tokenManagerA,
      body: { name: 'Manager Brooklyn Branch', city: 'Brooklyn', state: 'NY' },
    });
    if (managerCreateLoc.status !== 201) {
      throw new Error(`Expected 201 for manager location creation, got: ${managerCreateLoc.status}`);
    }

    const managerDeleteClient = await apiRequest('DELETE', `/clients/${clientA.id}`, {
      token: tokenManagerA,
    });
    if (managerDeleteClient.status !== 403) {
      throw new Error(`Expected 403 for manager client deletion, got: ${managerDeleteClient.status}`);
    }

    const managerDeleteLoc = await apiRequest('DELETE', `/locations/${locationA.id}`, {
      token: tokenManagerA,
    });
    if (managerDeleteLoc.status !== 403) {
      throw new Error(`Expected 403 for manager location deletion, got: ${managerDeleteLoc.status}`);
    }
    console.log('✓ Centralized RBAC matrix and viewer mutation guards confirmed');

    // -------------------------------------------------------------------------
    // Test 10: Invalid IDs & Deletion Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[10/10] Testing invalid IDs and complete deletion lifecycle...');
    const nonExistentClient = await apiRequest('GET', '/clients/00000000-0000-0000-0000-000000000000', {
      token: tokenOwnerA,
    });
    if (nonExistentClient.status !== 404 || nonExistentClient.body?.error?.code !== 'CLIENT_NOT_FOUND') {
      throw new Error(`Expected 404 for non-existent client, got: ${nonExistentClient.status}`);
    }

    const nonExistentLoc = await apiRequest('GET', '/locations/00000000-0000-0000-0000-000000000000', {
      token: tokenOwnerA,
    });
    if (nonExistentLoc.status !== 404 || nonExistentLoc.body?.error?.code !== 'LOCATION_NOT_FOUND') {
      throw new Error(`Expected 404 for non-existent location, got: ${nonExistentLoc.status}`);
    }

    // Owner deletes location
    const deleteLocRes = await apiRequest('DELETE', `/locations/${locationA.id}`, { token: tokenOwnerA });
    if (deleteLocRes.status !== 200 || !deleteLocRes.body?.success) {
      throw new Error(`Expected 200 location deletion, got: ${deleteLocRes.status}`);
    }

    // Verify location is gone
    const verifyLocDeleted = await apiRequest('GET', `/locations/${locationA.id}`, { token: tokenOwnerA });
    if (verifyLocDeleted.status !== 404) {
      throw new Error('Deleted location still accessible via API');
    }

    // Owner deletes client
    const deleteClientRes = await apiRequest('DELETE', `/clients/${clientA.id}`, { token: tokenOwnerA });
    if (deleteClientRes.status !== 200 || !deleteClientRes.body?.success) {
      throw new Error(`Expected 200 client deletion, got: ${deleteClientRes.status}`);
    }

    // Verify client is gone
    const verifyClientDeleted = await apiRequest('GET', `/clients/${clientA.id}`, { token: tokenOwnerA });
    if (verifyClientDeleted.status !== 404) {
      throw new Error('Deleted client still accessible via API');
    }

    console.log('✓ Invalid IDs and deletion lifecycle verified');

    console.log('\n===========================================================');
    console.log('🎉 ALL 10 CLIENT & LOCATION CRUD API CHECKS PASSED!');
    console.log('===========================================================');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

if (process.argv[1]?.endsWith('client-location-crud.test.js')) {
  runClientLocationCrudVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
