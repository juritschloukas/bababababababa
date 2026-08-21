const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

let state={names:[],validNames:[],duplicates:[],invalid:[],mode:'paste',order:'first',csvPath:null,excelPath:null,outputParent:null,exportPath:null,runDir:null,filters:[]};

const titles={1:['Choose executives','Paste a list, upload a CSV, or select names from Excel.'],2:['Review names','Check duplicates, characters, and the exact submission list.'],3:['Run Copilot','Progress continues through both authenticated Copilot agents.'],4:['Build packages','The local package generator is connected through a defined handoff.'],5:['Save results','Choose where to copy the finished Career Track packages.']};

function showStep(n){$$('.view').forEach(v=>v.classList.remove('active'));$('#view'+n).classList.add('active');$$('.step').forEach(s=>{let k=+s.dataset.step;s.classList.toggle('active',k===n);s.classList.toggle('done',k<n)});$('#pageTitle').textContent=titles[n][0];$('#pageSub').textContent=titles[n][1];}

function splitNames(){return $('#nameBox').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}

function updateCount(){const n=splitNames().length;$('#nameCount').textContent=n+' name'+(n===1?'':'s')}

$('#nameBox').addEventListener('input',updateCount);

$$('.input-tab').forEach(b=>b.onclick=()=>{state.mode=b.dataset.mode;$$('.input-tab').forEach(x=>x.classList.toggle('active',x===b));['paste','csv','excel'].forEach(m=>$('#'+m+'Panel').classList.toggle('hidden',m!==state.mode))});

$$('#nameOrder button').forEach(b=>b.onclick=()=>{state.order=b.dataset.order;$$('#nameOrder button').forEach(x=>x.classList.toggle('active',x===b))});

async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});const j=await r.json();if(!r.ok)throw Error(j.error||r.statusText);return j}

async function chooseFile(kind){return window.pywebview?.api?.choose_input_file(kind)} async function chooseFolder(){return window.pywebview?.api?.choose_folder()}

$('#chooseCsv').onclick=async()=>{state.csvPath=await chooseFile('csv');if(!state.csvPath)return;$('#csvPath').textContent=state.csvPath;try{const p=await api('/api/csv/preview',{path:state.csvPath});if(p.columns.length===1){const j=await api('/api/csv',{path:state.csvPath,column:p.columns[0]});state.names=j.names;$('#nameBox').value=state.names.join('\n');updateCount();$('#csvColumnWrap').classList.add('hidden')}else{$('#csvColumn').innerHTML=p.columns.map(x=>`<option>${esc(x)}</option>`).join('');$('#csvColumnWrap').classList.remove('hidden')}}catch(e){alert(e.message)}};

$('#loadCsv').onclick=async()=>{try{const j=await api('/api/csv',{path:state.csvPath,column:$('#csvColumn').value});state.names=j.names;$('#nameBox').value=state.names.join('\n');updateCount()}catch(e){alert(e.message)}};

$('#chooseExcel').onclick=async()=>{state.excelPath=await chooseFile('excel');if(!state.excelPath)return;$('#excelPath').textContent=state.excelPath;try{const j=await api('/api/excel/sheets',{path:state.excelPath});$('#sheetSelect').innerHTML=j.sheets.map(x=>`<option>${esc(x)}</option>`).join('');$('#excelEmpty').classList.add('hidden');$('#excelLoaded').classList.remove('hidden');await loadSheet()}catch(e){alert(e.message)}};

$('#sheetSelect').onchange=loadSheet;async function loadSheet(){try{const j=await api('/api/excel/preview',{path:state.excelPath,sheet:$('#sheetSelect').value});state.preview=j;state.filters=[];$('#nameColumn').innerHTML=j.columns.map(x=>`<option>${esc(x)}</option>`).join('');renderGrid(j);renderFilters()}catch(e){alert(e.message)}}

function renderGrid(j){$('#excelGrid thead').innerHTML='<tr>'+j.columns.map(c=>`<th>${esc(c)}</th>`).join('')+'</tr>';$('#excelGrid tbody').innerHTML=j.rows.map(r=>'<tr>'+j.columns.map(c=>`<td>${esc(r[c]??'')}</td>`).join('')+'</tr>').join('');$('#rowSummary').textContent=`Showing ${j.rows.length} of ${j.total_rows} rows`}

$('#addFilter').onclick=()=>{state.filters.push({column:state.preview.columns[0],operator:'contains',value:''});renderFilters()};

function renderFilters(){$('#filters').innerHTML=state.filters.map((f,i)=>`<div class="filter-row"><select data-key="column" data-i="${i}">${state.preview.columns.map(c=>`<option ${c===f.column?'selected':''}>${esc(c)}</option>`).join('')}</select><select data-key="operator" data-i="${i}">${['equals','not_equals','contains','starts_with','ends_with','is_blank','is_not_blank'].map(o=>`<option ${o===f.operator?'selected':''} value="${o}">${o.replaceAll('_',' ')}</option>`).join('')}</select><input data-key="value" data-i="${i}" value="${esc(f.value)}"><button data-remove="${i}">×</button></div>`).join('');$$('[data-key]').forEach(x=>x.onchange=()=>state.filters[+x.dataset.i][x.dataset.key]=x.value);$$('[data-remove]').forEach(x=>x.onclick=()=>{state.filters.splice(+x.dataset.remove,1);renderFilters()})}

$('#useFiltered').onclick=async()=>{try{const j=await api('/api/excel/names',{path:state.excelPath,sheet:$('#sheetSelect').value,name_column:$('#nameColumn').value,filters:state.filters});state.names=j.names;$('#nameBox').value=j.names.join('\n');updateCount();showToast(`${j.names.length} names loaded from Excel`)}catch(e){alert(e.message)}};

$('#toReview').onclick=async()=>{state.names=splitNames();if(!state.names.length){alert('Enter or load at least one executive name.');return}try{const j=await api('/api/validate',{names:state.names});Object.assign(state,{validNames:j.valid_names,duplicates:j.duplicates,invalid:j.invalid});renderReview();showStep(2)}catch(e){alert(e.message)}};

function renderReview(){let cards='';if(state.invalid.length)cards+=`<div class="validation-card error"><h3>Unsupported characters must be corrected</h3><p>These names contain non-Latin or unapproved characters. Nothing has been removed or replaced.</p><ul>${state.invalid.map(x=>`<li><b>${esc(x.name)}</b>: ${x.characters.map(c=>`${esc(c.character)} (${c.codepoint})`).join(', ')}</li>`).join('')}</ul></div>`;if(state.duplicates.length)cards+=`<div class="validation-card warning"><h3>Potential duplicate executives</h3><p>Duplicates are case-insensitive and will be submitted once. Review these in case two executives share the same name.</p><ul>${state.duplicates.map(x=>`<li><b>${esc(x.preserved_value)}</b> appeared ${x.occurrences} times</li>`).join('')}</ul></div>`;if(!cards)cards=`<div class="validation-card" style="background:#eff9ec;border:1px solid #bfe2b4"><h3>Names passed validation</h3><p>All entries use approved Latin letters and punctuation.</p></div>`;$('#validationSummary').innerHTML=cards;$('#reviewNames').innerHTML=state.validNames.map((n,i)=>`<div class="name-pill"><b>${esc(n)}</b><span>${i+1}</span></div>`).join('');$('#reviewCount').textContent=state.validNames.length+' ready';$('#startRun').disabled=state.invalid.length>0||!state.validNames.length}

$$('.back').forEach(b=>b.onclick=()=>showStep(+b.dataset.back));

$('#chooseOutput').onclick=async()=>{state.outputParent=await chooseFolder();if(state.outputParent)$('#outputPath').textContent=state.outputParent};

$('#startRun').onclick=async()=>{try{const j=await api('/api/start',{names:state.validNames,output_parent:state.outputParent});if(!j.ok){alert('Correct name validation issues before starting.');return}state.runDir=j.run_dir;$('#runPath').textContent=state.runDir;showStep(3);pollStatus()}catch(e){alert(e.message)}};

let timer;async function pollStatus(){clearTimeout(timer);try{const s=await api('/api/status');renderStatus(s);if(!['failed','awaiting_device'].includes(s.status))timer=setTimeout(pollStatus,1500)}catch(e){timer=setTimeout(pollStatus,2500)}}

const statusMap={browser_starting:['Starting Microsoft Edge','Opening a trusted Microsoft browser session.','browser'],agentstore_opened:['Checking Microsoft sign-in','Looking for the connected Windows account.','browser'],login_required:['Sign-in required','Complete sign-in in the Edge window.','browser'],opening_file_locator:['Opening File Locator','Preparing the executive list.','locator'],waiting_file_locator:['Locating source files','Waiting for valid JSON from Career Track File Locator.','locator'],opening_source_reader:['Opening Source Reader','The File Locator JSON has been saved.','reader'],waiting_source_reader:['Reading source packages','Waiting for valid JSON from Career Track Source Reader.','reader'],agents_complete:['Finalizing Copilot output','Both agent responses are complete.','handoff'],awaiting_device:['Copilot handoff ready','Waiting for the local generator to produce packages.','handoff'],failed:['Automation stopped','Review the error and return to the executive list.','browser']};

function renderStatus(s){$('#railStatus').textContent=s.message||s.status;const m=statusMap[s.status]||[s.message||s.status,'','browser'];$('#runStatus').textContent=m[0];$('#runDetail').textContent=m[1];const order=['browser','locator','reader','handoff'],idx=order.indexOf(m[2]);$$('#timeline>div').forEach((x,i)=>{x.classList.toggle('active',i===idx);x.classList.toggle('done',i<idx)});$('#loginAlert').classList.toggle('hidden',s.status!=='login_required');const isLoginFailure=s.status==='failed'&&!!s.error?.includes('login');if(isLoginFailure)$('#loginAlert').classList.remove('hidden');$('#runError').classList.toggle('hidden',!(s.status==='failed'&&!isLoginFailure));if(s.status==='failed'&&!isLoginFailure)$('#runErrorText').textContent=s.error||'Unknown error';if(s.status==='awaiting_device'){showStep(4);pollDevice()}}

$('#confirmLogin').onclick=async()=>{const j=await api('/api/login/confirm',{});if(!j.ok)$('#loginFailed').classList.remove('hidden');else{$('#loginAlert').classList.add('hidden');$('#loginFailed').classList.add('hidden');pollStatus()}};

$('#restartLogin').onclick=async()=>{const j=await api('/api/login/restart',{});if(j.ok){$('#loginFailed').classList.add('hidden');pollStatus()}};$('#manualLogin').onclick=()=>{$('#loginFailed').classList.add('hidden');$('#loginAlert').classList.remove('hidden')};$('#retryRun').onclick=()=>showStep(1);

let deviceTimer;async function pollDevice(){clearTimeout(deviceTimer);try{const s=await api('/api/status');const files=s.completed_packages||[];if(files.length){renderPackages(files);showStep(5);return}deviceTimer=setTimeout(pollDevice,2200)}catch(e){deviceTimer=setTimeout(pollDevice,3000)}}

function renderPackages(files){state.packages=files;$('#packageCount').textContent=`${files.length} completed file${files.length===1?'':'s'}`;$('#packageList').innerHTML=files.map(p=>{const n=p.split(/[\\/]/).pop();return `<div class="package"><b>${esc(n)}</b><small>${esc(p)}</small></div>`}).join('')}

$('#refreshPackages').onclick=async()=>{const s=await api('/api/status');renderPackages(s.completed_packages||[])};$('#chooseExport').onclick=async()=>{state.exportPath=await chooseFolder();if(state.exportPath){$('#exportPath').textContent=state.exportPath;$('#exportBtn').disabled=false}};$('#exportBtn').onclick=async()=>{const j=await api('/api/export',{destination:state.exportPath});showToast(`${j.copied.length} package file(s) saved`)};$('#newRun').onclick=()=>location.reload();

$('#helpBtn').onclick=()=>{$('#helpModal').classList.remove('hidden');renderHelp()};$('.modal-close').onclick=()=>$('#helpModal').classList.add('hidden');$('#helpModal').onclick=e=>{if(e.target.id==='helpModal')e.currentTarget.classList.add('hidden')};

function renderHelp(){const first=state.order==='first';$('#helpExamples').innerHTML=`<div class="examples"><div class="example"><b>Alternative first name</b><code>${first?'Johnathan "John" Doe':'Doe, Johnathan "John"'}</code></div><div class="example"><b>Previous surname</b><code>${first?'John Doe-Smith "Doe"':'Doe-Smith "Doe", John'}</code></div><div class="example"><b>Both together</b><code>${first?'Johnathan "John" Doe-Smith "Doe"':'Doe-Smith "Doe", Johnathan "John"'}</code></div><div class="example"><b>Punctuation and accents</b><code>Étienne Mary-Ann O'Brien</code></div></div>`}

function showToast(t){$('#toast').textContent=t;$('#toast').classList.remove('hidden');setTimeout(()=>$('#toast').classList.add('hidden'),3000)}function esc(v){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

/*

// Special-name workflow. Square brackets are display-only and removed before submission.

state.customPending=[];state.replaceLineIndex=null;

const customIds=['fPrefix','fFirst','fNick','fMiddle','fSurname','fFormer','fSuffix','fMono'];

const cv=id=>$('#'+id).value.trim();

function currentCustom(){return{prefix:cv('fPrefix'),first:cv('fFirst'),nick:cv('fNick'),middle:cv('fMiddle'),surname:cv('fSurname'),former:cv('fFormer'),suffix:cv('fSuffix'),mono:cv('fMono'),mononymous:$('#mononymous').checked}}

function formatCustom(r,order=state.order){if(r.mononymous)return r.mono;const n=r.nick?`"${r.nick}"`:'';const f=r.former?`"${r.former}"`:'';return order==='last'?[r.surname,f,r.suffix].filter(Boolean).join(' ')+', '+[r.prefix,r.first,n,r.middle].filter(Boolean).join(' '):[r.prefix,r.first,n,r.middle,r.surname,f,r.suffix].filter(Boolean).join(' ')}

function updateCustomPreview(){$('#customPreview').textContent='['+formatCustom(currentCustom())+']'}

customIds.forEach(id=>$('#'+id).addEventListener('input',updateCustomPreview));

$('#mononymous').onchange=()=>{$('#customFields').classList.toggle('hidden',$('#mononymous').checked);$('#monoWrap').classList.toggle('hidden',!$('#mononymous').checked);updateCustomPreview()};

function clearCustom(){customIds.forEach(id=>$('#'+id).value='');$('#mononymous').checked=false;$('#customFields').classList.remove('hidden');$('#monoWrap').classList.add('hidden');updateCustomPreview()}

function openCustom(i=null){state.replaceLineIndex=i;state.customPending=[];$('#customAdded').innerHTML='';clearCustom();$('#customTitle').textContent=i===null?'Add specially formatted executives':'Replace selected executive';$('#customModal').classList.remove('hidden')}

$('#customNameBtn').onclick=()=>openCustom();$('#clearCustom').onclick=clearCustom;

$('#addCustom').onclick=()=>{const r=currentCustom();if(r.mononymous?!r.mono:(!r.first&&!r.surname)){alert('Enter a mononymous name, or at least a first name or surname.');return}state.customPending.push(r);$('#customAdded').innerHTML=state.customPending.map(x=>`<div>[${esc(formatCustom(x))}]</div>`).join('');clearCustom()};

$('#finishCustom').onclick=()=>{if(!state.customPending.length){alert('Add at least one executive.');return}let lines=$('#nameBox').value.split(/\r?\n/);const displays=state.customPending.map(r=>'['+formatCustom(r)+']');if(state.replaceLineIndex!==null)lines.splice(state.replaceLineIndex,1,...displays);else{if(lines.length===1&&!lines[0])lines=[];lines.push(...displays)}$('#nameBox').value=lines.join('\n');updateCount();$('#customModal').classList.add('hidden')};

$('#nameBox').addEventListener('contextmenu',e=>{if(e.currentTarget.selectionStart===e.currentTarget.selectionEnd)return;e.preventDefault();state.contextLine=(e.currentTarget.value.slice(0,e.currentTarget.selectionStart).match(/\n/g)||[]).length;$('#nameMenu').style.left=e.clientX+'px';$('#nameMenu').style.top=e.clientY+'px';$('#nameMenu').classList.remove('hidden')});

document.addEventListener('click',e=>{if(!e.target.closest('#nameMenu'))$('#nameMenu').classList.add('hidden')});$('#replaceCustom').onclick=()=>{$('#nameMenu').classList.add('hidden');openCustom(state.contextLine)};

const baseSplitNames=splitNames;splitNames=function(){return $('#nameBox').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>x.startsWith('[')&&x.endsWith(']')?x.slice(1,-1):x)};

$('#approvedInfo').onclick=()=>$('#charsModal').classList.remove('hidden');$$('[data-close]').forEach(b=>b.onclick=()=>$('#'+b.dataset.close).classList.add('hidden'));

*/
