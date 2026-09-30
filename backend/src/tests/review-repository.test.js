import { pool, checkDatabaseHealth } from '../config/database.js';
import { AgencyRepository } from '../repositories/agency.repository.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ClientRepository } from '../repositories/client.repository.js';
import { LocationRepository } from '../repositories/location.repository.js';
import { ReviewRepository } from '../repositories/review.repository.js';
import { ReviewReplyRepository } from '../repositories/reviewReply.repository.js';
import { ROLES } from '../config/permissions.js';

export async function runReviewRepositoryVerification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 5 Milestone 2: Review & Reply Repository Tests');
  console.log('===========================================================');

  const health = await checkDatabaseHealth();
  if (!health.connected) {
    throw new Error('Database connection required for Phase 5 tests: ' + health.message);
  }

  const agencyRepo = new AgencyRepository(pool);
  const userRepo = new UserRepository(pool);
  const clientRepo = new ClientRepository(pool);
  const locationRepo = new LocationRepository(pool);
  const reviewRepo = new ReviewRepository(pool);
  const reviewReplyRepo = new ReviewReplyRepository(pool);

  const testSuffix = Date.now().toString().slice(-6);

  try {
    // -------------------------------------------------------------------------
    // 1. Setup Test Tenants & Hierarchy: Agency A and Agency B
    // -------------------------------------------------------------------------
    console.log('\n--- Setting up Test Tenants and Test Locations ---');
    const agencyA = await agencyRepo.create({
      name: `Review Alpha Agency ${testSuffix}`,
      slug: `rev-alpha-${testSuffix}`,
      status: 'active',
    });

    const agencyB = await agencyRepo.create({
      name: `Review Beta Agency ${testSuffix}`,
      slug: `rev-beta-${testSuffix}`,
      status: 'active',
    });

    const userA = await userRepo.create(agencyA.id, {
      name: 'Alice Approver A',
      email: `alice.rev.${testSuffix}@alpha.com`,
      password: 'StrongPassword123!',
      role: ROLES.ADMIN,
    });

    const userB = await userRepo.create(agencyB.id, {
      name: 'Bob Beta B',
      email: `bob.rev.${testSuffix}@beta.com`,
      password: 'StrongPassword123!',
      role: ROLES.ADMIN,
    });

    const clientA = await clientRepo.create(agencyA.id, {
      name: `Alpha Client ${testSuffix}`,
      business_name: 'Alpha Dental Care',
    });

    const locationA = await locationRepo.create(agencyA.id, {
      client_id: clientA.id,
      name: 'Alpha Downtown Clinic',
      city: 'Austin',
      state: 'TX',
    });

    const clientB = await clientRepo.create(agencyB.id, {
      name: `Beta Client ${testSuffix}`,
      business_name: 'Beta Auto Repair',
    });

    const locationB = await locationRepo.create(agencyB.id, {
      client_id: clientB.id,
      name: 'Beta East Garage',
      city: 'Dallas',
      state: 'TX',
    });

    console.log('✓ Tenants, users, clients, and locations initialized successfully');

    // -------------------------------------------------------------------------
    // 2. Review Upsert & Idempotency
    // -------------------------------------------------------------------------
    console.log('\n[1/10] Testing ReviewRepository.upsertSyncedReview()...');
    const reviewData1 = {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-101-${testSuffix}`,
      reviewerName: 'John Doe',
      reviewerPhotoUrl: 'https://lh3.googleusercontent.com/photo-101',
      isAnonymous: false,
      starRating: 5,
      comment: 'Outstanding dental cleaning service! Highly recommend.',
      reviewCreateTime: new Date(Date.now() - 86400000 * 2), // 2 days ago
    };

    const insertedRev1 = await reviewRepo.upsertSyncedReview(agencyA.id, reviewData1);
    if (!insertedRev1 || insertedRev1.star_rating !== 5 || insertedRev1.original_rating_enum !== 'FIVE') {
      throw new Error('Failed to upsert review or rating enum normalization incorrect');
    }
    if (insertedRev1.agency_id !== agencyA.id) {
      throw new Error('Inserted review has incorrect agency_id');
    }

    // Upsert idempotency test: update reviewer comment and rating
    const updatedRev1 = await reviewRepo.upsertSyncedReview(agencyA.id, {
      ...reviewData1,
      comment: 'Updated review: Even better on follow-up visit!',
      starRating: 5,
    });

    if (updatedRev1.id !== insertedRev1.id) {
      throw new Error('Upsert created a duplicate review row instead of updating');
    }
    if (updatedRev1.comment !== 'Updated review: Even better on follow-up visit!') {
      throw new Error('Upsert failed to update review comment');
    }

    // Insert 2 more reviews for Agency A to test stats & filtering
    const reviewData2 = {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-102-${testSuffix}`,
      reviewerName: 'Jane Smith',
      starRating: 3,
      comment: 'Average experience. Long wait time in lobby.',
      reviewCreateTime: new Date(Date.now() - 86400000), // 1 day ago
    };
    const insertedRev2 = await reviewRepo.upsertSyncedReview(agencyA.id, reviewData2);

    const reviewData3 = {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-103-${testSuffix}`,
      reviewerName: 'Bob Visitor',
      starRating: 1,
      comment: 'Terrible customer support.',
      reviewCreateTime: new Date(),
    };
    const insertedRev3 = await reviewRepo.upsertSyncedReview(agencyA.id, reviewData3);

    // Seed real Agency B review and reply for bidirectional isolation (F-05)
    const reviewDataB1 = {
      clientId: clientB.id,
      locationId: locationB.id,
      googleReviewId: `g-rev-b201-${testSuffix}`,
      reviewerName: 'Marcus Beta',
      starRating: 4,
      comment: 'Great brake repair service at Beta East Garage.',
      reviewCreateTime: new Date(),
    };
    const insertedRevB1 = await reviewRepo.upsertSyncedReview(agencyB.id, reviewDataB1);
    const replyB1 = await reviewReplyRepo.upsertReply(agencyB.id, {
      reviewId: insertedRevB1.id,
      suggestedReply: 'Thank you for choosing Beta East Garage, Marcus!',
      status: 'suggested',
      createdByUserId: userB.id,
    });

    if (!insertedRevB1 || !replyB1) {
      throw new Error('Failed to seed Agency B review and reply for isolation testing');
    }

    console.log('✓ Upsert, idempotent update, and multi-agency seeding verified');

    // -------------------------------------------------------------------------
    // 3. F-05: Bidirectional Cross-Tenant Isolation for Reviews
    // -------------------------------------------------------------------------
    console.log('\n[2/10] Testing Bidirectional Cross-Tenant Review Isolation (A <-> B)...');

    // 3a. Direction 1: Agency B cannot read Agency A review by ID
    const crossReadBfromA = await reviewRepo.findById(agencyB.id, insertedRev1.id);
    if (crossReadBfromA !== null) {
      throw new Error('SECURITY VIOLATION: Agency B was able to read Agency A review!');
    }

    // Direction 2: Agency A cannot read Agency B review by ID
    const crossReadAfromB = await reviewRepo.findById(agencyA.id, insertedRevB1.id);
    if (crossReadAfromB !== null) {
      throw new Error('SECURITY VIOLATION: Agency A was able to read Agency B review!');
    }

    // 3b. Agency B listReviews does not contain Agency A reviews
    const agencyBList = await reviewRepo.listReviews(agencyB.id);
    if (agencyBList.reviews.some((r) => r.agency_id !== agencyB.id || r.id === insertedRev1.id)) {
      throw new Error('SECURITY VIOLATION: Agency B listReviews returned Agency A review!');
    }
    if (agencyBList.total !== 1 || agencyBList.reviews[0].id !== insertedRevB1.id) {
      throw new Error('Agency B listReviews did not return its own review properly');
    }

    // Agency A listReviews does not contain Agency B reviews
    const agencyAList = await reviewRepo.listReviews(agencyA.id);
    if (agencyAList.reviews.some((r) => r.agency_id !== agencyA.id || r.id === insertedRevB1.id)) {
      throw new Error('SECURITY VIOLATION: Agency A listReviews returned Agency B review!');
    }

    // 3c. Agency B cannot update status of Agency A review
    const crossUpdateB = await reviewRepo.updateStatus(agencyB.id, insertedRev1.id, 'archived');
    if (crossUpdateB !== null) {
      throw new Error('SECURITY VIOLATION: Agency B was able to update status of Agency A review!');
    }
    const verifiedRev1 = await reviewRepo.findById(agencyA.id, insertedRev1.id);
    if (verifiedRev1.status === 'archived') {
      throw new Error('SECURITY VIOLATION: Review status changed by unauthorized Agency B!');
    }

    // Agency A cannot update status of Agency B review
    const crossUpdateA = await reviewRepo.updateStatus(agencyA.id, insertedRevB1.id, 'archived');
    if (crossUpdateA !== null) {
      throw new Error('SECURITY VIOLATION: Agency A was able to update status of Agency B review!');
    }
    const verifiedRevB1 = await reviewRepo.findById(agencyB.id, insertedRevB1.id);
    if (verifiedRevB1.status === 'archived') {
      throw new Error('SECURITY VIOLATION: Review status changed by unauthorized Agency A!');
    }

    // 3d. Cross-tenant FK violation: Agency A cannot insert review referencing Agency B location
    let crossFkCaught = false;
    try {
      await reviewRepo.upsertSyncedReview(agencyA.id, {
        clientId: clientA.id,
        locationId: locationB.id, // Agency B's location!
        googleReviewId: `g-cross-${testSuffix}`,
        starRating: 5,
      });
    } catch (err) {
      crossFkCaught = true;
    }
    if (!crossFkCaught) {
      throw new Error('SECURITY VIOLATION: Inserted review referencing cross-agency location without FK error!');
    }

    console.log('✓ Bidirectional review isolation verified: zero leakage, zero unauthorized mutations');

    // -------------------------------------------------------------------------
    // 4. F-01: Filtering, Text Search, and Plain Object Pagination Shape
    // -------------------------------------------------------------------------
    console.log('\n[3/10] Testing ReviewRepository.listReviews() filters & plain object pagination (F-01)...');

    // Star rating filter
    const fiveStarReviews = await reviewRepo.listReviews(agencyA.id, { starRating: 5 });
    if (!Array.isArray(fiveStarReviews.reviews) || fiveStarReviews.reviews.length !== 1 || fiveStarReviews.reviews[0].id !== insertedRev1.id) {
      throw new Error(`Expected 1 5-star review, got ${fiveStarReviews.reviews.length}`);
    }

    // Array star rating filter (1 and 3 stars)
    const lowRatingReviews = await reviewRepo.listReviews(agencyA.id, { starRating: [1, 3] });
    if (lowRatingReviews.reviews.length !== 2) {
      throw new Error(`Expected 2 low-rating reviews, got ${lowRatingReviews.reviews.length}`);
    }

    // Text search (reviewer name or comment)
    const searchByName = await reviewRepo.listReviews(agencyA.id, { search: 'Jane Smith' });
    if (searchByName.reviews.length !== 1 || searchByName.reviews[0].id !== insertedRev2.id) {
      throw new Error('Search by reviewer name failed');
    }

    const searchByComment = await reviewRepo.listReviews(agencyA.id, { search: 'follow-up' });
    if (searchByComment.reviews.length !== 1 || searchByComment.reviews[0].id !== insertedRev1.id) {
      throw new Error('Search by comment text failed');
    }

    // Pagination plain object verification (F-01)
    const page1 = await reviewRepo.listReviews(agencyA.id, {}, { limit: 2, offset: 0 });
    if (Array.isArray(page1)) {
      throw new Error('F-01 VIOLATION: listReviews returned an Array instead of a plain object!');
    }
    if (!page1.reviews || page1.reviews.length !== 2 || page1.total !== 3 || page1.totalPages !== 2 || page1.page !== 1) {
      throw new Error(`Pagination page 1 shape incorrect: reviews=${page1.reviews?.length}, total=${page1.total}, totalPages=${page1.totalPages}`);
    }

    // Verify JSON.stringify retains pagination metadata
    const jsonSerialized = JSON.parse(JSON.stringify(page1));
    if (jsonSerialized.total !== 3 || jsonSerialized.limit !== 2 || jsonSerialized.offset !== 0 || !Array.isArray(jsonSerialized.reviews)) {
      throw new Error('F-01 VIOLATION: JSON.stringify dropped pagination metadata!');
    }

    const page2 = await reviewRepo.listReviews(agencyA.id, {}, { limit: 2, offset: 2 });
    if (page2.reviews.length !== 1 || page2.total !== 3 || page2.page !== 2) {
      throw new Error(`Pagination page 2 expected 1 item and total 3, got length=${page2.reviews.length}, total=${page2.total}`);
    }

    // Relation joins check: client_name and location_name present
    if (!page1.reviews[0].client_name || !page1.reviews[0].location_name) {
      throw new Error('listReviews did not join client_name or location_name');
    }

    console.log('✓ Filtering, searching, sorting, and plain object pagination verified');

    // -------------------------------------------------------------------------
    // 5. Review Statistics Aggregation
    // -------------------------------------------------------------------------
    console.log('\n[4/10] Testing ReviewRepository.getReviewStats()...');
    const stats = await reviewRepo.getReviewStats(agencyA.id);

    // Reviews: 5-star (1), 3-star (1), 1-star (1). Total = 3. Avg = (5+3+1)/3 = 3.00
    if (stats.total_reviews !== 3) {
      throw new Error(`Expected total_reviews=3, got ${stats.total_reviews}`);
    }
    if (stats.average_rating !== 3) {
      throw new Error(`Expected average_rating=3, got ${stats.average_rating}`);
    }
    if (stats.rating_breakdown[5] !== 1 || stats.rating_breakdown[3] !== 1 || stats.rating_breakdown[1] !== 1) {
      throw new Error('Rating breakdown counts mismatch');
    }
    if (stats.unreplied_count !== 3) {
      throw new Error(`Expected unreplied_count=3, got ${stats.unreplied_count}`);
    }

    console.log('✓ Review statistics aggregation verified');

    // -------------------------------------------------------------------------
    // 6. Review Status Update
    // -------------------------------------------------------------------------
    console.log('\n[5/10] Testing ReviewRepository.updateStatus()...');
    const updatedStatus = await reviewRepo.updateStatus(agencyA.id, insertedRev3.id, 'flagged');
    if (!updatedStatus || updatedStatus.status !== 'flagged') {
      throw new Error('Failed to update review status to flagged');
    }

    let invalidStatusCaught = false;
    try {
      await reviewRepo.updateStatus(agencyA.id, insertedRev3.id, 'invalid_status_value');
    } catch (err) {
      invalidStatusCaught = true;
    }
    if (!invalidStatusCaught) {
      throw new Error('Expected invalid status to be rejected');
    }

    console.log('✓ Review status transitions verified');

    // -------------------------------------------------------------------------
    // 7. F-03: External Google Reply Status Synchronization Matrix
    // -------------------------------------------------------------------------
    console.log('\n[6/10] Testing External Google Reply Status Sync Matrix (F-03)...');

    // 7a. unreplied + external reply -> published
    const revUnreplied = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-sync-1-${testSuffix}`,
      starRating: 5,
      reviewCreateTime: new Date(),
    });
    if (revUnreplied.reply_status !== 'unreplied') {
      throw new Error(`Expected unreplied, got ${revUnreplied.reply_status}`);
    }
    const syncedUnreplied = await reviewRepo.upsertSyncedReview(agencyA.id, {
      ...revUnreplied,
      externalReplyComment: 'Thank you directly from Google GBP!',
    });
    if (syncedUnreplied.reply_status !== 'published') {
      throw new Error(`Expected 'unreplied' + external reply to become 'published', got '${syncedUnreplied.reply_status}'`);
    }

    // 7b. ai_suggested + external reply -> published
    const revSuggested = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-sync-2-${testSuffix}`,
      starRating: 4,
      reviewCreateTime: new Date(),
    });
    await pool.query("UPDATE reviews SET reply_status = 'ai_suggested' WHERE id = $1", [revSuggested.id]);
    const syncedSuggested = await reviewRepo.upsertSyncedReview(agencyA.id, {
      ...revSuggested,
      externalReplyComment: 'Google response for suggested review',
    });
    if (syncedSuggested.reply_status !== 'published') {
      throw new Error(`Expected 'ai_suggested' + external reply to become 'published', got '${syncedSuggested.reply_status}'`);
    }

    // 7c. draft + external reply -> published
    const revDraft = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-sync-3-${testSuffix}`,
      starRating: 3,
      reviewCreateTime: new Date(),
    });
    await pool.query("UPDATE reviews SET reply_status = 'draft' WHERE id = $1", [revDraft.id]);
    const syncedDraft = await reviewRepo.upsertSyncedReview(agencyA.id, {
      ...revDraft,
      externalReplyComment: 'Google response for draft review',
    });
    if (syncedDraft.reply_status !== 'published') {
      throw new Error(`Expected 'draft' + external reply to become 'published', got '${syncedDraft.reply_status}'`);
    }

    // 7d. pending_approval remains unchanged
    const revPending = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-sync-4-${testSuffix}`,
      starRating: 2,
      reviewCreateTime: new Date(),
    });
    await pool.query("UPDATE reviews SET reply_status = 'pending_approval' WHERE id = $1", [revPending.id]);
    const syncedPending = await reviewRepo.upsertSyncedReview(agencyA.id, {
      ...revPending,
      externalReplyComment: 'Google response for pending approval review',
    });
    if (syncedPending.reply_status !== 'pending_approval') {
      throw new Error(`Expected 'pending_approval' to remain unchanged, got '${syncedPending.reply_status}'`);
    }

    // 7e. approved remains unchanged
    const revApproved = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-sync-5-${testSuffix}`,
      starRating: 5,
      reviewCreateTime: new Date(),
    });
    await pool.query("UPDATE reviews SET reply_status = 'approved' WHERE id = $1", [revApproved.id]);
    const syncedApproved = await reviewRepo.upsertSyncedReview(agencyA.id, {
      ...revApproved,
      externalReplyComment: 'Google response for approved review',
    });
    if (syncedApproved.reply_status !== 'approved') {
      throw new Error(`Expected 'approved' to remain unchanged, got '${syncedApproved.reply_status}'`);
    }

    // 7f. published remains published
    const revPublished = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-rev-sync-6-${testSuffix}`,
      starRating: 5,
      reviewCreateTime: new Date(),
    });
    await pool.query("UPDATE reviews SET reply_status = 'published' WHERE id = $1", [revPublished.id]);
    const syncedPublished = await reviewRepo.upsertSyncedReview(agencyA.id, {
      ...revPublished,
      externalReplyComment: 'Google updated response for published review',
    });
    if (syncedPublished.reply_status !== 'published') {
      throw new Error(`Expected 'published' to remain 'published', got '${syncedPublished.reply_status}'`);
    }

    console.log('✓ All 6 external Google reply status synchronization cases verified (F-03)');

    // -------------------------------------------------------------------------
    // 8. F-04: Review/Reply Location Parity Enforcement
    // -------------------------------------------------------------------------
    console.log('\n[7/10] Testing Location Parity Enforcement (F-04)...');

    // Create a review for Location A
    const revForParity = await reviewRepo.upsertSyncedReview(agencyA.id, {
      clientId: clientA.id,
      locationId: locationA.id,
      googleReviewId: `g-parity-${testSuffix}`,
      starRating: 5,
      reviewCreateTime: new Date(),
    });

    // Attempt to upsert reply with a caller-supplied mismatched locationId (locationB or another location)
    const replyWithMismatchedLoc = await reviewReplyRepo.upsertReply(agencyA.id, {
      reviewId: revForParity.id,
      locationId: locationB.id, // Mismatched location supplied by caller!
      suggestedReply: 'Parity check reply',
    });

    // Verify persisted location_id matches the parent review's location_id and NOT the caller-supplied value
    if (replyWithMismatchedLoc.location_id !== locationA.id) {
      throw new Error(`F-04 VIOLATION: Persisted location_id (${replyWithMismatchedLoc.location_id}) did not match parent review location_id (${locationA.id})!`);
    }

    // Verify non-existent review ID throws clean error
    let nonexistentReviewCaught = false;
    try {
      await reviewReplyRepo.upsertReply(agencyA.id, {
        reviewId: '00000000-0000-0000-0000-000000000000',
        suggestedReply: 'Orphan reply',
      });
    } catch (err) {
      nonexistentReviewCaught = true;
    }
    if (!nonexistentReviewCaught) {
      throw new Error('F-04 VIOLATION: Non-existent review ID accepted for reply upsert!');
    }

    console.log('✓ Location parity strictly enforced from parent review (F-04)');

    // -------------------------------------------------------------------------
    // 9. ReviewReplyRepository Workflow Lifecycle
    // -------------------------------------------------------------------------
    console.log('\n[8/10] Testing ReviewReplyRepository workflow (suggested -> draft -> approved -> published)...');

    // 9a. Upsert suggested reply
    const reply1 = await reviewReplyRepo.upsertReply(agencyA.id, {
      reviewId: insertedRev1.id,
      suggestedReply: 'Thank you for your wonderful feedback, John!',
      aiModel: 'gemini-1.5-pro',
      aiTone: 'professional',
      status: 'suggested',
    });

    if (!reply1 || reply1.status !== 'suggested' || reply1.ai_model !== 'gemini-1.5-pro') {
      throw new Error('Failed to upsert suggested reply');
    }

    // Verify parent review updated reply_status to 'ai_suggested'
    const parentAfterSuggest = await reviewRepo.findById(agencyA.id, insertedRev1.id);
    if (parentAfterSuggest.reply_status !== 'ai_suggested') {
      throw new Error(`Expected parent review reply_status='ai_suggested', got ${parentAfterSuggest.reply_status}`);
    }

    // 9b. Upsert draft edit
    const replyDraft = await reviewReplyRepo.upsertReply(agencyA.id, {
      reviewId: insertedRev1.id,
      draftReply: 'Thank you so much John! We look forward to seeing you again.',
      status: 'draft',
      createdByUserId: userA.id,
    });

    if (replyDraft.id !== reply1.id || replyDraft.status !== 'draft') {
      throw new Error('Failed to update reply draft');
    }

    // 9c. Set approval
    const approvedReply = await reviewReplyRepo.setApproval(agencyA.id, insertedRev1.id, userA.id, 'approved');
    if (!approvedReply || approvedReply.status !== 'approved' || approvedReply.approved_by_user_id !== userA.id) {
      throw new Error('Failed to set reply approval');
    }

    // 9d. Mark published
    const publishedText = 'Thank you so much John! We look forward to seeing you again at Alpha Dental.';
    const publishedReply = await reviewReplyRepo.markPublished(
      agencyA.id,
      insertedRev1.id,
      userA.id,
      publishedText
    );

    if (
      !publishedReply ||
      publishedReply.status !== 'published' ||
      publishedReply.final_published_reply !== publishedText ||
      publishedReply.published_by_user_id !== userA.id
    ) {
      throw new Error('Failed to mark reply published');
    }

    // Verify parent review updated to 'published' with external_reply_comment
    const parentAfterPublish = await reviewRepo.findById(agencyA.id, insertedRev1.id);
    if (
      parentAfterPublish.reply_status !== 'published' ||
      parentAfterPublish.external_reply_comment !== publishedText
    ) {
      throw new Error('Parent review reply_status or external_reply_comment not synchronized on publish');
    }

    console.log('✓ Reply workflow lifecycle verified end-to-end');

    // -------------------------------------------------------------------------
    // 10. F-05: Bidirectional Cross-Tenant Isolation for Review Replies
    // -------------------------------------------------------------------------
    console.log('\n[9/10] Testing Bidirectional Cross-Tenant Review Reply Isolation (A <-> B)...');

    // Direction 1: Agency B cannot read/modify Agency A's reply
    const crossReadReplyB = await reviewReplyRepo.findByReviewId(agencyB.id, insertedRev1.id);
    if (crossReadReplyB !== null) {
      throw new Error('SECURITY VIOLATION: Agency B was able to read Agency A reply!');
    }

    const crossApproveB = await reviewReplyRepo.setApproval(agencyB.id, insertedRev1.id, userB.id, 'approved');
    if (crossApproveB !== null) {
      throw new Error('SECURITY VIOLATION: Agency B was able to approve Agency A reply!');
    }

    const crossPublishB = await reviewReplyRepo.markPublished(
      agencyB.id,
      insertedRev1.id,
      userB.id,
      'Unauthorized published text'
    );
    if (crossPublishB !== null) {
      throw new Error('SECURITY VIOLATION: Agency B was able to publish Agency A reply!');
    }

    let crossReplyInsertCaughtB = false;
    try {
      await reviewReplyRepo.upsertReply(agencyB.id, {
        reviewId: insertedRev1.id,
        suggestedReply: 'Unauthorized reply',
      });
    } catch (err) {
      crossReplyInsertCaughtB = true;
    }
    if (!crossReplyInsertCaughtB) {
      throw new Error('SECURITY VIOLATION: Agency B inserted a reply for Agency A review without error!');
    }

    // Direction 2: Agency A cannot read/modify Agency B's reply
    const crossReadReplyA = await reviewReplyRepo.findByReviewId(agencyA.id, insertedRevB1.id);
    if (crossReadReplyA !== null) {
      throw new Error('SECURITY VIOLATION: Agency A was able to read Agency B reply!');
    }

    const crossApproveA = await reviewReplyRepo.setApproval(agencyA.id, insertedRevB1.id, userA.id, 'approved');
    if (crossApproveA !== null) {
      throw new Error('SECURITY VIOLATION: Agency A was able to approve Agency B reply!');
    }

    const crossPublishA = await reviewReplyRepo.markPublished(
      agencyA.id,
      insertedRevB1.id,
      userA.id,
      'Unauthorized published text by A'
    );
    if (crossPublishA !== null) {
      throw new Error('SECURITY VIOLATION: Agency A was able to publish Agency B reply!');
    }

    let crossReplyInsertCaughtA = false;
    try {
      await reviewReplyRepo.upsertReply(agencyA.id, {
        reviewId: insertedRevB1.id,
        suggestedReply: 'Unauthorized reply by A',
      });
    } catch (err) {
      crossReplyInsertCaughtA = true;
    }
    if (!crossReplyInsertCaughtA) {
      throw new Error('SECURITY VIOLATION: Agency A inserted a reply for Agency B review without error!');
    }

    console.log('✓ Bidirectional review reply isolation strictly enforced');

    // -------------------------------------------------------------------------
    // Final Audit: Relation Joins & Credential Safety
    // -------------------------------------------------------------------------
    console.log('\n[10/10] Testing findById relation joins and credential safety...');
    const detailedReview = await reviewRepo.findById(agencyA.id, insertedRev1.id);
    if (!detailedReview.reply || detailedReview.reply.status !== 'published') {
      throw new Error('findById did not attach nested reply object');
    }
    // Verify no tokens leaked
    if (
      detailedReview.access_token ||
      detailedReview.refresh_token ||
      (detailedReview.reply && (detailedReview.reply.access_token || detailedReview.reply.refresh_token))
    ) {
      throw new Error('SECURITY VIOLATION: OAuth tokens leaked in review queries!');
    }

    console.log('✓ Relation integrity and credential safety verified');

    console.log('\n===========================================================');
    console.log('🎉 ALL REVIEW & REPLY REPOSITORY TESTS PASSED SUCCESSFULLY!');
    console.log('===========================================================');
  } finally {
    // Teardown test agencies (cascades to all children)
    await pool.query("DELETE FROM agencies WHERE slug LIKE 'rev-alpha-%' OR slug LIKE 'rev-beta-%'");
  }
}
