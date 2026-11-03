'use strict';
// MultiTranslate for Wox 2. MIT. Translation backends adapted from Lu-Jiejie/flow-launcher-multi-translate.
// Unofficial provider endpoints are not affiliated with their owners and may rate-limit or change.
const crypto = require('node:crypto');
const {__test:googleParsers} = require('./google-base');
const RPC_URL='https://translate.google.com/_/TranslateWebserverUi/data/batchexecute';
const GTX_URL='https://translate.google.com/translate_a/single';
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const LANGUAGES = new Set(('auto af sq am ar hy as az bn ba eu bs bg yue ca zh zh_hant hr cs da prs dv nl en et fo fj fi fr gl ka de el gu ht ha he hi mww hu is ig id iu iu-Latn ga it ja kn kk km rw tlh-Latn tlh-Piqd ko ku ky lo lv lt mk mg ms ml mt mi mr mn_cy mn_mo my ne nb nb_no nn_no or ps fa pl pt pt_pt pt_br pa otq ro ru sm sr-Cyrl sr-Latn sd si sk sl so es sv ty ta tt te th bo ti to tr tk uk hsb ur ug uz vi cy xh yo yua zu').split(' '));
const LANG_NAMES = {auto:'Auto',en:'English',pt:'Portuguese',pt_br:'Portuguese (Brazil)',pt_pt:'Portuguese (Portugal)',zh:'Chinese (Simplified)',zh_hant:'Chinese (Traditional)',es:'Spanish',fr:'French',de:'German',it:'Italian',ja:'Japanese',ko:'Korean',ru:'Russian',ar:'Arabic',hi:'Hindi',tr:'Turkish',nl:'Dutch',vi:'Vietnamese'};
const PROVIDERS=new Set(['google','bing','deepl','youdao','tencent','transmart','caiyun','volcengine','deeplx','mtranserver','openai']);
const fs=require('node:fs');
const path=require('node:path');
const ICON_BASE='https://raw.githubusercontent.com/Lu-Jiejie/flow-launcher-multi-translate/main/assets/';
const LOCAL_ASSETS=path.join(__dirname,'assets');
// Prefer every local SVG, even when the file was added manually after installing.
// Accept both provider.svg and providerLogo.svg (case-insensitive).
const SERVICE_ALIASES={
 google:['google','googletranslate'],
 bing:['bing','microsoft','microsofttranslator'],
 deepl:['deepl'],
 youdao:['youdao'],
 tencent:['tencent'],
 transmart:['transmart'],
 caiyun:['caiyun'],
 volcengine:['volcengine','voicengine'],
 deeplx:['deeplx'],
 mtranserver:['mtranserver'],
 openai:['openai'],
 ollama:['ollama'],
 baidu:['baidu']
};
function imageForFile(relativeFile){
 const diskPath=path.join(LOCAL_ASSETS,...relativeFile.split('/'));
 if(fs.existsSync(diskPath))return {ImageType:'relative',ImageData:'assets/'+relativeFile};
 return {ImageType:'url',ImageData:ICON_BASE+relativeFile};
}
const icon=imageForFile('icon.png');
// Theme follows Wox itself, not the Windows appearance.
let currentThemeIsDark = false;
async function syncWoxTheme(ctx){
  if(typeof api?.GetThemeColors !== 'function') return;
  try {
    const theme = await api.GetThemeColors(ctx, {});
    if(typeof theme?.Dark === 'boolean') currentThemeIsDark = theme.Dark;
  } catch (_) { /* Use standard artwork if the API is unavailable. */ }
}
function providerIcon(name){
 const aliases=SERVICE_ALIASES[name]||[name];
 const iconDir=path.join(LOCAL_ASSETS,'service_icon');
 try{
  const entries=fs.readdirSync(iconDir).filter(n=>/\.(svg|png|webp)$/i.test(n));
  const darkVariants = new Set(['deepl','tencent','transmart']);
  if(currentThemeIsDark && darkVariants.has(name)){
    const match = entries.find(n => n.toLowerCase() === `${name}-dark.svg`);
    if(match) return {ImageType:'relative',ImageData:'assets/service_icon/'+match};
  }
  // Prefer SVG over PNG, irrespective of the filename casing.
  const normalize=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(const extension of ['svg','png','webp']){
   for(const alias of aliases){
    const file=entries.find(n=>n.toLowerCase().endsWith('.'+extension)&&normalize(n.slice(0,-extension.length-1))===alias);
    if(file)return {ImageType:'relative',ImageData:'assets/service_icon/'+file};
    const named=entries.find(n=>n.toLowerCase().endsWith('.'+extension)&&normalize(n.slice(0,-extension.length-1))===alias+'logo');
    if(named)return {ImageType:'relative',ImageData:'assets/service_icon/'+named};
   }
  }
 }catch(_){}
 // For missing local assets retain the original Flow icon as a fallback.
 return imageForFile('service_icon/'+name+'.png');
}

const warn={ImageType:'emoji',ImageData:'⚠️'};
let api;
const FALLBACK_I18N = {en_US: {"probe": "en_US", "description": "Multi-provider translation for Wox. Google, Microsoft, DeepL and more. UI follows the Wox language automatically.", "copy_translation": "Copy translation", "copy_original": "Copy original", "original": "Original text", "provider": "Provider", "direction": "Direction", "auto": "Detect automatically", "enter_copy": "Enter to copy", "enter_text": "Enter text to translate", "unsupported_language": "Unsupported language code", "too_long": "Text too long", "unknown_provider": "Unknown provider", "translation_failed": "Translation failed", "no_providers": "No translation providers selected", "mode_label": "Translation mode", "mode_configured": "Configured direction", "mode_zh_en": "Chinese ↔ English (automatic)", "source_label": "Source language code (auto, en, pt_br...)", "target_label": "Target language code (pt_br, en, es...)", "providers_label": "Translation providers (one per line)", "pairs_label": "Quick language pairs (one per line)", "timeout_label": "Request timeout (ms)", "delay_label": "Translation delay (ms)", "deepl_key_label": "DeepL API key (optional)", "deeplx_url_label": "DeepLX URL (optional)", "mtran_url_label": "MTranServer URL (optional)", "mtran_token_label": "MTranServer token (optional)", "openai_base_url_label": "OpenAI-compatible base URL", "openai_api_key_label": "OpenAI-compatible API key (optional)", "openai_model_label": "OpenAI-compatible model", "openai_system_prompt_label": "Custom system prompt (optional)", "openai_user_prompt_label": "Custom user prompt (use {text})", "openai_language_names_label": "Custom language names JSON (optional)", "choose_pair": "Choose language pair", "settings_hint": "Edit languages and providers in plugin settings", "unsupported_providers": "Available providers", "no_provider_hint": "Open settings and add google, bing or deepl", "error_limit": "Limit: 10,000 characters", "instructions": "Type tr <text> · tr >en hello · tr en>pt_br hello", "providers_hidden": "Providers hidden after repeated failures", "show_again": "Show again", "known_limits": "Known limitations"},pt_BR: {"probe": "pt_BR", "description": "Traduza com Google, Bing, DeepL e outros serviços. A interface acompanha o idioma do Wox.", "copy_translation": "Copiar tradução", "copy_original": "Copiar texto original", "original": "Texto original", "provider": "Provedor", "direction": "Idiomas", "auto": "Detectar automaticamente", "enter_copy": "Enter para copiar", "enter_text": "Digite um texto para traduzir", "unsupported_language": "Código de idioma não suportado", "too_long": "Texto muito longo", "unknown_provider": "Provedor desconhecido", "translation_failed": "Falha na tradução", "no_providers": "Nenhum provedor de tradução selecionado", "mode_label": "Modo de tradução", "mode_configured": "Direção configurada", "mode_zh_en": "Chinês ↔ Inglês (automático)", "source_label": "Idioma de origem (auto, en, pt_br...)", "target_label": "Idioma de destino (pt_br, en, es...)", "providers_label": "Serviços de tradução (um por linha)", "pairs_label": "Pares rápidos de idiomas (um por linha)", "timeout_label": "Tempo limite da requisição (ms)", "delay_label": "Atraso antes de traduzir (ms)", "deepl_key_label": "Chave de API do DeepL (opcional)", "deeplx_url_label": "URL do DeepLX (opcional)", "mtran_url_label": "URL do MTranServer (opcional)", "mtran_token_label": "Token do MTranServer (opcional)", "openai_base_url_label": "URL base de API compatível com OpenAI", "openai_api_key_label": "Chave de API compatível com OpenAI (opcional)", "openai_model_label": "Modelo compatível com OpenAI", "openai_system_prompt_label": "Prompt de sistema personalizado (opcional)", "openai_user_prompt_label": "Prompt de usuário personalizado (use {text})", "openai_language_names_label": "Nomes de idiomas personalizados em JSON (opcional)", "choose_pair": "Escolher par de idiomas", "settings_hint": "Altere idiomas e serviços nas configurações do plugin", "unsupported_providers": "Provedores disponíveis", "no_provider_hint": "Abra as configurações e adicione google, bing ou deepl", "error_limit": "Limite: 10.000 caracteres", "instructions": "Digite tr <texto> · tr >en olá · tr en>pt_br hello", "providers_hidden": "Provedores ocultos após falhas repetidas", "show_again": "Reexibir", "known_limits": "Limitações conhecidas"}};
let currentLanguage = 'en_US';
async function identifyWoxLanguage(ctx) {
  try {
    const probe = await api.GetTranslation(ctx, 'probe');
    if (typeof probe === 'string' && probe.trim() === 'pt_BR') return 'pt_BR';
    if (typeof probe === 'string' && probe.trim() === 'en_US') return 'en_US';
  } catch (_) {}
  return 'en_US';
}
async function localize(ctx,key) {
  try {
    const str = await api.GetTranslation(ctx,key);
    if (typeof str === 'string' && str.trim() && str !== key && str !== 'i18n:'+key) return str;
  } catch (_) {}
  return (FALLBACK_I18N[currentLanguage]||FALLBACK_I18N.en_US)[key]||FALLBACK_I18N.en_US[key]||key;
}
function languageName(code,lang) {
  const normalized=code==='pt'?'pt_br':code;
  if (normalized==='auto') return (FALLBACK_I18N[lang]||FALLBACK_I18N.en_US).auto;
  try { const name=new Intl.DisplayNames([lang==='pt_BR'?'pt-BR':'en-US'],{type:'language'}).of(normalized.replaceAll('_','-'));
    if (name && name.toLowerCase()!==normalized.toLowerCase()) return name;
  } catch (_) {}
  return LANG_NAMES[normalized]||normalized;
}

function nested(x,p){for(const n of p){if(!Array.isArray(x))return; x=x[n];}return x;}
function parseBatch(body){for(const line of String(body).split('\n')){if(!line.startsWith('[['))continue;let rows;try{rows=JSON.parse(line);}catch{continue;} const call=Array.isArray(rows)&&rows.find(x=>nested(x,[0])==='wrb.fr'&&nested(x,[1])==='MkEWBc');if(!call)continue;if(typeof call[2]!=='string')throw Error('Google rejected the language pair');let payload;try{payload=JSON.parse(call[2]);}catch{continue;}let tuples=nested(payload,[1,0,0,5]);if(Array.isArray(tuples)){let text=tuples.map(x=>nested(x,[0])).filter(x=>typeof x==='string').join('').trim();if(text)return text;}}return null;}
function parseGtx(body){return Array.isArray(body?.[0])?body[0].map(x=>Array.isArray(x)?x[0]:'').filter(x=>typeof x==='string').join('')||null:null;}
async function fetchData(url,opts={},s={}){
 let res;
 try{res=await fetch(url,{...opts,signal:AbortSignal.timeout(s.timeout||12000)});}
 catch(e){
  const cause=e?.cause;const code=String(cause?.code||'');const host=new URL(url).hostname;
  if(/CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ERR_TLS|TLS/i.test(code))throw Error('TLS/certificate error on '+host+' ('+code+') — server-side issue, try again later');
  if(code==='ENOTFOUND'||code==='EAI_AGAIN')throw Error('DNS failure for '+host+' — check connectivity or the service may be offline');
  if(code==='ECONNREFUSED')throw Error('Connection refused by '+host);
  if(code==='ETIMEDOUT'||code==='ECONNRESET'||e.name==='TimeoutError')throw Error('Connection timeout on '+host);
  throw e;
 }
 if(!res.ok)throw Error('HTTP '+res.status+' from '+new URL(url).hostname);return res;
}
async function jsonRequest(url,opts,s){return (await fetchData(url,opts,s)).json();}
function mapLang(provider,raw){let v=raw.toLowerCase().replace(/-/g,'_');if(v==='pt')v='pt_br';if(v==='zh_cn')v='zh';if(v==='zh_tw')v='zh_hant';if(provider==='deepl'){if(v==='auto')return 'auto'; if(v==='pt_br')return 'pt-br';if(v==='pt_pt')return 'pt-pt';return v.replace('_','-');}if(v==='pt_br'||v==='pt_pt')return 'pt';if(v==='zh_hant')return provider==='bing'?'zh-Hant':provider==='youdao'?'zh-CHT':'zh-TW';if(v==='zh')return provider==='bing'?'zh-Hans':provider==='google'?'zh-CN':provider==='youdao'?'zh-CHS':'zh';if(v==='auto'&&provider==='bing')return 'auto-detect';if(v==='ko'&&provider==='youdao')return 'kor';return v.replace('_','-');}
async function google(text,from,to,s){const query=new URLSearchParams({'rpcids':'MkEWBc','source-path':'/','f.sid':'','bl':'','hl':'en','soc-app':'1','soc-platform':'1','soc-device':'1','_reqid':'1000','rt':'c'});const rpc=JSON.stringify([[['MkEWBc',JSON.stringify([[text,from,to,true],[null]]),null,'generic']]]);try{const r=await fetchData(RPC_URL+'?'+query,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8','Referer':'https://translate.google.com/','Origin':'https://translate.google.com','X-Same-Domain':'1','User-Agent':UA},body:'f.req='+encodeURIComponent(rpc)},s);const value=parseBatch(await r.text());if(value)return value;}catch(e){if(/rejected the language pair/.test(String(e)))throw e;}
 const u=new URL(GTX_URL);for(const [k,v] of Object.entries({client:'gtx',sl:from,tl:to,hl:to,dt:'t',q:text,ie:'UTF-8',oe:'UTF-8'}))u.searchParams.set(k,v);const val=parseGtx(await jsonRequest(u,{headers:{'User-Agent':UA,'Referer':'https://translate.google.com/'}},s));if(!val)throw Error('Unexpected Google Translate response');return val;}
async function bing(text,from,to,s){const u=new URL('https://edge.microsoft.com/translate/translatetext');u.searchParams.set('isEnterpriseClient','false');u.searchParams.set('to',to);if(from!=='auto-detect')u.searchParams.set('from',from);const data=await jsonRequest(u,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':UA},body:JSON.stringify([text])},s);const val=Array.isArray(data)?data.map(x=>x?.translations?.[0]?.text||'').join('').trim():'';if(!val)throw Error('Empty Bing translation');return val;}
async function deepl(text,from,to,s){if(s.deepl_key){const base=s.deepl_key.endsWith(':fx')?'https://api-free.deepl.com':s.deepl_key.endsWith(':dp')?'https://api.deepl-pro.com':'https://api.deepl.com';try{return await jsonRequest(base+'/v2/translate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'DeepL-Auth-Key '+s.deepl_key},body:JSON.stringify({text:[text],...(from!=='auto'?{source_lang:from.slice(0,2).toUpperCase()}:{}),target_lang:to.toUpperCase()})},s).then(d=>d?.translations?.[0]?.text||Promise.reject(Error('Empty DeepL translation')));}catch(e){const m=String(e?.message||e);if(/HTTP 401|HTTP 403/.test(m))throw Error('DeepL API key rejected (HTTP 401/403) — check the deepl_key setting');if(/HTTP 456/.test(m))throw Error('DeepL quota exceeded (HTTP 456)');if(/HTTP 429/.test(m))throw Error('DeepL rate limited (HTTP 429) — wait a moment and retry');throw e;}}
 // Keyless endpoint: shared and heavily rate-limited by DeepL (HTTP 429, code 1042911/1042912).
 // One short retry, then a clear message instead of a generic failure.
 const build=()=>{const body={jsonrpc:'2.0',method:'LMT_handle_texts',params:{splitting:'newlines',lang:{source_lang_user_selected:from==='auto'?'auto':from.slice(0,2).toUpperCase(),target_lang:to.slice(0,2).toUpperCase()},texts:[{text,requestAlternatives:3}],timestamp:Date.now()+(text.match(/[a-z]/gi)||[]).length},id:Math.floor(100000+Math.random()*100000)};return JSON.stringify(body).replace('"method":"','"method": "');};
 let last='unavailable';
 for(let attempt=0;attempt<2;attempt++){
  if(attempt)await new Promise(r=>setTimeout(r,2000));
  try{const data=await jsonRequest('https://www2.deepl.com/jsonrpc',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':UA,'Origin':'https://www.deepl.com','Referer':'https://www.deepl.com/'},body:build()},s);const value=data?.result?.texts?.[0]?.text;if(value)return value;throw Error('Empty DeepL translation');}
  catch(e){const m=String(e?.message||e);if(/HTTP 429/.test(m)){last=m;continue;}throw e;}
 }
 throw Error('DeepL free web endpoint rate-limited (HTTP 429) — a shared, unofficial service. Try again in a moment, or configure a DeepL API key (deepl_key) in settings for the official API');}
async function youdao(text,from,to,s){const ua='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';const headers={'User-Agent':ua,'Referer':'https://fanyi.youdao.com/','Origin':'https://fanyi.youdao.com','Cookie':`OUTFOX_SEARCH_USER_ID_NCOO=${Math.random()*1e9|0}.${Math.random()*1e9|0};OUTFOX_SEARCH_USER_ID=${Math.random()*1e9|0}@${Math.random()*255|0}.${Math.random()*255|0}.${Math.random()*255|0}.${Math.random()*255|0}`};
 // Parameters mirror the current fanyi.youdao.com web client (app.js 1.0.9): keyid "webfanyi-key-getter-2025",
 // appVersion 12.0.0 and the mid/screen/model/network/abtest/yduuid fields — older requests are rejected (code 40/50).
 const base=(key)=>{const t=String(Date.now());return {sign:crypto.createHash('md5').update(`client=fanyideskweb&mysticTime=${t}&product=webfanyi&key=${key}`).digest('hex'),client:'fanyideskweb',product:'webfanyi',appVersion:'12.0.0',vendor:'web',pointParam:'client,mysticTime,product',mysticTime:t,keyfrom:'fanyi.web',mid:'1',screen:'1',model:'1',network:'wifi',abtest:'0',yduuid:'abcdefg'};};
 const keyUrl=new URL('https://dict.youdao.com/webtranslate/key');Object.entries({keyid:'webfanyi-key-getter-2025',...base('yU5nT5dK3eZ1pI4j')}).forEach(([k,v])=>keyUrl.searchParams.set(k,v));const secret=(await jsonRequest(keyUrl,{headers},s))?.data?.secretKey;if(!secret)throw Error('Youdao secret key unavailable');
 const p=new URLSearchParams({i:text,from,to,dictResult:'true',keyid:'webfanyi',...base(secret)});
 const r=await fetchData('https://dict.youdao.com/webtranslate',{method:'POST',headers:{...headers,'Content-Type':'application/x-www-form-urlencoded'},body:p},s);
 const encrypted=(await r.text()).replace(/-/g,'+').replace(/_/g,'/');
 const md=x=>crypto.createHash('md5').update(x).digest().subarray(0,16);const key=md('ydsecret://query/key/B*RGygVywfNBwpmBaZg*WT7SIOUP2T0C9WHMZN39j^DAdaZhAnxvGcCY6VYFwnHl');const iv=md('ydsecret://query/iv/C@lZe2YzHtZ2CYgaXKSVfsb7Y4QWHjITPPZ0nQp87fBeJ!Iv6v^6fvi2WN@bYpJ4');
 let parsed;try{const decipher=crypto.createDecipheriv('aes-128-cbc',key,iv);parsed=JSON.parse(decipher.update(encrypted,'base64','utf8')+decipher.final('utf8'));}catch{throw Error('Youdao returned an unreadable response (payload format changed)');}
 if(typeof parsed?.code==='number'&&parsed.code!==0)throw Error(`Youdao rejected the request (code ${parsed.code}${parsed.code===40?' · language pair unsupported by Youdao':''})`);
 const rows=parsed?.translateResult?.[0];const value=Array.isArray(rows)?rows.map(x=>typeof x?.tgt==='string'?x.tgt:'').join(''):'';
 if(!value)throw Error('Empty Youdao translation');
 if(typeof parsed.type==='string'&&parsed.type.includes('2')&&!parsed.type.endsWith('2'+to))throw Error(`Youdao returned ${parsed.type.split('2')[1]} instead of ${to} (pair unsupported)`);
 return value;}
// The free WeChat mini-app endpoint only honours two shapes of request (verified 2026-10):
// X → zh (simplified, from any source) and zh → X (explicit zh source). Anything else silently
// returns Chinese, so we refuse the pair up front and verify the language actually returned.
const TENCENT_TARGETS=new Set(['zh','en','ja','ko','fr','es','ru','de','it','tr','pt','vi','id','th','ms','ar','hi']);
async function tencent(text,from,to,s){if(to==='zh-TW')throw Error('Tencent (free endpoint) returns Simplified Chinese only — zh_hant is unsupported');if(from!=='zh'&&to!=='zh')throw Error('Tencent (free endpoint) only supports translation to or from Chinese — use another provider for this pair');if(!TENCENT_TARGETS.has(to))throw Error('Tencent (free endpoint) does not support target language '+to);
 const u=new URL('https://wxapp.translator.qq.com/api/translate');Object.entries({source:from==='zh'?'zh':'auto',target:to==='zh'?'auto':to,sourceText:text,platform:'WeChat_APP',guid:'oqdgX0SIwhvM0TmqzTHghWBvfk22',candidateLangs:`${from==='zh'?'zh':'auto'}|${to==='zh'?'zh':to}`}).forEach(([k,v])=>u.searchParams.set(k,v));const d=await jsonRequest(u,{headers:{'User-Agent':'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.32','Referer':'https://servicewechat.com/wxb1070eabc6f9107e/117/page-frame.html'}},s);const value=String(d?.targetText||'').trim();if(!value)throw Error('Empty Tencent translation');if(d?.target!==to)throw Error(`Tencent returned ${d?.target||'unknown'} instead of ${to} (pair unsupported)`);return value;}
async function transmart(text,from,to,s){const data=await jsonRequest('https://transmart.qq.com/api/imt',{method:'POST',headers:{'Content-Type':'application/json','User-Agent':UA,'Referer':'https://transmart.qq.com/zh-CN/index'},body:JSON.stringify({header:{fn:'auto_translation',client_key:'browser-chrome-110.0.0-Mac OS-df4bd4c5-a65d-44b2-a40f-42f34f3535f2-1677486696487'},type:'plain',model_category:'normal',source:{lang:from,text_list:[text]},target:{lang:to}})},s);const value=Array.isArray(data?.auto_translation)?data.auto_translation.join('\n').trim():'';if(!value){const rc=data?.header?.ret_code;throw Error('Empty Transmart translation'+(rc&&rc!=='succ'?` (ret_code ${rc})`:''));}return value;}
async function caiyun(text,from,to,s){const d=await jsonRequest('https://interpreter.cyapi.cn/v1/translator',{method:'POST',headers:{'Content-Type':'application/json','x-authorization':'token ssdj273ksdiwi923bsd9','User-Agent':'caiyunInterpreter/5 CFNetwork/1404.0.5 Darwin/22.3.0'},body:JSON.stringify({source:text,detect:true,os_type:'ios',device_id:'F1F902F7-1780-4C88-848D-71F35D88A602',trans_type:`${from}2${to}`,media:'text',request_id:Date.now()%1000000000,user_id:'',dict:true})},s);return d?.target||Promise.reject(Error('Empty Caiyun translation'));}
async function volcengine(text,from,to,s){const d=await jsonRequest('https://translate.volcengine.com/crx/translate/v1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,source_language:from,target_language:to})},s);return d?.translation||Promise.reject(Error('Empty Volcengine translation'));}
async function deeplx(text,from,to,s){if(!s.deeplx_url)throw Error('Configure DeepLX URL in plugin settings');const d=await jsonRequest(s.deeplx_url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,source_lang:from,target_lang:to})},s);return d?.data||d?.translation||Promise.reject(Error('Empty DeepLX translation'));}
async function mtranserver(text,from,to,s){if(!s.mtran_url)throw Error('Configure MTranServer URL in plugin settings');const u=s.mtran_url.replace(/\/$/,'')+'/translate';const d=await jsonRequest(u,{method:'POST',headers:{'Content-Type':'application/json',...(s.mtran_token?{'Authorization':'Bearer '+s.mtran_token}:{})},body:JSON.stringify({from,to,text})},s);return d?.result||d?.translation||Promise.reject(Error('Empty MTranServer translation'));}
async function openai(text,from,to,s){const url=s.openai_base_url.replace(/\/$/,'')+'/chat/completions';const custom=s.openai_language_names?JSON.parse(s.openai_language_names):{};const values={from:custom[from]||LANG_NAMES[from]||from,to:custom[to]||LANG_NAMES[to]||to,text};const tmpl=(t)=>t.replace(/\{(from|to|text)\}/g,(_,key)=>values[key]);const system=s.openai_system_prompt||'You are a professional translation assistant. Translate accurately and naturally. Only return translated text.';const user=s.openai_user_prompt||'Translate the following text from {from} to {to}:\n\n{text}';if(!user.includes('{text}'))throw Error('Custom user prompt needs {text}');const d=await jsonRequest(url,{method:'POST',headers:{'Content-Type':'application/json',...(s.openai_api_key?{'Authorization':'Bearer '+s.openai_api_key}:{})},body:JSON.stringify({model:s.openai_model,messages:[{role:'system',content:tmpl(system)},{role:'user',content:tmpl(user)}],temperature:0.3,max_tokens:2000})},s);return d?.choices?.[0]?.message?.content?.trim()||Promise.reject(Error('Empty OpenAI-compatible response'));}
const METHODS={google,bing,deepl,youdao,tencent,transmart,caiyun,volcengine,deeplx,mtranserver,openai};
async function setting(ctx,key,fallback){try{const raw=await api.GetSetting(ctx,key);return typeof raw==='string'&&raw.trim()?raw.trim():fallback;}catch{return fallback;}}
async function settings(ctx){const names={translation_mode:'configured',source_language:'auto',target_language:'pt_br',providers:'google',language_pairs:'en>pt_br\npt_br>en',timeout_ms:'12000',delay_ms:'300',deepl_key:'',deeplx_url:'',mtran_url:'',mtran_token:'',openai_base_url:'https://api.openai.com/v1',openai_api_key:'',openai_model:'gpt-4o-mini',openai_system_prompt:'',openai_user_prompt:'',openai_language_names:''};const pairs=await Promise.all(Object.entries(names).map(async([k,v])=>[k,await setting(ctx,k,v)]));const s=Object.fromEntries(pairs);s.timeout=Math.max(1000,Math.min(60000,Number(s.timeout_ms)||12000));s.delay=Math.max(0,Math.min(3000,Number(s.delay_ms)||0));s.providers=s.providers.split(/[\n,]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);return s;}
function parseInput(raw,s){let from=s.source_language.trim().toLowerCase()||'auto',to=s.target_language.trim().toLowerCase()||'pt_br',text=String(raw||'').trim();const prefix=text.match(/^([^\s]+)\s+([\s\S]+)$/);if(prefix){const x=prefix[1].toLowerCase();let a,b;if(x.includes('>')){[a,b]=x.split('>');if((!a||LANGUAGES.has(a))&&(!b||LANGUAGES.has(b))&&b){from=a||from;to=b;text=prefix[2];}}else if(s.translation_mode!=='zh-en'&&LANGUAGES.has(x)&&!new Set(['is','it','to','my','he','hi','so','am','as','or','id']).has(x)){to=x;text=prefix[2];}}
 if(s.translation_mode==='zh-en'&&!/^([^\s]*>[^\s]+)\s/.test(raw)){from=/\p{Script=Han}/u.test(text)?'zh':'en';to=from==='zh'?'en':'zh';}
 return {from,to,text};}
function validCode(code){return LANGUAGES.has(code.toLowerCase());}
async function mkResult(ctx,translated,text,provider,from,to,score){
 const lang=await identifyWoxLanguage(ctx);currentLanguage=lang;
 const [copyTranslation,copyOriginal]=await Promise.all(['copy_translation','copy_original'].map(k=>localize(ctx,k)));
 const source=from==='auto'?'Auto':languageName(from,lang);
 const target=languageName(to,lang);
 const providerNames={google:'Google Translate',bing:'Microsoft Translator',deepl:'DeepL',youdao:'Youdao',tencent:'Tencent',transmart:'Transmart',caiyun:'Caiyun',volcengine:'Volcengine',deeplx:'DeepLX',mtranserver:'MTranServer',openai:'OpenAI'};
 const service=providerNames[provider]||provider;
 return {Title:translated,SubTitle:`${source} → ${target} · ${service}`,Icon:providerIcon(provider),Score:score,
 Preview:{PreviewType:'markdown',PreviewData:translated,PreviewProperties:{}},
 Actions:[{Name:copyTranslation,IsDefault:true,Action:async c=>api.Copy(c,{type:'text',text:translated})},{Name:copyOriginal,Action:async c=>api.Copy(c,{type:'text',text})}]};
}
function msgResult(title,subtitle,err=false,score=100,provider=null){
 return {Title:title,SubTitle:subtitle,Icon:provider?providerIcon(provider):(err?warn:icon),Score:score};
}
// Session-scoped provider health: after HIDE_THRESHOLD consecutive failures a provider stops
// being called (it only comes back when the user picks "Show again" on the summary item, or
// when the plugin process restarts). A success resets the counter.
const HIDE_THRESHOLD=3;
const providerHealth=new Map();
function healthOf(name){let h=providerHealth.get(name);if(!h){h={fails:0};providerHealth.set(name,h);}return h;}
function isHidden(name){return (providerHealth.get(name)?.fails||0)>=HIDE_THRESHOLD;}
// Known service-side limitations, surfaced in the error preview (tooltip) per provider.
const PROVIDER_LIMITS={
 deepl:{en_US:'The keyless web endpoint (www2.deepl.com) is heavily rate-limited by DeepL (HTTP 429). For stable results configure an official API key (deepl_key) or use deeplx / mtranserver.',pt_BR:'O endpoint sem chave (www2.deepl.com) sofre rate-limiting severo do DeepL (HTTP 429). Para resultados estáveis, configure uma chave oficial de API (deepl_key) ou use deeplx / mtranserver.'},
 youdao:{en_US:'Youdao web no longer accepts en→pt (code 40). Working pairs include pt→en, en→es, fr→pt, es→pt and auto→en.',pt_BR:'O Youdao web não aceita mais en→pt (código 40). Pares funcionais incluem pt→en, en→es, fr→pt, es→pt e auto→en.'},
 tencent:{en_US:'The free WeChat endpoint only translates X→zh (Simplified) and zh→X. Other pairs always return Chinese, so they are refused before the request. zh_hant is unsupported.',pt_BR:'O endpoint gratuito do WeChat só traduz X→zh (simplificado) e zh→X. Outros pares sempre retornam chinês e são recusados antes da chamada. zh_hant não é suportado.'},
 transmart:{en_US:'transmart.qq.com has served an expired TLS certificate since 2026-10-11; the API itself works. Server-side issue — it should recover when Tencent renews the certificate.',pt_BR:'transmart.qq.com está com certificado TLS expirado desde 11/10/2026; a API em si funciona. É um problema do servidor e deve se resolver quando a Tencent renovar o certificado.'}
};
async function errorPreview(ctx,provider,e,from,to){
 const lang=currentLanguage;
 const names={google:'Google Translate',bing:'Microsoft Translator',deepl:'DeepL',youdao:'Youdao',tencent:'Tencent',transmart:'Transmart',caiyun:'Caiyun',volcengine:'Volcengine',deeplx:'DeepLX',mtranserver:'MTranServer',openai:'OpenAI'};
 const lines=['### '+(names[provider]||provider),'',`${from==='auto'?'Auto':languageName(from,lang)} → ${languageName(to,lang)}`,'',`**${await localize(ctx,'translation_failed')}**`,String(e?.message||e)];
 const limit=(PROVIDER_LIMITS[provider]||{})[lang]||PROVIDER_LIMITS[provider]?.en_US;
 if(limit)lines.push('','---','',`**${await localize(ctx,'known_limits')}**`,'',limit);
 return {PreviewType:'markdown',PreviewData:lines.join('\n'),PreviewProperties:{}};
}
const plugin={async init(ctx,params){api=params.API;currentLanguage=await identifyWoxLanguage(ctx);},async query(ctx,query){
 const lang=await identifyWoxLanguage(ctx);currentLanguage=lang;
 await syncWoxTheme(ctx);
 const tr=async k=>localize(ctx,k);
 const s=await settings(ctx);const raw=query.Search||'';
 if(!raw.trim()){
  const items=[msgResult('MultiTranslate · '+languageName(s.source_language,lang)+' → '+languageName(s.target_language,lang), (await tr('instructions'))+' · '+(await tr('settings_hint')))];
  for(const pair of s.language_pairs.split(/[\n,]+/).map(x=>x.trim()).filter(Boolean)){
   const [a,b]=pair.split('>');if(!validCode(a)||!validCode(b))continue;
   items.push({...msgResult(`${languageName(a,lang)} → ${languageName(b,lang)}`,`tr ${pair} <text>`),Actions:[{Name:await tr('choose_pair'),IsDefault:true,Action:async c=>api.ChangeQuery(c,{QueryType:'input',QueryText:`tr ${pair} `})}]});
  }
  return items;
 }
 const {from,to,text}=parseInput(raw,s);
 if(!text)return [msgResult(await tr('enter_text'),await tr('instructions'))];
 if(!validCode(from)||!validCode(to))return [msgResult(await tr('unsupported_language'),`${from} → ${to}`,true)];
 if(text.length>10000)return [msgResult(await tr('too_long'),await tr('error_limit'),true)];
 if(s.delay)await new Promise(resolve=>setTimeout(resolve,s.delay));
 const items=(await Promise.all(s.providers.map(async(name,i)=>{
  if(!PROVIDERS.has(name))return msgResult(`${await tr('unknown_provider')}: ${name}`,`${await tr('unsupported_providers')}: ${[...PROVIDERS].join(', ')}`,true,100-i);
  if(isHidden(name))return null; // failing repeatedly this session: skipped to keep the list clean
  try {const translated=await METHODS[name](text,mapLang(name,from),mapLang(name,to),s);healthOf(name).fails=0;return await mkResult(ctx,String(translated).trim(),text,name,from,to,100-i);}
  catch(e){healthOf(name).fails++;return {...msgResult(`${name}: ${await tr('translation_failed')}`,String(e?.message||e),true,100-i,name),Preview:await errorPreview(ctx,name,e,from,to)};
  }
 }))).filter(Boolean);
 const hiddenNames=s.providers.filter(name=>PROVIDERS.has(name)&&isHidden(name));
 if(hiddenNames.length){
  const item=msgResult(await tr('providers_hidden'),hiddenNames.join(', ')+' · '+(await tr('show_again')),false,1);
  item.Actions=[{Name:await tr('show_again'),IsDefault:true,Action:async c=>{providerHealth.clear();await api.ChangeQuery(c,{QueryType:'input',QueryText:'tr '+(query.Search||'')});}}];
  items.push(item);
 }
 return items.length?items:[msgResult(await tr('no_providers'),await tr('no_provider_hint'),true)];
}};
module.exports.plugin=plugin;
module.exports.__test={parseInput,parseBatch,parseGtx,mapLang,validCode,languageName,providerIcon,msgResult,fetchData,providers:{google,bing,deepl,youdao,tencent,transmart,caiyun,volcengine,deeplx,mtranserver,openai},METHODS,resetSessionHealth:()=>providerHealth.clear(),HIDE_THRESHOLD};
