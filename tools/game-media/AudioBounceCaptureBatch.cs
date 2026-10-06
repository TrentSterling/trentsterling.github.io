using System;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public static class AudioBounceCaptureBatch
{
    public static void Run()
    {
        if (!Application.isBatchMode) throw new InvalidOperationException("Offscreen batch mode is required.");
        var renderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>("Assets/CaptureRenderer.asset");
        if(renderer == null)
        {
            renderer = ScriptableObject.CreateInstance<UniversalRendererData>();
            AssetDatabase.CreateAsset(renderer, "Assets/CaptureRenderer.asset");
        }
        var pipeline = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/CapturePipeline.asset");
        if(pipeline == null)
        {
            pipeline = UniversalRenderPipelineAsset.Create(renderer);
            pipeline.msaaSampleCount = 4;
            AssetDatabase.CreateAsset(pipeline, "Assets/CapturePipeline.asset");
        }
        GraphicsSettings.defaultRenderPipeline = pipeline;
        QualitySettings.renderPipeline = pipeline;
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        new GameObject("Offscreen portfolio capture").AddComponent<AudioBounceCapture>();
        EditorSettings.enterPlayModeOptionsEnabled = true;
        EditorSettings.enterPlayModeOptions = EnterPlayModeOptions.DisableDomainReload;
        EditorApplication.isPlaying = true;
        Debug.Log("[AudioBounceCapture] Entering isolated play mode");
    }
}
