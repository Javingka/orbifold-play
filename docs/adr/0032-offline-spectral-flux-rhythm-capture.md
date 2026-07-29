<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# ADR 0032 — Offline spectral-flux onset detection replaces the live envelope state machine

- **Status:** Accepted — ratified by Pilot 2026-07-29, confirmed on a physical
  device
- **Date:** 2026-07-28
- **Initiative / Phase:** rhythm-capture / Phase 02
- **Deciders:** Pilot (Javier)

## Context

Phase 01 ported `beatbox-lab_7.html` faithfully: onset detection runs live
inside a `ScriptProcessorNode` callback (envelope follower + a four-state
attack/peak/decay machine), and lane classification reads an `AnalyserNode`
spectral centroid and ZCR at the moment the callback fires. This is the same
architecture the harmony pipeline had before Phase 02 (ADR 0031), and it has
the same failure modes:

1. `ScriptProcessorNode` runs on the main thread; on a busy mobile RN-Web UI,
   callbacks are starved and onsets are lost or mistimed.
2. `AnalyserNode` returns the current spectrum at callback time, not the
   samples of the attack that triggered the state change, so lane
   classification reads a smeared window and mislabels kick/snare/hat.
3. A live state machine cannot look ahead, so it cannot use the pre/post
   context that robust onset peak-picking requires.

## Decision

1. **Acquisition:** record raw PCM through an AudioWorklet (audio-thread
   callbacks, no UI starvation), with the Phase 01 ScriptProcessor path as a
   fallback. The realtime callback is reduced to a level meter plus a single
   envelope-gated flash for live feedback; it no longer decides onsets. Same
   error codes and cleanup semantics.
2. **Detection:** move onset detection into a pure engine
   (`packages/music-core/src/onset-detection.ts`) that analyzes the complete
   recorded buffer offline:
   - a Hann-windowed STFT (FFT 1024, hop 256) reusing the shared FFT extracted
     from the pYIN engine (`packages/music-core/src/fft.ts`);
   - **multiband onset novelty**: half-wave-rectified log-magnitude spectral
     flux (Dixon 2006) over the full band, summed with a normalized low-band
     (< 160 Hz) flux so bass/kick onsets survive alongside broadband hats and
     snares (plain full-band flux under-weights narrowband bass onsets);
   - **adaptive peak-picking** (Böck et al. 2012): local-maximum test over
     pre/post windows plus an adaptive local-mean-plus-delta threshold and a
     refractory minimum;
   - **offline lane classification** replicating the prototype's cutoffs
     (bdCut 1300 Hz, hhCut 4600 Hz, ZCR 0.15/0.35) but measured over the
     recorded onset segment at the attack peak, with the byte-magnitude
     scaling of `getByteFrequencyData` and a spectral noise gate so the
     centroid keeps its calibrated meaning.
3. **Authoritative source for the detection stage:** the onset-detection
   literature (Dixon 2006 spectral flux; Böck et al. 2012 peak-picking) plus
   the prototype's lane cutoffs, with deterministic synthetic-signal fixtures
   as evidence. This deliberately departs from `beatbox-lab_7.html`'s live
   `detectOnset()`/`grabFeatures()` for detection, exactly as ADR 0031
   departed from `melody-lab.html`. The unchanged tempo/phase/vote/quantize
   stage (`analyzeRhythmCapture`, ported from `analyzeFreestyle`/
   `applyAnalysis`) retains its prototype parity and tests.

## Consequences

- Kick/snare/hat onsets are recovered from realistic layered input, and the
  recorder no longer drops buffers under UI load.
- The `CaptureOnset` → `RhythmCaptureAnalysis` contract, the review/edit/
  preview/apply UI, and the tempo engine are untouched — the new engine only
  replaces how `CaptureOnset[]` is produced.
- The pure engine gains an STFT and peak-picker (all O(N log N)); a 10 s,
  48 kHz capture analyzes in ~60 ms, once, in the existing `analyzing` phase.
- Known limitation, unchanged from the prototype: one lane per onset, so two
  instruments struck at the same instant (e.g. a coincident kick+hat) merge
  into a single classified onset. A per-band multi-lane split is deferred.
- The first sample of a recording cannot be an onset (spectral flux has no
  prior frame); real captures have countdown lead-in, so this is not a
  practical gap.
