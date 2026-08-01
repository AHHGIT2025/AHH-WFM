const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("Running prisma migrate diff...");
  const sql = execSync('npx prisma migrate diff --from-migrations packages/database/prisma/migrations --to-schema-datamodel packages/database/prisma/schema.prisma --shadow-database-url "mysql://root:rootpassword@127.0.0.1:3306/ahh_wfm_shadow_db_4" --script', { encoding: 'utf-8', cwd: __dirname });
  
  const migrationDir = 'packages/database/prisma/migrations/20260801000000_pc2a_clean';
  if (!fs.existsSync(migrationDir)) {
    fs.mkdirSync(migrationDir, { recursive: true });
  }
  
  fs.writeFileSync(`${migrationDir}/migration.sql`, sql, { encoding: 'utf8' });
  console.log("Migration SQL written.");
  
  execSync('npx prisma migrate deploy --schema packages/database/prisma/schema.prisma', { stdio: 'inherit', cwd: __dirname });
  console.log("Deployed.");
} catch (e) {
  console.error("Error:", e.message);
  if (e.stdout) console.log("STDOUT:", e.stdout.toString());
  if (e.stderr) console.error("STDERR:", e.stderr.toString());
}
