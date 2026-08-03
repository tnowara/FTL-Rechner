const $=id=>document.getElementById(id),KEY='ftl-logbook-records-v4';
let currentResult=null,airports=new Map(),syncing=false;
let calendarEditingId=null,selectedCalendarDates=new Set();
let reportInputMode='utc',onBlockInputMode='utc',dutyEndInputMode='utc',dutyEndManual=false,editingId=null;

const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
for(let i=1;i<=10;i++){const o=document.createElement('option');o.value=i;o.textContent=i===1?'1 Sektor':`${i} Sektoren`;$('sectors').appendChild(o)}
$('dutyDate').value=today();$('onBlockDate').value=today();$('monthFilter').value=today().slice(0,7);$('statisticsDate').value=today();$('calendarMonth').value=today().slice(0,7);$('calendarEntryDate').value=today();$('calendarEntryEndDate').value=today();

function toMinutes(t){const [h,m]=String(t||'00:00').split(':').map(Number);return h*60+m}
function formatDuration(v){if(!Number.isFinite(v))return '–';const s=v<0?'−':'';v=Math.abs(Math.round(v));return `${s}${Math.floor(v/60)}:${pad(v%60)} h`}
function formatDate(s){if(!s)return '–';const [y,m,d]=s.split('-');return `${d}.${m}.${y}`}
function dateToUtcNoon(s){if(!s)return NaN;const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d,12)}
function dateStringFromMs(ms){const d=new Date(ms);return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`}
function hoursMinutesLabel(mins){return `${Math.floor((mins||0)/60)}:${pad(Math.round(mins||0)%60)}`}
function recordDateMs(r){return Number.isFinite(r.reportUtc)?r.reportUtc:dateToUtcNoon(r.date)}
function inDateWindow(r,startMs,endMs){const t=recordDateMs(r);return Number.isFinite(t)&&t>=startMs&&t<endMs}
function progressState(value,limit){const ratio=limit?value/limit:0;return ratio>1?'danger':ratio>=.9?'warn':'ok'}
function setProgress(barId,value,limit){const bar=$(barId);if(!bar)return;const pct=Math.min(100,Math.max(0,(value/limit)*100));bar.style.width=`${pct}%`;bar.className=`progress-fill ${progressState(value,limit)}`}
function setMinimumProgress(barId,value,target){
  const bar=$(barId);if(!bar)return;
  const pct=Math.min(100,Math.max(0,(value/target)*100));
  bar.style.width=`${pct}%`;
  bar.className=`progress-fill ${value>=target?'ok':value>=target*.75?'warn':'danger'}`;
}
function uniqueOffDates(records){
  return [...new Set(records.filter(r=>r.entryType==='off'&&r.date).map(r=>r.date))];
}

function datePartsUtc(ms){const d=new Date(ms);return {date:`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`,time:`${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`}}
function formatUtc(ms){if(!Number.isFinite(ms))return '–';const p=datePartsUtc(ms);return `${formatDate(p.date)} ${p.time} UTC`}
function utcFieldsToMs(date,time){if(!date||!time)return NaN;const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);return Date.UTC(y,m-1,d,hh,mm)}
function zonedToUtc(date,time,tz){if(!date||!time||!tz)return NaN;const [y,m,d]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);const wanted=Date.UTC(y,m-1,d,hh,mm);let guess=wanted;const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});for(let i=0;i<5;i++){const q={};fmt.formatToParts(new Date(guess)).forEach(x=>{if(x.type!=='literal')q[x.type]=+x.value});const shown=Date.UTC(q.year,q.month-1,q.day,q.hour,q.minute);guess+=wanted-shown}return guess}
function utcToZonedFields(ms,tz){const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});const q={};fmt.formatToParts(new Date(ms)).forEach(x=>{if(x.type!=='literal')q[x.type]=x.value});return {date:`${q.year}-${q.month}-${q.day}`,time:`${q.hour}:${q.minute}`}}
function localClock(ms,tz){const p=utcToZonedFields(ms,tz);return `${formatDate(p.date)} ${p.time} lokal`}
function offsetAt(tz,ms){const p=utcToZonedFields(ms,tz);return Math.round((zonedToUtc(p.date,p.time,'UTC')-ms)/3600000)}
function standardOffset(tz,year){return Math.min(offsetAt(tz,Date.UTC(year,0,15,12)),offsetAt(tz,Date.UTC(year,6,15,12)))}
function airportInfo(code,el,prefix=''){const a=airports.get(code);if(!code){el.textContent=prefix?`${prefix} eingeben`:'ICAO-Kennung eingeben';el.className=''}else if(!a){el.textContent='Flughafen nicht in der Datenbank';el.className='field-error'}else{el.textContent=`${a.n}${a.c?' · '+a.c:''} · ${a.t}`;el.className='field-ok'}return a}
function setSyncBadge(which,mode){const id=which==='report'?'reportSyncBadge':'onBlockSyncBadge';$(id).textContent=mode==='utc'?'UTC → Ortszeit':'Ortszeit → UTC'}
function setUtcFields(prefix,ms){const p=datePartsUtc(ms);$(`${prefix}UtcDate`).value=p.date;$(`${prefix}UtcTime`).value=p.time}
function setLocalFields(dateId,timeId,ms,tz){const p=utcToZonedFields(ms,tz);$(dateId).value=p.date;$(timeId).value=p.time}

function syncReport(source){
  if(syncing)return;const dep=airports.get($('departureIcao').value.trim().toUpperCase());if(!dep)return;syncing=true;
  if(source==='utc'){reportInputMode='utc';const ms=utcFieldsToMs($('reportUtcDate').value,$('reportUtcTime').value);if(Number.isFinite(ms))setLocalFields('dutyDate','reportTime',ms,dep.t)}
  else{reportInputMode='local';const ms=zonedToUtc($('dutyDate').value,$('reportTime').value,dep.t);if(Number.isFinite(ms))setUtcFields('report',ms)}
  setSyncBadge('report',reportInputMode);syncing=false
}
function syncOnBlock(source){
  if(syncing)return;const arr=airports.get($('arrivalIcao').value.trim().toUpperCase());if(!arr)return;syncing=true;
  if(source==='utc'){onBlockInputMode='utc';const ms=utcFieldsToMs($('onBlockUtcDate').value,$('onBlockUtcTime').value);if(Number.isFinite(ms))setLocalFields('onBlockDate','onBlockTime',ms,arr.t)}
  else{onBlockInputMode='local';const ms=zonedToUtc($('onBlockDate').value,$('onBlockTime').value,arr.t);if(Number.isFinite(ms))setUtcFields('onBlock',ms)}
  setSyncBadge('onBlock',onBlockInputMode);syncing=false
}
function syncDutyEnd(source){
  if(syncing)return;const arr=airports.get($('arrivalIcao').value.trim().toUpperCase());if(!arr)return;syncing=true;
  if(source==='utc'){dutyEndInputMode='utc';const ms=utcFieldsToMs($('dutyEndUtcDate').value,$('dutyEndUtcTime').value);if(Number.isFinite(ms))setLocalFields('dutyEndLocalDate','dutyEndLocalTime',ms,arr.t)}
  else{dutyEndInputMode='local';const ms=zonedToUtc($('dutyEndLocalDate').value,$('dutyEndLocalTime').value,arr.t);if(Number.isFinite(ms)){const p=datePartsUtc(ms);$('dutyEndUtcDate').value=p.date;$('dutyEndUtcTime').value=p.time}}
  syncing=false
}
function setAutoDutyEnd(){
  const on=utcFieldsToMs($('onBlockUtcDate').value,$('onBlockUtcTime').value),arr=airports.get($('arrivalIcao').value.trim().toUpperCase());
  if(!Number.isFinite(on)||!arr)return;
  dutyEndManual=false;setUtcFields('dutyEnd',on+15*60000);setLocalFields('dutyEndLocalDate','dutyEndLocalTime',on+15*60000,arr.t)
}

function baseFdpBySectors(sectors){return 780-Math.min(120,Math.max(0,sectors-2)*30)}
function intervalsOverlap(a1,a2,b1,b2){return Math.max(0,Math.min(a2,b2)-Math.max(a1,b1))}
function woclData(reportUtc,onUtc,tz){
  let overlap=0,startOverlap=0;
  const start=new Date(reportUtc-86400000),end=new Date(onUtc+86400000);
  for(let d=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),start.getUTCDate()));d<=end;d=new Date(d.getTime()+86400000)){
    const ds=`${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
    const ws=zonedToUtc(ds,'02:00',tz),we=zonedToUtc(ds,'06:00',tz);
    const ov=intervalsOverlap(reportUtc,onUtc,ws,we);overlap+=ov;
    if(reportUtc>=ws&&reportUtc<we)startOverlap=Math.min(onUtc,we)-reportUtc;
  }
  const minutes=Math.round(overlap/60000),startsIn=startOverlap>0;
  return {minutes,startsIn,reduction:Math.min(120,Math.round((startsIn?overlap:overlap*.5)/60000))}
}
function ruleName(v){return ({
  basic:'Basisregelung',planned_extension:'Geplante Verlängerung',split2:'Split Duty ≥2 h',
  split3:'Split Duty ≥3 h',heavy_ambulance:'Heavy Crew Ambulance',heavy_pax_bd700:'Heavy Crew Pax/Cargo BD700',
  commander:'Commander’s Discretion',standby:'Standby',reduced_rest:'Reduced Rest',post_positioning:'Positioning nach letztem Sektor'
})[v]||v}

function updateSpecialFields(){
  const r=$('specialRule').value;
  ['specialMinutesWrap','extensionRestWrap','commanderCrewWrap','standbyFacilityWrap','reducedRestWrap'].forEach(id=>$(id).classList.add('hidden'));
  const show=(id)=>$(id).classList.remove('hidden');
  let note='Berechnung nach der normalen OM-A-Basisregelung.';
  if(r==='planned_extension'){show('specialMinutesWrap');show('extensionRestWrap');$('specialMinutesLabel').textContent='Geplante Verlängerung (Minuten)';$('specialMinutes').max=60;$('specialMinutes').value=$('specialMinutes').value||60;$('specialMinutesHelp').textContent='Maximal 60 Minuten; weitere Einschränkungen werden geprüft.';note='OM-A 7.4.5: vorab geplant, höchstens zwei Mal in sieben Tagen; abhängig von Sektoren und WOCL.'}
  if(r==='split2'){show('specialMinutesWrap');$('specialMinutesLabel').textContent='Break auf dem Boden (Minuten)';$('specialMinutes').min=120;$('specialMinutes').value=Math.max(120,+$('specialMinutes').value||120);$('specialMinutesHelp').textContent='Mindestens 120 Minuten und ruhiger Raum mit Schlafmöglichkeit.';note='OM-A 7.4.9.1: verlängert die Duty auf 14 Stunden, nicht die zulässige FDP.'}
  if(r==='split3'){show('specialMinutesWrap');$('specialMinutesLabel').textContent='Geplanter Break auf dem Boden (Minuten)';$('specialMinutes').min=180;$('specialMinutes').value=Math.max(180,+$('specialMinutes').value||180);$('specialMinutesHelp').textContent='Mindestens 180 Minuten; ruhiger Schlafraum in unmittelbarer Flugplatznähe.';note='OM-A 7.4.9.2: kontinuierliche Duty bis 18 Stunden; FDP-Limit bleibt bestehen. Max. 10 h Pilotieren und max. zwei Landungen nach dem Break.'}
  if(r==='heavy_ambulance')note='OM-A 7.6: Heavy Crew Ambulance bis 18 h FDP; max. drei Sektoren, gleicher Duty-Startort, max. ein Escort Passenger.';
  if(r==='heavy_pax_bd700')note='OM-A 7.6: ausschließlich BD700 Passenger/Cargo mit Heavy Crew bis 14 h FDP.';
  if(r==='commander'){show('specialMinutesWrap');show('commanderCrewWrap');$('specialMinutesLabel').textContent='Discretion-Verlängerung (Minuten)';$('specialMinutes').min=0;$('specialMinutes').max=180;$('specialMinutes').value=$('specialMinutes').value||60;$('specialMinutesHelp').textContent='Nur für unvorhergesehene Umstände im tatsächlichen Flugbetrieb.';note='OM-A 7.7: nicht planbar; Crew-Konsultation und IQSMS-Report erforderlich. Mit vorab geplanter Verlängerung max. weitere 1 h.'}
  if(r==='standby'){show('specialMinutesWrap');show('standbyFacilityWrap');$('specialMinutesLabel').textContent='Standby-Dauer vor Reporting (Minuten)';$('specialMinutes').min=0;$('specialMinutes').max='';$('specialMinutesHelp').textContent='Je nach Unterkunft zählt Standby als FDP/Duty, Break oder Rest.';note='OM-A 7.8: Bewertung hängt von Ort, Schlafmöglichkeit, Dauer und angrenzender Ruhezeit ab.'}
  if(r==='reduced_rest'){show('reducedRestWrap');note='OM-A 7.5.3: nur mit schriftlicher LBA-Genehmigung; maximal zwei Stunden Reduzierung und niemals unter zehn Stunden.'}
  if(r==='post_positioning'){show('specialMinutesWrap');$('specialMinutesLabel').textContent='Positioning nach ON-Block (Minuten)';$('specialMinutes').min=0;$('specialMinutes').max='';$('specialMinutesHelp').textContent='Wird zur Duty und zur Berechnung der Mindest-Ruhezeit addiert, nicht zur FDP.';note='OM-A 7.4.8: Positioning unmittelbar nach dem operativen Sektor ist für die Mindestruhe zu berücksichtigen.'}
  $('specialRuleNote').textContent=note;
}

function calculate(){
  const depCode=$('departureIcao').value.trim().toUpperCase(),arrCode=$('arrivalIcao').value.trim().toUpperCase(),homeCode=$('homeBaseIcao').value.trim().toUpperCase();
  $('departureIcao').value=depCode;$('arrivalIcao').value=arrCode;$('homeBaseIcao').value=homeCode;
  const dep=airportInfo(depCode,$('departureInfo')),arr=airportInfo(arrCode,$('arrivalInfo')),home=airportInfo(homeCode,$('homeBaseInfo'),'Home Base');
  if(!dep||!arr||!home){clearResult();showStatus('ICAO PRÜFEN','warn','Start, Ziel und Home Base müssen erkannt werden.');return}
  syncReport(reportInputMode);syncOnBlock(onBlockInputMode);
  const reportUtc=utcFieldsToMs($('reportUtcDate').value,$('reportUtcTime').value),onUtc=utcFieldsToMs($('onBlockUtcDate').value,$('onBlockUtcTime').value);
  if(!Number.isFinite(reportUtc)||!Number.isFinite(onUtc)){clearResult();return}
  if(!dutyEndManual)setAutoDutyEnd(); else syncDutyEnd(dutyEndInputMode);
  let dutyEnd=utcFieldsToMs($('dutyEndUtcDate').value,$('dutyEndUtcTime').value);
  if(!Number.isFinite(dutyEnd)){clearResult();return}

  const plannedFdp=Math.round((onUtc-reportUtc)/60000),sectors=+$('sectors').value,rule=$('specialRule').value,specialMin=+$('specialMinutes').value||0;
  const year=new Date(reportUtc).getUTCFullYear(),homeOff=standardOffset(home.t,year),depOff=standardOffset(dep.t,year),arrOff=standardOffset(arr.t,year);
  const woclTz=(Math.abs(homeOff-depOff)<=3||!$('awayOver48').checked)?home.t:dep.t;
  const wocl=woclData(reportUtc,onUtc,woclTz);
  const normalLimit=baseFdpBySectors(sectors)-wocl.reduction;
  let limit=normalLimit,dutyLimit=840,valid=true,warnings=[],restAdd=0,standbyDuty=0,postPositioning=0;

  if(rule==='planned_extension'){
    const ext=Math.min(60,Math.max(0,specialMin));limit+=ext;
    if(sectors>=6){valid=false;warnings.push('Eine geplante Verlängerung ist bei sechs oder mehr Sektoren unzulässig.')}
    if(wocl.minutes>120&&sectors>2){valid=false;warnings.push('Bei mehr als zwei Stunden WOCL-Encroachment sind höchstens zwei Sektoren zulässig.')}
    if(wocl.minutes>0&&wocl.minutes<=120&&sectors>4){valid=false;warnings.push('Bei bis zu zwei Stunden WOCL-Encroachment sind höchstens vier Sektoren zulässig.')}
    const startMin=toMinutes(utcToZonedFields(reportUtc,woclTz).time);if(startMin>=1320||startMin<=299)limit=Math.min(limit,705);
    restAdd=$('extensionRestMode').value==='post4'?240:120;
  }
  if(rule==='split2'){if(specialMin<120){valid=false;warnings.push('Der Break muss mindestens zwei Stunden dauern.')}dutyLimit=840}
  if(rule==='split3'){if(specialMin<180){valid=false;warnings.push('Der Break muss mindestens drei Stunden dauern.')}dutyLimit=1080;warnings.push('Zusätzlich sind max. 10 Stunden Pilotieren und max. zwei Landungen nach dem Break einzuhalten.')}
  if(rule==='heavy_ambulance'){limit=1080;dutyLimit=1080;if(sectors>3){valid=false;warnings.push('Heavy Crew Ambulance ist auf maximal drei Sektoren begrenzt.')}warnings.push('Gleicher Duty-Startort und höchstens ein Escort Passenger erforderlich.')}
  if(rule==='heavy_pax_bd700'){limit=840;dutyLimit=840;warnings.push('Diese Genehmigung gilt ausschließlich für BD700 Passenger/Cargo.')}
  if(rule==='commander'){
    let maxDisc=$('augmentedCrew').checked?180:120;
    const disc=Math.max(0,specialMin);
    if(disc>maxDisc){valid=false;warnings.push(`Die gewählte Discretion überschreitet ${formatDuration(maxDisc)}.`)}
    limit=normalLimit+Math.min(disc,maxDisc);dutyLimit=limit+15;
    warnings.push('Nur bei unvorhergesehenen Umständen; Crew-Konsultation und IQSMS-Report erforderlich.')
  }
  if(rule==='standby'){
    const facility=$('standbyFacility').value;
    if(facility==='no_sleep'||facility==='sleep_under2'){standbyDuty=specialMin;warnings.push('Standby wird vollständig als FDP/Duty vor dem Reporting angerechnet.')}
    else if(facility==='sleep_break'){standbyDuty=specialMin;dutyLimit=Math.max(dutyLimit,840);warnings.push('Standby kann als Break gelten, bleibt aber Duty.')}
    else warnings.push('Standby wird als Rest behandelt; dies setzt die Voraussetzungen des OM-A 7.8.3 voraus.');
  }
  if(rule==='post_positioning'){postPositioning=specialMin;dutyEnd+=postPositioning*60000}

  const effectiveFdp=plannedFdp+standbyDuty;
  const margin=limit-effectiveFdp,latestUtc=reportUtc+(limit-standbyDuty)*60000;
  const dutyStart=reportUtc-standbyDuty*60000;
  const dutyMinutes=Math.round((dutyEnd-dutyStart)/60000);
  const startEndDiff=Math.abs(depOff-arrOff);
  let minimumRest=arrCode===homeCode?Math.max(dutyMinutes,720):Math.max(dutyMinutes,600);
  if(startEndDiff>=4)minimumRest=Math.max(minimumRest,840);
  minimumRest+=restAdd;
  if(rule==='reduced_rest')minimumRest=Math.max(600,minimumRest-(+$('reducedRestMinutes').value||0));
  const earliest=dutyEnd+minimumRest*60000;

  $('plannedFdpValue').textContent=formatDuration(effectiveFdp);
  $('appliedRule').textContent=ruleName(rule);
  $('baseLimit').textContent=formatDuration(limit);
  $('latestEnd').textContent=`${formatUtc(latestUtc)} / ${localClock(latestUtc,arr.t)}`;
  $('plannedMargin').textContent=formatDuration(margin);
  $('woclReduction').textContent=`${formatDuration(wocl.reduction)} (${woclTz})`;
  $('dutyDuration').textContent=formatDuration(dutyMinutes);
  $('minimumRest').textContent=formatDuration(minimumRest);
  $('earliestNextReport').textContent=`${formatUtc(earliest)} / ${localClock(earliest,arr.t)}`;

  let state='ok',title='RECHNERISCH INNERHALB';
  if(plannedFdp<0||dutyEnd<onUtc){state='danger';title='ZEITEN PRÜFEN';warnings.unshift('ON-Block oder Dienstende liegt zeitlich vor dem zugehörigen vorherigen Zeitpunkt.')}
  else if(!valid){state='danger';title='SONDERREGEL UNZULÄSSIG'}
  else if(margin<0){state='danger';title='FDP-LIMIT ÜBERSCHRITTEN';warnings.unshift(`Überschreitung um ${formatDuration(-margin)}.`)}
  else if(dutyMinutes>dutyLimit){state='danger';title='DUTY-LIMIT ÜBERSCHRITTEN';warnings.unshift(`Duty ${formatDuration(dutyMinutes)} überschreitet das für diese Auswahl angesetzte Limit ${formatDuration(dutyLimit)}.`)}
  else if(margin<30){state='warn';title='KRITISCH';warnings.unshift(`Nur ${formatDuration(margin)} FDP-Reserve.`)}
  if(startEndDiff>=4)warnings.push('Mindestens vier Zeitzonen zwischen Beginn und Ende: Mindestruhe mindestens 14 Stunden.');
  if(rule==='reduced_rest')warnings.push('Reduced Rest darf nur mit schriftlicher LBA-Genehmigung angewandt werden.');
  const msg=`FDP ${formatDuration(effectiveFdp)}, Limit ${formatDuration(limit)}, Duty ${formatDuration(dutyMinutes)}, Mindestruhe ${formatDuration(minimumRest)}.`+(warnings.length?' '+warnings.join(' '):'');
  showStatus(title,state,msg);
  currentResult={depCode,arrCode,homeCode,depName:dep.n,arrName:arr.n,depTz:dep.t,arrTz:arr.t,homeTz:home.t,reportUtc,onUtc,plannedFdp:effectiveFdp,sectors,rule,specialMinutes:specialMin,limit,margin,latestUtc,woclMinutes:wocl.minutes,woclReduction:wocl.reduction,woclTz,dutyEnd,dutyMinutes,minimumRest,earliestNextReport:earliest,startEndTimeZoneDiff:startEndDiff,status:title,statusClass:state};
}
function clearResult(){currentResult=null;['plannedFdpValue','appliedRule','baseLimit','latestEnd','plannedMargin','woclReduction','dutyDuration','minimumRest','earliestNextReport'].forEach(id=>$(id).textContent='–')}
function showStatus(title,state,msg){$('statusPill').className=`status ${state}`;$('statusPill').textContent=title;$('message').textContent=msg}
function getRecords(){try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function setRecords(r){localStorage.setItem(KEY,JSON.stringify(r))}
function formRecord(){
  return {id:editingId||((crypto.randomUUID&&crypto.randomUUID())||String(Date.now())),date:$('dutyDate').value,onBlockDate:$('onBlockDate').value,flightRef:$('flightRef').value.trim(),reportTime:$('reportTime').value,onBlockTime:$('onBlockTime').value,reportUtcDate:$('reportUtcDate').value,reportUtcTime:$('reportUtcTime').value,onBlockUtcDate:$('onBlockUtcDate').value,onBlockUtcTime:$('onBlockUtcTime').value,dutyEndUtcDate:$('dutyEndUtcDate').value,dutyEndUtcTime:$('dutyEndUtcTime').value,dutyEndLocalDate:$('dutyEndLocalDate').value,dutyEndLocalTime:$('dutyEndLocalTime').value,positioning:$('positioning').checked,awayOver48:$('awayOver48').checked,specialRule:$('specialRule').value,specialMinutes:+$('specialMinutes').value||0,extensionRestMode:$('extensionRestMode').value,augmentedCrew:$('augmentedCrew').checked,standbyFacility:$('standbyFacility').value,reducedRestMinutes:+$('reducedRestMinutes').value||0,blockTime:$('blockTime').value,blockMinutes:toMinutes($('blockTime').value),notes:$('notes').value.trim(),...currentResult,savedAt:new Date().toISOString()}
}
function saveRecord(){
  calculate();if(!currentResult)return alert('Bitte erst gültige Angaben eingeben.');
  const rec=formRecord(),records=getRecords(),idx=records.findIndex(r=>r.id===rec.id);
  if(idx>=0)records[idx]=rec;else records.push(rec);
  records.sort((a,b)=>a.reportUtc-b.reportUtc);setRecords(records);
  $('saveBtn').textContent=idx>=0?'Änderungen gespeichert ✓':'Gespeichert ✓';
  setTimeout(()=>{$('saveBtn').textContent=editingId?'Änderungen speichern':'Datensatz speichern'},1400);
  renderArchive();renderDashboard();renderStatistics();renderCalendar()
}
function setEditing(on){$('editBanner').classList.toggle('hidden',!on);$('saveBtn').textContent=on?'Änderungen speichern':'Datensatz speichern'}
function switchView(id){document.querySelectorAll('.tab,.view').forEach(x=>x.classList.remove('active'));document.querySelector(`.tab[data-view="${id}"]`).classList.add('active');$(id).classList.add('active')}
function editRecord(id){
  const r=getRecords().find(x=>x.id===id);if(!r)return;editingId=id;setEditing(true);
  $('flightRef').value=r.flightRef||'';$('departureIcao').value=r.depCode||'';$('arrivalIcao').value=r.arrCode||'';$('homeBaseIcao').value=r.homeCode||'EDDN';$('sectors').value=r.sectors||1;
  $('reportUtcDate').value=r.reportUtcDate||datePartsUtc(r.reportUtc).date;$('reportUtcTime').value=r.reportUtcTime||datePartsUtc(r.reportUtc).time;
  $('onBlockUtcDate').value=r.onBlockUtcDate||datePartsUtc(r.onUtc).date;$('onBlockUtcTime').value=r.onBlockUtcTime||datePartsUtc(r.onUtc).time;
  $('dutyDate').value=r.date||today();$('reportTime').value=r.reportTime||'';$('onBlockDate').value=r.onBlockDate||r.date||today();$('onBlockTime').value=r.onBlockTime||'';
  $('dutyEndUtcDate').value=r.dutyEndUtcDate||datePartsUtc(r.dutyEnd).date;$('dutyEndUtcTime').value=r.dutyEndUtcTime||datePartsUtc(r.dutyEnd).time;
  $('dutyEndLocalDate').value=r.dutyEndLocalDate||'';$('dutyEndLocalTime').value=r.dutyEndLocalTime||'';
  $('positioning').checked=r.positioning!==false;$('awayOver48').checked=!!r.awayOver48;$('specialRule').value=r.specialRule||r.rule||'basic';$('specialMinutes').value=r.specialMinutes||0;
  $('extensionRestMode').value=r.extensionRestMode||'post4';$('augmentedCrew').checked=!!r.augmentedCrew;$('standbyFacility').value=r.standbyFacility||'no_sleep';$('reducedRestMinutes').value=r.reducedRestMinutes||60;$('blockTime').value=r.blockTime||`${pad(Math.floor((r.blockMinutes||0)/60))}:${pad((r.blockMinutes||0)%60)}`;$('notes').value=r.notes||'';
  reportInputMode='utc';onBlockInputMode='utc';dutyEndInputMode='utc';dutyEndManual=true;updateSpecialFields();switchView('entryView');calculate();window.scrollTo({top:0,behavior:'smooth'})
}
function resetForm(){
  editingId=null;setEditing(false);$('dutyDate').value=today();$('onBlockDate').value=today();$('flightRef').value='';$('departureIcao').value='';$('arrivalIcao').value='';$('homeBaseIcao').value='EDDN';$('reportTime').value='15:00';$('onBlockTime').value='03:00';
  ['reportUtcDate','reportUtcTime','onBlockUtcDate','onBlockUtcTime','dutyEndUtcDate','dutyEndUtcTime','dutyEndLocalDate','dutyEndLocalTime'].forEach(id=>$(id).value='');
  $('sectors').value='1';$('positioning').checked=true;$('awayOver48').checked=false;$('specialRule').value='basic';$('specialMinutes').value=0;$('blockTime').value='00:00';$('notes').value='';
  reportInputMode='utc';onBlockInputMode='utc';dutyEndInputMode='utc';dutyEndManual=false;updateSpecialFields();calculate()
}
function deleteRecord(id){if(confirm('Diesen Datensatz wirklich löschen?')){if(editingId===id)resetForm();setRecords(getRecords().filter(r=>r.id!==id));renderArchive();renderDashboard();renderStatistics();renderCalendar()}}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function recordSearchText(r){
  return [r.date,r.onBlockDate,r.flightRef,r.depCode,r.arrCode,r.homeCode,r.depName,r.arrName,r.notes,r.status,ruleName(r.specialRule||r.rule||'basic')].join(' ').toLocaleLowerCase('de');
}
function filteredArchiveRecords(){
  const month=$('monthFilter').value;
  const query=($('archiveSearch')?.value||'').trim().toLocaleLowerCase('de');
  return getRecords().filter(r=>isDutyRecord(r)&&(!month||(r.date&&r.date.startsWith(month)))&&(!query||recordSearchText(r).includes(query)));
}
function renderArchive(){
  const rs=filteredArchiveRecords(),tb=$('recordsTable').querySelector('tbody');tb.innerHTML='';
  rs.forEach(r=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${formatDate(r.date)}</td><td><strong>${escapeHtml(r.depCode)}–${escapeHtml(r.arrCode)}</strong><br><small>${escapeHtml(r.flightRef||'')}</small></td><td><strong>${r.reportUtcTime||datePartsUtc(r.reportUtc).time} UTC</strong><br><small>${r.reportTime||''} lokal</small></td><td><strong>${r.onBlockUtcTime||datePartsUtc(r.onUtc).time} UTC</strong><br><small>${formatDate(r.onBlockDate)} ${r.onBlockTime||''} lokal</small></td><td>${formatDuration(r.plannedFdp)}</td><td>${r.blockMinutes?formatDuration(r.blockMinutes):'–'}</td><td>${escapeHtml(ruleName(r.specialRule||r.rule||'basic'))}</td><td>${formatDuration(r.minimumRest)}</td><td class="action-cell"><button class="icon-btn edit-btn" data-id="${r.id}">Bearbeiten</button><button class="icon-btn delete-btn" data-id="${r.id}">Löschen</button></td>`;tb.appendChild(tr)});
  tb.querySelectorAll('.edit-btn').forEach(b=>b.onclick=()=>editRecord(b.dataset.id));tb.querySelectorAll('.delete-btn').forEach(b=>b.onclick=()=>deleteRecord(b.dataset.id));
  $('emptyState').textContent=($('archiveSearch')?.value||'').trim()?'Keine passenden Datensätze gefunden.':'Für diesen Monat sind keine Datensätze gespeichert.';
  $('emptyState').classList.toggle('hidden',rs.length>0);$('recordsTable').classList.toggle('hidden',rs.length===0);$('monthCount').textContent=rs.length;$('monthFdp').textContent=formatDuration(rs.reduce((s,r)=>s+(r.plannedFdp||0),0));$('monthBlock').textContent=formatDuration(rs.reduce((s,r)=>s+(r.blockMinutes||0),0));
}
function statusClassForRecord(r){return r.statusClass==='danger'?'danger':r.statusClass==='warn'?'warn':'ok'}
function dashboardRecordTime(r){
  if(isDutyRecord(r)&&Number.isFinite(r.reportUtc))return r.reportUtc;
  return dateToUtcNoon(r.date)||0;
}
function renderDashboard(){
  renderDashboardLimits();
  const todayEnd=dateToUtcNoon(today())+12*3600000;
  const records=getRecords()
    .filter(r=>dashboardRecordTime(r)<todayEnd)
    .slice()
    .sort((a,b)=>dashboardRecordTime(b)-dashboardRecordTime(a));
  const now=new Date(),month=`${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  const monthRecords=records.filter(r=>r.date&&r.date.startsWith(month));
  $('dashboardTotalCount').textContent=records.length;
  $('dashboardMonthCount').textContent=`${monthRecords.length} ${monthRecords.length===1?'Datensatz':'Datensätze'}`;
  $('dashboardMonthFdp').textContent=formatDuration(monthRecords.reduce((s,r)=>s+(r.plannedFdp||0),0));

  const lastDuty=records.find(isDutyRecord);
  const status=$('dashboardStatus');
  if(lastDuty){
    status.textContent=lastDuty.status||'Gespeichert';status.className=`dashboard-status ${statusClassForRecord(lastDuty)}`;
    $('dashboardLastRoute').textContent=`${lastDuty.depCode||'–'} → ${lastDuty.arrCode||'–'}${lastDuty.flightRef?' · '+lastDuty.flightRef:''}`;
    $('dashboardLastDate').textContent=formatDate(lastDuty.date);
    $('dashboardNextReport').textContent=Number.isFinite(lastDuty.earliestNextReport)?formatUtc(lastDuty.earliestNextReport):'–';
    $('dashboardRestInfo').textContent=`Mindestruhe ${formatDuration(lastDuty.minimumRest)}`;
  }else{
    status.textContent='Noch kein Flugdienst';status.className='dashboard-status';
    $('dashboardLastRoute').textContent='–';$('dashboardLastDate').textContent='–';
    $('dashboardNextReport').textContent='–';$('dashboardRestInfo').textContent='Aus dem letzten gespeicherten Duty';
  }

  const recent=records.slice(0,5),box=$('recentRecords');
  box.innerHTML='';$('dashboardEmpty').classList.toggle('hidden',recent.length>0);

  recent.forEach(r=>{
    const row=document.createElement('button');
    row.className='recent-record';
    row.dataset.id=r.id;

    if(isDutyRecord(r)){
      row.innerHTML=`<span><strong>${escapeHtml(r.depCode||'–')} → ${escapeHtml(r.arrCode||'–')}</strong><small>${formatDate(r.date)}${r.flightRef?' · '+escapeHtml(r.flightRef):''}</small></span><span class="recent-values"><strong>${formatDuration(r.plannedFdp)}</strong><small>${escapeHtml(r.status||'')}</small></span>`;
      row.onclick=()=>editRecord(r.id);
    }else{
      const type=r.entryType||'other';
      row.classList.add(`recent-${calendarTypeClass(type)}`);
      row.innerHTML=`<span><strong>${escapeHtml(calendarTypeName(type))}</strong><small>${formatDate(r.date)}</small></span><span class="recent-values"><strong>${r.dutyMinutes?formatDuration(r.dutyMinutes):''}</strong><small>${type==='off'?'Local Day Free':''}</small></span>`;
      row.onclick=()=>{switchView('calendarView');renderCalendar();editCalendarEntry(r.id)};
    }
    box.appendChild(row);
  });
}
function exportBackup(){
  const payload={format:'FAI-FTL-LOGBOOK-BACKUP',version:1,appVersion:'1.9.4',exportedAt:new Date().toISOString(),records:getRecords()};
  const stamp=new Date().toISOString().slice(0,10);downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`FTL_Backup_${stamp}.json`);
  showBackupMessage(`${payload.records.length} Datensätze wurden exportiert.`,'ok');
}


function isDutyRecord(r){return !r.entryType||r.entryType==='duty'}
function isCalendarRecord(r){return !!r.entryType&&r.entryType!=='duty'}
function calendarTypeName(type){
  return ({off:'OFF',vacation:'Urlaub',sick:'Krank',standby:'Standby',training:'Training',other:'Sonstiges'})[type]||type
}
function calendarTypeClass(type){
  return ({off:'off',vacation:'vacation',sick:'sick',standby:'standby',training:'other',other:'other'})[type]||'other'
}
function monthShift(month,delta){
  const [y,m]=month.split('-').map(Number);
  const d=new Date(Date.UTC(y,m-1+delta,1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}`
}
function calendarRecords(){
  return getRecords()
}
function resetCalendarForm(date=today()){
  calendarEditingId=null;
  selectedCalendarDates.clear();
  $('calendarFormTitle').textContent='Eintrag hinzufügen';
  $('calendarSelectionMode').value='range';
  $('calendarEntryDate').value=date;
  $('calendarEntryEndDate').value=date;
  $('calendarEntryType').value='off';
  $('calendarEntryDuration').value='00:00';
  $('calendarEntryNotes').value='';
  $('deleteCalendarEntryBtn').classList.add('hidden');
  updateCalendarDurationVisibility();
  updateCalendarSelectionMode();
  updateSelectedDaysDisplay();
}
function updateCalendarDurationVisibility(){
  const type=$('calendarEntryType').value;
  $('calendarDurationWrap').classList.toggle('hidden',!['standby','training','other'].includes(type));
}

function updateCalendarSelectionMode(){
  const multiple=$('calendarSelectionMode').value==='multiple';
  $('calendarStartDateWrap').classList.toggle('hidden',multiple);
  $('calendarEndDateWrap').classList.toggle('hidden',multiple);
  $('calendarSelectedDaysWrap').classList.toggle('hidden',!multiple);
  renderCalendar();
}
function updateSelectedDaysDisplay(){
  const dates=[...selectedCalendarDates].sort();
  $('selectedDaysDisplay').textContent=dates.length?dates.map(formatDate).join(', '):'Keine Tage ausgewählt';
}
function datesInRange(start,end){
  const result=[];
  let cur=dateToUtcNoon(start),last=dateToUtcNoon(end);
  if(!Number.isFinite(cur)||!Number.isFinite(last))return result;
  if(last<cur)[cur,last]=[last,cur];
  for(let t=cur;t<=last;t+=86400000)result.push(dateStringFromMs(t));
  return result;
}
function calendarTargetDates(){
  if($('calendarSelectionMode').value==='multiple')return [...selectedCalendarDates].sort();
  return datesInRange($('calendarEntryDate').value,$('calendarEntryEndDate').value);
}

function saveCalendarEntry(){
  const dates=calendarTargetDates();
  if(!dates.length)return alert('Bitte mindestens einen Tag auswählen.');
  const type=$('calendarEntryType').value;
  const records=getRecords();
  const duration=['standby','training','other'].includes(type)?toMinutes($('calendarEntryDuration').value):0;
  const notes=$('calendarEntryNotes').value.trim();

  if(calendarEditingId){
    const idx=records.findIndex(r=>r.id===calendarEditingId);
    if(idx>=0){
      records[idx]={
        ...records[idx],
        entryType:type,
        date:dates[0],
        title:calendarTypeName(type),
        notes,
        dutyMinutes:duration,
        blockMinutes:0,
        savedAt:new Date().toISOString()
      };
    }
  }else{
    for(const date of dates){
      records.push({
        id:(crypto.randomUUID&&crypto.randomUUID())||`${Date.now()}-${date}-${Math.random()}`,
        entryType:type,
        date,
        title:calendarTypeName(type),
        notes,
        dutyMinutes:duration,
        blockMinutes:0,
        createdAt:new Date().toISOString(),
        savedAt:new Date().toISOString()
      });
    }
  }

  records.sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  setRecords(records);
  resetCalendarForm(dates[0]||today());
  renderCalendar();
  renderStatistics();
  renderDashboard();
}
function editCalendarEntry(id){
  const r=getRecords().find(x=>x.id===id);
  if(!r)return;
  if(isDutyRecord(r)){editRecord(id);return}
  calendarEditingId=id;
  $('calendarFormTitle').textContent='Eintrag bearbeiten';
  $('calendarSelectionMode').value='range';
  $('calendarEntryDate').value=r.date||today();
  $('calendarEntryEndDate').value=r.date||today();
  $('calendarEntryType').value=r.entryType||'other';
  $('calendarEntryDuration').value=`${pad(Math.floor((r.dutyMinutes||0)/60))}:${pad((r.dutyMinutes||0)%60)}`;
  $('calendarEntryNotes').value=r.notes||'';
  $('deleteCalendarEntryBtn').classList.remove('hidden');
  updateCalendarDurationVisibility();
  updateCalendarSelectionMode();
  window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'});
}
function deleteCalendarEntry(){
  if(!calendarEditingId)return;
  if(confirm('Diesen Kalendereintrag wirklich löschen?')){
    setRecords(getRecords().filter(r=>r.id!==calendarEditingId));
    resetCalendarForm($('calendarEntryDate').value||today());
    renderCalendar();renderStatistics();renderDashboard();
  }
}
function renderCalendar(){
  const month=$('calendarMonth').value||today().slice(0,7);
  const [year,mon]=month.split('-').map(Number);
  const first=new Date(Date.UTC(year,mon-1,1));
  const daysInMonth=new Date(Date.UTC(year,mon,0)).getUTCDate();
  const offset=(first.getUTCDay()+6)%7;
  const grid=$('calendarGrid');grid.innerHTML='';
  for(let i=0;i<offset;i++){const blank=document.createElement('div');blank.className='calendar-day blank';grid.appendChild(blank)}
  const records=calendarRecords().filter(r=>r.date&&r.date.startsWith(month));
  for(let day=1;day<=daysInMonth;day++){
    const date=`${year}-${pad(mon)}-${pad(day)}`;
    const cell=document.createElement('div');cell.className='calendar-day';cell.tabIndex=0;cell.setAttribute('role','button');cell.setAttribute('aria-label',formatDate(date));
    if(date===today())cell.classList.add('today');
    const head=document.createElement('div');head.className='calendar-date';head.textContent=day;
    if(selectedCalendarDates.has(date))cell.classList.add('selected');

    const selectCalendarDay=()=>{
      if($('calendarSelectionMode').value==='multiple'){
        if(selectedCalendarDates.has(date))selectedCalendarDates.delete(date);else selectedCalendarDates.add(date);
        updateSelectedDaysDisplay();renderCalendar();
      }else{
        resetCalendarForm(date);$('calendarEntryDate').scrollIntoView({behavior:'smooth',block:'center'});
      }
    };

    cell.onclick=event=>{
      if(event.target.closest('.calendar-item'))return;
      selectCalendarDay();
    };
    cell.onkeydown=event=>{
      if(event.key==='Enter'||event.key===' '){
        event.preventDefault();
        selectCalendarDay();
      }
    };
    cell.appendChild(head);
    const dayRecords=records.filter(r=>r.date===date).sort((a,b)=>isDutyRecord(a)?-1:1);
    dayRecords.forEach(r=>{
      const item=document.createElement('button');item.type='button';
      const type=isDutyRecord(r)?'duty':calendarTypeClass(r.entryType);
      item.className=`calendar-item ${type}`;
      if(isDutyRecord(r)){
        item.innerHTML=`<strong>${escapeHtml(r.depCode||'Duty')}${r.arrCode?'–'+escapeHtml(r.arrCode):''}</strong><span>${escapeHtml(r.flightRef||'')} ${r.plannedFdp?formatDuration(r.plannedFdp):''}</span>`;
      }else{
        item.innerHTML=`<strong>${escapeHtml(calendarTypeName(r.entryType))}</strong><span>${r.dutyMinutes?formatDuration(r.dutyMinutes):''}</span>`;
      }
      item.onclick=()=>editCalendarEntry(r.id);
      cell.appendChild(item);
    });
    grid.appendChild(cell);
  }
  const dutyDays=new Set(records.filter(isDutyRecord).map(r=>r.date)).size;
  const offDays=records.filter(r=>r.entryType==='off').length;
  const vacation=records.filter(r=>r.entryType==='vacation').length;
  const sick=records.filter(r=>r.entryType==='sick').length;
  $('calendarDutyDays').textContent=dutyDays;
  $('calendarOffDays').textContent=`${offDays} / 7`;
  $('calendarOffDays').className=offDays>=7?'ok-text':'warn-text';
  $('calendarVacationDays').textContent=vacation;
  $('calendarSickDays').textContent=sick;
}

function statisticsSnapshot(dateString){
  const anchor=dateToUtcNoon(dateString||today());
  const end=anchor+12*3600000;
  const start7=end-7*86400000,start28=end-28*86400000;
  const y=new Date(anchor).getUTCFullYear(),yearStart=Date.UTC(y,0,1),yearEnd=Date.UTC(y+1,0,1);
  const records=getRecords();
  const r7=records.filter(r=>inDateWindow(r,start7,end));
  const r28=records.filter(r=>inDateWindow(r,start28,end));
  const ry=records.filter(r=>inDateWindow(r,yearStart,yearEnd));
  return {
    anchor,end,start7,start28,yearStart,yearEnd,r7,r28,ry,
    duty7:r7.reduce((s,r)=>s+(r.dutyMinutes||0),0),
    duty28:r28.reduce((s,r)=>s+(r.dutyMinutes||0),0),
    block28:r28.reduce((s,r)=>s+(r.blockMinutes||0),0),
    blockYear:ry.reduce((s,r)=>s+(r.blockMinutes||0),0)
  };
}
function renderStatistics(){
  const s=statisticsSnapshot($('statisticsDate').value||today());
  $('statDuty7Value').textContent=`${formatDuration(s.duty7)} / 60:00 h`;
  $('statDuty28Value').textContent=`${formatDuration(s.duty28)} / 190:00 h`;
  $('statBlock28Value').textContent=`${formatDuration(s.block28)} / 100:00 h`;
  $('statBlockYearValue').textContent=`${formatDuration(s.blockYear)} / 900:00 h`;
  setProgress('statDuty7Bar',s.duty7,3600);setProgress('statDuty28Bar',s.duty28,11400);
  setProgress('statBlock28Bar',s.block28,6000);setProgress('statBlockYearBar',s.blockYear,54000);
  $('statDuty7Period').textContent=`${formatDate(dateStringFromMs(s.start7))}–${formatDate(dateStringFromMs(s.end-86400000))}`;
  $('statDuty28Period').textContent=`${formatDate(dateStringFromMs(s.start28))}–${formatDate(dateStringFromMs(s.end-86400000))}`;
  $('statBlock28Period').textContent=$('statDuty28Period').textContent;
  const year=new Date(s.anchor).getUTCFullYear();$('statBlockYearPeriod').textContent=`01.01.${year}–31.12.${year}`;

  const anchorDate=new Date(s.anchor);
  const monthStart=Date.UTC(anchorDate.getUTCFullYear(),anchorDate.getUTCMonth(),1);
  const monthEnd=Date.UTC(anchorDate.getUTCFullYear(),anchorDate.getUTCMonth()+1,1);
  const monthRecords=getRecords().filter(r=>inDateWindow(r,monthStart,monthEnd));
  const offMonth=uniqueOffDates(monthRecords).length;
  const offYear=uniqueOffDates(s.ry).length;
  const monthLabel=`${pad(anchorDate.getUTCMonth()+1)}/${anchorDate.getUTCFullYear()}`;

  $('statOffMonthValue').textContent=`${offMonth} / 7`;
  $('statOffYearValue').textContent=`${offYear} / 96`;
  $('statOffMonthPeriod').textContent=monthLabel;
  $('statOffYearPeriod').textContent=`01.01.${year}–31.12.${year}`;
  setMinimumProgress('statOffMonthBar',offMonth,7);
  setMinimumProgress('statOffYearBar',offYear,96);

  $('statDutyCount').textContent=s.r28.length;
  const woclRecords=s.r28.filter(r=>(r.woclMinutes||0)>0);
  $('statWoclHours').textContent=formatDuration(woclRecords.reduce((sum,r)=>sum+(r.woclMinutes||0),0));
  $('statWoclCount').textContent=`${woclRecords.length} betroffene Dienste`;
  $('statSpecialCount').textContent=s.r28.filter(r=>(r.specialRule||r.rule||'basic')!=='basic').length;
  $('statMissingBlock').textContent=s.ry.filter(r=>!(r.blockMinutes>0)).length;
  const counts={};
  s.ry.forEach(r=>{const key=r.specialRule||r.rule||'basic';counts[key]=(counts[key]||0)+1});
  const list=$('specialRuleStats');list.innerHTML='';
  const entries=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if(!entries.length){list.innerHTML='<div class="empty">Für dieses Kalenderjahr sind keine Datensätze gespeichert.</div>'}
  else entries.forEach(([rule,count])=>{const row=document.createElement('div');row.className='stats-row';row.innerHTML=`<span>${escapeHtml(ruleName(rule))}</span><strong>${count}</strong>`;list.appendChild(row)});
}
function renderDashboardLimits(){
  const s=statisticsSnapshot(today());
  $('dashDuty7').textContent=`${formatDuration(s.duty7)} / 60:00 h`;
  $('dashDuty28').textContent=`${formatDuration(s.duty28)} / 190:00 h`;
  $('dashBlock28').textContent=`${formatDuration(s.block28)} / 100:00 h`;
  setProgress('dashDuty7Bar',s.duty7,3600);setProgress('dashDuty28Bar',s.duty28,11400);setProgress('dashBlock28Bar',s.block28,6000);
}

function showBackupMessage(text,state=''){const el=$('backupMessage');el.textContent=text;el.className=`backup-message ${state}`}
async function importBackupFile(file){
  try{
    const payload=JSON.parse(await file.text());
    const imported=Array.isArray(payload)?payload:payload.records;
    if(!Array.isArray(imported))throw new Error('Keine Datensatzliste gefunden.');
    if(!imported.every(r=>r&&typeof r==='object'))throw new Error('Ungültige Datensätze.');
    const mode=$('backupImportMode').value;let result;
    if(mode==='replace'){
      if(!confirm(`Vorhandene Daten durch ${imported.length} Datensätze aus dem Backup ersetzen?`))return;
      result=imported;
    }else{
      const existing=getRecords(),map=new Map(existing.map(r=>[r.id,r]));
      imported.forEach(r=>{const id=r.id||`import-${Date.now()}-${Math.random()}`;map.set(id,{...r,id})});result=[...map.values()];
    }
    result.sort((a,b)=>(a.reportUtc||0)-(b.reportUtc||0));setRecords(result);renderArchive();renderDashboard();renderStatistics();renderCalendar();showBackupMessage(`${imported.length} Datensätze erfolgreich importiert.`, 'ok');
  }catch(e){showBackupMessage(`Import fehlgeschlagen: ${e.message}`,'danger')}
}
function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportCSV(){
  const month=$('monthFilter').value,rs=getRecords().filter(r=>isDutyRecord(r)&&r.date&&r.date.startsWith(month));if(!rs.length)return alert('Keine Duty-Datensätze in diesem Monat.');
  const rows=[['Datum','Flug','Start','Ziel','Home Base','Report UTC','ON-Block UTC','Dienstende UTC','FDP Min','Block Min','Sonderregel','Limit Min','Duty Min','Ruhezeit Min','Frühestes Reporting UTC','Status','Notiz'],...rs.map(r=>[r.date,r.flightRef,r.depCode,r.arrCode,r.homeCode,new Date(r.reportUtc).toISOString(),new Date(r.onUtc).toISOString(),new Date(r.dutyEnd).toISOString(),r.plannedFdp,r.blockMinutes||0,ruleName(r.specialRule||r.rule||'basic'),r.limit,r.dutyMinutes,r.minimumRest,new Date(r.earliestNextReport).toISOString(),r.status,r.notes])];
  const csv='\ufeff'+rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\r\n');downloadBlob(new Blob([csv],{type:'text/csv;charset=utf-8'}),`FTL_${month}.csv`)
}
function pdfEscape(s){return String(s??'').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[\\()]/g,m=>'\\'+m).replace(/[\r\n]+/g,' ')}
function exportPDF(){
  const month=$('monthFilter').value,rs=getRecords().filter(r=>isDutyRecord(r)&&r.date&&r.date.startsWith(month));if(!rs.length)return alert('Keine Duty-Datensätze in diesem Monat.');
  const [y,m]=month.split('-');let lines=[`FTL Monatsübersicht ${m}/${y}`,'FAI OM-A Ch. 7, Issue 5, Rev. 0, 08.11.2024','',`Datensätze: ${rs.length}   FDP gesamt: ${formatDuration(rs.reduce((s,r)=>s+(r.plannedFdp||0),0))}`,''];
  for(const r of rs){lines.push(`${formatDate(r.date)}  ${r.depCode}-${r.arrCode}  ${r.flightRef||''}`);lines.push(`Report ${formatUtc(r.reportUtc)}   ON-Block ${formatUtc(r.onUtc)}`);lines.push(`Dienstende ${formatUtc(r.dutyEnd)}   Regel: ${ruleName(r.specialRule||r.rule||'basic')}`);lines.push(`FDP ${formatDuration(r.plannedFdp)}  Block ${r.blockMinutes?formatDuration(r.blockMinutes):'-'}  Limit ${formatDuration(r.limit)}  Duty ${formatDuration(r.dutyMinutes)}`);lines.push(`Min. Rest ${formatDuration(r.minimumRest)}  Next report ${formatUtc(r.earliestNextReport)}`);lines.push(`Status: ${r.status}`);if(r.notes)lines.push(`Notiz: ${r.notes}`);lines.push('')}
  const pages=[];while(lines.length)pages.push(lines.splice(0,41));const objs=[];objs[1]='<< /Type /Catalog /Pages 2 0 R >>';const kids=[];let obj=3;
  pages.forEach((page,i)=>{const po=obj++,co=obj++;kids.push(`${po} 0 R`);objs[po]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${3+pages.length*2} 0 R >> >> /Contents ${co} 0 R >>`;let yPos=805,c='BT\n/F1 10 Tf\n';page.forEach((line,j)=>{const size=j===0&&i===0?16:10;c+=`/F1 ${size} Tf\n1 0 0 1 40 ${yPos} Tm (${pdfEscape(line)}) Tj\n`;yPos-=j===0&&i===0?26:15});c+='ET';objs[co]=`<< /Length ${c.length} >>\nstream\n${c}\nendstream`});
  const fo=3+pages.length*2;objs[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;objs[fo]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';let pdf='%PDF-1.4\n',offs=[0];for(let i=1;i<=fo;i++){offs[i]=pdf.length;pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`}const xr=pdf.length;pdf+=`xref\n0 ${fo+1}\n0000000000 65535 f \n`;for(let i=1;i<=fo;i++)pdf+=`${String(offs[i]).padStart(10,'0')} 00000 n \n`;pdf+=`trailer\n<< /Size ${fo+1} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`;const bytes=new Uint8Array(pdf.length);for(let i=0;i<pdf.length;i++)bytes[i]=pdf.charCodeAt(i)&255;downloadBlob(new Blob([bytes],{type:'application/pdf'}),`FTL_Monat_${month}.pdf`)
}
function bind(){
  ['reportUtcDate','reportUtcTime'].forEach(id=>$(id).addEventListener('input',()=>{reportInputMode='utc';syncReport('utc');calculate()}));
  ['dutyDate','reportTime'].forEach(id=>$(id).addEventListener('input',()=>{reportInputMode='local';syncReport('local');calculate()}));
  ['onBlockUtcDate','onBlockUtcTime'].forEach(id=>$(id).addEventListener('input',()=>{onBlockInputMode='utc';syncOnBlock('utc');if(!dutyEndManual)setAutoDutyEnd();calculate()}));
  ['onBlockDate','onBlockTime'].forEach(id=>$(id).addEventListener('input',()=>{onBlockInputMode='local';syncOnBlock('local');if(!dutyEndManual)setAutoDutyEnd();calculate()}));
  ['dutyEndUtcDate','dutyEndUtcTime'].forEach(id=>$(id).addEventListener('input',()=>{dutyEndManual=true;dutyEndInputMode='utc';syncDutyEnd('utc');calculate()}));
  ['dutyEndLocalDate','dutyEndLocalTime'].forEach(id=>$(id).addEventListener('input',()=>{dutyEndManual=true;dutyEndInputMode='local';syncDutyEnd('local');calculate()}));
  $('autoDutyEndBtn').onclick=()=>{setAutoDutyEnd();calculate()};
  $('departureIcao').addEventListener('input',()=>{syncReport(reportInputMode);calculate()});$('arrivalIcao').addEventListener('input',()=>{syncOnBlock(onBlockInputMode);syncDutyEnd(dutyEndInputMode);calculate()});
  $('specialRule').addEventListener('change',()=>{updateSpecialFields();calculate()});
  ['homeBaseIcao','flightRef','sectors','positioning','awayOver48','specialMinutes','extensionRestMode','augmentedCrew','standbyFacility','reducedRestMinutes','blockTime','notes'].forEach(id=>$(id).addEventListener('input',calculate));
  $('saveBtn').onclick=saveRecord;$('resetBtn').onclick=resetForm;$('cancelEditBtn').onclick=resetForm;$('monthFilter').onchange=renderArchive;$('archiveSearch').addEventListener('input',renderArchive);$('pdfBtn').onclick=exportPDF;$('csvBtn').onclick=exportCSV;
  $('newDutyBtn').onclick=()=>{resetForm();switchView('entryView')};
  if($('openCalendarBtn'))$('openCalendarBtn').onclick=()=>{switchView('calendarView');renderCalendar()};
  $('calendarMonth').addEventListener('change',renderCalendar);
  $('prevMonthBtn').onclick=()=>{$('calendarMonth').value=monthShift($('calendarMonth').value,-1);renderCalendar()};
  $('nextMonthBtn').onclick=()=>{$('calendarMonth').value=monthShift($('calendarMonth').value,1);renderCalendar()};
  $('newCalendarEntryBtn').onclick=()=>resetCalendarForm($('calendarMonth').value+'-01');
  $('calendarEntryType').addEventListener('change',updateCalendarDurationVisibility);
  $('calendarSelectionMode').addEventListener('change',updateCalendarSelectionMode);
  $('calendarEntryDate').addEventListener('change',()=>{if($('calendarSelectionMode').value==='range'&&!$('calendarEntryEndDate').value)$('calendarEntryEndDate').value=$('calendarEntryDate').value});
  $('saveCalendarEntryBtn').onclick=saveCalendarEntry;
  $('deleteCalendarEntryBtn').onclick=deleteCalendarEntry;$('openArchiveBtn').onclick=()=>{switchView('archiveView');renderArchive()};$('openStatisticsBtn').onclick=()=>{switchView('statisticsView');renderStatistics()};$('statisticsDate').addEventListener('change',renderStatistics);$('archiveBackupBtn').onclick=()=>{switchView('dashboardView');setTimeout(()=>$('backupExportBtn').scrollIntoView({behavior:'smooth',block:'center'}),50)};
  $('backupExportBtn').onclick=exportBackup;$('backupImportBtn').onclick=()=>$('backupFileInput').click();$('backupFileInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importBackupFile(f);e.target.value=''})
  document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{switchView(t.dataset.view);if(t.dataset.view==='archiveView')renderArchive();if(t.dataset.view==='statisticsView')renderStatistics();if(t.dataset.view==='calendarView')renderCalendar()})
}
async function init(){
  bind();updateSpecialFields();setSyncBadge('report','utc');setSyncBadge('onBlock','utc');
  try{const data=await fetch('airports.json').then(r=>{if(!r.ok)throw new Error('airports.json');return r.json()});airports=new Map(data.map(a=>[a.i,a]));calculate()}
  catch(e){showStatus('DATENBANKFEHLER','danger','airports.json konnte nicht geladen werden.')}
  renderArchive();renderDashboard();renderStatistics();renderCalendar()
}
let deferredPrompt;
let swRegistration=null;
let waitingWorker=null;
const CURRENT_APP_VERSION='1.9.4';

function compareVersions(a,b){
  const pa=String(a||'0').split('.').map(n=>parseInt(n,10)||0);
  const pb=String(b||'0').split('.').map(n=>parseInt(n,10)||0);
  const len=Math.max(pa.length,pb.length);
  for(let i=0;i<len;i++){
    const da=pa[i]||0,db=pb[i]||0;
    if(da>db)return 1;
    if(da<db)return -1;
  }
  return 0;
}
function showUpdateStatus(text,mode='info',showApply=false){
  const box=$('updateStatus'),label=$('updateStatusText'),apply=$('applyUpdateBtn');
  box.className=`update-status ${mode}`;
  label.textContent=text;
  apply.classList.toggle('hidden',!showApply);
}
function hideUpdateStatus(){
  $('updateStatus').className='update-status hidden';
  $('applyUpdateBtn').classList.add('hidden');
}
async function fetchRemoteVersion(){
  const response=await fetch(`app-version.json?ts=${Date.now()}`,{cache:'no-store'});
  if(!response.ok)throw new Error('Versionsdatei konnte nicht geladen werden.');
  return response.json();
}
async function checkForAppUpdate(manual=true){
  const button=$('updateBtn');
  if(button){button.disabled=true;button.textContent='Prüfe …'}
  try{
    const remote=await fetchRemoteVersion();
    if(swRegistration)await swRegistration.update();

    if(compareVersions(remote.appVersion,CURRENT_APP_VERSION)>0){
      showUpdateStatus(`Neue Version ${remote.appVersion} verfügbar.`, 'available', true);
    }else if(waitingWorker||swRegistration?.waiting){
      waitingWorker=waitingWorker||swRegistration.waiting;
      showUpdateStatus('Ein Update wurde geladen und kann installiert werden.', 'available', true);
    }else{
      showUpdateStatus(`Version ${CURRENT_APP_VERSION} ist aktuell.`, 'success', false);
      if(manual)setTimeout(hideUpdateStatus,3500);
    }
  }catch(error){
    showUpdateStatus(navigator.onLine?'Update-Prüfung fehlgeschlagen. Bitte später erneut versuchen.':'Keine Internetverbindung. Update-Prüfung nicht möglich.','error',false);
  }finally{
    if(button){button.disabled=false;button.textContent='Update prüfen'}
  }
}
function observeInstallingWorker(worker){
  if(!worker)return;
  worker.addEventListener('statechange',()=>{
    if(worker.state==='installed'&&navigator.serviceWorker.controller){
      waitingWorker=swRegistration?.waiting||worker;
      showUpdateStatus('Ein Update wurde heruntergeladen.', 'available', true);
    }
  });
}
async function applyAppUpdate(){
  waitingWorker=waitingWorker||swRegistration?.waiting;
  if(waitingWorker){
    showUpdateStatus('Update wird installiert …','info',false);
    waitingWorker.postMessage({type:'SKIP_WAITING'});
  }else{
    showUpdateStatus('Update wird vorbereitet …','info',false);
    try{
      if(swRegistration)await swRegistration.update();
      setTimeout(()=>location.reload(),700);
    }catch{
      location.reload();
    }
  }
}


function showOfflineReadyMessage(){
  if(!('serviceWorker' in navigator))return;
  navigator.serviceWorker.ready.then(async registration=>{
    try{
      const cacheNames=await caches.keys();
      const ready=cacheNames.some(name=>name==='ftl-logbook-v1.9.4');
      if(ready&&!navigator.onLine){
        showUpdateStatus('Offline-Modus aktiv. Die App wird aus dem Gerätespeicher geladen.','success',false);
      }
    }catch{}
  });
}
window.addEventListener('online',()=>hideUpdateStatus());
window.addEventListener('offline',()=>showUpdateStatus('Offline-Modus aktiv. Gespeicherte Funktionen bleiben verfügbar.','success',false));

window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredPrompt=e;$('installBtn').hidden=false
});
$('installBtn').onclick=async()=>{
  if(!deferredPrompt)return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt=null;
  $('installBtn').hidden=true
};
$('updateBtn').onclick=()=>checkForAppUpdate(true);
$('applyUpdateBtn').onclick=applyAppUpdate;

if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(window.__ftlReloading)return;
    window.__ftlReloading=true;
    location.reload();
  });

  navigator.serviceWorker.register('service-worker.js').then(reg=>{
    swRegistration=reg;
    if(reg.waiting){
      waitingWorker=reg.waiting;
      showUpdateStatus('Ein Update wurde geladen.', 'available', true);
    }
    reg.addEventListener('updatefound',()=>observeInstallingWorker(reg.installing));
    setTimeout(()=>checkForAppUpdate(false),1800);
  }).catch(()=>showUpdateStatus('Service Worker konnte nicht registriert werden.','error',false));
}
init();
showOfflineReadyMessage();
