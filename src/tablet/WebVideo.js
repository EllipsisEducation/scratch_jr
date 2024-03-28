// Most of this is taken from the ScratchJr Desktop port
// https://github.com/jfo8000/ScratchJr-Desktop/blob/919482d724904a560d6c77dab06240341584c502/src/electronClient.js#L728

/** @class VideoCapture

This class opens a video stream using the webcam.
*/

class VideoCapture {
    constructor(videoElement) {
        // https://www.html5rocks.com/en/tutorials/getusermedia/intro/
        this.videoElement = videoElement || document.createElement("video");
        this.errorHandler = null;
    }

    getId() {
        if (!this.id) {
            // uuid generator
            this.id = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
                /[xy]/g,
                function (c) {
                    let r = (Math.random() * 16) | 0,
                        v = c == "x" ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                }
            );
        }
        return this.id;
    }
    startRecord(constraints) {
        constraints = constraints || { video: true, audio: false };
        if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices
                .getUserMedia(constraints)
                .then(
                    this.beginStartRecord.bind(this),
                    this.onError.bind(this)
                );
        }
        return this.getId() + ".webm";
    }

    stopRecord() {
        try {
            if (this.currentStream) {
                let audioTracks = this.currentStream.getAudioTracks();
                if (audioTracks) {
                    for (let i = 0; i < audioTracks.length; i++) {
                        audioTracks[i].stop();
                    }
                }
                let videoTracks = this.currentStream.getVideoTracks();
                if (videoTracks) {
                    for (let i = 0; i < videoTracks.length; i++) {
                        videoTracks[i].stop();
                    }
                }
                this.videoElement.pause();

                this.videoElement.srcObject = null;
            }
        } catch (e) {
            debugLog("could not close webcam");
        }
    }

    beginStartRecord(stream) {
        this.videoElement.srcObject = stream;
        this.currentStream = stream;

        if (!this.isRecordingPermitted) {
            this.stopRecord();
            throw new Error("Recording video is not permitted.");
        }
    }

    onError(e) {
        debugLog(e);
        if (!this.inOnError) {
            try {
                this.inOnError = true;
                this.stopRecord();
            } finally {
                this.inOnError = false;
            }
        }

        if (this.errorHandler) {
            this.errorHandler(e);
        }
    }

    /** takes a picture of the current video feed and returns a data: url in png format */
    snapshot(cameraRect, isMirrored) {
        if (!this.currentStream || !this.isRecordingPermitted) return null;

        // make a canvas to draw the current video frame to
        let canvas = document.createElement("canvas");

        // make the canvas the same size as the videoElement.
        let w = cameraRect.width; //this.videoElement.clientWidth;
        let h = cameraRect.height; //this.videoElement.clientHeight;

        canvas.width = w;
        canvas.height = h;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";

        // draw the video to the canvas, then convert to an image.
        let ctx = canvas.getContext("2d");

        if (isMirrored) {
            // mirror the context so that the image draws reversed too
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
        }

        ctx.drawImage(
            this.videoElement,
            0,
            0,
            cameraRect.width,
            cameraRect.height
        );

        let data = canvas.toDataURL("image/png");
        return data;
    }
}

export class WebVideo {
    constructor(data) {
        console.log('shapeData', data);
        this.shapeData = data;
        this.isMirrored = true;
    }

    show() {
        if (!this.cameraPickerDiv) {
            this.cameraPickerDiv = document.createElement("div");
            this.cameraPickerDiv.setAttribute(
                "style",
                "z-index:90000; position:absolute; top:0px, left:0px, width: 1000px; height: 1000px;"
            );

            this.cameraPickerDiv.id = "cameraPickerDiv";

            // the video has autoplay so that the feed will start when shown
            // it also has scale so that the camera will act as a mirror - otherwise
            // it can be awkward to get yourself into the frame.
            let videoStyle = "";
            if (this.isMirrored) {
                videoStyle = `style='-moz-transform: scale(-1, 1); -webkit-transform: scale(-1, 1); -o-transform: scale(-1, 1); transform: scale(-1, 1); filter: FlipH;'`;
            }
            this.cameraPickerDiv.innerHTML =
                `
               <video id='WebVideo-cameraFeed'` +
                videoStyle +
                ` autoplay></video>
               <img id='WebVideo-maskImg' src='` +
                this.shapeData.image +
                `'></img>
                                              `;

            document
                .getElementById("backdrop")
                .appendChild(this.cameraPickerDiv);

            this.videoElement = document.getElementById(
                "WebVideo-cameraFeed"
            );
            this.maskImg = document.getElementById(
                "WebVideo-maskImg"
            );

            // Similar to ScratchJR.m openfeed
            // camera rect is just the small opening: x,y,width,height
            this.layoutDiv(
                this.videoElement,
                this.shapeData.x,
                this.shapeData.y,
                this.shapeData.width,
                this.shapeData.height
            );

            // maskImg is a workspace sized image to display over the camera so you can see the rest
            // of the drawing.  e.g. if you're only filling in the cat's head, this image
            // is everything (graph paper, cat body) but the cat's head.

            // maskedImg rect is: mx,my,mw,mh
            this.layoutDiv(
                this.maskImg,
                this.shapeData.mx,
                this.shapeData.my,
                this.shapeData.mw,
                this.shapeData.mh
            );

            this.videoCaptureElement = new VideoCapture(this.videoElement);
            this.videoCaptureElement.isRecordingPermitted = true;
            this.videoCaptureElement.startRecord({
                video: {
                    width: this.shapeData.width,
                    height: this.shapeData.height,
                },
            });
        }
    }

    layoutDiv(el, x, y, w, h) {
        try {
            el.style.position = "absolute";
            el.style.top = y + "px";
            el.style.left = x + "px";
            if (w) {
                el.style.width = w + "px";
            }
            if (h) {
                el.style.height = h + "px";
            }
        } catch (e) {
            debugLog("Cannot layout element", el, e);
        }
    }

    snapshot() {
        if (!this.videoCaptureElement) {
            debugLog("snapshot: no active video feed");
            return null;
        }

        // get the bounding rect of the shape within the video screen...
        let cameraRect = {
            x: 0,
            y: 0,
            width: this.shapeData.width,
            height: this.shapeData.height,
        };
        return this.videoCaptureElement.snapshot(cameraRect, this.isMirrored);
    }
    hide() {
        if (this.videoCaptureElement) {
            this.videoCaptureElement.stopRecord();
            this.videoCaptureElement = null;

            this.cameraPickerDiv.remove();

            this.cameraPickerDiv = null;
            this.videoElement = null;
        }
    }
}
