"""Stage an isolated Unity capture project using unchanged AudioBounce sources."""
from pathlib import Path
import hashlib, json, shutil

ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path('C:/trontstack/audiobounce/unity/com.tront.audiobounce')
OUT=ROOT/'.local/native/audiobounce'
PROJECT=OUT/'project'
PACKAGE=PROJECT/'Packages/com.tront.audiobounce'
for directory in [OUT, PROJECT/'Assets/Editor', PROJECT/'ProjectSettings', PACKAGE]:
    directory.mkdir(parents=True,exist_ok=True)
files=[]
for src in SOURCE.rglob('*'):
    if not src.is_file(): continue
    rel=src.relative_to(SOURCE); dest=PACKAGE/rel
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(src,dest)
    digest=hashlib.sha256(src.read_bytes()).hexdigest()
    assert hashlib.sha256(dest.read_bytes()).hexdigest()==digest
    files.append(dict(path=rel.as_posix(),sha256=digest,bytes=src.stat().st_size))
dependencies={
    'com.unity.render-pipelines.universal':'17.0.4',
    'com.unity.inputsystem':'1.14.2',
    'com.unity.modules.audio':'1.0.0',
    'com.unity.modules.imgui':'1.0.0',
    'com.unity.modules.jsonserialize':'1.0.0',
    'com.unity.modules.physics':'1.0.0',
    'com.unity.modules.imageconversion':'1.0.0'}
(PROJECT/'Packages/manifest.json').write_text(json.dumps(dict(dependencies=dependencies),indent=2)+'\n')
(PROJECT/'ProjectSettings/ProjectVersion.txt').write_text('m_EditorVersion: 6000.0.65f1\n')
for src,dest in [('AudioBounceCapture.cs','Assets/AudioBounceCapture.cs'),('AudioBounceCaptureBatch.cs','Assets/Editor/AudioBounceCaptureBatch.cs')]:
    shutil.copy2(ROOT/'tools/game-media'/src,PROJECT/dest)
(OUT/'source-receipt.json').write_text(json.dumps(dict(source=str(SOURCE),project=str(PROJECT),files=files,
    unchangedPackage=True,notes=['Original demo component is disabled immediately after Awake to omit HUD and all desktop input polling.',
        'Original UpdateBugs and UpdateSourcePulse methods drive motion; original manager, voxelizer, compute shader and renderer run normally.',
        'Three existing bug paths are staged 0.6m higher to clear the conservatively voxelized floor; the original movement and tracing algorithms are unchanged.',
        'The original AudioBounce listener component follows a path through the rooms independently of the photography camera.',
        'Only photography cameras/light, staged source/listener positions, silent output and image recording are added.']),indent=2)+'\n')
print('Staged AudioBounce capture project,',len(files),'unchanged original package files')
