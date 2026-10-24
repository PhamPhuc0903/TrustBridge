import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
export const ACCOUNTS = [
  {email:'hai@demo.test',name:'Trần Hoàng Hải',role:'INVESTOR'},
  {email:'quan@demo.test',name:'Nguyễn Minh Quân',role:'INVESTOR'},
  {email:'tea@demo.test',name:'Startup Kombucha TeaLab',role:'STARTUP'},
  {email:'speak@demo.test',name:'Startup SpeakMate AI',role:'STARTUP'},
  {email:'new@demo.test',name:'Startup Mới',role:'STARTUP'},
  {email:'admin@demo.test',name:'Admin Demo',role:'ADMIN'},
];
export async function seedDatabase(db:PrismaClient, reset=false) {
  if (reset) {
    // Only for local classroom demo. Never expose in a public environment.
    await db.ledgerEntry.deleteMany();
    await db.payout.deleteMany();
    await db.auditLog.deleteMany();
    await db.milestone.deleteMany();
    await db.deal.deleteMany();
    await db.accessGrant.deleteMany();
    await db.accessRequest.deleteMany();
    await db.aiReview.deleteMany();
    await db.progressUpdate.deleteMany();
    await db.pitch.deleteMany();
    await db.user.deleteMany();
  }
  if (await db.user.count()) return;
  const passwd = await bcrypt.hash('Demo123!', 11);
  const users = new Map<string, number>();
  for (const account of ACCOUNTS) {
    const holdings = account.email==='hai@demo.test' ? [
      {company:'Chuỗi Trà Sữa RoyalTea VN',tags:['fnb','beverage']},
      {company:'Công ty Bao bì Xanh',tags:['packaging']}
    ] : account.email==='quan@demo.test' ? [
      {company:'NextGen Ventures (Logistics & BĐS)',tags:['logistics','real_estate']}
    ] : [];
    const user = await db.user.create({data:{email:account.email,displayName:account.name,
      role:account.role,passwordHash:passwd,ekycVerified:account.role==='INVESTOR',holdings}});
    users.set(account.email,user.id);
  }
  const uid=(email:string)=>users.get(email)!;
  const month = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit'}).format(new Date());
  await db.pitch.create({data:{id:'ST-8821',startupId:uid('tea@demo.test'),industry:'F&B / Đồ uống',
    industryTags:['fnb','beverage'],targetCents:15000000n,equityPercent:15,
    brandName:'Kombucha TeaLab',founderName:'Nguyễn Thu An',
    secret:'Công thức lên men lạnh 48h và danh sách mặt bằng đang đàm phán.',
    privateDetails:'Đã thử nghiệm 2 điểm bán. Gross margin 68% (dữ liệu mô phỏng).',
    status:'PUBLISHED',paymentStatus:'DEMO_PAID',updatesPeriod:month,updatesUsed:4,
    aiScore:88,feasibilityScore:90,financialScore:85,riskScore:89,
    publicAiSummary:'Demo AI: 2 điểm bán thử nghiệm, biên lãi gộp 68% được khai báo. Cần kiểm chứng chứng từ.',
    aiReviewedVersion:1}});
  await db.pitch.create({data:{id:'ST-9002',startupId:uid('speak@demo.test'),industry:'EdTech / AI',
    industryTags:['edtech','saas'],targetCents:20000000n,equityPercent:12,
    brandName:'SpeakMate AI',founderName:'Lê Minh Khôi',
    secret:'Mô hình nhận diện phát âm riêng, mục tiêu độ trễ dưới 200ms.',
    privateDetails:'12.000 người dùng trả phí được khai báo (dữ liệu demo).',
    status:'PUBLISHED',paymentStatus:'DEMO_PAID',aiScore:92,feasibilityScore:95,
    financialScore:90,riskScore:91,
    publicAiSummary:'Demo AI: sản phẩm EdTech có người dùng trả phí được khai báo; cần kiểm tra MRR.',
    aiReviewedVersion:1}});
  await db.progressUpdate.createMany({data:Array.from({length:4},(_,i)=>({
    pitchId:'ST-8821',period:month,content:`Tiến độ demo tháng hiện tại #${i+1}`}))});
  await db.aiReview.createMany({data:[
    {pitchId:'ST-8821',pitchVersion:1,score:88,
      breakdown:{feasibility_score:90,financial_score:85,risk_spam_score:89},
      summary:'Demo AI: biên lợi nhuận 68% được khai báo',provider:'MOCK'},
    {pitchId:'ST-9002',pitchVersion:1,score:92,
      breakdown:{feasibility_score:95,financial_score:90,risk_spam_score:91},
      summary:'Demo AI: người dùng trả phí được khai báo',provider:'MOCK'}
  ]});
  await db.accessRequest.create({data:{pitchId:'ST-8821',investorId:uid('quan@demo.test'),
    status:'PENDING',riskLevel:'LOW',similarityPercent:0,
    warningMessage:'Demo AI: chưa phát hiện công ty cạnh tranh trong danh mục khai báo.'}});
  await db.accessRequest.create({data:{pitchId:'ST-9002',investorId:uid('hai@demo.test'),
    status:'APPROVED',riskLevel:'LOW',similarityPercent:0,
    warningMessage:'Demo AI: chưa phát hiện xung đột ngành.'}});
  await db.accessGrant.create({data:{pitchId:'ST-9002',investorId:uid('hai@demo.test'),
    grantedBy:uid('speak@demo.test')}});
  await db.deal.create({data:{id:'ESC-904',pitchId:'ST-9002',investorId:uid('hai@demo.test'),
    committedCents:20000000n,feeBps:500,status:'SIMULATED_FUNDED',
    milestones:{create:[
      {sequence:1,allocationPercent:30,target:'Ra mắt app iOS/Android & đạt 5.000 users',
        grossCents:6000000n,status:'SIMULATED_PAID',evidence:'Báo cáo users minh họa.'},
      {sequence:2,allocationPercent:40,target:'MRR đạt ít nhất $25.000 / tháng',
        grossCents:8000000n,status:'PENDING_APPROVAL',evidence:'Stripe và sao kê demo: MRR $26.400.'},
      {sequence:3,allocationPercent:30,target:'Ký hợp đồng B2B với 10 trường quốc tế',
        grossCents:6000000n,status:'LOCKED'}]}}});
  const kpi1=await db.milestone.findUniqueOrThrow({where:{dealId_sequence:{dealId:'ESC-904',sequence:1}}});
  await db.payout.create({data:{milestoneId:kpi1.id,grossCents:6000000n,feeCents:300000n,
    netCents:5700000n,ledger:{create:[
      {account:'DEMO_ESCROW',signedCents:-6000000n},
      {account:'PLATFORM_FEE',signedCents:300000n},
      {account:'STARTUP',signedCents:5700000n}]}}});
  await db.auditLog.create({data:{action:'SEED_DEMO',subject:'DATABASE',detail:'Fictional classroom demonstration only'}});
}
