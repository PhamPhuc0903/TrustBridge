// Run after seeding and launching the server: node tests/smoke.cjs
const assert = require('node:assert/strict');
const base=process.env.BASE_URL||'http://localhost:8000/api/v1';
async function req(path,token,method='GET',body){
  const headers={'Content-Type':'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  const r=await fetch(base+path,{method,headers,body:body?JSON.stringify(body):undefined});
  const data=await r.json();return {status:r.status,data};
}
async function login(email){const r=await req('/auth/login',null,'POST',{email,password:'Demo123!'});
  assert.equal(r.status,201,`Login failed ${email}: ${JSON.stringify(r.data)}`);return r.data.access_token;}
(async()=>{
  const hai=await login('hai@demo.test');
  const tea=await login('tea@demo.test');
  const feed=await req('/pitches/feed',hai);assert.equal(feed.status,200);
  const html=JSON.stringify(feed.data);for(const s of ['Kombucha TeaLab','Nguyễn Thu An','Công thức lên men lạnh'])
    assert(!html.includes(s),`Blind privacy violation: ${s}`);
  const before=await req('/pitches/ST-8821/details',hai);assert.equal(before.status,403);
  const request=await req('/pitches/ST-8821/access-requests',hai,'POST');assert.equal(request.status,201);
  assert.equal(request.data.risk_level,'RED_ALERT');
  const badApproval=await req(`/access-requests/${request.data.id}/decision`,tea,'POST',{action:'APPROVE'});
  assert.equal(badApproval.status,409);
  const approved=await req(`/access-requests/${request.data.id}/decision`,tea,'POST',{action:'APPROVE',acknowledge_conflict:true});
  assert.equal(approved.status,201);
  const detail=await req('/pitches/ST-8821/details',hai);assert.equal(detail.status,200);
  assert.equal(detail.data.brand_name,'Kombucha TeaLab');
  const deals=await req('/deals',hai);const deal=deals.data.find(x=>x.id==='ESC-904');assert(deal);
  const kpi=deal.milestones.find(x=>x.sequence===2);
  const release=await req(`/milestones/${kpi.id}/approve-and-release`,hai,'POST');assert.equal(release.status,201);
  const repeat=await req(`/milestones/${kpi.id}/approve-and-release`,hai,'POST');assert.equal(repeat.status,409);
  console.log('Smoke scenario OK: blind privacy, conflict acknowledgement, access and idempotent escrow simulator.');
})().catch(e=>{console.error(e);process.exitCode=1;});
