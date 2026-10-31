(() => {
  'use strict';
  const TOPICS = window.LAW_TOPICS || [];
  const STORAGE_KEY = 'lawschool175-sprint-2026-v1'; // 이전 버전과 동일한 키: 같은 출처라면 진도 호환
  const $ = id => document.getElementById(id);
  const svg = name => `<svg class="ico" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const pad = n => String(n).padStart(3, '0');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const newState = () => ({items:{},history:[],lastId:1,theme:'dark'});
  const validId = n => Number.isInteger(n) && n >= 1 && n <= 175;
  function getState() {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!v || typeof v !== 'object') return newState();
      return {...newState(),...v,items:(v.items && typeof v.items==='object' && !Array.isArray(v.items))?v.items:{},history:Array.isArray(v.history)?v.history:[]};
    } catch(e){ return newState(); }
  }
  let state = getState();
  let currentId = validId(+state.lastId) ? +state.lastId : 1;
  let currentView = 'study', mode = 'all', indexFilter = 'all', railFilter = 'all';
  let indexQuery = '', railQuery = '', revealed = false, deepOpen = false, followOpen = false;
  let randomMode = false, animating = false, modalType = null;
  let lastSuppressedClick = 0;
  let toastTimeout = 0, slideTimer = 0;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const chapterLabel = t => `${t.vol}권 · ${t.chapter}`;
  const item = id => (state.items && state.items[id]) || {};
  const hasGrade = d => [0,1,2].includes(d.grade);
  const isDue = d => hasGrade(d) && !!d.reviewAt && new Date(d.reviewAt).getTime() <= Date.now();
  const stateLabel = d => !hasGrade(d)?'미학습':['모름','애매함','익힘'][d.grade];
  function save(){ try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); return true; } catch (e){ return false; } }
  function patch(id, v){ state.items[id] = {...item(id),...v}; save(); }
  function stats(){
    let graded=0,known=0,weak=0,due=0;
    for (const t of TOPICS){ const d=item(t.id);if (hasGrade(d)){graded++;if(d.grade===2)known++;else weak++;if(isDue(d))due++;} }
    const today = new Set(state.history.filter(x=>x.day===localDate()).map(x=>x.id)).size;
    return {graded,known,weak,due,today,percent:Math.round(graded/TOPICS.length*100)};
  }
  function notify(msg){ const el=$('toast'); el.textContent=msg;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),2200); }
  function matches(t, filter, query='') {
    const d=item(t.id),g=d.grade;
    const text=`${t.id} ${pad(t.id)} ${t.title} ${t.chapter} ${t.vol}권 ${t.question} ${t.case}`.toLowerCase();
    if(query && !text.includes(query.toLowerCase()))return false;
    switch(filter){
      case 'weak':return g===0||g===1;
      case 'unseen':return !hasGrade(d);
      case 'done':return g===2;
      case 'due':return isDue(d);
      case 'star':return !!d.star;
      default:return true;
    }
  }
  function pool(filter){return TOPICS.filter(t=>matches(t,filter));}
  const currentTopic = () => TOPICS[currentId-1];

  function renderProgress(){
    const s=stats();
    $('currentNumber').textContent=pad(currentId);
    $('readingBar').style.width=`${currentId/TOPICS.length*100}%`;
    $('railProgress').textContent=`${s.graded} / ${TOPICS.length}`;
    $('railBar').style.width=`${s.percent}%`;
    $('volumeBadge').textContent=`VOL. ${String(currentTopic().vol).padStart(2,'0')}`;
    $('chapterLabel').textContent=currentTopic().chapter;
    const star=$('bookmarkBtn');star.classList.toggle('saved',!!item(currentId).star);
    star.setAttribute('aria-label',item(currentId).star?'즐겨찾기 해제':'즐겨찾기 추가');
    star.setAttribute('aria-pressed',String(!!item(currentId).star));
  }
  // Touch the front to reveal; touch ANYWHERE in the readable answer sheet to return.
  function renderFlashcard(){
    const t=currentTopic();
    const card=$('studyFlashcard');
    card.classList.toggle('answer-side',revealed);
    if(!revealed){
      card.innerHTML=`<button class="flash-front" type="button" data-card-action="reveal" aria-label="${esc(t.title)}: 답변 보기">
        <span class="front-eyebrow">${pad(t.id)} / 175 <span aria-hidden="true">·</span> ${esc(t.title)}</span>
        <h1 class="flash-question">${esc(t.question)}</h1>
        <div class="micro-case" role="note" aria-label="구체적인 연습 사례">
          <span class="micro-case-label">생각해 볼 사례 <span class="micro-case-kind">${esc(t.caseKind)}</span></span>
          <span class="micro-case-body">${esc(t.case)}</span>
        </div>
        <span class="front-space"></span>
        <span class="front-tap">${svg('hand')} 카드 터치 → 답변 보기 <span class="front-swipe">좌우 밀기 → 주제 이동</span></span>
      </button>`;
    } else {
      card.innerHTML=`<article class="flash-back reader-sheet" role="button" tabindex="0" data-card-action="question" aria-label="답변 화면. 터치하면 질문 카드로 돌아갑니다.">
        <div class="reader-topline"><span>${pad(t.id)} · ${esc(t.title)}</span><span class="reader-rotator" aria-hidden="true">↶ 질문 보기</span></div>
        <section class="reader-section reader-first">
          <h2>사례 답변 <span class="reader-origin">예시</span></h2>
          <p class="reader-case-answer">${esc(t.caseAnswer)}</p>
        </section>
        <section class="reader-section"><h2>판단 기준</h2><p>${esc(t.caseFocus)}</p></section>
        <section class="reader-section"><h2>고려할 근거</h2><p>${esc(t.caseReasons)}</p></section>
        <section class="reader-section"><h2>반론과 한계</h2><p>${esc(t.caseLimits)}</p></section>
      </article>`;
    }
    renderExtra();renderDock();
    $('sourceNote').innerHTML=`<strong>자료 기준 · ${t.vol}권 ${esc(t.vol===1?'기본편':'심화&실전모의편')} ${t.page}쪽부터</strong><br>${t.casePdfPage?'사례는 교재의 문제 페이지(스캔 PDF '+t.casePdfPage+'쪽)에서 상황만 재구성했습니다.':'사례는 주제에 맞춰 새로 만든 가상 연습문제입니다.'} 사례 답변·판단 기준·근거·반론·심화 해설은 학습용 의견 예시이며 저자의 모범답안이 아닙니다. 실제 법령·판례·통계는 별도 확인이 필요합니다.`;
  }
  function renderExtra(){
    const extra=$('extraArea');if(!revealed){extra.hidden=true;extra.innerHTML='';return;}
    extra.hidden=false;
    const t=currentTopic(), d=item(currentId);
    const noteSummary=(d.stance||d.memo)?'기록한 생각 수정':'내 생각 메모';
    extra.innerHTML=`<section class="reader-disclosures" aria-label="추가 해설 펼치기">
      <div class="reader-disclosure"><button class="reader-disclosure-button" data-extra="deep" aria-expanded="${deepOpen}" aria-controls="deepPanel">심화 내용 ${deepOpen?'접기':'보기'}<span>${svg('chevron-down')}</span></button>
        <div class="reader-disclosure-body" id="deepPanel" ${deepOpen?'':'hidden'}><ol class="deep-list">${t.deep.map((p,i)=>`<li><span class="deep-number">${String(i+1).padStart(2,'0')}</span><span>${esc(p)}</span></li>`).join('')}</ol><p class="details-disclaimer">5개 심화 해설은 저자의 모범답안을 인용한 내용이 아닙니다.</p></div></div>
      <div class="reader-disclosure"><button class="reader-disclosure-button" data-extra="follow" aria-expanded="${followOpen}" aria-controls="followPanel">꼬리질문 · 답변 ${followOpen?'접기':'보기'}<span>${svg('chevron-down')}</span></button>
        <div class="reader-disclosure-body" id="followPanel" ${followOpen?'':'hidden'}><p class="followup-question">${esc(t.followup)}</p><p class="followup-answer">${esc(t.followupAnswer)}</p><p class="details-disclaimer">면접에서 활용할 수 있는 한 가지 답변 예시입니다.</p></div></div>
      </section><button class="memo-trigger" type="button" id="memoBtn"><span>${svg('edit')} ${esc(noteSummary)}</span><span>→</span></button>`;
  }
  function renderDock(){
    if(currentView!=='study'){$('studyDock').hidden=true;return;}
    $('studyDock').hidden=false;
    const arr=pool(mode);
    let idx=arr.findIndex(t=>t.id===currentId);
    const atStart=idx===0 && !randomMode,atEnd=idx===arr.length-1 && !randomMode;
    if(!revealed){
      $('studyDock').innerHTML=`<div class="dock-inner"><button class="dock-arrow" data-control="prev" ${atStart?'disabled':''} aria-label="이전 주제">${svg('arrow-left')}</button><button class="dock-primary" data-control="reveal">답변 확인</button><button class="dock-arrow" data-control="next" ${atEnd?'disabled':''} aria-label="다음 주제">${svg('arrow-right')}</button></div>`;
    } else {
      $('studyDock').innerHTML=`<div class="grade-dock"><div class="grade-grid"><button class="grade-button g0" data-grade="0">모름</button><button class="grade-button g1" data-grade="1">애매함</button><button class="grade-button g2" data-grade="2">익힘</button></div></div>`;
    }
  }
  function renderRail(){
    const topics=TOPICS.filter(t=>matches(t,railFilter,railQuery));
    $('railList').innerHTML=renderGroupedList(topics,'rail-goto');
    document.querySelectorAll('[data-rail-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.railFilter===railFilter));
  }
  function renderIndex(){
    const topics=TOPICS.filter(t=>matches(t,indexFilter,indexQuery));
    $('indexResults').innerHTML=renderGroupedList(topics,'index-goto');
    document.querySelectorAll('[data-index-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.indexFilter===indexFilter));
  }
  function renderGroupedList(topics,action){
    if(!topics.length) return `<div class="index-empty">해당 조건의 주제가 없습니다.<br>다른 검색어나 필터를 선택해 보세요.</div>`;
    const groups = new Map();
    for (const t of topics) {const g=chapterLabel(t); if(!groups.has(g))groups.set(g,[]);groups.get(g).push(t);}
    return [...groups.entries()].map(([group,arr])=>`<div class="topic-group-head"><span>${esc(group)}</span><span>${arr.length}</span></div>${arr.map(t=>{const d=item(t.id);return `<button class="topic-list-item ${t.id===currentId?'current':''}" data-${action}="${t.id}"><span class="topic-id">${pad(t.id)}</span><span class="topic-list-name">${esc(t.title)}</span>${d.star?'<span aria-label="즐겨찾기" style="color:#e2c48e">★</span>':''}<span class="grade-dot ${hasGrade(d)?'g'+d.grade:''}" title="${stateLabel(d)}"></span></button>`;}).join('')}`).join('');
  }
  function renderNav(){
    const selected=!$('indexSheet').hidden?'index':(currentView==='dashboard'?'stats':(mode==='weak'?'review':'learn'));
    document.querySelectorAll('[data-nav]').forEach(b=>{const active=b.dataset.nav===selected;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false');});
  }
  function renderStudy(){
    currentView='study';
    $('studyPage').hidden=false;$('dashboardPage').hidden=true;
    renderProgress();renderFlashcard();renderRail();renderNav();
  }
  function renderDashboard(){
    currentView='dashboard'; $('studyPage').hidden=true;$('dashboardPage').hidden=false;$('studyDock').hidden=true;
    const s=stats(); const grouped=new Map();
    for(const t of TOPICS){ const k=chapterLabel(t);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(t); }
    $('dashboardPage').innerHTML=`<div class="dashboard-header"><span class="tiny-overline">MY STUDY / PROGRESS</span><h1>학습의 흔적이<br>쌓이고 있어요.</h1><p>진도를 확인하고 모르는 주제에 집중하세요. 암기보다 판단기준을 먼저 떠올리는 것이 목표입니다.</p></div>
      <div class="metric-grid"><div class="metric"><strong>${s.graded}</strong><span>학습한 주제</span></div><div class="metric"><strong>${s.known}</strong><span>익힌 주제</span></div><div class="metric"><strong>${s.weak}</strong><span>취약 주제</span></div><div class="metric"><strong>${s.today}</strong><span>오늘 학습</span></div></div>
      <div class="dashboard-actions"><button class="solid-button" data-dash="continue">이어서 공부하기 ${svg('arrow-right')}</button><button class="soft-button" data-dash="weak">취약 주제 복습</button><button class="soft-button" data-dash="unseen">미학습 주제 보기</button></div>
      <div class="dashboard-section-title">단원별 학습 진도</div><div class="chapter-tiles">${[...grouped.entries()].map(([key,arr])=>{const completed=arr.filter(t=>hasGrade(item(t.id))).length;return `<button class="chapter-tile" data-chapter-id="${arr[0].id}"><strong>${esc(key)}</strong><small>${completed} / ${arr.length} 주제 · ${Math.round(completed/arr.length*100)}%</small><span class="mini-meter"><span style="width:${completed/arr.length*100}%"></span></span></button>`}).join('')}</div>
      <div class="dashboard-section-title">빠른 공부법</div><div class="dashboard-help">① 질문을 먼저 읽고 15초 정도 스스로 판단해 보세요.<br>② 카드를 터치해 핵심 논거를 확인하세요.<br>③ 더 필요한 주제만 심화 설명을 펼치세요.<br>④ 모름·애매함으로 표시한 주제를 반복해서 읽으세요.</div>`;
    renderRail();renderNav();
  }
  function showStudy(){
    if(currentView==='study')return;
    renderStudy();window.scrollTo({top:0,behavior:reducedMotion?'auto':'smooth'});
  }
  function resetCard(){revealed=false;deepOpen=false;followOpen=false;}
  function navigateTo(id,dir=1,animate=true){
    if(!validId(id) || animating) return;
    closeIndex();closeModal();
    if(currentView==='dashboard')animate=false;
    if(currentId===id && currentView==='study'){renderStudy();return;}
    const shell=$('gestureShell');
    const advance=()=>{
      currentId=id;state.lastId=id;save();resetCard();
      shell.style.transform=''; shell.style.opacity='';shell.style.transition='';
      shell.classList.remove('fly-left','fly-right','dragging');
      if(animate&&!reducedMotion){shell.classList.add(dir>0?'enter-right':'enter-left');}
      renderStudy();window.scrollTo({top:0,behavior:'auto'});
      if(animate&&!reducedMotion){requestAnimationFrame(()=>requestAnimationFrame(()=>{shell.classList.add('entering');shell.classList.remove('enter-right','enter-left');}));setTimeout(()=>{shell.classList.remove('entering');animating=false;},300);}else animating=false;
    };
    if(animate&&!reducedMotion){animating=true;shell.classList.add(dir>0?'fly-left':'fly-right');slideTimer=setTimeout(advance,165);}
    else advance();
  }
  function nextTopic(direction=1){
    if(animating)return;
    let arr=pool(mode); if(!arr.length)arr=TOPICS;
    if(randomMode && direction>0){const alternatives=arr.filter(t=>t.id!==currentId);if(!alternatives.length){notify('다른 주제가 없습니다.');return;}navigateTo(alternatives[Math.floor(Math.random()*alternatives.length)].id,direction);return;}
    let idx=arr.findIndex(t=>t.id===currentId);
    if(idx<0){arr=TOPICS;idx=currentId-1;}
    const target=arr[idx+direction];
    if(!target){notify(direction>0?'이 목록의 마지막 주제입니다.':'이 목록의 첫 주제입니다.');return;}
    navigateTo(target.id,direction);
  }
  function showAnswer(){if(revealed||animating)return;revealed=true;renderFlashcard();}
  function hideAnswer(){if(!revealed)return;revealed=false;deepOpen=false;followOpen=false;renderFlashcard();}
  function rate(grade){
    if(![0,1,2].includes(grade)||animating)return;
    const arr=pool(mode),idx=arr.findIndex(t=>t.id===currentId);
    const d=item(currentId),reps=(Number(d.reps)||0)+1;
    const delayHours=grade===0?3:grade===1?24:Math.min(24*30,24*(3+4*(reps-1)));
    patch(currentId,{grade,reps,updatedAt:new Date().toISOString(),reviewAt:new Date(Date.now()+delayHours*3600000).toISOString()});
    state.history.push({id:currentId,grade,day:localDate(),timestamp:Date.now()});state.history=state.history.slice(-3000);save();
    let target;
    if(randomMode){const alternatives=pool(mode).filter(t=>t.id!==currentId);target=alternatives[Math.floor(Math.random()*alternatives.length)];}
    else target=arr[idx+1]||null;
    if(target){navigateTo(target.id,1);return;}
    if(mode!=='all'){
      const rest=pool(mode).filter(t=>t.id!==currentId);
      if(rest.length){navigateTo(rest[0].id,1);return;}
      mode='all';notify('선택한 목록의 학습을 마쳤어요!');
    } else notify('마지막 주제까지 도달했어요!');
    renderStudy();
  }
  function toggleBookmark(){patch(currentId,{star:!item(currentId).star});renderProgress();renderRail();if(!$('indexSheet').hidden)renderIndex();notify(item(currentId).star?'즐겨찾기에 저장했어요.':'즐겨찾기에서 해제했어요.');}
  function startMode(newMode){
    const arr=pool(newMode);
    if(!arr.length){notify(newMode==='weak'?'아직 취약 주제가 없어요.':'조건에 해당하는 주제가 없습니다.');openIndex(newMode);return;}
    mode=newMode;
    const selected=arr.some(x=>x.id===currentId)?currentId:arr[0].id;
    if(currentId===selected){resetCard();renderStudy();closeIndex();window.scrollTo({top:0,behavior:'smooth'});}
    else navigateTo(selected,1,currentView==='study');
  }
  function openIndex(preselect){
    if(preselect)indexFilter=preselect;
    $('indexSheet').hidden=false;$('drawerScrim').hidden=false;document.body.style.overflow='hidden';
    renderIndex();renderNav();
  }
  function closeIndex(){ $('indexSheet').hidden=true;$('drawerScrim').hidden=true;if(!modalType)document.body.style.overflow='';renderNav(); }
  function openModal(type){
    closeIndex();modalType=type;$('utilityModal').hidden=false;$('modalScrim').hidden=false;document.body.style.overflow='hidden';
    if(type==='settings')renderSettings();else if(type==='note')renderNote();
  }
  function closeModal(){
    if(!modalType)return;
    if(modalType==='note')saveNoteIfOpen();
    const wasNote=modalType==='note';modalType=null;$('utilityModal').hidden=true;$('modalScrim').hidden=true;document.body.style.overflow='';if(wasNote&&currentView==='study'&&revealed)renderExtra();
  }
  function renderSettings(){
    const s=stats();
    $('utilityModal').innerHTML=`<div class="modal-top"><div><span class="tiny-overline">PREFERENCES / BACKUP</span><h2>설정 및 학습 기록</h2></div><button class="icon-button" data-modal="close" aria-label="닫기">${svg('close')}</button></div>
      <p><strong>${s.graded}개 학습 · ${s.known}개 익힘 · ${s.weak}개 취약</strong><br>진도와 메모는 현재 브라우저에 자동 저장됩니다. 기기 간 자동 동기화는 되지 않습니다.</p>
      <div class="modal-options"><button data-modal="export">${svg('download')} JSON 백업</button><button data-modal="import">${svg('upload')} 백업 불러오기</button><button data-modal="shuffle">${svg('refresh')} ${randomMode?'무작위: 켬':'무작위: 끔'}</button><button data-modal="index">${svg('list')} 전체 목차</button></div>
      <div class="modal-note"><strong>손쉬운 사용법</strong><ul><li>질문 카드를 터치하면 사례 답변과 논거가 나옵니다. 답변 카드 아무 곳이나 터치하면 질문으로 돌아갑니다.</li><li>왼쪽/오른쪽으로 밀면 다음/이전 주제로 이동합니다.</li><li>심화 내용과 꼬리질문 답변은 카드 바로 아래에서 펼칩니다.</li><li>모름 / 애매함 / 익힘을 누르면 저장 후 다음 카드로 넘어갑니다.</li><li>아이폰에서는 Safari 공유 → 홈 화면에 추가로 설치할 수 있습니다.</li></ul></div>
      <div class="modal-note"><strong>교재 및 저작권</strong><p>『김종수 로스쿨 면접 200주제』의 목차를 바탕으로 175개 학습 주제명을 구성했습니다. 주제별 질문·핵심·심화·꼬리질문 답변은 별도 작성한 AI 학습자료이며 교재의 모범답안이 아닙니다. 원본 PDF는 포함하지 않습니다.</p></div>
      <button class="modal-danger" data-modal="reset">모든 학습 진도·메모 초기화</button>`;
  }
  function renderNote(){
    const d=item(currentId),t=currentTopic();
    $('utilityModal').innerHTML=`<div class="modal-top"><div><span class="tiny-overline">MY ARGUMENT / ${pad(currentId)}</span><h2>${esc(t.title)}</h2></div><button class="icon-button" data-modal="close" aria-label="닫기">${svg('close')}</button></div>
      <p>정해진 정답을 외우기보다, 내 기준을 한두 문장으로 남겨 보세요. 입력 내용은 자동 저장됩니다.</p>
      <label class="note-label" for="myStance">나의 한 줄 결론</label><input class="note-field" id="myStance" maxlength="350" placeholder="예: 원칙적으로 허용하되 일정한 조건은 필요하다" value="${esc(d.stance||'')}">
      <label class="note-label" for="myMemo">판단기준 / 반론 / 떠오른 사례</label><textarea class="note-field textarea" id="myMemo" placeholder="자유롭게 적어 보세요. 말로 설명할 핵심을 한두 줄로 정리해도 좋아요.">${esc(d.memo||'')}</textarea>
      <div class="note-actions"><button data-modal="close">닫기</button><button class="save-note" data-modal="saveNote">${svg('check')} 저장</button></div>`;
    $('myStance').focus({preventScroll:true});
  }
  function saveNoteIfOpen(){
    const stance=$('myStance'),memo=$('myMemo');
    if(!stance||!memo||modalType!=='note')return;
    const d=item(currentId);
    if(stance.value!==String(d.stance||'')||memo.value!==String(d.memo||''))patch(currentId,{stance:stance.value,memo:memo.value});
  }
  function exportBackup(){
    const content={app:'lawschool175-sprint',version:1,savedAt:new Date().toISOString(),records:state};
    const blob=new Blob([JSON.stringify(content,null,2)],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`law175-backup-${localDate()}.json`;
    document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);notify('JSON 파일로 백업했어요.');
  }
  async function importBackup(file){
    if(!file)return;
    try {
      const raw=JSON.parse(await file.text());const v=raw.app==='lawschool175-sprint'?raw.records:raw;
      if(!v||typeof v.items!=='object'||Array.isArray(v.items))throw Error('invalid items');
      if(!window.confirm('현재 학습 기록을 백업 파일로 교체할까요?'))return;
      const clean=newState();clean.lastId=validId(+v.lastId)?+v.lastId:1;
      for (const [key,val] of Object.entries(v.items)){
        const id=+key; if(!validId(id)||!val||typeof val!=='object')continue;
        clean.items[id]={grade:[0,1,2].includes(val.grade)?val.grade:undefined,star:!!val.star,
          stance:typeof val.stance==='string'?val.stance.slice(0,5000):'',memo:typeof val.memo==='string'?val.memo.slice(0,50000):'',
          reps:Number.isFinite(+val.reps)?Math.max(0,+val.reps):0,reviewAt:typeof val.reviewAt==='string'?val.reviewAt:undefined,updatedAt:typeof val.updatedAt==='string'?val.updatedAt:undefined};
      }
      clean.history=Array.isArray(v.history)?v.history.filter(h=>h&&validId(+h.id)&&['string'].includes(typeof h.day)).slice(-3000):[];
      state=clean;save();currentId=state.lastId;mode='all';resetCard();closeModal();renderStudy();notify('학습 기록을 불러왔어요.');
    } catch(e){notify('지원되는 LAW 175 JSON 백업 파일이 아닙니다.');}finally{$('backupFile').value='';}
  }
  function resetAll(){
    if(!window.confirm('학습 기록과 메모를 전부 초기화할까요? 복구하려면 기존 백업 파일이 필요합니다.'))return;
    state=newState();save();currentId=1;mode='all';resetCard();closeModal();renderStudy();notify('학습 기록을 초기화했어요.');
  }
  function toggleAccordion(which){
    if(which==='deep')deepOpen=!deepOpen;else followOpen=!followOpen;
    renderExtra();
    const next=$(`[data-extra="${which}"]`); if(next)next.focus({preventScroll:true});
  }
  function activateNav(which){
    switch(which){
      case 'learn':mode='all';closeIndex();if(currentView==='study')renderStudy();else showStudy();renderNav();break;
      case 'index':openIndex();break;
      case 'review':startMode('weak');break;
      case 'stats':closeIndex();renderDashboard();window.scrollTo({top:0,behavior:'smooth'});break;
    }
  }
  // ====== Input controls ======
  $('studyFlashcard').addEventListener('click', e => {
    const action=e.target.closest('[data-card-action]');if(!action||Date.now()-lastSuppressedClick<420)return;
    if(action.dataset.cardAction==='reveal')showAnswer();else if(action.dataset.cardAction==='question')hideAnswer();
  });
  $('studyDock').addEventListener('click', e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.grade!==undefined){rate(+b.dataset.grade);return;}
    switch(b.dataset.control){case 'prev':nextTopic(-1);break;case 'next':nextTopic(1);break;case 'reveal':showAnswer();break;}
  });
  $('extraArea').addEventListener('click',e=>{
    const b=e.target.closest('[data-extra],#memoBtn');if(!b)return;
    if(b.id==='memoBtn')openModal('note');else toggleAccordion(b.dataset.extra);
  });
  $('bookmarkBtn').addEventListener('click',toggleBookmark);
  $('settingsBtn').addEventListener('click',()=>openModal('settings'));
  $('railSettings').addEventListener('click',()=>openModal('settings'));
  $('railSearch').addEventListener('input',e=>{railQuery=e.target.value.trim();renderRail();});
  document.querySelector('.rail-chips').addEventListener('click',e=>{const b=e.target.closest('[data-rail-filter]');if(!b)return;railFilter=b.dataset.railFilter;renderRail();});
  $('railList').addEventListener('click',e=>{const b=e.target.closest('[data-rail-goto]');if(!b)return;mode='all';navigateTo(+b.dataset.railGoto,1,currentView==='study');});
  $('indexResults').addEventListener('click',e=>{const b=e.target.closest('[data-index-goto]');if(!b)return;mode=indexFilter;const id=+b.dataset.indexGoto;closeIndex();navigateTo(id,id<currentId?-1:1,currentView==='study');});
  $('indexFilters').addEventListener('click',e=>{const b=e.target.closest('[data-index-filter]');if(!b)return;indexFilter=b.dataset.indexFilter;renderIndex();});
  $('indexSearch').addEventListener('input',e=>{indexQuery=e.target.value.trim();renderIndex();});
  $('closeIndex').addEventListener('click',closeIndex);$('drawerScrim').addEventListener('click',closeIndex);
  document.querySelector('.mobile-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-nav]');if(b)activateNav(b.dataset.nav);});
  $('dashboardPage').addEventListener('click',e=>{
    const b=e.target.closest('[data-dash],[data-chapter-id]');if(!b)return;
    if(b.dataset.chapterId){mode='all';navigateTo(+b.dataset.chapterId,1,false);return;}
    if(b.dataset.dash==='continue'){mode='all';showStudy();}
    else if(b.dataset.dash==='weak')startMode('weak');
    else if(b.dataset.dash==='unseen')startMode('unseen');
  });
  $('utilityModal').addEventListener('click',e=>{
    const b=e.target.closest('[data-modal]');if(!b)return;
    switch(b.dataset.modal){
      case 'close':closeModal();break;
      case 'saveNote':saveNoteIfOpen();closeModal();notify('메모를 저장했어요.');break;
      case 'export':exportBackup();break;
      case 'import':$('backupFile').click();break;
      case 'index':closeModal();openIndex();break;
      case 'shuffle':randomMode=!randomMode;renderSettings();notify(randomMode?'무작위 학습 켜짐':'목차 순서 학습 켜짐');break;
      case 'reset':resetAll();break;
    }
  });
  $('utilityModal').addEventListener('input',e=>{if(e.target.matches('#myStance,#myMemo'))saveNoteIfOpen();});
  $('modalScrim').addEventListener('click',closeModal);
  $('backupFile').addEventListener('change',e=>importBackup(e.target.files[0]));
  window.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      if(modalType){e.preventDefault();closeModal();return;}
      if(!$('indexSheet').hidden){e.preventDefault();closeIndex();return;}
      if(currentView==='dashboard'){showStudy();return;}
    }
    const tag=e.target.tagName;if(['INPUT','TEXTAREA','SELECT'].includes(tag)||modalType||!$('indexSheet').hidden)return;
    if(e.key==='Enter'&&e.target.closest('.reader-sheet')){e.preventDefault();hideAnswer();return;}
    if(e.key==='ArrowRight'){e.preventDefault();nextTopic(1);}
    else if(e.key==='ArrowLeft'){e.preventDefault();nextTopic(-1);}
    else if(e.code==='Space'&&currentView==='study'){e.preventDefault();revealed?hideAnswer():showAnswer();}
    else if(currentView==='study'&&revealed&&['1','2','3'].includes(e.key)){rate(+e.key-1);}
    else if(currentView==='study'&&e.key.toLowerCase()==='b'){toggleBookmark();}
  });
  // ====== Horizontal swipe (Safari/iOS Pointer Events); vertical reading scroll remains native ======
  const shell=$('gestureShell');
  let drag=null;
  shell.addEventListener('pointerdown',e=>{
    if(animating||currentView!=='study'||modalType||!$('indexSheet').hidden)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    if(e.target.closest('button:not(.flash-front)'))return;
    drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,startTime:performance.now(),horizontal:false,vertical:false};
  },{passive:true});
  shell.addEventListener('pointermove',e=>{
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    drag.lastX=e.clientX;drag.lastY=e.clientY;
    if(drag.vertical)return;
    if(!drag.horizontal){
      if(Math.abs(dy)>12&&Math.abs(dy)>Math.abs(dx)*1.1){drag.vertical=true;return;}
      if(Math.abs(dx)>11&&Math.abs(dx)>Math.abs(dy)*1.1)drag.horizontal=true;
    }
    if(drag.horizontal){
      shell.classList.add('dragging');
      shell.style.transform=`translate3d(${Math.max(-115,Math.min(115,dx))}px,0,0) rotate(${Math.max(-4,Math.min(4,dx/25))}deg)`;
      shell.style.opacity=String(Math.max(.65,1-Math.abs(dx)/550));
      if(e.cancelable)e.preventDefault();
    }
  },{passive:false});
  function endGesture(e,wasCanceled=false){
    if(!drag||drag.id!==e.pointerId)return;
    const d=drag;drag=null;
    const dx=d.lastX-d.startX,dy=d.lastY-d.startY,duration=performance.now()-d.startTime;
    if(d.horizontal){
      lastSuppressedClick=Date.now();
      shell.classList.remove('dragging');shell.style.transition='transform .18s ease,opacity .18s ease';shell.style.transform='';shell.style.opacity='';
      const enough=Math.abs(dx)>=62||(Math.abs(dx)>=38&&duration<260&&Math.abs(dx)>Math.abs(dy)*1.25);
      if(!wasCanceled&&enough){nextTopic(dx<0?1:-1);}
      else setTimeout(()=>{shell.style.transition='';},200);
    }
  }
  shell.addEventListener('pointerup',e=>endGesture(e));shell.addEventListener('pointercancel',e=>endGesture(e,true));
  window.addEventListener('pagehide',()=>{if(modalType==='note')saveNoteIfOpen();save();});
  // Once deployed to GitHub Pages, serve offline; hosted updates use network-first for index.
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost')){
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{}));
  }
  if(TOPICS.length!==175||TOPICS.some((t,i)=>t.id!==i+1||!t.focus||!t.caseAnswer||!t.caseReasons||!t.caseLimits||!t.caseFocus||!t.followupAnswer||t.deep.length!==5)){
    $('studyFlashcard').textContent='학습 데이터가 올바르지 않습니다. 페이지를 다시 업로드해 주세요.';
    return;
  }
  resetCard();renderStudy();
})();
