# 🎯 Jenn's Farm — Backlog & What's Next

The 6 remaining tracked items, split by **who can move them** — so an autonomous
agent knows what's safe to grind solo vs. what's waiting on Trent.

## 🟡 In progress (agent can keep advancing solo)
- **#8 Multiplayer** — sync *data layer* is done & tested (`netsync.js`: tile-delta
  protocol + remote-peer interpolation). Next solo slices: record deltas at live
  edit sites; serialize buildings via the registry. **Then needs Trent** for the
  PeerJS transport + host/join UI (a real second peer to test against).
- **#9 Modularize** — registry/mod-loader is in; remaining: migrate the rest of the
  save through `serializeSystems` (do it backward-compatibly — the live save matters).
- **#12 Idle autoplay** — working (AFK auto-water/weed/collect; factory employees).
  Effectively complete; could add a maintenance-priority polish.
- **#35 Performance** — ongoing; grass density already cut, instancing in place.
  Candidates: tighter culling, instanced crops, draw-call audit.

## ⬜ Needs Trent (decisions or assets)
- **#4 Economy rebalance** — *you flagged "too easy, just unlock things."* The market
  is already dynamic; what's needed is **your tuning calls**: prices, costs, sinks,
  pacing. Risky to tune blind on Jenn's live save — best done together. Ideas on deck:
  steeper upgrade curves, demand caps, money sinks (decor/cosmetics), seasonal demand.
- **#7 Better 3D models** — everything is low-poly primitives today. Drop
  Kenney/Quaternius assets on `B:` and an agent can wire a loader + swap models in.
- **#19 Audio** — music tracks incl. the honey-badger song. Drop the audio files on
  `B:` and they'll be wired to seasons/events.
- **#38 Floating origin** — far-travel jitter fix. Low priority, some risk; only worth
  it if you notice shakiness far from spawn.
- **#56 (last bit)** — on-screen **HUD overlap** cleanup. Menus are unified; this part
  wants a live look (can't verify headless), so best when you're watching.

## 💡 Fresh ideas / nice-to-haves (not yet requested, easy wins)
- Distinct **roosters & ocelots**; an automated "chicken farm" contraption
- **Rain** weather that lightly waters crops (cozy + synergizes with quality)
- Name your livestock / pet from a prompt
- Almanac / collection log ("species discovered")
- More cooked meals & buff types (the buff system is built to extend)
- "Best day" earnings record for the ledger

## How an agent should work this list
1. Adversarial-review recent `js/` changes; fix real bugs.
2. Keep the suite green: `bash tools/shot.sh "tests/suite.html" suite.png 13000`
   then `Get-Process chrome | Stop-Process -Force`.
3. Advance **one** coherent, working, suite-tested slice (data+logic → UI → model).
4. Mark progress, commit + push to `master` if green. Never ship half-broken.
5. **Never** harm the save format or the skunks. 🦨
