(()=>{
'use strict';

const VERSION='1.2.0';
const STORE='speedfact-data-v1';
const COMPANY_API='https://recherche-entreprises.api.gouv.fr/search';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const deep=x=>JSON.parse(JSON.stringify(x));
const uid=()=>Date.now()+Math.floor(Math.random()*100000);
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const today=()=>new Date().toISOString().slice(0,10);
const formatDate=s=>s?new Date(s+'T12:00:00').toLocaleDateString('fr-FR'):'';
const eur=v=>Number(v||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
const yes=v=>/^(oui|o|true|1)$/i.test(String(v||''));

function addDays(date,n){if(!date)return'';const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)}
function cleanSiret(v){return String(v||'').replace(/\D/g,'')}
function vatFromSiren(siren){const s=String(siren||'').replace(/\D/g,'');if(s.length!==9)return'';const key=(12+3*(Number(s)%97))%97;return `FR${String(key).padStart(2,'0')}${s}`}
function loadRaw(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return {}}}

const DEFAULT_AUDIT={
  operator:'Fourney Hugues',
  sprayer:'RS20',
  providerName:'Fourney Hugues',
  providerSiret:'44813922000017',
  providerVatNo:'FR00448139220',
  providerApproval:'7000008',
  providerAddress:'70100 Bouhans-et-Feurg',
  providerPhone:'',
  providerEmail:'',
  start:'21:00',
  end:'01:30',
  applicationMode:'Pulvérisation',
  volumeLHa:85,
  pressureBar:2,
  nozzle:'AIXR rouge',
  speedKmh:18,
  boomM:30,
  humidity:'> 85 %',
  wind:'< 12 km/h',
  rain:'Absence de pluie',
  weatherGeneral:'Conditions favorables',
  temperature:'',
  soil:'Parcelle accessible et conditions adaptées',
  preCheck:'Oui',
  materialOk:'Oui',
  ppeWorn:'Oui',
  productProvidedBy:'Client',
  productVerifiedBy:'Client + Fourney Hugues',
  productUseOk:'Oui',
  doseAmmOk:'Oui',
  zntOk:'Oui',
  dreOk:'Oui',
  darOk:'Oui',
  sensitiveZones:'Oui',
  driftOk:'Oui',
  people:'Aucune personne exposée à proximité de la zone traitée',
  pollinators:'Aucune présence particulière signalée',
  residents:'Aucune contrainte particulière signalée',
  neighborCrops:'Cultures voisines identifiées, risque de dérive maîtrisé',
  instructionsOk:'Oui',
  incident:'Aucun',
  incidentActions:'',
  clientInstructions:'Aucune consigne particulière',
  treatmentObservation:'Aucune observation particulière',
  generalComment:'Aucun commentaire',
  preparationPlace:'Chez le client',
  water:'Eau fournie chez le client',
  rinse:'Dilué 3 fois et épandu sur la parcelle',
  cleaning:'Nettoyage adapté à la situation',
  ppeClean:'Oui',
  evpp:'Filière ADIVALOR',
  ppnu:'Aucun PPNU concerné par le chantier',
  waste:'Aucun déchet souillé généré',
  decisionBy:'Client',
  onClientRequest:'Oui',
  providerValidation:'Fourney Hugues — chantier validé',
  completed:'Oui',
  sendMode:'E-mail',
  ephyLabel:'Données E-Phy — Anses'
};

const defaultIssuer=()=>({
  id:uid(),name:'Fourney Hugues',legalName:'FOURNEY HUGUES',address:'',zip:'70100',city:'Bouhans-et-Feurg',
  siret:'44813922000017',vatNo:'FR00448139220',phone:'',email:'',iban:'',bic:'',bank:'',
  paymentTerms:'30 jours fin de mois',approval:'7000008',default:true
});

const defaultDb={
  jobs:[],clients:[],works:['Traitement phytosanitaire','Semis','Fertilisation','Déchaumage','Récolte','Autre travail'],
  settings:{vat:20,defaultIssuerId:null,prices:{},auditDefaults:deep(DEFAULT_AUDIT)},issuers:[],invoices:[],invoiceSeq:1,jobSeq:{}
};

function normalizeParcel(p,commune=''){
  if(typeof p==='string')return {id:uid(),name:p,surface:'',crop:'',commune:commune||'',rpg:'',organic:false,conversion:false};
  return {id:p?.id||uid(),name:p?.name||'',surface:p?.surface??p?.ha??'',crop:p?.crop||'',commune:p?.commune||commune||'',rpg:p?.rpg||'',organic:!!p?.organic,conversion:!!p?.conversion};
}
function normalizeExploitation(e){
  if(typeof e==='string')return {id:uid(),name:e,commune:'',parcels:[]};
  const commune=e?.commune||'';
  return {id:e?.id||uid(),name:e?.name||'',commune,parcels:Array.isArray(e?.parcels)?e.parcels.map(p=>normalizeParcel(p,commune)):[]};
}
function normalizeClient(c){
  if(typeof c==='string')c={name:c};
  return {id:c?.id||uid(),name:c?.name||c?.legalName||'',legalName:c?.legalName||'',address:c?.address||'',zip:c?.zip||'',city:c?.city||'',siret:c?.siret||'',siren:c?.siren||'',vatNo:c?.vatNo||'',phone:c?.phone||'',email:c?.email||'',emails:Array.isArray(c?.emails)?c.emails:[],organicDefault:!!c?.organicDefault,exploitations:Array.isArray(c?.exploitations)?c.exploitations.map(normalizeExploitation):[]};
}
function clientByNameIn(d,name){return (d.clients||[]).find(c=>norm(typeof c==='string'?c:c.name)===norm(name||''))}
function migrate(raw){
  const d={...deep(defaultDb),...raw};
  d.settings={...deep(defaultDb.settings),...(raw.settings||{})};
  d.settings.prices={...(raw.settings?.prices||{})};
  d.settings.auditDefaults={...deep(DEFAULT_AUDIT),...(raw.settings?.auditDefaults||{})};
  d.clients=Array.isArray(d.clients)?d.clients.map(normalizeClient):[];
  d.issuers=Array.isArray(d.issuers)?d.issuers:[];
  d.invoices=Array.isArray(d.invoices)?d.invoices:[];
  d.jobs=Array.isArray(d.jobs)?d.jobs:[];
  d.jobSeq=d.jobSeq&&typeof d.jobSeq==='object'?d.jobSeq:{};
  if(!d.issuers.length){
    const old=raw.settings||{},i=defaultIssuer();
    i.name=old.issuer||i.name;i.legalName=old.issuer||i.legalName;i.siret=old.siret||i.siret;i.approval=old.approval||i.approval;i.address=old.issuerInfo||i.address;
    d.issuers=[i];d.settings.defaultIssuerId=i.id;
  }
  if(!d.settings.defaultIssuerId||!d.issuers.some(i=>String(i.id)===String(d.settings.defaultIssuerId)))d.settings.defaultIssuerId=d.issuers[0]?.id||null;
  d.issuers.forEach(i=>i.default=String(i.id)===String(d.settings.defaultIssuerId));
  d.jobs=d.jobs.map(j=>{
    const billed=!!j.billed||j.status==='billed';
    const hadAudit=!!j.audit&&Object.keys(j.audit).length>0;
    const out={...j,id:j.id||uid(),clientId:j.clientId||clientByNameIn(d,j.client)?.id||null,exploitation:j.exploitation||'',vat:Number(j.vat??d.settings.vat??20),billed,status:billed?'billed':(j.status||'validated'),billable:j.billable!==false,products:Array.isArray(j.products)?j.products:[],audit:hadAudit?j.audit:{},auditLegacy:!!j.phyto&&!hadAudit,clientSmsConfirmedAt:j.clientSmsConfirmedAt||'',sheetEmailConfirmedAt:j.sheetEmailConfirmedAt||'',clientValidationConfirmed:!!j.clientValidationConfirmed};
    return out;
  });
  if(!d.invoiceSeq)d.invoiceSeq=1;
  // Reconstitue les compteurs de fiches à partir des numéros déjà présents.
  d.jobs.forEach(j=>{const m=String(j.sheetNo||'').match(/^(\d{4})-(\d{4})$/);if(m)d.jobSeq[m[1]]=Math.max(Number(d.jobSeq[m[1]]||0),Number(m[2]))});
  return d;
}

let db=migrate(loadRaw());
let wizard=newWizard();
let jobFilter='all';
let currentInvoice=null;
let currentJobPreviewId=null;
let invoiceOrigin='billing';
let editingIssuerId=null;
let editingClientId=null;
let companyResults=[];

function saveDb(){localStorage.setItem(STORE,JSON.stringify(db));renderHome()}
function currentIssuer(){return db.issuers.find(i=>String(i.id)===String(db.settings.defaultIssuerId))||db.issuers[0]||defaultIssuer()}
function clientByName(name){return db.clients.find(c=>norm(c.name)===norm(name||''))}
function clientById(id){return db.clients.find(c=>String(c.id)===String(id))}
function selectedClient(){return wizard.clientId?clientById(wizard.clientId):clientByName(wizard.client)}
function selectedExploitation(){const c=selectedClient();return c?.exploitations?.find(e=>norm(e.name)===norm(wizard.exploitation||''))}
function selectedParcel(){const e=selectedExploitation();return e?.parcels?.find(p=>norm(p.name)===norm(wizard.parcel||''))}
function providerDefaults(){const a={...deep(DEFAULT_AUDIT),...deep(db.settings.auditDefaults||{})},i=currentIssuer();a.providerPhone=a.providerPhone||i.phone||'';a.providerEmail=a.providerEmail||i.email||'';return a}
function newWizard(){return {editingId:null,step:1,work:'',client:'',clientId:null,exploitation:'',parcel:'',parcelId:null,date:today(),ha:'',price:'',vat:Number(db?.settings?.vat||20),commune:'',crop:'',bbch:'',organic:false,conversion:false,rpg:'',location:'',treatmentType:'',target:'',obs:'',products:[],audit:providerDefaults(),billable:true,status:'draft',sheetNo:'',clientValidationConfirmed:false,auditConfirm:false,clientSmsConfirmedAt:'',sheetEmailConfirmedAt:''}}
function isPhyto(w=wizard){return norm(w.work).includes('trait')||norm(w.work).includes('pulver')}
function maxStep(){return isPhyto()?5:2}
function nextSheetNo(date){const y=(date||today()).slice(0,4)||String(new Date().getFullYear());const n=Number(db.jobSeq[y]||0)+1;db.jobSeq[y]=n;return `${y}-${String(n).padStart(4,'0')}`}
function iconFor(work){const n=norm(work);return n.includes('trait')?'🍂':n.includes('sem')?'🌱':n.includes('fert')?'🧴':n.includes('decha')?'⚒':n.includes('recol')||n.includes('moiss')?'🌾':'•••'}
function statusBadge(j){if(j.billed||j.status==='billed')return '<span class="badge">Facturé</span>';if(j.status==='draft')return '<span class="badge draft">Brouillon</span>';if(j.billable===false)return '<span class="badge neutral">Validé</span>';return '<span class="badge open">À facturer</span>'}
function jobRow(j,actions=false){
  return `<div class="job-row"><div class="job-glyph">${iconFor(j.work)}</div><div class="job-main"><b>${esc(j.work)}</b><span>${esc(j.exploitation||j.crop||j.parcel||'')} ${j.ha?'- '+Number(j.ha).toLocaleString('fr-FR',{maximumFractionDigits:2})+' ha':''}</span><small>${formatDate(j.date)} · ${esc(j.client)}${j.parcel?' · '+esc(j.parcel):''}${j.sheetNo?' · '+esc(j.sheetNo):''}</small></div>${actions?`<div class="row-actions"><button title="Voir la fiche" onclick="SpeedFact.viewJob(${j.id})">◉</button><button title="Dupliquer" onclick="SpeedFact.duplicateJob(${j.id})">⧉</button><button title="Modifier" onclick="SpeedFact.editJob(${j.id})">✎</button><button class="danger" title="Supprimer" onclick="SpeedFact.deleteJob(${j.id})">×</button></div>`:statusBadge(j)}</div>`
}
function renderHome(){
  const open=db.jobs.filter(j=>j.status==='validated'&&!j.billed&&j.billable!==false),now=new Date();
  const month=db.jobs.filter(j=>{const d=new Date(j.date+'T12:00:00');return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear()});
  if($('statBillable'))$('statBillable').textContent=open.length;
  if($('statMonth'))$('statMonth').textContent=month.length;
  if($('recentJobs'))$('recentJobs').innerHTML=[...db.jobs].sort((a,b)=>String(b.date).localeCompare(String(a.date))||b.id-a.id).slice(0,4).map(j=>jobRow(j)).join('')||'<div class="job-row"><div class="job-main"><b>Aucun chantier</b><small>Ton prochain chantier apparaîtra ici.</small></div></div>';
}
function show(name){
  document.querySelectorAll('.screen').forEach(x=>x.classList.remove('active'));
  const s=$('screen-'+name);if(s)s.classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.nav===name));
  $('bottomNav')?.classList.toggle('hidden',['invoice','issuers','clients','history','job'].includes(name));window.scrollTo(0,0)
}
function goHome(){show('home');renderHome()}

function applyRememberedPrice(){if(!wizard.clientId||!wizard.work||wizard.price)return;const v=db.settings.prices?.[`${wizard.clientId}|${wizard.work}`];if(v!==undefined)wizard.price=v}
function startJob(){wizard=newWizard();$('jobScreenTitle').textContent='Nouveau chantier';show('job');renderWizard()}
function editJob(id){
  const j=db.jobs.find(x=>x.id===id);if(!j)return;
  wizard={...newWizard(),...deep(j),audit:{...providerDefaults(),...deep(j.audit||{})},editingId:id,step:1,auditConfirm:false};
  if(j.auditLegacy)wizard.auditLegacy=true;
  $('jobScreenTitle').textContent='Modifier chantier';show('job');renderWizard()
}
function duplicateJob(id){
  const j=db.jobs.find(x=>x.id===id);if(!j)return;
  wizard={...newWizard(),...deep(j),id:undefined,editingId:null,date:today(),status:'draft',billed:false,invoiceNo:'',sheetNo:'',products:[],audit:{...providerDefaults(),...deep(j.audit||{})},clientValidationConfirmed:false,auditConfirm:false,clientSmsConfirmedAt:'',sheetEmailConfirmedAt:''};
  wizard.audit.start='21:00';wizard.audit.end='01:30';
  $('jobScreenTitle').textContent='Dupliquer chantier';show('job');renderWizard();alert('Le chantier a été dupliqué. Le mélange a volontairement été vidé : ajoute les produits du nouveau chantier.')
}
function deleteJob(id){const j=db.jobs.find(x=>x.id===id);if(!j||j.billed){alert(j?.billed?'Un chantier déjà facturé ne peut pas être supprimé ici.':'Chantier introuvable.');return}if(confirm('Supprimer définitivement ce chantier ?')){db.jobs=db.jobs.filter(x=>x.id!==id);saveDb();renderJobs()}}

function renderProgress(){const max=maxStep(),parts=[];for(let i=1;i<=max;i++){parts.push(`<span class="dot ${i<=wizard.step?'on':''}"></span>`);if(i<max)parts.push(`<span class="line ${i<wizard.step?'on':''}"></span>`)}$('progress').innerHTML=parts.join('')}
function footer(nextLabel='SUIVANT',fn='SpeedFact.nextStep()'){return `<div class="wizard-footer"><button class="mic-btn" onclick="SpeedFact.voiceStep()">●</button><button class="cta" onclick="${fn}">${nextLabel}</button></div>`}
function inputField(label,id,value='',placeholder='',type='text',step='',auto=false,required=false,note=''){
  return `<div class="field-wrap ${auto?'auto-field':'manual-field'}"><label>${esc(label)}${required?'<b class="required"> *</b>':''}</label><input id="${id}" class="${auto?'auto-input':''}" type="${type}" ${step?`step="${step}"`:''} value="${esc(value)}" placeholder="${esc(placeholder)}" oninput="SpeedFact.syncWizard('${id}',this.value)">${note?`<small>${esc(note)}</small>`:''}</div>`
}
function auditField(label,key,value,placeholder=''){
  return `<div class="field-wrap auto-field"><label>${esc(label)}</label><input class="auto-input" value="${esc(value??'')}" placeholder="${esc(placeholder)}" oninput="SpeedFact.syncAudit('${key}',this.value)"></div>`
}
function clientSuggestions(v){const q=norm(v);return db.clients.filter(c=>!q||norm([c.name,c.legalName,c.city,c.siret].join(' ')).includes(q)).slice(0,8)}
function exploitationNames(){return selectedClient()?.exploitations||[]}
function parcelOptions(){return selectedExploitation()?.parcels||[]}
function renderGeneralStep(){
  const ex=exploitationNames(),parcels=parcelOptions();
  return `<div class="wizard-card"><h3>1. Type de travail</h3><div class="hint">Quel type de travail réalisez-vous ?</div><div class="work-grid">${db.works.map(w=>`<button class="work-tile ${wizard.work===w?'selected':''}" onclick="SpeedFact.chooseWork('${esc(w)}')"><span class="emoji">${iconFor(w)}</span><span>${esc(w)}</span></button>`).join('')}</div></div>
  <div class="wizard-card"><h3>2. Client & parcelle</h3>${inputField('Date du chantier','date',wizard.date,'','date','',true,true)}
  <div class="field-wrap manual-field"><label>Client <b class="required">*</b></label><div class="autocomplete"><input id="client" value="${esc(wizard.client)}" placeholder="Tape le nom du client" oninput="SpeedFact.clientInput(this.value)"><div id="clientSug" class="suggestions hidden"></div></div></div>
  <div class="field-wrap ${wizard.clientId?'auto-field':'manual-field'}"><label>Exploitation</label><input id="exploitation" list="exploitationData" class="${wizard.clientId?'auto-input':''}" value="${esc(wizard.exploitation)}" placeholder="Choisir ou saisir" oninput="SpeedFact.selectExploitation(this.value)"><datalist id="exploitationData">${ex.map(e=>`<option value="${esc(e.name)}"></option>`).join('')}</datalist></div>
  <div class="field-wrap ${parcels.length?'auto-field':'manual-field'}"><label>Parcelle <b class="required">*</b></label><input id="parcel" list="parcelData" class="${parcels.length?'auto-input':''}" value="${esc(wizard.parcel)}" placeholder="Choisir ou saisir" oninput="SpeedFact.selectParcel(this.value)"><datalist id="parcelData">${parcels.map(p=>`<option value="${esc(p.name)}"></option>`).join('')}</datalist></div>
  <div class="field-row">${inputField('Surface (ha)','ha',wizard.ha,'0,00','number','0.01',!!selectedParcel(),true)}${inputField('Commune','commune',wizard.commune,'', 'text','',!!selectedParcel())}</div>
  <details class="billing-details"><summary>Facturation (non affichée sur la fiche chantier)</summary><div class="field-row">${inputField('Tarif HT/ha','price',wizard.price,'','number','0.01',!!wizard.price)}${inputField('TVA (%)','vat',wizard.vat,'20','number','0.1',true)}</div><small>Le tarif reste uniquement dans la facturation.</small></details>
  </div>${footer()}`
}
function renderTreatmentStep(){
  return `<div class="wizard-card"><div class="legend"><span class="legend-green"></span> Vert = prérempli automatiquement · modifiable</div><h3>3. Traitement & localisation</h3>
  <div class="field-row">${inputField('Culture','crop',wizard.crop,'Blé, colza…','text','',!!wizard.crop,true)}${inputField('Stade BBCH','bbch',wizard.bbch,'Seulement si nécessaire')}</div>
  <div class="field-row">${inputField('Type de traitement','treatmentType',wizard.treatmentType,'Désherbage, fongicide…')}${inputField('Cible','target',wizard.target,'Vide si non nécessaire')}</div>
  <label class="toggle-line auto-toggle">Agriculture biologique <input type="checkbox" ${wizard.organic?'checked':''} onchange="SpeedFact.syncBool('organic',this.checked)"></label>
  <label class="toggle-line auto-toggle">Parcelle en conversion AB <input type="checkbox" ${wizard.conversion?'checked':''} onchange="SpeedFact.syncBool('conversion',this.checked)"></label>
  <div class="field-row">${inputField('Référence RPG','rpg',wizard.rpg,'Îlot / parcelle','text','',!!wizard.rpg)}${inputField('Code INSEE ou GPS','location',wizard.location,'')}</div>
  <div class="field-row">${auditField('Heure début','start',wizard.audit.start)}${auditField('Heure fin','end',wizard.audit.end)}</div>
  ${inputField('Température','temperature',wizard.audit.temperature,'Vide par défaut','number','0.1')}
  </div>${footer()}`
}
function productDefaultUnit(p){const units=[...new Set((p.uses||[]).map(u=>u.unit).filter(Boolean))];return units.length===1?units[0]:'L/ha'}
function renderProductsStep(){return `<div class="wizard-card"><div class="catalog-box"><div class="shield">✓</div><div><b>Catalogue E‑Phy</b><small>Données E‑Phy — Anses · produits autorisés</small></div></div><h3>4. Produits / mélange</h3><p class="hint">Le mélange repart toujours vide. Chaque produit doit avoir une dose avant validation.</p><div class="autocomplete"><input id="prodSearch" placeholder="Nom commercial, substance…" oninput="SpeedFact.searchProducts(this.value)"><div id="productSug" class="suggestions hidden"></div></div><div id="mixEditor">${renderMix()}</div></div>${footer()}`}
function renderAuditStep(){
  const a=wizard.audit;
  return `<div class="wizard-card audit-intro"><h3>5. Contrôles chantier</h3><div class="legend"><span class="legend-green"></span> Toutes ces informations sont préremplies. Ouvre seulement ce qui a changé.</div>${wizard.auditLegacy?'<div class="warning-box">Ancienne fiche V1.1 : vérifie les informations avant de la valider au format audit.</div>':''}</div>
  <details class="wizard-card audit-details" open><summary>Matériel & application</summary><div class="field-row">${auditField('Applicateur','operator',a.operator)}${auditField('Pulvérisateur','sprayer',a.sprayer)}</div><div class="field-row">${auditField('Mode d’application','applicationMode',a.applicationMode)}${auditField('Volume bouillie (L/ha)','volumeLHa',a.volumeLHa)}</div><div class="field-row">${auditField('Pression (bar)','pressureBar',a.pressureBar)}${auditField('Buse','nozzle',a.nozzle)}</div><div class="field-row">${auditField('Vitesse (km/h)','speedKmh',a.speedKmh)}${auditField('Largeur rampe (m)','boomM',a.boomM)}</div></details>
  <details class="wizard-card audit-details"><summary>Conditions d’application</summary><div class="field-row">${auditField('Hygrométrie','humidity',a.humidity)}${auditField('Vent','wind',a.wind)}</div>${auditField('Pluie','rain',a.rain)}${auditField('Conditions générales','weatherGeneral',a.weatherGeneral)}${auditField('État parcelle','soil',a.soil)}</details>
  <details class="wizard-card audit-details"><summary>Conformité & sécurité</summary><div class="field-row">${auditField('Vérifications avant traitement','preCheck',a.preCheck)}${auditField('Matériel vérifié et conforme','materialOk',a.materialOk)}</div><div class="field-row">${auditField('EPI adaptés portés','ppeWorn',a.ppeWorn)}${auditField('Produit fourni par','productProvidedBy',a.productProvidedBy)}</div>${auditField('Produit vérifié par','productVerifiedBy',a.productVerifiedBy)}<div class="field-row">${auditField('Produit conforme à l’usage','productUseOk',a.productUseOk)}${auditField('Dose conforme AMM','doseAmmOk',a.doseAmmOk)}</div><div class="field-row">${auditField('ZNT / distances respectées','zntOk',a.zntOk)}${auditField('DRE respecté','dreOk',a.dreOk)}</div><div class="field-row">${auditField('DAR respecté','darOk',a.darOk)}${auditField('Zones sensibles protégées','sensitiveZones',a.sensitiveZones)}</div>${auditField('Conditions limitant la dérive','driftOk',a.driftOk)}${auditField('Personnes à proximité','people',a.people)}${auditField('Pollinisateurs','pollinators',a.pollinators)}${auditField('Riverains / habitations','residents',a.residents)}${auditField('Cultures voisines','neighborCrops',a.neighborCrops)}</details>
  <details class="wizard-card audit-details"><summary>Préparation & fin de chantier</summary><div class="field-row">${auditField('Préparation / remplissage','preparationPlace',a.preparationPlace)}${auditField('Eau utilisée','water',a.water)}</div>${auditField('Fond de cuve / rinçage','rinse',a.rinse)}${auditField('Nettoyage extérieur','cleaning',a.cleaning)}${auditField('EPI nettoyés / entretenus','ppeClean',a.ppeClean)}${auditField('EVPP','evpp',a.evpp)}${auditField('PPNU','ppnu',a.ppnu)}${auditField('Déchets souillés','waste',a.waste)}</details>
  <details class="wizard-card audit-details"><summary>Validation & observations</summary><div class="field-row">${auditField('Chantier conforme aux consignes','instructionsOk',a.instructionsOk)}${auditField('Incident / imprévu','incident',a.incident)}</div>${auditField('Mesures prises si incident','incidentActions',a.incidentActions,'Vide si aucun incident')}${auditField('Consignes particulières client','clientInstructions',a.clientInstructions)}${auditField('Observations traitement','treatmentObservation',a.treatmentObservation)}${auditField('Commentaire général','generalComment',a.generalComment)}${auditField('Décision / choix du traitement','decisionBy',a.decisionBy)}${auditField('Traitement réalisé sur demande client','onClientRequest',a.onClientRequest)}</details>${footer()}`
}
function renderRecapStep(){
  const client=selectedClient(),total=Number(wizard.ha||0)*Number(wizard.audit.volumeLHa||0),vDate=addDays(wizard.date,2),j1=addDays(wizard.date,1);
  return `<div class="wizard-card"><h3>Récapitulatif</h3><div class="summary-list"><div class="summary-line"><span>${iconFor(wizard.work)}</span><b>${esc(wizard.work)}</b></div><div class="summary-line"><span>▣</span><span>${formatDate(wizard.date)}</span></div><div class="summary-line"><span>▤</span><span>${esc(wizard.client)}${wizard.exploitation?' · '+esc(wizard.exploitation):''}</span></div><div class="summary-line"><span>⌖</span><span>Parcelle : ${esc(wizard.parcel||'—')} · ${Number(wizard.ha||0).toLocaleString('fr-FR')} ha</span></div>${isPhyto()?`<div class="summary-line"><span>💧</span><span>${Number(wizard.audit.volumeLHa||0).toLocaleString('fr-FR')} L/ha · volume total calculé ${total.toLocaleString('fr-FR',{maximumFractionDigits:1})} L</span></div>`:''}</div></div>
  ${isPhyto()?`<div class="wizard-card"><h3>Mélange</h3>${wizard.products.map(p=>`<div class="mix-summary"><b>› ${esc(p.name)} <small>AMM ${esc(p.amm)}</small></b><span>${esc(p.dose||'—')} ${esc(p.unit||'')}</span></div>`).join('')||'<p class="muted">Aucun produit.</p>'}</div>
  <div class="wizard-card"><h3>Validation audit</h3><label class="check-line confirm-line"><input type="checkbox" ${wizard.auditConfirm?'checked':''} onchange="SpeedFact.syncBool('auditConfirm',this.checked)"> Je confirme que les valeurs préremplies correspondent réellement à ce chantier.</label><label class="check-line confirm-line"><input type="checkbox" ${wizard.clientValidationConfirmed?'checked':''} onchange="SpeedFact.syncBool('clientValidationConfirmed',this.checked)"> Validation simple du client enregistrée : <b>${esc(client?.name||wizard.client)}</b>.</label><div class="auto-summary"><b>Date de validation prévue / déclarée :</b> ${formatDate(vDate)} (J+2)<br><b>Information SMS client :</b> prévue ${formatDate(j1)} (J+1)<br><b>Envoi fiche par e-mail :</b> prévu ${formatDate(j1)} (J+1)</div><small class="muted">Comme l’envoi automatique n’est pas encore activé, Speed Fact ne marquera jamais un SMS ou un e-mail comme réellement envoyé sans confirmation manuelle.</small></div>`:''}
  <div class="wizard-card"><label class="toggle-line">À facturer <input type="checkbox" ${wizard.billable?'checked':''} onchange="SpeedFact.syncBool('billable',this.checked)"></label><small class="muted">Le tarif reste dans la facturation et n’apparaît pas sur la fiche chantier.</small></div>
  <div class="wizard-card">${inputField('Observations générales du chantier','obs',wizard.obs,'Facultatif')}</div>
  <div class="dual-save"><button class="soft-btn" onclick="SpeedFact.saveJob('draft')">ENREGISTRER BROUILLON</button><button class="cta" onclick="SpeedFact.saveJob('validated')">VALIDER LE CHANTIER</button></div>`
}
function renderWizard(){renderProgress();let html='';if(wizard.step===1)html=renderGeneralStep();else if(wizard.step===2&&isPhyto())html=renderTreatmentStep();else if(wizard.step===3&&isPhyto())html=renderProductsStep();else if(wizard.step===4&&isPhyto())html=renderAuditStep();else html=renderRecapStep();$('wizard').innerHTML=html}
function chooseWork(w){wizard.work=w;applyRememberedPrice();renderWizard()}
function syncWizard(k,v){if(k==='temperature'){wizard.audit.temperature=v;return}wizard[k]=v;if(k==='client'){wizard.clientId=null}if(k==='date'){wizard.date=v}if(k==='price'||k==='vat'||k==='ha')wizard[k]=v}
function syncAudit(k,v){wizard.audit[k]=v}
function syncBool(k,v){wizard[k]=v}
function clientInput(v){wizard.client=v;wizard.clientId=null;const sug=clientSuggestions(v),box=$('clientSug');if(!box)return;box.innerHTML=sug.map(c=>`<button onclick="SpeedFact.pickClient(${c.id})"><b>${esc(c.name)}</b><small>${esc([c.legalName,c.city,c.siret].filter(Boolean).join(' · '))}</small></button>`).join('');box.classList.toggle('hidden',!v||!sug.length)}
function pickClient(id){const c=clientById(id);if(!c)return;wizard.client=c.name;wizard.clientId=c.id;wizard.organic=!!c.organicDefault;if(c.exploitations.length===1)wizard.exploitation=c.exploitations[0].name;applyRememberedPrice();renderWizard()}
function selectExploitation(v){wizard.exploitation=v;const e=selectedExploitation();if(e){wizard.commune=e.commune||wizard.commune;if(e.parcels.length===1){wizard.parcel=e.parcels[0].name;applyParcel(e.parcels[0])}}}
function applyParcel(p){if(!p)return;wizard.parcel=p.name;wizard.parcelId=p.id;wizard.ha=p.surface!==''?p.surface:wizard.ha;wizard.crop=p.crop||wizard.crop;wizard.commune=p.commune||selectedExploitation()?.commune||wizard.commune;wizard.rpg=p.rpg||wizard.rpg;wizard.organic=!!p.organic;wizard.conversion=!!p.conversion}
function selectParcel(v){wizard.parcel=v;const p=parcelOptions().find(x=>norm(x.name)===norm(v));if(p)applyParcel(p)}
function nextStep(){
  if(wizard.step===1&&(!wizard.work||!wizard.client||!Number(wizard.ha))){alert('Indique au minimum le travail, le client et les hectares.');return}
  if(wizard.step===3&&isPhyto()&&!wizard.products.length){alert('Ajoute au moins un produit au mélange. Tu peux enregistrer un brouillon depuis le récapitulatif après avoir ajouté le produit.');return}
  wizard.step++;if(!isPhyto()&&wizard.step>2)wizard.step=2;renderWizard();window.scrollTo(0,0)
}

function levenshtein(a,b){a=norm(a);b=norm(b);let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]!==b[j-1]));prev=cur}return prev[b.length]}
function scoreProduct(p,q){const nq=norm(q),fields=[p.name,p.aliases,p.substances].filter(Boolean).flatMap(x=>String(x).split('|'));let best=99;for(const f of fields){const nf=norm(f);if(nf===nq)return 0;if(nf.startsWith(nq))best=Math.min(best,.2);if(nf.includes(nq))best=Math.min(best,.5);if(nq.length>=4){const pref=nf.slice(0,Math.max(nq.length,Math.min(nf.length,nq.length+3)));best=Math.min(best,1+levenshtein(nq,pref)/Math.max(1,nq.length))}}return best}
function searchProducts(q){const box=$('productSug');if(!q||q.trim().length<2){box?.classList.add('hidden');return}const res=(window.SPEEDFACT_PRODUCTS||[]).map(p=>[p,scoreProduct(p,q)]).filter(x=>x[1]<1.7).sort((a,b)=>a[1]-b[1]).slice(0,12);box.innerHTML=res.map(([p])=>`<button onclick="SpeedFact.addProduct('${esc(p.amm)}')"><b>${esc(p.name)}</b><small>${esc(p.substances||p.functions||'')} · AMM ${esc(p.amm)}</small></button>`).join('')||'<button type="button">Aucun résultat</button>';box.classList.remove('hidden')}
function addProduct(amm){const p=(window.SPEEDFACT_PRODUCTS||[]).find(x=>String(x.amm)===String(amm));if(!p)return;wizard.products.push({name:p.name,amm:p.amm,dose:'',unit:productDefaultUnit(p),target:'',catalog:p});$('productSug')?.classList.add('hidden');if($('prodSearch'))$('prodSearch').value='';if($('mixEditor'))$('mixEditor').innerHTML=renderMix()}
function unitOptions(p){const units=[...new Set([p.unit,...((p.catalog?.uses||[]).map(u=>u.unit))].filter(Boolean))];return (units.length?units:['L/ha','kg/ha','g/ha']).map(u=>`<option ${p.unit===u?'selected':''}>${esc(u)}</option>`).join('')}
function renderMix(){return wizard.products.map((p,i)=>`<div class="mix-row"><div class="mix-head"><div><b>${esc(p.name)}</b><small>AMM ${esc(p.amm)}</small></div><button onclick="SpeedFact.removeProduct(${i})">Retirer</button></div><div class="field-row"><div class="field-wrap manual-field"><label>Dose / ha <b class="required">*</b></label><input type="number" step="0.001" value="${esc(p.dose)}" oninput="SpeedFact.mixChange(${i},'dose',this.value)"></div><div class="field-wrap auto-field"><label>Unité</label><select class="auto-input" onchange="SpeedFact.mixChange(${i},'unit',this.value)">${unitOptions(p)}</select></div></div><label>Cible produit (facultatif)</label><input value="${esc(p.target||'')}" oninput="SpeedFact.mixChange(${i},'target',this.value)"></div>`).join('')||'<p class="muted">Aucun produit dans le mélange.</p>'}
function mixChange(i,k,v){if(wizard.products[i])wizard.products[i][k]=v}
function removeProduct(i){wizard.products.splice(i,1);if($('mixEditor'))$('mixEditor').innerHTML=renderMix()}

function ensureClientFromWizard(){let c=wizard.clientId?clientById(wizard.clientId):clientByName(wizard.client);if(!c){c=normalizeClient({id:uid(),name:wizard.client,exploitations:[]});db.clients.push(c);wizard.clientId=c.id}if(wizard.exploitation&&!c.exploitations.some(e=>norm(e.name)===norm(wizard.exploitation)))c.exploitations.push({id:uid(),name:wizard.exploitation,commune:wizard.commune||'',parcels:[]});const e=c.exploitations.find(x=>norm(x.name)===norm(wizard.exploitation));if(e&&wizard.parcel){let p=e.parcels.find(x=>norm(x.name)===norm(wizard.parcel));if(!p){p=normalizeParcel({name:wizard.parcel,surface:wizard.ha,crop:wizard.crop,commune:wizard.commune,rpg:wizard.rpg,organic:wizard.organic,conversion:wizard.conversion},e.commune);e.parcels.push(p)}else{p.surface=wizard.ha||p.surface;p.crop=wizard.crop||p.crop;p.commune=wizard.commune||p.commune;p.rpg=wizard.rpg||p.rpg;p.organic=!!wizard.organic;p.conversion=!!wizard.conversion}}return c}
function validationErrors(){const errs=[];if(!wizard.work)errs.push('type de travail');if(!wizard.client)errs.push('client');if(!Number(wizard.ha))errs.push('surface');if(isPhyto()){const c=selectedClient()||clientByName(wizard.client);if(!wizard.parcel)errs.push('parcelle');if(!wizard.crop)errs.push('culture');if(!cleanSiret(c?.siret))errs.push('SIRET client');if(!cleanSiret(wizard.audit.providerSiret))errs.push('SIRET prestataire');if(!wizard.audit.providerApproval)errs.push('agrément phyto');if(!wizard.products.length)errs.push('au moins un produit');wizard.products.forEach((p,i)=>{if(!p.amm)errs.push(`AMM produit ${i+1}`);if(!Number(p.dose))errs.push(`dose produit ${i+1}`)});if(!wizard.auditConfirm)errs.push('confirmation des valeurs préremplies');if(!wizard.clientValidationConfirmed)errs.push('validation simple du client')}return errs}
function saveJob(mode='validated'){
  if(mode==='validated'){const errs=validationErrors();if(errs.length){alert('Impossible de valider. À compléter :\n• '+errs.join('\n• '));return}}
  const c=ensureClientFromWizard();
  if(wizard.price!==''&&Number.isFinite(Number(wizard.price))&&wizard.clientId&&wizard.work)db.settings.prices[`${wizard.clientId}|${wizard.work}`]=Number(wizard.price);
  const existing=wizard.editingId?db.jobs.find(j=>j.id===wizard.editingId):null;
  const sheetNo=existing?.sheetNo||wizard.sheetNo||nextSheetNo(wizard.date);
  const audit=deep(wizard.audit);audit.temperature=wizard.audit.temperature||'';
  const job={...deep(wizard),id:wizard.editingId||uid(),sheetNo,client:c.name,clientId:c.id,clientSnapshot:deep(c),ha:Number(wizard.ha),price:Number(wizard.price||0),vat:Number(wizard.vat??db.settings.vat??20),phyto:isPhyto(),status:existing?.billed?'billed':mode,billed:existing?.billed||false,billable:wizard.billable!==false,audit,auditLegacy:false,validationDate:addDays(wizard.date,2),clientInfoDueDate:addDays(wizard.date,1),sheetSendDueDate:addDays(wizard.date,1)};
  delete job.step;delete job.editingId;delete job.auditConfirm;
  if(wizard.editingId){const i=db.jobs.findIndex(j=>j.id===wizard.editingId);if(i>=0)db.jobs[i]={...db.jobs[i],...job}}else db.jobs.push(job);
  saveDb();alert(mode==='draft'?'Brouillon enregistré.':(wizard.editingId?'Chantier modifié et validé.':'Chantier validé.'));goHome()
}

function showJobs(){show('jobs');renderJobs()}
function setJobFilter(f){jobFilter=f;document.querySelectorAll('.segmented button').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));renderJobs()}
function toggleJobFilter(){$('jobFilterBox')?.classList.toggle('hidden');if(!$('jobFilterBox')?.classList.contains('hidden'))$('jobSearch')?.focus()}
function renderJobs(){let q=norm($('jobSearch')?.value||''),arr=[...db.jobs].sort((a,b)=>String(b.date).localeCompare(String(a.date))||b.id-a.id);if(jobFilter==='draft')arr=arr.filter(j=>j.status==='draft');if(jobFilter==='open')arr=arr.filter(j=>j.status==='validated'&&!j.billed&&j.billable!==false);if(jobFilter==='billed')arr=arr.filter(j=>j.billed||j.status==='billed');if(q)arr=arr.filter(j=>norm([j.client,j.exploitation,j.work,j.parcel,j.crop,j.sheetNo].join(' ')).includes(q));const groups={};arr.forEach(j=>{const d=new Date(j.date+'T12:00:00'),k=d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'}).toUpperCase();(groups[k]??=[]).push(j)});$('jobsList').innerHTML=Object.entries(groups).map(([m,js])=>`<div class="month-title">${m}</div>${js.map(j=>jobRow(j,true)).join('')}`).join('')||'<div class="panel">Aucun chantier.</div>'}

function setDocumentToolbar(mode,job=null){const bar=document.querySelector('.invoice-toolbar');if(!bar)return;if(mode==='job'){bar.innerHTML=`<button class="soft-btn" onclick="SpeedFact.backFromDocument()">← Retour</button><button class="soft-btn" onclick="window.print()">PDF / Imprimer</button>${job?.status==='validated'?`<button class="soft-btn" onclick="SpeedFact.confirmSms(${job.id})">SMS ✓</button><button class="cta small-cta" onclick="SpeedFact.confirmSheetEmail(${job.id})">E-mail ✓</button>`:''}`;}else{bar.innerHTML=`<button class="soft-btn" onclick="SpeedFact.backFromInvoice()">← Retour</button><button class="soft-btn" onclick="window.print()">PDF / Imprimer</button><button class="cta small-cta" onclick="SpeedFact.sendInvoice()">ENVOYER</button>`}}
function viewJob(id){const j=db.jobs.find(x=>x.id===id);if(!j)return;currentJobPreviewId=id;invoiceOrigin='jobs';$('invoiceDocument').innerHTML=renderSheetDocument(j);setDocumentToolbar('job',j);show('invoice')}
function backFromDocument(){showJobs()}
function confirmSms(id){const j=db.jobs.find(x=>x.id===id);if(!j)return;if(confirm('Confirmer que le client a réellement été informé par SMS ?')){j.clientSmsConfirmedAt=new Date().toISOString();saveDb();viewJob(id)}}
function confirmSheetEmail(id){const j=db.jobs.find(x=>x.id===id);if(!j)return;if(confirm('Confirmer que la fiche chantier a réellement été envoyée au client par e-mail ?')){j.sheetEmailConfirmedAt=new Date().toISOString();saveDb();viewJob(id)}}

function showBilling(){invoiceOrigin='billing';show('billing');const b=document.querySelector('.bottom-action .cta');if(b)b.textContent='VOIR LA FACTURE';renderBilling()}
function renderBilling(){let input=$('billingClient'),q=norm(input?.value||''),open=db.jobs.filter(j=>j.status==='validated'&&!j.billed&&j.billable!==false),clients=[...new Set(open.map(j=>j.client))];const issuerSel=$('billingIssuer');if(issuerSel){const previous=issuerSel.value;issuerSel.innerHTML=db.issuers.map(i=>`<option value="${i.id}" ${String(i.id)===String(previous||db.settings.defaultIssuerId)?'selected':''}>${esc(i.name)}</option>`).join('')}if(input){const sug=clients.filter(c=>norm(c).includes(q)).slice(0,8),box=$('billingClientSug');box.innerHTML=sug.map(c=>`<button onclick="SpeedFact.pickBillingClient('${esc(c)}')">${esc(c)}</button>`).join('');box.classList.toggle('hidden',!q||!sug.length)}if(q)open=open.filter(j=>norm(j.client).includes(q));$('billingList').innerHTML=open.map(j=>`<label class="bill-card"><input type="checkbox" class="billcheck" value="${j.id}" checked><div><b>${esc(j.work)}</b><div>${Number(j.ha).toLocaleString('fr-FR')} ha · ${formatDate(j.date)}</div><small>${esc(j.client)}${j.exploitation?' · '+esc(j.exploitation):''}${j.parcel?' · '+esc(j.parcel):''} · TVA ${Number(j.vat||0).toLocaleString('fr-FR')}%</small></div><b>${eur(j.ha*j.price)}</b></label>`).join('')||'<div class="panel">Aucun chantier validé à facturer.</div>'}
function pickBillingClient(c){$('billingClient').value=c;$('billingClientSug').classList.add('hidden');renderBilling()}
function snapshotIssuer(i){return deep(i||currentIssuer())}
function snapshotClient(c){return deep(c||normalizeClient({name:''}))}
function createInvoice(){const ids=[...document.querySelectorAll('.billcheck:checked')].map(x=>Number(x.value)),jobs=db.jobs.filter(j=>ids.includes(j.id));if(!jobs.length){alert('Sélectionne au moins un chantier.');return}const clientName=jobs[0].client;if(jobs.some(j=>norm(j.client)!==norm(clientName))){alert('Une facture ne peut contenir qu’un seul client. Filtre d’abord par client.');return}const c=clientById(jobs[0].clientId)||clientByName(clientName),issuer=db.issuers.find(i=>String(i.id)===String($('billingIssuer')?.value))||currentIssuer(),num=`${new Date().getFullYear()}-${String(db.invoiceSeq).padStart(4,'0')}`;currentInvoice={id:uid(),num,date:today(),ids,jobs:deep(jobs),client:clientName,clientSnapshot:snapshotClient(c),issuerId:issuer.id,issuerSnapshot:snapshotIssuer(issuer),status:'draft'};invoiceOrigin='billing';$('invoiceDocument').innerHTML=renderInvoice(currentInvoice);setDocumentToolbar('invoice');show('invoice')}
function totals(inv){const byVat={};inv.jobs.forEach(j=>{const ht=Number(j.ha||0)*Number(j.price||0),v=Number(j.vat||0);if(!byVat[v])byVat[v]={base:0,tax:0};byVat[v].base+=ht;byVat[v].tax+=ht*v/100});const ht=Object.values(byVat).reduce((s,x)=>s+x.base,0),tax=Object.values(byVat).reduce((s,x)=>s+x.tax,0);return {byVat,ht,tax,ttc:ht+tax}}
function addressHtml(x){return [x.legalName&&x.legalName!==x.name?x.legalName:'',x.address,[x.zip,x.city].filter(Boolean).join(' ')].filter(Boolean).map(esc).join('<br>')}
function renderInvoice(inv){const i=inv.issuerSnapshot||currentIssuer(),c=inv.clientSnapshot||clientByName(inv.client)||{},t=totals(inv),vatRows=Object.entries(t.byVat).sort((a,b)=>Number(b[0])-Number(a[0])).map(([v,x])=>`<tr><td>${Number(v).toLocaleString('fr-FR')} %</td><td>${eur(x.base)}</td><td>${eur(x.tax)}</td></tr>`).join('');return `<article class="invoice-page"><img class="invoice-watermark" src="assets/mea-logo.png" alt=""><div class="invoice-head"><div class="issuer-brand"><img src="assets/mea-logo.png" alt="Logo MEA"><div><div class="invoice-title">FACTURE</div><b>${esc(i.name||'MEA')}</b><small>${addressHtml(i)}${i.siret?`<br>SIRET : ${esc(i.siret)}`:''}${i.vatNo?`<br>TVA : ${esc(i.vatNo)}`:''}${i.approval?`<br>Agrément phyto : ${esc(i.approval)}`:''}</small></div></div><div class="invoice-meta"><b>N° ${esc(inv.num)}</b><span>${formatDate(inv.date)}</span></div></div><div class="invoice-parties"><div><small>ÉMETTEUR</small><b>${esc(i.name||'MEA')}</b><p>${addressHtml(i)}</p>${i.phone?`<p>${esc(i.phone)}</p>`:''}${i.email?`<p>${esc(i.email)}</p>`:''}</div><div><small>CLIENT</small><b>${esc(c.name||inv.client)}</b><p>${addressHtml(c)}</p>${c.siret?`<p>SIRET : ${esc(c.siret)}</p>`:''}${c.vatNo?`<p>TVA : ${esc(c.vatNo)}</p>`:''}</div></div><table class="invoice-table"><thead><tr><th>Date / exploitation</th><th>Prestation</th><th>Qté</th><th>PU HT</th><th>TVA</th><th>Total HT</th></tr></thead><tbody>${inv.jobs.map(j=>`<tr><td>${formatDate(j.date)}<br><small>${esc(j.exploitation||'')}${j.parcel?` · ${esc(j.parcel)}`:''}</small></td><td>${esc(j.work)}</td><td>${Number(j.ha).toLocaleString('fr-FR')} ha</td><td>${eur(j.price)}</td><td>${Number(j.vat||0).toLocaleString('fr-FR')} %</td><td>${eur(j.ha*j.price)}</td></tr>`).join('')}</tbody></table><div class="invoice-bottom"><div><div class="vat-box"><b>RÉCAPITULATIF TVA</b><table><thead><tr><th>Taux</th><th>Base HT</th><th>TVA</th></tr></thead><tbody>${vatRows}</tbody></table></div><div class="payment-box"><b>CONDITIONS DE RÈGLEMENT</b><p>${esc(i.paymentTerms||'')}</p>${i.iban?`<p><b>IBAN :</b> ${esc(i.iban)}${i.bic?` · <b>BIC :</b> ${esc(i.bic)}`:''}</p>`:''}${i.bank?`<p>${esc(i.bank)}</p>`:''}</div></div><div class="invoice-total"><div>Total HT <b>${eur(t.ht)}</b></div><div>Total TVA <b>${eur(t.tax)}</b></div><strong>TOTAL TTC <span>${eur(t.ttc)}</span></strong></div></div><div class="annex-note"><b>ANNEXES</b> · ${inv.jobs.length} fiche${inv.jobs.length>1?'s':''} chantier jointe${inv.jobs.length>1?'s':''} à cette facture.</div><div class="invoice-footer">Merci de votre confiance · Document généré par Speed Fact</div></article>${inv.jobs.map(j=>renderAnnex(j,i)).join('')}`}
function detail(label,value){return `<div><b>${esc(label)}</b><br>${esc(value||'—')}</div>`}
function conformityItem(label,value){return `<div class="audit-item"><span>${esc(label)}</span><b>${esc(value||'—')}</b></div>`}
function renderSheetDocument(j){const issuer=currentIssuer();return renderAnnex(j,issuer,true)}
function renderAnnex(j,issuer,standalone=false){
  const c=j.clientSnapshot||clientById(j.clientId)||clientByName(j.client)||{},a=j.audit||{},legacy=j.phyto&&(!a||!Object.keys(a).length||j.auditLegacy),totalVol=Number(j.ha||0)*Number(a.volumeLHa||0),smsState=j.clientSmsConfirmedAt?`Confirmé le ${new Date(j.clientSmsConfirmedAt).toLocaleString('fr-FR')}`:`À confirmer · prévu ${formatDate(j.clientInfoDueDate||addDays(j.date,1))}`,mailState=j.sheetEmailConfirmedAt?`Confirmé le ${new Date(j.sheetEmailConfirmedAt).toLocaleString('fr-FR')}`:`À confirmer · prévu ${formatDate(j.sheetSendDueDate||addDays(j.date,1))}`;
  return `<article class="annex-page ${standalone?'standalone-sheet':''}"><div class="annex-head"><div class="annex-logo"><img src="assets/mea-logo.png" alt="Logo"><div><b>${esc(a.providerName||issuer.name||'Fourney Hugues')}</b><small>Fiche chantier n° ${esc(j.sheetNo||'—')}</small></div></div><div><b>FICHE CHANTIER</b><br><small>${j.phyto?'Traitement phytosanitaire':'Travaux agricoles'} · ${j.status==='draft'?'BROUILLON':'VALIDÉE'}</small></div></div>${legacy?'<div class="legacy-warning">Ancienne fiche : les informations audit n’avaient pas encore été enregistrées dans Speed Fact V1.1. Ouvre la fiche en modification et valide-la après contrôle pour la compléter.</div>':''}
  <div class="sheet-section"><h3>Client & chantier</h3><div class="annex-grid">${detail('Client',c.legalName||c.name||j.client)}${detail('SIRET client',c.siret)}${detail('Adresse client',[c.address,[c.zip,c.city].filter(Boolean).join(' ')].filter(Boolean).join(', '))}${detail('Téléphone / e-mail',[c.phone,c.email].filter(Boolean).join(' · '))}${detail('Exploitation',j.exploitation)}${detail('Parcelle',j.parcel)}${detail('Commune',j.commune)}${detail('Date',formatDate(j.date))}${detail('Surface',`${Number(j.ha||0).toLocaleString('fr-FR')} ha`)}${j.phyto?detail('Culture',j.crop):''}${j.phyto?detail('Stade BBCH',j.bbch):''}${j.phyto?detail('Statut AB',j.organic?'Oui'+(j.conversion?' · Conversion':''):'Non'):''}${j.phyto?detail('RPG / localisation',j.rpg||j.location):''}</div></div>
  ${j.phyto?`<div class="sheet-section"><h3>Prestataire & application</h3><div class="annex-grid">${detail('Prestataire',a.providerName)}${detail('SIRET prestataire',a.providerSiret)}${detail('TVA',a.providerVatNo)}${detail('Agrément phyto',a.providerApproval)}${detail('Adresse',a.providerAddress)}${detail('Téléphone / e-mail',[a.providerPhone,a.providerEmail].filter(Boolean).join(' · '))}${detail('Applicateur',a.operator)}${detail('Pulvérisateur',a.sprayer)}${detail('Mode d’application',a.applicationMode)}${detail('Horaires',`${a.start||'—'} → ${a.end||'—'} (fin le lendemain si nécessaire)`)}${detail('Volume de bouillie',`${a.volumeLHa||'—'} L/ha`)}${detail('Volume total calculé',`${totalVol.toLocaleString('fr-FR',{maximumFractionDigits:1})} L`)}${detail('Pression',`${a.pressureBar||'—'} bar`)}${detail('Buse',a.nozzle)}${detail('Vitesse',`${a.speedKmh||'—'} km/h`)}${detail('Largeur rampe',`${a.boomM||'—'} m`)}</div></div>
  <div class="sheet-section"><h3>Produits utilisés</h3><table class="annex-prod"><thead><tr><th>Produit officiel</th><th>AMM</th><th>Dose / ha</th><th>Cible</th></tr></thead><tbody>${(j.products||[]).map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.amm)}</td><td>${esc(p.dose)} ${esc(p.unit)}</td><td>${esc(p.target||j.target||'')}</td></tr>`).join('')||'<tr><td colspan="4">Aucun produit enregistré</td></tr>'}</tbody></table><small>${esc(a.ephyLabel||'Données E-Phy — Anses')}</small></div>
  <div class="sheet-section"><h3>Conditions</h3><div class="annex-grid">${detail('Hygrométrie',a.humidity)}${detail('Vent',a.wind)}${detail('Pluie',a.rain)}${detail('Température',a.temperature)}${detail('Conditions générales',a.weatherGeneral)}${detail('État de la parcelle',a.soil)}</div></div>
  <div class="sheet-section"><h3>Contrôles de conformité</h3><div class="audit-grid">${conformityItem('Vérifications avant traitement',a.preCheck)}${conformityItem('Matériel vérifié et conforme',a.materialOk)}${conformityItem('EPI adaptés portés',a.ppeWorn)}${conformityItem('Produit fourni par',a.productProvidedBy)}${conformityItem('Produit vérifié par',a.productVerifiedBy)}${conformityItem('Produit conforme à l’usage',a.productUseOk)}${conformityItem('Dose conforme AMM',a.doseAmmOk)}${conformityItem('ZNT / distances respectées',a.zntOk)}${conformityItem('DRE respecté',a.dreOk)}${conformityItem('DAR respecté',a.darOk)}${conformityItem('Zones sensibles protégées',a.sensitiveZones)}${conformityItem('Conditions limitant la dérive',a.driftOk)}${conformityItem('Personnes exposées',a.people)}${conformityItem('Pollinisateurs',a.pollinators)}${conformityItem('Riverains / habitations',a.residents)}${conformityItem('Cultures voisines',a.neighborCrops)}${conformityItem('Conforme aux consignes',a.instructionsOk)}${conformityItem('Incident / imprévu',a.incident)}</div>${a.incidentActions?`<p><b>Mesures prises :</b> ${esc(a.incidentActions)}</p>`:''}</div>
  <div class="sheet-section"><h3>Préparation, nettoyage & déchets</h3><div class="audit-grid">${conformityItem('Préparation / remplissage',a.preparationPlace)}${conformityItem('Eau utilisée',a.water)}${conformityItem('Fond de cuve / rinçage',a.rinse)}${conformityItem('Nettoyage extérieur',a.cleaning)}${conformityItem('EPI nettoyés / entretenus',a.ppeClean)}${conformityItem('EVPP',a.evpp)}${conformityItem('PPNU',a.ppnu)}${conformityItem('Déchets souillés',a.waste)}</div></div>
  <div class="sheet-section"><h3>Décision, observations & validation</h3><div class="audit-grid">${conformityItem('Décision / choix du traitement',a.decisionBy)}${conformityItem('Traitement sur demande client',a.onClientRequest)}${conformityItem('Consignes particulières client',a.clientInstructions)}${conformityItem('Observations traitement',a.treatmentObservation)}${conformityItem('Commentaire général',a.generalComment)}${conformityItem('Validation prestataire',a.providerValidation)}${conformityItem('Validation client',j.clientValidationConfirmed?`${c.name||j.client} — validé`:`${c.name||j.client} — à confirmer`)}${conformityItem('Date validation',formatDate(j.validationDate||addDays(j.date,2)))}${conformityItem('Client informé par SMS',smsState)}${conformityItem('Fiche envoyée par e-mail',mailState)}${conformityItem('Copie Speed Fact','Oui')}${conformityItem('Archivage électronique','Oui')}</div></div>`:''}
  ${j.obs?`<div class="sheet-section"><p><b>Observations générales :</b> ${esc(j.obs)}</p></div>`:''}<div class="invoice-footer">Document généré par Speed Fact · ${j.phyto?'Données E-Phy — Anses':''}</div></article>`
}
function finalizeInvoice(){if(!currentInvoice)return;const existing=db.invoices.find(x=>x.id===currentInvoice.id);if(!existing){currentInvoice.status='sent';currentInvoice.sentAt=new Date().toISOString();db.invoices.push(deep(currentInvoice));currentInvoice.ids.forEach(id=>{const j=db.jobs.find(x=>x.id===id);if(j){j.billed=true;j.status='billed';j.invoiceNo=currentInvoice.num}});db.invoiceSeq++}else{existing.status='sent';existing.sentAt=existing.sentAt||new Date().toISOString()}saveDb()}
function sendInvoice(){if(!currentInvoice)return;const c=currentInvoice.clientSnapshot||{},emails=[c.email,...(c.emails||[])].filter(Boolean).join(',');if(!emails){alert('Aucune adresse e-mail n’est enregistrée pour ce client. Ajoute-la dans sa fiche client.');return}finalizeInvoice();const subj=encodeURIComponent(`Facture ${currentInvoice.num} - ${currentInvoice.client}`),body=encodeURIComponent(`Bonjour,\n\nVeuillez trouver la facture ${currentInvoice.num} accompagnée de toutes les fiches chantier correspondantes.\n\nCordialement,\n${currentInvoice.issuerSnapshot?.name||'MEA'}`);location.href=`mailto:${encodeURIComponent(emails)}?subject=${subj}&body=${body}`;alert('La facture est enregistrée comme envoyée. Le document à transmettre reste la facture + toutes les fiches chantier. L’ajout automatique de la pièce jointe sera fait plus tard.')}
function backFromInvoice(){invoiceOrigin==='history'?showInvoiceHistory():showBilling()}
function showInvoiceHistory(){invoiceOrigin='history';show('history');renderInvoiceHistory()}
function renderInvoiceHistory(){$('invoiceHistory').innerHTML=[...db.invoices].sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(inv=>{const t=totals(inv);return `<button class="history-card" onclick="SpeedFact.openHistoricInvoice(${inv.id})"><div><b>${esc(inv.num)}</b><span>${esc(inv.client)}</span><small>${formatDate(inv.date)} · ${esc(inv.issuerSnapshot?.name||'')} · Voir la facture</small></div><strong>${eur(t.ttc)}</strong></button>`}).join('')||'<div class="panel">Aucune facture enregistrée.</div>'}
function openHistoricInvoice(id){const inv=db.invoices.find(x=>x.id===id);if(!inv)return;currentInvoice=deep(inv);invoiceOrigin='history';$('invoiceDocument').innerHTML=renderInvoice(currentInvoice);setDocumentToolbar('invoice');show('invoice')}

function openSettings(){show('settings');$('vat').value=db.settings.vat??20;$('catalogStatus').textContent=`${(window.SPEEDFACT_PRODUCTS||[]).length.toLocaleString('fr-FR')} produits autorisés chargés.`;const ver=document.querySelector('#screen-settings input[readonly]');if(ver)ver.value='V1.2';if($('updateStatus'))$('updateStatus').textContent=`Version installée : ${VERSION}`}
function saveSettings(){db.settings.vat=Number($('vat').value)||0;saveDb();alert('Réglages enregistrés.')}
function openIssuers(){show('issuers');editingIssuerId=null;renderIssuerList();$('issuerEditor').innerHTML=''}
function renderIssuerList(){$('issuerList').innerHTML=db.issuers.map(i=>`<div class="master-card"><button class="master-main" onclick="SpeedFact.editIssuer(${i.id})"><b>${esc(i.name)}</b><small>${esc(i.legalName||'')}${i.siret?' · SIRET '+esc(i.siret):''}</small>${String(i.id)===String(db.settings.defaultIssuerId)?'<span class="default-pill">Par défaut</span>':''}</button><button class="danger-btn" onclick="SpeedFact.deleteIssuer(${i.id})">×</button></div>`).join('')||'<div class="panel">Aucune entreprise.</div>'}
function newIssuer(){editingIssuerId='new';renderIssuerEditor(defaultIssuer())}
function editIssuer(id){const i=db.issuers.find(x=>x.id===id);if(!i)return;editingIssuerId=id;renderIssuerEditor(deep(i))}
function renderIssuerEditor(i){$('issuerEditor').innerHTML=`<div class="panel form-stack editor-panel"><h3>${editingIssuerId==='new'?'Nouvelle entreprise':'Modifier l’entreprise'}</h3><label>Nom affiché</label><input id="ie-name" value="${esc(i.name)}"><label>Raison sociale</label><input id="ie-legal" value="${esc(i.legalName)}"><label>Adresse</label><input id="ie-address" value="${esc(i.address)}"><div class="field-row"><div><label>Code postal</label><input id="ie-zip" value="${esc(i.zip)}"></div><div><label>Ville</label><input id="ie-city" value="${esc(i.city)}"></div></div><label>SIRET</label><input id="ie-siret" value="${esc(i.siret)}"><label>N° TVA</label><input id="ie-vatno" value="${esc(i.vatNo)}"><div class="field-row"><div><label>Téléphone</label><input id="ie-phone" value="${esc(i.phone)}"></div><div><label>E-mail</label><input id="ie-email" type="email" value="${esc(i.email)}"></div></div><label>N° agrément phyto</label><input id="ie-approval" value="${esc(i.approval)}"><label>IBAN</label><input id="ie-iban" value="${esc(i.iban)}"><div class="field-row"><div><label>BIC</label><input id="ie-bic" value="${esc(i.bic)}"></div><div><label>Banque</label><input id="ie-bank" value="${esc(i.bank)}"></div></div><label>Conditions de règlement</label><input id="ie-terms" value="${esc(i.paymentTerms)}"><label class="check-line"><input id="ie-default" type="checkbox" ${String(i.id)===String(db.settings.defaultIssuerId)||i.default?'checked':''}> Entreprise par défaut</label><button class="cta" onclick="SpeedFact.saveIssuer()">ENREGISTRER</button></div>`;window.scrollTo(0,document.body.scrollHeight)}
function saveIssuer(){const old=editingIssuerId==='new'?defaultIssuer():db.issuers.find(x=>x.id===editingIssuerId);if(!old)return;const i={...old,name:$('ie-name').value.trim()||'Entreprise',legalName:$('ie-legal').value.trim(),address:$('ie-address').value.trim(),zip:$('ie-zip').value.trim(),city:$('ie-city').value.trim(),siret:$('ie-siret').value.trim(),vatNo:$('ie-vatno').value.trim(),phone:$('ie-phone').value.trim(),email:$('ie-email').value.trim(),approval:$('ie-approval').value.trim(),iban:$('ie-iban').value.trim(),bic:$('ie-bic').value.trim(),bank:$('ie-bank').value.trim(),paymentTerms:$('ie-terms').value.trim()};if(editingIssuerId==='new'){i.id=uid();db.issuers.push(i)}else{const idx=db.issuers.findIndex(x=>x.id===editingIssuerId);db.issuers[idx]=i}if($('ie-default').checked||!db.settings.defaultIssuerId)db.settings.defaultIssuerId=i.id;db.issuers.forEach(x=>x.default=String(x.id)===String(db.settings.defaultIssuerId));saveDb();editingIssuerId=null;renderIssuerList();$('issuerEditor').innerHTML='';alert('Entreprise enregistrée.')}
function deleteIssuer(id){if(db.issuers.length<=1){alert('Il faut garder au moins une entreprise émettrice.');return}if(!confirm('Supprimer cette entreprise ? Les anciennes factures conserveront leur copie des coordonnées.'))return;db.issuers=db.issuers.filter(i=>i.id!==id);if(String(db.settings.defaultIssuerId)===String(id))db.settings.defaultIssuerId=db.issuers[0].id;saveDb();renderIssuerList();$('issuerEditor').innerHTML=''}

function openClients(){show('clients');editingClientId=null;renderClientList();$('clientEditor').innerHTML=''}
function renderClientList(){const q=norm($('clientMasterSearch')?.value||''),arr=db.clients.filter(c=>!q||norm([c.name,c.legalName,c.city,c.siret,c.email].join(' ')).includes(q));$('clientMasterList').innerHTML=arr.sort((a,b)=>a.name.localeCompare(b.name,'fr')).map(c=>`<div class="master-card"><button class="master-main" onclick="SpeedFact.editClient(${c.id})"><b>${esc(c.name)}</b><small>${esc([c.legalName,c.city,c.siret,c.email].filter(Boolean).join(' · '))}</small><span>${c.exploitations.length} exploitation${c.exploitations.length>1?'s':''}</span></button><button class="danger-btn" onclick="SpeedFact.deleteClient(${c.id})">×</button></div>`).join('')||'<div class="panel">Aucun client.</div>'}
function newClient(){editingClientId='new';renderClientEditor(normalizeClient({id:uid(),name:'',exploitations:[]}))}
function editClient(id){const c=clientById(id);if(!c)return;editingClientId=id;renderClientEditor(deep(c))}
function parcelLines(c){const out=[];(c.exploitations||[]).forEach(e=>{if(!e.parcels?.length)out.push([e.name,e.commune,'','','','',''].join(' | '));else e.parcels.forEach(p=>out.push([e.name,p.commune||e.commune,p.name,p.surface,p.crop,p.rpg,p.organic?'AB':(p.conversion?'CONVERSION':'NON')].join(' | ')))});return out.join('\n')}
function renderClientEditor(c){
  $('clientEditor').innerHTML=`<div class="panel form-stack editor-panel"><h3>${editingClientId==='new'?'Nouveau client':'Modifier le client'}</h3><div class="company-search"><b>Recherche automatique société</b><div class="search-inline"><input id="companyQuery" placeholder="Nom, SIREN ou SIRET"><button class="soft-btn" onclick="SpeedFact.searchCompany()">RECHERCHER</button></div><div id="companyResults"></div><small>Source : API Recherche d’entreprises / Annuaire des Entreprises. Les données récupérées restent entièrement modifiables.</small></div><label>Nom court / client</label><input id="ce-name" value="${esc(c.name)}"><label>Raison sociale</label><input id="ce-legal" value="${esc(c.legalName)}"><label>Adresse</label><input id="ce-address" value="${esc(c.address)}"><div class="field-row"><div><label>Code postal</label><input id="ce-zip" value="${esc(c.zip)}"></div><div><label>Ville</label><input id="ce-city" value="${esc(c.city)}"></div></div><div class="field-row"><div><label>SIRET</label><input id="ce-siret" value="${esc(c.siret)}"></div><div><label>SIREN</label><input id="ce-siren" value="${esc(c.siren)}"></div></div><label>N° TVA</label><input id="ce-vatno" value="${esc(c.vatNo)}"><div class="field-row"><div><label>Téléphone</label><input id="ce-phone" value="${esc(c.phone)}"></div><div><label>E-mail principal</label><input id="ce-email" type="email" value="${esc(c.email)}"></div></div><label>Autres e-mails (séparés par des virgules)</label><input id="ce-emails" value="${esc((c.emails||[]).join(', '))}"><label class="check-line"><input id="ce-organic" type="checkbox" ${c.organicDefault?'checked':''}> Client / exploitation AB par défaut</label><label>Exploitations & parcelles</label><textarea id="ce-parcels" rows="7" placeholder="Exploitation | Commune | Parcelle | Surface ha | Culture | RPG | AB/NON">${esc(parcelLines(c))}</textarea><small>Une ligne par parcelle. Exemple : Ferme principale | Dijon | Les Grandes Terres | 12.50 | Blé | ILOT 4 / P1 | NON</small><button class="cta" onclick="SpeedFact.saveClient()">ENREGISTRER</button></div>`;window.scrollTo(0,document.body.scrollHeight)
}
async function searchCompany(){const q=$('companyQuery')?.value.trim();if(!q){alert('Tape un nom, un SIREN ou un SIRET.');return}const box=$('companyResults');box.innerHTML='<p class="muted">Recherche…</p>';try{const r=await fetch(`${COMPANY_API}?q=${encodeURIComponent(q)}&page=1&per_page=8`,{headers:{Accept:'application/json'}});if(!r.ok)throw new Error(String(r.status));const data=await r.json();companyResults=(data.results||[]).map(x=>{const s=x.siege||{},siren=x.siren||'',address=s.adresse||[s.numero_voie,s.type_voie,s.libelle_voie].filter(Boolean).join(' ');return {name:x.nom_complet||x.nom_raison_sociale||'',legalName:x.nom_complet||x.nom_raison_sociale||'',siren,siret:s.siret||'',address:address||'',zip:s.code_postal||'',city:s.libelle_commune||'',vatNo:vatFromSiren(siren)}});box.innerHTML=companyResults.map((x,i)=>`<button class="company-result" onclick="SpeedFact.applyCompanyResult(${i})"><b>${esc(x.name)}</b><small>${esc(x.siret)} · ${esc([x.zip,x.city].filter(Boolean).join(' '))}</small></button>`).join('')||'<p class="muted">Aucun résultat.</p>'}catch(e){box.innerHTML='<p class="warning-box">Recherche indisponible. Tu peux toujours remplir la fiche manuellement.</p>'}}
function applyCompanyResult(i){const x=companyResults[i];if(!x)return;$('ce-name').value=x.name;$('ce-legal').value=x.legalName;$('ce-siret').value=x.siret;$('ce-siren').value=x.siren;$('ce-address').value=x.address;$('ce-zip').value=x.zip;$('ce-city').value=x.city;if(!$('ce-vatno').value)$('ce-vatno').value=x.vatNo;$('companyResults').innerHTML='<div class="success-box">Informations récupérées. Modifie librement les champs si nécessaire.</div>'}
function parseParcelLines(s){const exMap=new Map();String(s||'').split(/\n+/).map(x=>x.trim()).filter(Boolean).forEach(line=>{const [exName='',commune='',pName='',surface='',crop='',rpg='',ab='']=line.split('|').map(x=>x.trim());if(!exName)return;const key=norm(exName);if(!exMap.has(key))exMap.set(key,{id:uid(),name:exName,commune,parcels:[]});const e=exMap.get(key);if(!e.commune&&commune)e.commune=commune;if(pName)e.parcels.push(normalizeParcel({name:pName,surface:surface?Number(String(surface).replace(',','.')):'',crop,commune:commune||e.commune,rpg,organic:norm(ab)==='ab'||norm(ab)==='oui',conversion:norm(ab).includes('conversion')},e.commune))});return [...exMap.values()]}
function saveClient(){const old=editingClientId==='new'?normalizeClient({id:uid()}):clientById(editingClientId);if(!old)return;const c={...old,name:$('ce-name').value.trim(),legalName:$('ce-legal').value.trim(),address:$('ce-address').value.trim(),zip:$('ce-zip').value.trim(),city:$('ce-city').value.trim(),siret:$('ce-siret').value.trim(),siren:$('ce-siren').value.trim(),vatNo:$('ce-vatno').value.trim(),phone:$('ce-phone').value.trim(),email:$('ce-email').value.trim(),emails:$('ce-emails').value.split(',').map(x=>x.trim()).filter(Boolean),organicDefault:$('ce-organic').checked,exploitations:parseParcelLines($('ce-parcels').value)};if(!c.name){alert('Indique au moins le nom du client.');return}if(editingClientId==='new'){c.id=uid();db.clients.push(c)}else{const idx=db.clients.findIndex(x=>x.id===editingClientId);db.clients[idx]=c;db.jobs.filter(j=>String(j.clientId)===String(c.id)).forEach(j=>j.client=c.name)}saveDb();editingClientId=null;renderClientList();$('clientEditor').innerHTML='';alert('Fiche client enregistrée.')}
function deleteClient(id){if(db.jobs.some(j=>String(j.clientId)===String(id))){alert('Ce client est lié à des chantiers. Modifie ou supprime d’abord ces chantiers.');return}if(confirm('Supprimer définitivement cette fiche client ?')){db.clients=db.clients.filter(c=>c.id!==id);saveDb();renderClientList();$('clientEditor').innerHTML=''}}

function exportData(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(db,null,2)],{type:'application/json'}));a.download=`speed-fact-sauvegarde-${today()}.json`;a.click();URL.revokeObjectURL(a.href)}
function importData(e){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{db=migrate(JSON.parse(r.result));saveDb();alert('Sauvegarde restaurée.');openSettings()}catch{alert('Fichier de sauvegarde invalide.')}};r.readAsText(f)}
function voiceStep(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert('La reconnaissance vocale n’est pas disponible dans ce navigateur. Tu peux tout saisir au clavier.');return}const r=new SR();r.lang='fr-FR';r.interimResults=false;r.onresult=e=>{const t=e.results[0][0].transcript;if(wizard.step===1){const m=t.match(/(\d+(?:[,.]\d+)?)\s*(?:ha|hectares?)/i);if(m)wizard.ha=m[1].replace(',','.');const w=db.works.find(x=>norm(t).includes(norm(x).slice(0,Math.min(6,norm(x).length))));if(w)wizard.work=w;const c=db.clients.find(x=>norm(t).includes(norm(x.name)));if(c){wizard.client=c.name;wizard.clientId=c.id}else if(!wizard.client)wizard.client=t}else if(wizard.step===2&&isPhyto())wizard.crop=wizard.crop||t;else if(wizard.step===3&&isPhyto()){const p=(window.SPEEDFACT_PRODUCTS||[]).map(x=>[x,scoreProduct(x,t)]).sort((a,b)=>a[1]-b[1])[0];if(p&&p[1]<1.7)wizard.products.push({name:p[0].name,amm:p[0].amm,dose:'',unit:productDefaultUnit(p[0]),target:'',catalog:p[0]})}else wizard.obs=t;renderWizard()};r.start()}

async function checkUpdate(manual=false){try{const r=await fetch(`version.json?ts=${Date.now()}`,{cache:'no-store'}),v=await r.json();if($('updateStatus'))$('updateStatus').textContent=`Version installée : ${VERSION} · version web : ${v.version}`;if(v.version!==VERSION)$('updateBanner')?.classList.remove('hidden');else if(manual)alert('Speed Fact est à jour.')}catch(e){if(manual)alert('Impossible de vérifier la mise à jour pour le moment.')}}
async function applyUpdate(){if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration();if(reg){await reg.update();if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});else if(reg.installing)reg.installing.addEventListener('statechange',()=>{if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'})})}}setTimeout(()=>location.reload(),800)}
function registerSW(){if(!('serviceWorker'in navigator))return;navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{reg.update();reg.addEventListener('updatefound',()=>{const w=reg.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)$('updateBanner')?.classList.remove('hidden')})})}).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload())}

function enhanceStaticUi(){
  const seg=document.querySelector('#screen-jobs .segmented');if(seg)seg.innerHTML='<button data-filter="all" class="active" onclick="SpeedFact.setJobFilter(\'all\')">Tous</button><button data-filter="draft" onclick="SpeedFact.setJobFilter(\'draft\')">Brouillons</button><button data-filter="open" onclick="SpeedFact.setJobFilter(\'open\')">À facturer</button><button data-filter="billed" onclick="SpeedFact.setJobFilter(\'billed\')">Facturés</button>';
  const hero=document.querySelector('.hero');if(hero)hero.classList.add('hero-photo');
  const catSmall=document.querySelector('#screen-settings .status-panel small');if(catSmall)catSmall.textContent='Données E-Phy – Anses. Produits autorisés uniquement.';
}

window.SpeedFact={startJob,editJob,duplicateJob,deleteJob,viewJob,backFromDocument,confirmSms,confirmSheetEmail,goHome,showJobs,showBilling,showInvoiceHistory,openHistoricInvoice,backFromInvoice,openSettings,openIssuers,newIssuer,editIssuer,saveIssuer,deleteIssuer,openClients,newClient,editClient,saveClient,deleteClient,renderClientList,searchCompany,applyCompanyResult,chooseWork,syncWizard,syncAudit,syncBool,clientInput,pickClient,selectExploitation,selectParcel,nextStep,searchProducts,addProduct,removeProduct,mixChange,saveJob,setJobFilter,toggleJobFilter,renderJobs,renderBilling,pickBillingClient,createInvoice,sendInvoice,saveSettings,exportData,importData,voiceStep,checkUpdate,applyUpdate};

enhanceStaticUi();saveDb();renderHome();show('home');registerSW();checkUpdate(false);
})();
