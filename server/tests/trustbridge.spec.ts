import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TrustbridgeService } from '../src/trustbridge.service';
import { AiAdapter } from '../src/ai';

const investor = {id:4, role:'INVESTOR',ekycVerified:true,holdings:[]};
const startup = {id:7,role:'STARTUP',ekycVerified:false};
const p = {id:'ST-8821',startupId:7,industry:'F&B',targetCents:15000000n,
  equityPercent:15,brandName:'SECRET_BRAND',founderName:'SECRET_FOUNDER',
  secret:'SECRET_FORMULA',privateDetails:'SECRET_DATA',status:'PUBLISHED',
  updatesPeriod:'',updatesUsed:0,aiScore:88,publicAiSummary:'Thông tin công khai',aiProvider:'MOCK'};

describe('TrustBridge critical backend policies',()=>{
  it('Blind feed uses a strict allowlist, even for authenticated investors',async()=>{
    const db:any={pitch:{findMany:jest.fn().mockResolvedValue([p])},
      accessRequest:{findMany:jest.fn().mockResolvedValue([])}};
    const service=new TrustbridgeService(db, {} as AiAdapter);
    const result=await service.feed(investor as any);
    const json=JSON.stringify(result);
    expect(result).toHaveLength(1);
    for(const secret of ['SECRET_BRAND','SECRET_FOUNDER','SECRET_FORMULA','SECRET_DATA'])
      expect(json).not.toContain(secret);
    expect(result[0].funding_target.amount_minor).toBe(15000000);
  });
  it('Rejects private pitch access without an explicit grant',async()=>{
    const db:any={pitch:{findUnique:jest.fn().mockResolvedValue(p)},
      accessGrant:{findUnique:jest.fn().mockResolvedValue(null)}};
    const service=new TrustbridgeService(db, {} as AiAdapter);
    await expect(service.privateDetails('ST-8821',investor as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('Requires acknowledging the red conflict alert before startup approval',async()=>{
    const db:any={accessRequest:{findUnique:jest.fn().mockResolvedValue({id:1,pitchId:'ST-8821',
      pitch:{startupId:7},riskLevel:'RED_ALERT',investor})}};
    const service=new TrustbridgeService(db, {} as AiAdapter);
    await expect(service.decide(1,{action:'APPROVE'},startup as any)).rejects.toBeInstanceOf(ConflictException);
  });
  it('Rejects a repeat payout attempt before writing another ledger entry',async()=>{
    const db:any={milestone:{findUnique:jest.fn().mockResolvedValue({id:2,dealId:'ESC-904',
      status:'SIMULATED_PAID',evidence:'Ready',deal:{}})},
      deal:{findUnique:jest.fn().mockResolvedValue({id:'ESC-904',investorId:4,
        status:'SIMULATED_FUNDED',pitch:{startupId:7}})}};
    const service=new TrustbridgeService(db, {} as AiAdapter);
    await expect(service.release(2,investor as any)).rejects.toBeInstanceOf(ConflictException);
  });
  it('Never returns progress history to a startup that does not own the pitch',async()=>{
    const db:any={pitch:{findUnique:jest.fn().mockResolvedValue(p)}};
    const service=new TrustbridgeService(db, {} as AiAdapter);
    await expect(service.progressHistory('ST-8821',{id:999,role:'STARTUP'} as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
  it('Disallows viewing even a published private profile without an AccessGrant',async()=>{
    const db:any={pitch:{findUnique:jest.fn().mockResolvedValue(p)},
      accessGrant:{findUnique:jest.fn().mockResolvedValue({revoked:true})}};
    const service=new TrustbridgeService(db, {} as AiAdapter);
    await expect(service.privateDetails('ST-8821',investor as any))
      .rejects.toBeInstanceOf(ForbiddenException);
  });
  it('Flags overlap of investor holdings with startup industry',async()=>{
    const ai=new AiAdapter();
    const result=await ai.conflict({industryTags:['fnb','beverage']} as any,
      {holdings:[{company:'RoyalTea',tags:['beverage']}]} as any);
    expect(result.risk_level).toBe('RED_ALERT');
    expect(result.similarity_percent).toBe(92);
  });

  it('Pitch revision removes old access grants and requests atomically',async()=>{
    const tx:any={accessGrant:{deleteMany:jest.fn().mockResolvedValue({count:1})},
      accessRequest:{deleteMany:jest.fn().mockResolvedValue({count:1})},
      pitch:{update:jest.fn().mockResolvedValue({...p,industryTags:['fnb'],status:'DRAFT',version:2,
        paymentStatus:'DEMO_PAID',aiReviewedVersion:null,feasibilityScore:null,financialScore:null,riskScore:null})},
      auditLog:{create:jest.fn().mockResolvedValue({})}};
    const db:any={pitch:{findUnique:jest.fn().mockResolvedValue(p)},
      deal:{count:jest.fn().mockResolvedValue(0)},$transaction:jest.fn((fn:any)=>fn(tx))};
    const service=new TrustbridgeService(db,{} as AiAdapter);
    const data:any={industry:'F&B',industry_tags:['fnb'],target_usd:150000,
      equity_percent:15,brand_name:'UPDATED_BRAND',founder_name:'Founder',secret:'New private content'};
    const result=await service.editPitch('ST-8821',data,startup as any);
    expect(result.status).toBe('DRAFT');
    expect(tx.accessGrant.deleteMany).toHaveBeenCalledWith({where:{pitchId:'ST-8821'}});
    expect(tx.accessRequest.deleteMany).toHaveBeenCalledWith({where:{pitchId:'ST-8821'}});
    expect(tx.pitch.update).toHaveBeenCalledTimes(1);
  });
  it('Never publishes an AI-generated narrative containing confidential data',async()=>{
    const pitch={...p,version:1,paymentStatus:'DEMO_PAID',aiReviewedVersion:null};
    const tx:any={pitch:{updateMany:jest.fn().mockResolvedValue({count:1})},
      aiReview:{create:jest.fn().mockResolvedValue({})},auditLog:{create:jest.fn().mockResolvedValue({})}};
    const db:any={pitch:{findUnique:jest.fn().mockResolvedValue(pitch)},
      $transaction:jest.fn((fn:any)=>fn(tx))};
    const ai:any={provider:'HTTP_AI',review:jest.fn().mockResolvedValue({
      pitch_id:'ST-8821',status:'APPROVED',ai_trust_score:90,
      agent_breakdown:{feasibility_score:90,financial_score:90,risk_spam_score:90},
      is_spam_or_violated:false,public_ai_summary:'SECRET_FORMULA',model_version:'test'
    })};
    const service=new TrustbridgeService(db,ai);
    const result=await service.submitPitch('ST-8821',startup as any);
    expect(result.public_ai_summary).not.toContain('SECRET_FORMULA');
    const dbWrite=tx.pitch.updateMany.mock.calls[0][0].data;
    expect(dbWrite.publicAiSummary).not.toContain('SECRET_FORMULA');
  });
});
