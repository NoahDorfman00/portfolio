#!/usr/bin/env python3
"""Scope control page: the live stream, the LED ring controls and the scope's power switch in one place.

Serves http://scope.local/ . The live view comes from MediaMTX (port 8889); this
program drives the ring, switches the scope's USB power and takes full-size still frames. Run as root (the LED
library needs it):  sudo python3 scope_ui.py
"""
import json, os, shutil, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

COUNT = 12                 # LEDs on the ring
PIN = 18                   # GPIO18 = physical pin 12
RGBW = False               # True if each LED has a white/yellow phosphor patch
PORT = 80
STREAM_PATH = "scope"      # MediaMTX path name
CAMERA = "/dev/video0"     # the scope
CAPTURE_SIZE = "1920x1080" # saved frames, whatever size the live view is
CAPTURE_SKIP = 15          # frames to let pass before the one that is kept
HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(HERE, "ring_state.json")
SHOTS = os.path.join(HERE, "shots")

TINTS = {"neutral": (255, 255, 255), "warm": (255, 170, 90), "cool": (190, 215, 255)}

try:
    from rpi_ws281x import PixelStrip, Color, ws
    kind = ws.SK6812_STRIP_GRBW if RGBW else ws.WS2811_STRIP_GRB
    ring = PixelStrip(COUNT, PIN, 800000, 10, False, 255, 0, kind)
    ring.begin()
except Exception as e:      # lets the page run on a machine with no ring, for testing
    print("LED ring not available (%s); running without it" % e)
    ring = None
    def Color(r, g, b, w=0): return (r, g, b, w)

lock = threading.Lock()
state = {"on": False, "level": 80, "lit": COUNT, "rot": 0, "arc": False, "tint": "neutral", "custom": "#ffffff",
         "flip": True}     # flip: show the picture turned 180 degrees, to match the scope hanging upside down
try:
    with open(STATE_FILE) as f:
        state.update({k: v for k, v in json.load(f).items() if k in state})
except Exception:
    pass


def clamp(v, lo, hi):
    return max(lo, min(hi, int(v)))


def lit_pixels():
    n, rot = state["lit"], state["rot"]
    if state["arc"]:                                   # one continuous run: light from one side
        return {(rot + k) % COUNT for k in range(n)}
    return {(rot + round(k * COUNT / n)) % COUNT for k in range(n)}   # spread evenly round the ring


def apply():
    if state["tint"] == "custom":
        h = state["custom"].lstrip("#")
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    else:
        r, g, b = TINTS[state["tint"]]
    s = state["level"] / 255 if state["on"] else 0
    if RGBW and state["tint"] == "neutral":
        c = Color(0, 0, 0, int(255 * s))
    else:
        c = Color(int(r * s), int(g * s), int(b * s))
    on = lit_pixels()
    if ring:
        for i in range(COUNT):
            ring.setPixelColor(i, c if i in on else Color(0, 0, 0))
        ring.show()


def update(changes):
    with lock:
        if "on" in changes: state["on"] = bool(changes["on"])
        if "arc" in changes: state["arc"] = bool(changes["arc"])
        if "flip" in changes: state["flip"] = bool(changes["flip"])
        if "level" in changes: state["level"] = clamp(changes["level"], 0, 255)
        if "lit" in changes: state["lit"] = clamp(changes["lit"], 1, COUNT)
        if "rot" in changes: state["rot"] = int(changes["rot"]) % COUNT
        if changes.get("tint") in list(TINTS) + ["custom"]: state["tint"] = changes["tint"]
        c = str(changes.get("custom", ""))
        if len(c) == 7 and c[0] == "#" and all(ch in "0123456789abcdefABCDEF" for ch in c[1:]):
            state["custom"] = c
        apply()
        try:
            with open(STATE_FILE, "w") as f:
                json.dump(state, f)
        except Exception:
            pass
        return dict(state, count=COUNT, scope=scope_on, health=health)


# ---- scope power: the Pi 3 B switches all four USB ports together (hub 1-1, port 2) ----
HUB = ["-l", "1-1", "-p", "2"]
UHUBCTL = shutil.which("uhubctl") or "/usr/sbin/uhubctl"
scope_lock = threading.Lock()
scope_on = True


def scope_read():
    """True if USB power is on. Assumes on if uhubctl can't be run."""
    try:
        out = subprocess.run([UHUBCTL] + HUB, capture_output=True, text=True, timeout=10).stdout
        for line in out.splitlines():
            if line.strip().startswith("Port 2:"):
                return "off" not in line.split()
    except Exception as e:
        print("uhubctl not available (%s)" % e)
    return True


def scope_set(on):
    global scope_on
    with scope_lock:
        if on:
            subprocess.run([UHUBCTL] + HUB + ["-a", "on"], capture_output=True, timeout=15)
            subprocess.run(["systemctl", "start", "mediamtx"], capture_output=True, timeout=30)
        else:
            # stop the video service first, so it isn't left retrying a camera that's gone
            subprocess.run(["systemctl", "stop", "mediamtx"], capture_output=True, timeout=30)
            subprocess.run([UHUBCTL] + HUB + ["-a", "off"], capture_output=True, timeout=15)
        scope_on = scope_read()
        return scope_on


# ---- health: power, temperature and Wi-Fi, refreshed in the background every 10 s ----
health = {"power": None, "dipped": None, "temp": None, "wifi": None}


def health_read():
    h = {"power": None, "dipped": None, "temp": None, "wifi": None}
    try:    # bit 0 = under-voltage now, bit 16 = under-voltage at some point since boot
        out = subprocess.run(["vcgencmd", "get_throttled"], capture_output=True, text=True, timeout=5).stdout
        v = int(out.strip().split("=")[1], 16)
        h["power"], h["dipped"] = not (v & 0x1), bool(v & 0x10000)
    except Exception:
        pass
    try:
        with open("/sys/class/thermal/thermal_zone0/temp") as f:
            h["temp"] = round(int(f.read()) / 1000)
    except Exception:
        pass
    try:
        with open("/proc/net/wireless") as f:
            for line in f:
                if line.strip().startswith("wlan0:"):
                    h["wifi"] = int(float(line.split()[3]))
    except Exception:
        pass
    return h


def health_loop():
    global health
    while True:
        health = health_read()
        time.sleep(10)


def snapshot():
    """One full-size frame straight from the scope. The live view is a small low-rate stream (the Pi's Wi-Fi
    can't carry more and stay responsive), so for a capture the stream is stopped, the camera is opened at
    full size in its JPEG mode, and the stream is started again. The live view pauses for a few seconds."""
    os.makedirs(SHOTS, exist_ok=True)
    name = "scope_%s_L%03d_n%02d_%s.jpg" % (time.strftime("%Y%m%d_%H%M%S"), state["level"] if state["on"] else 0,
                                            state["lit"], state["tint"])
    path = os.path.join(SHOTS, name)
    vf = "select=gte(n\\,%d)" % CAPTURE_SKIP          # let the exposure settle after the mode change
    if state["flip"]:
        vf += ",hflip,vflip"                            # same 180 degree turn as the page
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "v4l2", "-input_format", "mjpeg",
           "-video_size", CAPTURE_SIZE, "-i", CAMERA, "-vf", vf, "-frames:v", "1", "-q:v", "1", path]
    with scope_lock:
        if not scope_on:
            raise RuntimeError("the microscope is off")
        subprocess.run(["systemctl", "stop", "mediamtx"], capture_output=True, timeout=30)
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        finally:
            subprocess.run(["systemctl", "start", "mediamtx"], capture_output=True, timeout=30)
    if r.returncode != 0 or not os.path.exists(path):
        raise RuntimeError((r.stderr or "the camera gave no frame").strip().splitlines()[-1])
    with open(path, "rb") as f:
        return name, f.read()


PAGE = r"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scope</title>
<style>
:root{--bg:#15171a;--panel:#1d2024;--line:#2e3238;--fg:#e8eaed;--muted:#9aa0a8;--accent:#ffb341}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
.wrap{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;padding:16px;max-width:1700px;margin:0 auto}
@media (max-width:900px){.wrap{grid-template-columns:minmax(0,1fr)}}
.video{background:#000;aspect-ratio:16/9;border:1px solid var(--line);position:relative}
.video .off{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#000;color:var(--muted)}
.video.isoff .off{display:flex}
.rule{border:0;border-top:1px solid var(--line);margin:0}
.video video{width:100%;height:100%;display:block;object-fit:contain;background:#000}
.video video.flip{transform:rotate(180deg)}
.video:fullscreen{border:0;aspect-ratio:auto}
.panel{background:var(--panel);border:1px solid var(--line);padding:16px;display:grid;gap:18px;align-content:start}
h1{font-size:15px;font-weight:600;margin:0;display:flex;justify-content:space-between;align-items:center}
label{display:flex;justify-content:space-between;color:var(--muted);font-size:13px}
label b{color:var(--fg);font-weight:500;font-variant-numeric:tabular-nums}
input[type=range]{width:100%;accent-color:var(--accent);margin:6px 0 0}
.row{display:flex;gap:8px;flex-wrap:wrap}
button{font:inherit;font-size:13px;color:var(--fg);background:transparent;border:1px solid var(--line);padding:7px 11px;cursor:pointer}
button:hover{border-color:var(--muted)}
button[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#15171a}
button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.power{padding:9px 16px}
.grow{flex:1}
input[type=color]{width:38px;height:33px;padding:0;border:1px solid var(--line);background:none}
#msg{color:var(--muted);font-size:13px;min-height:1.4em}
#msg.warn{color:var(--accent)}
#health{color:var(--muted);font-size:12px;border-top:1px solid var(--line);padding-top:12px}
#health.warn{color:var(--accent)}
svg{display:block;margin:0 auto}
</style></head><body>
<div class="wrap">
  <div class="video"><video id="vid" aria-label="Live microscope view" autoplay muted playsinline></video><div class="off" id="offmsg">Connecting...</div></div>
  <div class="panel">
    <h1>Microscope <button id="scope" class="power" aria-pressed="true">On</button></h1>
    <hr class="rule">
    <h1>Ring light <button id="on" class="power" aria-pressed="false">Off</button></h1>
    <div><label for="level">Brightness <b id="levelV"></b></label><input id="level" type="range" min="0" max="255"></div>
    <div><label for="lit">LEDs lit <b id="litV"></b></label><input id="lit" type="range" min="1" max="12"></div>
    <div class="row"><button id="spread" class="grow">All round</button><button id="arc" class="grow">One side</button></div>
    <div><label for="rot">Turn <b id="rotV"></b></label><input id="rot" type="range" min="0" max="11"></div>
    <svg id="dial" width="120" height="120" viewBox="-60 -60 120 120" aria-hidden="true"></svg>
    <div class="row"><button data-tint="neutral" class="grow">Neutral</button><button data-tint="warm" class="grow">Warm</button><button data-tint="cool" class="grow">Cool</button><input id="custom" type="color" aria-label="Custom color"></div>
    <div class="row"><button id="shot" class="grow">Save a frame</button><button id="flip" class="grow">Turned 180&deg;</button></div>
    <div class="row"><button id="full" class="grow">Full screen</button></div>
    <div id="msg"></div>
    <div id="health"></div>
  </div>
</div>
<script>
const $=id=>document.getElementById(id);
// The page plays the stream itself: it asks MediaMTX for a WebRTC session (WHEP) and shows it in its own video element.
const WHEP=location.protocol+'//'+location.hostname+':8889/__PATH__/whep';
let scopeBusy=false, shownScope=null, pc=null, wantVideo=false, retryTimer=null;
function note(t){ $('offmsg').textContent=t; document.querySelector('.video').classList.toggle('isoff',!!t); }
function stopVideo(msg){ wantVideo=false; clearTimeout(retryTimer); if(pc){const p=pc; pc=null; p.close();} $('vid').srcObject=null; note(msg||''); }
function retryVideo(){ if(!wantVideo) return; if(pc){const p=pc; pc=null; p.close();} note('Waiting for video...'); clearTimeout(retryTimer); retryTimer=setTimeout(startVideo,2500); }
async function startVideo(){
  clearTimeout(retryTimer); if(pc){const p=pc; pc=null; p.close();}
  wantVideo=true; if(!$('vid').srcObject) note('Connecting...');
  const me=pc=new RTCPeerConnection();
  me.addTransceiver('video',{direction:'recvonly'});
  me.ontrack=e=>{ $('vid').srcObject=e.streams[0]||new MediaStream([e.track]); $('vid').play().catch(()=>{}); };
  me.onconnectionstatechange=()=>{ if(me!==pc) return;
    if(me.connectionState==='connected') note('');
    else if(['failed','disconnected','closed'].includes(me.connectionState)) retryVideo(); };
  try{
    await me.setLocalDescription(await me.createOffer());
    await new Promise(ok=>{ if(me.iceGatheringState==='complete') return ok(); const t=setTimeout(ok,1500);
      me.addEventListener('icegatheringstatechange',()=>{ if(me.iceGatheringState==='complete'){ clearTimeout(t); ok(); } }); });
    if(me!==pc) return;
    const r=await fetch(WHEP,{method:'POST',headers:{'Content-Type':'application/sdp'},body:me.localDescription.sdp});
    if(me!==pc) return; if(!r.ok) throw new Error('video service said '+r.status);
    await me.setRemoteDescription({type:'answer',sdp:await r.text()});
  }catch(e){ if(me===pc) retryVideo(); }
}
let s={}, timer=null, pending={};
function drawHealth(){
  const h=s.health||{}, el=$('health'), bits=[]; let warn=false;
  if(h.power===false){ warn=true; bits.push('Low voltage at the Pi right now. Controls and video will lag: check the power lead.'); }
  else if(h.power===true) bits.push(h.dipped?'Power OK now (dipped since the last restart)':'Power OK');
  if(h.temp!=null){ if(h.temp>=80){ warn=true; bits.push('Pi is hot: '+h.temp+' \u00b0C'); } else bits.push(h.temp+' \u00b0C'); }
  if(h.wifi!=null){ if(h.wifi<-72){ warn=true; bits.push('Weak Wi-Fi: '+h.wifi+' dBm'); } else bits.push('Wi-Fi '+h.wifi+' dBm'); }
  el.textContent=bits.join(' \u00b7 '); el.className=warn?'warn':'';
}
function draw(){
  drawHealth();
  $('vid').classList.toggle('flip',!!s.flip); $('flip').setAttribute('aria-pressed',!!s.flip);
  if(!scopeBusy && s.scope!==shownScope){ shownScope=s.scope; $('scope').textContent=s.scope?'On':'Off'; $('scope').setAttribute('aria-pressed',s.scope);
    if(s.scope) startVideo(); else stopVideo('Microscope is off'); }
  $('on').textContent=s.on?'On':'Off'; $('on').setAttribute('aria-pressed',s.on);
  $('level').value=s.level; $('levelV').textContent=Math.round(s.level/2.55)+'%';
  $('lit').max=s.count; $('lit').value=s.lit; $('litV').textContent=s.lit+' of '+s.count;
  $('rot').max=s.count-1; $('rot').value=s.rot; $('rotV').textContent=s.rot;
  $('spread').setAttribute('aria-pressed',!s.arc); $('arc').setAttribute('aria-pressed',s.arc);
  document.querySelectorAll('[data-tint]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tint===s.tint));
  $('custom').value=s.custom;
  const on=new Set(); for(let k=0;k<s.lit;k++) on.add(((s.arc? s.rot+k : s.rot+Math.round(k*s.count/s.lit))%s.count+s.count)%s.count);
  let h='<circle r="44" fill="none" stroke="#2e3238" stroke-width="14"/>';
  for(let i=0;i<s.count;i++){const a=i/s.count*2*Math.PI-Math.PI/2;
    h+='<circle cx="'+(44*Math.cos(a)).toFixed(1)+'" cy="'+(44*Math.sin(a)).toFixed(1)+'" r="5" fill="'+(on.has(i)&&s.on?'#ffb341':'#4a4f57')+'"/>';}
  $('dial').innerHTML=h;
  $('msg').className=(s.on&&s.level>200)?'warn':''; if(s.on&&s.level>200) $('msg').textContent='Above 80% the ring gets hot. Keep it brief.'; else if($('msg').className==='') {if($('msg').dataset.keep!=='1')$('msg').textContent='';}
}
async function send(ch){
  Object.assign(pending,ch); Object.assign(s,ch); $('msg').dataset.keep='0'; draw();
  if(timer) return;
  timer=setTimeout(async()=>{timer=null; const body=JSON.stringify(pending); pending={};
    try{const r=await fetch('/api/state',{method:'POST',headers:{'Content-Type':'application/json'},body}); s=await r.json(); draw();}
    catch(e){$('msg').textContent='Lost contact with the Pi.';}},60);
}
$('on').onclick=()=>send({on:!s.on});
$('flip').onclick=()=>send({flip:!s.flip});
$('full').onclick=()=>{ const v=document.querySelector('.video'); if(document.fullscreenElement) document.exitFullscreen(); else v.requestFullscreen().catch(()=>{}); };
document.querySelector('.video').ondblclick=$('full').onclick;
$('scope').onclick=async()=>{
  if(scopeBusy) return; const want=!s.scope; scopeBusy=true; $('scope').disabled=true; $('scope').textContent=want?'Starting...':'Stopping...';
  if(want) note('Starting the microscope...'); else stopVideo('Stopping...');
  try{ const r=await fetch('/api/scope',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({on:want})}); s.scope=(await r.json()).scope;
  }
  catch(e){ $('msg').dataset.keep='1'; $('msg').textContent='Could not switch the microscope.'; }
  scopeBusy=false; $('scope').disabled=false; shownScope=null; draw();
};
$('level').oninput=e=>send({level:+e.target.value});
$('lit').oninput=e=>send({lit:+e.target.value});
$('rot').oninput=e=>send({rot:+e.target.value});
$('spread').onclick=()=>send({arc:false}); $('arc').onclick=()=>send({arc:true});
document.querySelectorAll('[data-tint]').forEach(b=>b.onclick=()=>send({tint:b.dataset.tint}));
$('custom').oninput=e=>send({tint:'custom',custom:e.target.value});
$('shot').onclick=async()=>{
  $('shot').disabled=true; $('msg').dataset.keep='1'; $('msg').className=''; $('msg').textContent='Taking a full-size frame. The live view pauses for a few seconds...';
  try{const r=await fetch('/api/snapshot'); if(!r.ok) throw new Error(await r.text());
    const name=(r.headers.get('X-Filename')||'scope.jpg'); const url=URL.createObjectURL(await r.blob());
    const a=document.createElement('a'); a.href=url; a.download=name; a.click(); URL.revokeObjectURL(url);
    $('msg').textContent='Saved '+name+' (also kept on the Pi).';}
  catch(e){$('msg').textContent='Could not grab a frame: '+e.message;}
  $('shot').disabled=false;
};
fetch('/api/state').then(r=>r.json()).then(j=>{s=j;draw();}).catch(()=>{$('msg').textContent='Could not reach the Pi.';});
setInterval(()=>{if(timer||document.hidden)return;fetch("/api/state").then(r=>r.json()).then(j=>{if(timer)return;s=j;draw();}).catch(()=>{});},5000);
</script></body></html>
""".replace("__PATH__", STREAM_PATH)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    disable_nagle_algorithm = True      # send each reply at once instead of waiting on the previous packet
    def log_message(self, *a):
        pass

    def reply(self, code, ctype, body, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.reply(200, "text/html; charset=utf-8", PAGE.encode())
        elif self.path == "/api/state":
            with lock:
                body = json.dumps(dict(state, count=COUNT, scope=scope_on, health=health)).encode()
            self.reply(200, "application/json", body)
        elif self.path == "/api/snapshot":
            try:
                name, data = snapshot()
                self.reply(200, "image/jpeg", data, {"X-Filename": name})
            except Exception as e:
                self.reply(500, "text/plain", ("no frame (%s)" % e).encode())
        else:
            self.reply(404, "text/plain", b"not found")

    def do_POST(self):
        if self.path not in ("/api/state", "/api/scope"):
            return self.reply(404, "text/plain", b"not found")
        try:
            n = int(self.headers.get("Content-Length", 0))
            changes = json.loads(self.rfile.read(n) or b"{}")
            if self.path == "/api/scope":
                self.reply(200, "application/json", json.dumps({"scope": scope_set(bool(changes.get("on")))}).encode())
            else:
                self.reply(200, "application/json", json.dumps(update(changes)).encode())
        except Exception as e:
            self.reply(400, "text/plain", str(e).encode())


if __name__ == "__main__":
    scope_on = scope_read()
    threading.Thread(target=health_loop, daemon=True).start()
    with lock:
        apply()
    port = int(os.environ.get("SCOPE_UI_PORT", PORT))
    print("Scope page on port %d" % port)
    try:
        ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        state["on"] = False
        apply()
