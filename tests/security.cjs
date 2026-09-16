// Behavioral model of the JS-compatible public.uc subset. Not a ucode interpreter.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'nimarkoflow/files/usr/lib/public.uc'),'utf8');
const secret='https://example.com/sub/PRIVATE_TOKEN';
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
function execute(method, data={},options={}) {
  let output='';const commands=[];const store={flow:{action:'connection'},flow_source:{url:secret,auto_hwid:'1'}};
  const calls=[];const c={get:(p,s,o)=>store[s]?.[o],set:(p,s,o,v)=>{calls.push([s,o,v]);if(v===undefined){store[s]={};return true;}store[s]??={};store[s][o]=v;return true;},delete:(p,s)=>{delete store[s];return true;},commit:()=>!options.failCommit};
  const backend={service:{nimarkoflow:{running:1,enabled:1,status:options.busy?'restarting':'running'}},actions:{subscription:[]},share_link:'vless://PRIVATE',password:'PRIVATE',url:secret};
  const mockedFS={popen:command=>{commands.push(command);return {read:()=>JSON.stringify(command.includes('get_ui_state')?backend:{success:true,share_link:'vless://PRIVATE',message:secret}),close:()=>0};},open:()=>({read:()=>options.raw??JSON.stringify(data),close:()=>0}),mkdir:()=>!options.locked,chmod:()=>true,unlink:()=>true,rmdir:()=>true,writefile:()=>1};
  const context={ARGV:['call',method],require:n=>n==='fs'?mockedFS:{cursor:()=>c},print:s=>{output+=s;},sprintf:(fmt,value)=>JSON.stringify(value)+'\n',json:JSON.parse,trim:s=>s.trim(),length:s=>s?.length??0,substr:(s,start,len)=>s.substr(start,len),split:(s,re)=>s.split(re),match:(s,re)=>s.match(re),type:v=>v===null?'null':Array.isArray(v)?'array':typeof v,system:command=>{commands.push(command);return options.invalidProtocol?1:0;},exit:()=>{throw 'EXIT';}};
  context.die=message=>{throw new Error(message);};
  try{vm.runInNewContext(source,context,{timeout:1000});}catch(e){if(e!=='EXIT')throw e;}
  return {value:JSON.parse(output),output,commands,calls,store};
}
test('status has only approved scalar fields despite injected backend secrets',()=>{const r=execute('status');assert.deepEqual(Object.keys(r.value).sort(),['available','busy','configured','enabled','hwid','running','source'].sort());assert(!r.output.includes('PRIVATE'));});
test('subscription import defaults to Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0 and enables HWID',()=>{const r=execute('import',{source:secret});assert(r.value.ok);assert.equal(r.store.flow_source.user_agent,'Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0');assert.equal(r.store.flow_source.auto_user_agent,'0');assert.equal(r.store.flow_source.auto_hwid,'1');assert(!r.output.includes('PRIVATE'));assert(r.commands.every(s=>!s.includes(secret)));});
test('empty UA still defaults to Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0',()=>assert.equal(execute('import',{source:secret,user_agent:''}).store.flow_source.user_agent,'Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0'));
test('custom user agent stays configurable',()=>assert.equal(execute('import',{source:secret,user_agent:'Happ/1.0'}).store.flow_source.user_agent,'Happ/1.0'));
test('header injection rejected before commit',()=>{const r=execute('import',{source:secret,user_agent:'Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0\r\nX-Test: bad'});assert.equal(r.value.error,'invalid');assert.equal(r.calls.length,0);});
test('HTTP and invalid source rejected',()=>{for(const input of ['http://example.com/sub','file:///etc/passwd','https://example.com/\nsecret','https://example.com/sub | evil','vless://bad host','']){assert.equal(execute('import',{source:input}).value.error,'invalid');}});
test('real parser failure prevents raw link persistence',()=>{const r=execute('import',{source:'vless://invalid'},{invalidProtocol:true});assert.equal(r.value.error,'invalid');assert.equal(r.calls.length,0);});
test('raw links do not enter command arguments or API responses',()=>{const r=execute('import',{source:'vless://PRIVATE@example.com:443'});assert(r.value.ok);assert(r.commands.every(s=>!s.includes('PRIVATE')));assert(!r.output.includes('PRIVATE'));});
test('oversized source rejected before writes',()=>{const r=execute('import',{source:'x'.repeat(17000)});assert.equal(r.value.error,'invalid');assert.equal(r.calls.length,0);});
test('invalid routing mode rejected',()=>assert.equal(execute('import',{source:secret,mode:'$(cat /etc/passwd)'}).value.error,'invalid'));
test('malformed JSON becomes fixed error',()=>{const r=execute('import',{}, {raw:'PRIVATE'});assert.equal(r.value.error,'failed');assert(!r.output.includes('PRIVATE'));});
test('storage failure does not return exception or secrets',()=>{const r=execute('import',{source:secret},{failCommit:true});assert.equal(r.value.error,'failed');assert(!r.output.includes(secret));});
test('caller cannot choose a shell command or backend method',()=>{for(const method of ['show_config','show_sing_box_config','check_logs','clash_api','connect;cat /etc/passwd']){const r=execute(method);assert.equal(r.value.error,'denied');assert.equal(r.commands.length,0);}});
test('active operations and lock deny competing writes',()=>{assert.equal(execute('import',{source:secret},{busy:true}).value.error,'busy');assert.equal(execute('connect',{}, {locked:true}).value.error,'busy');});
test('refresh invokes fixed subscription update command',()=>{const r=execute('refresh');assert(r.value.ok);assert(r.commands.some(s=>s.includes('subscription_update_async flow')));assert(!r.output.includes('PRIVATE'));});
test('ACL provides no UCI, file or generic executable access',()=>{const acl=JSON.parse(fs.readFileSync(path.join(root,'luci-app-nimarkoflow/root/usr/share/rpcd/acl.d/nimarkoflow.json')));assert.deepEqual(acl['nimarkoflow-user'].read,{ubus:{nimarkoflow:['status']}});assert.deepEqual(acl['nimarkoflow-user'].write,{ubus:{nimarkoflow:['import','connect','disconnect','refresh','remove']}});});
test('controller is confined to loopback regardless of old settings',()=>{const generator=fs.readFileSync(path.join(root,'nimarkoflow/files/usr/lib/singbox/generator.uc'),'utf8');const body=generator.match(/function clash_api_config[\s\S]*?\n\}/)[0];assert(body.includes('127.0.0.1:9090'));assert(!body.includes('0.0.0.0'));});
test('public frontend has no original app imports or browser secret storage',()=>{const front=fs.readFileSync(path.join(root,'luci-app-nimarkoflow/htdocs/luci-static/resources/view/nimarkoflow/flow.js'),'utf8');assert(!/forkop|localStorage|sessionStorage|file\.exec|show_sing_box_config/i.test(front));assert(front.includes("value: 'Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0'"));new Function(front);});
test('raw subscription downloader fallback uses Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0',()=>{const cache=fs.readFileSync(path.join(root,'nimarkoflow/files/usr/lib/subscription/cache.uc'),'utf8');const body=cache.match(/function get_subscription_user_agent[\s\S]*?\n\}/)[0];assert(body.includes('return "Happ/5.7.0/ios/2609021014549 NimarkoFlow/0.1.0";'));assert(cache.includes('"X-HWID: "'));});
console.log(checks+' security model checks passed');
