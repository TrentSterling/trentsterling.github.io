using System;
using System.Collections.Generic;
using System.Collections;
using System.IO;
using System.Reflection;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using AudioBounce.Unity.Components;
using AudioBounce.Unity.Samples;
#if UNITY_EDITOR
using UnityEditor;
#endif

[DefaultExecutionOrder(10000)]
public class AudioBounceCapture : MonoBehaviour
{
    const int Fps = 60, Frames = 1080, Warmup = 90;
    AudioBounceDemoScene demo;
    MethodInfo bugs, pulse;
    Camera cameraView;
    AudioBounceListener listener;
    RenderTexture target;
    Texture2D readback;
    string output, frameDirectory;
    int tick, captured;
    bool completed;
    readonly List<Sample> samples = new();
    readonly List<string> errors = new();
    double startWall;

    [Serializable] public class SourceState
    {
        public string name;
        public Vector3 position;
        public float occlusion, indirect, hitDistance;
    }
    [Serializable] public class Sample
    {
        public int frame, rays, segments, occupiedVoxels, liveSegments, reflectedSegments;
        public Vector3 camera, listener;
        public List<SourceState> sources;
    }
    [Serializable] public class Receipt
    {
        public string unity, gpu, graphicsApi, output, frameDirectory;
        public int width, height, frames, fps;
        public double wallSeconds;
        public bool offscreen, simulationStepCapture;
        public List<Sample> samples;
        public List<string> errors;
    }

    void Awake()
    {
        if (!Application.isPlaying) return;
        if (!Application.isBatchMode) throw new InvalidOperationException("Batch capture only");
        output = Path.GetFullPath(Path.Combine(Application.dataPath,"../.."));
        frameDirectory = Path.Combine(output,"frames-raised-bugs");
        Directory.CreateDirectory(frameDirectory);
        Application.logMessageReceived += OnLog;
        Application.runInBackground = true;
        AudioListener.volume = 0;
        Time.captureFramerate = Fps;
        QualitySettings.vSyncCount = 0;
        UnityEngine.Random.InitState(1062026);
        demo = new GameObject("Original AudioBounce demo").AddComponent<AudioBounceDemoScene>();
        demo.enabled = false;
        // The original tiny bug sources sit inside the conservative floor voxels.
        // Stage their existing paths 0.6m higher so their moving rays are visible.
        var bugList = (IList)typeof(AudioBounceDemoScene).GetField("_bugs",BindingFlags.Instance|BindingFlags.NonPublic).GetValue(demo);
        foreach(var bug in bugList)
        {
            var type=bug.GetType();
            var waypoints=(Vector3[])type.GetField("waypoints").GetValue(bug);
            for(int i=0;i<waypoints.Length;i++) waypoints[i] += Vector3.up*.6f;
            ((Transform)type.GetField("transform").GetValue(bug)).position += Vector3.up*.6f;
        }
        bugs = typeof(AudioBounceDemoScene).GetMethod("UpdateBugs",BindingFlags.Instance|BindingFlags.NonPublic);
        pulse = typeof(AudioBounceDemoScene).GetMethod("UpdateSourcePulse",BindingFlags.Instance|BindingFlags.NonPublic);
        cameraView = Camera.main;
        cameraView.GetComponent<AudioBounceListener>().enabled = false;
        cameraView.GetComponent<AudioListener>().enabled = false;
        listener = new GameObject("Listener walking through original rooms").AddComponent<AudioBounceListener>();
        listener.gameObject.AddComponent<AudioListener>();
        cameraView.enabled = false;
        cameraView.fieldOfView = 48;
        cameraView.aspect = 16f/9f;
        target = new RenderTexture(1280,720,24,RenderTextureFormat.ARGB32);
        target.Create();
        readback = new Texture2D(1280,720,TextureFormat.RGB24,false);
        var sun = new GameObject("Photography key light").AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.intensity = 1.15f;
        sun.transform.rotation = Quaternion.Euler(42,-35,0);
        RenderSettings.ambientMode = AmbientMode.Flat;
        RenderSettings.ambientLight = new Color(.4f,.42f,.48f);
        FindFirstObjectByType<AudioBounceDebugRenderer>().ShowVoxels = false;
        startWall = Time.realtimeSinceStartupAsDouble;
        Debug.Log("[AudioBounceCapture] Demo created; GPU="+SystemInfo.graphicsDeviceName);
    }

    void OnLog(string message,string trace,LogType type)
    {
        if (type == LogType.Error || type == LogType.Exception || type == LogType.Assert)
            errors.Add(message+"\n"+trace);
    }

    void Update()
    {
        if (demo == null || completed) return;
        bugs.Invoke(demo,null);
        pulse.Invoke(demo,null);
        float t = Mathf.Max(0,tick-Warmup)/(float)Fps;
        listener.transform.position = new Vector3(0,1.7f,Mathf.Lerp(0,25,t/18));
        Vector3 position, look;
        if(t<6)
        {
            float a = (-55+t*2.3f)*Mathf.Deg2Rad;
            position = new Vector3(Mathf.Sin(a)*30,25,14+Mathf.Cos(a)*30);
            look = new Vector3(0,1,14);
        }
        else if(t<12)
        {
            float u = (t-6)/6;
            position = Vector3.Lerp(new Vector3(8,11,0),new Vector3(-2,8,2),u);
            look = new Vector3(-3,1,4);
        }
        else
        {
            float u = (t-12)/6;
            position = Vector3.Lerp(new Vector3(8,13,28),new Vector3(-3,10,30),u);
            look = new Vector3(0,1,24);
        }
        cameraView.transform.position = position;
        cameraView.transform.LookAt(look);
    }

    void LateUpdate()
    {
        if (demo == null || completed) return;
        try
        {
            tick++;
            if(tick <= Warmup) return;
            var manager = AudioBounceManager.Instance;
            if(!manager.IsInitialized || manager.DebugLineCount == 0)
                throw new InvalidOperationException("Original GPU ray simulation did not initialize");
            var request = new UniversalRenderPipeline.SingleCameraRequest { destination=target };
            RenderPipeline.SubmitRenderRequest(cameraView,request);
            RenderTexture.active = target;
            readback.ReadPixels(new Rect(0,0,1280,720),0,0,false);
            readback.Apply(false);
            RenderTexture.active = null;
            File.WriteAllBytes(Path.Combine(frameDirectory,captured.ToString("D5")+".jpg"),readback.EncodeToJPG(97));
            if(captured%60==0) SampleState(manager);
            captured++;
            if(captured%120==0) Debug.Log("[AudioBounceCapture] Recorded "+captured+" / "+Frames);
            if(captured>=Frames) Finish();
        }
        catch(Exception ex)
        {
            errors.Add(ex.ToString());
            Finish();
        }
    }

    void SampleState(AudioBounceManager manager)
    {
        int occupied=0;
        foreach(var cell in manager.DebugVoxelWorld.Grid) if(cell>0) occupied++;
        var sample = new Sample { frame=captured,rays=manager.DebugRayCount,
            segments=manager.DebugLineCount,occupiedVoxels=occupied,camera=cameraView.transform.position,
            listener=listener.transform.position,sources=new() };
        var lines=new DebugLineGPU[manager.DebugLineCount];
        manager.DebugLineBuffer.GetData(lines,0,0,lines.Length);
        foreach(var segment in lines)
        {
            if(segment.energy>.001f) sample.liveSegments++;
            if(segment.energy>.001f && segment.bounceLevel>=1) sample.reflectedSegments++;
        }
        foreach(var source in FindObjectsByType<AudioBounceSource>(FindObjectsSortMode.None))
            sample.sources.Add(new SourceState { name=source.name,position=source.transform.position,
                occlusion=source.CurrentOcclusion,indirect=source.IndirectRatio,hitDistance=source.AverageHitDistance });
        samples.Add(sample);
    }

    void Finish()
    {
        completed=true;
        var receipt = new Receipt { unity=Application.unityVersion,gpu=SystemInfo.graphicsDeviceName,
            graphicsApi=SystemInfo.graphicsDeviceType.ToString(),output=output,frameDirectory=frameDirectory,width=1280,height=720,
            frames=captured,fps=Fps,wallSeconds=Time.realtimeSinceStartupAsDouble-startWall,
            offscreen=Application.isBatchMode,simulationStepCapture=true,samples=samples,errors=errors };
        File.WriteAllText(Path.Combine(output,"capture.json"),JsonUtility.ToJson(receipt,true));
        bool passed=captured==Frames && errors.Count==0;
        Debug.Log("[AudioBounceCapture] "+(passed?"COMPLETE":"FAILED")+" frames="+captured+" errors="+errors.Count);
#if UNITY_EDITOR
        EditorApplication.Exit(passed?0:1);
#else
        Application.Quit(passed?0:1);
#endif
    }
}
