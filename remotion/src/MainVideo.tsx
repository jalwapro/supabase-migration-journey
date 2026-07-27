import { AbsoluteFill, Series } from "remotion";
import { PersistentBackground } from "./components/PersistentBackground";
import { SceneSplash } from "./scenes/SceneSplash";
import { SceneHome } from "./scenes/SceneHome";
import { SceneVoiceRoom } from "./scenes/SceneVoiceRoom";
import { SceneVideoRoom } from "./scenes/SceneVideoRoom";
import { ScenePkBattle } from "./scenes/ScenePkBattle";
import { SceneGifting } from "./scenes/SceneGifting";
import { SceneProfile } from "./scenes/SceneProfile";
import { SceneRanking } from "./scenes/SceneRanking";

// 40s @ 30fps = 1200 frames, 8 scenes x 150
export const MainVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#050010", overflow: "hidden" }}>
      <PersistentBackground />
      <Series>
        <Series.Sequence durationInFrames={150}><SceneSplash /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><SceneHome /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><SceneVoiceRoom /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><SceneVideoRoom /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><ScenePkBattle /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><SceneGifting /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><SceneProfile /></Series.Sequence>
        <Series.Sequence durationInFrames={150}><SceneRanking /></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
