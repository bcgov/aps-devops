import { Layout } from "../components/Layout.tsx";
import { Breadcrumb } from "../components/Breadcrumb.tsx";
import { CONSOLE_PAGES } from "../components/ConsoleNav.tsx";
import type { Service, Subsystem } from "../types.ts";
import type { SiteConfig } from "../types.ts";
import type { SessionUser } from "../lib/auth.ts";

interface TrafficPageProps {
  subsystems: Subsystem[];
  services: Service[];
  logStreamUrl: string;
  config: SiteConfig;
  currentPath: string;
  user?: SessionUser | null;
}

export function TrafficPage({
  logStreamUrl,
  config: _config,
  currentPath,
  user,
}: TrafficPageProps) {
  const safeUrl = JSON.stringify(logStreamUrl);
  const safeMax = JSON.stringify(50);

  return (
    <Layout title="Traffic" currentPath={currentPath} user={user}>
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Member Console", href: "/console" },
          {
            label: "Traffic",
            menu: CONSOLE_PAGES.filter((p) => p.href !== "/traffic"),
          },
        ]}
      />

      <div className="bg-bc-blue text-ink-invert">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
          <h1 className="text-4xl font-bold mb-2">Traffic</h1>
          <p className="text-ink-invert-secondary">
            End-to-end flows from a client, through its runtime group, to the
            service runtime group and service. Each flow correlates the
            consumer and provider log records.
          </p>
        </div>
      </div>
      <div className="h-1 bg-bc-gold" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-lg border border-border shadow-sm overflow-hidden">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border bg-surface-muted">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center gap-2 text-sm shrink-0">
                <span
                  id="tf-dot"
                  className="inline-block w-2.5 h-2.5 rounded-full bg-ink-disabled animate-pulse"
                />
                <span id="tf-status" className="font-medium text-ink">
                  connecting…
                </span>
              </span>
              <span className="flex items-center gap-3 text-xs text-ink-secondary">
                <span>
                  <span className="inline-block w-3 h-3 rounded-full bg-bc-blue align-middle mr-1" />
                  consumer
                </span>
                <span>
                  <span className="inline-block w-3 h-3 rounded-full bg-bc-gold align-middle mr-1" />
                  provider
                </span>
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="text-ink-secondary">
                flows{" "}
                <span
                  id="tf-count"
                  className="font-semibold text-ink tabular-nums"
                >
                  0
                </span>
              </span>
              <button
                id="tf-pause"
                type="button"
                className="px-3 py-1 bg-btn-primary text-white rounded font-medium hover:bg-btn-primary-hover"
              >
                Pause
              </button>
              <button
                id="tf-clear"
                type="button"
                className="px-3 py-1 bg-btn-secondary border border-border-dark text-ink rounded font-medium hover:bg-btn-secondary-hover"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Empty state */}
          <div
            id="tf-empty"
            className="px-4 py-12 text-center text-sm text-ink-placeholder"
          >
            Waiting for correlated traffic… (rows appear once both the consumer
            and provider log records arrive)
          </div>

          {/* Flow list */}
          <ul id="tf-list" className="divide-y divide-border text-xs" />
        </div>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
  var URL=${safeUrl},MAX=${safeMax};
  var list=document.getElementById('tf-list');
  var empty=document.getElementById('tf-empty');
  var statusEl=document.getElementById('tf-status');
  var dot=document.getElementById('tf-dot');
  var countEl=document.getElementById('tf-count');
  var pauseBtn=document.getElementById('tf-pause');
  var clearBtn=document.getElementById('tf-clear');
  var paused=false,count=0;

  function setStatus(s,cls){statusEl.textContent=s;dot.className='inline-block w-2.5 h-2.5 rounded-full '+cls;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function statusBadge(code){
    var n=parseInt(code,10),cls='bg-surface-muted text-ink-secondary';
    if(n>=200&&n<300)cls='bg-support-success-bg text-support-success-border';
    else if(n>=300&&n<400)cls='bg-support-info-bg text-support-info-border';
    else if(n>=400&&n<500)cls='bg-support-danger-bg text-danger';
    else if(n>=500)cls='bg-support-warning-bg text-ink';
    return '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-semibold '+cls+'">'+esc(code)+'</span>';
  }
  function methodBadge(m){
    var cls='bg-surface-muted text-ink-secondary';
    if(m==='GET')cls='bg-support-info-bg text-support-info-border';
    else if(m==='POST')cls='bg-support-success-bg text-support-success-border';
    else if(m==='PUT'||m==='PATCH')cls='bg-support-warning-bg text-ink';
    else if(m==='DELETE')cls='bg-support-danger-bg text-danger';
    return '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-semibold '+cls+'">'+esc(m||'?')+'</span>';
  }
  function fmtTime(ms){var d=new Date(ms);return d.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});}
  function fmtLat(n){return n==null||n<0?'—':n+'ms';}
  function fmtBytes(n){if(n==null)return '—';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB';}

  function findHdr(h,name){
    if(!h)return '';
    var t=name.toLowerCase();
    for(var k in h){if(Object.prototype.hasOwnProperty.call(h,k)&&k.toLowerCase()===t){var x=h[k];return Array.isArray(x)?(x[0]||''):(x||'');}}
    return '';
  }
  function corrOf(v){
    if(v.correlation_id)return v.correlation_id;
    var req=v.request||{},route=v.route||{};
    return findHdr(req.headers,'correlation-id')||findHdr(route.headers,'correlation-id');
  }
  // Role from the ns.<gw>.<n>.(c|p) service tag; falls back to the service name segment.
  function roleOf(v){
    var svc=v.service||{},tags=svc.tags||[];
    for(var i=0;i<tags.length;i++){
      var tg=tags[i];
      if(typeof tg==='string'&&tg.indexOf('ns.')===0){
        var m=/\\.(c|p)$/.exec(tg);
        if(m)return m[1];
      }
    }
    var name=(svc.name||'').split('.');
    if(name[0]==='sdx'&&(name[3]==='c'||name[3]==='p'))return name[3];
    return '';
  }
  function tagVal(v,prefix){
    var tags=(v.service&&v.service.tags)||[];var p=prefix+':';
    for(var i=0;i<tags.length;i++){if(typeof tags[i]==='string'&&tags[i].indexOf(p)===0)return tags[i].slice(p.length);}
    return '';
  }

  var GROUP_PALETTE=['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16'];
  function groupColor(id){if(!id)return '#94a3b8';var h=0;for(var i=0;i<id.length;i++){h=(h*31+id.charCodeAt(i))>>>0;}return GROUP_PALETTE[h%GROUP_PALETTE.length];}

  function pluginChip(p){
    if(!p||typeof p!=='object')return '';
    var ok=p.continued===true;
    var cls=ok?'bg-support-success-bg border-support-success-border text-support-success-border':'bg-support-danger-bg border-support-danger-border text-danger';
    var icon=ok?'✓':'✗';
    return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs '+cls+'"><span class="font-bold">'+icon+'</span><span class="font-semibold font-mono">'+esc(p.plugin||'?')+'</span><span class="opacity-80">'+esc(p.reason||'')+'</span></span>';
  }
  function pluginRow(arr){
    if(!Array.isArray(arr)||arr.length===0)return '';
    var chips='';for(var i=0;i<arr.length;i++){chips+=pluginChip(arr[i]);}
    return '<div class="col-span-2 lg:col-span-4 flex items-start gap-2 mt-1"><span class="text-ink-placeholder shrink-0 pt-0.5">controls</span><span class="flex flex-wrap gap-1.5">'+chips+'</span></div>';
  }

  function chip(text,cls){return '<span class="px-2 py-0.5 rounded text-xs font-mono truncate max-w-[180px] '+cls+'" title="'+esc(text)+'">'+esc(text||'?')+'</span>';}
  function arrow(sym){return '<span class="text-ink-placeholder shrink-0">'+(sym||'→')+'</span>';}

  // One log record's detail block — mirrors the /logs expanding panel.
  function legBlock(title,accent,leg){
    var v=leg.v,evt=leg.evt;
    var req=v.request||{},res=v.response||{},lat=v.latencies||{},route=v.route||{},svc=v.service||{};
    var corr=corrOf(v),corrColor=groupColor(corr);
    var verifHtml=evt&&typeof evt.verificationHtml==='string'?evt.verificationHtml:'';
    var raw=JSON.stringify(evt,null,2);
    return '<div class="border border-border rounded overflow-hidden">'+
      '<div class="px-3 py-1.5 bg-surface-muted border-b border-border flex items-center gap-2 text-xs">'+
        '<span class="inline-block w-2 h-2 rounded-full '+accent+' shrink-0"></span>'+
        '<span class="font-semibold text-bc-blue">'+esc(title)+'</span>'+
        methodBadge(req.method||'')+
        statusBadge(res.status==null?'—':String(res.status))+
        '<span class="text-ink-secondary truncate flex-1 min-w-0" title="'+esc(svc.name||'')+'">'+esc(svc.name||'')+'</span>'+
        '<span class="text-ink-placeholder shrink-0">'+esc(v.namespace||'')+'</span>'+
      '</div>'+
      '<div class="px-3 py-2 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-ink-secondary">'+
        '<div><span class="text-ink-placeholder">client ip</span> '+esc(v.client_ip||'—')+'</div>'+
        '<div><span class="text-ink-placeholder">size</span> '+esc(fmtBytes(res.size))+'</div>'+
        '<div><span class="text-ink-placeholder">kong lat</span> '+esc(fmtLat(lat.kong))+'</div>'+
        '<div><span class="text-ink-placeholder">proxy lat</span> '+esc(fmtLat(lat.proxy))+'</div>'+
        '<div class="col-span-2"><span class="text-ink-placeholder">route</span> '+esc(route.name||'—')+'</div>'+
        '<div class="col-span-2"><span class="text-ink-placeholder">gateway</span> '+esc(v.namespace||'—')+' · <span class="text-ink-placeholder">dc</span> '+esc(v.datacenter||'—')+(v.app_version?' · <span class="text-ink-placeholder">app</span> <span class="font-mono">'+esc(v.app_version)+'</span>':'')+'</div>'+
        '<div class="col-span-2 lg:col-span-4 truncate" title="'+esc(req.id||'')+'"><span class="text-ink-placeholder">request id</span> '+esc(req.id||'—')+'</div>'+
        '<div class="col-span-2 lg:col-span-4 truncate" title="'+esc(corr||'')+'"><span class="text-ink-placeholder">correlation id</span> '+(corr?'<span style="color:'+corrColor+';font-weight:600">'+esc(corr)+'</span>':'—')+'</div>'+
        pluginRow(v.plugin_results)+
        verifHtml+
      '</div>'+
      '<pre class="mx-3 mb-3 p-2 bg-surface-muted border border-border rounded overflow-auto text-xs leading-snug max-h-60">'+esc(raw)+'</pre>'+
    '</div>';
  }

  function render(flow){
    var c=flow.c,p=flow.p,cv=c.v,pv=p.v;
    var client=tagVal(cv,'client')||tagVal(pv,'client');
    var service=tagVal(cv,'service')||tagVal(pv,'service');
    var cRG=cv.namespace||'?',pRG=pv.namespace||'?';
    var req=cv.request||{},res=cv.response||{},lat=cv.latencies||{};
    var pLat=(pv.latencies||{}).request;
    var time=fmtTime(cv.started_at||pv.started_at||Date.now());
    var corr=corrOf(cv),corrColor=groupColor(corr);

    var li=document.createElement('li');
    li.className='hover:bg-surface-muted transition-colors';
    li.style.borderLeft='3px solid '+corrColor;
    li.innerHTML=
      '<details class="group">'+
        '<summary class="px-4 py-2 cursor-pointer list-none flex items-center gap-3">'+
          '<span class="text-ink-placeholder tabular-nums shrink-0 font-mono">'+esc(time)+'</span>'+
          methodBadge(req.method||(pv.request&&pv.request.method)||'')+
          statusBadge(res.status==null?'—':String(res.status))+
          '<span class="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">'+
            chip(client,'bg-bc-blue text-white')+
            arrow('→')+
            chip(cRG,'bg-support-info-bg text-support-info-border border border-support-info-border')+
            arrow('⇒')+
            chip(pRG,'bg-support-warning-bg text-ink border border-support-warning-border')+
            arrow('→')+
            chip(service,'bg-bc-gold text-bc-blue-pressed')+
          '</span>'+
          '<span class="text-ink-secondary tabular-nums shrink-0 hidden sm:inline">c '+esc(fmtLat(lat.request))+' · p '+esc(fmtLat(pLat))+'</span>'+
          '<span class="text-ink-placeholder group-open:rotate-90 transition-transform">›</span>'+
        '</summary>'+
        '<div class="px-4 pb-3 pt-1 space-y-2">'+
          legBlock('Consumer leg','bg-bc-blue',c)+
          legBlock('Provider leg','bg-bc-gold',p)+
        '</div>'+
      '</details>';
    return li;
  }

  function trim(){while(list.children.length>MAX)list.removeChild(list.lastChild);}

  // Buffer single legs until both consumer + provider arrive for a correlation id.
  var pending={},pendingOrder=[];
  function addPending(corr,role,rec){
    if(!pending[corr]){pending[corr]={};pendingOrder.push(corr);}
    pending[corr][role]=rec;
    while(pendingOrder.length>500){var k=pendingOrder.shift();delete pending[k];}
  }
  function emit(flow){
    var node=render(flow);
    if(empty.style.display!=='none')empty.style.display='none';
    list.insertBefore(node,list.firstChild);
    trim();
    count++;countEl.textContent=String(count);
  }

  pauseBtn.addEventListener('click',function(){
    paused=!paused;
    pauseBtn.textContent=paused?'Resume':'Pause';
    pauseBtn.className=paused
      ?'px-3 py-1 bg-bc-gold text-bc-blue-pressed rounded font-medium hover:opacity-90'
      :'px-3 py-1 bg-btn-primary text-white rounded font-medium hover:bg-btn-primary-hover';
  });
  clearBtn.addEventListener('click',function(){
    list.innerHTML='';count=0;countEl.textContent='0';empty.style.display='';pending={};pendingOrder=[];
  });

  setStatus('connecting…','bg-ink-disabled animate-pulse');
  var es=new EventSource(URL);
  es.onopen=function(){setStatus('connected','bg-support-success-border');};
  es.onerror=function(){setStatus('reconnecting…','bg-support-warning-border animate-pulse');};
  es.onmessage=function(ev){
    if(paused)return;
    var data;try{data=JSON.parse(ev.data);}catch(_){return;}
    var v=(data&&data.value)||{};
    var role=roleOf(v);
    if(role!=='c'&&role!=='p')return;
    var corr=corrOf(v);
    if(!corr)return;
    addPending(corr,role,{v:v,evt:data});
    var pair=pending[corr];
    if(pair.c&&pair.p){
      var flow={c:pair.c,p:pair.p};
      delete pending[corr];
      var idx=pendingOrder.indexOf(corr);if(idx>=0)pendingOrder.splice(idx,1);
      emit(flow);
    }
  };
})();`,
        }}
      />
    </Layout>
  );
}
