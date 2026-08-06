// Separate Node child-process worker for true process-isolation integration testing
const { mockDb, resetSeededStateForTesting } = require('../../packages/mock-data/src/index');

async function runWorker() {
  try {
    resetSeededStateForTesting();
    const companies = await mockDb.getCompanies();
    const holding = companies.find(c => c.isHoldingCompany);
    const result = {
      success: true,
      pid: process.pid,
      companyCount: companies.length,
      holdingCompanyId: holding ? holding.id : null,
      companyCodes: companies.map(c => c.companyCode).sort()
    };
    if (process.send) {
      process.send(result);
    } else {
      console.log(JSON.stringify(result));
    }
    process.exit(0);
  } catch (error) {
    const errorResult = {
      success: false,
      pid: process.pid,
      errorName: error.name,
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack
    };
    if (process.send) {
      process.send(errorResult);
    } else {
      console.error(JSON.stringify(errorResult));
    }
    process.exit(1);
  }
}

runWorker();
