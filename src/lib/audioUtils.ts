export const playSpaceTheme = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return () => { };

    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(ctx.destination);

    // "Space Adventure" Fanfare (approximate intervals)
    // Notes in Hz (approximate for Key of Bb)
    // Bb3: 233.08, F4: 349.23, Bb4: 466.16
    // Pattern: 1 (triplet), 1 (triplet), 1 (triplet), 1 (long), 5 (long), 4 (triplet), 3 (triplet), 2 (triplet), 8 (high Bb)

    // Simplifying to a "dramatic march" structure to avoid copyright strictness but capture the vibe
    // Ta-ta-ta DUMMM... d-d-d DUMMM





    const notes = [
        // Intro Fanfare Triplet feel
        { freq: 233.08, dur: 0.15 }, { freq: 0, dur: 0.05 }, // Bb3
        { freq: 233.08, dur: 0.15 }, { freq: 0, dur: 0.05 },
        { freq: 233.08, dur: 0.15 }, { freq: 0, dur: 0.05 },

        { freq: 466.16, dur: 0.8 }, // Bb4 (Long High)
        { freq: 0, dur: 0.1 },

        { freq: 349.23, dur: 0.8 }, // F4 (Medium)
        { freq: 0, dur: 0.1 },

        // Triplets
        { freq: 311.13, dur: 0.15 }, // Eb4
        { freq: 293.66, dur: 0.15 }, // D4
        { freq: 261.63, dur: 0.15 }, // C4

        { freq: 466.16, dur: 0.8 }, // High Bb again
        { freq: 0, dur: 0.1 },

        { freq: 349.23, dur: 0.6 }, // F4
    ];

    let time = ctx.currentTime;

    notes.forEach(note => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth'; // Brass-like

        // Low pass filter to make it less harsh
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        if (note.freq > 0) {
            osc.frequency.setValueAtTime(note.freq, time);

            // Envelope for punchy brass
            gain.gain.setValueAtTime(0.001, time);
            gain.gain.exponentialRampToValueAtTime(0.3, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.2, time + note.dur * 0.8);
            gain.gain.exponentialRampToValueAtTime(0.001, time + note.dur);

            osc.start(time);
            osc.stop(time + note.dur);
        }

        time += note.dur;
    });

    // Return a stop function
    return () => {
        if (ctx.state !== 'closed') ctx.close();
    };
};
