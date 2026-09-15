interface LogStreamProps {
  streamUrl: string;
  maxEntries?: number;
}

export function LogStream({ streamUrl, maxEntries = 50 }: LogStreamProps) {
  const safeUrl = JSON.stringify(streamUrl);
  const safeMax = JSON.stringify(maxEntries);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header / controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center gap-2 text-sm shrink-0">
            <span
              id="ls-dot"
              className="inline-block w-2.5 h-2.5 rounded-full bg-gray-300 animate-pulse"
            />
            <span id="ls-status" className="font-medium text-gray-700">
              connecting…
            </span>
          </span>
          <span
            className="text-xs text-gray-400 font-mono truncate"
            title={streamUrl}
          >
            {streamUrl}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="text-gray-500">
            events{" "}
            <span
              id="ls-count"
              className="font-semibold text-gray-800 tabular-nums"
            >
              0
            </span>
          </span>
          <button
            id="ls-pause"
            type="button"
            className="px-3 py-1 bg-[#003366] text-white rounded font-medium hover:bg-[#002a52]"
          >
            Pause
          </button>
          <button
            id="ls-clear"
            type="button"
            className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded font-medium hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Empty state */}
      <div
        id="ls-empty"
        className="px-4 py-12 text-center text-sm text-gray-400"
      >
        Waiting for log events…
      </div>

      {/* Log list */}
      <ul id="ls-list" className="divide-y divide-gray-100 font-mono text-xs" />

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
  var URL=${safeUrl},MAX=${safeMax};
  var list=document.getElementById('ls-list');
  var empty=document.getElementById('ls-empty');
  var statusEl=document.getElementById('ls-status');
  var dot=document.getElementById('ls-dot');
  var countEl=document.getElementById('ls-count');
  var pauseBtn=document.getElementById('ls-pause');
  var clearBtn=document.getElementById('ls-clear');
  var paused=false,count=0;

  function setStatus(s,cls){statusEl.textContent=s;dot.className='inline-block w-2.5 h-2.5 rounded-full '+cls;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  // Pretty-print a value as syntax-highlighted, indented JSON HTML (keys /
  // strings / numbers / booleans / null each get their own colour). Walks the
  // value rather than regex-matching a string, so there are no escaping
  // surprises; the rendered text is itself valid, copyable JSON.
  function highlightJson(v,ind){
    ind=ind||0;
    var pad=new Array(ind+1).join('  '),pad2=new Array(ind+2).join('  ');
    if(v===null)return '<span class="text-gray-400">null</span>';
    var t=typeof v;
    if(t==='number')return '<span class="text-emerald-700">'+esc(String(v))+'</span>';
    if(t==='boolean')return '<span class="text-purple-700">'+v+'</span>';
    if(t==='string')return '<span class="text-amber-700">'+esc(JSON.stringify(v))+'</span>';
    if(Array.isArray(v)){
      if(v.length===0)return '[]';
      var a='[\\n';
      for(var i=0;i<v.length;i++){a+=pad2+highlightJson(v[i],ind+1)+(i<v.length-1?',':'')+'\\n';}
      return a+pad+']';
    }
    if(t==='object'){
      var keys=Object.keys(v);
      if(keys.length===0)return '{}';
      var o='{\\n';
      for(var j=0;j<keys.length;j++){
        var k=keys[j];
        o+=pad2+'<span class="text-[#003366] font-semibold">'+esc(JSON.stringify(k))+'</span>: '+highlightJson(v[k],ind+1)+(j<keys.length-1?',':'')+'\\n';
      }
      return o+pad+'}';
    }
    return esc(String(v));
  }

  function statusBadge(code){
    var n=parseInt(code,10),cls='bg-gray-100 text-gray-700';
    if(n>=200&&n<300)cls='bg-green-100 text-green-800';
    else if(n>=300&&n<400)cls='bg-blue-100 text-blue-800';
    else if(n>=400&&n<500)cls='bg-red-100 text-red-800';
    else if(n>=500)cls='bg-orange-100 text-orange-800';
    return '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-semibold '+cls+'">'+esc(code)+'</span>';
  }
  function methodBadge(m){
    var cls='bg-gray-100 text-gray-700';
    if(m==='GET')cls='bg-blue-50 text-blue-700';
    else if(m==='POST')cls='bg-green-50 text-green-700';
    else if(m==='PUT'||m==='PATCH')cls='bg-yellow-50 text-yellow-700';
    else if(m==='DELETE')cls='bg-red-50 text-red-700';
    return '<span class="inline-block px-1.5 py-0.5 rounded text-xs font-semibold '+cls+'">'+esc(m||'?')+'</span>';
  }
  function fmtTime(ms){
    var d=new Date(ms);
    return d.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
  }
  function fmtLat(n){return n==null||n<0?'—':n+'ms';}
  function fmtBytes(n){if(n==null)return '—';if(n<1024)return n+' B';if(n<1048576)return (n/1024).toFixed(1)+' KB';return (n/1048576).toFixed(1)+' MB';}

  function findHdr(h,name){
    if(!h)return '';
    var t=name.toLowerCase();
    for(var k in h){if(Object.prototype.hasOwnProperty.call(h,k)&&k.toLowerCase()===t){var x=h[k];return Array.isArray(x)?(x[0]||''):(x||'');}}
    return '';
  }

  // Deterministic color per correlation-id so related rows share a stripe.
  var GROUP_PALETTE=['#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16'];
  function groupColor(id){
    if(!id)return '';
    var h=0;for(var i=0;i<id.length;i++){h=(h*31+id.charCodeAt(i))>>>0;}
    return GROUP_PALETTE[h%GROUP_PALETTE.length];
  }

  function pluginChip(p){
    if(!p||typeof p!=='object')return '';
    var ok=p.continued===true;
    var cls=ok
      ?'bg-emerald-50 border-emerald-200 text-emerald-800'
      :'bg-red-50 border-red-200 text-red-800';
    var icon=ok?'✓':'✗';
    return '<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-xs '+cls+'">'+
      '<span class="font-bold">'+icon+'</span>'+
      '<span class="font-semibold font-mono">'+esc(p.plugin||'?')+'</span>'+
      '<span class="opacity-80">'+esc(p.reason||'')+'</span>'+
    '</span>';
  }
  function pluginRow(arr){
    if(!Array.isArray(arr)||arr.length===0)return '';
    var chips='';
    for(var i=0;i<arr.length;i++){chips+=pluginChip(arr[i]);}
    return '<div class="col-span-2 lg:col-span-4 flex items-start gap-2 mt-1">'+
      '<span class="text-gray-400 shrink-0 pt-0.5">controls</span>'+
      '<span class="flex flex-wrap gap-1.5">'+chips+'</span>'+
    '</div>';
  }

  function render(evt){
    var v=(evt&&evt.value)||{};
    var req=v.request||{},res=v.response||{},lat=v.latencies||{},route=v.route||{},svc=v.service||{};
    var cid=findHdr(req.headers,'X-Client-Id')||findHdr(req.headers,'X-Client-ID')||findHdr(route.headers,'X-Client-Id')||findHdr(route.headers,'X-Client-ID');
    var corr=findHdr(req.headers,'correlation-id')||findHdr(route.headers,'correlation-id');
    var corrColor=groupColor(corr);
    var time=fmtTime(v.started_at||Date.now());
    // Server-rendered verification badge HTML; injected as-is into the detail.
    var verifHtml=evt&&typeof evt.verificationHtml==='string'?evt.verificationHtml:'';

    var li=document.createElement('li');
    li.className='hover:bg-gray-50/60 transition-colors';
    if(corr){
      li.setAttribute('data-corr',corr);
      li.setAttribute('data-corr-color',corrColor);
    }
    li.style.borderLeft='3px solid transparent';
    li.innerHTML=
      '<details class="group">'+
        '<summary class="px-4 py-2 cursor-pointer list-none flex items-center gap-3">'+
          '<span class="ls-child-arrow shrink-0 w-4 text-center font-bold" style="color:transparent"></span>'+
          '<span class="text-gray-400 tabular-nums shrink-0">'+esc(time)+'</span>'+
          methodBadge(req.method||'')+
          statusBadge(res.status==null?'—':String(res.status))+
          '<span class="text-gray-800 truncate flex-1 min-w-0" title="'+esc(req.uri||'')+'">'+esc(req.uri||'')+'</span>'+
          '<span class="text-gray-500 hidden md:inline truncate max-w-[260px]" title="'+esc(svc.name||'')+'">'+esc(svc.name||'')+'</span>'+
          (cid?'<span class="text-[#003366] font-semibold hidden lg:inline truncate max-w-[200px]" title="'+esc(cid)+'">'+esc(cid)+'</span>':'')+
          '<span class="text-gray-600 tabular-nums shrink-0 w-14 text-right">'+esc(fmtLat(lat.request))+'</span>'+
          '<span class="text-gray-300 group-open:rotate-90 transition-transform">›</span>'+
        '</summary>'+
        '<div class="px-4 pb-3 pt-1 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-600">'+
          '<div><span class="text-gray-400">client ip</span> '+esc(v.client_ip||'—')+'</div>'+
          '<div><span class="text-gray-400">size</span> '+esc(fmtBytes(res.size))+'</div>'+
          '<div><span class="text-gray-400">kong lat</span> '+esc(fmtLat(lat.kong))+'</div>'+
          '<div><span class="text-gray-400">proxy lat</span> '+esc(fmtLat(lat.proxy))+'</div>'+
          '<div class="col-span-2"><span class="text-gray-400">route</span> '+esc(route.name||'—')+'</div>'+
          '<div class="col-span-2"><span class="text-gray-400">gateway id</span> '+esc(v.namespace||'—')+' · <span class="text-gray-400">dc</span> '+esc(v.datacenter||'—')+(v.app_version?' · <span class="text-gray-400">app</span> <span class="font-mono">'+esc(v.app_version)+'</span>':'')+'</div>'+
          '<div class="col-span-2 lg:col-span-4 truncate" title="'+esc(req.id||'')+'"><span class="text-gray-400">request id</span> '+esc(req.id||'—')+'</div>'+
          '<div class="col-span-2 lg:col-span-4 truncate" title="'+esc(corr||'')+'"><span class="text-gray-400">correlation id</span> '+(corr?'<span style="color:'+corrColor+';font-weight:600">'+esc(corr)+'</span>':'—')+'</div>'+
          pluginRow(v.plugin_results)+
          verifHtml+
        '</div>'+
        '<div class="ls-record relative mx-4 mb-3 hidden group-open:block">'+
          '<button type="button" class="ls-copy absolute top-2 right-2 z-10 px-2 py-1 bg-white/90 border border-gray-300 text-gray-600 rounded text-xs font-medium hover:bg-gray-100">Copy</button>'+
          '<pre class="p-2 pr-16 bg-gray-50 border border-gray-200 rounded overflow-auto text-xs leading-snug max-h-[19.5rem]">'+highlightJson(evt,0)+'</pre>'+
        '</div>'+
      '</details>';
    return li;
  }

  function trim(){while(list.children.length>MAX)list.removeChild(list.lastChild);}

  pauseBtn.addEventListener('click',function(){
    paused=!paused;
    pauseBtn.textContent=paused?'Resume':'Pause';
    pauseBtn.className=paused
      ?'px-3 py-1 bg-[#FCBA19] text-[#003366] rounded font-medium hover:opacity-90'
      :'px-3 py-1 bg-[#003366] text-white rounded font-medium hover:bg-[#002a52]';
  });
  clearBtn.addEventListener('click',function(){
    list.innerHTML='';count=0;countEl.textContent='0';empty.style.display='';
  });

  // Copy the log record's JSON to the clipboard. Delegated so it works for rows
  // added later; the <pre>'s textContent is the (valid) JSON we rendered.
  list.addEventListener('click',function(e){
    var btn=e.target.closest&&e.target.closest('.ls-copy');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();
    var rec=btn.closest('.ls-record'),pre=rec&&rec.querySelector('pre');
    var text=pre?pre.textContent:'';
    function done(){var t=btn.textContent;btn.textContent='Copied!';setTimeout(function(){btn.textContent=t;},1200);}
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(done,function(){});
    }else{
      var ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();try{document.execCommand('copy');done();}catch(_){}
      document.body.removeChild(ta);
    }
  });

  setStatus('connecting…','bg-gray-300 animate-pulse');
  var es=new EventSource(URL);
  es.onopen=function(){setStatus('connected','bg-green-500');};
  es.onerror=function(){setStatus('reconnecting…','bg-orange-400 animate-pulse');};
  function findRelated(corr){
    var out=[],items=list.children;
    for(var i=0;i<items.length;i++){
      if(items[i].getAttribute('data-corr')===corr)out.push(items[i]);
    }
    return out;
  }
  function paintGroup(el){
    var color=el.getAttribute('data-corr-color')||'';
    if(!color)return;
    el.style.background=color+'10';
    el.style.borderLeft='3px solid '+color;
    var a=el.querySelector('.ls-child-arrow');
    if(a)a.style.color=color;
  }
  function markChild(el){
    el.setAttribute('data-corr-child','1');
    var a=el.querySelector('.ls-child-arrow');
    if(a)a.textContent='↳';
  }
  function markAnchor(el){
    el.removeAttribute('data-corr-child');
    var a=el.querySelector('.ls-child-arrow');
    if(a)a.textContent='';
  }

  es.onmessage=function(ev){
    if(paused)return;
    var data;try{data=JSON.parse(ev.data);}catch(_){return;}
    var node=render(data);
    if(empty.style.display!=='none')empty.style.display='none';
    var corr=node.getAttribute('data-corr');
    if(corr){
      var related=findRelated(corr);
      list.insertBefore(node,list.firstChild);
      if(related.length>0){
        paintGroup(node);
        markAnchor(node);
      }
      var anchor=node;
      for(var i=0;i<related.length;i++){
        var r=related[i];
        paintGroup(r);
        markChild(r);
        if(anchor.nextSibling)list.insertBefore(r,anchor.nextSibling);
        else list.appendChild(r);
        anchor=r;
      }
    } else {
      list.insertBefore(node,list.firstChild);
    }
    trim();
    count++;countEl.textContent=String(count);
  };
})();`,
        }}
      />
    </div>
  );
}
