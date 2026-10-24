/**
 * TrustBridge local end-to-end API scenario (Node >=20, no extra test runner).
 * DESTRUCTIVE: resets only the local seeded classroom demo database before AND after tests.
 * Run with two local services online: npm run test:api
 */
const assert = require('node:assert/strict');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8000/api/v1';
let passed = 0;
const marks = [];
const samplePassword = 'Demo123!';

async function call(path, {token,method='GET',body}={}) {
  let response;
  try {
    response=await fetch(BASE + path, {
      method,
      headers:{Accept:'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,
        ...(body!==undefined?{'Content-Type':'application/json'}:{})},
      body:body===undefined?undefined:JSON.stringify(body),
      signal:AbortSignal.timeout(10000)
    });
  } catch (error) {
    throw new Error(`Cannot connect to ${BASE}${path}: ${error.message}. Start the backend first.`);
  }
  const data=await response.json().catch(()=>null);
  return {status:response.status,data};
}
async function expectStatus(path,status,opts){
  const result=await call(path,opts);
  assert.equal(result.status,status,`${opts?.method||'GET'} ${path}: expected ${status}, got ${result.status}\n${JSON.stringify(result.data)}`);
  return result.data;
}
function check(label,fn){
  return Promise.resolve().then(fn).then(()=>{passed++;marks.push(label);console.log(`  [PASS ${String(passed).padStart(2,'0')}] ${label}`);});
}
async function login(email){
  const r=await expectStatus('/auth/login',201,{method:'POST',body:{email,password:samplePassword}});
  assert.equal(typeof r.access_token,'string');
  return r.access_token;
}
async function reset(){
  const admin=await login('admin@demo.test');
  await expectStatus('/demo/reset',201,{method:'POST',token:admin});
  return admin;
}
async function run(){
  console.log('TrustBridge end-to-end local demo scenario');
  console.log('DESTRUCTIVE: seeded demo data will be RESET before and after.');
  const h=await expectStatus('/health',200);
  assert.equal(h.stack,'NESTJS_POSTGRES_PRISMA');
  await check('PostgreSQL readiness',async()=>{
    const r=await expectStatus('/ready',200);assert.equal(r.database,'POSTGRESQL');
  });
  await reset();
  const [hai,quan,tea,speak,newStartup,admin]=await Promise.all([
    login('hai@demo.test'),login('quan@demo.test'),login('tea@demo.test'),
    login('speak@demo.test'),login('new@demo.test'),login('admin@demo.test')
  ]);
  await check('Authentication and strict roles',async()=>{
    assert.equal((await expectStatus('/me',200,{token:hai})).role,'INVESTOR');
    await expectStatus('/pitches/feed',401);
    await expectStatus('/pitches/feed',403,{token:tea});
    await expectStatus('/admin/audit',403,{token:hai});
    await expectStatus('/startups/me/pitches',403,{token:hai});
    await expectStatus('/demo/reset',403,{method:'POST',token:tea});
  });
  await check('Blind feed never serializes private pitch fields',async()=>{
    const feed=await expectStatus('/pitches/feed',200,{token:hai});
    assert.equal(feed.length,2);
    const json=JSON.stringify(feed);
    for(const s of ['Kombucha TeaLab','Nguyễn Thu An','Công thức lên men','SpeakMate AI','Lê Minh Khôi','mô hình nhận diện'])
      assert(!json.includes(s),`private field leaked: ${s}`);
    await expectStatus('/pitches/ST-8821/details',403,{token:hai});
    assert.equal((await expectStatus('/pitches/ST-9002/details',200,{token:hai})).brand_name,'SpeakMate AI');
    await expectStatus('/pitches/ST-9002/details',403,{token:quan});
  });
  let reqId;
  await check('Conflict shield requires explicit red-alert acknowledgement',async()=>{
    const r=await expectStatus('/pitches/ST-8821/access-requests',201,{method:'POST',token:hai});
    reqId=r.id;assert.equal(r.risk_level,'RED_ALERT');assert.equal(r.similarity_percent,92);
    await expectStatus('/pitches/ST-8821/access-requests',409,{method:'POST',token:hai});
    await expectStatus(`/access-requests/${reqId}/decision`,409,{method:'POST',token:tea,body:{action:'APPROVE'}});
    await expectStatus(`/access-requests/${reqId}/decision`,201,{method:'POST',token:tea,body:{action:'APPROVE',acknowledge_conflict:true}});
    await expectStatus(`/access-requests/${reqId}/decision`,409,{method:'POST',token:tea,body:{action:'APPROVE',acknowledge_conflict:true}});
    assert.equal((await expectStatus('/pitches/ST-8821/details',200,{token:hai})).brand_name,'Kombucha TeaLab');
    await expectStatus('/pitches/ST-8821/details',403,{token:quan});
  });
  await check('Smart Escrow prevents unauthorized and duplicate payouts',async()=>{
    const deals=await expectStatus('/deals',200,{token:hai});
    const deal=deals.find(x=>x.id==='ESC-904');assert(deal);
    const second=deal.milestones.find(x=>x.sequence===2);
    assert.equal(second.gross_minor,8000000);
    assert.equal(second.fee_minor,400000);
    assert.equal(second.net_minor,7600000);
    await expectStatus(`/milestones/${second.id}/approve-and-release`,403,{method:'POST',token:speak});
    const paid=await expectStatus(`/milestones/${second.id}/approve-and-release`,201,{method:'POST',token:hai});
    assert.equal(paid.milestones.find(x=>x.id===second.id).status,'SIMULATED_PAID');
    await expectStatus(`/milestones/${second.id}/approve-and-release`,409,{method:'POST',token:hai});
    const third=paid.milestones.find(x=>x.sequence===3);
    await expectStatus(`/milestones/${third.id}/approve-and-release`,409,{method:'POST',token:hai});
  });
  await check('New deal enforces grant, KPI allocation and evidence-before-payout',async()=>{
    await expectStatus('/deals',403,{method:'POST',token:tea,body:{
      pitch_id:'ST-8821',committed_usd:1000,milestones:[
        {target:'Giai đoạn kiểm thử MVP',allocation_percent:100}]
    }});
    const body={pitch_id:'ST-8821',committed_usd:20000,milestones:[
      {target:'Hoàn thiện sản phẩm thương mại',allocation_percent:30},
      {target:'Đạt doanh thu tháng đã cam kết',allocation_percent:40},
      {target:'Mở rộng hệ thống phân phối',allocation_percent:30}
    ]};
    const newDeal=await expectStatus('/deals',201,{method:'POST',token:hai,body});
    assert.equal(newDeal.milestones.length,3);
    const ms=newDeal.milestones[0];
    assert.equal(ms.gross_minor,600000);
    await expectStatus(`/milestones/${ms.id}/approve-and-release`,409,{method:'POST',token:hai});
    await expectStatus(`/milestones/${ms.id}/evidence`,403,{method:'POST',token:hai,body:{evidence:'Investor cannot submit evidence'}});
    await expectStatus(`/milestones/${ms.id}/evidence`,201,{method:'POST',token:tea,body:{evidence:'Biên bản nghiệm thu bản demo'}});
    const released=await expectStatus(`/milestones/${ms.id}/approve-and-release`,201,{method:'POST',token:hai});
    assert.equal(released.milestones[0].status,'SIMULATED_PAID');
    assert.equal(released.milestones[0].net_minor,570000);
    await expectStatus(`/milestones/${ms.id}/approve-and-release`,409,{method:'POST',token:hai});
    await expectStatus('/deals',409,{method:'POST',token:hai,body});
  });
  await check('Quota: 10 progress updates per calendar month',async()=>{
    const p=(await expectStatus('/startups/me/pitches',200,{token:tea}))[0];
    assert.equal(p.monthly_updates_used,4);
    for(let i=0;i<6;i++)await expectStatus('/pitches/ST-8821/progress-updates',201,{method:'POST',token:tea,body:{content:`Automated test progress #${i}`}});
    await expectStatus('/pitches/ST-8821/progress-updates',409,{method:'POST',token:tea,body:{content:'Eleventh update should fail'}});
    assert.equal((await expectStatus('/pitches/ST-8821/progress-updates',200,{token:tea})).length,10);
    await expectStatus('/pitches/ST-8821/progress-updates',403,{token:speak});
  });
  let draftId;
  await check('New Startup pitch → demo fee → AI MOCK → blind publication',async()=>{
    const newPitch=await expectStatus('/pitches',201,{method:'POST',token:newStartup,body:{
      industry:'GreenTech',industry_tags:['greentech','climate'],target_usd:80000,
      equity_percent:10,brand_name:'SECRETPROJECT_FOR_TESTS',founder_name:'PRIVATEFOUNDER_TEST',
      secret:'PRIVATESECRET_NEVER_IN_FEED',private_details:'Prototype in pilot stage'
    }});
    draftId=newPitch.pitch_id;
    await expectStatus(`/pitches/${draftId}/submit`,409,{method:'POST',token:newStartup});
    await expectStatus(`/pitches/${draftId}/demo-pay`,201,{method:'POST',token:newStartup});
    await expectStatus(`/pitches/${draftId}/demo-pay`,409,{method:'POST',token:newStartup});
    const reviewed=await expectStatus(`/pitches/${draftId}/submit`,201,{method:'POST',token:newStartup});
    assert.equal(reviewed.status,'APPROVED');
    await expectStatus(`/pitches/${draftId}/submit`,409,{method:'POST',token:newStartup});
    const feed=await expectStatus('/pitches/feed',200,{token:quan});
    assert(feed.some(x=>x.pitch_id===draftId));
    const json=JSON.stringify(feed);
    for(const s of ['SECRETPROJECT_FOR_TESTS','PRIVATEFOUNDER_TEST','PRIVATESECRET_NEVER_IN_FEED'])
      assert(!json.includes(s),`private data leaked: ${s}`);
  });
  await check('New pitch revision revokes previously granted access',async()=>{
    const request=await expectStatus(`/pitches/${draftId}/access-requests`,201,{method:'POST',token:quan});
    await expectStatus(`/access-requests/${request.id}/decision`,201,{method:'POST',token:newStartup,body:{action:'APPROVE'}});
    await expectStatus(`/pitches/${draftId}/details`,200,{token:quan});
    const edited=await expectStatus(`/pitches/${draftId}`,200,{method:'PATCH',token:newStartup,body:{
      industry:'GreenTech',industry_tags:['greentech','climate'],target_usd:80000,
      equity_percent:11,brand_name:'SECRETPROJECT_FOR_TESTS_V2',founder_name:'PRIVATEFOUNDER_TEST',
      secret:'REVISED_PRIVATE_SECRET',private_details:'New confidential product revision'
    }});
    assert.equal(edited.status,'DRAFT');
    await expectStatus(`/pitches/${draftId}/details`,403,{token:quan});
    await expectStatus(`/pitches/${draftId}/access-requests`,409,{method:'POST',token:quan});
    const reviewed=await expectStatus(`/pitches/${draftId}/submit`,201,{method:'POST',token:newStartup});
    assert.equal(reviewed.status,'APPROVED');
    const again=await expectStatus(`/pitches/${draftId}/access-requests`,201,{method:'POST',token:quan});
    await expectStatus(`/access-requests/${again.id}/decision`,201,{method:'POST',token:newStartup,body:{action:'APPROVE'}});
    assert.equal((await expectStatus(`/pitches/${draftId}/details`,200,{token:quan})).brand_name,'SECRETPROJECT_FOR_TESTS_V2');
  });
  await check('Admin audit reflects actions and is role protected',async()=>{
    const logs=await expectStatus('/admin/audit',200,{token:admin});
    assert(logs.some(x=>x.action==='SIMULATED_PAYOUT'));
    assert(logs.some(x=>x.action==='ACCESS_APPROVED'));
  });
  console.log(`\nALL ${passed} SCENARIO CHECKS PASSED.`);
}
(async()=>{
  let error;
  try { await run(); }
  catch (e) {error=e;console.error('\n[FAIL]',e?.stack||e);}
  finally {
    try {
      await reset();
      console.log('[CLEANUP] Reset seeded demo data: OK; old sessions invalidated.');
    } catch(e) {console.error('[CLEANUP FAILED] Reset manually as Admin:',e?.message||e);error ||= e;}
  }
  if(error) process.exitCode=1;
})();
