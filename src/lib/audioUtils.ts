export const playSpaceTheme = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return () => { };

    const ctx = new AudioContext();
    let isPlaying = true;
    let nextNoteTime = ctx.currentTime;
    let timeoutId: any = null;

    // "Space Adventure" / "Imperial" Vibe
    // Key: Gm / Bb
    const notes = [
        // Measure 1
        { freq: 196.00, dur: 0.5 }, { freq: 0, dur: 0.1 }, // G3
        { freq: 196.00, dur: 0.5 }, { freq: 0, dur: 0.1 }, // G3
        { freq: 196.00, dur: 0.5 }, { freq: 0, dur: 0.1 }, // G3
        { freq: 155.56, dur: 0.35 }, { freq: 0, dur: 0.05 }, // Eb3
        { freq: 233.08, dur: 0.15 }, { freq: 0, dur: 0.05 }, // Bb3

        // Measure 2
        { freq: 196.00, dur: 0.5 }, { freq: 0, dur: 0.1 }, // G3
        { freq: 155.56, dur: 0.35 }, { freq: 0, dur: 0.05 }, // Eb3
        { freq: 233.08, dur: 0.15 }, { freq: 0, dur: 0.05 }, // Bb3
        { freq: 196.00, dur: 1.0 }, { freq: 0, dur: 0.1 }, // G3

        // Measure 3 (High Part)
        { freq: 293.66, dur: 0.5 }, { freq: 0, dur: 0.1 }, // D4
        { freq: 293.66, dur: 0.5 }, { freq: 0, dur: 0.1 }, // D4
        { freq: 293.66, dur: 0.5 }, { freq: 0, dur: 0.1 }, // D4
        { freq: 311.13, dur: 0.35 }, { freq: 0, dur: 0.05 }, // Eb4
        { freq: 233.08, dur: 0.15 }, { freq: 0, dur: 0.05 }, // Bb3 (lower)

        // Measure 4
        { freq: 185.00, dur: 0.5 }, { freq: 0, dur: 0.1 }, // Gb3
        { freq: 155.56, dur: 0.35 }, { freq: 0, dur: 0.05 }, // Eb3
        { freq: 233.08, dur: 0.15 }, { freq: 0, dur: 0.05 }, // Bb3
        { freq: 196.00, dur: 1.0 }, { freq: 0, dur: 0.5 }, // G3
    ];

    const scheduleNotes = () => {
        if (!isPlaying || ctx.state === 'closed') return;

        notes.forEach(note => {
            if (note.freq > 0) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                const filter = ctx.createBiquadFilter();

                osc.type = 'sawtooth';
                filter.type = 'lowpass';
                filter.frequency.value = 1200; // Brighter
                filter.Q.value = 1;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                // Timing
                const start = nextNoteTime;
                const end = start + note.dur;

                osc.frequency.setValueAtTime(note.freq, start);

                // Envelope
                gain.gain.setValueAtTime(0.001, start);
                gain.gain.exponentialRampToValueAtTime(0.4, start + 0.05); // Attack
                gain.gain.exponentialRampToValueAtTime(0.3, start + note.dur * 0.6); // Decay
                gain.gain.exponentialRampToValueAtTime(0.001, end); // Release

                osc.start(start);
                osc.stop(end);
            }
            nextNoteTime += note.dur;
        });

        // Loop: Schedule next run shortly before this one ends (managed by nextNoteTime)
        // Check gap to current time to avoid drift or runaway
        const delay = (nextNoteTime - ctx.currentTime) * 1000;
        timeoutId = setTimeout(scheduleNotes, Math.max(0, delay - 100)); // Schedule slightly early
    };

    scheduleNotes();

    // Return a stop function
    return () => {
        isPlaying = false;
        if (timeoutId) clearTimeout(timeoutId);
        if (ctx.state !== 'closed') ctx.close().catch(() => { });
    };
};
