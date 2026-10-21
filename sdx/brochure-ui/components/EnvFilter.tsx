import { DEFAULT_ENV, ENVIRONMENTS } from "../lib/environments.ts";

// Client-side environment filter. Renders the Dev / Test / Prod pill switch and
// drives a purely client-side filter over any element tagged with
// `data-env-item` + `data-env="<env>"`:
//   - an item whose `data-env` matches the active environment is shown;
//   - an item with an empty `data-env` is environment-agnostic (always shown);
//   - selection persists in localStorage and is shared across console pages.
//
// `data-env` may list several environments separated by spaces (an item backed
// by services in more than one environment); it is matched token-wise, so the
// item shows whenever the active environment is one of its tokens.
//
// Filtering is done with CSS keyed on `html[data-active-env]` so it composes
// with other inline-style filters (e.g. the scopes search box): an item is
// visible only when every filter agrees.
//
// Optional grouping: wrap a section in `data-env-group` and the script keeps
// its `data-env-count` (with `data-env-noun`), `data-env-empty`, and
// `data-env-items` elements in sync with the visible count.
const ENV_FILTER_STYLE = ENVIRONMENTS.map(
  (e) =>
    `html[data-active-env="${e.id}"] [data-env-item][data-env]:not([data-env~="${e.id}"]):not([data-env=""]){display:none !important;}`,
).join("\n");

const ENV_FILTER_SCRIPT = `
(function(){
  var KEY='sdx.console.env';
  var DEFAULT=${JSON.stringify(DEFAULT_ENV)};
  var root=document.documentElement;
  function get(){try{return localStorage.getItem(KEY)||DEFAULT;}catch(_){return DEFAULT;}}
  function set(v){try{localStorage.setItem(KEY,v);}catch(_){}}
  function plural(n,noun){return n+' '+noun+(n===1?'':'s');}
  function apply(env){
    root.setAttribute('data-active-env',env);
    var opts=document.querySelectorAll('[data-env-opt]');
    for(var i=0;i<opts.length;i++){
      var b=opts[i],on=b.getAttribute('data-env-opt')===env;
      b.classList.toggle('bg-white',on);
      b.classList.toggle('text-gray-900',on);
      b.classList.toggle('shadow-sm',on);
      b.classList.toggle('text-gray-500',!on);
      b.classList.toggle('hover:text-gray-700',!on);
      b.setAttribute('aria-selected',on?'true':'false');
    }
    var groups=document.querySelectorAll('[data-env-group]');
    for(var g=0;g<groups.length;g++){
      var grp=groups[g],items=grp.querySelectorAll('[data-env-item]'),vis=0;
      for(var j=0;j<items.length;j++){
        var ie=items[j].getAttribute('data-env')||'';
        if(ie===''||(' '+ie+' ').indexOf(' '+env+' ')>=0)vis++;
      }
      var cEl=grp.querySelector('[data-env-count]');
      if(cEl){var noun=cEl.getAttribute('data-env-noun');cEl.textContent=noun?plural(vis,noun):String(vis);}
      var eEl=grp.querySelector('[data-env-empty]');
      if(eEl)eEl.style.display=vis===0?'':'none';
      var iEl=grp.querySelector('[data-env-items]');
      if(iEl)iEl.style.display=vis===0?'none':'';
    }
  }
  var opts=document.querySelectorAll('[data-env-opt]');
  for(var i=0;i<opts.length;i++){
    opts[i].addEventListener('click',function(){var v=this.getAttribute('data-env-opt');set(v);apply(v);});
  }
  apply(get());
})();
`;

export function EnvFilter({ label }: { label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
      <div
        role="tablist"
        aria-label="Environment"
        className="inline-flex items-center gap-1 rounded-xl bg-gray-100 p-1"
      >
        {ENVIRONMENTS.map((e) => {
          const on = e.id === DEFAULT_ENV;
          return (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={on ? "true" : "false"}
              data-env-opt={e.id}
              className={[
                "env-opt px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                on
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              ].join(" ")}
            >
              {e.label}
            </button>
          );
        })}
      </div>
      <style dangerouslySetInnerHTML={{ __html: ENV_FILTER_STYLE }} />
      <script dangerouslySetInnerHTML={{ __html: ENV_FILTER_SCRIPT }} />
    </div>
  );
}
