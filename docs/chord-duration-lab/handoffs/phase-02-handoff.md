# Phase 02 Handoff — Production Chord Duration

## Delivered

The production harmony sequence now stores duration and mute per chord. Its badge tap opens the
approved Elastic Rail editor, with satellite mute and delete actions. The editor is a floating
layer so it does not move the master transport off-screen.

## Audio and timing

The default `1 BAR` path preserves the former Strudel output. When any duration or mute differs,
the harmony engine generates an `arrange` progression whose audible segments are locally stretched
to their configured cycle lengths and whose muted segments are `silence`. The playhead consumes
the same duration list, so its progress fill rate is inversely proportional to chord duration:
`½ BAR` fills twice as fast as the old default and `4 BARS` fills four times more slowly.

## Validation evidence

- Pure tests cover duration values, default entry creation, codegen, mute, and weighted playhead.
- Browser interaction built `C (4 BARS) → Am (1 BAR)`, toggled mute, dismissed the editor from
  outside, started audio, observed `C` as NOW and `Am` as NEXT, then stopped successfully.
- Browser console reported no errors.
