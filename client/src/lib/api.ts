import type { DemoAccount, User } from '../types';
const BASE = '/api/v1';
const TOKEN_KEY = 'trustbridge-demo-token';
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token:string|null) => token ? sessionStorage.setItem(TOKEN_KEY,token) : sessionStorage.removeItem(TOKEN_KEY);
export class ApiError extends Error {constructor(message:string,public readonly status:number){super(message);this.name='ApiError';}}
export async function api<T>(path:string,options:{method?:'GET'|'POST'|'PATCH'|'DELETE';body?:unknown;signal?:AbortSignal}={}):Promise<T>{
  const headers:Record<string,string>={'Accept':'application/json'};
  if(options.body!==undefined)headers['Content-Type']='application/json';
  if(getToken())headers.Authorization=`Bearer ${getToken()}`;
  let response:Response;
  try{response=await fetch(`${BASE}${path}`,{method:options.method||'GET',headers,body:options.body===undefined?undefined:JSON.stringify(options.body),signal:options.signal});}
  catch(error){if(error instanceof DOMException && error.name==='AbortError')throw error;throw new ApiError('Không thể kết nối máy chủ. Kiểm tra NestJS tại cổng 8000.',0);}
  const payload:unknown=await response.json().catch(()=>null);
  if(!response.ok){const detail=payload&&typeof payload==='object' ? (payload as Record<string,unknown>).message ?? (payload as Record<string,unknown>).detail : null;
    const message=Array.isArray(detail)?detail.map(String).join('; '):typeof detail==='string'?detail:`Yêu cầu thất bại (HTTP ${response.status})`;
    throw new ApiError(message,response.status);
  }
  return payload as T;
}
export const loginApi=(email:string,password:string)=>api<{access_token:string;user:User}>('/auth/login',{method:'POST',body:{email,password}});
export const demoAccounts=()=>api<DemoAccount[]>('/demo/accounts');
export const roleName=(role:string)=>role==='INVESTOR'?'Nhà đầu tư':role==='STARTUP'?'Startup':'Quản trị';
export const money=(cents:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(cents/100);
export const compactMoney=(cents:number)=>{const dollars=cents/100;return dollars>=1e6?`$${(dollars/1e6).toFixed(1)}M`:dollars>=1000?`$${Math.round(dollars/1000)}K`:money(cents);};
export const dateVi=(date:string)=>new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date));
export const initials=(name:string)=>name.trim().split(/\s+/).slice(-2).map(a=>a[0]?.toUpperCase()).join('');
export function statusName(status:string){return ({PUBLISHED:'Đang hiển thị',DRAFT:'Bản nháp',REJECTED:'Cần cải thiện',PENDING:'Chờ duyệt',APPROVED:'Đã cấp quyền',NOT_REQUESTED:'Chưa gửi yêu cầu',LOW:'Ít rủi ro',RED_ALERT:'Xung đột ngành',SIMULATED_PAID:'Đã giải ngân',PENDING_APPROVAL:'Chờ xác minh KPI',AWAITING_EVIDENCE:'Chờ bằng chứng',LOCKED:'Chưa mở',SIMULATED_FUNDED:'Đã ký quỹ mô phỏng',DEMO_PAID:'Đã ghi phí mô phỏng',UNPAID:'Chưa ghi phí'} as Record<string,string>)[status]||status;}
