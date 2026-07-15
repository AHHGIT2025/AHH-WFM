import dotenv from 'dotenv';
dotenv.config();
import { prisma } from '@ahh-wfm/database';

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

main().catch(console.error);
