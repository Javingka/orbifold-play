<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# Phase 01 Inventory — Detection Uplift (rhythm + harmony capture, next-generation)

**Date:** 2026-07-29
**Initiative:** `detection-uplift`
**Status:** Draft — awaiting Pilot review. No source changes in this step.
**Trigger:** Pilot supplied a third-party AI research note surveying open-source
beatbox→MIDI and audio→chord tools (DeepBeat, BeatVOX, DrumScript, DrumGizmo,
Omnizart, ChordMini, Madmom, Chordino) and asked for a realistic plan: can
Orbifold Play keep improving detection client-side, or does it need a backend
/ separate detection API? The note is explicitly advisory, not a requirement.

---

## 1. Where the current engines actually are

Both capture pipelines already went through one full "quality" generation
(harmony-capture Phase 02 / ADR 0031, rhythm-capture Phase 02 / ADR 0032).
That generation is architecturally identical to what the Pilot's research note
recommends as a first step: **stop analyzing live inside an audio callback,
record raw PCM off the main thread, analyze the whole buffer offline in a
pure, dependency-free, unit-tested engine.** This was already done, on a
physical device, with Pilot sign-off. Re-reading the note against the current
code, most of §1–3 and §9 of the note ("preprocess → onset detection →
classification → quantization → structured output") describes the shape this
repo already ships:

| Note's proposed stage | Current implementation |
|---|---|
| Onset detection (librosa/aubio/madmom-style) | `packages/music-core/src/onset-detection.ts` — Hann STFT + multiband spectral flux (Dixon 2006) + adaptive peak-picking (Böck et al. 2012), reusing the shared FFT (`fft.ts`) |
| Percussion classification (kick/snare/hat) | Offline centroid + ZCR classifier at the onset attack peak, 3 lanes (`pulse`/`click`/`air`), thresholds from `beatbox-lab_7.html` |
| Tempo / quantization / pattern folding | `analyzeRhythmCapture()` in `rhythm-capture.ts` — comb-filter tempo, phase search, voting, quantization (prototype-parity, unchanged since Phase 01) |
| Raw + quantized time kept side by side | `CaptureOnset` carries the refined attack time; `analyzeRhythmCapture` produces both raw votes and the quantized `CapturePattern` |
| Pitch/onset detection for the melodic path | `packages/music-core/src/pyin.ts` — full pYIN (Mauch & Dixon 2014): FFT-accelerated YIN, Beta-prior thresholding, banded Viterbi over 1/5-semitone bins |
| Note segmentation, key/tempo estimation, fold/quantize | `harmony-capture.ts` — voicing runs, onset re-articulation, key detection, phrase folding, duration promotion (ADR 0030) |
| Structured JSON-like output with confidence | `RhythmCaptureAnalysis.confidence`, `HarmonyCaptureAnalysis.confidence`, `CapturedRootNote.confidence`, `CaptureOnset` all already carry per-event confidence |
| AudioWorklet acquisition, ScriptProcessor fallback | `harmony-capture.web.ts`, `rhythm-capture.web.ts` — both implemented, both device-verified |

**Conclusion of this section:** the note's "recommendation for a first
prototype" (§10) is not a first prototype for this repo — it is roughly where
Phase 02 already landed for both engines. The note is most useful for what it
points at *beyond* that baseline, covered in §2–4 below.

## 2. What the note actually adds beyond current state

Stripping the note down to items not already implemented:

**Rhythm:**
- A *trained* percussion classifier (DeepBeat/BeatVOX/DrumScript all fit a
  model — CNN or otherwise — on spectral features) instead of the current
  fixed-threshold centroid/ZCR rule. This is exactly the open decision
  **OD-R3** already logged in `docs/rhythm-capture/evaluation-harmony-learnings.md`
  §6 ("minimal offline features vs. a richer classifier") and left deferred at
  Phase 02.
- Multi-lane / simultaneous-hit splitting (kick+hat at once) — already logged
  as a known limitation in ADR 0032 and in `AGENTS.md`'s deferred-work list.
- A real sampler/virtual-drum render stage (DrumGizmo/Hydrogen/SFZ). This is
  **already solved differently** in this repo: rhythm playback goes through
  Strudel + `packages/audio/src/rhythm-sample-map.ts`, not through a
  detect→MIDI→external-sampler pipeline. Nothing in the note's §2 changes that.

**Harmony:**
- **Real polyphonic chord recognition** (chroma → HMM/CNN → chord label) for
  audio that already contains simultaneous notes (a guitar or piano chord, or
  a full mix). This is a genuine capability gap, not a quality gap: ADR 0030
  is explicit that "the microphone detects roots, never chord quality" — the
  current engine is monophonic-only by design, and a hummed/sung `do–mi–sol`
  is read as a melody, not a chord. The note's §6 "Modo 2: grabación por
  capas" / "Modo 4: melodía + inferencia armónica" describe the same
  monophonic limitation and possible workarounds.
- A *trained/statistical* harmonic-context step (the note's §6 Modo 4
  "hypothesis chords with confidence") versus today's deterministic
  scale-degree → `maj|min` suggestion table.

Everything else in the note (Chordino's chroma+HMM method, Omnizart, Madmom,
ChordMini) is different **implementations of** "detect chords in polyphonic
audio" — i.e., they matter only if the Pilot wants to add true polyphonic
chord capture as a new capability. That is the single biggest scope fork in
this inventory and is called out as OD-1 below.

## 3. Tool-by-tool feasibility against this repo's constraints

This repo's hard invariants (`AGENTS.md`) rule out most of the note's tools as
direct dependencies: `packages/music-core` must stay pure TypeScript with no
platform/runtime dependency, the project uses exact-pinned pnpm dependencies
only with Pilot approval, and the shipping target is Expo Web/PWA with no
existing backend, server, CI deploy target, or Python runtime anywhere in the
repo (confirmed: no `Dockerfile`, no server directory, no Python tooling).

| Tool | Language/runtime | Fit for direct use in this repo |
|---|---|---|
| DeepBeat | Python 3.6, unmaintained | Not directly usable. Reference only (architecture idea already implemented; classifier training approach could inform a future TS/on-device model). |
| BeatVOX | Python, experimental/research code | Same — reference only. |
| DrumScript | Python package, trained on real drums not beatbox | Would need retraining/adaptation even in its own ecosystem; not portable as-is. |
| DrumGizmo / Hydrogen / SFZ | Native/desktop sample players | Not applicable — this repo renders rhythm through Strudel, already solved. |
| Omnizart | Python, heavy ML deps, flagged by the note itself as ARM-unfriendly | Not usable client-side. Only reachable via a backend service. |
| ChordMini | Web app (reference UI/UX only per the note) | Useful only as a UX reference for how to present chord/roman-numeral/modulation results, not as a dependency. |
| Madmom | Python library; some pretrained models have restrictive licenses (flagged by the note itself) | Not usable client-side; backend-only, and license review required before any commercial use. |
| Chordino / NNLS Chroma | C++ Vamp plugin; **method** is deterministic DSP (log-frequency chroma) + HMM/Viterbi decoding, no neural weights; **GPL-licensed** | Not a droppable dependency (C++ Vamp plugin, GPL), but its *method* is directly portable: it is authored by Mauch & Dixon — the same authors as the pYIN paper this repo already reimplemented from scratch in `pyin.ts`. A from-scratch, paper-cited TypeScript port (chroma extraction + chord HMM/Viterbi) would follow the exact precedent of ADR 0031/0032: dependency-free, deterministic, unit-testable, no GPL code copied, only the published method cited. |

**Key finding:** the one part of the note's toolkit that is actually
consistent with this repo's established architecture (pure engine, paper
citation, from-scratch TS, no new runtime dependency) is the Chordino/NNLS
Chroma *method*, not the library. Everything else in the note that is
worth the accuracy (Omnizart, Madmom, trained beatbox classifiers) requires
either a server or an on-device ML runtime this repo does not currently have.

## 4. The architecture question: client-side, backend, or a separate detection API?

Three options, evaluated against the product brief and `AGENTS.md`.

### Option A — Stay 100% client-side, extend the existing pure-engine pattern
Port the *methods* the note surfaces (richer percussion features, chroma +
chord HMM for polyphonic harmony) into `packages/music-core` the same way
pYIN and spectral-flux onset detection were already ported: cited paper,
dependency-free TypeScript, deterministic tests, no new runtime.

- **Fits:** the brief's "open the app, touch, immediately make something
  musical" promise (no upload latency, works offline, audio starts only after
  a user gesture — no network round-trip in between); the repo's pure-`music-core`
  invariant; the existing two-for-two precedent that this team can port
  academic DSP methods successfully.
- **Limits:** cannot reach Omnizart/Madmom-grade neural transcription
  accuracy on hard material (dense mixes, inversions, extended jazz voicings)
  purely with classical chroma+HMM; a trained percussion classifier would need
  either a from-scratch small model trained by the team, or an on-device
  inference runtime (TFJS/ONNX Runtime Web), which is a new, non-trivial
  dependency and bundle-size cost on a mobile web/PWA target that already
  ships CanvasKit.

### Option B — Hybrid: keep the client engine as the default/offline path, add an optional backend "high-accuracy" detection service
A new backend (thin API: upload audio → run Omnizart/Madmom/a trained
classifier server-side → return the same `RhythmCaptureAnalysis`/
`HarmonyCaptureAnalysis`-shaped JSON) used only when the user opts in and has
connectivity; the existing offline engine remains the default and the
fallback.

- **Fits:** lets the app reach for state-of-the-art accuracy on hard material
  without abandoning the offline, instant-gesture promise for the common case.
- **Costs:** genuinely new territory for this repo — hosting, an upload
  pipeline, auth/rate-limiting, recording-audio privacy handling (this is
  voice/microphone data), ongoing infra cost, a second codebase/runtime
  (Python) to maintain, and a new "requires network" code path that conflicts
  with nothing in `AGENTS.md` today but is a first for this project. It is a
  real scope and ops commitment, not a small add-on.

### Option C — Migrate detection fully to a backend/separate service
Drop the client pure engines; all capture goes through a hosted service.

- **Not recommended.** Directly conflicts with the brief ("audio starts only
  after an explicit user gesture," instant, game-like, mobile-first) and with
  `AGENTS.md`'s pure-`music-core` invariant, which exists specifically so
  musical logic stays renderer/runtime-independent and testable without a
  network. It would also throw away two ratified ADRs' worth of validated,
  device-tested work for no accuracy the note's own material suggests is
  strictly required. Listed only to rule it out explicitly.

### Recommendation
**Option A now; Option B only if/when a concrete accuracy ceiling is hit that
the Pilot decides is worth the operational cost.** Concretely: extend the
client pure-engine pattern first (percussion feature classifier improvements,
a from-scratch chroma+chord-HMM harmony path for users who want to capture
real polyphonic chords). Treat a backend detection service as a deferred,
separately-scoped initiative gated on the Pilot deciding the product needs
"pro" accuracy badly enough to accept upload latency, hosting cost, and
microphone-audio privacy obligations. This mirrors ADR 0031's own precedent
(OD-13: neural pitch tracking explicitly deferred pending a
dependency/model-size decision) — the same reasoning now applies to any
heavier harmony/rhythm model.

## 5. Candidate follow-on phases (not yet scoped — for Pilot sequencing only)

If Option A is approved, the natural next phases, roughly ordered by
risk/effort:

1. **Rhythm — richer percussion features (resolves OD-R3).** Extend the
   offline lane classifier in `onset-detection.ts` beyond centroid/ZCR
   (e.g., add spectral flatness, band-energy ratios, decay-time features)
   while staying a deterministic rule/lightweight-statistical classifier —
   no new runtime dependency. Directly closes the gap the note's DeepBeat/
   BeatVOX/DrumScript references point at, without adopting any of them.
2. **Rhythm — simultaneous multi-lane onsets.** Split a single detected onset
   into multiple simultaneous lanes when band energy indicates more than one
   instrument struck at once (already named as deferred work in `AGENTS.md`).
3. **Harmony — polyphonic chord capture as a new, additive capture mode.**
   A from-scratch TypeScript chroma extraction + chord template/HMM decoder
   (Fujishima chroma; Mauch & Dixon NNLS-Chroma/Chordino method as the cited
   source), added as a new pure engine alongside — not replacing — the
   existing monophonic pYIN root-capture path. This is a new user-facing
   *capability* (record real guitar/piano chords, not just hum roots), so it
   needs its own product-scope decision from the Pilot before an ADR, not
   just an engine swap.
4. **Harmony — confidence-ranked chord hypotheses for monophonic input**
   (the note's §6 "Modo 4"). Optional, smaller: surface alternative chord
   suggestions with confidence for a captured root instead of a single
   `maj|min` suggestion.
5. **(Deferred, gated) Backend "pro" detection service** — only if the Pilot
   decides Option B is worth opening, scoped as its own initiative with its
   own ADR covering hosting, privacy, and the upload/opt-in UX.

None of these are approved scope yet. Each would get its own
`docs/<initiative>/phases/phase-NN.md` (either as `harmony-capture/phase-03`,
`rhythm-capture/phase-03`, or a new initiative — Pilot's call) with its own
acceptance criteria, its own ADR if the Chordino-method port departs from
existing parity/authority citations the way ADR 0031/0032 did, and its own
device validation pass.

## 6. Open decisions for the Pilot

- **OD-1 — Scope: is polyphonic instrument chord capture (real guitar/piano
  chords, not hummed roots) an in-scope capability for Orbifold Play, or does
  harmony capture stay monophonic-voice-only by design?** This is the single
  decision that determines whether any Chordino-style work is worth doing at
  all. ADR 0030 currently treats monophonic-only as an intentional product
  decision, not a limitation to fix.
- **OD-2 — Architecture: approve Option A (client-only extension) as the
  default path, with Option B (hybrid backend) explicitly deferred pending a
  separate future decision?** (Recommended: yes.)
- **OD-3 — Percussion classifier scope:** richer deterministic/statistical
  features only (low effort, no new dependency) vs. a trained on-device model
  (requires an inference runtime dependency decision, e.g. TFJS/ONNX Runtime
  Web, with real mobile-web bundle-size cost). Recommended: start with
  richer features (item 1 in §5); revisit a trained model only if that proves
  insufficient.
- **OD-4 — Sequencing:** which follow-on phase should the Pilot schedule
  first — rhythm classifier richness (§5.1), multi-lane onsets (§5.2), or
  polyphonic harmony (§5.3)? These are independent and can be scoped/branched
  separately.
- **OD-5 — Speech-described harmony (the note's §6 "Modo 3": say "do mayor,
  la menor" and parse it) and layered-recording chord entry (§6 "Modo 2"):**
  worth scoping as lightweight additive input modes, or explicitly out of
  scope for now? Both are input-UX features, not detection-accuracy features,
  and are independent of OD-1–OD-4.

## 7. Risks and dependencies (for whichever options are approved)

- Any richer classifier or chroma/HMM engine stays inside `packages/music-core`
  and must remain free of React/DOM/Expo/Skia/audio-platform imports per
  `AGENTS.md`'s hard invariants; this is achievable for both §5.1 and §5.3 as
  scoped (pure DSP + statistics, same pattern as `pyin.ts`/`onset-detection.ts`).
- A trained on-device model (only relevant if OD-3 later chooses that path)
  is a new dependency class this repo has never carried (inference runtime +
  model weights shipped in the web bundle) and needs its own justification
  and Pilot approval per `AGENTS.md`'s dependency rule, plus a bundle-size
  budget check against the existing CanvasKit/Skia payload.
- A GPL-licensed method (Chordino/NNLS Chroma) is safe to *cite and
  reimplement from the published paper*, as already done for pYIN (also
  Mauch & Dixon); it is not safe to copy Chordino's C++/GPL source directly
  into this AGPL-3.0 project's pure engine without a licensing review, and
  this inventory does not recommend doing so.
- OD-1 (polyphonic scope) has UX consequences beyond detection: the harmony
  editor currently accepts only `maj|min` qualities on 24 fixed Tonnetz faces
  (`ORBIFOLD_PLAY_BRIEF.md`); real captured chords (7ths, extensions,
  inversions) may not have a face to land on, exactly the same "outside this
  first artifact" limitation the brief already names for `dim`/`aug`/`pow`.
  A polyphonic capture phase would need to resolve that mapping question
  before implementation, not after.
- No backend, hosting account, CI deploy pipeline, or secrets-management
  exists in this repo today; Option B is not "add an API call," it is
  standing up new infrastructure from zero.

## 8. What this inventory is not

This inventory does not create an ADR, a phase file, or a branch, and
implements no code, per `AGENTS.md`'s inventory-first workflow. It is a
decision-ready map of the Pilot's research note against verified current
state, for the Pilot to resolve OD-1–OD-5 before any `phase-01.md` is
written for a chosen follow-on track.

## 9. Pilot resolutions (2026-07-29)

- **OD-1 — Resolved:** harmony capture stays intentionally
  monophonic-voice-only. The polyphonic chord-capture track (§5.3, the
  Chordino/chroma/HMM method port) is closed, not deferred.
- **OD-2 — Resolved:** Option A. Detection remains 100% client-side in pure
  `packages/music-core` engines. Option B (hybrid backend) stays a
  not-scoped, separately-gated future decision; Option C remains rejected.
- **OD-3 — Resolved:** richer deterministic features only; no trained model
  or inference-runtime dependency.
- **OD-4 — Resolved:** sequence the rhythm lane-classification uplift (§5.1)
  first as `detection-uplift/phase-01`; multi-lane coincident splitting
  (§5.2) is the candidate Phase 02 after that handoff. No harmony phase is
  opened now; §5.4 (confidence-ranked hypotheses) stays unscoped.
- **OD-5 — Not taken up:** speech-described and layered-recording input
  modes remain out of scope with no phase planned.

Outcome: the initiative proceeds with the narrow rhythm scope only — see
`docs/detection-uplift/phases/phase-01.md` and ADR 0034 (Proposed).
