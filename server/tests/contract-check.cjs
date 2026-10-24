// Zero-dependency source contract checks. Does not replace npm build or integration tests.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const serverPkg=JSON.parse(read('server/package.json'));
const clientPkg=JSON.parse(read('client/package.json'));
assert(serverPkg.dependencies['@nestjs/core'],'NestJS missing');
assert(serverPkg.dependencies['@prisma/client'],'Prisma missing');
assert(clientPkg.dependencies.react,'React missing');
assert(clientPkg.dependencies['react-router-dom'],'React Router missing');
assert(clientPkg.devDependencies.vite,'Vite missing');
assert(read('server/prisma/schema.prisma').includes('provider = "postgresql"'),'PostgreSQL required');
for(const model of ['User','Pitch','AccessRequest','AccessGrant','Deal','Milestone','Payout','LedgerEntry','AuditLog'])
  assert(new RegExp(`model ${model} \\{`).test(read('server/prisma/schema.prisma')),`${model} missing`);
const controller=read('server/src/trustbridge.controller.ts');
for(const route of ['pitches/feed','startups/me/pitches','pitches/:id/progress-updates','pitches/:id/details',
  'pitches/:id/access-requests','access-requests/:id/decision','milestones/:id/approve-and-release','admin/audit','demo/reset'])
  assert(controller.includes(`'${route}'`),`${route} missing`);
const service=read('server/src/trustbridge.service.ts');
assert(service.includes('EXPLICIT ALLOWLIST'),'Blind Profile not explicitly allowlisted');
assert(service.includes("status:'PENDING_APPROVAL'"),'Milestone state machine missing');
assert(service.includes('tx.payout.create'),'Payout transaction missing');
assert(service.includes('conflictAcknowledged'),'Conflict acknowledgment missing');
assert(read('server/src/main.ts').includes('client/dist'),'React SPA hosting missing');
for(const page of ['Login','Home','Discover','PitchPage','AccessPage','DealsPage','AuditPage'])
  assert(fs.existsSync(path.join(root,`client/src/pages/${page}.tsx`)),`page ${page} missing`);
const frontendSrc=read('client/src/pages/Discover.tsx');
assert(frontendSrc.includes('/pitches/feed'),'Investor feed integration missing');
assert(frontendSrc.includes('/details'),'Protected pitch detail integration missing');
console.log('TrustBridge fullstack static source contract: PASS');
