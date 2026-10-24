import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Pitch, User, Prisma, AccessRequest } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from './prisma.service';
import { AiAdapter } from './ai';
import { PitchDto, ProgressDto, DecisionDto, EvidenceDto, DealDto } from './dto';
import { seedDatabase } from './demo.seed';

const DEMO_FEE_BPS = 500n;
const LIMIT_UPDATES = 10;
const dollars = (value: bigint):number => Number(value); // bounded demo inputs; safe under 2^53
const newId = (prefix:string):string => prefix + randomUUID().replace(/-/g,'').slice(0,8).toUpperCase();
const periodNow = ():string => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date());

@Injectable()
export class TrustbridgeService {
  constructor(private readonly db:PrismaService, private readonly ai:AiAdapter) {}
  require(user:User, role:'STARTUP'|'INVESTOR'|'ADMIN') {
    if (user.role !== role) throw new ForbiddenException(`Yêu cầu vai trò ${role}`);
  }
  verified(user:User) {
    this.require(user, 'INVESTOR');
    if (!user.ekycVerified) throw new ForbiddenException('Investor cần hoàn tất eKYC');
  }
  async pitch(id:string) {
    const p = await this.db.pitch.findUnique({where:{id}});
    if (!p) throw new NotFoundException('Không tìm thấy hồ sơ');
    return p;
  }
  async ownPitch(id:string,user:User) {
    this.require(user,'STARTUP');
    const p = await this.pitch(id);
    if (p.startupId !== user.id) throw new ForbiddenException('Bạn không sở hữu hồ sơ này');
    return p;
  }
  private async audit(actor:User|null, action:string, subject:string, detail='') {
    await this.db.auditLog.create({data:{actorId:actor?.id ?? null,action,subject,detail}});
  }
  private blind(p:Pitch, accessStatus='NOT_REQUESTED') {
    // EXPLICIT ALLOWLIST: never return ORM pitch object here; private data never leaves the server.
    return {pitch_id:p.id, industry:p.industry,
      funding_target:{amount_minor:dollars(p.targetCents),currency:'USD'}, equity_percent:p.equityPercent,
      ai_trust_score:p.aiScore, public_ai_summary:p.publicAiSummary, status:p.status,
      monthly_updates_used:p.updatesPeriod===periodNow()?p.updatesUsed:0,
      monthly_updates_limit:LIMIT_UPDATES, ai_provider:p.aiProvider, access_status:accessStatus};
  }
  private privatePitch(p:Pitch) {
    return {...this.blind(p), industry_tags:p.industryTags, brand_name:p.brandName,founder_name:p.founderName,
      secret:p.secret,private_details:p.privateDetails,
      agent_breakdown:{feasibility_score:p.feasibilityScore,financial_score:p.financialScore,
        risk_spam_score:p.riskScore},version:p.version,
      ai_reviewed_version:p.aiReviewedVersion,payment_status:p.paymentStatus};
  }
  async myPitches(user:User) {
    this.require(user,'STARTUP');
    return (await this.db.pitch.findMany({where:{startupId:user.id}})).map(p=>this.privatePitch(p));
  }
  async feed(user:User) {
    this.verified(user);
    const pitches=await this.db.pitch.findMany({where:{status:'PUBLISHED'},orderBy:{id:'asc'}});
    const requests=await this.db.accessRequest.findMany({where:{investorId:user.id},select:{pitchId:true,status:true}});
    const statuses=new Map(requests.map(r=>[r.pitchId,r.status]));
    return pitches.map(p=>this.blind(p,statuses.get(p.id)));
  }
  async createPitch(data:PitchDto,user:User) {
    this.require(user,'STARTUP');
    if (await this.db.pitch.findUnique({where:{startupId:user.id}}))
      throw new ConflictException('Mỗi Startup chỉ có 01 hồ sơ theo quy tắc demo');
    try {
      const p=await this.db.pitch.create({data:{id:newId('ST-'),startupId:user.id,
        industry:data.industry,industryTags:data.industry_tags,targetCents:BigInt(data.target_usd)*100n,
        equityPercent:data.equity_percent,brandName:data.brand_name,founderName:data.founder_name,
        secret:data.secret || '',privateDetails:data.private_details || ''}});
      await this.audit(user,'CREATE_PITCH',p.id);
      return this.privatePitch(p);
    } catch(err) {this.uniqueError(err);throw err;}
  }
  async editPitch(id:string,data:PitchDto,user:User) {
    await this.ownPitch(id,user);
    if (await this.db.deal.count({where:{pitchId:id}})) throw new ConflictException('Hồ sơ đã có deal');
    const p=await this.db.$transaction(async tx=>{
      // Old grants and requests must not silently apply to new confidential content.
      await tx.accessGrant.deleteMany({where:{pitchId:id}});
      await tx.accessRequest.deleteMany({where:{pitchId:id}});
      const updated=await tx.pitch.update({where:{id},data:{industry:data.industry,industryTags:data.industry_tags,
        targetCents:BigInt(data.target_usd)*100n,equityPercent:data.equity_percent,
        brandName:data.brand_name,founderName:data.founder_name,
        secret:data.secret || '',privateDetails:data.private_details || '',
        version:{increment:1},status:'DRAFT',aiScore:null,publicAiSummary:'',
        feasibilityScore:null,financialScore:null,riskScore:null,aiReviewedVersion:null}});
      await tx.auditLog.create({data:{actorId:user.id,action:'EDIT_PITCH_REVOKE_ACCESS',subject:id,
        detail:'New draft revision: previous requests and grants invalidated'}});
      return updated;
    });
    return this.privatePitch(p);
  }
  async demoPay(id:string,user:User) {
    await this.ownPitch(id,user);
    const updated=await this.db.pitch.updateMany({where:{id,paymentStatus:'UNPAID'},data:{paymentStatus:'DEMO_PAID'}});
    if (!updated.count) throw new ConflictException('Đã ghi nhận phí hồ sơ');
    await this.audit(user,'SIMULATED_PROFILE_PAYMENT',id,'$10 USD demo only');
    return {pitch_id:id,status:'DEMO_PAID',amount_minor:1000,currency:'USD',money_mode:'SIMULATION_ONLY'};
  }
  async submitPitch(id:string,user:User) {
    const p=await this.ownPitch(id,user);
    if (p.paymentStatus!=='DEMO_PAID') throw new ConflictException('Cần ghi nhận phí hồ sơ mô phỏng trước khi chấm AI');
    if (p.status==='PUBLISHED' && p.aiReviewedVersion===p.version)
      throw new ConflictException('Phiên bản hiện tại đã được chấm');
    const score=await this.ai.review(p);
    const approved=score.status==='APPROVED' && !score.is_spam_or_violated;
    // Public summary comes exclusively from non-sensitive, locally selected fields.
    // AI-provided narrative may contain founder names / secrets copied from the input.
    const safeSummary=`Đánh giá ${this.ai.provider === 'MOCK' ? 'mô phỏng' : 'AI'}: ngành ${p.industry}, điểm tín nhiệm ${score.ai_trust_score}/100. Thông tin tài chính cần thẩm định độc lập.`;
    try {
      await this.db.$transaction(async tx=>{
        const result=await tx.pitch.updateMany({where:{id,version:p.version,status:p.status},data:{
          status:approved?'PUBLISHED':'REJECTED',aiScore:score.ai_trust_score,
          feasibilityScore:score.agent_breakdown.feasibility_score,
          financialScore:score.agent_breakdown.financial_score,
          riskScore:score.agent_breakdown.risk_spam_score,publicAiSummary:safeSummary,
          aiReviewedVersion:p.version,aiProvider:this.ai.provider}});
        if (!result.count) throw new ConflictException('Hồ sơ đã thay đổi khi AI đang thẩm định');
        await tx.aiReview.create({data:{pitchId:id,pitchVersion:p.version,score:score.ai_trust_score,
          breakdown:score.agent_breakdown,summary:safeSummary,provider:this.ai.provider}});
        await tx.auditLog.create({data:{actorId:user.id,action:'AI_REVIEW',subject:id,detail:this.ai.provider}});
      });
      return {...score, public_ai_summary:safeSummary, monthly_updates_used:p.updatesPeriod===periodNow()?p.updatesUsed:0,monthly_updates_limit:10};
    } catch(err) {this.uniqueError(err);throw err;}
  }
  async addProgress(id:string,data:ProgressDto,user:User) {
    await this.ownPitch(id,user);
    const month=periodNow();
    await this.db.$transaction(async tx=>{
      await tx.pitch.updateMany({where:{id,updatesPeriod:{not:month}},data:{updatesPeriod:month,updatesUsed:0}});
      const changed=await tx.pitch.updateMany({where:{id,updatesPeriod:month,updatesUsed:{lt:LIMIT_UPDATES}},
        data:{updatesUsed:{increment:1}}});
      if (!changed.count) throw new ConflictException('Đã hết 10 lượt cập nhật trong tháng');
      await tx.progressUpdate.create({data:{pitchId:id,content:data.content,period:month}});
      await tx.auditLog.create({data:{actorId:user.id,action:'ADD_PROGRESS',subject:id}});
    });
    const p=await this.pitch(id);
    return {pitch_id:id,monthly_updates_used:p.updatesUsed,monthly_updates_limit:10};
  }
  async progressHistory(id:string,user:User) {
    const pitch=await this.pitch(id);
    if (pitch.startupId!==user.id && user.role!=='ADMIN')
      throw new ForbiddenException('Chỉ chủ dự án được xem toàn bộ nhật ký tiến độ trong demo');
    const rows=await this.db.progressUpdate.findMany({where:{pitchId:id},orderBy:{id:'desc'},take:30});
    return rows.map(r=>({id:r.id,pitch_id:r.pitchId,content:r.content,period:r.period,created_at:r.createdAt.toISOString()}));
  }
  private async privateAccess(p:Pitch,user:User) {
    if (user.role==='ADMIN') return true;
    if (user.role==='STARTUP') return p.startupId===user.id;
    if (user.role==='INVESTOR' && user.ekycVerified && p.status==='PUBLISHED') {
      const grant=await this.db.accessGrant.findUnique({where:{pitchId_investorId:{pitchId:p.id,investorId:user.id}}});
      return Boolean(grant && !grant.revoked);
    }
    return false;
  }
  async privateDetails(id:string,user:User) {
    const p=await this.pitch(id);
    if (!(await this.privateAccess(p,user))) throw new ForbiddenException('Hồ sơ bị khóa, cần Startup cấp quyền');
    await this.audit(user,'VIEW_PRIVATE_PITCH',id);
    return this.privatePitch(p);
  }
  private requestDto(req:AccessRequest,investor:User) {
    const holdings=Array.isArray(investor.holdings)?investor.holdings as any[]:[];
    return {id:req.id,pitch_id:req.pitchId,investor_id:req.investorId,
      investor_name:investor.displayName,ekyc_verified:investor.ekycVerified,
      owned_companies:holdings.map(h=>String(h.company||'')),status:req.status,risk_level:req.riskLevel,
      similarity_percent:req.similarityPercent,warning_message:req.warningMessage,
      decision_note:req.decisionNote,conflict_provider:req.conflictProvider};
  }
  async requestAccess(id:string,user:User) {
    this.verified(user);
    const p=await this.pitch(id);
    if (p.status!=='PUBLISHED') throw new ConflictException('Hồ sơ không được công khai');
    if (await this.db.accessRequest.findUnique({where:{pitchId_investorId:{pitchId:id,investorId:user.id}}}))
      throw new ConflictException('Bạn đã gửi yêu cầu cho hồ sơ này');
    const report=await this.ai.conflict(p,user);
    try {
      const req=await this.db.accessRequest.create({data:{pitchId:id,investorId:user.id,
        riskLevel:report.risk_level,similarityPercent:report.similarity_percent,
        warningMessage:report.warning_message,conflictProvider:this.ai.provider}});
      await this.audit(user,'REQUEST_ACCESS',id,report.risk_level);
      return this.requestDto(req,user);
    } catch(err) {this.uniqueError(err);throw err;}
  }
  async incoming(user:User) {
    this.require(user,'STARTUP');
    const requests=await this.db.accessRequest.findMany({where:{pitch:{startupId:user.id}},
      include:{investor:true},orderBy:{id:'desc'}});
    return requests.map(r=>this.requestDto(r,r.investor));
  }
  async decide(id:number,data:DecisionDto,user:User) {
    this.require(user,'STARTUP');
    const req=await this.db.accessRequest.findUnique({where:{id},include:{pitch:true,investor:true}});
    if (!req) throw new NotFoundException('Không tìm thấy yêu cầu');
    if (req.pitch.startupId !== user.id) throw new ForbiddenException('Không có quyền quyết định yêu cầu này');
    if (req.riskLevel==='RED_ALERT' && data.action==='APPROVE' && !data.acknowledge_conflict)
      throw new ConflictException('Phải xác nhận đã đọc cảnh báo xung đột trước khi mở khóa');
    const status=data.action==='APPROVE'?'APPROVED':'REJECTED';
    try {
      await this.db.$transaction(async tx=>{
        const changed=await tx.accessRequest.updateMany({where:{id,status:'PENDING'},
          data:{status,decisionNote:data.note||'',conflictAcknowledged:!!data.acknowledge_conflict,decidedAt:new Date()}});
        if (!changed.count) throw new ConflictException('Yêu cầu đã được xử lý');
        if (data.action==='APPROVE') await tx.accessGrant.create({data:{pitchId:req.pitchId,
          investorId:req.investorId,grantedBy:user.id}});
        await tx.auditLog.create({data:{actorId:user.id,action:'ACCESS_'+status,subject:req.pitchId,
          detail:JSON.stringify({risk:req.riskLevel,acknowledged:!!data.acknowledge_conflict,note:data.note||''})}});
      });
    } catch(err) {this.uniqueError(err);throw err;}
    const updated=await this.db.accessRequest.findUniqueOrThrow({where:{id}});
    return this.requestDto(updated,req.investor);
  }
  private async dealAccess(id:string,user:User) {
    const d=await this.db.deal.findUnique({where:{id},include:{pitch:true}});
    if (!d) throw new NotFoundException('Không tìm thấy deal');
    if (user.role!=='ADMIN' && user.id!==d.investorId && user.id!==d.pitch.startupId)
      throw new ForbiddenException('Bạn không tham gia deal');
    return d;
  }
  private async dealDto(id:string) {
    const deal=await this.db.deal.findUniqueOrThrow({where:{id},include:{pitch:true,investor:true,
      milestones:{orderBy:{sequence:'asc'},include:{payout:true}}}});
    return {id:deal.id,pitch_id:deal.pitchId,pitch_name:deal.pitch.brandName,
      investor_id:deal.investorId,investor_name:deal.investor.displayName,
      committed_minor:dollars(deal.committedCents),currency:'USD',fee_percent:deal.feeBps/100,
      status:deal.status,money_mode:'SIMULATION_ONLY',
      milestones:deal.milestones.map(ms=>{
        const fee=(ms.grossCents*BigInt(deal.feeBps)+5000n)/10000n;
        return {id:ms.id,sequence:ms.sequence,target:ms.target,allocation_percent:ms.allocationPercent,
          gross_minor:dollars(ms.grossCents),fee_minor:dollars(fee),net_minor:dollars(ms.grossCents-fee),
          status:ms.status,evidence:ms.evidence,
          payout:ms.payout?{id:ms.payout.id,status:ms.payout.status,gross_minor:dollars(ms.payout.grossCents),
            fee_minor:dollars(ms.payout.feeCents),net_minor:dollars(ms.payout.netCents),provider:ms.payout.provider}:null};
      })};
  }
  async deals(user:User) {
    const where:Prisma.DealWhereInput = user.role==='ADMIN'?{}:
      user.role==='INVESTOR'?{investorId:user.id}:{pitch:{startupId:user.id}};
    const rows=await this.db.deal.findMany({where,select:{id:true},orderBy:{id:'asc'}});
    return Promise.all(rows.map(r=>this.dealDto(r.id)));
  }
  async deal(id:string,user:User) {await this.dealAccess(id,user);return this.dealDto(id);}
  async createDeal(data:DealDto,user:User) {
    this.verified(user);
    const p=await this.pitch(data.pitch_id);
    if (p.status!=='PUBLISHED' || !(await this.privateAccess(p,user)))
      throw new ForbiddenException('Cần được Startup cấp quyền trước khi tạo deal');
    if (data.milestones.reduce((sum,row)=>sum+row.allocation_percent,0)!==100)
      throw new BadRequestException('Tổng tỷ lệ KPI phải bằng 100%');
    const committed=BigInt(data.committed_usd)*100n;
    const id=newId('ESC-');
    try {
      await this.db.$transaction(async tx=>{
        const existing=await tx.deal.findMany({where:{pitchId:p.id},select:{committedCents:true}});
        if (existing.reduce((sum,row)=>sum+row.committedCents,0n)+committed>p.targetCents)
          throw new BadRequestException('Tổng vốn deal vượt mục tiêu gọi vốn demo');
        if (await tx.deal.findUnique({where:{pitchId_investorId:{pitchId:p.id,investorId:user.id}}}))
          throw new ConflictException('Deal với Startup này đã tồn tại');
        let accumulated=0n;
        const milestones=data.milestones.map((row,i)=>{
          const gross=i===data.milestones.length-1?committed-accumulated:committed*BigInt(row.allocation_percent)/100n;
          accumulated+=gross;
          return {sequence:i+1,target:row.target,allocationPercent:row.allocation_percent,
            grossCents:gross,status:i===0?'AWAITING_EVIDENCE':'LOCKED'};
        });
        await tx.deal.create({data:{id,pitchId:p.id,investorId:user.id,committedCents:committed,
          milestones:{create:milestones}}});
        await tx.auditLog.create({data:{actorId:user.id,action:'CREATE_SIMULATED_DEAL',subject:id}});
      },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    } catch(err) {this.uniqueError(err);throw err;}
    return this.dealDto(id);
  }
  async evidence(id:number,data:EvidenceDto,user:User) {
    this.require(user,'STARTUP');
    const ms=await this.db.milestone.findUnique({where:{id},include:{deal:{include:{pitch:true}}}});
    if (!ms) throw new NotFoundException('Không tìm thấy KPI');
    if (ms.deal.pitch.startupId!==user.id) throw new ForbiddenException('Không sở hữu Startup của deal');
    const prior=await this.db.milestone.findMany({where:{dealId:ms.dealId,sequence:{lt:ms.sequence}}});
    if (prior.some(p=>p.status!=='SIMULATED_PAID')) throw new ConflictException('Chưa hoàn thành KPI trước đó');
    const updated=await this.db.milestone.updateMany({where:{id,status:{in:['AWAITING_EVIDENCE','LOCKED']}},
      data:{evidence:data.evidence,status:'PENDING_APPROVAL'}});
    if (!updated.count) throw new ConflictException('KPI này không nhận bằng chứng mới');
    await this.audit(user,'SUBMIT_KPI_EVIDENCE',String(id));
    return this.dealDto(ms.dealId);
  }
  async release(id:number,user:User) {
    const ms=await this.db.milestone.findUnique({where:{id},include:{deal:true}});
    if (!ms) throw new NotFoundException('Không tìm thấy KPI');
    const deal=await this.dealAccess(ms.dealId,user);
    if (user.role!=='ADMIN' && (user.role!=='INVESTOR'||user.id!==deal.investorId))
      throw new ForbiddenException('Chỉ Investor của deal hoặc Admin được duyệt KPI');
    if (deal.status!=='SIMULATED_FUNDED'||ms.status!=='PENDING_APPROVAL'||!ms.evidence.trim())
      throw new ConflictException('KPI chưa có bằng chứng hoặc chưa chờ duyệt');
    const prior=await this.db.milestone.findMany({where:{dealId:deal.id,sequence:{lt:ms.sequence}}});
    if (prior.some(p=>p.status!=='SIMULATED_PAID')) throw new ConflictException('Cần hoàn thành KPI trước');
    try {
      await this.db.$transaction(async tx=>{
        const result=await tx.milestone.updateMany({where:{id,status:'PENDING_APPROVAL'},
          data:{status:'SIMULATED_PAID'}});
        if (!result.count) throw new ConflictException('KPI đã được giải ngân; không thực hiện trùng');
        const fee=(ms.grossCents*DEMO_FEE_BPS+5000n)/10000n;
        await tx.payout.create({data:{milestoneId:id,grossCents:ms.grossCents,
          feeCents:fee,netCents:ms.grossCents-fee,
          ledger:{create:[{account:'DEMO_ESCROW',signedCents:-ms.grossCents},
            {account:'PLATFORM_FEE',signedCents:fee},{account:'STARTUP',signedCents:ms.grossCents-fee}]}}});
        await tx.auditLog.create({data:{actorId:user.id,action:'SIMULATED_PAYOUT',subject:deal.id,
          detail:JSON.stringify({milestone:id,gross_minor:dollars(ms.grossCents)})}});
      });
    } catch(err) {this.uniqueError(err);throw err;}
    return this.dealDto(deal.id);
  }
  async adminAudit(user:User) {
    this.require(user,'ADMIN');
    const rows=await this.db.auditLog.findMany({orderBy:{id:'desc'},take:50});
    return rows.map(r=>({id:r.id,actor_id:r.actorId,action:r.action,subject:r.subject,
      detail:r.detail,created_at:r.createdAt.toISOString()}));
  }
  async reset(user:User) {
    this.require(user,'ADMIN');
    // Demo-only. Serial seed reset must NEVER be exposed outside a trusted local demonstration.
    await seedDatabase(this.db,true);
    return {status:'RESET',message:'Đã khôi phục dữ liệu demo; không có chuyển tiền thật.'};
  }
  private uniqueError(err:unknown) {
    if (err && typeof err==='object' && 'code' in err &&
      ((err as any).code==='P2002'||(err as any).code==='P2034'))
      throw new ConflictException('Dữ liệu trùng hoặc giao dịch đã được xử lý đồng thời');
  }
}
