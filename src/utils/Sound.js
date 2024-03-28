import OS from '../tablet/OS';

export default class Sound {
    constructor (name, time) {
        this.name = name;
        this.time = time;
        this.playing = false;
    }

    play () {
        if (this.playing) {
            this.stop();
        }
        var self = this;
        OS.playSound(this.name, function() {
            self.stop();
        });
        this.playing = true;
    }

    done () {
        return (!this.playing);
    }

    clear () {
        this.playing = false;
    }

    stop () {
        OS.stopSound(this.name);
        this.playing = false;
    }
}
