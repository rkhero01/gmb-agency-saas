import { runTenantIsolationVerification } from './tenant-isolation.test.js';
import { testMigrator } from './migrator.test.js';

async function runAllTests() {
  console.log('🚀 Running Complete Phase 1 Verification Suite...\n');

  try {
    await testMigrator();
    await runTenantIsolationVerification();
    console.log('\n🎉 ALL PHASE 1 TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Test suite failure:', err);
    process.exit(1);
  }
}

runAllTests();
