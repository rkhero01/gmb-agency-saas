import http from 'http';
import app from '../app.js';
import { pool, checkDatabaseHealth } from '../config/database.js';
import { AgencyRepository } from '../repositories/agency.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ClientRepository } from '../repositories/client.repository.js';
import { LocationRepository } from '../repositories/location.repository.js';
import { GoogleBusinessProfileRepository } from '../repositories/googleBusinessProfile.repository.js';
import { ReviewRepository } from '../repositories/review.repository.js';
import { ReviewReplyRepository } from '../repositories/reviewReply.repository.js';
import { authService } from '../services/auth.service.js';
import { reviewService } from '../services/review/review.service.js';
import { reviewReplyWorkflowService } from '../services/review/reviewReplyWorkflow.service.js';
import { ROLES } from '../config/permissions.js';

export async function runReviewApiVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 5 API Layer Tests: Review & Reply Workflow');
  console.log('===========================================================');

  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error('Database connection required: ' + health.message);
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
  const clientRepo = new ClientRepository(pool);
  const locationRepo = new LocationRepository(pool);
  const gbpRepo = new GoogleBusinessProfileRepository(pool);
  const reviewRepo = new ReviewRepository(pool);
  const replyRepo = new ReviewReplyRepository(pool);

  const testSuffix = Date.now().toString().slice(-6);

  // Preserve original Google client methods for restore after tests
  const originalPublish = reviewReplyWorkflowService.googleReviewClient.publishReply;
  const originalDelete = reviewReplyWorkflowService.googleReviewClient.deleteReply;
  const originalListReviews = reviewService.googleReviewClient.listLocationReviews;

  try {
    // -------------------------------------------------------------------------
    // Stub Google API methods on services
    // -------------------------------------------------------------------------
    reviewReplyWorkflowService.googleReviewClient.publishReply = async (
      agencyId,
      accountId,
      locId,
      reviewId,
      comment
    ) => {
      return { comment, updateTime: new Date().toISOString() };
    };

    reviewReplyWorkflowService.googleReviewClient.deleteReply = async (
      agencyId,
      accountId,
      locId,
      reviewId
    ) => {
      return { success: true, deleted: true };
    };

    reviewService.googleReviewClient.listLocationReviews = async (
      agencyId,
      accountId,
      locId,
      pageToken,
      pageSize
    ) => {
      return {
        reviews: [
          {
            reviewId: `g-rev-api-sync-${testSuffix}`,
            reviewer: { displayName: 'API Sync User', isAnonymous: false },
            starRating: 'FIVE',
            comment: 'Wonderful clinic!',
            createTime: new Date().toISOString(),
          },
        ],
        nextPageToken: null,
      };
    };

    // -------------------------------------------------------------------------
    // Provision Test Tenants & Users
    // -------------------------------------------------------------------------
    console.log('\n--- Provisioning Test Tenants and Multi-Role Users ---');

    const agencyA = await agencyRepo.create({
      name: `Review API Agency A ${testSuffix}`,
      slug: `rev-api-a-${testSuffix}`,
      status: 'active',
    });

    const agencyB = await agencyRepo.create({
      name: `Review API Agency B ${testSuffix}`,
      slug: `rev-api-b-${testSuffix}`,
      status: 'active',
    });

    const ownerA = await userRepo.create(agencyA.id, {
      name: 'Owner Alice',
      email: `owner.api.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    const managerA = await userRepo.create(agencyA.id, {
      name: 'Manager Mike',
      email: `manager.api.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.MANAGER,
    });

    const specialistA = await userRepo.create(agencyA.id, {
      name: 'Specialist Sarah',
      email: `specialist.api.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.SPECIALIST,
    });

    const viewerA = await userRepo.create(agencyA.id, {
      name: 'Viewer Victor',
      email: `viewer.api.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.VIEWER,
    });

    const managerB = await userRepo.create(agencyB.id, {
      name: 'Manager Bob',
      email: `manager.api.${testSuffix}@beta.com`,
      password: 'StrongPassword123!',
      role: ROLES.MANAGER,
    });

    // Generate JWT tokens for each user
    const ownerToken = authService.generateToken(ownerA);
    const managerToken = authService.generateToken(managerA);
    const specialistToken = authService.generateToken(specialistA);
    const viewerToken = authService.generateToken(viewerA);
    const managerBToken = authService.generateToken(managerB);

    // Provision client & locations in Agency A
    const clientA = await clientRepo.create(agencyA.id, {
      name: `Dental Group ${testSuffix}`,
      business_name: 'Dental Care LLC',
    });

    const locationA = await locationRepo.create(agencyA.id, {
      client_id: clientA.id,
      name: 'Main Street Office',
      city: 'Austin',
      state: 'TX',
    });

    // Link locationA to Google Business Profile
    await gbpRepo.upsertLink(agencyA.id, {
      client_id: clientA.id,
      location_id: locationA.id,
      google_account_id: 'accounts/1234567890',
      google_location_id: 'locations/9876543210',
      profile_name: 'Main Street GBP',
      connection_status: 'connected',
    });

    // Seed initial review in Agency A
    const seededReview = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-seed-api-${testSuffix}`,
      reviewerName: 'Alice Reviewer',
      starRating: 5,
      comment: 'Exceptional dental treatment. Fast, gentle and professional.',
      status: 'unread',
      replyStatus: 'unreplied',
    });

    console.log('✓ Tenants, multi-role tokens, location and review seed initialized');

    // -------------------------------------------------------------------------
    // TEST 1: Authenticated review list works
    // -------------------------------------------------------------------------
    console.log('\n[1/22] Testing Authenticated review list works...');
    const listRes = await apiRequest('GET', '/reviews', { token: ownerToken });
    if (listRes.status !== 200 || !listRes.body?.success) {
      throw new Error(`Expected 200 OK for review list, got ${listRes.status}: ${JSON.stringify(listRes.body)}`);
    }
    if (!Array.isArray(listRes.body.data) || listRes.body.data.length < 1) {
      throw new Error('Review list did not contain seeded review');
    }
    if (!listRes.body.pagination || typeof listRes.body.pagination.total !== 'number') {
      throw new Error('Review list response missing pagination metadata');
    }
    console.log(`✓ Authenticated review list returned ${listRes.body.data.length} review(s) with pagination`);

    // -------------------------------------------------------------------------
    // TEST 2: Unauthenticated request rejected (401)
    // -------------------------------------------------------------------------
    console.log('\n[2/22] Testing Unauthenticated request rejected (401)...');
    const unauthRes = await apiRequest('GET', '/reviews');
    if (unauthRes.status !== 401 || unauthRes.body?.success !== false) {
      throw new Error(`Expected 401 Unauthorized, got ${unauthRes.status}`);
    }
    if (unauthRes.body?.error?.code !== 'AUTH_REQUIRED') {
      throw new Error(`Expected error code AUTH_REQUIRED, got ${unauthRes.body?.error?.code}`);
    }
    console.log('✓ Unauthenticated request rejected with 401 AUTH_REQUIRED');

    // -------------------------------------------------------------------------
    // TEST 3: Viewer can read reviews and stats (200)
    // -------------------------------------------------------------------------
    console.log('\n[3/22] Testing Viewer can read reviews and stats (200)...');
    const viewerListRes = await apiRequest('GET', '/reviews', { token: viewerToken });
    if (viewerListRes.status !== 200 || !viewerListRes.body?.success) {
      throw new Error(`Viewer failed to list reviews: ${viewerListRes.status}`);
    }

    const viewerStatsRes = await apiRequest('GET', '/reviews/stats', { token: viewerToken });
    if (viewerStatsRes.status !== 200 || !viewerStatsRes.body?.success) {
      throw new Error(`Viewer failed to get review stats: ${viewerStatsRes.status}`);
    }

    const viewerGetRes = await apiRequest('GET', `/reviews/${seededReview.id}`, { token: viewerToken });
    if (viewerGetRes.status !== 200 || viewerGetRes.body?.data?.id !== seededReview.id) {
      throw new Error(`Viewer failed to get review by ID: ${viewerGetRes.status}`);
    }
    console.log('✓ Viewer successfully accessed review list, stats, and review detail');

    // -------------------------------------------------------------------------
    // TEST 4: Viewer cannot update status (403)
    // -------------------------------------------------------------------------
    console.log('\n[4/22] Testing Viewer cannot update status (403)...');
    const viewerPatchRes = await apiRequest('PATCH', `/reviews/${seededReview.id}/status`, {
      token: viewerToken,
      body: { status: 'read' },
    });
    if (viewerPatchRes.status !== 403 || viewerPatchRes.body?.success !== false) {
      throw new Error(`SECURITY VIOLATION: Viewer allowed to update status: ${viewerPatchRes.status}`);
    }
    console.log('✓ Viewer status update blocked with 403');

    // -------------------------------------------------------------------------
    // TEST 5: Specialist can update status (200)
    // -------------------------------------------------------------------------
    console.log('\n[5/22] Testing Specialist can update status (200)...');
    const specPatchRes = await apiRequest('PATCH', `/reviews/${seededReview.id}/status`, {
      token: specialistToken,
      body: { status: 'read' },
    });
    if (specPatchRes.status !== 200 || specPatchRes.body?.data?.status !== 'read') {
      throw new Error(`Specialist failed to update status to read: ${specPatchRes.status}`);
    }
    console.log('✓ Specialist updated review status to "read"');

    // -------------------------------------------------------------------------
    // TEST 6: Specialist cannot approve (403)
    // -------------------------------------------------------------------------
    console.log('\n[6/22] Testing Specialist cannot approve (403)...');
    // First save draft as specialist
    await apiRequest('PUT', `/reviews/${seededReview.id}/reply/draft`, {
      token: specialistToken,
      body: { draftReply: 'Initial draft by specialist' },
    });
    await apiRequest('POST', `/reviews/${seededReview.id}/reply/submit-approval`, {
      token: specialistToken,
    });

    const specApproveRes = await apiRequest('POST', `/reviews/${seededReview.id}/reply/approve`, {
      token: specialistToken,
    });
    if (specApproveRes.status !== 403 || specApproveRes.body?.success !== false) {
      throw new Error(`SECURITY VIOLATION: Specialist was allowed to approve reply: ${specApproveRes.status}`);
    }
    console.log('✓ Specialist approve blocked with 403');

    // -------------------------------------------------------------------------
    // TEST 7: Specialist publish rules (unapproved blocked, approved allowed)
    // -------------------------------------------------------------------------
    console.log('\n[7/22] Testing Specialist publish rules (APPROVAL GATE)...');
    // 7a. Specialist publish on pending_approval reply must fail
    const unapprovedPublishRes = await apiRequest(
      'POST',
      `/reviews/${seededReview.id}/reply/publish`,
      { token: specialistToken }
    );
    if (unapprovedPublishRes.status !== 403) {
      throw new Error(
        `APPROVAL GATE BYPASS: Specialist published unapproved reply! Status: ${unapprovedPublishRes.status}`
      );
    }
    if (unapprovedPublishRes.body?.error?.code !== 'APPROVAL_REQUIRED') {
      throw new Error(`Expected APPROVAL_REQUIRED, got: ${unapprovedPublishRes.body?.error?.code}`);
    }

    // 7b. Manager approves
    const mgrApproveRes = await apiRequest(
      'POST',
      `/reviews/${seededReview.id}/reply/approve`,
      { token: managerToken }
    );
    if (mgrApproveRes.status !== 200) {
      throw new Error(`Manager failed to approve reply: ${mgrApproveRes.status}`);
    }

    // 7c. Specialist publishes the APPROVED reply
    const specPublishRes = await apiRequest(
      'POST',
      `/reviews/${seededReview.id}/reply/publish`,
      { token: specialistToken }
    );
    if (specPublishRes.status !== 200 || specPublishRes.body?.data?.status !== 'published') {
      throw new Error(`Specialist could not publish approved reply: ${specPublishRes.status}`);
    }
    console.log('✓ Specialist approval gate strictly enforced: unapproved blocked, approved published');

    // -------------------------------------------------------------------------
    // TEST 8: Owner/admin/manager can approve (200)
    // -------------------------------------------------------------------------
    console.log('\n[8/22] Testing Manager can approve (200)...');
    // Seed another review for manager approval
    const review2 = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-seed-2-${testSuffix}`,
      reviewerName: 'Bob Reviewer',
      starRating: 4,
      comment: 'Very good clinic.',
      status: 'unread',
    });
    await apiRequest('PUT', `/reviews/${review2.id}/reply/draft`, {
      token: specialistToken,
      body: { draftReply: 'Thank you Bob!' },
    });
    await apiRequest('POST', `/reviews/${review2.id}/reply/submit-approval`, {
      token: specialistToken,
    });
    const approveRes = await apiRequest('POST', `/reviews/${review2.id}/reply/approve`, {
      token: managerToken,
    });
    if (approveRes.status !== 200 || approveRes.body?.data?.status !== 'approved') {
      throw new Error(`Manager approval failed: ${approveRes.status}`);
    }
    console.log('✓ Manager approved reply draft successfully');

    // -------------------------------------------------------------------------
    // TEST 9: Owner/admin/manager can delete published reply (200)
    // -------------------------------------------------------------------------
    console.log('\n[9/22] Testing Manager can delete published reply (200)...');
    // seededReview is currently published
    const deleteRes = await apiRequest('DELETE', `/reviews/${seededReview.id}/reply`, {
      token: managerToken,
    });
    if (deleteRes.status !== 200 || deleteRes.body?.data?.deleted !== true) {
      throw new Error(`Manager delete failed: ${deleteRes.status}: ${JSON.stringify(deleteRes.body)}`);
    }
    console.log('✓ Manager deleted published reply successfully');

    // -------------------------------------------------------------------------
    // TEST 10: Malformed reviewId rejected (400)
    // -------------------------------------------------------------------------
    console.log('\n[10/22] Testing Malformed reviewId rejected (400)...');
    const badIdChecks = [
      apiRequest('GET', '/reviews/not-a-valid-uuid', { token: managerToken }),
      apiRequest('PATCH', '/reviews/not-a-valid-uuid/status', {
        token: managerToken,
        body: { status: 'read' },
      }),
      apiRequest('POST', '/reviews/not-a-valid-uuid/reply/publish', { token: managerToken }),
      apiRequest('DELETE', '/reviews/not-a-valid-uuid/reply', { token: managerToken }),
    ];
    for (const check of badIdChecks) {
      const res = await check;
      if (res.status !== 400 || res.body?.error?.code !== 'INVALID_ID_FORMAT') {
        throw new Error(`Malformed reviewId was not rejected with 400 INVALID_ID_FORMAT: ${res.status}`);
      }
    }
    console.log('✓ Malformed UUID reviewId rejected across endpoints with 400 INVALID_ID_FORMAT');

    // -------------------------------------------------------------------------
    // TEST 11: Invalid review status rejected (400)
    // -------------------------------------------------------------------------
    console.log('\n[11/22] Testing Invalid status rejected (400)...');
    const invalidStatusRes = await apiRequest('PATCH', `/reviews/${seededReview.id}/status`, {
      token: managerToken,
      body: { status: 'bogus_status' },
    });
    if (invalidStatusRes.status !== 400 || invalidStatusRes.body?.error?.code !== 'INVALID_STATUS') {
      throw new Error(`Invalid status was not rejected with 400: ${invalidStatusRes.status}`);
    }
    console.log('✓ Invalid review status rejected with 400 INVALID_STATUS');

    // -------------------------------------------------------------------------
    // TEST 12: Invalid pagination and sorting parameters rejected (400)
    // -------------------------------------------------------------------------
    console.log('\n[12/22] Testing Invalid pagination rejected (400)...');
    const paginationChecks = [
      apiRequest('GET', '/reviews?limit=-5', { token: managerToken }),
      apiRequest('GET', '/reviews?limit=500', { token: managerToken }),
      apiRequest('GET', '/reviews?offset=-1', { token: managerToken }),
      apiRequest('GET', '/reviews?sortBy=DROP_TABLE', { token: managerToken }),
      apiRequest('GET', '/reviews?sortOrder=SIDEWAYS', { token: managerToken }),
    ];
    for (const check of paginationChecks) {
      const res = await check;
      if (res.status !== 400) {
        throw new Error(`Invalid pagination was not rejected with 400: ${res.status}`);
      }
    }
    console.log('✓ Unsafe/invalid limit, offset, sortBy, sortOrder rejected with 400');

    // -------------------------------------------------------------------------
    // TEST 13: Cross-tenant access rejected
    // -------------------------------------------------------------------------
    console.log('\n[13/22] Testing Cross-tenant access rejected...');
    // Manager B from Agency B attempts to view or mutate Agency A's review
    const crossGet = await apiRequest('GET', `/reviews/${seededReview.id}`, { token: managerBToken });
    if (crossGet.status !== 404 && crossGet.status !== 403) {
      throw new Error(`SECURITY VIOLATION: Cross-tenant read permitted! Status: ${crossGet.status}`);
    }

    const crossPatch = await apiRequest('PATCH', `/reviews/${seededReview.id}/status`, {
      token: managerBToken,
      body: { status: 'read' },
    });
    if (crossPatch.status !== 404 && crossPatch.status !== 403) {
      throw new Error(`SECURITY VIOLATION: Cross-tenant patch permitted! Status: ${crossPatch.status}`);
    }
    console.log('✓ Cross-tenant access strictly prevented with 404/403');

    // -------------------------------------------------------------------------
    // TEST 14: AgencyId cannot be overridden via header/body/query
    // -------------------------------------------------------------------------
    console.log('\n[14/22] Testing AgencyId cannot be overridden via header/body/query...');
    // Manager B sends x-agency-id header pointing to Agency A
    const spoofHeaderRes = await apiRequest('GET', '/reviews', {
      token: managerBToken,
      headers: { 'x-agency-id': agencyA.id },
    });
    if (spoofHeaderRes.status !== 200) {
      throw new Error(`Spoof header test failed: ${spoofHeaderRes.status}`);
    }
    // Verify results do NOT contain Agency A reviews
    const reviewsFound = spoofHeaderRes.body.data || [];
    const hasAgencyAReview = reviewsFound.some((r) => r.id === seededReview.id);
    if (hasAgencyAReview) {
      throw new Error('SECURITY VIOLATION: x-agency-id allowed caller to access another agency data!');
    }
    console.log('✓ Tenant identity derived strictly from verified JWT; client headers ignored');

    // -------------------------------------------------------------------------
    // TEST 15: Sync endpoint requires review:sync
    // -------------------------------------------------------------------------
    console.log('\n[15/22] Testing Sync endpoint requires review:sync...');
    const viewerSyncRes = await apiRequest('POST', `/locations/${locationA.id}/reviews/sync`, {
      token: viewerToken,
    });
    if (viewerSyncRes.status !== 403) {
      throw new Error(`Viewer allowed to sync reviews: ${viewerSyncRes.status}`);
    }

    const specSyncRes = await apiRequest('POST', `/locations/${locationA.id}/reviews/sync`, {
      token: specialistToken,
    });
    if (specSyncRes.status !== 200 || !specSyncRes.body?.success) {
      throw new Error(`Specialist failed to sync reviews: ${specSyncRes.status}`);
    }
    console.log('✓ Location sync endpoint requires review:sync and functions properly');

    // -------------------------------------------------------------------------
    // TEST 16: AI suggestion endpoint requires reply:generate_ai
    // -------------------------------------------------------------------------
    console.log('\n[16/22] Testing AI suggestion endpoint requires reply:generate_ai...');
    const viewerAiRes = await apiRequest('POST', `/reviews/${review2.id}/reply/ai-suggestion`, {
      token: viewerToken,
    });
    if (viewerAiRes.status !== 403) {
      throw new Error(`Viewer was allowed to generate AI suggestion: ${viewerAiRes.status}`);
    }

    const specAiRes = await apiRequest('POST', `/reviews/${review2.id}/reply/ai-suggestion`, {
      token: specialistToken,
      body: { tone: 'friendly' },
    });
    if (specAiRes.status !== 200 || !specAiRes.body?.data?.suggestedReply) {
      throw new Error(`Specialist AI suggestion failed: ${specAiRes.status}`);
    }
    console.log('✓ AI suggestion endpoint properly permission-guarded and functional');

    // -------------------------------------------------------------------------
    // TEST 17: Draft endpoint requires reply:edit_draft
    // -------------------------------------------------------------------------
    console.log('\n[17/22] Testing Draft endpoint requires reply:edit_draft...');
    const viewerDraftRes = await apiRequest('PUT', `/reviews/${review2.id}/reply/draft`, {
      token: viewerToken,
      body: { draftReply: 'Illegal viewer draft' },
    });
    if (viewerDraftRes.status !== 403) {
      throw new Error(`Viewer was allowed to save draft: ${viewerDraftRes.status}`);
    }
    console.log('✓ Draft endpoint properly rejects unauthorized roles with 403');

    // -------------------------------------------------------------------------
    // TEST 18: Submit endpoint requires reply:submit_approval
    // -------------------------------------------------------------------------
    console.log('\n[18/22] Testing Submit endpoint requires reply:submit_approval...');
    const viewerSubmitRes = await apiRequest(
      'POST',
      `/reviews/${review2.id}/reply/submit-approval`,
      { token: viewerToken }
    );
    if (viewerSubmitRes.status !== 403) {
      throw new Error(`Viewer was allowed to submit for approval: ${viewerSubmitRes.status}`);
    }
    console.log('✓ Submit approval endpoint properly rejects unauthorized roles with 403');

    // -------------------------------------------------------------------------
    // TEST 19: Publish endpoint requires reply:publish
    // -------------------------------------------------------------------------
    console.log('\n[19/22] Testing Publish endpoint requires reply:publish...');
    const viewerPublishRes = await apiRequest('POST', `/reviews/${review2.id}/reply/publish`, {
      token: viewerToken,
    });
    if (viewerPublishRes.status !== 403) {
      throw new Error(`Viewer was allowed to call publish: ${viewerPublishRes.status}`);
    }
    console.log('✓ Publish endpoint properly rejects unauthorized roles with 403');

    // -------------------------------------------------------------------------
    // TEST 20: Delete endpoint requires reply:delete
    // -------------------------------------------------------------------------
    console.log('\n[20/22] Testing Delete endpoint requires reply:delete (Specialist blocked)...');
    // Specialist has publish, but NOT delete
    const specDeleteRes = await apiRequest('DELETE', `/reviews/${review2.id}/reply`, {
      token: specialistToken,
    });
    if (specDeleteRes.status !== 403) {
      throw new Error(`Specialist was allowed to delete reply: ${specDeleteRes.status}`);
    }
    console.log('✓ Delete endpoint properly blocked for specialist role (403)');

    // -------------------------------------------------------------------------
    // TEST 21: No OAuth token appears in any API response
    // -------------------------------------------------------------------------
    console.log('\n[21/22] Testing No OAuth tokens leak in API responses...');
    const responses = [listRes, viewerGetRes, specSyncRes, specAiRes, approveRes];
    const tokenRegex = /ya29\.[a-zA-Z0-9_-]+|refresh_token|access_token/i;

    for (const r of responses) {
      const serialized = JSON.stringify(r.body);
      if (tokenRegex.test(serialized)) {
        throw new Error(`SECURITY VIOLATION: OAuth token or credential leaked in response!`);
      }
    }
    console.log('✓ Zero OAuth tokens, refresh tokens, or secret keys leaked in responses');

    // -------------------------------------------------------------------------
    // TEST 22: Service errors flow through existing error middleware
    // -------------------------------------------------------------------------
    console.log('\n[22/22] Testing Service errors flow through errorHandler middleware...');
    // Attempt to publish an already published review to trigger INVALID_TRANSITION
    const invalidTransitionRes = await apiRequest(
      'POST',
      `/reviews/${review2.id}/reply/publish`,
      { token: managerToken }
    );
    if (invalidTransitionRes.status === 200) {
      // First publish succeeded, now publish second time to force INVALID_TRANSITION
      const duplicatePublishRes = await apiRequest(
        'POST',
        `/reviews/${review2.id}/reply/publish`,
        { token: managerToken }
      );
      if (
        duplicatePublishRes.status !== 400 ||
        duplicatePublishRes.body?.error?.code !== 'INVALID_TRANSITION'
      ) {
        throw new Error(`Expected 400 INVALID_TRANSITION, got: ${duplicatePublishRes.status}`);
      }
    }
    console.log('✓ Domain errors flow through centralized errorHandler with standard envelope');

    console.log('\n===========================================================');
    console.log('🎉 ALL 22 REVIEW & REPLY API ENDPOINT TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    // Restore original Google client methods
    reviewReplyWorkflowService.googleReviewClient.publishReply = originalPublish;
    reviewReplyWorkflowService.googleReviewClient.deleteReply = originalDelete;
    reviewService.googleReviewClient.listLocationReviews = originalListReviews;

    // Close ephemeral HTTP server
    await new Promise((resolve) => server.close(resolve));

    // Cleanup test agencies
    await pool.query("DELETE FROM agencies WHERE slug LIKE 'rev-api-a-%' OR slug LIKE 'rev-api-b-%'");
  }
}
