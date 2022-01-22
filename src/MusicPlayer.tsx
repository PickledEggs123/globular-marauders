import * as Tone from "tone";

/**
 * A class for playing music through a series of notes. The data is a list of musical notes to play in sequence.
 */
export class MusicPlayer {
    synth: Tone.PolySynth | null = null;
    synthPart: Tone.Sequence | null = null;

    public start() {
        this.startTone().catch(err => {
            console.log("FAILED TO START MUSIC", err);
        });
    }

    public stop() {
        if (this.synthPart) {
            this.synthPart.stop();
            this.synthPart.dispose();
            this.synthPart = null;
        }
        Tone.Transport.stop();
    }

    public static firstMelody = [
        // stanza 1
        "C3",
        ["C3", "C3"],
        null,
        ["G3", "A#3"],
        null,
        ["A3", "G3"],
        null,
        null,

        // stanza 2
        "C3",
        ["C3", "C3"],
        null,
        ["G3", "A#3"],
        null,
        ["A3", "G3"],
        null,
        null,

        // stanza 3
        "A#3",
        ["A#3", "A3"],
        null,
        ["F3", "G3"],
        null,
        ["C2", "C2"],
        null,
        null,

        // stanza 4
        "A#3",
        ["A#3", "A3"],
        null,
        ["F3", "G3"],
        null,
        ["C2", "C2"],
        null,
        null,
        "END"
    ];
    public static secondMelody = [
        // stanza 1
        "C3",
        "D3",
        "Eb3",
        null,

        // stanza 2
        "Eb3",
        null,
        "D3",
        null,

        // stanza 3
        "Eb3",
        "D3",
        "C3",
        null,

        // stanza 4
        "A2",
        null,
        "A#2",
        null,

        // stanza 1
        "C3",
        "D3",
        "Eb3",
        null,

        // stanza 2
        "Eb3",
        null,
        "D3",
        null,

        // stanza 3
        "Eb3",
        "D3",
        "C3",
        null,

        // stanza 4
        "A2",
        null,
        "A#2",
        null,
        "END"
    ];
    public static thirdMelody = [
        // stanza 1
        "C3",
        "G2",
        "A2",
        "A#2",
        "A2",
        "G2",

        // stanza 2
        "C3",
        "G2",
        "A2",
        "A#2",
        "A2",
        "G2",

        // stanza 3
        "C3",
        "G2",
        "A2",
        "A#2",
        "A2",
        "G2",

        // stanza 4
        "A2",
        "G2",
        "F2",
        "G2",
        "C2",
        "C2",
        "END"
    ];
    public static forthMelody = [
        // stanza 1
        "C3",
        null,
        "G3",
        "G3",
        null,
        null,

        // stanza 2
        "F3",
        null,
        "Eb3",
        "C3",
        null,
        null,

        // stanza 3
        "D3",
        null,
        "Eb3",
        "D3",
        null,
        null,

        // stanza 4
        "C3",
        null,
        "B2",
        "C3",
        null,
        null,
        "END"
    ];

    public melodyMap: Array<{
        id: string,
        next: string,
        notes: Array<string | null | Array<string | null>>
    }> = [{
        id: "main",
        next: "main2",
        notes: MusicPlayer.firstMelody
    }, {
        id: "main2",
        next: "main3",
        notes: MusicPlayer.secondMelody
    }, {
        id: "main3",
        next: "main4",
        notes: MusicPlayer.thirdMelody
    }, {
        id: "main4",
        next: "main5",
        notes: MusicPlayer.thirdMelody
    }, {
        id: "main5",
        next: "main6",
        notes: MusicPlayer.secondMelody
    }, {
        id: "main6",
        next: "main7",
        notes: MusicPlayer.forthMelody
    }, {
        id: "main7",
        next: "main",
        notes: MusicPlayer.forthMelody
    }];
    public currentMelody: string = "";

    public getNextMelody(): Array<string | null | Array<string | null>> {
        const melodyNode = this.melodyMap.find(m => m.id === this.currentMelody);
        if (melodyNode) {
            const nextMelodyNode = this.melodyMap.find(m => m.id === melodyNode.next);
            if (nextMelodyNode) {
                this.currentMelody = nextMelodyNode.id;
                return nextMelodyNode.notes;
            }
        }
        const firstMelodyNode = this.melodyMap[0];
        if (firstMelodyNode) {
            this.currentMelody = firstMelodyNode.id;
            return firstMelodyNode.notes;
        }
        throw new Error("Could not find melody node to play next sound");
    }

    /**
     * Handle the playing of music and the transition between melodies.
     * @param time
     * @param note
     */
    handleToneSequenceCallback = (time: number, note: any) => {
        if (note === "END") {
            this.setupMelody(this.getNextMelody());
            if (this.synthPart) {
                this.synthPart.start(Tone.Transport.seconds);
            }
            return;
        }
        if (this.synth && note) {
            this.synth.triggerAttackRelease(note, "10hz", time);
        }
    };

    setupMelody(notes: Array<string | null | Array<string | null>>) {
        // clean up old synth parts
        if (this.synthPart) {
            this.synthPart.stop();
            this.synthPart.dispose();
            this.synthPart = null;
        }
        this.synthPart = new Tone.Sequence(
            this.handleToneSequenceCallback,
            notes,
            "4n"
        );
        this.synthPart.loop = false;
    }

    async startTone() {
        await Tone.start();

        this.synth = new Tone.PolySynth(Tone.Synth).toDestination();

        // first melody
        this.setupMelody(this.getNextMelody());
        if (this.synthPart) {
            this.synthPart.start(Tone.Transport.seconds);
        }
        Tone.Transport.start();
    }
}