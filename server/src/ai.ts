import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Pitch, User } from '@prisma/client';
export type AiScore = {
  pitch_id: string; status: 'APPROVED'|'REJECTED'; ai_trust_score: number;
  agent_breakdown: {feasibility_score:number; financial_score:number; risk_spam_score:number};
  public_ai_summary: string; is_spam_or_violated:boolean; model_version:string;
};
export type ConflictScore = { has_conflict:boolean; risk_level:'RED_ALERT'|'LOW'; similarity_percent:number; warning_message:string; model_version:string; };
const isScore = (n:unknown):n is number => typeof n==='number' && Number.isInteger(n) && n>=0 && n<=100;
@Injectable()
export class AiAdapter {
  get provider() {return process.env.AI_MODE === 'http' ? 'HTTP_AI' : 'MOCK';}
  private async call<T>(endpoint:string, input:unknown): Promise<T> {
    if (!process.env.AI_BASE_URL) throw new ServiceUnavailableException('Thiếu AI_BASE_URL');
    try {
      const base = process.env.AI_BASE_URL.replace(/\/$/, '');
      const res = await fetch(base + endpoint, {method:'POST', headers:{'Content-Type':'application/json',
        'Authorization':`Bearer ${process.env.AI_SERVICE_TOKEN || ''}`},
        body:JSON.stringify(input), signal:AbortSignal.timeout(5000)});
      if (!res.ok) throw new Error('AI service rejected: ' + res.status);
      return await res.json() as T;
    } catch { throw new ServiceUnavailableException('AI service đang không sẵn sàng'); }
  }
  async review(pitch:Pitch):Promise<AiScore> {
    let result:AiScore;
    if (this.provider === 'HTTP_AI') {
      // Pass only necessary private pitch fields, over a trusted local/service network.
      result = await this.call<AiScore>('/review-pitch', {pitch_id:pitch.id, industry:pitch.industry,
        brand_name:pitch.brandName, private_details:pitch.privateDetails,
        target_usd:Number(pitch.targetCents)/100, equity_percent:pitch.equityPercent});
    } else {
      const [f,fin,r] = pitch.id==='ST-8821'?[90,85,89]:pitch.id==='ST-9002'?[95,90,91]:[80,75,79];
      result={pitch_id:pitch.id, status:'APPROVED', ai_trust_score:Math.round((f+fin+r)/3),
        agent_breakdown:{feasibility_score:f,financial_score:fin,risk_spam_score:r},
        public_ai_summary:`Demo AI: hồ sơ ngành ${pitch.industry} có điểm minh họa, chưa được kiểm chứng độc lập.`,
        is_spam_or_violated:false, model_version:'mock-v1'};
    }
    const b = result?.agent_breakdown;
    if (result?.pitch_id !== pitch.id || !isScore(result.ai_trust_score) || !b ||
      !isScore(b.feasibility_score) || !isScore(b.financial_score) || !isScore(b.risk_spam_score) ||
      !['APPROVED','REJECTED'].includes(result.status) || typeof result.public_ai_summary !== 'string' ||
      typeof result.is_spam_or_violated !== 'boolean' || typeof result.model_version !== 'string')
      throw new ServiceUnavailableException('AI trả cấu trúc đánh giá không hợp lệ');
    return result;
  }
  async conflict(pitch:Pitch, investor:User):Promise<ConflictScore> {
    let result:ConflictScore;
    if (this.provider==='HTTP_AI') {
      result = await this.call<ConflictScore>('/conflict-check', {pitch_id:pitch.id,
        pitch_industry_tags:pitch.industryTags, investor_id:investor.id, investor_holdings:investor.holdings});
    } else {
      const tags = Array.isArray(pitch.industryTags)?pitch.industryTags.map(String):[];
      const owned = Array.isArray(investor.holdings)?investor.holdings as any[]:[];
      const overlap = owned.some(h=>Array.isArray(h.tags) && h.tags.some((tag:unknown)=>tags.includes(String(tag))));
      result = {has_conflict:overlap,risk_level:overlap?'RED_ALERT':'LOW',similarity_percent:overlap?92:0,
        warning_message:overlap?'Demo AI: investor có công ty cùng ngành; cân nhắc rủi ro khi mở hồ sơ.':'Demo AI: chưa phát hiện trùng ngành trong danh mục khai báo.',model_version:'mock-v1'};
    }
    if (!result || typeof result.has_conflict!=='boolean' ||
      !['RED_ALERT','LOW'].includes(result.risk_level) || !isScore(result.similarity_percent) ||
      typeof result.warning_message!=='string' || typeof result.model_version!=='string')
      throw new ServiceUnavailableException('AI trả cấu trúc kiểm tra xung đột không hợp lệ');
    return result;
  }
}
