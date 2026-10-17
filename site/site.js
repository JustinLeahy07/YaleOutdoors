/* Yale Outdoors site script. Settings live in content.js. */
(function(){
'use strict';
var Y=window.YO||{};
function $(s,r){return (r||document).querySelector(s)}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function pad(n){return String(n).padStart(2,'0')}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
var today=iso(new Date());
function plus(s,n){var d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return iso(d)}
function eachDay(a,b){var o=[],d=new Date(a+'T12:00:00'),e=new Date(b+'T12:00:00'),n=0;while(d<=e&&n<400){o.push(iso(d));d.setDate(d.getDate()+1);n++}return o}
function nDays(a,b){return eachDay(a,b).length}
function money(n){return '$'+(Math.round(n*100)/100).toFixed(2).replace(/\.00$/,'')}
function plural(n,w){return n+' '+w+(n===1?'':'s')}
function yale(e){return /^[^@\s]+@yale\.edu$/i.test(e)}
function anyMail(e){return /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e)}
var MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function niceDate(s){var p=(s||'').split('-');return p.length===3?MON[+p[1]-1]+' '+(+p[2]):s}
function store(k,v){try{if(v===undefined)return sessionStorage.getItem(k);if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v)}catch(e){return null}}

/* ---------- menu ---------- */
var mb=$('#menuBtn'),nv=$('#nav');
if(mb&&nv){mb.addEventListener('click',function(){var o=nv.classList.toggle('open');mb.setAttribute('aria-expanded',o)})}

/* ---------- backend ---------- */
var CONTENT=null;
function api(path){return fetch(Y.API_URL+path).then(function(r){return r.json()})}
function post(obj){return fetch(Y.API_URL,{method:'POST',body:JSON.stringify(obj)}).then(function(r){return r.json()})}

/* ---------- photographs ---------- */
var driveUrl=function(p){return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(p.id)+'&sz=w1600'+(p.v?'&v='+encodeURIComponent(p.v.slice(-8)):'')};
function showPic(slot,src,caption){
  var mat=$('.mat',slot),old=$('img.pic',slot);if(old)old.remove();
  var im=document.createElement('img');im.className='pic';im.alt=slot.dataset.alt||'';im.loading='lazy';im.src=src;mat.insertBefore(im,mat.firstChild);
  slot.classList.add('has');
  var fc=$('figcaption',slot);if(fc&&caption!=null)fc.textContent=caption;
}
function shrink(file,max){return new Promise(function(res,rej){
  var r=new FileReader();r.onerror=rej;
  r.onload=function(){var im=new Image();im.onerror=rej;im.onload=function(){
    var s=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');
    c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.84))};im.src=r.result};
  r.readAsDataURL(file)})}
function initSlots(){
  $$('.slot[data-slot]').forEach(function(slot){
    if(slot.dataset.ready)return;slot.dataset.ready='1';
    var name=slot.dataset.slot,fc=$('figcaption',slot);
    if(fc&&slot.dataset.cap)fc.textContent=slot.dataset.cap;
    var tools=$('.tools',slot);
    if(tools){
      tools.innerHTML='<label class="btn sm">Replace photo<input type="file" accept="image/*"></label>'
        +(slot.classList.contains('round')?'':'<input type="text" class="capin" placeholder="Caption" aria-label="Caption" maxlength="200"><button type="button" class="btn sm" data-cap>Save caption</button>')
        +'<span class="small muted" data-st></span>';
      var st=$('[data-st]',tools);
      $('input[type=file]',tools).addEventListener('change',function(e){
        var f=e.target.files&&e.target.files[0];if(!f)return;
        st.textContent='Working...';
        shrink(f,slot.classList.contains('round')?500:1600).then(function(data){
          var ci=$('.capin',tools),cap=ci?ci.value.trim():'';
          if(!Y.API_URL||!store('yoKey')){showPic(slot,data,cap||null);st.textContent='Shown here only. Connect the backend to save it for everyone.';return}
          post({type:'photo',key:store('yoKey'),slot:name,caption:cap,mime:'image/jpeg',data:data.split(',')[1]}).then(function(r){
            if(r.ok){showPic(slot,data,cap||null);st.textContent='Saved.'}else st.textContent=r.error||'Could not save.';
          }).catch(function(){st.textContent='Could not reach the server.'});
        }).catch(function(){st.textContent='That file would not open as a picture.'});
        e.target.value='';
      });
      var cb=$('[data-cap]',tools);
      if(cb)cb.addEventListener('click',function(){
        var ci=$('.capin',tools),cap=ci.value.trim();
        if(fc)fc.textContent=cap;
        if(!Y.API_URL||!store('yoKey')){st.textContent='Shown here only.';return}
        post({type:'caption',key:store('yoKey'),slot:name,caption:cap}).then(function(r){st.textContent=r.ok?'Saved.':(r.error||'Could not save.')}).catch(function(){st.textContent='Could not reach the server.'});
      });
    }
    if((Y.LOCAL_PHOTOS||[]).indexOf(name)>-1){var local=new Image();local.onload=function(){if(!slot.classList.contains('has'))showPic(slot,'photos/'+name+'.jpg',null)};local.src='photos/'+name+'.jpg'}
  });
}
function applyPhotos(){
  if(!CONTENT||!CONTENT.photos)return;
  $$('.slot[data-slot]').forEach(function(slot){
    var p=CONTENT.photos[slot.dataset.slot];
    if(p&&p.id){showPic(slot,driveUrl(p),p.caption||slot.dataset.cap||'');var ci=$('.capin',slot);if(ci)ci.value=p.caption||''}
  });
}

/* ---------- board login (photo editing) ---------- */
function setEditing(on){
  document.body.classList.toggle('editing',on);
  var bar=$('#editbar');
  if(on&&!bar){
    bar=document.createElement('div');bar.id='editbar';bar.className='editbar';
    bar.innerHTML='<div class="wrap"><span>Board editing is on. Use Replace photo under any picture.'+(Y.API_URL&&store('yoKey')?'':' Preview only: nothing is saved for others.')+'</span><button type="button" id="editOff">Done</button></div>';
    document.body.insertBefore(bar,document.body.firstChild);
    $('#editOff').addEventListener('click',function(){setEditing(false);store('yoKey',null)});
  }
  if(!on&&bar)bar.remove();
}
var gateBtn=$('#gateBtn');
if(gateBtn){
  var gate=$('#gate');
  gateBtn.addEventListener('click',function(e){e.preventDefault();gate.hidden=!gate.hidden;if(!gate.hidden)$('#gateKey').focus()});
  $('#gateForm').addEventListener('submit',function(e){
    e.preventDefault();var key=$('#gateKey').value.trim(),m=$('#gateMsg');
    if(!Y.API_URL){setEditing(true);m.textContent='Preview mode. Nothing is saved until the backend is connected.';return}
    if(!key){m.textContent='Paste the board key.';return}
    m.textContent='Checking...';
    post({type:'checkkey',key:key}).then(function(r){
      if(r.ok){store('yoKey',key);setEditing(true);gate.hidden=true;m.textContent=''}else m.textContent=r.error||'That key is not right.';
    }).catch(function(){m.textContent='Could not reach the server.'});
  });
  if(Y.API_URL&&store('yoKey'))setEditing(true);
}

/* ---------- notice board and trips from the Sheet ---------- */
var CAL_EVENTS=[];
function allEvents(){
  var base=((CONTENT&&CONTENT.events)||[]).concat(CAL_EVENTS),seen={},out=[];
  base.forEach(function(e){var k=e.date+'|'+String(e.title||'').toLowerCase();if(!seen[k]){seen[k]=1;out.push(e)}});
  out=out.filter(function(e){return (e.end||e.date)>=today});
  out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:((a.time||'')<(b.time||'')?-1:1)});
  return out;
}
function rel(e){
  var a=e.date,b=e.end||e.date;
  if(a<=today&&b>=today)return a<today?'Happening now':'Today';
  var n=nDays(today,a)-1;
  if(n===1)return 'Tomorrow';
  if(n<7)return 'In '+n+' days';
  var w=Math.round(n/7);
  return w<=1?'Next week':'In '+w+' weeks';
}
function evMeta(e){return [rel(e)+(e.time?' at '+e.time:''),e.where,e.details].filter(Boolean).join(' \u00b7 ')}
function renderNotice(){
  var host=$('#notice');if(!host)return;
  var evs=allEvents(),items=[];
  evs.slice(0,5).forEach(function(e){
    items.push('<li><span class="d">'+esc(niceDate(e.date))+'</span><div><b>'+(e.link?'<a href="'+esc(e.link)+'">'+esc(e.title)+'</a>':esc(e.title))+'</b><span class="t">'+esc(evMeta(e))+'</span></div></li>');
  });
  var usual=[];
  if(items.length<4){
    var m=new Date().getMonth()+1,nx=m%12+1;
    (Y.USUAL||[]).forEach(function(u){
      if(u.m.indexOf(m)>-1||u.m.indexOf(nx)>-1)usual.push('<li><span class="d">'+(u.m.indexOf(m)>-1?MON[m-1]:MON[nx-1])+'</span><div><b>'+esc(u.t)+'</b><span class="t">'+esc(u.n||'Usually around now')+'</span></div></li>');
    });
  }
  host.innerHTML=items.concat(usual.slice(0,Math.max(0,5-items.length))).join('')||'<li><span class="d"></span><div>Nothing posted yet. The newsletter has the latest.</div></li>';
  var nt=$('#noticeNote');
  if(nt)nt.textContent=items.length?(items.length<5?'Dated items come from the club calendar. Items marked by month are our usual events.':'From the club calendar, soonest first.'):'Items marked by month are our usual events. Real dates go out in the weekly newsletter.';
}
function renderUpcoming(){
  var host=$('#upcoming');if(!host)return;
  var evs=allEvents().slice(0,12);
  host.innerHTML=evs.length?'<ul class="board-list">'+evs.map(function(e){
    return '<li><span class="d">'+esc(niceDate(e.date)+(e.end&&e.end!==e.date?' to '+niceDate(e.end):''))+'</span><div><b>'+(e.link?'<a href="'+esc(e.link)+'">'+esc(e.title)+'</a>':esc(e.title))+'</b><span class="t">'+esc(evMeta(e))+'</span></div></li>';
  }).join('')+'</ul>':'<p class="muted">No dated events are posted yet. The weekly newsletter has the latest, and the usual year is below.</p>';
}
function fetchGcal(){
  var id=(CONTENT&&CONTENT.site&&CONTENT.site.calendarId)||Y.CAL_ID;
  if(!id||!Y.GCAL_KEY)return;
  var url='https://www.googleapis.com/calendar/v3/calendars/'+encodeURIComponent(id)+'/events?singleEvents=true&orderBy=startTime&maxResults=60&timeMin='+encodeURIComponent(new Date().toISOString())+'&key='+encodeURIComponent(Y.GCAL_KEY);
  fetch(url).then(function(r){return r.json()}).then(function(d){
    CAL_EVENTS=(d.items||[]).filter(function(i){return i.status!=='cancelled'&&i.start}).map(function(i){
      var allDay=!!i.start.date,st=allDay?i.start.date:iso(new Date(i.start.dateTime)),en=allDay?plus(i.end.date,-1):iso(new Date(i.end.dateTime));
      return {date:st,end:en<st?st:en,time:allDay?'':new Date(i.start.dateTime).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}).toLowerCase(),
        title:i.summary||'',where:i.location||'',details:String(i.description||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,160),link:'',cal:true};
    }).filter(function(e){return e.title});
    renderNotice();renderUpcoming();
  }).catch(function(e){if(window.console)console.warn('Calendar not loaded',e)});
}
function applyTrips(){
  var t=Object.assign({},Y.TRIPS||{});
  if(CONTENT&&CONTENT.trips)Object.keys(CONTENT.trips).forEach(function(k){t[k]=Object.assign({},t[k]||{},CONTENT.trips[k])});
  Object.keys(t).forEach(function(k){
    var d=t[k],st=$('[data-trip-status="'+k+'"]');
    if(st)st.textContent=d.status||'';
    var ds=$('[data-trip-dates="'+k+'"]');if(ds)ds.textContent=d.dates||'To be announced';
    var de=$('[data-trip-dest="'+k+'"]');if(de)de.textContent=d.destination||'To be announced';
    var ap=$('[data-trip-apply="'+k+'"]');
    if(ap)ap.innerHTML=d.apply?'<a href="'+esc(d.apply)+'">Apply for this trip</a>':'Posted in the newsletter when it opens';
    var nt=$('[data-trip-notes="'+k+'"]');if(nt)nt.textContent=d.notes||'';
  });
}
function applyCalendar(){
  var id=(CONTENT&&CONTENT.site&&CONTENT.site.calendarId)||Y.CAL_ID;
  if(!id)return;
  var tz=encodeURIComponent((Intl.DateTimeFormat().resolvedOptions().timeZone)||'America/New_York');
  var open='https://calendar.google.com/calendar/embed?src='+encodeURIComponent(id)+'&ctz='+tz,add='https://calendar.google.com/calendar/render?cid='+encodeURIComponent(id);
  var hc=$('#homeCal');
  if(hc){var ls=$$('.calstrip a',hc);ls[0].href=open;ls[1].href=add}
  var host=$('#calEmbed');
  if(!host)return;
  host.hidden=false;
  host.innerHTML='<div class="box"><div class="bar">Club calendar</div><div class="calbtns"><a class="btn sm solid" href="'+open+'">Open the calendar</a><a class="btn sm" href="'+add+'">Add it to my Google Calendar</a></div>'
    +(Y.CAL_PUBLIC?'<iframe title="Yale Outdoors calendar" loading="lazy" style="border:0;width:100%;height:520px;display:block" src="'+open+'&mode=AGENDA&showTitle=0&showPrint=0&showTz=0"></iframe>':'')+'</div>';
}
function applyZelle(){
  var z=(CONTENT&&CONTENT.site&&CONTENT.site.zelle)||Y.ZELLE,el=$('#zelle'),cp=$('#copyZelle');
  if(!el)return;
  if(z){el.textContent=z;if(cp)cp.hidden=false}else{el.textContent='Zelle details coming soon';if(cp)cp.hidden=true}
}
function applyMerch(){
  if(CONTENT&&CONTENT.merch&&CONTENT.merch.length){Y.MERCH=CONTENT.merch;buildMerch()}
}
function applyAll(){applyMerch();renderNotice();renderUpcoming();applyTrips();applyCalendar();applyZelle();applyPhotos()}

/* ---------- sending ---------- */
function outbox(host,m,intro){
  var all='To: '+m.to+'\nSubject: '+m.subject+'\n\n'+m.body;
  host.innerHTML='<div class="out" role="status"><h3>'+esc(intro)+'</h3>'
   +'<p>Email this message to <strong>'+esc(m.to.split(',').join(', '))+'</strong>. Nothing is sent until you do.</p>'
   +'<label for="'+host.id+'Text">Message<textarea id="'+host.id+'Text" readonly>'+esc(m.body)+'</textarea></label>'
   +'<div class="row"><button type="button" class="btn solid" data-copy>Copy message</button>'
   +'<a class="btn" href="mailto:'+encodeURIComponent(m.to).replace(/%2C/g,',').replace(/%40/g,'@')+'?subject='+encodeURIComponent(m.subject)+'&body='+encodeURIComponent(m.body)+'">Open in email app</a></div>'
   +'<p class="small muted" data-status></p></div>';
  var ta=$('textarea',host),st=$('[data-status]',host);
  $('[data-copy]',host).addEventListener('click',function(){
    function fb(){ta.focus();ta.select();var ok=false;try{ok=document.execCommand('copy')}catch(e){}st.textContent=ok?'Copied.':'Press and hold the text to copy it.'}
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(all).then(function(){st.textContent='Copied. Paste it into an email to '+m.to.split(',')[0]+'.'},fb);else fb();
  });
  host.scrollIntoView({block:'nearest'});
}
function deliver(host,payload,fallback,intro,doneHtml,onDone){
  if(!Y.API_URL){outbox(host,fallback,intro);return}
  host.innerHTML='<p class="msg">Sending...</p>';
  post(payload).then(function(res){
    if(res&&res.ok){host.innerHTML='<div class="out" role="status">'+doneHtml(res)+'</div>';if(onDone)onDone(res)}
    else{host.innerHTML='<p class="msg" role="alert">'+esc((res&&res.error)||'That did not go through.')+'</p>';if(res&&res.stale)loadInventory()}
  }).catch(function(){outbox(host,fallback,'We couldn’t reach the server. Email it instead.')});
}
function copyBtn(id,getText,label){
  var b=$(id);if(!b)return;
  b.addEventListener('click',function(){
    function done(t){b.textContent=t;setTimeout(function(){b.textContent=label},2200)}
    var t=getText();
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(function(){done('Copied')},function(){done('Select it above')});else done('Select it above');
  });
}
copyBtn('#copyClub',function(){return Y.CLUB},'Copy email');
copyBtn('#copyZelle',function(){return $('#zelle').textContent},'Copy');

/* ---------- Winter School list ---------- */
var wf=$('#wForm');
if(wf)wf.addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('#wName').value.trim(),mail=$('#wMail').value.trim(),msg=$('#wMsg');
  if(!name||!yale(mail)){msg.textContent='Add your name and your Yale email (ending in @yale.edu).';return}
  msg.textContent='';
  var wants=$$('input[name=wWants]:checked').map(function(c){return c.value}),school=$('#wSchool').value;
  var body='Winter School interest\nName: '+name+'\nEmail: '+mail+'\nSchool: '+(school==='grad'?'Graduate or professional school':'Yale College')+'\nInterested in: '+(wants.join(', ')||'Not said')+'\nTopics: '+($('#wTopics').value.trim()||'None')+'\nExperience: '+($('#wExp').value.trim()||'None');
  deliver($('#wOut'),{type:'winterschool',name:name,email:mail,school:school,wants:wants,topics:$('#wTopics').value,experience:$('#wExp').value,website:$('#wHp').value},
    {to:Y.CLUB,subject:'Winter School interest: '+name,body:body},'Your Winter School note is ready',
    function(){return '<h3>You’re on the list</h3><p>We’ll email you when Winter School dates and sign-ups are set.</p>'});
});

/* ---------- Alumni update ---------- */
var af=$('#aForm');
if(af)af.addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('#aName').value.trim(),mail=$('#aMail').value.trim(),msg=$('#aMsg');
  if(!name||!anyMail(mail)){msg.textContent='Add your name and an email we can reach you at.';return}
  msg.textContent='';
  var f={name:name,email:mail,classYear:$('#aYear').value.trim(),role:$('#aRole').value.trim(),note:$('#aNote').value.trim(),fundraising:$('#aFund').checked};
  var body='Alumni update\nName: '+name+'\nEmail: '+mail+'\nClass year: '+(f.classYear||'Not given')+'\nWith YO as: '+(f.role||'Not given')+'\nOkay to hear about alumni fundraising: '+(f.fundraising?'Yes':'No')+'\n\nNote:\n'+(f.note||'None');
  deliver($('#aOut'),Object.assign({type:'alumni',website:$('#aHp').value},f),{to:Y.CLUB,subject:'Alumni update: '+name,body:body},'Your note is ready',
    function(){return '<h3>Thank you</h3><p>We’ve added you to the alumni list. Welcome back.</p>'});
});

/* ---------- Trip report ---------- */
var rf=$('#rForm');
if(rf)rf.addEventListener('submit',function(e){
  e.preventDefault();
  var name=$('#rName').value.trim(),mail=$('#rMail').value.trim(),msg=$('#rMsg');
  var ids=['Destination','Dates','Weather','Leaders','Group','Activity','Transport','Expenses','Route','Maps','High','Diff','Other'];
  var v={};ids.forEach(function(i){v[i]=$('#r'+i).value.trim()});
  if(!name||!yale(mail)){msg.textContent='Add your name and your Yale email (ending in @yale.edu).';return}
  if(!v.Destination||!v.Dates){msg.textContent='Add at least the destination and the dates.';return}
  msg.textContent='';
  var body='YALE OUTDOORS TRIP REPORT\n\nDestination: '+v.Destination+'\nDate(s): '+v.Dates+'\nWeather conditions: '+v.Weather+'\nLeaders: '+v.Leaders+'\nGroup size: '+v.Group+'\nActivity: '+v.Activity+'\nTransportation: '+v.Transport+'\nExpenses: '+v.Expenses+'\n\nRoute description / trail information:\n'+v.Route+'\n\nMaps used: '+v.Maps+'\n\nHighlights:\n'+v.High+'\n\nDifficulties encountered:\n'+v.Diff+'\n\nOther comments:\n'+v.Other+'\n\nSubmitted by '+name+' ('+mail+')';
  deliver($('#rOut'),{type:'tripreport',name:name,email:mail,destination:v.Destination,dates:v.Dates,weather:v.Weather,leaders:v.Leaders,groupSize:v.Group,activity:v.Activity,transport:v.Transport,expenses:v.Expenses,route:v.Route,maps:v.Maps,highlights:v.High,difficulties:v.Diff,comments:v.Other,website:$('#rHp').value},
    {to:Y.CLUB,subject:'Trip report: '+v.Destination,body:body},'Your trip report is ready',
    function(res){return '<h3>Report received</h3><p>Thank you. It is filed as '+esc(res.id)+' and the Expedition Coordinators have a copy.</p>'},
    function(){rf.reset()});
});

/* ---------- Suggest a trip ---------- */
var GEARLIST=function(){return (Y.GEAR||[])};
function buildEq(){var g=$('#eqGrid');if(!g)return;g.innerHTML=GEARLIST().map(function(x,i){return '<label for="eq'+i+'"><input type="number" id="eq'+i+'" min="0" max="50" value="0" inputmode="numeric" data-item="'+esc(x.name)+'">'+esc(x.name)+'</label>'}).join('')}
var sf=$('#sForm'),dateRows=$('#dateRows');
function addDateRow(){
  if($$('.dr',dateRows).length>=4)return;
  var n=$$('.dr',dateRows).length+1,row=document.createElement('div');row.className='dr';
  row.innerHTML='<label for="dfrom'+n+'">Start<input type="date" id="dfrom'+n+'" min="'+today+'"></label><label for="dto'+n+'">End, if more than a day<input type="date" id="dto'+n+'" min="'+today+'"></label>'+(n>1?'<button type="button" class="lnk" data-rm>Remove</button>':'<span></span>');
  dateRows.appendChild(row);
}
if(sf){
  buildEq();addDateRow();
  $('#addDate').addEventListener('click',addDateRow);
  dateRows.addEventListener('click',function(e){var b=e.target.closest('[data-rm]');if(b)b.closest('.dr').remove()});
  sf.addEventListener('submit',function(e){
    e.preventDefault();
    var name=$('#sName').value.trim(),mail=$('#sMail').value.trim(),idea=$('#sIdea').value.trim(),msg=$('#sMsg');
    if(!name||!yale(mail)){msg.textContent='Add your name and your Yale email (ending in @yale.edu).';return}
    if(idea.length<15){msg.textContent='Tell us a bit more about the idea, at least a sentence or two.';return}
    msg.textContent='';
    var dates=$$('.dr',dateRows).map(function(r){var i=$$('input',r);return {from:i[0].value,to:i[1].value}}).filter(function(d){return d.from});
    var equipment=$$('#eqGrid input').map(function(i){return {item:i.dataset.item,qty:+i.value||0}}).filter(function(x){return x.qty>0});
    var modes=$$('#trModes input:checked').map(function(c){return c.parentNode.textContent.trim()});
    var kind=$('#sKind').value,where=$('#sWhere').value.trim(),school=$('#sSchool').value;
    var dT=dates.map(function(d){return d.from+(d.to&&d.to!==d.from?' to '+d.to:'')}).concat($('#sFlex').checked?['Flexible on dates']:[]).join('; ');
    var eT=equipment.map(function(x){return x.qty+' x '+x.item}).join(', ')+($('#sEqOther').value.trim()?(equipment.length?'; ':'')+'Other: '+$('#sEqOther').value.trim():'');
    var body='From: '+name+' ('+mail+', '+(school==='grad'?'Graduate or professional school':'Yale College')+')\nKind: '+kind+'\nWhere: '+(where||'Open')+'\n\nIdea:\n'+idea
      +'\n\nPossible dates: '+(dT||'None given')+'\nGroup size: '+($('#sGroup').value.trim()||'Not given')+'\nLength: '+$('#sLength').value+'\nExperience needed: '+$('#sExp').value
      +'\n\nEquipment: '+(eT||'None listed')+'\n\nTransportation: '+(modes.join(', ')||'Not specified')+($('#sDrivers').value!==''?'\nPeople who could drive: '+$('#sDrivers').value:'')+($('#sTrip').value.trim()?'\nDetails: '+$('#sTrip').value.trim():'')
      +'\nFees, permits, reservations: '+($('#sCosts').value.trim()||'None given')+'\n\nWould lead it: '+$('#sLead').value+'\nNotes: '+($('#sNotes').value.trim()||'None');
    deliver($('#sOut'),{type:'suggestion',name:name,email:mail,school:school,kind:kind,where:where,idea:idea,dates:dates,flexible:$('#sFlex').checked,groupSize:$('#sGroup').value,length:$('#sLength').value,experience:$('#sExp').value,
        equipment:equipment,equipmentOther:$('#sEqOther').value,transport:{modes:modes,drivers:$('#sDrivers').value,details:$('#sTrip').value},costs:$('#sCosts').value,leading:$('#sLead').value,notes:$('#sNotes').value,website:$('#sHp').value},
      {to:Y.CLUB,subject:'Trip suggestion: '+(where||kind),body:body},'Your suggestion is ready',
      function(res){return '<h3>Thanks, we got it</h3><p>Your idea is '+esc(res.id)+'. We emailed you a copy. The coordinators will reply after they’ve looked at it.</p>'},
      function(){sf.reset();dateRows.innerHTML='';addDateRow()});
  });
}

/* ---------- Gear board and request ---------- */
var lines=[],uid=0,bFrom=$('#bFrom'),bTo=$('#bTo'),BLOCKED=[];
var GRAD=Y.GRAD_MULT||2,MEM=Y.MEM_MULT==null?0.5:Y.MEM_MULT;
function gearBy(n){return GEARLIST().filter(function(g){return g.name===n})[0]}
function free(name,a,b,except){
  var g=gearBy(name);if(!g)return 0;
  var extra=lines.filter(function(l){return l.id!==except&&l.item===name&&l.from&&l.to&&l.to>=l.from}),worst=0;
  eachDay(a,b).forEach(function(d){
    var used=0;
    BLOCKED.forEach(function(x){if(x.item===name&&x.from<=d&&d<=x.to)used+=x.qty});
    extra.forEach(function(x){if(x.from<=d&&d<=x.to)used+=x.qty});
    if(used>worst)worst=used;
  });
  return Math.max(0,g.owned-worst);
}
function buildBoard(){
  var bl=$('#boardList');if(!bl)return;
  bl.innerHTML=GEARLIST().map(function(g,i){
    return '<li class="gi"><div><b>'+esc(g.name)+'</b><span class="free" id="gf'+i+'"></span></div>'
     +'<button type="button" class="btn sm" data-add="'+i+'" id="ga'+i+'">Add</button>'
     +'<div class="meter" aria-hidden="true"><i id="gm'+i+'"></i></div></li>';
  }).join('');
  renderBoard();
}
function renderBoard(){
  if(!bFrom)return;
  var a=bFrom.value,b=bTo.value,ok=a&&b&&b>=a;
  $('#boardMsg').textContent=ok?'Showing '+plural(nDays(a,b),'day')+' of availability.':'Return date must be on or after pickup.';
  GEARLIST().forEach(function(g,i){
    var f=ok?free(g.name,a,b,-1):g.owned,el=$('#gf'+i);if(!el)return;
    el.textContent=f+' of '+g.owned+' free';
    var m=$('#gm'+i);m.style.width=(g.owned?f/g.owned*100:0)+'%';m.className=f<=1?'low':'';
    $('#ga'+i).disabled=!ok||f<1;
  });
}
function priceOf(l){
  var g=gearBy(l.item),school=$('#gSchool').value;
  if(!g||!school)return null;
  var d=nDays(l.from,l.to),full=g.rate*(school==='grad'?GRAD:1)*d*l.qty;
  return {days:d,full:full,pay:$('#gMember').checked?full*MEM:full,dep:g.deposit*l.qty};
}
function renderLines(){
  var box=$('#lines');if(!box)return;
  if(!lines.length)box.innerHTML='<p class="empty-note">Add gear from the board to start your request.</p>';
  else box.innerHTML=lines.map(function(l){
    return '<div class="line" data-id="'+l.id+'"><div class="lh"><b>'+esc(l.item)+'</b><button type="button" class="lnk" data-rm="'+l.id+'">Remove</button></div>'
     +'<div class="lg"><label for="q'+l.id+'">Qty<input type="number" min="1" inputmode="numeric" id="q'+l.id+'" data-f="qty" value="'+l.qty+'"></label>'
     +'<label for="f'+l.id+'">Pickup<input type="date" min="'+today+'" id="f'+l.id+'" data-f="from" value="'+l.from+'"></label>'
     +'<label for="t'+l.id+'">Return<input type="date" min="'+today+'" id="t'+l.id+'" data-f="to" value="'+l.to+'"></label></div>'
     +'<p class="lc" id="c'+l.id+'"></p></div>';
  }).join('');
  calc();
}
function calc(){
  var school=$('#gSchool').value,mem=$('#gMember').checked,rent=0,full=0,dep=0,good=lines.length>0;
  lines.forEach(function(l){
    var el=$('#c'+l.id);if(!el)return;
    if(!l.from||!l.to||l.to<l.from||l.from<today){el.textContent='Check your dates. Return can’t be before pickup.';good=false;return}
    var f=free(l.item,l.from,l.to,l.id);
    if(f<1){el.textContent='None free for these dates.';good=false;return}
    if(l.qty>f){el.textContent='Only '+f+' free for these dates.';good=false;return}
    var p=priceOf(l);
    if(!p){el.textContent='Choose your school above to see the price.';return}
    rent+=p.pay;full+=p.full;dep+=p.dep;
    el.innerHTML=plural(l.qty,'item')+' for '+plural(p.days,'day')+': '+(mem?'<s>'+money(p.full)+'</s> '+money(p.pay)+' member rate':money(p.pay))+' rental plus '+money(p.dep)+' deposit.';
  });
  var s=$('#sum');
  if(!lines.length)s.textContent='Nothing added yet.';
  else if(!school)s.textContent='Choose your school to see your price.';
  else s.innerHTML='<strong>'+money(rent)+'</strong>rental'+(mem?' <s>'+money(full)+'</s> with the member rate, pending our check.':'.')+'<br>Plus '+money(dep)+' refundable deposit.'+(mem?'<br><span class="small muted">If we can’t verify your membership, the standard rate of '+money(full)+' applies.</span>':'');
  renderBoard();
  return {ok:good,rent:rent,full:full,dep:dep};
}
function loadInventory(){
  if(!Y.API_URL)return;
  api('?action=inventory').then(function(d){
    if(!d||!d.ok||!d.items||!d.items.length)return;
    Y.GEAR=d.items;BLOCKED=d.blocked||[];
    if(d.settings){GRAD=d.settings.gradMultiplier||GRAD;MEM=d.settings.memberMultiplier==null?MEM:d.settings.memberMultiplier}
    buildBoard();buildEq();
    lines=lines.filter(function(l){return gearBy(l.item)});renderLines();
  }).catch(function(){});
}
var gf=$('#gForm');
if(gf){
  bFrom.min=today;bTo.min=today;bFrom.value=today;bTo.value=plus(today,2);
  bFrom.addEventListener('change',function(){if(bTo.value<bFrom.value)bTo.value=bFrom.value;renderBoard()});
  bTo.addEventListener('change',renderBoard);
  $('#boardList').addEventListener('click',function(e){
    var b=e.target.closest('[data-add]');if(!b)return;
    var a=bFrom.value,t=bTo.value;if(!a||!t||t<a)return;
    lines.push({id:++uid,item:GEARLIST()[+b.dataset.add].name,qty:1,from:a,to:t});renderLines();
  });
  $('#lines').addEventListener('click',function(e){var b=e.target.closest('[data-rm]');if(!b)return;lines=lines.filter(function(l){return l.id!==+b.dataset.rm});renderLines()});
  $('#lines').addEventListener('input',function(e){
    var el=e.target,row=el.closest('.line');if(!row||!el.dataset.f)return;
    var l=lines.filter(function(x){return x.id===+row.dataset.id})[0];if(!l)return;
    if(el.dataset.f==='qty')l.qty=Math.max(1,parseInt(el.value,10)||1);else l[el.dataset.f]=el.value;calc();
  });
  $('#lines').addEventListener('change',function(e){
    var el=e.target,row=el.closest('.line');if(!row||!el.dataset.f)return;
    var l=lines.filter(function(x){return x.id===+row.dataset.id})[0];if(!l)return;
    if(el.dataset.f==='from'&&l.to<l.from){l.to=l.from;$('#t'+l.id).value=l.to}
    if(l.from&&l.to&&l.to>=l.from){var f=free(l.item,l.from,l.to,l.id);if(f>0&&l.qty>f){l.qty=f;$('#q'+l.id).value=f}}
    calc();
  });
  $('#gMember').addEventListener('change',calc);$('#gSchool').addEventListener('change',calc);
  gf.addEventListener('submit',function(e){
    e.preventDefault();
    var msg=$('#gMsg'),name=$('#gName').value.trim(),mail=$('#gMail').value.trim(),school=$('#gSchool').value,mem=$('#gMember').checked;
    if(!lines.length){msg.textContent='Add at least one item from the gear board.';return}
    if(!name||!yale(mail)){msg.textContent='Add your name and your Yale email (ending in @yale.edu).';return}
    if(!school){msg.textContent='Choose your school so we can work out your price.';return}
    var r=calc();
    if(!r.ok){msg.textContent='Fix the dates or quantities marked above.';return}
    msg.textContent='';
    var items=lines.map(function(l){return '- '+l.qty+' x '+l.item+', '+l.from+' to '+l.to+' ('+plural(nDays(l.from,l.to),'day')+')'}).join('\n');
    var body='Name: '+name+'\nEmail: '+mail+'\nSchool: '+(school==='grad'?'Graduate or professional school':'Yale College')+'\nMember: '+(mem?'Says yes, please verify':'No')+'\n\nItems:\n'+items+'\n\nEstimated rental: '+money(r.rent)+(mem?' (member rate, pending verification)':'')+'\nRefundable deposit: '+money(r.dep)+'\n\nNotes: '+($('#gNote').value.trim()||'None');
    deliver($('#gOut'),{type:'gear',name:name,email:mail,school:school,member:mem,note:$('#gNote').value,website:$('#gHp').value,
        lines:lines.map(function(l){return {item:l.item,qty:l.qty,from:l.from,to:l.to}})},
      {to:[Y.CLUB,Y.GEAR_MGR].filter(Boolean).join(','),subject:'Gear request from '+name,body:body},'Your gear request is ready',
      function(res){return '<h3>Request sent</h3><p>Your request ID is '+esc(res.id)+'. We emailed you a copy. The Gear Manager will approve it by email. Nothing is held for you until then.</p>'},
      function(){lines=[];renderLines();loadInventory()});
  });
  buildBoard();renderLines();loadInventory();
}

/* ---------- Merch ---------- */
var mf=$('#mForm'),mState={};
function buildMerch(){
  var host=$('#mItems');if(!host)return;
  $$('.mrow',host).forEach(function(r){mState[r.dataset.name]={on:$('input[type=checkbox]',r).checked,qty:$('input[type=number]',r).value,size:$('select',r).value}});
  var sizes=Y.MERCH_SIZES||['S','M','L','XL'];
  host.innerHTML=(Y.MERCH||[]).map(function(m,i){
    var st=mState[m.name]||{on:false,qty:'1',size:'M'};
    return '<div class="mrow" data-name="'+esc(m.name)+'" data-price="'+m.price+'"'+(st.on?'':' data-off="1"')+'>'
     +'<label class="nm" for="mc'+i+'"><input type="checkbox" id="mc'+i+'"'+(st.on?' checked':'')+'><span><b>'+esc(m.name)+'</b>$'+m.price+(m.note?' <small>'+esc(m.note)+'</small>':'')+'</span></label>'
     +'<label class="lab" for="mq'+i+'" style="font-size:.7rem">Qty<input type="number" id="mq'+i+'" min="1" max="10" value="'+esc(st.qty)+'" inputmode="numeric"></label>'
     +'<label class="lab" for="ms'+i+'" style="font-size:.7rem">Size<select id="ms'+i+'">'+sizes.map(function(z){return '<option'+(z===st.size?' selected':'')+'>'+z+'</option>'}).join('')+'</select></label></div>';
  }).join('');
  calcMerch();
}
function merchLines(){
  return $$('.mrow',$('#mItems')).filter(function(r){return $('input[type=checkbox]',r).checked}).map(function(r){
    var q=Math.max(1,Math.min(10,parseInt($('input[type=number]',r).value,10)||1));
    return {item:r.dataset.name,qty:q,size:$('select',r).value,price:+r.dataset.price,sub:+r.dataset.price*q};
  });
}
function calcMerch(){
  $$('.mrow',$('#mItems')).forEach(function(r){if($('input[type=checkbox]',r).checked)r.removeAttribute('data-off');else r.setAttribute('data-off','1')});
  var ls=merchLines(),t=ls.reduce(function(a,l){return a+l.sub},0);
  $('#mSum').innerHTML=ls.length?'<strong>'+money(t)+'</strong>total<br><span class="small muted">'+ls.map(function(l){return l.qty+' x '+esc(l.item)+' ('+esc(l.size)+')'}).join('<br>')+'</span>':'Nothing chosen yet.';
  return t;
}
if(mf){
  buildMerch();
  $('#mItems').addEventListener('input',calcMerch);$('#mItems').addEventListener('change',calcMerch);
  mf.addEventListener('submit',function(e){
    e.preventDefault();
    var msg=$('#mMsg'),name=$('#mName').value.trim(),mail=$('#mMail').value.trim(),phone=$('#mPhone').value.trim(),ls=merchLines(),total=calcMerch();
    if(!ls.length){msg.textContent='Choose at least one item.';return}
    if(!name||!yale(mail)){msg.textContent='Add your name and your Yale email (ending in @yale.edu).';return}
    if(!phone){msg.textContent='Add a phone number so we can reach you about pickup.';return}
    msg.textContent='';
    var pay=$('#mPay').value,year=$('#mYear').value.trim(),note=$('#mNote').value.trim();
    var body='Merch order\nName: '+name+'\nEmail: '+mail+'\nPhone: '+phone+'\nClass year: '+(year||'Not given')+'\n\nItems:\n'+ls.map(function(l){return '- '+l.qty+' x '+l.item+', size '+l.size+' ('+money(l.sub)+')'}).join('\n')+'\n\nTotal: '+money(total)+'\nPlans to pay by: '+pay+'\nNote: '+(note||'None');
    deliver($('#mOut'),{type:'merch',name:name,email:mail,phone:phone,year:year,payment:pay,note:note,website:$('#mHp').value,
        items:ls.map(function(l){return {item:l.item,qty:l.qty,size:l.size}})},
      {to:[Y.CLUB,Y.GEAR_MGR].filter(Boolean).join(','),subject:'Merch order from '+name+' ('+money(total)+')',body:body},'Your merch order is ready',
      function(res){return '<h3>Order received</h3><p>Your order is '+esc(res.id)+', total <strong>'+money(res.total)+'</strong>. We emailed you a copy. Please pay by '+esc(Y.MERCH_PAY||'the method you chose')+'. We will email you when the items arrive to set up a pickup.</p>'},
      function(){mState={};$$('input[type=checkbox]',$('#mItems')).forEach(function(c){c.checked=false});calcMerch();mf.reset();buildMerch()});
  });
}

/* ---------- start ---------- */
initSlots();
renderNotice();renderUpcoming();applyTrips();applyCalendar();applyZelle();
if(Y.API_URL){api('?action=content').then(function(d){if(d&&d.ok){CONTENT=d;applyAll()}}).catch(function(){})}
fetchGcal();
})();
