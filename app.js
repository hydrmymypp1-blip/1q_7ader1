let token=sessionStorage.getItem("1q_token")||"";
let isAdmin=sessionStorage.getItem("1q_admin")==="1";
const $=id=>document.getElementById(id);

async function login(){
  const code=$("loginCode").value.trim();
  $("loginError").textContent="";
  if(!code)return $("loginError").textContent="اكتب رقم الدخول";
  try{
    const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code})});
    const d=await r.json();
    if(!r.ok)throw new Error(d.detail||"رقم الدخول غير صحيح");
    token=d.token||"";
    isAdmin=!!d.admin;
    sessionStorage.setItem("1q_token",token);
    sessionStorage.setItem("1q_admin",isAdmin?"1":"0");
    $("loginPage").style.display="none";
    $("sitePage").style.display="block";
    $("adminButton").style.display=isAdmin?"block":"none";
    loadFiles();
  }catch(e){$("loginError").textContent=e.message||"تعذر تسجيل الدخول";}
}
$("loginBtn").addEventListener("click",login);
$("loginCode").addEventListener("keydown",e=>{if(e.key==="Enter")login()});
$("adminButton").addEventListener("click",()=>location.href="/admin.html");

let allFiles=[];
let gameCat="all",fileCat="all";
const gameCats=[["all","الكل"],["android","Android"],["pc","PC"],["other","أخرى"]];
const fileCats=[["all","الكل"],["apk","APK"],["zip","ZIP"],["rar","RAR"],["7z","7Z"],["pdf","PDF"],["other","أخرى"]];

function categoryButtons(target,list,setter){
  $(target).innerHTML=list.map(([v,t])=>`<button class="${setter===v?"active":""}" data-cat="${v}">${t}</button>`).join("");
  $(target).querySelectorAll("button").forEach(b=>b.onclick=()=>{if(target==="gameCategories")gameCat=b.dataset.cat;else fileCat=b.dataset.cat;categoryButtons(target,list,target==="gameCategories"?gameCat:fileCat);render()});
}
function card(x){
  const image=x.image_url?`<img class="game-image" src="${x.image_url}" alt="" loading="lazy">`:"";
  return `<article class="game-card">${image}<div class="game-info"><span class="game-category">${escapeHtml(x.category||"أخرى")}</span><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.description||"")}</p><a class="download-button" href="/api/download/${x.id}" target="_blank" rel="noopener">تحميل</a></div></article>`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function render(){
  const gs=$("gameSearch").value.trim().toLowerCase(),fs=$("fileSearch").value.trim().toLowerCase();
  const games=allFiles.filter(x=>x.kind==="game"&&(gameCat==="all"||x.category===gameCat)&&(!gs||x.name.toLowerCase().includes(gs)));
  const files=allFiles.filter(x=>x.kind!=="game"&&(fileCat==="all"||x.category===fileCat)&&(!fs||x.name.toLowerCase().includes(fs)));
  $("gamesContainer").innerHTML=games.length?games.map(card).join(""):`<div class="empty-box"><h2>ماكو ألعاب حالياً</h2><p>ما تم رفع أي لعبة بعد.</p></div>`;
  $("filesContainer").innerHTML=files.length?files.map(card).join(""):`<div class="empty-box"><h2>ماكو ملفات حالياً</h2><p>ما تم رفع أي ملف بعد.</p></div>`;
}
async function loadFiles(){
  try{
    const r=await fetch("/api/files");
    allFiles=await r.json();
    categoryButtons("gameCategories",gameCats,gameCat);
    categoryButtons("fileCategories",fileCats,fileCat);
    render();
  }catch(e){$("gamesContainer").innerHTML=`<div class="empty-box">تعذر الاتصال بالسيرفر.</div>`}
}
$("gameSearch").addEventListener("input",render);
$("fileSearch").addEventListener("input",render);

if(token){
  $("loginPage").style.display="none";
  $("sitePage").style.display="block";
  $("adminButton").style.display=isAdmin?"block":"none";
  loadFiles();
}
