'use strict';
// Wox 2 adapter for the Google provider of Lu-Jiejie's MultiTranslate (MIT).
// Google integration: unofficial, subject to rate limiting and upstream changes.
const RPC_URL = 'https://translate.google.com/_/TranslateWebserverUi/data/batchexecute';
const GTX_URL = 'https://translate.google.com/translate_a/single';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
let api;
function nested(x, p) { for (const n of p) { if (!Array.isArray(x)) return undefined; x=x[n]; } return x; }
function parseBatch(body) {
  for (const line of String(body).split('\n')) {
    if (!line.startsWith('[[')) continue;
    let rows; try {rows=JSON.parse(line);} catch {continue;}
    const call=Array.isArray(rows)&&rows.find(x=>nested(x,[0])==='wrb.fr'&&nested(x,[1])==='MkEWBc');
    if (!call) continue;
    if (typeof call[2]!=='string') throw Error('Google recusou a combinação de idiomas.');
    let payload; try {payload=JSON.parse(call[2]);} catch {break;}
    const tuples=nested(payload,[1,0,0,5]);
    if (Array.isArray(tuples)) {const text=tuples.map(x=>nested(x,[0])).filter(x=>typeof x==='string').join('').trim(); if(text) return text;}
  }
  return null;
}
function parseGtx(body) { if(!Array.isArray(body?.[0]))return null;return body[0].map(x=>Array.isArray(x)?x[0]:'').filter(x=>typeof x==='string').join('')||null; }
async function fetchChecked(url,options,timeoutMs=10000){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(timeoutMs)});
  if(!response.ok){ if([403,429].includes(response.status))throw Error('Google limitou as requisições (HTTP '+response.status+'). Tente mais tarde.');throw Error('Google respondeu HTTP '+response.status);}
  return response;
}
async function translate(text,from,to){
  const rpc=JSON.stringify([[['MkEWBc',JSON.stringify([[text,from,to,true],[null]]),null,'generic']]]);
  const search=new URLSearchParams({'rpcids':'MkEWBc','source-path':'/','f.sid':'','bl':'','hl':'en','soc-app':'1','soc-platform':'1','soc-device':'1','_reqid':'1000','rt':'c'});
  try {
    const res=await fetchChecked(RPC_URL+'?'+search.toString(),{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Referer':'https://translate.google.com/','Origin':'https://translate.google.com','X-Same-Domain':'1','User-Agent':UA},body:'f.req='+encodeURIComponent(rpc)});
    const parsed=parseBatch(await res.text());if(parsed!==null)return parsed;
  }catch(e){ if(!/HTTP |fetch failed|timeout|aborted|unexpected|JSON/i.test(String(e.message)))throw e; }
  const params=new URLSearchParams({client:'gtx',sl:from,tl:to,hl:to,dt:'t',q:text,ie:'UTF-8',oe:'UTF-8'});
  const res=await fetchChecked(GTX_URL+'?'+params,{headers:{'Accept':'*/*','Referer':'https://translate.google.com/','User-Agent':UA}});
  const value=parseGtx(await res.json());if(!value)throw Error('Resposta inesperada do Google Translate.');return value;
}
function parseInput(search,defaultTarget='pt'){const raw=String(search||'').trim();let from='auto',to=defaultTarget,text=raw;
  const m=raw.match(/^(?:(?<source>[a-z_-]+)?>)?(?<target>[a-z_-]+)\s+([\s\S]+)$/i);
  if(m&&(raw.startsWith('>')||raw.includes('>')||/^(?:pt_br|pt_pt|en|es|fr|de|it|ja|zh|ru|ko)\s/.test(raw))){from=m.groups.source||'auto';to=m.groups.target;text=m[3];}
  return {from:normalizeLang(from),to:normalizeLang(to),text};
}
function normalizeLang(code){const c=String(code).toLowerCase().replace('-','_');if(c==='pt_br'||c==='pt_pt'||c==='pt')return 'pt';if(c==='zh')return 'zh-CN';if(c==='zh_hant')return 'zh-TW';return c;}
const icon={ImageType:'emoji',ImageData:'🌐'};
const plugin={
  async init(_ctx,params){api=params.API;},
  async query(ctx,query){
    const raw=query.Search||'';
    if(!raw.trim())return [{Title:'Google Tradutor → Português (Brasil)',SubTitle:'Digite tr <texto>  •  Exemplos: tr I love this app | tr >en Olá!',Icon:icon,Score:100}];
    const {from,to,text}=parseInput(raw);
    if(!text.trim())return [];
    try{
      const translated=await translate(text,from,to);
      return [{Title:translated,SubTitle:`Google Translate · ${from} → ${to} · Enter para copiar`,Icon:icon,Score:100,Preview:{PreviewType:'markdown',PreviewData:`${translated}\n\n---\n\n**Original:** ${text}\n\n**Google Translate** · ${from} → ${to}`,PreviewProperties:{}},Actions:[{Name:'Copiar tradução',IsDefault:true,Action:async c=>{await api.Copy(c,{type:'text',text:translated});}},{Name:'Copiar original',Action:async c=>{await api.Copy(c,{type:'text',text});}}]}];
    }catch(error){return [{Title:'Falha na tradução',SubTitle:String(error?.message||error),Icon:{ImageType:'emoji',ImageData:'⚠️'},Score:100}];}
  }
};
module.exports.plugin=plugin;
module.exports.__test={parseInput,parseBatch,parseGtx,normalizeLang};
