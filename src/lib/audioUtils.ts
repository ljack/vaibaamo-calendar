// Shared AudioContext to prevent autoplay restriction issues and overhead
let sharedAudioCtx: AudioContext | null = null;

const getAudioContext = (): AudioContext | null => {
    const AudioContextStr = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextStr) return null;

    if (!sharedAudioCtx) {
        sharedAudioCtx = new AudioContextStr();
    }

    // Always try to resume if suspended (browsers auto-suspend contexts created without gesture)
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
        sharedAudioCtx.resume().catch(err => console.error("Failed to resume AudioContext", err));
    }

    return sharedAudioCtx;
};

// Explicitly initialize/resume audio (call this on user interaction)
export const initAudio = () => {
    getAudioContext();
};

// Helper to play a single note
export const playNote = (freq: number, duration: number = 0.5, type: OscillatorType | 'space-synth' = 'space-synth') => {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    // Envelope
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    if (type === 'space-synth') {
        // Complex instrument: Detuned Sawtooths + Sub Sine
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc1.type = 'sawtooth';
        osc2.type = 'sawtooth';
        sub.type = 'sine';

        osc1.frequency.value = freq;
        osc2.frequency.value = freq;
        sub.frequency.value = freq / 2; // Sub-octave

        osc2.detune.value = 15; // Detuned for chorus effect

        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        filter.Q.value = 2;

        osc1.connect(filter);
        osc2.connect(filter);
        sub.connect(gain); // Sub bypasses filter for warm bottom end
        filter.connect(gain);

        osc1.start(now);
        osc2.start(now);
        sub.start(now);

        osc1.stop(now + duration);
        osc2.stop(now + duration);
        sub.stop(now + duration);
    } else {
        // Simple fallback
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();

        osc.type = type as OscillatorType;
        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        osc.frequency.value = freq;

        osc.connect(filter);
        filter.connect(gain);

        osc.start(now);
        osc.stop(now + duration);
    }

    // Nodes are garbage collected automatically
};

export const playSpaceTheme = (onNotePlay?: (freq: number) => void) => {
    const ctx = getAudioContext();
    if (!ctx) return () => { };

    let isPlaying = true;
    let nextNoteTime = ctx.currentTime;
    let timeoutId: any = null;
    const boxTimeouts: any[] = []; // To clear visual callbacks

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

                // Schedule visual callback
                if (onNotePlay) {
                    const delay = (start - ctx.currentTime) * 1000;
                    const tid = setTimeout(() => {
                        onNotePlay(note.freq);
                    }, delay);
                    boxTimeouts.push(tid);

                    // Clear highlight
                    const clearTid = setTimeout(() => {
                        onNotePlay(0);
                    }, delay + (note.dur * 1000));
                    boxTimeouts.push(clearTid);
                }
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
        boxTimeouts.forEach(t => clearTimeout(t));
        // Do NOT close shared context
        // if (ctx.state !== 'closed') ctx.close().catch(() => { });
    };
};
