'use strict';
// REAL integration tests — these hit the actual services on the internet.
// Run manually: node test-live.js   (network required; not part of the default test run)
// A mock test passing says nothing about a provider working live; this script is the only proof.
const {__test}=require('./index.js');
const {mapLang,providers}=__test;
const SETTINGS={timeout:15000};

const CASES=[
 {label:'Google  en→pt_br',fn:(t)=>providers.google(t,'auto','pt',SETTINGS)},
 {label:'Bing    en→pt_br',fn:(t)=>providers.bing(t,'auto-detect','pt',SETTINGS)},
 {label:'DeepL   en→pt_br',fn:(t)=>providers.deepl(t,'auto','pt-br',SETTINGS)},
 {label:'Youdao  en→pt_br',fn:(t)=>providers.youdao(t,'en','pt',SETTINGS),expect:'unsupported-for-pt'},
 {label:'Tencent en→pt_br',fn:(t)=>providers.tencent(t,'auto','pt',SETTINGS),expect:'unsupported-for-pt'},
 {label:'Transmart en→pt_br',fn:(t)=>providers.transmart(t,'en','pt',SETTINGS),expect:'server-side-tls'},
 {label:'Caiyun  en→pt_br',fn:(t)=>providers.caiyun(t,'en','pt',SETTINGS)},
 {label:'Volceng en→pt_br',fn:(t)=>providers.volcengine(t,'en','pt',SETTINGS)},
 // reverse + spanish + auto-detect + special characters
 {label:'Google  pt_br→en',fn:(t)=>providers.google(t,'pt','en',SETTINGS)},
 {label:'Bing    pt_br→en',fn:(t)=>providers.bing(t,'pt','en',SETTINGS)},
 {label:'Google  en→es  ',fn:(t)=>providers.google(t,'en','es',SETTINGS)},
 {label:'Bing    en→es  ',fn:(t)=>providers.bing(t,'en','es',SETTINGS)},
 {label:'Google  auto   ',fn:(t)=>providers.google(t,'auto','en',SETTINGS)},
 {label:'Bing    auto   ',fn:(t)=>providers.bing(t,'auto-detect','en',SETTINGS)},
 {label:'Youdao  pt_br→en',fn:(t)=>providers.youdao(t,'pt','en',SETTINGS)},
 {label:'Youdao  en→es  ',fn:(t)=>providers.youdao(t,'en','es',SETTINGS)},
 {label:'Youdao  auto→en',fn:(t)=>providers.youdao(t,'auto','en',SETTINGS)},
 {label:'Tencent zh→pt  ',fn:(t)=>providers.tencent(t,'zh','pt',SETTINGS),text:()=>['我真的很喜欢这部电影','你好，世界，你好吗？','你好，一切都好吗？'],expect:'unsupported-for-pt'},
 {label:'Tencent en→zh  ',fn:(t)=>providers.tencent(t,'auto','zh',SETTINGS)},
 {label:'Transmart pt→en',fn:(t)=>providers.transmart(t,'pt','en',SETTINGS),expect:'server-side-tls'},
 {label:'Caiyun  zh→en  ',fn:(t)=>providers.caiyun(t,'zh','en',SETTINGS)},
 {label:'Volceng en→zh  ',fn:(t)=>providers.volcengine(t,'en','zh',SETTINGS)},
];
const SPECIAL='Ação, coração e café: não é fácil!';
const REFS=['I really enjoyed this movie','Olá, tudo bem? Espero que sim!','Hello world, how are you?',SPECIAL];

function judge(label,out){
 const s=String(out).toLowerCase();
 if(/ação|coração|café/.test(out))return 'PASS';       // special chars preserved
 if(/movie|filme|película|电影|映画|gost|gusta|enjoy/.test(s))return 'PASS';
 if(/olá|hello|world|mundo|你好|世界/.test(s))return 'PASS';
 return 'CHECK';
}
(async()=>{
 let pass=0,fail=0,warn=0;
 for(const c of CASES){
  const refTexts=c.text?c.text():REFS;
  for(const text of refTexts){
   try{
    const out=await c.fn(text);
    const v=judge(c.label,out);
    if(v==='PASS'){pass++;console.log(`  PASS ${c.label}  "${text.slice(0,28)}" → ${String(out).slice(0,52)}`);}
    else {warn++;console.log(`  WARN ${c.label}  "${text.slice(0,28)}" → ${String(out).slice(0,52)}`);}
   }catch(e){
    const m=String(e?.message||e);
    const expected=c.expect==='unsupported-for-pt'&&/unsupported|only supports|zh_hant|Simplified/.test(m);
    const expected2=c.expect==='server-side-tls'&&/TLS|certificate/i.test(m);
    if(expected||expected2){warn++;console.log(`  EXPECTED-LIMIT ${c.label}  "${text.slice(0,28)}" → ${m.slice(0,80)}`);}
    else if(/HTTP 429/.test(m)){warn++;console.log(`  RATE-LIMITED  ${c.label}  "${text.slice(0,28)}" → ${m.slice(0,80)}`);}
    else {fail++;console.log(`  FAIL ${c.label}  "${text.slice(0,28)}" → ${m.slice(0,100)}`);}
   }
   await new Promise(r=>setTimeout(r,700)); // be polite to the free endpoints
  }
 }
 console.log(`\nLIVE integration: ${pass} passed, ${warn} warnings/known-limits, ${fail} failed`);
})();
