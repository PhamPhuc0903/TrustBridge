import {createContext,useCallback,useContext,useEffect,useMemo,useState} from 'react';
import type {ReactNode} from 'react';
import type {User} from '../types';
import {api,getToken,loginApi,setToken} from '../lib/api';

type Toast = {id:number;message:string;kind:'success'|'error'|'info'};
type AppContextValue = {user:User|null;loading:boolean;signIn:(email:string,password?:string)=>Promise<void>;signOut:()=>void;toast:(message:string,kind?:Toast['kind'])=>void;toasts:Toast[];dismiss:(id:number)=>void;refreshUser:()=>Promise<void>};
const Context=createContext<AppContextValue|null>(null);
export function AppProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const [toasts,setToasts]=useState<Toast[]>([]);
 const toast=useCallback((message:string,kind:Toast['kind']='success')=>{const id=Date.now()+Math.random();setToasts(t=>[...t.slice(-3),{id,message,kind}]);window.setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);},[]);
 const dismiss=useCallback((id:number)=>setToasts(t=>t.filter(x=>x.id!==id)),[]);
 const signOut=useCallback(()=>{setToken(null);setUser(null);},[]);
 const refreshUser=useCallback(async()=>{const me=await api<User>('/me');setUser(me);},[]);
 const signIn=useCallback(async(email:string,password='Demo123!')=>{const response=await loginApi(email,password);setToken(response.access_token);setUser(response.user);},[]);
 useEffect(()=>{let mounted=true;(async()=>{if(!getToken()){if(mounted)setLoading(false);return;}try{const me=await api<User>('/me');if(mounted)setUser(me);}catch{setToken(null);}finally{if(mounted)setLoading(false);}})();return()=>{mounted=false;};},[]);
 const value=useMemo(()=>({user,loading,signIn,signOut,toast,toasts,dismiss,refreshUser}),[user,loading,signIn,signOut,toast,toasts,dismiss,refreshUser]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useApp(){const v=useContext(Context);if(!v)throw new Error('useApp outside provider');return v;}
