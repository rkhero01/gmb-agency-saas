import { testMigrator } from './migrator.test.js';
import { runTenantIsolationVerification } from './tenant-isolation.test.js';
import { runAuthRbacVerification } from './auth-rbac.test.js';
import { runClientLocationCrudVerification } from './client-location-crud.test.js';
import { runGoogleOAuthGbpVerification } from './google-oauth-gbp.test.js';
import { runReviewRepositoryVerification } from './review-repository.test.js';

async function runAllTests() {
  console.log('🚀 Running Complete Test Suite (Phases 0, 1, 2, 3, 4 & 5-M2)...\n');

  try {
    console.log('===========================================================');
    console.log('1. Database Migration Engine Tests');
    console.log('===========================================================');
    await testMigrator();

    console.log('\n===========================================================');
    console.log('2. Multi-Tenant Domain Hierarchy & Isolation Tests');
    console.log('===========================================================');
    await runTenantIsolationVerification();

    console.log('\n===========================================================');
    console.log('3. Authentication & Team RBAC Tests');
    console.log('===========================================================');
    await runAuthRbacVerification();

    console.log('\n===========================================================');
    console.log('4. Client & Location CRUD API Integration Tests');
    console.log('===========================================================');
    await runClientLocationCrudVerification();

    console.log('\n===========================================================');
    console.log('5. Google Cloud OAuth 2.0 & GBP Tests');
    console.log('===========================================================');
    await runGoogleOAuthGbpVerification();

    console.log('\n===========================================================');
    console.log('6. Phase 5 Review & Reply Data Access Repository Tests');
    console.log('===========================================================');
    await runReviewRepositoryVerification();

    console.log('\n===========================================================');
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! (PHASES 0, 1, 2, 3, 4 & 5-M2)');
    console.log('===========================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
  }
}

runAllTests();
