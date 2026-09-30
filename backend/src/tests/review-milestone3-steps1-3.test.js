import { ROLES, PERMISSIONS, hasPermission } from '../config/permissions.js';
import { AiService, TemplateAiProvider } from '../services/ai/ai.service.js';
import { GoogleReviewClient, normalizeGoogleReviewError } from '../services/google/googleReview.client.js';

export async function runMilestone3Steps1To3Verification() {
  console.log('===========================================================');
  console.log('🧪 Starting Phase 5 Milestone 3 (Steps 1-3) Verification');
  console.log('===========================================================');

  // ---------------------------------------------------------------------------
  // STEP 1: PERMISSIONS VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n[1/3] Testing Review & Reply RBAC Permissions Matrix...');

  const reviewPermissions = [
    PERMISSIONS.REVIEW_VIEW,
    PERMISSIONS.REVIEW_UPDATE_STATUS,
    PERMISSIONS.REVIEW_SYNC,
    PERMISSIONS.REPLY_GENERATE_AI,
    PERMISSIONS.REPLY_EDIT_DRAFT,
    PERMISSIONS.REPLY_SUBMIT_APPROVAL,
    PERMISSIONS.REPLY_APPROVE,
    PERMISSIONS.REPLY_PUBLISH,
    PERMISSIONS.REPLY_DELETE,
  ];

  // 1a. Owner, Admin, Manager have all review & reply permissions
  for (const role of [ROLES.OWNER, ROLES.ADMIN, ROLES.MANAGER]) {
    for (const perm of reviewPermissions) {
      if (!hasPermission(role, perm)) {
        throw new Error(`Role "${role}" unexpectedly lacks permission "${perm}"`);
      }
    }
  }

  // 1b. Specialist permissions
  const expectedSpecialistPerms = new Set([
    PERMISSIONS.REVIEW_VIEW,
    PERMISSIONS.REVIEW_UPDATE_STATUS,
    PERMISSIONS.REVIEW_SYNC,
    PERMISSIONS.REPLY_GENERATE_AI,
    PERMISSIONS.REPLY_EDIT_DRAFT,
    PERMISSIONS.REPLY_SUBMIT_APPROVAL,
    PERMISSIONS.REPLY_PUBLISH,
  ]);

  for (const perm of reviewPermissions) {
    const shouldHave = expectedSpecialistPerms.has(perm);
    const doesHave = hasPermission(ROLES.SPECIALIST, perm);
    if (doesHave !== shouldHave) {
      throw new Error(`Specialist permission mismatch for "${perm}". Expected: ${shouldHave}, Got: ${doesHave}`);
    }
  }

  // Specialist CANNOT approve or delete
  if (hasPermission(ROLES.SPECIALIST, PERMISSIONS.REPLY_APPROVE)) {
    throw new Error('SECURITY VIOLATION: Specialist must NOT have reply:approve permission');
  }
  if (hasPermission(ROLES.SPECIALIST, PERMISSIONS.REPLY_DELETE)) {
    throw new Error('SECURITY VIOLATION: Specialist must NOT have reply:delete permission');
  }

  // 1c. Viewer has review:view ONLY
  if (!hasPermission(ROLES.VIEWER, PERMISSIONS.REVIEW_VIEW)) {
    throw new Error('Viewer must have review:view permission');
  }
  for (const perm of reviewPermissions) {
    if (perm !== PERMISSIONS.REVIEW_VIEW && hasPermission(ROLES.VIEWER, perm)) {
      throw new Error(`SECURITY VIOLATION: Viewer must NOT have mutation permission "${perm}"`);
    }
  }

  console.log('✓ Permission matrix verified: Owner/Admin/Manager full access, Specialist guarded, Viewer read-only');

  // ---------------------------------------------------------------------------
  // STEP 2: ADVISORY AI SERVICE VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n[2/3] Testing Advisory AI Service (Fallback, Sanitization, Error Safety)...');

  const aiService = new AiService();

  // 2a. 5-Star Positive Review (Friendly tone)
  const res5Star = await aiService.generateReplySuggestion({
    starRating: 5,
    reviewerName: 'Alice Walker',
    businessName: 'Apex Dental Care',
    reviewText: 'Incredible cleaning and friendly hygienists!',
    tone: 'friendly',
  });
  if (!res5Star.suggestedReply || !res5Star.suggestedReply.includes('Apex Dental Care') || !res5Star.suggestedReply.includes('Alice')) {
    throw new Error('5-star friendly reply suggestion did not include business name or reviewer name');
  }
  if (res5Star.tone !== 'friendly') {
    throw new Error(`Expected tone 'friendly', got ${res5Star.tone}`);
  }

  // 2b. 3-Star Neutral Review
  const res3Star = await aiService.generateReplySuggestion({
    starRating: 3,
    reviewerName: 'Bob Visitor',
    businessName: 'Apex Dental Care',
    reviewText: 'Service was okay but lobby wait was too long.',
    tone: 'professional',
  });
  if (!res3Star.suggestedReply || !res3Star.suggestedReply.includes('honest review')) {
    throw new Error('3-star neutral reply suggestion did not contain balanced phrasing');
  }

  // 2c. 1-Star Negative Review
  const res1Star = await aiService.generateReplySuggestion({
    starRating: 1,
    reviewerName: 'Charlie Discontent',
    businessName: 'Apex Dental Care',
    reviewText: 'Unacceptable billing dispute and rude desk clerk.',
    tone: 'apologetic',
  });
  if (!res1Star.suggestedReply || !res1Star.suggestedReply.includes('genuinely sorry') || !res1Star.suggestedReply.includes('management team')) {
    throw new Error('1-star negative reply suggestion did not contain apologetic / remedy phrasing');
  }

  // 2d. Missing / anonymous reviewer and missing comment
  const resAnonymous = await aiService.generateReplySuggestion({
    starRating: 4,
    reviewerName: 'Anonymous',
    businessName: '',
  });
  if (!resAnonymous.suggestedReply || resAnonymous.suggestedReply.includes('Anonymous')) {
    throw new Error('Anonymous reviewer name should not be included literally as a greeting');
  }

  // 2e. Excessive input lengths sanitized safely
  const giantText = 'A'.repeat(10000);
  const resTruncated = await aiService.generateReplySuggestion({
    starRating: 5,
    reviewText: giantText,
    customInstructions: giantText,
  });
  if (!resTruncated.suggestedReply) {
    throw new Error('Failed to handle oversized inputs safely');
  }

  // 2f. External provider failure fallback
  const mockFailingProvider = {
    name: 'failing-gemini-mock',
    async generateReply() {
      throw new Error('Quota exceeded (429 RESOURCE_EXHAUSTED)');
    },
  };
  const safeAiService = new AiService(mockFailingProvider);
  const fallbackRes = await safeAiService.generateReplySuggestion({
    starRating: 5,
    reviewerName: 'David Tester',
    businessName: 'Resilient Motors',
  });

  if (!fallbackRes.isFallback || !fallbackRes.suggestedReply || fallbackRes.model !== 'template-fallback-v1') {
    throw new Error('AI service failed to fall back to deterministic template when provider threw an error');
  }

  // 2g. Zero credential leakage in output
  const sensitiveString = JSON.stringify(fallbackRes);
  if (sensitiveString.includes('AI_KEY') || sensitiveString.includes('SECRET') || sensitiveString.includes('Bearer')) {
    throw new Error('SECURITY VIOLATION: Secret or credential detected in AI reply output');
  }

  console.log('✓ Advisory AI service verified: safe templates, input sanitization, error resilience, zero leakage');

  // ---------------------------------------------------------------------------
  // STEP 3: GOOGLE REVIEW API CLIENT VERIFICATION
  // ---------------------------------------------------------------------------
  console.log('\n[3/3] Testing Google Review API Client (Listing, Reply, Delete, Error Normalization)...');

  let lastRequest = null;
  let mockResponse = { data: {} };
  let mockErrorToThrow = null;

  // Mock GoogleService that returns our test OAuth client
  const mockOAuthClient = {
    async request(options) {
      lastRequest = options;
      if (mockErrorToThrow) {
        throw mockErrorToThrow;
      }
      return mockResponse;
    },
  };

  const mockGoogleService = {
    async _getAuthenticatedOAuthClient(agencyId) {
      if (!agencyId) throw new Error('agency_id required');
      return { oauth2Client: mockOAuthClient };
    },
  };

  const reviewClient = new GoogleReviewClient(mockGoogleService);

  // 3a. List reviews request and pageToken forwarding
  mockResponse = {
    data: {
      reviews: [
        {
          reviewId: 'rev-101',
          reviewer: { displayName: 'John Doe' },
          starRating: 'FIVE',
          comment: 'Great work!',
        },
      ],
      nextPageToken: 'token-page-2',
      totalReviewCount: 1,
      averageRating: 5.0,
    },
  };
  mockErrorToThrow = null;

  const listRes = await reviewClient.listLocationReviews(
    'test-agency-id',
    'accounts/12345',
    'locations/67890',
    'token-page-1',
    25
  );

  if (!lastRequest || lastRequest.method !== 'GET') {
    throw new Error('listLocationReviews did not issue GET request');
  }
  if (!lastRequest.url.includes('/accounts/12345/locations/67890/reviews')) {
    throw new Error(`Unexpected URL for listLocationReviews: ${lastRequest.url}`);
  }
  if (lastRequest.params.pageToken !== 'token-page-1' || lastRequest.params.pageSize !== 25) {
    throw new Error('listLocationReviews did not forward pageToken or pageSize correctly');
  }
  if (listRes.reviews.length !== 1 || listRes.nextPageToken !== 'token-page-2') {
    throw new Error('listLocationReviews did not map response payload correctly');
  }

  // 3b. Publish reply request
  mockResponse = {
    data: {
      comment: 'Thank you John!',
      updateTime: '2026-09-30T10:00:00Z',
    },
  };
  const pubRes = await reviewClient.publishReply(
    'test-agency-id',
    '12345',
    '67890',
    'rev-101',
    'Thank you John!'
  );

  if (!lastRequest || lastRequest.method !== 'PUT') {
    throw new Error('publishReply did not issue PUT request');
  }
  if (!lastRequest.url.includes('/accounts/12345/locations/67890/reviews/rev-101/reply')) {
    throw new Error(`Unexpected URL for publishReply: ${lastRequest.url}`);
  }
  if (lastRequest.data?.comment !== 'Thank you John!') {
    throw new Error('publishReply did not send comment in request body');
  }
  if (pubRes.comment !== 'Thank you John!') {
    throw new Error('publishReply did not return response data');
  }

  // 3c. Delete reply request
  mockResponse = { data: {} };
  const delRes = await reviewClient.deleteReply(
    'test-agency-id',
    'accounts/12345',
    'locations/67890',
    'reviews/rev-101'
  );

  if (!lastRequest || lastRequest.method !== 'DELETE') {
    throw new Error('deleteReply did not issue DELETE request');
  }
  if (!lastRequest.url.includes('/accounts/12345/locations/67890/reviews/rev-101/reply')) {
    throw new Error(`Unexpected URL for deleteReply: ${lastRequest.url}`);
  }
  if (!delRes.deleted) {
    throw new Error('deleteReply did not return success status');
  }

  // 3d. Error Normalization Mapping Tests (400, 401, 403, 404, 429, 500)
  const errorTestCases = [
    {
      status: 400,
      rawMsg: 'Invalid resource name',
      expectedCode: 'GOOGLE_INVALID_ARGUMENT',
    },
    {
      status: 401,
      rawMsg: 'Token expired with ya29.a0AfH6SMToken12345 secret',
      expectedCode: 'GOOGLE_TOKEN_REFRESH_FAILED',
    },
    {
      status: 403,
      rawMsg: 'The caller does not have permission',
      expectedCode: 'GOOGLE_FORBIDDEN',
    },
    {
      status: 404,
      rawMsg: 'Requested location not found',
      expectedCode: 'GOOGLE_RESOURCE_NOT_FOUND',
    },
    {
      status: 429,
      rawMsg: 'Quota exceeded',
      expectedCode: 'GOOGLE_RATE_LIMITED',
    },
    {
      status: 503,
      rawMsg: 'Backend server error',
      expectedCode: 'GOOGLE_API_ERROR',
    },
  ];

  for (const tc of errorTestCases) {
    mockErrorToThrow = {
      status: tc.status,
      message: tc.rawMsg,
      response: {
        status: tc.status,
        data: { error: { message: tc.rawMsg } },
      },
    };

    let caughtError = null;
    try {
      await reviewClient.publishReply('test-agency-id', '123', '456', '789', 'Hello');
    } catch (err) {
      caughtError = err;
    }

    if (!caughtError) {
      throw new Error(`Expected error for status ${tc.status} was not thrown`);
    }
    if (caughtError.code !== tc.expectedCode) {
      throw new Error(`Expected code ${tc.expectedCode}, got ${caughtError.code}`);
    }
    if (caughtError.status !== tc.status) {
      throw new Error(`Expected status ${tc.status}, got ${caughtError.status}`);
    }
    // Verify credential masking
    if (caughtError.message.includes('ya29.a0AfH6SMToken12345')) {
      throw new Error('SECURITY VIOLATION: Raw access token leaked in normalized error message!');
    }
  }

  console.log('✓ Google Review API client verified: list/publish/delete, pageToken, error normalization, credential masking');

  console.log('\n===========================================================');
  console.log('🎉 ALL MILESTONE 3 (STEPS 1-3) TESTS PASSED SUCCESSFULLY!');
  console.log('===========================================================');
}
