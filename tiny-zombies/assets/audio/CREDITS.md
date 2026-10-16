# Recorded sound sources

The selected sound assets are adapted from the following **CC0 1.0** sources. Attribution is retained for provenance and courtesy. These credits apply to the audio bank, not to the game as a whole.

| Source | Creator | Selected material |
| --- | --- | --- |
| [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) | Ben Jaszczak, Brian Nelson, Kevin Heras, Matthew Nanney | AR-15, Mossberg and Nova single-shot excerpts |
| [Zombies Sound Pack](https://opengameart.org/content/zombies-sound-pack) | artisticdude | Short creature vocals and death layers |
| [40 CC0 Water Splash Slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | Wet impact and death layers; the author describes the set as partly recorded from real slime |
| [75 CC0 Breaking Falling Hit SFX](https://opengameart.org/content/75-cc0-breaking-falling-hit-sfx) | rubberduck | Wood and rock impacts, breaks and debris |
| [25 CC0 Bang Firework SFX](https://opengameart.org/content/25-cc0-bang-firework-sfx) | rubberduck | Short `fw_` firework attacks and decays, used for explosions |
| [Equipment Clicks III](https://opengameart.org/content/equipment-clicks-iii) | LFA | Mechanical transient excerpts from recorded rifle, stapler and tape-measure actions |

License: [Creative Commons CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).

[manifest.json](manifest.json) records source-page and archive URLs, downloaded hashes, source-entry hashes, trim ranges, layer gains, codec, processed hashes and measurements. Original archives, extracted source recordings and full license-page snapshots are preserved outside the repository in the acquisition workspace. The 194 MB firearm archive is not shipped.

Edits: select individual transients; mono conversion; resample to 48 kHz; remove DC; trim leading/trailing silence and excessive tails; retain short attack/decay fades; match levels with peak headroom; combine selected recorded layers offline; encode lossless PCM16 FLAC. No oscillator fallback is used. The original recordings are unchanged.

Selection and technical validation use source descriptions, waveform/level measurements and two independent decoders. The user listened to the selected-sample preview and approved its direction. The firework pack includes some processed effects; `fw_` files are part of that preview. No agent listening or final in-game perceptual assessment is claimed; actual browser decoding, playback and mix measurements passed as documented in [the release review](../../validation/recorded-audio-review.md).
