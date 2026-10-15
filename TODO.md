# TODO / Ideas

Deferred work from the quality-catalog carousel added to Chord Finder's result cards.

- **Full-screen quality carousel for mobile**, Cifra Club style (reference: a modal with a big diagram, prev/next arrows, "X of Y", Restore/Listen buttons). Today the carousel just reflows inside the existing 292px card at any width — no dedicated mobile layout.
- **"Listen" playback button** in the carousel (Web Audio, plays the chord's tones). Not implemented — Chord Finder has no audio capability today; this would be the first.
- **Harmonic-complexity ordering, as an alternative to fingering difficulty.** The catalog is currently sorted by how hard a quality is to *play* (fingers used, barre, fret span — objective, derived straight from chords-db's position data). A theory-based alternative (triad < 7th < 9th/altered) was considered and explicitly deferred: chords-db's 45 suffixes carry no interval data, so ordering by harmonic complexity would need a hand-built table mapping each suffix to an extension level, with real judgment calls (e.g. is "alt" more complex than "9#11"?). The user chose fingering difficulty for now because it's objective and needs no such table; this could still be added later as a second sort mode.
