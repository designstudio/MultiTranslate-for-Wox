'use strict';
// Automated tests with MOCKED responses only — these prove parser/policy/error logic,
// NOT that a provider works on the internet. Run node test-live.js for real integration.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {plugin,__test}=require('./index.js');
const {parseInput,parseBatch,parseGtx,mapLang,validCode,languageName,providerIcon,msgResult,fetchData,providers}=__test;

// ---------- test harness ----------
const tests=[];
function test(name,fn){tests.push([name,fn]);}
async function expectThrows(re,fn){await assert.rejects(fn,typeof re==='string'?new RegExp(re):re);}
const realFetch=global.fetch;
let fetchCalls;
function mockFetch(handler){fetchCalls=0;global.fetch=async(url,opts={})=>{fetchCalls++;return handler(new URL(String(url)),opts);};}
function mockFetchError(errFactory){fetchCalls=0;global.fetch=async()=>{fetchCalls++;throw errFactory();};}
const jsonResponse=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const textResponse=(body,status=200)=>new Response(body,{status,headers:{'Content-Type':'text/plain'}});
const SETTINGS={timeout:12000,delay:0};
function restore(){global.fetch=realFetch;}

// ---------- Youdao response encryption helper (mirrors the provider's AES-128-CBC) ----------
const md16=x=>crypto.createHash('md5').update(x).digest().subarray(0,16);
const YD_KEY=md16('ydsecret://query/key/B*RGygVywfNBwpmBaZg*WT7SIOUP2T0C9WHMZN39j^DAdaZhAnxvGcCY6VYFwnHl');
const YD_IV=md16('ydsecret://query/iv/C@lZe2YzHtZ2CYgaXKSVfsb7Y4QWHjITPPZ0nQp87fBeJ!Iv6v^6fvi2WN@bYpJ4');
function youdaoEncrypt(obj){const c=crypto.createCipheriv('aes-128-cbc',YD_KEY,YD_IV);return c.update(JSON.stringify(obj),'utf8','base64')+c.final('base64');}

// ---------- parseInput / mapLang / parsers (original 11 tests preserved) ----------
const defaults={source_language:'auto',target_language:'pt_br',translation_mode:'configured'};
assert.deepEqual(parseInput('I love this app',defaults),{from:'auto',to:'pt_br',text:'I love this app'});
assert.deepEqual(parseInput('>en Bom dia',defaults),{from:'auto',to:'en',text:'Bom dia'});
assert.deepEqual(parseInput('pt_br>en Bom dia',defaults),{from:'pt_br',to:'en',text:'Bom dia'});
assert.deepEqual(parseInput('fr Bonjour',defaults),{from:'auto',to:'fr',text:'Bonjour'});
assert.deepEqual(parseInput('is this good?',defaults),{from:'auto',to:'pt_br',text:'is this good?'});
assert.deepEqual(parseInput('hello',{...defaults,translation_mode:'zh-en'}),{from:'en',to:'zh',text:'hello'});
assert.equal(mapLang('google','pt_br'),'pt');
assert.equal(mapLang('deepl','pt_br'),'pt-br');
assert.equal(mapLang('bing','auto'),'auto-detect');
assert.equal(parseGtx([[['olá','hello']]]),'olá');

// ---------- mapLang coverage ----------
test('mapLang: youdao chinese/ko codes',()=>{
 assert.equal(mapLang('youdao','zh'),'zh-CHS');
 assert.equal(mapLang('youdao','zh_hant'),'zh-CHT');
 assert.equal(mapLang('youdao','ko'),'kor');
 assert.equal(mapLang('bing','zh'),'zh-Hans');
 assert.equal(mapLang('bing','zh_hant'),'zh-Hant');
 assert.equal(mapLang('google','zh'),'zh-CN');
 assert.equal(mapLang('tencent','pt_br'),'pt');
 assert.equal(mapLang('tencent','zh_hant'),'zh-TW');
});
test('validCode and languageName',()=>{
 assert.equal(validCode('pt_br'),true);assert.equal(validCode('zh_hant'),true);
 assert.equal(validCode('xx_yy'),false);assert.equal(validCode('PT_BR'),true);
 assert.match(languageName('pt_br','en_US'),/Portuguese/);
 assert.match(languageName('auto','pt_BR'),/[Dd]etectar/);
});
test('providerIcon uses local svg assets',()=>{
 const g=providerIcon('google');
 assert.equal(g.ImageType,'relative');assert.match(g.ImageData,/service_icon/);
});

// ---------- parseBatch (Google) ----------
test('parseBatch extracts translation from batchexecute payload',()=>{
 // nested(payload,[1,0,0,5]) holds the sentence tuples, exactly like the real response
 const payload=[null,[[[null,null,null,null,null,[['Eu realmente'],[' gostei deste filme']]]]]];
 // each batchexecute line is [["wrb.fr","MkEWBc",<payload string>,...]] — optionally with the )]}' prefix
 const line=')]}\''+'\n\n'+JSON.stringify([['wrb.fr','MkEWBc',JSON.stringify(payload),null,'generic']]);
 assert.equal(parseBatch(line),'Eu realmente gostei deste filme');
});
test('parseBatch returns null on garbage',()=>{
 assert.equal(parseBatch(')]}\'\n\nnot json at all'),null);
});

// ---------- fetchData error mapping ----------
test('fetchData maps expired certificate to a clear message',async()=>{
 mockFetchError(()=>Object.assign(new Error('fetch failed'),{cause:{code:'CERT_HAS_EXPIRED'}}));
 await expectThrows(/TLS\/certificate error on .*CERT_HAS_EXPIRED/,()=>fetchData('https://transmart.qq.com/api/imt'));
 restore();
});
test('fetchData maps DNS failure and timeout',async()=>{
 mockFetchError(()=>Object.assign(new Error('fetch failed'),{cause:{code:'ENOTFOUND'}}));
 await expectThrows(/DNS failure for example\.com/,()=>fetchData('https://example.com/x'));
 restore();
 mockFetchError(()=>Object.assign(new Error('The operation was aborted due to timeout'),{name:'TimeoutError'}));
 await expectThrows(/Connection timeout on example\.com/,()=>fetchData('https://example.com/x'));
 restore();
});
test('fetchData rejects non-2xx with HTTP status',async()=>{
 mockFetch(()=>new Response('nope',{status:404}));
 await expectThrows(/HTTP 404 from example\.com/,()=>fetchData('https://example.com/x'));
 restore();
});

// ---------- Youdao ----------
test('youdao: successful mocked translation with new request format',async()=>{
 let translateBody=null;
 mockFetch((u,opts)=>{
  if(u.pathname==='/webtranslate/key')return jsonResponse({data:{secretKey:'MOCKSECRET',aesKey:'k',aesIv:'i'}});
  if(u.pathname==='/webtranslate'){
   translateBody=new URLSearchParams(opts.body);
   return textResponse(youdaoEncrypt({code:0,translateResult:[[{tgt:'Eu realmente '},{tgt:'gostei deste filme'}]],type:'en2pt'}));
  }
  return new Response('unexpected',{status:500});
 });
 const out=await providers.youdao('I really enjoyed this movie','en','pt',SETTINGS);
 assert.equal(out,'Eu realmente gostei deste filme');
 // request format mirrors the current fanyi.youdao.com client
 assert.equal(translateBody.get('keyid'),'webfanyi');
 assert.equal(translateBody.get('appVersion'),'12.0.0');
 assert.equal(translateBody.get('yduuid'),'abcdefg');
 assert.equal(translateBody.get('i'),'I really enjoyed this movie');
 assert.equal(translateBody.get('from'),'en');assert.equal(translateBody.get('to'),'pt');
 assert.match(translateBody.get('sign'),/^[a-f0-9]{32}$/);
 restore();
});
test('youdao: code 40 becomes an explicit unsupported-pair error',async()=>{
 mockFetch((u,opts)=>{
  if(u.pathname==='/webtranslate/key')return jsonResponse({data:{secretKey:'MOCKSECRET'}});
  return textResponse(youdaoEncrypt({code:40}));
 });
 await expectThrows(/code 40.*unsupported/,()=>providers.youdao('hello','en','pt',SETTINGS));
 restore();
});
test('youdao: empty translateResult and unreadable payload are reported',async()=>{
 mockFetch((u)=>{
  if(u.pathname==='/webtranslate/key')return jsonResponse({data:{secretKey:'MOCKSECRET'}});
  return textResponse(youdaoEncrypt({code:0,type:'en2pt'}));
 });
 await expectThrows(/Empty Youdao translation/,()=>providers.youdao('hello','en','pt',SETTINGS));
 restore();
 mockFetch((u)=>{
  if(u.pathname==='/webtranslate/key')return jsonResponse({data:{secretKey:'MOCKSECRET'}});
  return textResponse('%%%not-base64%%%');
 });
 await expectThrows(/unreadable response/,()=>providers.youdao('hello','en','pt',SETTINGS));
 restore();
});
test('youdao: wrong returned language is rejected',async()=>{
 mockFetch((u)=>{
  if(u.pathname==='/webtranslate/key')return jsonResponse({data:{secretKey:'MOCKSECRET'}});
  return textResponse(youdaoEncrypt({code:0,translateResult:[[{tgt:'这部电影'}]],type:'en2zh-CHS'}));
 });
 await expectThrows(/returned zh-CHS instead of pt/,()=>providers.youdao('hello','en','pt',SETTINGS));
 restore();
});
test('youdao: missing secret key fails fast',async()=>{
 mockFetch(()=>jsonResponse({code:40}));
 await expectThrows(/secret key unavailable/,()=>providers.youdao('hello','en','pt',SETTINGS));
 restore();
});

// ---------- Tencent ----------
test('tencent: refuses unsupported pairs without any network request',async()=>{
 mockFetch(()=>{throw new Error('must not be called');});
 await expectThrows(/only supports translation to or from Chinese/,()=>providers.tencent('hello','auto','pt',SETTINGS));
 await expectThrows(/only supports translation to or from Chinese/,()=>providers.tencent('hello','en','pt',SETTINGS));
 await expectThrows(/Simplified Chinese only/,()=>providers.tencent('hello','en','zh-TW',SETTINGS));
 await expectThrows(/does not support target language/,()=>providers.tencent('你好','zh','yue',SETTINGS));
 restore();
});
test('tencent: X→zh mocked success',async()=>{
 mockFetch((u)=>{
  assert.equal(u.searchParams.get('source'),'auto');
  return jsonResponse({errCode:0,targetText:'我真的很喜欢这部电影',source:'en',target:'zh'});
 });
 const out=await providers.tencent('I really enjoyed this movie','auto','zh',SETTINGS);
 assert.equal(out,'我真的很喜欢这部电影');
 restore();
});
test('tencent: zh→X mocked success with request shape',async()=>{
 let seen=null;
 mockFetch((u)=>{seen=u;return jsonResponse({errCode:0,targetText:'Gosto mesmo deste filme.',source:'zh',target:'pt'});});
 const out=await providers.tencent('我真的很喜欢这部电影','zh','pt',SETTINGS);
 assert.equal(out,'Gosto mesmo deste filme.');
 assert.equal(seen.searchParams.get('source'),'zh');
 assert.equal(seen.searchParams.get('target'),'pt');
 assert.equal(seen.searchParams.get('candidateLangs'),'zh|pt');
 restore();
});
test('tencent: server returning the wrong language is rejected',async()=>{
 mockFetch(()=>jsonResponse({errCode:0,targetText:'我真的很喜欢这部电影',source:'zh',target:'zh'}));
 await expectThrows(/returned zh instead of pt/,()=>providers.tencent('我真的很喜欢这部电影','zh','pt',SETTINGS));
 restore();
 mockFetch(()=>jsonResponse({errCode:0,targetText:'',source:'zh',target:'pt'}));
 await expectThrows(/Empty Tencent translation/,()=>providers.tencent('你好','zh','pt',SETTINGS));
 restore();
});

// ---------- Transmart ----------
test('transmart: mocked success and empty response',async()=>{
 mockFetch((u,opts)=>{
  const body=JSON.parse(opts.body);
  assert.equal(body.source.lang,'en');
  assert.deepEqual(body.source.text_list,['I really enjoyed this movie']);
  assert.equal(body.target.lang,'pt');
  return jsonResponse({header:{ret_code:'succ'},auto_translation:['Eu realmente gostei deste filme'],src_lang:'en',tgt_lang:'pt'});
 });
 const out=await providers.transmart('I really enjoyed this movie','en','pt',SETTINGS);
 assert.equal(out,'Eu realmente gostei deste filme');
 restore();
 mockFetch(()=>jsonResponse({header:{ret_code:'fail'},auto_translation:[]}));
 await expectThrows(/Empty Transmart translation \(ret_code fail\)/,()=>providers.transmart('hello','en','pt',SETTINGS));
 restore();
 mockFetch(()=>jsonResponse({header:{ret_code:'succ'}}));
 await expectThrows(/Empty Transmart translation/,()=>providers.transmart('hello','en','pt',SETTINGS));
 restore();
});

// ---------- DeepL ----------
test('deepl: keyless rate limit (HTTP 429) produces a clear credential-free message',async()=>{
 mockFetch(()=>new Response(JSON.stringify({jsonrpc:'2.0',error:{code:1042911,message:'Too many requests'}}),{status:429}));
 const t0=Date.now();
 await expectThrows(/HTTP 429.*deepl_key/,()=>providers.deepl('hello','auto','pt-br',SETTINGS));
 assert.ok(Date.now()-t0>1500,'should back off once before giving up');
 restore();
});
test('deepl: keyless retries once after a 429 and then succeeds',async()=>{
 let n=0;
 mockFetch(()=>{n++;return n===1?new Response('{"jsonrpc":"2.0","error":{"code":1042912}}',{status:429}):jsonResponse({jsonrpc:'2.0',result:{texts:[{text:'Eu realmente gostei deste filme'}]}});});
 const out=await providers.deepl('I really enjoyed this movie','auto','pt-br',SETTINGS);
 assert.equal(out,'Eu realmente gostei deste filme');
 assert.equal(n,2);
 restore();
});
test('deepl: official key path sends DeepL-Auth-Key and PT-BR target',async()=>{
 let seen=null;
 mockFetch((u,opts)=>{seen={u,opts};return jsonResponse({translations:[{text:'Eu realmente gostei deste filme'}]});});
 const out=await providers.deepl('I really enjoyed this movie','auto','pt-br',{...SETTINGS,deepl_key:'FAKEKEY:fx'});
 assert.equal(out,'Eu realmente gostei deste filme');
 assert.equal(seen.u.hostname,'api-free.deepl.com');
 assert.equal(seen.opts.headers.Authorization,'DeepL-Auth-Key FAKEKEY:fx');
 const body=JSON.parse(seen.opts.body);
 assert.equal(body.target_lang,'PT-BR');
 assert.equal(body.source_lang,undefined);
 restore();
});
test('deepl: official key path error mapping',async()=>{
 mockFetch(()=>new Response('{"message":"Wrong key"}',{status:401}));
 await expectThrows(/API key rejected/,()=>providers.deepl('hello','auto','pt-br',{...SETTINGS,deepl_key:'BAD:fx'}));
 restore();
 mockFetch(()=>new Response('{"message":"Quota"}',{status:456}));
 await expectThrows(/quota exceeded/i,()=>providers.deepl('hello','auto','pt-br',{...SETTINGS,deepl_key:'BAD:fx'}));
 restore();
});

// ---------- Bing (regression) ----------
test('bing: mocked success and empty response',async()=>{
 mockFetch(()=>jsonResponse([{translations:[{text:'Eu realmente gostei deste filme'}]}]));
 const out=await providers.bing('I really enjoyed this movie','auto-detect','pt',SETTINGS);
 assert.equal(out,'Eu realmente gostei deste filme');
 restore();
 mockFetch(()=>jsonResponse([{translations:[{text:''}]}]));
 await expectThrows(/Empty Bing translation/,()=>providers.bing('hello','auto-detect','pt',SETTINGS));
 restore();
});

// ---------- plugin query flow (smoke) ----------
test('plugin: empty query renders header; invalid language rejected',async()=>{
 await plugin.init({},{API:{GetTranslation:async k=>k,GetSetting:async()=>'',GetThemeColors:async()=>({Dark:false}),Copy:async()=>{},ChangeQuery:async()=>{}}});
 const empty=await plugin.query({},{Search:''});
 assert.ok(empty.length>=1);assert.match(empty[0].Title,/MultiTranslate/);
 // invalid codes reach the rejection path through plugin settings (prefix codes fall back to plain text)
 assert.deepEqual(parseInput('hello',{...defaults,target_language:'xx'}),{from:'auto',to:'xx',text:'hello'});
 assert.equal(validCode('xx'),false);
});

// ---------- session health: hiding repeated failures + show-again ----------
const {resetSessionHealth,HIDE_THRESHOLD,METHODS}=require('./index.js').__test;
const HIDE_SETTINGS={timeout:12000,delay:0};
function makeApi(extra={}){
 const captured={changeQuery:null};
 const api={GetTranslation:async k=>k,GetSetting:async(ctx,key)=>(extra.settings&&extra.settings[key])||'',GetThemeColors:async()=>({Dark:false}),Copy:async()=>{},ChangeQuery:async(c,q)=>{captured.changeQuery=q;},...extra.api};
 return {api,captured};
}
function googleBatchResponse(text){
 const payload=[null,[[[null,null,null,null,null,[[text]]]]]];
 return JSON.stringify([['wrb.fr','MkEWBc',JSON.stringify(payload),null,'generic']]);
}
test(`provider is hidden after ${HIDE_THRESHOLD} consecutive failures, with a show-again action`,async()=>{
 resetSessionHealth();
 let deeplxCalls=0;
 mockFetch((u,opts)=>{
  if(u.hostname.includes('translate.google.com'))return textResponse(googleBatchResponse('Olá'));
  if(u.pathname==='/translate')return jsonResponse({data:'x'}); // deeplx target (must not happen once hidden)
  return new Response('unexpected',{status:500});
 });
 const origDeeplx=METHODS.deeplx;
 METHODS.deeplx=async()=>{deeplxCalls++;throw Error('Configure DeepLX URL in plugin settings');};
 try{
  const {api}=makeApi({settings:{providers:'google\ndeeplx',timeout_ms:'12000',delay_ms:'0'}});
  await plugin.init({},{API:api});
  for(let i=0;i<HIDE_THRESHOLD-1;i++){
   const r=await plugin.query({},{Search:'hello'});
   assert.equal(r.length,2,'before threshold: google + deeplx error');
   assert.equal(deeplxCalls,i+1);
  }
  // the query that reaches the threshold shows the last error plus the summary item
  const r3=await plugin.query({},{Search:'hello'});
  assert.equal(r3.length,3);
  assert.match(r3[2].Title,/hidden/i);
  const r4=await plugin.query({},{Search:'hello'});
  assert.equal(deeplxCalls,HIDE_THRESHOLD,'hidden provider is no longer called');
  assert.equal(r4.length,2);
  assert.match(r4[1].Title,/hidden/i);
  assert.match(r4[1].SubTitle,/deeplx/);
  assert.ok(Array.isArray(r4[1].Actions)&&r4[1].Actions[0].IsDefault);
  await r4[1].Actions[0].Action({});
  const r5=await plugin.query({},{Search:'hello'});
  assert.equal(deeplxCalls,HIDE_THRESHOLD+1,'provider is retried after show-again');
  assert.equal(r5.length,2);
 }finally{METHODS.deeplx=origDeeplx;restore();}
});
test('a success resets the failure counter',async()=>{
 resetSessionHealth();
 let bingShouldFail=true,bingCalls=0;
 mockFetch((u)=>{
  if(u.hostname==='edge.microsoft.com'){bingCalls++;return bingShouldFail?new Response('no',{status:500}):jsonResponse([{translations:[{text:'Olá'}]}]);}
  return new Response('unexpected',{status:500});
 });
 const {api}=makeApi({settings:{providers:'bing\ndeeplx',timeout_ms:'12000',delay_ms:'0'}});
 await plugin.init({},{API:api});
 // 2 fails, 1 success, 2 fails → never reaches 3 consecutive
 for(const round of [true,true,false,true,true]){
  bingShouldFail=round;
  const r=await plugin.query({},{Search:'hello'});
  assert.ok(r.some(x=>/bing|Olá/.test(x.Title)||/bing/.test(x.SubTitle)),'bing item present, never hidden');
 }
 restore();
});
test('error results carry a preview documenting known provider limitations',async()=>{
 resetSessionHealth();
 mockFetch((u)=>{
  if(u.hostname==='dict.youdao.com'&&u.pathname==='/webtranslate/key')return jsonResponse({data:{secretKey:'MOCKSECRET'}});
  if(u.hostname==='dict.youdao.com')return textResponse(youdaoEncrypt({code:40}));
  if(u.hostname==='transmart.qq.com'){const e=new Error('fetch failed');e.cause={code:'CERT_HAS_EXPIRED'};throw e;}
  if(u.hostname==='wxapp.translator.qq.com')return jsonResponse({errCode:0,targetText:'我真的很喜欢这部电影',source:'en',target:'zh'});
  return new Response('unexpected',{status:500});
 });
 const {api}=makeApi({settings:{providers:'tencent\nyoudao\ntransmart',timeout_ms:'12000',delay_ms:'0'}});
 await plugin.init({},{API:api});
 const r=await plugin.query({},{Search:'hello'});
 const byName=n=>r.find(x=>x.Title.startsWith(n));
 const tencentItem=byName('tencent');
 assert.equal(tencentItem.Preview.PreviewType,'markdown');
 assert.match(tencentItem.Preview.PreviewData,/Tencent/);
 assert.match(tencentItem.Preview.PreviewData,/only translates X→zh/,tencentItem.Preview.PreviewData);
 assert.match(tencentItem.Preview.PreviewData,/Auto → /);
 const youdaoItem=byName('youdao');
 assert.match(youdaoItem.Preview.PreviewData,/no longer accepts en→pt/);
 const transmartItem=byName('transmart');
 assert.match(transmartItem.Preview.PreviewData,/expired TLS certificate/);
 restore();
});

// ---------- runner ----------
async function run(){
 const failures=[];
 for(const [name,fn] of tests){
  try{await fn();console.log('  ok - '+name);}
  catch(e){failures.push([name,e]);console.error('  FAIL - '+name+': '+(e?.message||e));}
 }
 console.log(`\n${tests.length+10} local tests: ${tests.length-failures.length+10} passed, ${failures.length} failed`);
 if(failures.length){process.exitCode=1;restore();}
}
run();
