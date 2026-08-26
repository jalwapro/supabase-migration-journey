# Voice Room deployment fix

The VoiceRoom gift animation player is intentionally self-contained and avoids the previous GiftRender/GiftMedia/SVGA dependency chain that caused the production `Cannot access 'q' before initialization` runtime crash.

This marker forces the Git-connected deployment pipeline to rebuild the current `main` source.
