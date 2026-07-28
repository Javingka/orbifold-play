<!--
SPDX-License-Identifier: AGPL-3.0-only
-->

# ADR 0030 — Monophonic root capture translation into editable harmony

- **Status:** Accepted — ratified by Pilot 2026-07-27
- **Date:** 2026-07-27
- **Initiative / Phase:** harmony-capture / Phase 01
- **Deciders:** Pilot (Javier)

## Context

`melody-lab.html` extracts a monophonic f0 track, segments notes, estimates key
and tempo, folds a repeated phrase, and preserves each accepted note's
quantized length. It does not detect simultaneous chord tones or chord quality.

Orbifold Play's harmony editor accepts at most 16 major/minor Tonnetz faces.
Each sequence entry has a duration of ½, 1, 2, 3, or 4 bars. Directly treating
the prototype's sixteenth-note length as bars would change the musical meaning:
the captured phrase supplies relative root lengths, while Orbifold Play supplies
the harmonic timescale.

The Phase 01 inventory therefore asked the Pilot to define:

1. how a monophonic root receives an initial editable `maj|min` suggestion;
2. whether every captured root starts at one bar or may inherit longer detected
   durations;
3. whether detected BPM and key mutate global UI state.

The Pilot resolved OD-1, OD-3, and OD-4 as Option A and OD-2 as Option A with
Option B for sufficiently clear long detections.

## Decision

### D1 — The microphone detects roots, never chord quality

The capture result describes a repeated monophonic root sequence. UI copy and
types must not claim that the microphone detected a major or minor chord.

Each accepted root receives an editable quality **suggestion** derived from the
capture-detected key and mode:

- a diatonic major triad suggests `maj`;
- a diatonic minor triad suggests `min`;
- a diminished triad falls back to `min`, preserving its minor third;
- an augmented triad falls back to `maj`, preserving its major third;
- a root outside the detected scale falls back to `maj`.

Every suggestion remains editable before preview or apply. Only `maj|min` values
may enter the candidate model.

### D2 — Relative duration has a one-bar baseline

The prototype behavior in `fold()` and `quantize()` is retained: note lengths
are quantized in capture steps and the median repeated length is retained for
each accepted phrase position.

Translation into `HarmonyDuration` is relative:

1. For each accepted phrase position, collect its positive quantized duration
   samples across repetitions.
2. Its `candidateLength` is the median of those samples.
3. The phrase `baseLength` is the median of all positive
   `candidateLength` values.
4. Every candidate defaults to `1` bar.
5. A candidate is eligible for automatic promotion only when:
   - at least two duration samples contributed;
   - the pitch/root itself passed the phrase vote threshold;
   - `medianAbsoluteDeviation / candidateLength <= 0.25`.
6. For an eligible candidate, compute
   `ratio = candidateLength / baseLength` and promote conservatively:
   - `ratio >= 3.75` → `4` bars;
   - else `ratio >= 2.75` → `3` bars;
   - else `ratio >= 1.75` → `2` bars;
   - otherwise → `1` bar.
7. Clamp the automatic result to `[1, 4]`. Automatic capture never assigns
   ½ bar; the player may choose ½ bar manually in the result editor.

If `baseLength` is missing/non-positive, fewer than two duration samples exist,
or consistency fails, duration remains one bar. This makes uncertainty fail
toward the approved safe default rather than inventing a long chord.

The relative baseline intentionally means that a phrase where every root is
equally long yields all one-bar chords, regardless of the recording's absolute
seconds. A root held consistently twice as long as the phrase's typical root
may become two bars.

### D3 — Candidate BPM is applied on confirmation

Detected BPM initializes candidate preview and remains visible as the slider's
reference marker. The BPM chosen by the player on that slider is part of the
candidate: releasing the slider at a value is the explicit choice to use that
value, so no separate “Use this BPM” checkbox is shown. Changing BPM updates an
active candidate preview.

The live app BPM does not change while reviewing. It changes only together with
the explicitly confirmed harmony replacement.

### D4 — Detected key does not change the scale selector

Detected key/mode supplies D1 quality suggestions only; the compact review UI
does not need a separate key summary.
Opening, previewing, cancelling, or applying harmony capture does not mutate
`selectedScale`.

Extending the current C-rooted scale selector to arbitrary roots is outside
Phase 01.

### D5 — Pure contract and parity boundary

All computations in D1–D2 live in `packages/music-core` with deterministic
tests. The browser adapter may acquire PCM and report lifecycle progress, but it
does not own pitch, key, repetition, quality-suggestion, or duration-reduction
semantics.

Parity citations cover `melody-lab.html` `yin()`, `fold()`, `segmentNotes()`,
`detectKey()`, `detectTempo()`, and `quantize()`. Deliberate translations are
tested and disclosed:

- monophonic notes become editable roots rather than Strudel melody tokens;
- quality is suggested from key, not detected from audio;
- repeated relative duration becomes 1–4 harmony bars under D2;
- prototype `setcpm` is not used.

## Consequences

### Positive

- The result can preserve musically obvious long roots from the first release
  without pretending that noisy duration estimates are exact.
- A one-bar fallback is predictable and compatible with the current harmony
  editor.
- The algorithm is deterministic, dependency-free, pure, and testable with
  synthetic repetitions.
- Quality and duration uncertainty remain visible and correctable before any
  live-state mutation.

### Negative / tradeoffs

- Relative normalization cannot infer an absolute harmonic bar unit when every
  captured root has the same length; all such roots intentionally become one
  bar.
- Conservative thresholds may leave some genuinely long roots at one bar.
- Diminished and augmented qualities cannot be represented by the current
  mobile Tonnetz, so the fallback preserves the third but not the fifth.
- Automatic capture cannot initially produce a ½-bar chord.

### Reversibility

The translation affects only a candidate that is isolated from live state until
confirmation. Changing thresholds or suggestion rules later is localized to
the pure analyzer and its fixtures. Existing sequences, codegen, rhythm
capture, persistence, and desktop Orbifold are unchanged.

## Decisions Register proposal

At phase completion, the Pilot should consider adding:

> Harmony microphone capture is monophonic root-sequence capture. Major/minor
> qualities are editable tonal suggestions, and automatic duration defaults to
> one bar unless repeated relative length passes ADR 0030's conservative
> promotion contract.
