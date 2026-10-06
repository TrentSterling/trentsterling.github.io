"""Prepare local card derivatives; originals are never overwritten.

Run after capture.cjs. Only this script downloads missing source artwork from
the public site. Captures and source copies stay in ignored .local/.
"""
from pathlib import Path
from html import unescape, escape
import hashlib, json, re, shutil, subprocess, urllib.request

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / '.local'
MEDIA = ROOT / 'games/media'
for directory in [LOCAL / 'sources', MEDIA]:
    directory.mkdir(parents=True, exist_ok=True)
baseline = LOCAL / 'games-original.html'
if not baseline.exists():
    baseline.write_bytes((ROOT / 'games/index.html').read_bytes())
html = baseline.read_text(encoding='utf-8')
manifest = []
title_overrides={'Project Demigod (2025-Present)':'demigod','Scamper (2024-2025)':'scamper','FezCraft (2014)':'fezcraft'}
cache_file = LOCAL/'derivative-cache.json'
cache = json.loads(cache_file.read_text(encoding='utf-8')) if cache_file.exists() else {}
recipes_file=ROOT/'tools/game-media/montages.json'
recipes=json.loads(recipes_file.read_text(encoding='utf-8')) if recipes_file.exists() else {}

def fresh(src,dest,settings):
    key=str(dest.relative_to(ROOT))
    signature=[str(src),src.stat().st_mtime_ns,src.stat().st_size,settings]
    if cache.get(key)==signature and dest.exists() and dest.stat().st_size:
        return True
    cache[key]=signature
    return False

def ffmpeg(args):
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-nostdin','-y',*map(str,args)],check=True)

def probe(file):
    return json.loads(subprocess.check_output(['ffprobe','-v','error','-count_frames','-show_entries','stream=codec_name,width,height,avg_frame_rate,nb_read_frames:format=duration,size','-of','json',str(file)],text=True))

def poster(src, dest, timestamp=0, framing=''):
    if fresh(src,dest,['poster-v1',timestamp,framing]): return
    seek=['-ss',timestamp] if timestamp else []
    ffmpeg([*seek,'-i',src,'-frames:v','1','-vf',framing+'scale=min(640\\,iw):-2','-c:v','libwebp','-quality','80',dest])
    if dest.stat().st_size == 0:
        raise RuntimeError('Empty poster: '+str(dest))

def clip(src,dest,framing='',busy=False,slug=''):
    if fresh(src,dest,['clip-v3-five-seconds',framing,busy,slug]): return
    fps=24 if busy else 30
    width=480 if slug=='vibeduders' else 640
    crf='32' if slug=='vibeduders' else '29' if busy else '25'
    duration='3.4' if slug=='vibecraft' else '5'
    ffmpeg(['-i',src,'-t',duration,'-an','-vf',f'fps={fps},'+framing+f'scale=trunc(min({width}\\,iw)/2)*2:-2','-c:v','libx264','-preset','slow','-crf',crf,'-pix_fmt','yuv420p','-movflags','+faststart',dest])
    subprocess.run(['ffmpeg','-v','error','-nostdin','-i',str(dest),'-f','null','-'],check=True,stdout=subprocess.DEVNULL)

def transform(match):
    card = match.group(0)
    im = re.search(r'<img\b[^>]*class="bg-image"[^>]*>',card)
    if not im:
        href=unescape(re.search(r'\bhref="([^"]+)"',card)[1])
        slug=href.replace('https://tront.xyz','').strip('/').split('/')[0]
        master=next((p for p in [LOCAL/'masters'/(slug+'.mp4'),LOCAL/'masters'/(slug+'.webm')] if p.exists()),None)
        if not master: return card
        card=re.sub(r'<div class="placeholder-content">.*?</div>','<img class="bg-image" src="/'+master.relative_to(ROOT).as_posix()+'" alt="Gameplay">',card,count=1,flags=re.S)
        im=re.search(r'<img\b[^>]*class="bg-image"[^>]*>',card)
    tag=im.group(0)
    url=unescape(re.search(r'\bsrc="([^"]+)"',tag)[1])
    title=unescape(re.sub('<[^>]+>','',re.search(r'<h3[^>]*>(.*?)</h3>',card)[1])).strip()
    href=unescape(re.search(r'\bhref="([^"]+)"',card)[1])
    slug=title_overrides.get(title,href.replace('https://tront.xyz','').strip('/').split('/')[0])
    name = re.sub('[^a-z0-9]+','-',title.lower()).strip('-')
    source = ROOT / url.split('?')[0].lstrip('/')
    original_source = source
    if not source.exists():
        source=LOCAL/'sources'/(hashlib.sha256(url.encode()).hexdigest()[:12]+Path(url.split('?')[0]).suffix)
        if not source.exists():
            request=urllib.request.Request(urllib.request.urljoin('https://tront.xyz/',url),headers={'User-Agent':'Tront-local-media-audit'})
            with urllib.request.urlopen(request,timeout=40) as response:
                source.write_bytes(response.read())
    row={'title':title,'original':url,'originalBytes':0 if url.startswith('/.local/masters/') else source.stat().st_size}
    master=next((p for p in [LOCAL/'masters'/(slug+'.mp4'),LOCAL/'masters'/(slug+'.webm')] if p.exists()),None)
    montage=LOCAL/'montages'/(name+'.mp4')
    edited=montage.exists() and name in recipes
    is_gif=source.suffix.lower()=='.gif'
    if edited or master or is_gif:
        actual=montage if edited else master or source
        video=MEDIA/(name+'.mp4')
        image=MEDIA/(name+'.webp')
        framing = ''
        if not edited and master and slug == 'aqua-empire':
            framing = 'crop=864:486:208:174,'
        elif not edited and master and slug == 'tinytreads':
            # The source canvas includes an unused 190px strip below the battlefield.
            # Preserve both tanks instead of letting object-fit crop the sides away.
            framing = 'crop=1200:500:0:110,scale=640:266,pad=640:360:0:47:color=0x08141b,'
        elif not edited and master and slug in ['pachinko','spheres']:
            framing='scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=0x10151a,'
        if edited:
            # Already encoded from original footage; do not introduce another generation.
            if not fresh(actual,video,['reviewed-montage-v1']):shutil.copy2(actual,video)
        else:
            clip(actual,video,framing,slug in ['senddudes','vibeduders','ballpit'],slug)
        poster_seconds = .6 if edited else 4 if master and slug == 'tinytreads' else 1
        poster(actual,image,poster_seconds,framing)
        info=probe(video)
        receipt=LOCAL/'masters'/(slug+'.json')
        archived=bool(master and receipt.exists() and json.loads(receipt.read_text(encoding='utf-8')).get('kind')=='archive-excerpt')
        row.update(video='/games/media/'+video.name,videoBytes=video.stat().st_size,videoInfo=info,kind='gameplay-capture' if master and not archived else 'archived-gameplay',master=str(actual.relative_to(ROOT)),framing=framing,posterSeconds=poster_seconds)
        if edited:
            row.update(kind=recipes[name]['kind'],edit=recipes[name],originalMaster=recipes[name]['shots'][0]['source'])
        video_version=hashlib.sha256(video.read_bytes()).hexdigest()[:12]
        card=card.replace('class="image-container"','class="image-container" id="preview-'+name+'" data-preview="'+row['video']+'?v='+video_version+'"',1)
        alt=title+' gameplay' if master else title+' archive footage'
    else:
        image=MEDIA/(name+'.webp')
        poster(source,image)
        alt=unescape(re.search(r'\balt="([^"]*)"',tag)[1])
        row['kind']='still'
    row.update(poster='/games/media/'+image.name,posterBytes=image.stat().st_size)
    manifest.append(row)
    # Keep one lazy image as the no-script, reduced-motion, and playback-error fallback.
    poster_version=hashlib.sha256(image.read_bytes()).hexdigest()[:12]
    newtag='<img class="bg-image" src="'+row['poster']+'?v='+poster_version+'" alt="'+escape(alt,quote=True)+'" loading="lazy" decoding="async" width="640" height="360">'
    card=card.replace(tag,newtag)
    print(row['kind'],title,row.get('videoBytes',0),row['posterBytes'],flush=True)
    return card

html=re.sub(r'<a\b[^>]*class="item\b[^>]*>.*?</a>',transform,html,flags=re.S)
html=html.replace('</head>','    <link rel="stylesheet" href="/games/gallery-motion.css">\n    <script defer src="/games/gallery-motion.js"></script>\n    <noscript><style>body{opacity:1;visibility:visible}</style></noscript>\n</head>')
html=html.replace('<main class="grid">','<div class="preview-controls"><button id="preview-toggle" class="preview-toggle" type="button" aria-pressed="false" hidden>Pause previews</button></div>\n        <main class="grid">',1)
(ROOT/'games/index.html').write_text(html,encoding='utf-8',newline='\n')
(LOCAL/'media-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
cache_file.write_text(json.dumps(cache,indent=2),encoding='utf-8')
summary={'cardsWithImages':len(manifest),'previews':sum('video' in r for r in manifest),'originalBytes':sum(r['originalBytes'] for r in manifest),'posterBytes':sum(r['posterBytes'] for r in manifest),'videoBytes':sum(r.get('videoBytes',0) for r in manifest)}
print('MEDIA COMPLETE',json.dumps(summary),flush=True)
