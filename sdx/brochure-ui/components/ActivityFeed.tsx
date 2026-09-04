import type { ActivityRecord } from "../types.ts";

interface ActivityFeedProps {
  activity: ActivityRecord[];
  pageSize: number;
  /** Endpoint the "Load more" button pages against. May include a query string. */
  apiPath?: string;
}

const DIALOG_STYLE = `
dialog.sdx-activity-dialog { border: none; border-radius: 8px; padding: 0; max-width: 720px; width: 92%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); }
dialog.sdx-activity-dialog::backdrop { background: rgba(0,0,0,0.45); }
`;

// Rendered client-side so dates/times reflect the viewer's local timezone (the
// API returns UTC), paging appends via the configured API path, and blob
// details open in a dialog.
const FEED_SCRIPT = `
(function(){
  var DATA = window.__ACTIVITY__ || [];
  var PAGE = window.__ACTIVITY_PAGE_SIZE__ || 20;
  var API = window.__ACTIVITY_API__ || '/api/activity';
  var listEl = document.getElementById('activity-list');
  var moreWrap = document.getElementById('activity-more-wrap');
  var moreBtn = document.getElementById('activity-more');
  var emptyEl = document.getElementById('activity-empty');
  var errEl = document.getElementById('activity-error');
  var dlg = document.getElementById('activity-detail');
  var dlgBlobWrap = document.getElementById('activity-detail-blob-wrap');
  var dlgBlob = document.getElementById('activity-detail-blob');
  var dlgParams = document.getElementById('activity-detail-params');
  var dlgTitle = document.getElementById('activity-detail-title');
  var skip = 0, lastKey = null, currentUl = null;

  var WARN_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" fill="currentColor"></path><line x1="12" y1="9" x2="12" y2="13.5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"></line><line x1="12" y1="17" x2="12.01" y2="17" stroke="#fff" stroke-width="2.2" stroke-linecap="round"></line></svg>';
  function isErrorResult(result){
    var r = String(result || '').toLowerCase();
    return r === 'failure' || r === 'failed' || r === 'error';
  }

  function resolveMessage(msg, params){
    return String(msg).replace(/\\{(\\w+)\\}/g, function(_, k){
      return params[k] !== undefined ? params[k] : '{' + k + '}';
    });
  }
  function initials(actor){
    var t = (actor || '').trim();
    if(!t) return '?';
    if(t.indexOf(',') >= 0){
      var parts = t.split(',');
      var last = parts[0].trim();
      var first = (parts[1] || '').trim().split(/\\s+/)[0] || '';
      return ((last[0] || '') + (first[0] || '')).toUpperCase();
    }
    var w = t.split(/\\s+/);
    if(w.length >= 2) return (w[0][0] + w[1][0]).toUpperCase();
    return t.slice(0,2).toUpperCase();
  }
  function dateKey(d){ return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate(); }
  function dateHeader(d){ return d.toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'}); }
  function timeLabel(d){
    var s = d.toLocaleTimeString(undefined, {hour:'numeric', minute:'2-digit'});
    return s.replace(/\\bAM\\b/, 'a.m.').replace(/\\bPM\\b/, 'p.m.');
  }
  function detailParams(params){
    var skipKeys = {actor:1, action:1, accessAction:1, entity:1};
    var out = [];
    for(var k in params){
      if(params.hasOwnProperty(k) && !skipKeys[k] && params[k] !== '' && params[k] != null) out.push([k, params[k]]);
    }
    return out;
  }
  function toYaml(blob){
    var obj = blob;
    if(typeof blob === 'string'){
      // The detail blob is JSON; parse it so it can be re-emitted as YAML.
      try { obj = JSON.parse(blob); }
      catch(_) { return blob; } // not JSON — show the raw string unchanged
    }
    try {
      if(window.jsyaml && window.jsyaml.dump){
        return window.jsyaml.dump(obj, {noRefs:true, lineWidth:100, sortKeys:false});
      }
    } catch(_) {}
    return JSON.stringify(obj, null, 2);
  }
  function openDialog(record){
    var params = record.params || {};
    dlgTitle.textContent = resolveMessage(record.message, params);
    if(record.blob !== undefined && record.blob !== null){
      // Reset so highlight.js (which marks elements as already-highlighted) re-runs.
      dlgBlob.removeAttribute('data-highlighted');
      dlgBlob.className = 'language-yaml whitespace-pre-wrap break-all';
      dlgBlob.textContent = toYaml(record.blob);
      try { if(window.hljs) window.hljs.highlightElement(dlgBlob); } catch(_) {}
      dlgBlobWrap.style.display = '';
    } else {
      dlgBlob.textContent = '';
      dlgBlobWrap.style.display = 'none';
    }
    dlgParams.innerHTML = '';
    var dps = detailParams(params);
    if(dps.length){
      for(var i=0;i<dps.length;i++){
        var dt = document.createElement('dt'); dt.className = 'text-gray-500 break-all'; dt.textContent = dps[i][0];
        var dd = document.createElement('dd'); dd.className = 'text-gray-800 break-all font-mono'; dd.textContent = dps[i][1];
        dlgParams.appendChild(dt); dlgParams.appendChild(dd);
      }
      dlgParams.style.display = '';
    } else { dlgParams.style.display = 'none'; }
    if(typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open','');
  }
  function renderItem(record){
    var params = record.params || {};
    var li = document.createElement('li'); li.className = 'flex items-start gap-3 py-4';
    var isError = isErrorResult(record.result);
    var av = document.createElement('span');
    av.className = 'shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[#b8732a] text-white text-xs font-semibold';
    av.title = params.actor || ''; av.textContent = initials(params.actor || '?');
    li.appendChild(av);
    var body = document.createElement('div'); body.className = 'min-w-0 flex-1';
    var top = document.createElement('div'); top.className = 'flex flex-wrap items-baseline gap-x-3 gap-y-1';
    var p = document.createElement('p'); p.className = 'text-sm text-gray-800';
    // Show a red warning icon inline before the message when the activity failed.
    if(isError){
      var warn = document.createElement('span');
      warn.className = 'shrink-0 text-red-600 mr-1.5 inline-flex align-text-bottom';
      warn.setAttribute('role', 'img');
      warn.setAttribute('aria-label', 'Failure');
      warn.title = 'This activity failed';
      warn.innerHTML = WARN_ICON;
      p.appendChild(warn);
    }
    var text = resolveMessage(record.message, params);
    var verb = params.accessAction || params.action;
    var idx = verb ? text.indexOf(verb) : -1;
    if(idx >= 0){
      p.appendChild(document.createTextNode(text.slice(0, idx)));
      var st = document.createElement('strong'); st.className = 'font-semibold'; st.textContent = verb; p.appendChild(st);
      p.appendChild(document.createTextNode(text.slice(idx + verb.length)));
    } else { p.appendChild(document.createTextNode(text)); }
    top.appendChild(p);
    var hasBlob = record.blob !== undefined && record.blob !== null;
    if(hasBlob || detailParams(params).length){
      var btn = document.createElement('button'); btn.type = 'button';
      btn.className = 'text-xs text-[#003366] font-semibold hover:underline';
      btn.textContent = 'More details';
      (function(rec){ btn.addEventListener('click', function(){ openDialog(rec); }); })(record);
      top.appendChild(btn);
    }
    body.appendChild(top);
    var tm = document.createElement('p'); tm.className = 'text-sm text-gray-500 mt-0.5 tabular-nums';
    tm.textContent = timeLabel(new Date(record.activityAt));
    body.appendChild(tm);
    li.appendChild(body);
    return li;
  }
  function append(records){
    for(var i=0;i<records.length;i++){
      var r = records[i];
      var d = new Date(r.activityAt);
      var key = dateKey(d);
      if(key !== lastKey){
        var sec = document.createElement('section');
        var h = document.createElement('h2'); h.className = 'text-base font-bold text-gray-900 mb-1'; h.textContent = dateHeader(d);
        var ul = document.createElement('ul'); ul.className = 'divide-y divide-gray-100';
        sec.appendChild(h); sec.appendChild(ul);
        listEl.appendChild(sec);
        currentUl = ul; lastKey = key;
      }
      currentUl.appendChild(renderItem(r));
    }
  }
  function setMore(count){ moreWrap.style.display = (count >= PAGE) ? '' : 'none'; }

  if(!DATA.length){ emptyEl.style.display = ''; moreWrap.style.display = 'none'; }
  else { append(DATA); skip = DATA.length; setMore(DATA.length); }

  if(moreBtn){
    moreBtn.addEventListener('click', function(){
      moreBtn.disabled = true; moreBtn.textContent = 'Loading…';
      var sep = API.indexOf('?') >= 0 ? '&' : '?';
      fetch(API + sep + 'first=' + PAGE + '&skip=' + skip, {headers:{'accept':'application/json'}})
        .then(function(res){ if(!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
        .then(function(recs){
          recs = Array.isArray(recs) ? recs : [];
          append(recs); skip += recs.length; setMore(recs.length);
          moreBtn.disabled = false; moreBtn.textContent = 'Load more';
        })
        .catch(function(e){
          errEl.textContent = 'Could not load more activity: ' + e.message; errEl.style.display = '';
          moreBtn.disabled = false; moreBtn.textContent = 'Load more';
        });
    });
  }
  document.addEventListener('click', function(e){
    var c = e.target.closest && e.target.closest('[data-close-activity]');
    if(c){ e.preventDefault(); if(typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open'); }
  });
})();
`;

/**
 * Client-rendered activity feed: a day-grouped list with a "Load more" button
 * and a details dialog. Shared by the public catalogue Activity page and the
 * Member Console org-scoped Activity page; `apiPath` selects the paging
 * endpoint.
 */
export function ActivityFeed({
  activity,
  pageSize,
  apiPath = "/api/activity",
}: ActivityFeedProps) {
  const dataJson = JSON.stringify(activity).replace(
    /</g,
    "\\u003c",
  );
  const apiJson = JSON.stringify(apiPath).replace(
    /</g,
    "\\u003c",
  );

  return (
    <>
      {/* Vendored, self-hosted libraries (no third-party runtime dependency):
          js-yaml renders the JSON detail blob as YAML, highlight.js styles it. */}
      <link
        rel="stylesheet"
        href="/public/vendor/highlight-github.min.css"
      />
      <script src="/public/vendor/js-yaml.min.js" />
      <script src="/public/vendor/highlight.min.js" />

      <style
        dangerouslySetInnerHTML={{ __html: DIALOG_STYLE }}
      />

      <div
        id="activity-error"
        style={{ display: "none" }}
        className="mb-4 rounded border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm"
      />

      <div
        id="activity-empty"
        style={{ display: "none" }}
        className="text-center py-16 bg-gray-50 rounded-lg border border-gray-200 text-gray-600"
      >
        No recent activity to show.
      </div>

      <noscript>
        <div className="rounded border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          JavaScript is required to view the activity feed.
        </div>
      </noscript>

      <div id="activity-list" className="space-y-8" />

      <div
        id="activity-more-wrap"
        className="text-center mt-8"
        style={{ display: "none" }}
      >
        <button
          type="button"
          id="activity-more"
          className="text-sm font-semibold px-5 py-2 rounded border border-gray-300 text-[#003366] hover:bg-gray-50"
        >
          Load more
        </button>
      </div>

      {/* Details dialog */}
      <dialog
        id="activity-detail"
        className="sdx-activity-dialog"
      >
        <div className="px-5 py-4 border-b border-gray-200">
          <h2
            id="activity-detail-title"
            className="text-base font-bold text-[#003366]"
          />
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-auto">
          <div
            id="activity-detail-blob-wrap"
            style={{ display: "none" }}
          >
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Details
            </h3>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-3 overflow-auto">
              <code
                id="activity-detail-blob"
                className="language-yaml whitespace-pre-wrap break-all"
              />
            </pre>
          </div>
          <dl
            id="activity-detail-params"
            className="grid grid-cols-[140px,1fr] gap-x-3 gap-y-1 text-xs"
            style={{ display: "none" }}
          />
        </div>
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="button"
            data-close-activity
            className="text-sm font-semibold px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-white"
          >
            Close
          </button>
        </div>
      </dialog>

      <script
        dangerouslySetInnerHTML={{
          __html:
            `window.__ACTIVITY__=${dataJson};` +
            `window.__ACTIVITY_PAGE_SIZE__=${pageSize};` +
            `window.__ACTIVITY_API__=${apiJson};`,
        }}
      />
      <script
        dangerouslySetInnerHTML={{ __html: FEED_SCRIPT }}
      />
    </>
  );
}
