const token=sessionStorage.getItem("1q_token")||"";
if(sessionStorage.getItem("1q_admin")!=="1"||!token)location.href="/";
const $=id=>document.getElementById(id);
const kind=$("uploadForm").elements.kind,cat=$("category");
function setCats(){cat.innerHTML=(kind.value==="game"?[["android","Android"],["pc","PC"],["other","أخرى"]]:[["apk","APK"],["zip","ZIP"],["rar","RAR"],["7z","7Z"],["pdf","PDF"],["other","أخرى"]]).map(x=>`<option value="${x[0]}">${x[1]}</option>`).join("")}
kind.onchange=setCats;setCats();
$("backBtn").onclick=()=>location.href="/";
$("uploadForm").onsubmit=async e=>{
 e.preventDefault();$("msg").textContent="جاري الرفع...";
 const fd=new FormData(e.target);
 try{
  const r=await fetch("/api/upload",{method:"POST",headers:{Authorization:"Bearer "+token},body:fd});
  const d=await r.json();if(!r.ok)throw new Error(d.detail||"فشل الرفع");
  $("msg").textContent="تم الرفع بنجاح";e.target.reset();setCats();load();
 }catch(err){$("msg").textContent=err.message}
};
async function load(){
 const r=await fetch("/api/files");const arr=await r.json();
 $("list").innerHTML=arr.length?arr.map(x=>`<div class="item"><div><b>${esc(x.name)}</b><div class="muted">${esc(x.category)} • ${esc(x.kind)}</div></div><button class="delete" onclick="del(${x.id})">حذف</button></div>`).join(""):"<p class='muted'>ماكو ملفات.</p>";
}
async function del(id){
 if(!confirm("متأكد تريد تحذف؟"))return;
 const r=await fetch("/api/files/"+id,{method:"DELETE",headers:{Authorization:"Bearer "+token}});
 if(r.ok)load();else alert("فشل الحذف");
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
load();
