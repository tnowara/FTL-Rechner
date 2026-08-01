
const TABLE=[{start:360,end:809,vals:[780,750,720,690,660,630,600,570,540]},{start:810,end:839,vals:[765,735,705,675,645,615,585,555,540]},{start:840,end:869,vals:[750,720,690,660,630,600,570,540,540]},{start:870,end:899,vals:[735,705,675,645,615,585,555,540,540]},{start:900,end:929,vals:[720,690,660,630,600,570,540,540,540]},{start:930,end:959,vals:[705,675,645,615,585,555,540,540,540]},{start:960,end:989,vals:[690,660,630,600,570,540,540,540,540]},{start:990,end:1019,vals:[675,645,615,585,555,540,540,540,540]},{start:1020,end:1439,vals:[660,630,600,570,540,540,540,540,540]},{start:0,end:299,vals:[660,630,600,570,540,540,540,540,540]},{start:300,end:314,vals:[720,690,660,630,600,570,540,540,540]},{start:315,end:329,vals:[735,705,675,645,615,585,555,540,540]},{start:330,end:344,vals:[750,720,690,660,630,600,570,540,540]},{start:345,end:359,vals:[765,735,705,675,645,615,585,555,540]}];
const UNKNOWN=[660,630,600,570,540,540,540],UNKNOWN_FRM=[720,690,660,630,600,570,540];
const $=id=>document.getElementById(id),KEY='ftl-logbook-records-v3';
let currentResult=null,airports=new Map(),syncing=false;
let reportInputMode='local',onBlockInputMode='local';

const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
for(let i=1;i<=10;i++){const o=document.createElement('option');o.value=i;o.textContent=i===1?'1 Sektor':`${i} Sektoren`;$('sectors').appendChild(o)}
$('dutyDate').value=today();$('onBlockDate').value=today();$('monthFilter').value=today().slice(0,7);

function toMinutes(t){const [h,m]=t.split(':').map(Number);return h*60+m}
function formatDuration(v){if(!Number.isFinite(v))return '–';const s=v<0?'−':'';v=Math.abs(Math.round(v));return `${s}${Math.floor(v/60)}:${pad(v%60)} h`}
function formatDate(s){if(!s)return '–';const [y,m,d]=s.split('-');return `${d}.${m}.${y}`}
function datePartsUtc(ms){const d=new Date(ms);return {date:`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`,time:`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`}}
function formatUtc(ms){if(!Number.isFinite(ms))return '–';const p=datePartsUtc(ms);return `${formatDate(p.date)} ${p.time} UTC`}
function baseLimit(report,count,accl){const idx=count<=2?0:Math.min(8,count-2);if(accl==='unknown'||accl==='unknown_frm'){if(count>8)return null;const arr=accl==='unknown'?UNKNOWN:UNKNOWN_FRM;return arr[count<=2?0:count-2]}const row=TABLE.find(r=>report>=r.start&&report<=r.end);return row?row.vals[idx]:null}

function utcFieldsToMs(date,time){
  if(!date||!time)return NaN;
  const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
  return Date.UTC(y,m-1,d,hh,mm);
}
function zonedToUtc(date,time,tz){
  if(!date||!time||!tz)return NaN;
  const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
  const wanted=Date.UTC(y,m-1,d,hh,mm);
  let guess=wanted;
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let i=0;i<5;i++){
    const q={};
    fmt.formatToParts(new Date(guess)).forEach(x=>{if(x.type!=='literal')q[x.type]=+x.value});
    const shown=Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute);
    guess+=wanted-shown;
  }
  return guess;
}
function utcToZonedFields(ms,tz){
  const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  const q={};
  fmt.formatToParts(new Date(ms)).forEach(x=>{if(x.type!=='literal')q[x.type]=x.value});
  return {date:`${q.year}-${q.month}-${q.day}`,time:`${q.hour}:${q.minute}`};
}
function localClock(ms,tz){
  const p=utcToZonedFields(ms,tz);
  return `${formatDate(p.date)} ${p.time} lokal`;
}
function airportInfo(code,el){
  const a=airports.get(code);
  if(!code){el.textContent='ICAO-Kennung eingeben';el.className=''}
  else if(!a){el.textContent='Flughafen nicht in der Datenbank';el.className='field-error'}
  else{el.textContent=`${a.n}${a.c?' · '+a.c:''} · ${a.t}`;el.className='field-ok'}
  return a;
}
function setSyncBadge(which,mode){
  const el=$(which==='report'?'reportSyncBadge':'onBlockSyncBadge');
  el.textContent=mode==='utc'?'UTC → Ortszeit':'Ortszeit → UTC';
}
function syncReport(source){
  if(syncing)return;
  const dep=airports.get($('departureIcao').value.trim().toUpperCase());
  if(!dep)return;
  syncing=true;
  if(source==='utc'){
    reportInputMode='utc';
    const ms=utcFieldsToMs($('reportUtcDate').value,$('reportUtcTime').value);
    if(Number.isFinite(ms)){
      const p=utcToZonedFields(ms,dep.t);
      $('dutyDate').value=p.date;$('reportTime').value=p.time;
    }
  }else{
    reportInputMode='local';
    const ms=zonedToUtc($('dutyDate').value,$('reportTime').value,dep.t);
    if(Number.isFinite(ms)){
      const p=datePartsUtc(ms);
      $('reportUtcDate').value=p.date;$('reportUtcTime').value=p.time;
    }
  }
  setSyncBadge('report',reportInputMode);
  syncing=false;
}
function syncOnBlock(source){
  if(syncing)return;
  const arr=airports.get($('arrivalIcao').value.trim().toUpperCase());
  if(!arr)return;
  syncing=true;
  if(source==='utc'){
    onBlockInputMode='utc';
    const ms=utcFieldsToMs($('onBlockUtcDate').value,$('onBlockUtcTime').value);
    if(Number.isFinite(ms)){
      const p=utcToZonedFields(ms,arr.t);
      $('onBlockDate').value=p.date;$('onBlockTime').value=p.time;
    }
  }else{
    onBlockInputMode='local';
    const ms=zonedToUtc($('onBlockDate').value,$('onBlockTime').value,arr.t);
    if(Number.isFinite(ms)){
      const p=datePartsUtc(ms);
      $('onBlockUtcDate').value=p.date;$('onBlockUtcTime').value=p.time;
    }
  }
  setSyncBadge('onBlock',onBlockInputMode);
  syncing=false;
}
function calculate(){
  const depCode=$('departureIcao').value.trim().toUpperCase(),arrCode=$('arrivalIcao').value.trim().toUpperCase();
  $('departureIcao').value=depCode;$('arrivalIcao').value=arrCode;
  const dep=airportInfo(depCode,$('departureInfo')),arr=airportInfo(arrCode,$('arrivalInfo'));
  if(!dep||!arr){clearResult();showStatus('ICAO PRÜFEN','warn','Für die Berechnung müssen Start- und Zielflughafen erkannt werden.');return}

  syncReport(reportInputMode);
  syncOnBlock(onBlockInputMode);

  const reportUtc=utcFieldsToMs($('reportUtcDate').value,$('reportUtcTime').value);
  const onUtc=utcFieldsToMs($('onBlockUtcDate').value,$('onBlockUtcTime').value);
  if(!Number.isFinite(reportUtc)||!Number.isFinite(onUtc)){clearResult();return}

  const plannedFdp=Math.round((onUtc-reportUtc)/60000);
  const count=+$('sectors').value,accl=$('acclimatisation').value;
  let limit=baseLimit(toMinutes($('reportTime').value),count,accl);
  if(limit===null){showStatus('PRÜFEN','danger','Für diese Kombination enthält die Basistabelle keinen zulässigen Wert.');clearResult();return}
  const basic=limit;
  if($('plannedExtension').checked)limit+=+$('extensionMinutes').value;
  const margin=limit-plannedFdp,latestUtc=reportUtc+limit*60000;

  $('plannedFdpValue').textContent=formatDuration(plannedFdp);
  $('baseLimit').textContent=formatDuration(basic)+($('plannedExtension').checked?' + Verlängerung':'');
  $('latestEnd').textContent=`${formatUtc(latestUtc)} / ${localClock(latestUtc,arr.t)}`;
  $('reportUtc').textContent=`${formatDate($('dutyDate').value)} ${$('reportTime').value} lokal / ${formatUtc(reportUtc)}`;
  $('onBlockUtc').textContent=`${formatDate($('onBlockDate').value)} ${$('onBlockTime').value} lokal / ${formatUtc(onUtc)}`;
  $('plannedMargin').textContent=formatDuration(margin);

  let state='ok',title='RECHNERISCH INNERHALB',msg=`Geplante FDP ${formatDuration(plannedFdp)}; Reserve bis zum berechneten Limit ${formatDuration(margin)}.`;
  if(plannedFdp<0){state='danger';title='DATUM PRÜFEN';msg='ON-Block liegt vor dem Reporting. Bitte Datum und Uhrzeit prüfen.'}
  else if(margin<0){state='danger';title='NICHT DARSTELLBAR';msg=`Die geplante FDP überschreitet das berechnete Limit um ${formatDuration(-margin)}.`}
  else if(margin<30){state='warn';title='KRITISCH';msg=`Nur ${formatDuration(margin)} Reserve bis zum FDP-Limit.`}
  showStatus(title,state,msg);
  currentResult={depCode,arrCode,depName:dep.n,arrName:arr.n,depTz:dep.t,arrTz:arr.t,reportUtc,onUtc,plannedFdp,basic,limit,margin,latestUtc,status:title,statusClass:state};
}
function clearResult(){
  currentResult=null;
  ['plannedFdpValue','baseLimit','latestEnd','reportUtc','onBlockUtc','plannedMargin'].forEach(id=>$(id).textContent='–');
}
function showStatus(title,state,msg){$('statusPill').className=`status ${state}`;$('statusPill').textContent=title;$('message').textContent=msg}
function getRecords(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function setRecords(r){localStorage.setItem(KEY,JSON.stringify(r))}
function saveRecord(){
  calculate();
  if(!currentResult)return alert('Bitte erst gültige Flughafen- und Zeitangaben eingeben.');
  const rec={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:$('dutyDate').value,onBlockDate:$('onBlockDate').value,flightRef:$('flightRef').value.trim(),reportTime:$('reportTime').value,onBlockTime:$('onBlockTime').value,reportUtcDate:$('reportUtcDate').value,reportUtcTime:$('reportUtcTime').value,onBlockUtcDate:$('onBlockUtcDate').value,onBlockUtcTime:$('onBlockUtcTime').value,acclimatisation:$('acclimatisation').value,sectors:+$('sectors').value,positioning:$('positioning').checked,plannedExtension:$('plannedExtension').checked,extensionMinutes:+$('extensionMinutes').value,notes:$('notes').value.trim(),...currentResult,savedAt:new Date().toISOString()};
  const records=getRecords();records.push(rec);records.sort((a,b)=>a.reportUtc-b.reportUtc);setRecords(records);
  $('saveBtn').textContent='Gespeichert ✓';setTimeout(()=>$('saveBtn').textContent='Datensatz speichern',1400);renderArchive();
}
function resetForm(){
  $('dutyDate').value=today();$('onBlockDate').value=today();$('flightRef').value='';$('departureIcao').value='';$('arrivalIcao').value='';
  $('reportTime').value='15:00';$('onBlockTime').value='03:00';$('reportUtcDate').value='';$('reportUtcTime').value='';$('onBlockUtcDate').value='';$('onBlockUtcTime').value='';
  $('acclimatisation').value='acclimatised';$('sectors').value='1';$('positioning').checked=true;$('plannedExtension').checked=false;$('notes').value='';
  reportInputMode='local';onBlockInputMode='local';setSyncBadge('report','local');setSyncBadge('onBlock','local');calculate();
}
function deleteRecord(id){if(confirm('Diesen Datensatz wirklich löschen?')){setRecords(getRecords().filter(r=>r.id!==id));renderArchive()}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function renderArchive(){
  const month=$('monthFilter').value,rs=getRecords().filter(r=>r.date&&r.date.startsWith(month)),tb=$('recordsTable').querySelector('tbody');tb.innerHTML='';
  rs.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${formatDate(r.date)}</td><td><strong>${escapeHtml(r.depCode)}–${escapeHtml(r.arrCode)}</strong><br><small>${escapeHtml(r.flightRef||'')}</small></td><td>${r.reportTime}<br><small>${r.reportUtcTime||datePartsUtc(r.reportUtc).time} UTC</small></td><td>${formatDate(r.onBlockDate)} ${r.onBlockTime}<br><small>${r.onBlockUtcTime||datePartsUtc(r.onUtc).time} UTC</small></td><td>${formatDuration(r.plannedFdp)}</td><td>${formatDuration(r.limit)}</td><td>${formatDuration(r.margin)}</td><td><button class="icon-btn" data-id="${r.id}">Löschen</button></td>`;tb.appendChild(tr)});
  tb.querySelectorAll('button').forEach(b=>b.onclick=()=>deleteRecord(b.dataset.id));
  $('emptyState').classList.toggle('hidden',rs.length>0);$('recordsTable').classList.toggle('hidden',rs.length===0);
  $('monthCount').textContent=rs.length;$('monthFdp').textContent=formatDuration(rs.reduce((s,r)=>s+r.plannedFdp,0));
}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportCSV(){
  const month=$('monthFilter').value,rs=getRecords().filter(r=>r.date&&r.date.startsWith(month));if(!rs.length)return alert('Keine Datensätze in diesem Monat.');
  const rows=[['Datum','Flug','Start ICAO','Ziel ICAO','Start-Zeitzone','Ziel-Zeitzone','Report lokal','Report UTC','ON-Block lokal','ON-Block UTC','Sektoren','Geplante FDP Minuten','Limit Minuten','Reserve Minuten','Status','Notiz'],...rs.map(r=>[r.date,r.flightRef,r.depCode,r.arrCode,r.depTz,r.arrTz,`${r.date} ${r.reportTime}`,new Date(r.reportUtc).toISOString(),`${r.onBlockDate} ${r.onBlockTime}`,new Date(r.onUtc).toISOString(),r.sectors,r.plannedFdp,r.limit,r.margin,r.status,r.notes])];
  const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`FTL_${month}.csv`);
}
function pdfEscape(s){return String(s??'').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[\\()]/g,m=>'\\'+m).replace(/[\r\n]+/g,' ')}
function exportPDF(){
  const month=$('monthFilter').value,rs=getRecords().filter(r=>r.date&&r.date.startsWith(month));if(!rs.length)return alert('Keine Datensätze in diesem Monat.');
  const [y,m]=month.split('-');let lines=[`FTL Monatsübersicht ${m}/${y}`,'',`Datensätze: ${rs.length}   Geplante FDP gesamt: ${formatDuration(rs.reduce((s,r)=>s+r.plannedFdp,0))}`,''];
  for(const r of rs){lines.push(`${formatDate(r.date)}  ${r.depCode}-${r.arrCode}  ${r.flightRef||''}`);lines.push(`Report lokal ${r.reportTime} / ${formatUtc(r.reportUtc)}`);lines.push(`ON-Block lokal ${formatDate(r.onBlockDate)} ${r.onBlockTime} / ${formatUtc(r.onUtc)}`);lines.push(`FDP ${formatDuration(r.plannedFdp)}  Limit ${formatDuration(r.limit)}  Reserve ${formatDuration(r.margin)}  ${r.status}`);if(r.notes)lines.push(`Notiz: ${r.notes}`);lines.push('')}
  const pages=[];while(lines.length)pages.push(lines.splice(0,45));const objs=[];objs[1]='<< /Type /Catalog /Pages 2 0 R >>';const kids=[];let obj=3;
  pages.forEach((page,i)=>{const po=obj++,co=obj++;kids.push(`${po} 0 R`);objs[po]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3+pages.length*2} 0 R >> >> /Contents ${co} 0 R >>`;let yPos=805,c='BT\n/F1 10 Tf\n';page.forEach((line,j)=>{const size=j===0&&i===0?16:10;c+=`/F1 ${size} Tf\n1 0 0 1 40 ${yPos} Tm (${pdfEscape(line)}) Tj\n`;yPos-=j===0&&i===0?26:15});c+='ET';objs[co]=`<< /Length ${c.length} >>\nstream\n${c}\nendstream`});
  const fo=3+pages.length*2;objs[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;objs[fo]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  let pdf='%PDF-1.4\n',offs=[0];for(let i=1;i<=fo;i++){offs[i]=pdf.length;pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`}const xr=pdf.length;pdf+=`xref\n0 ${fo+1}\n0000000000 65535 f \n`;for(let i=1;i<=fo;i++)pdf+=`${String(offs[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${fo+1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;downloadBlob(new Blob([bytes],{type:'application/pdf'}),`FTL_Monat_${month}.pdf`);
}
function bind(){
  ['dutyDate','reportTime'].forEach(id=>$(id).addEventListener('input',()=>{reportInputMode='local';syncReport('local');calculate()}));
  ['reportUtcDate','reportUtcTime'].forEach(id=>$(id).addEventListener('input',()=>{reportInputMode='utc';syncReport('utc');calculate()}));
  ['onBlockDate','onBlockTime'].forEach(id=>$(id).addEventListener('input',()=>{onBlockInputMode='local';syncOnBlock('local');calculate()}));
  ['onBlockUtcDate','onBlockUtcTime'].forEach(id=>$(id).addEventListener('input',()=>{onBlockInputMode='utc';syncOnBlock('utc');calculate()}));
  $('departureIcao').addEventListener('input',()=>{syncReport(reportInputMode);calculate()});
  $('arrivalIcao').addEventListener('input',()=>{syncOnBlock(onBlockInputMode);calculate()});
  ['flightRef','sectors','acclimatisation','positioning','plannedExtension','extensionMinutes','notes'].forEach(id=>$(id).addEventListener('input',calculate));
  $('saveBtn').onclick=saveRecord;$('resetBtn').onclick=resetForm;$('monthFilter').onchange=renderArchive;$('pdfBtn').onclick=exportPDF;$('csvBtn').onclick=exportCSV;
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{document.querySelectorAll('.tab,.view').forEach(x=>x.classList.remove('active'));t.classList.add('active');$(t.dataset.view).classList.add('active');if(t.dataset.view==='archiveView')renderArchive()});
}
async function init(){
  bind();setSyncBadge('report','local');setSyncBadge('onBlock','local');
  try{const data=await fetch('airports.json').then(r=>{if(!r.ok)throw new Error('airports.json');return r.json()});airports=new Map(data.map(a=>[a.i,a]));calculate()}
  catch(e){showStatus('DATENBANKFEHLER','danger','Die Flughafen-Datenbank konnte nicht geladen werden. Prüfe, ob airports.json hochgeladen wurde.')}
  renderArchive();
}
let deferredPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false});
$('installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('installBtn').hidden=true};
if('serviceWorker'in navigator)navigator.serviceWorker.register('service-worker.js');
init();
