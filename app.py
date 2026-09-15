import os, secrets, sqlite3, mimetypes
from pathlib import Path
from urllib.parse import quote
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import FileResponse, RedirectResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()
ADMIN_CODE=os.getenv("ADMIN_CODE","")
BOT_TOKEN=os.getenv("BOT_TOKEN","")
STORAGE_CHAT_ID=os.getenv("STORAGE_CHAT_ID","")
MAX_MB=int(os.getenv("MAX_UPLOAD_MB","20"))
BASE=Path(__file__).resolve().parent
DB=BASE/"store.db"
app=FastAPI()
sessions=set()

def db():
    c=sqlite3.connect(DB)
    c.row_factory=sqlite3.Row
    return c
def init():
    c=db();c.execute("""CREATE TABLE IF NOT EXISTS files(
      id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,kind TEXT NOT NULL,
      category TEXT NOT NULL,description TEXT,telegram_file_id TEXT NOT NULL,
      telegram_image_id TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP)""");c.commit();c.close()
init()

def admin(auth):
    if not auth or not auth.startswith("Bearer "): return False
    return auth[7:] in sessions

async def tg_send(upload:UploadFile):
    if not BOT_TOKEN or not STORAGE_CHAT_ID: raise HTTPException(500,"Telegram storage غير مضبوط")
    data=await upload.read()
    if len(data)>MAX_MB*1024*1024: raise HTTPException(413,f"الحد الأقصى {MAX_MB}MB")
    url=f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
    files={"document":(upload.filename or "file",data,upload.content_type or "application/octet-stream")}
    async with httpx.AsyncClient(timeout=120) as client:
        r=await client.post(url,data={"chat_id":STORAGE_CHAT_ID},files=files)
    j=r.json()
    if not j.get("ok"): raise HTTPException(500,"فشل إرسال الملف إلى Telegram")
    return j["result"]["document"]["file_id"]

async def tg_image(upload):
    if not upload or not upload.filename:return None
    data=await upload.read()
    if len(data)>MAX_MB*1024*1024: raise HTTPException(413,f"الحد الأقصى للصورة {MAX_MB}MB")
    url=f"https://api.telegram.org/bot{BOT_TOKEN}/sendDocument"
    files={"document":(upload.filename,data,upload.content_type or "application/octet-stream")}
    async with httpx.AsyncClient(timeout=120) as client:
        r=await client.post(url,data={"chat_id":STORAGE_CHAT_ID},files=files)
    j=r.json()
    if not j.get("ok"): raise HTTPException(500,"فشل رفع الصورة")
    return j["result"]["document"]["file_id"]

async def tg_path(file_id):
    async with httpx.AsyncClient(timeout=60) as client:
        r=await client.get(f"https://api.telegram.org/bot{BOT_TOKEN}/getFile",params={"file_id":file_id})
    j=r.json()
    if not j.get("ok"): raise HTTPException(404,"الملف غير موجود")
    return j["result"]["file_path"]

@app.post("/api/login")
async def login(body:dict):
    code=str(body.get("code",""))
    if code=="1": return {"token":secrets.token_urlsafe(24),"admin":False}
    if ADMIN_CODE and secrets.compare_digest(code,ADMIN_CODE):
        t=secrets.token_urlsafe(32);sessions.add(t);return {"token":t,"admin":True}
    raise HTTPException(401,"رقم الدخول غير صحيح")

@app.get("/api/files")
async def files():
    c=db();rows=c.execute("SELECT * FROM files ORDER BY id DESC").fetchall();c.close()
    return [{"id":r["id"],"name":r["name"],"kind":r["kind"],"category":r["category"],"description":r["description"] or "",
             "image_url":f"/api/image/{r['id']}" if r["telegram_image_id"] else None} for r in rows]

@app.post("/api/upload")
async def upload(auth: str|None=Header(default=None),name:str=Form(...),kind:str=Form(...),category:str=Form(...),description:str=Form(""),file:UploadFile=File(...),image:UploadFile|None=File(default=None)):
    if not admin(auth):raise HTTPException(403,"غير مصرح")
    if kind not in ("game","file"):raise HTTPException(400,"نوع غير صحيح")
    file_id=await tg_send(file);image_id=await tg_image(image)
    c=db();c.execute("INSERT INTO files(name,kind,category,description,telegram_file_id,telegram_image_id) VALUES(?,?,?,?,?,?)",(name,kind,category,description,file_id,image_id));c.commit();c.close()
    return {"ok":True}

@app.delete("/api/files/{fid}")
async def delete(fid:int,auth: str|None=Header(default=None)):
    if not admin(auth):raise HTTPException(403,"غير مصرح")
    c=db();r=c.execute("SELECT id FROM files WHERE id=?",(fid,)).fetchone()
    if not r:c.close();raise HTTPException(404,"غير موجود")
    c.execute("DELETE FROM files WHERE id=?",(fid,));c.commit();c.close();return {"ok":True}

@app.get("/api/download/{fid}")
async def download(fid:int):
    c=db();r=c.execute("SELECT telegram_file_id FROM files WHERE id=?",(fid,)).fetchone();c.close()
    if not r:raise HTTPException(404,"غير موجود")
    path=await tg_path(r["telegram_file_id"])
    return RedirectResponse(f"https://api.telegram.org/file/bot{BOT_TOKEN}/{quote(path)}")

@app.get("/api/image/{fid}")
async def image(fid:int):
    c=db();r=c.execute("SELECT telegram_image_id FROM files WHERE id=?",(fid,)).fetchone();c.close()
    if not r or not r["telegram_image_id"]:raise HTTPException(404,"لا توجد صورة")
    path=await tg_path(r["telegram_image_id"])
    return RedirectResponse(f"https://api.telegram.org/file/bot{BOT_TOKEN}/{quote(path)}")

app.mount("/",StaticFiles(directory=BASE,html=True),name="static")
