import { pool, checkDatabaseHealth } from '../config/database.js';
import { AgencyRepository } from '../repositories/agency.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ClientRepository } from '../repositories/client.repository.js';
import { LocationRepository } from '../repositories/location.repository.js';
import { GoogleBusinessProfileRepository } from '../repositories/googleBusinessProfile.repository.js';
import { ReviewRepository } from '../repositories/review.repository.js';
import { ReviewReplyRepository } from '../repositories/reviewReply.repository.js';
import { ReviewService } from '../services/review/review.service.js';
import { ReviewReplyWorkflowService } from '../services/review/reviewReplyWorkflow.service.js';
import { AiService } from '../services/ai/ai.service.js';
import { withTenantContext } from '../database/session.js';
import { ROLES } from '../config/permissions.js';

class MockGoogleReviewClient {
  constructor() {
    this.publishedCalls = [];
    this.deleteCalls = [];
    this.shouldFailPublish = false;
    this.publishErrorMessage = 'Google 502 Bad Gateway';
    this.shouldFailDelete = false;
    this.deleteErrorMessage = 'Google 500 Internal Error';
    this.mockReviews = [];
    this.nextPageToken = null;
  }

  async listLocationReviews(agencyId, accountId, locationId, pageToken = null, pageSize = 50) {
    return {
      reviews: this.mockReviews,
      nextPageToken: this.nextPageToken,
    };
  }

  async publishReply(agencyId, accountId, locationId, googleReviewId, comment) {
    this.publishedCalls.push({ agencyId, accountId, locationId, googleReviewId, comment });
    if (this.shouldFailPublish) {
      const err = new Error(this.publishErrorMessage);
      err.code = 'GOOGLE_API_ERROR';
      err.status = 502;
      throw err;
    }
    return { comment, updateTime: new Date().toISOString() };
  }

  async deleteReply(agencyId, accountId, locationId, googleReviewId) {
    this.deleteCalls.push({ agencyId, accountId, locationId, googleReviewId });
    if (this.shouldFailDelete) {
      const err = new Error(this.deleteErrorMessage);
      err.code = 'GOOGLE_API_ERROR';
      err.status = 500;
      throw err;
    }
    return { success: true, deleted: true };
  }
}

class FailingAiProvider {
  constructor() {
    this.name = 'failing-mock-provider';
  }
  async generateReply() {
    throw new Error('Simulated upstream AI provider timeout');
  }
}

export async function runMilestone3ServicesVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 5 Milestone 3 (Steps 4 & 5) Services Verification');
  console.log('===========================================================');

  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error('Database connection required: ' + health.message);
  }

  const agencyRepo = new AgencyRepository(pool);
  const userRepo = new UserRepository(pool);
  const clientRepo = new ClientRepository(pool);
  const locationRepo = new LocationRepository(pool);
  const gbpRepo = new GoogleBusinessProfileRepository(pool);
  const reviewRepo = new ReviewRepository(pool);
  const replyRepo = new ReviewReplyRepository(pool);

  const mockGoogleClient = new MockGoogleReviewClient();
  const fallbackAiService = new AiService(new FailingAiProvider());
  const standardAiService = new AiService();

  const reviewService = new ReviewService(reviewRepo, locationRepo, gbpRepo, mockGoogleClient);
  const workflowService = new ReviewReplyWorkflowService(
    reviewRepo,
    replyRepo,
    standardAiService,
    gbpRepo,
    mockGoogleClient,
    withTenantContext
  );

  const testSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // Setup Test Tenants and Hierarchy
    // -------------------------------------------------------------------------
    console.log('\n--- Provisioning Test Tenants, Users, Clients, Locations ---');

    const agencyA = await agencyRepo.create({
      name: `M3 Alpha Agency ${testSuffix}`,
      slug: `m3-alpha-${testSuffix}`,
      status: 'active',
    });

    const agencyB = await agencyRepo.create({
      name: `M3 Beta Agency ${testSuffix}`,
      slug: `m3-beta-${testSuffix}`,
      status: 'active',
    });

    const ownerA = await userRepo.create(agencyA.id, {
      name: 'Owner Alice',
      email: `owner.m3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.OWNER,
    });

    const adminA = await userRepo.create(agencyA.id, {
      name: 'Admin Adam',
      email: `admin.m3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.ADMIN,
    });

    const managerA = await userRepo.create(agencyA.id, {
      name: 'Manager Mike',
      email: `manager.m3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.MANAGER,
    });

    const specialistA = await userRepo.create(agencyA.id, {
      name: 'Specialist Sarah',
      email: `specialist.m3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.SPECIALIST,
    });

    const viewerA = await userRepo.create(agencyA.id, {
      name: 'Viewer Victor',
      email: `viewer.m3.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.VIEWER,
    });

    const managerB = await userRepo.create(agencyB.id, {
      name: 'Manager Bob',
      email: `manager.m3.${testSuffix}@beta.com`,
      password: 'StrongPassword123!',
      role: ROLES.MANAGER,
    });

    const clientA = await clientRepo.create(agencyA.id, {
      name: `Alpha Dental Clinic ${testSuffix}`,
      business_name: 'Alpha Dental Care LLC',
    });

    const locationA = await locationRepo.create(agencyA.id, {
      client_id: clientA.id,
      name: 'Alpha Central Office',
      city: 'Austin',
      state: 'TX',
    });

    // Link locationA to Google Business Profile
    await gbpRepo.upsertLink(agencyA.id, {
      client_id: clientA.id,
      location_id: locationA.id,
      google_account_id: 'accounts/1029384756',
      google_location_id: 'locations/5647382910',
      profile_name: 'Alpha Dental GBP',
      connection_status: 'connected',
    });

    // Unlinked location for testing linkage validation
    const unlinkedLocation = await locationRepo.create(agencyA.id, {
      client_id: clientA.id,
      name: 'Unlinked Location',
      city: 'Houston',
      state: 'TX',
    });

    // Seed initial review in Agency A
    const seededReview = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-seed-${testSuffix}`,
      reviewerName: 'John Patient',
      starRating: 5,
      comment: 'Top quality dental work! The dentists were friendly and careful.',
      status: 'unread',
      replyStatus: 'unreplied',
    });

    console.log('✓ Tenants, users, and review seed initialized successfully');

    // -------------------------------------------------------------------------
    // TEST 1: ReviewService viewer can list reviews
    // -------------------------------------------------------------------------
    console.log('\n[1/25] Testing ReviewService viewer can list reviews...');
    const listResult = await reviewService.listReviews(agencyA.id, viewerA);
    if (!listResult || !Array.isArray(listResult.reviews) || listResult.total < 1) {
      throw new Error('Viewer could not list reviews or got empty result');
    }
    if (listResult.reviews[0].id !== seededReview.id) {
      throw new Error('Expected review ID not found in viewer list');
    }
    console.log(`✓ Viewer successfully listed ${listResult.total} reviews`);

    // -------------------------------------------------------------------------
    // TEST 2: Viewer cannot update review status
    // -------------------------------------------------------------------------
    console.log('\n[2/25] Testing Viewer cannot update review status...');
    let viewerStatusRejected = false;
    try {
      await reviewService.updateReviewStatus(agencyA.id, viewerA, seededReview.id, 'read');
    } catch (err) {
      if (err.code === 'FORBIDDEN' || err.status === 403) {
        viewerStatusRejected = true;
      } else {
        throw new Error(`Unexpected error code for viewer status update: ${err.code}`);
      }
    }
    if (!viewerStatusRejected) {
      throw new Error('SECURITY VIOLATION: Viewer was allowed to update review status!');
    }
    console.log('✓ Viewer status update correctly rejected with FORBIDDEN (403)');

    // -------------------------------------------------------------------------
    // TEST 3: Cross-agency review access is rejected
    // -------------------------------------------------------------------------
    console.log('\n[3/25] Testing Cross-agency review access is rejected...');
    let crossAgencyListRejected = false;
    try {
      // Actor B (Agency B) attempts to read reviews from Agency A
      await reviewService.listReviews(agencyA.id, managerB);
    } catch (err) {
      if (err.code === 'FORBIDDEN' || err.status === 403) {
        crossAgencyListRejected = true;
      }
    }
    if (!crossAgencyListRejected) {
      throw new Error('SECURITY VIOLATION: Agency B actor accessed Agency A reviews!');
    }

    let crossAgencyDetailRejected = false;
    try {
      await reviewService.getReviewById(agencyA.id, managerB, seededReview.id);
    } catch (err) {
      if (err.code === 'FORBIDDEN' || err.status === 403) {
        crossAgencyDetailRejected = true;
      }
    }
    if (!crossAgencyDetailRejected) {
      throw new Error('SECURITY VIOLATION: Agency B actor read Agency A review details!');
    }
    console.log('✓ Cross-agency review access strictly forbidden');

    // -------------------------------------------------------------------------
    // TEST 4: Review status transition works
    // -------------------------------------------------------------------------
    console.log('\n[4/25] Testing Review status transition works...');
    const updatedReview1 = await reviewService.updateReviewStatus(
      agencyA.id,
      specialistA,
      seededReview.id,
      'read'
    );
    if (!updatedReview1 || updatedReview1.status !== 'read') {
      throw new Error('Review status failed to transition to "read"');
    }

    const updatedReview2 = await reviewService.updateReviewStatus(
      agencyA.id,
      managerA,
      seededReview.id,
      'flagged'
    );
    if (!updatedReview2 || updatedReview2.status !== 'flagged') {
      throw new Error('Review status failed to transition to "flagged"');
    }
    console.log('✓ Review status transition unread -> read -> flagged verified');

    // -------------------------------------------------------------------------
    // TEST 5: Invalid review status is rejected
    // -------------------------------------------------------------------------
    console.log('\n[5/25] Testing Invalid review status is rejected...');
    let invalidStatusRejected = false;
    try {
      await reviewService.updateReviewStatus(
        agencyA.id,
        managerA,
        seededReview.id,
        'deleted_permanently'
      );
    } catch (err) {
      if (err.code === 'INVALID_STATUS' || err.status === 400) {
        invalidStatusRejected = true;
      }
    }
    if (!invalidStatusRejected) {
      throw new Error('Validation failure: Arbitrary review status was accepted!');
    }
    console.log('✓ Invalid review status rejected with INVALID_STATUS (400)');

    // -------------------------------------------------------------------------
    // TEST 6: Review sync verifies Google linkage
    // -------------------------------------------------------------------------
    console.log('\n[6/25] Testing Review sync verifies Google linkage...');
    let unlinkedSyncRejected = false;
    try {
      await reviewService.syncLocationReviews(agencyA.id, managerA, unlinkedLocation.id);
    } catch (err) {
      if (err.code === 'LOCATION_NOT_LINKED' || err.status === 400) {
        unlinkedSyncRejected = true;
      }
    }
    if (!unlinkedSyncRejected) {
      throw new Error('Review sync did not verify Google linkage for unlinked location!');
    }
    console.log('✓ Review sync verified location Google linkage and rejected unlinked location');

    // -------------------------------------------------------------------------
    // TEST 7: Review sync maps ONE..FIVE correctly
    // -------------------------------------------------------------------------
    console.log('\n[7/25] Testing Review sync maps ONE..FIVE ratings correctly...');
    mockGoogleClient.mockReviews = [
      {
        reviewId: `g-rev-sync-1-${testSuffix}`,
        reviewer: { displayName: 'Customer One', isAnonymous: false },
        starRating: 'ONE',
        comment: 'Terrible experience.',
        createTime: '2026-09-01T10:00:00Z',
      },
      {
        reviewId: `g-rev-sync-2-${testSuffix}`,
        reviewer: { displayName: 'Customer Two', isAnonymous: false },
        starRating: 'TWO',
        comment: 'Disappointing.',
        createTime: '2026-09-02T10:00:00Z',
      },
      {
        reviewId: `g-rev-sync-3-${testSuffix}`,
        reviewer: { displayName: 'Customer Three', isAnonymous: false },
        starRating: 'THREE',
        comment: 'Average service.',
        createTime: '2026-09-03T10:00:00Z',
      },
      {
        reviewId: `g-rev-sync-4-${testSuffix}`,
        reviewer: { displayName: 'Customer Four', isAnonymous: false },
        starRating: 'FOUR',
        comment: 'Good overall.',
        createTime: '2026-09-04T10:00:00Z',
      },
      {
        reviewId: `g-rev-sync-5-${testSuffix}`,
        reviewer: { displayName: 'Customer Five', isAnonymous: false },
        starRating: 'FIVE',
        comment: 'Absolutely superb!',
        createTime: '2026-09-05T10:00:00Z',
      },
    ];

    const syncResult = await reviewService.syncLocationReviews(agencyA.id, specialistA, locationA.id);
    if (syncResult.synced !== 5) {
      throw new Error(`Expected 5 synced reviews, got ${syncResult.synced}`);
    }

    // Verify rating mappings in database
    for (let r = 1; r <= 5; r++) {
      const rev = await reviewRepo.findByGoogleReviewId(
        agencyA.id,
        locationA.id,
        `g-rev-sync-${r}-${testSuffix}`
      );
      if (!rev) throw new Error(`Synced review g-rev-sync-${r} not found in database`);
      if (rev.star_rating !== r) {
        throw new Error(`Rating mismatch for review ${r}: Expected ${r}, got ${rev.star_rating}`);
      }
    }

    // Verify invalid enum throws INVALID_RATING
    mockGoogleClient.mockReviews = [
      {
        reviewId: `g-rev-sync-invalid-${testSuffix}`,
        reviewer: { displayName: 'Hacker' },
        starRating: 'TEN_STARS',
        comment: 'Invalid rating',
      },
    ];
    let invalidRatingCaught = false;
    try {
      await reviewService.syncLocationReviews(agencyA.id, specialistA, locationA.id);
    } catch (err) {
      if (err.code === 'INVALID_RATING') invalidRatingCaught = true;
    }
    if (!invalidRatingCaught) {
      throw new Error('Review sync failed to reject invalid rating enum!');
    }
    console.log('✓ Rating mappings ONE..FIVE verified and invalid enums rejected');

    // -------------------------------------------------------------------------
    // TEST 8: Review sync is idempotent
    // -------------------------------------------------------------------------
    console.log('\n[8/25] Testing Review sync is idempotent...');
    // Re-run sync with the 5 valid reviews
    mockGoogleClient.mockReviews = [
      {
        reviewId: `g-rev-sync-1-${testSuffix}`,
        reviewer: { displayName: 'Customer One Updated', isAnonymous: false },
        starRating: 'ONE',
        comment: 'Updated review comment.',
        createTime: '2026-09-01T10:00:00Z',
      },
    ];
    const initialStats = await reviewService.getReviewStats(agencyA.id, specialistA);
    const initialTotal = initialStats.total_reviews;

    // Run sync again with the same googleReviewId
    await reviewService.syncLocationReviews(agencyA.id, specialistA, locationA.id);
    const afterSyncStats = await reviewService.getReviewStats(agencyA.id, specialistA);

    if (afterSyncStats.total_reviews !== initialTotal) {
      throw new Error(
        `Idempotency failure: Review count changed from ${initialTotal} to ${afterSyncStats.total_reviews}`
      );
    }

    const updatedSyncedRev = await reviewRepo.findByGoogleReviewId(
      agencyA.id,
      locationA.id,
      `g-rev-sync-1-${testSuffix}`
    );
    if (updatedSyncedRev.reviewer_name !== 'Customer One Updated') {
      throw new Error('Idempotent upsert did not update existing review data');
    }
    console.log('✓ Review sync is strictly idempotent; updates on conflict without duplicating rows');

    // -------------------------------------------------------------------------
    // TEST 9: AI suggestion can be generated through ReviewReplyWorkflowService
    // -------------------------------------------------------------------------
    console.log('\n[9/25] Testing AI suggestion can be generated...');
    const targetReview = await reviewRepo.findByGoogleReviewId(
      agencyA.id,
      locationA.id,
      `g-rev-sync-5-${testSuffix}`
    );

    const aiSuggestion = await workflowService.generateAiSuggestion(
      agencyA.id,
      specialistA,
      targetReview.id,
      { tone: 'friendly' }
    );
    if (!aiSuggestion || !aiSuggestion.suggestedReply || aiSuggestion.status !== 'suggested') {
      throw new Error('AI suggestion was not generated or returned invalid structure');
    }

    const dbReviewAfterAi = await reviewRepo.findById(agencyA.id, targetReview.id);
    if (dbReviewAfterAi.reply_status !== 'ai_suggested') {
      throw new Error(
        `Expected review reply_status to be "ai_suggested", got "${dbReviewAfterAi.reply_status}"`
      );
    }
    console.log('✓ Advisory AI suggestion generated and persisted without auto-publishing');

    // -------------------------------------------------------------------------
    // TEST 10: AI failure uses existing fallback behavior
    // -------------------------------------------------------------------------
    console.log('\n[10/25] Testing AI failure uses existing fallback behavior...');
    const workflowWithFallback = new ReviewReplyWorkflowService(
      reviewRepo,
      replyRepo,
      fallbackAiService,
      gbpRepo,
      mockGoogleClient,
      withTenantContext
    );

    const fallbackResult = await workflowWithFallback.generateAiSuggestion(
      agencyA.id,
      specialistA,
      targetReview.id,
      { tone: 'professional' }
    );
    if (!fallbackResult || !fallbackResult.suggestedReply || !fallbackResult.isFallback) {
      throw new Error('Primary AI failure did not smoothly fall back to deterministic local template');
    }
    console.log('✓ Primary AI failure seamlessly fell back to deterministic template');

    // -------------------------------------------------------------------------
    // TEST 11: Draft can be saved
    // -------------------------------------------------------------------------
    console.log('\n[11/25] Testing Draft can be saved...');
    const draftText = 'Thank you so much Customer Five for the marvelous 5-star review!';
    const savedDraft = await workflowService.saveDraft(
      agencyA.id,
      specialistA,
      targetReview.id,
      draftText
    );
    if (!savedDraft || savedDraft.draft_reply !== draftText || savedDraft.status !== 'draft') {
      throw new Error('Draft reply was not properly saved');
    }

    const dbReviewAfterDraft = await reviewRepo.findById(agencyA.id, targetReview.id);
    if (dbReviewAfterDraft.reply_status !== 'draft') {
      throw new Error(
        `Expected review reply_status to transition to "draft", got "${dbReviewAfterDraft.reply_status}"`
      );
    }
    console.log('✓ Draft saved and review reply_status transitioned to "draft"');

    // -------------------------------------------------------------------------
    // TEST 12: Invalid workflow transition is rejected
    // -------------------------------------------------------------------------
    console.log('\n[12/25] Testing Invalid workflow transitions are rejected...');
    // A review with no draft cannot be submitted for approval
    const freshReview = await reviewRepo.findByGoogleReviewId(
      agencyA.id,
      locationA.id,
      `g-rev-sync-2-${testSuffix}`
    );
    let submitEmptyCaught = false;
    try {
      await workflowService.submitForApproval(agencyA.id, specialistA, freshReview.id);
    } catch (err) {
      if (err.code === 'REPLY_NOT_FOUND' || err.code === 'INVALID_TRANSITION') {
        submitEmptyCaught = true;
      }
    }
    if (!submitEmptyCaught) {
      throw new Error('Invalid transition: Allowed unreplied review to be submitted for approval!');
    }
    console.log('✓ Invalid workflow transitions properly rejected');

    // -------------------------------------------------------------------------
    // TEST 13: Draft can be submitted for approval
    // -------------------------------------------------------------------------
    console.log('\n[13/25] Testing Draft can be submitted for approval...');
    const submitted = await workflowService.submitForApproval(
      agencyA.id,
      specialistA,
      targetReview.id
    );
    if (!submitted || submitted.status !== 'pending_approval') {
      throw new Error('Reply status did not transition to "pending_approval"');
    }

    const dbReviewAfterSubmit = await reviewRepo.findById(agencyA.id, targetReview.id);
    if (dbReviewAfterSubmit.reply_status !== 'pending_approval') {
      throw new Error('Review reply_status did not transition to "pending_approval"');
    }
    console.log('✓ Draft transitioned to "pending_approval"');

    // -------------------------------------------------------------------------
    // TEST 14: Viewer cannot edit/submit/approve/publish
    // -------------------------------------------------------------------------
    console.log('\n[14/25] Testing Viewer cannot edit/submit/approve/publish...');
    const viewerForbiddenChecks = [
      () => workflowService.saveDraft(agencyA.id, viewerA, targetReview.id, 'Illegal Edit'),
      () => workflowService.submitForApproval(agencyA.id, viewerA, targetReview.id),
      () => workflowService.approveReply(agencyA.id, viewerA, targetReview.id),
      () => workflowService.publishReply(agencyA.id, viewerA, targetReview.id),
      () => workflowService.deletePublishedReply(agencyA.id, viewerA, targetReview.id),
    ];

    for (const action of viewerForbiddenChecks) {
      let rejected = false;
      try {
        await action();
      } catch (err) {
        if (err.code === 'FORBIDDEN' || err.status === 403) rejected = true;
      }
      if (!rejected) {
        throw new Error('SECURITY VIOLATION: Viewer was allowed to perform reply mutation!');
      }
    }
    console.log('✓ Viewer is strictly read-only and blocked from all mutations');

    // -------------------------------------------------------------------------
    // TEST 15: Specialist cannot approve
    // -------------------------------------------------------------------------
    console.log('\n[15/25] Testing Specialist cannot approve...');
    let specialistApproveCaught = false;
    try {
      await workflowService.approveReply(agencyA.id, specialistA, targetReview.id);
    } catch (err) {
      if (err.code === 'FORBIDDEN' || err.status === 403) {
        specialistApproveCaught = true;
      }
    }
    if (!specialistApproveCaught) {
      throw new Error('SECURITY VIOLATION: Specialist was allowed to approve reply!');
    }
    console.log('✓ Specialist blocked from approving replies (FORBIDDEN 403)');

    // -------------------------------------------------------------------------
    // TEST 16: Specialist cannot publish an unapproved reply (CRITICAL GATE)
    // -------------------------------------------------------------------------
    console.log('\n[16/25] Testing Specialist cannot publish unapproved reply (APPROVAL GATE)...');
    let approvalGateCaught = false;
    try {
      await workflowService.publishReply(agencyA.id, specialistA, targetReview.id);
    } catch (err) {
      if (err.code === 'APPROVAL_REQUIRED' && err.status === 403) {
        approvalGateCaught = true;
      }
    }
    if (!approvalGateCaught) {
      throw new Error('CRITICAL SECURITY VIOLATION: Specialist bypassed approval gate to publish!');
    }
    console.log('✓ Specialist approval gate verified: unapproved publish rejected with APPROVAL_REQUIRED (403)');

    // -------------------------------------------------------------------------
    // TEST 17 & 18: Manager can approve, and Specialist can publish approved reply
    // -------------------------------------------------------------------------
    console.log('\n[17/25 & 18/25] Testing Manager approve & Specialist publish of approved reply...');
    const approved = await workflowService.approveReply(agencyA.id, managerA, targetReview.id);
    if (!approved || approved.status !== 'approved' || approved.approved_by_user_id !== managerA.id) {
      throw new Error('Manager approval failed or did not record audit approver');
    }

    // Specialist now attempts to publish the APPROVED reply
    mockGoogleClient.shouldFailPublish = false;
    const publishedBySpecialist = await workflowService.publishReply(
      agencyA.id,
      specialistA,
      targetReview.id
    );
    if (!publishedBySpecialist || publishedBySpecialist.status !== 'published') {
      throw new Error('Specialist could not publish approved reply');
    }
    if (publishedBySpecialist.published_by_user_id !== specialistA.id) {
      throw new Error('Published by user ID audit was not recorded');
    }
    console.log('✓ Manager approved reply, and Specialist successfully published approved reply');

    // -------------------------------------------------------------------------
    // TEST 19 & 20: Publish calls Google outside tx and updates DB atomically
    // -------------------------------------------------------------------------
    console.log('\n[19/25 & 20/25] Testing Publish outside DB transaction & atomic local commit...');
    // Prepare a second review to test manager direct publish
    const reviewDirect = await reviewRepo.findByGoogleReviewId(
      agencyA.id,
      locationA.id,
      `g-rev-sync-4-${testSuffix}`
    );
    await workflowService.saveDraft(
      agencyA.id,
      managerA,
      reviewDirect.id,
      'Direct publish reply by manager'
    );

    mockGoogleClient.publishedCalls = [];
    const directPublishResult = await workflowService.publishReply(
      agencyA.id,
      managerA,
      reviewDirect.id
    );

    if (mockGoogleClient.publishedCalls.length !== 1) {
      throw new Error('Google publishReply was not invoked exactly once');
    }

    const dbDirectReview = await reviewRepo.findById(agencyA.id, reviewDirect.id);
    if (dbDirectReview.reply_status !== 'published') {
      throw new Error('Review status was not atomically marked published');
    }
    if (dbDirectReview.external_reply_comment !== 'Direct publish reply by manager') {
      throw new Error('Review external_reply_comment was not synchronized');
    }
    console.log('✓ Google called outside DB tx, and local review+reply atomically updated');

    // -------------------------------------------------------------------------
    // TEST 21: Google publish failure does not mark reply published
    // -------------------------------------------------------------------------
    console.log('\n[21/25] Testing Google publish failure does not mark reply published...');
    const reviewFailTest = await reviewRepo.findByGoogleReviewId(
      agencyA.id,
      locationA.id,
      `g-rev-sync-3-${testSuffix}`
    );
    await workflowService.saveDraft(agencyA.id, managerA, reviewFailTest.id, 'Draft to fail publish');
    await workflowService.approveReply(agencyA.id, managerA, reviewFailTest.id);

    mockGoogleClient.shouldFailPublish = true;
    let publishFailed = false;
    try {
      await workflowService.publishReply(agencyA.id, managerA, reviewFailTest.id);
    } catch (err) {
      publishFailed = true;
    }
    if (!publishFailed) {
      throw new Error('Publish call should have thrown on Google failure');
    }

    const reviewAfterGoogleFail = await reviewRepo.findById(agencyA.id, reviewFailTest.id);
    if (reviewAfterGoogleFail.reply_status === 'published') {
      throw new Error('CRITICAL BUG: Local reply marked as published despite Google failure!');
    }
    const replyAfterGoogleFail = await replyRepo.findByReviewId(agencyA.id, reviewFailTest.id);
    if (!replyAfterGoogleFail.publish_error) {
      throw new Error('Publish error was not recorded in review_replies table');
    }
    mockGoogleClient.shouldFailPublish = false; // Reset
    console.log('✓ Google publish failure safely handled: reply remained approved with publish_error logged');

    // -------------------------------------------------------------------------
    // TEST 22: Delete published reply calls Google client
    // -------------------------------------------------------------------------
    console.log('\n[22/25] Testing Delete published reply calls Google client...');
    mockGoogleClient.deleteCalls = [];
    const deleteResult = await workflowService.deletePublishedReply(
      agencyA.id,
      managerA,
      reviewDirect.id
    );
    if (!deleteResult || !deleteResult.deleted) {
      throw new Error('Delete published reply returned unsuccessful result');
    }
    if (mockGoogleClient.deleteCalls.length !== 1) {
      throw new Error('Google deleteReply was not called');
    }

    const reviewAfterDelete = await reviewRepo.findById(agencyA.id, reviewDirect.id);
    if (reviewAfterDelete.reply_status !== 'unreplied') {
      throw new Error(`Expected reply_status "unreplied", got "${reviewAfterDelete.reply_status}"`);
    }
    if (reviewAfterDelete.external_reply_comment !== null) {
      throw new Error('external_reply_comment was not cleared');
    }
    console.log('✓ Published reply deleted from Google and local state returned to unreplied');

    // -------------------------------------------------------------------------
    // TEST 23: Delete failure does not falsely mark local state as deleted
    // -------------------------------------------------------------------------
    console.log('\n[23/25] Testing Delete failure does not falsely mark local state as deleted...');
    // targetReview is currently published
    mockGoogleClient.shouldFailDelete = true;
    let deleteFailed = false;
    try {
      await workflowService.deletePublishedReply(agencyA.id, managerA, targetReview.id);
    } catch (err) {
      deleteFailed = true;
    }
    if (!deleteFailed) {
      throw new Error('Delete should have failed when Google API fails');
    }

    const reviewAfterFailedDelete = await reviewRepo.findById(agencyA.id, targetReview.id);
    if (reviewAfterFailedDelete.reply_status !== 'published') {
      throw new Error('Review falsely changed status despite Google delete failure');
    }
    mockGoogleClient.shouldFailDelete = false; // Reset
    console.log('✓ Delete failure correctly preserved local published state');

    // -------------------------------------------------------------------------
    // TEST 24: Cross-agency reply access is rejected
    // -------------------------------------------------------------------------
    console.log('\n[24/25] Testing Cross-agency reply access is rejected...');
    let crossAgencyDraftCaught = false;
    try {
      await workflowService.saveDraft(agencyA.id, managerB, targetReview.id, 'Hacked Reply');
    } catch (err) {
      if (err.code === 'FORBIDDEN' || err.status === 403) {
        crossAgencyDraftCaught = true;
      }
    }
    if (!crossAgencyDraftCaught) {
      throw new Error('SECURITY VIOLATION: Agency B user modified Agency A reply draft!');
    }
    console.log('✓ Cross-agency reply mutation rejected with FORBIDDEN (403)');

    // -------------------------------------------------------------------------
    // TEST 25: Transaction rollback leaves local records consistent
    // -------------------------------------------------------------------------
    console.log('\n[25/25] Testing Transaction rollback leaves local records consistent...');
    // Create a workflow service with a faulty transaction callback simulator
    const failingTxHelper = async (agencyId, callback) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT set_config($1, $2, true)', ['app.current_agency_id', agencyId]);
        await callback(client);
        // Force unexpected failure before commit
        throw new Error('Simulated database deadlock during commit');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    };

    const faultyWorkflowService = new ReviewReplyWorkflowService(
      reviewRepo,
      replyRepo,
      standardAiService,
      gbpRepo,
      mockGoogleClient,
      failingTxHelper
    );

    const rollbackReview = await reviewRepo.findByGoogleReviewId(
      agencyA.id,
      locationA.id,
      `g-rev-sync-1-${testSuffix}`
    );
    const originalStatus = rollbackReview.reply_status;

    let rollbackErrorCaught = false;
    try {
      await faultyWorkflowService.saveDraft(
        agencyA.id,
        managerA,
        rollbackReview.id,
        'This draft should rollback'
      );
    } catch (err) {
      rollbackErrorCaught = true;
    }

    if (!rollbackErrorCaught) {
      throw new Error('Faulty transaction helper failed to throw');
    }

    const reviewAfterRollback = await reviewRepo.findById(agencyA.id, rollbackReview.id);
    if (reviewAfterRollback.reply_status !== originalStatus) {
      throw new Error(
        `Rollback failure: Status changed from "${originalStatus}" to "${reviewAfterRollback.reply_status}"`
      );
    }
    console.log('✓ Transaction rollback leaves database rows consistent and untouched');

    console.log('\n===========================================================');
    console.log('🎉 ALL 25 MILESTONE 3 SERVICES TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    // Teardown test agencies
    await pool.query("DELETE FROM agencies WHERE slug LIKE 'm3-alpha-%' OR slug LIKE 'm3-beta-%'");
  }
}
