export interface MetricSeries {
  metric: Record<string, string>;
  values: [number, string][];
}

interface TimeSeriesChartProps {
  id: string;
  title: string;
  series: MetricSeries[];
  codeField: string;
}

export function TimeSeriesChart({
  id,
  title,
  series,
  codeField,
}: TimeSeriesChartProps) {
  const safeSeries = JSON.stringify(series).replace(/<\//g, "<\\/");
  const codeLabel = codeField.charAt(0).toUpperCase() + codeField.slice(1);

  return (
    <div className="flex flex-col gap-4">
      {/* Chart card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-base font-bold text-[#003366]">{title}</h2>
          <span id={`${id}-range`} className="text-xs text-gray-400 font-mono">
            —
          </span>
        </div>
        <div style={{ position: "relative", height: "300px" }}>
          <canvas id={id} />
        </div>
      </div>

      {/* Breakdown table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Service
              </th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {codeLabel}
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Reqs
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Peak
              </th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Avg
              </th>
            </tr>
          </thead>
          <tbody id={`${id}-tbody`} className="divide-y divide-gray-100" />
        </table>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){
  var ID=${JSON.stringify(id)},CODE=${JSON.stringify(codeField)};
  var COLORS=['#003366','#E05B00','#1a6e3c','#6B21A8','#0369A1','#9F1239','#0F766E','#92400E'];
  var CODE_STYLES={'2':'bg-green-100 text-green-800','3':'bg-blue-100 text-blue-800','4':'bg-red-100 text-red-800','5':'bg-orange-100 text-orange-800'};

  function fmtTime(ts){var d=new Date(ts*1000);return d.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});}
  function fmtDateTime(ts){var d=new Date(ts*1000);return d.toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function buildData(series){
    var allTs=Array.from(new Set(series.flatMap(function(s){return s.values.map(function(v){return Number(v[0]);});}))).sort(function(a,b){return a-b;});
    var labels=allTs.map(fmtTime);
    var datasets=series.map(function(s,i){
      var tsMap=new Map(s.values.map(function(v){return [Number(v[0]),parseFloat(v[1])];}));
      return {
        label:s.metric.service+' · '+(s.metric[CODE]||''),
        data:allTs.map(function(ts){return tsMap.has(ts)?tsMap.get(ts):null;}),
        borderColor:COLORS[i%COLORS.length],
        borderWidth:2,pointRadius:3,pointHoverRadius:6,tension:0.3,spanGaps:true,fill:false
      };
    });
    return {labels:labels,datasets:datasets,allTs:allTs};
  }

  function buildRows(series){
    return series.map(function(s,i){
      var vals=s.values.map(function(v){return parseFloat(v[1]);});
      var peak=vals.length?Math.max.apply(null,vals):0;
      var avg=vals.length?vals.reduce(function(a,b){return a+b;},0)/vals.length:0;
      var codeVal=s.metric[CODE]||'';
      var codeClass=CODE_STYLES[codeVal[0]]||'bg-gray-100 text-gray-700';
      return ''+
        '<tr class="hover:bg-gray-50">'+
          '<td class="px-4 py-2 font-mono text-xs text-gray-800">'+
            '<div class="flex items-center gap-2">'+
              '<span class="inline-block w-2 h-2 rounded-full shrink-0" style="background:'+COLORS[i%COLORS.length]+'"></span>'+
              esc(s.metric.service)+
            '</div>'+
          '</td>'+
          '<td class="px-3 py-2"><span class="text-xs font-semibold px-2 py-0.5 rounded-full '+codeClass+'">'+esc(codeVal)+'</span></td>'+
          '<td class="px-4 py-2 text-right text-gray-600">'+s.values.length+'</td>'+
          '<td class="px-4 py-2 text-right font-mono text-gray-800">'+peak.toFixed(1)+'</td>'+
          '<td class="px-4 py-2 text-right font-mono text-gray-600">'+avg.toFixed(1)+'</td>'+
        '</tr>';
    }).join('');
  }

  function applyRange(allTs){
    var el=document.getElementById(ID+'-range');
    if(!el)return;
    el.textContent=allTs.length>0?fmtDateTime(allTs[0])+' – '+fmtDateTime(allTs[allTs.length-1]):'No data';
  }

  function applySeries(series){
    var built=buildData(series);
    chart.data.labels=built.labels;
    chart.data.datasets=built.datasets;
    chart.update();
    document.getElementById(ID+'-tbody').innerHTML=buildRows(series);
    applyRange(built.allTs);
  }

  var initial=${safeSeries};
  var built=buildData(initial);
  var chart=new Chart(document.getElementById(ID),{
    type:'line',data:{labels:built.labels,datasets:built.datasets},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      plugins:{
        legend:{position:'bottom',labels:{boxWidth:10,padding:12,font:{size:10}}},
        tooltip:{callbacks:{label:function(c){var v=c.parsed.y;return' '+c.dataset.label+': '+(v!=null?v.toFixed(1):'—');}}}
      },
      scales:{
        x:{ticks:{maxRotation:45,autoSkip:true,maxTicksLimit:10,font:{size:10}},grid:{color:'#f3f4f6'}},
        y:{beginAtZero:true,title:{display:true,text:'Requests / second',font:{size:10}},grid:{color:'#f3f4f6'}}
      }
    }
  });
  document.getElementById(ID+'-tbody').innerHTML=buildRows(initial);
  applyRange(built.allTs);

  window.__sdxCharts=window.__sdxCharts||{};
  window.__sdxCharts[ID]={
    refresh:function(url){
      return fetch(url).then(function(r){return r.json();}).then(function(payload){
        var series=(payload&&payload.data&&payload.data.result)||[];
        applySeries(series);
        return series;
      }).catch(function(){return null;});
    }
  };
})();`,
        }}
      />
    </div>
  );
}
