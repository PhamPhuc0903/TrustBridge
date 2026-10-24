/**
 * Zero-dependency runtime checks of actual TypeScript business service.
 * Transpiles TS using installed/global TypeScript and mocks Nest/Prisma adapters;
 * does NOT replace Docker + PostgreSQL end-to-end tests.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const cp=require('node:child_process');
let ts;
try{ts=require('typescript');}catch{
  try{ts=require(path.join(cp.execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim(),'typescript'));}catch{}
}
if(!ts){console.error('TypeScript not installed. Run npm install.');process.exit(2);}
class BadRequestException extends Error{};class ConflictException extends Error{};
class ForbiddenException extends Error{};class NotFoundException extends Error{};
const src=fs.readFileSync(path.resolve(__dirname,'../server/src/trustbridge.service.ts'),'utf8');
const code=ts.transpileModule(src,{fileName:'trustbridge.service.ts',compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,experimentalDecorators:true,
  emitDecoratorMetadata:false}}).outputText;
const mocks={
  '@nestjs/common':{BadRequestException,ConflictException,ForbiddenException,NotFoundException,Injectable:()=>c=>c},
  '@prisma/client':{Prisma:{TransactionIsolationLevel:{Serializable:'Serializable'}}},
  './prisma.service':{PrismaService:class{}}, './ai':{AiAdapter:class{}},
  './dto':{},'./demo.seed':{seedDatabase:async()=>{}}
};
const mod={exports:{}};
new Function('require','module','exports',code)((name)=>{
  if(Object.hasOwn(mocks,name))return mocks[name];
  return require(name);
},mod,mod.exports);
const {TrustbridgeService}=mod.exports;
const userInvestor={id:4,role:'INVESTOR',ekycVerified:true,holdings:[]};
const userStartup={id:7,role:'STARTUP',ekycVerified:false};
const pitch={id:'ST-8821',startupId:7,industry:'F&B',targetCents:15000000n,
  industryTags:['beverage'],equityPercent:15,brandName:'SECRET_BRAND',founderName:'SECRET_FOUNDER',
  secret:'SECRET_FORMULA',privateDetails:'SECRET_TEXT',status:'PUBLISHED',
  paymentStatus:'DEMO_PAID',updatesPeriod:'',updatesUsed:0,aiScore:88,publicAiSummary:'Public summary',
  aiProvider:'MOCK',version:1,aiReviewedVersion:null};
let passed=0;
async function test(name,fn){await fn();console.log(`  [PASS] ${name}`);passed++;}
(async()=>{
  await test('Blind feed serializes only allowlisted fields',async()=>{
    const db={pitch:{findMany:async()=>[pitch]},accessRequest:{findMany:async()=>[]}};
    const res=await new TrustbridgeService(db,{}).feed(userInvestor);
    const text=JSON.stringify(res);
    for(const secret of ['SECRET_BRAND','SECRET_FOUNDER','SECRET_FORMULA','SECRET_TEXT'])
      assert(!text.includes(secret));
    assert.equal(res[0].funding_target.amount_minor,15000000);
  });
  await test('Unapproved investor cannot read private pitch',async()=>{
    const db={pitch:{findUnique:async()=>pitch},accessGrant:{findUnique:async()=>null}};
    await assert.rejects(new TrustbridgeService(db,{}).privateDetails(pitch.id,userInvestor),ForbiddenException);
  });
  await test('Approval requires acknowledgement of red conflict',async()=>{
    const db={accessRequest:{findUnique:async()=>({id:7,pitchId:pitch.id,pitch:{startupId:7},
      investor:userInvestor,riskLevel:'RED_ALERT'})}};
    await assert.rejects(new TrustbridgeService(db,{}).decide(7,{action:'APPROVE'},userStartup),ConflictException);
  });
  await test('Duplicate milestone payout is blocked',async()=>{
    const db={milestone:{findUnique:async()=>({id:5,dealId:'ESC-904',status:'SIMULATED_PAID',evidence:'ok'})},
      deal:{findUnique:async()=>({id:'ESC-904',investorId:4,status:'SIMULATED_FUNDED',pitch:{startupId:7}})}};
    await assert.rejects(new TrustbridgeService(db,{}).release(5,userInvestor),ConflictException);
  });
  await test('Pitch editing revokes grants and requests in same transaction',async()=>{
    const called=[];const tx={
      accessGrant:{deleteMany:async()=>{called.push('grant');}},
      accessRequest:{deleteMany:async()=>{called.push('request');}},
      pitch:{update:async()=>{called.push('pitch');return {...pitch,status:'DRAFT',version:2};}},
      auditLog:{create:async()=>{called.push('audit');}}
    };
    const db={pitch:{findUnique:async()=>pitch},deal:{count:async()=>0},$transaction:fn=>fn(tx)};
    const body={industry:'F&B',industry_tags:['fnb'],target_usd:150000,equity_percent:15,
      brand_name:'New',founder_name:'Founder',secret:'New private details'};
    const res=await new TrustbridgeService(db,{}).editPitch(pitch.id,body,userStartup);
    assert.equal(res.status,'DRAFT');assert.deepEqual(called,['grant','request','pitch','audit']);
  });
  await test('AI text with private secrets cannot enter blind public summary',async()=>{
    let saved;
    const tx={pitch:{updateMany:async({data})=>{saved=data.publicAiSummary;return {count:1};}},
      aiReview:{create:async()=>{}},auditLog:{create:async()=>{}}};
    const db={pitch:{findUnique:async()=>pitch},$transaction:fn=>fn(tx)};
    const ai={provider:'HTTP_AI',review:async()=>({pitch_id:pitch.id,status:'APPROVED',
      is_spam_or_violated:false,ai_trust_score:90,
      agent_breakdown:{feasibility_score:90,financial_score:90,risk_spam_score:90},
      public_ai_summary:'SECRET_FORMULA',model_version:'test'})};
    const res=await new TrustbridgeService(db,ai).submitPitch(pitch.id,userStartup);
    assert(!saved.includes('SECRET_FORMULA'));assert(!res.public_ai_summary.includes('SECRET_FORMULA'));
  });
  console.log(`\n${passed} offline business rules: PASS (real service logic with mocked persistence).`);
})().catch(err=>{console.error(err);process.exitCode=1;});
