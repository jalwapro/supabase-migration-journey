import { AbsoluteFill } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { PersistentBackground } from "./components/PersistentBackground";
import { SceneLogo } from "./scenes/SceneLogo";
import { SceneFeatures } from "./scenes/SceneFeatures";
import { SceneGifts } from "./scenes/SceneGifts";
import { SceneComingSoon } from "./scenes/SceneComingSoon";
import { SceneCta } from "./scenes/SceneCta";

export const MainVideo = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#050010", overflow: "hidden" }}>
      <PersistentBackground />
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={100}>
          <SceneLogo />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={95}>
          <SceneFeatures />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: "from-right" })}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 18 })}
        />
        <TransitionSeries.Sequence durationInFrames={95}>
          <SceneGifts />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={110}>
          <SceneComingSoon />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: 15 })}
        />
        <TransitionSeries.Sequence durationInFrames={90}>
          <SceneCta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
