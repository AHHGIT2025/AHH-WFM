const { PrismaClient } = require('../packages/database/src/generated/client2');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const emp1 = await prisma.employee.findUnique({
    where: { email: 'sec.supervisor@alhattab.qa' }
  });
  console.log('sec.supervisor:', emp1);

  const emp2 = await prisma.employee.findUnique({
    where: { email: 'fm.supervisor@alhattab.qa' }
  });
  console.log('fm.supervisor:', emp2);

  const admin = await prisma.employee.findUnique({
    where: { email: 'admin@alhattab.qa' }
  });
  console.log('admin:', admin);
}

main().catch(console.error).finally(() => prisma.$disconnect());
