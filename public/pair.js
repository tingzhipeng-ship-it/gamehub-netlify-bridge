(() => {
  'use strict';
  const api='/.netlify/functions/bridge';
  const $=id=>document.getElementById(id);
  let token=sessionStorage.getItem('gamehubToken')||'';
  const supportedScreens={oled:'SH1106 128x64',tft:'ILI9341 320x240'};
  let selectedDisplay=localStorage.getItem('gamehubDisplay')==='tft'?'tft':'oled';
  let actualDisplay=null;
  const setDisplay=(type,save=true)=>{
    selectedDisplay=type;
    if(save)localStorage.setItem('gamehubDisplay',type);
    for (const button of document.querySelectorAll('[data-display]')) {
      const yes=button.dataset.display===type;
      button.classList.toggle('selected',yes);
      button.setAttribute('aria-pressed',String(yes));
    }
    $('selectionnote').textContent=type==='oled'
      ? '1.3-inch OLED selected · SH1106 · button controls.'
      : '2.8-inch colour display selected · touchscreen and microSD integration pending hardware verification.';
    $('librarydetail').textContent='CATCH and DODGE files can be downloaded for later expansion. Your current all-in-one Snake/Pong firmware does not yet include a game loader.';
    if(actualDisplay && actualDisplay!==supportedScreens[type]){
      $('selectionnote').textContent += ' Warning: paired device reports '+actualDisplay+'.';
    }
  };
  for(const b of document.querySelectorAll('[data-display]'))b.addEventListener('click',()=>setDisplay(b.dataset.display));
  setDisplay(selectedDisplay,false);
  let busy=false;
  let lastButtonAt=0;
  function note(s){$('notice').textContent=s;}
  function view(){ $('pairpanel').classList.toggle('hidden',Boolean(token));$('controlpanel').classList.toggle('hidden',!token); $('indicator').textContent=token?'● Paired browser':'● Not paired'; }
  async function post(b){
    const res=await fetch(api,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b),cache:'no-store'});
    let j;try{j=await res.json();}catch{throw Error('The Netlify bridge is not installed or could not respond.');}
    if(!res.ok||!j.ok)throw Error(j.error||'Bridge error');
    return j;
  }
  function forget(){token='';sessionStorage.removeItem('gamehubToken');view();note('Pair again with the PIN on your OLED.');}
  $('pairform').addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    const pin=$('pin').value.trim();if(!/^\d{6}$/.test(pin))return note('Enter exactly six digits.');
    busy=true;$('pairbtn').disabled=true;note('Checking pairing PIN…');
    try{const j=await post({action:'pair',pin});token=j.token;sessionStorage.setItem('gamehubToken',token);$('pin').value='';view();note('Paired! You can use the controls below.');await refresh();}
    catch(e){note('Pairing failed: '+e.message);}
    finally{busy=false;$('pairbtn').disabled=false;}
  });
  $('unpair').addEventListener('click',forget);
  async function refresh(){
    if(!token)return;
    try{const d=await post({action:'status',token});$('status').textContent=d.online?'ESP32 online':'ESP32 offline';actualDisplay=d.screen||null;
      $('detail').textContent=(d.screen||'ESP32 display')+' · '+d.mode+' · last seen '+(d.last_seen_seconds??'?')+'s ago';
      if(actualDisplay===supportedScreens.oled || actualDisplay===supportedScreens.tft){
        const detected=actualDisplay===supportedScreens.oled?'oled':'tft';
        if(detected!==selectedDisplay){
          setDisplay(detected);
          note('Display detected: '+actualDisplay+'. Selection updated automatically.');
        }
      }$('orb').classList.toggle('on',d.online);}
    catch(e){if(e.message==='pair_again')forget();else {$('status').textContent='Bridge unavailable'; $('orb').classList.remove('on');}}
  }
  for (const btn of document.querySelectorAll('[data-key]')) btn.addEventListener('click',async()=>{
    if(!token)return;
    if(Date.now()-lastButtonAt<250)return note('Please use slower taps for cloud control.');
    lastButtonAt=Date.now();
    try{await post({action:'command',token,key:btn.dataset.key});note('Sent '+btn.dataset.key+' (delivery depends on network delay).');}
    catch(e){note('Command failed: '+e.message);}
  });
  view();if(token)refresh();setInterval(refresh,10000);
})();
