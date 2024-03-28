//////////////////////////////////////////////////
//  Web interface functions
//////////////////////////////////////////////////

import * as db from "./WebDB.js";
import { WebVideo } from "./WebVideo.js";
import Record from "../editor/ui/Record";
import { absoluteURL } from "../utils/lib.js";

// MediaRecorder node which records audio
let audioRecorder = null;
// AudioAnalyser node which gives us data to calculate volume
let audioAnalyser = null;
// stores latest audio recording URL
let latestAudioURL = null;
// stores latest recorded audio data to be converted to a blob
const latestAudioChunks = [];
// buffers audio data to calculate volume
let audioVolumeBuffer = null;

let webVideo = null;

const audioContext = new AudioContext();
const audioBuffers = {};
const audioSources = {};

// calculates the volume level of a given audio data array buffer
// used to display volume level preview in the audio recorder
function calculateVolumeLevel(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
        sum += audioData[i];
    }
    const average = sum / audioData.length;

    // Map to range 0.0 to 1.0
    const volume = average / 255;
    return volume;
}

export async function setupMediaRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log("Media recording unsupported!");
        return;
    }

    try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        const recorderAudioContext = new AudioContext();
        const audioStreamSource =
            recorderAudioContext.createMediaStreamSource(audioStream);
        audioAnalyser = recorderAudioContext.createAnalyser();
        audioStreamSource.connect(audioAnalyser);
        audioRecorder = new MediaRecorder(audioStream);
        audioRecorder.addEventListener("dataavailable", (e) =>
            latestAudioChunks.push(e.data)
        );
        audioRecorder.addEventListener("stop", async () => {
            const audioBlob = new Blob(latestAudioChunks, {
                type: "audio/webm",
            });

            Record.setButtonsEnabled(false);

            try {
                if (window.canSave) {
                    latestAudioURL = await window.uploadAudio(audioBlob);
                } else {
                    latestAudioURL = URL.createObjectURL(audioBlob);
                }
            } catch (err) {
                console.log("Audio upload error!", err);
                return;
            } finally {
                Record.setButtonsEnabled(true);
            }

            Record.soundname = latestAudioURL;

            // Create a FileReader to read the Blob as an ArrayBuffer
            // We need to do this to decode the audio data and save it
            // as a buffer in our sound management system.
            const reader = new FileReader();

            reader.addEventListener("loadend", async () => {
                const audioBuffer = await audioContext.decodeAudioData(
                    reader.result
                );
                audioBuffers["__recording__"] = audioBuffer;
            });

            reader.readAsArrayBuffer(audioBlob);
        });

        const bufferLength = audioAnalyser.frequencyBinCount;
        audioVolumeBuffer = new Uint8Array(bufferLength);
    } catch (err) {
        console.log("Audio recording error!", err);
    }
}

export function audioRecorderAvailable() {
    return audioRecorder !== null;
}

export function videoRecorderAvailable() {
    return true;
}

function stopRecording() {
    if (audioRecorder.state !== "inactive") {
        audioRecorder.stop();
    }
    if (latestAudioURL !== null) {
        latestAudioURL = null;
    }
}

export default class Web {
    // Database functions
    static stmt(json, fcn) {
        // json is an object with the format:
        // {
        //     "stmt": "<SQL statement to run with slots for values below>",
        //     "values": [<list of values to be plugged into the statement>],
        // }
        (async () => {
            const result = await db.executeStatementFromJSON(json);
            console.log("stmt", json, result);
            if (fcn) fcn(result);
            db.saveDB();
        })();
    }

    static query(json, fcn) {
        // json is an object with the format:
        // {
        //     "stmt": "<SQL statement to run with slots for values below>",
        //     "values": [<list of values to be plugged into the statement>],
        // }
        (async () => {
            const result = await db.executeQueryFromJSON(json);
            // console.log("query", json, result);
            if (fcn) fcn(result);
        })();
    }

    static setfield(db, id, fieldname, val, fcn) {
        console.log("setfield");
        if (fcn) fcn();
    }

    // IO functions

    static cleanassets(ft, fcn) {
        console.log("cleanassets");
        if (fcn) fcn();
    }

    static getmedia(file, fcn) {
        console.log("getmedia");
        (async () => {
            var content = await db.readProjectFile(file);
            if (fcn) fcn(content);
        })();
    }

    static getmediadata(key, offset, len, fcn) {
        console.log("getmediadata");
        if (fcn) fcn();
    }

    static processdata(key, off, len, oldstr, fcn) {
        console.log("processdata");
        if (fcn) fcn();
    }

    static getsettings(fcn) {
        console.log("getsettings");
        fcn("path,0,NO,NO");
    }

    static getmediadone(file, fcn) {
        console.log("getmediadone");
        if (fcn) fcn();
    }

    static setmedia(content, ext, fcn) {
        console.log("setmedia");
        (async () => {
            var name = await db.getMD5(content);
            const filename = `${name}.${ext}`;
            await db.saveToProjectFiles(filename, content, {
                encoding: "base64",
            });
            if (fcn) fcn(filename);
        })();
    }

    static setmedianame(str, name, ext, fcn) {
        console.log("setmedianame");
        const filename = `${name}.${ext}`;
        db.saveToProjectFiles(filename, str, { encoding: "base64" });
        if (fcn) fcn(filename);
    }

    static getmd5(str, fcn) {
        console.log("getmd5");
        (async () => {
            var name = await db.getMD5(str);
            if (fcn) fcn(name);
        })();
    }

    static remove(str, fcn) {
        console.log("remove");
        if (fcn) fcn();
    }

    static getfile(str, fcn) {
        console.log("getfile");
        if (fcn) fcn("");
    }

    static setfile(name, str, fcn) {
        console.log("setfile");
        if (fcn) fcn();
    }

    // Sound functions

    static registerSound(dir, name, fcn) {
        (async () => {
            // In this case, the user can not save the project, so we don't upload
            // the audio to the server and instead just use a blob URL
            if (name.startsWith("blob:")) {
                dir = "";
            }

            const url = absoluteURL(dir + name);
            console.log("registerSound", dir, name);
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            audioBuffers[name] = audioBuffer;
            if (fcn) fcn(name, audioBuffer.duration);
        })();
    }

    static playSound(name, onSoundEnd) {
        console.log("playSound");
        if (audioSources[name]) {
            audioSources[name].stop();
        }

        audioSources[name] = audioContext.createBufferSource();
        audioSources[name].buffer = audioBuffers[name];
        audioSources[name].connect(audioContext.destination);
        audioSources[name].addEventListener("ended", function () {
            this.stop();
            audioSources[name] = null;
            if (onSoundEnd) onSoundEnd();
        });
        audioSources[name].start();
    }

    static stopSound(name, fcn) {
        console.log("stopSound");
        if (audioSources[name]) {
            audioSources[name].stop();
        }
        if (fcn) fcn();
    }

    // Web Wiew delegate call backs

    static sndrecord(fcn) {
        console.log("sndrecord");
        if (audioRecorder === null) {
            console.log("Audio recorder not available");
            if (fcn) fcn(false);
            return;
        }

        stopRecording();

        latestAudioChunks.length = 0;

        audioRecorder.start();
        if (fcn) fcn(true);
    }

    static recordstop(fcn) {
        console.log("recordstop");
        if (audioRecorder === null) {
            console.log("Audio recorder not available");
            if (fcn) fcn(false);
            return;
        }

        stopRecording();

        if (fcn) fcn(true);
    }

    static volume(fcn) {
        console.log("volume");
        if (audioVolumeBuffer === null) {
            console.log("Audio volume not available");
            if (fcn) fcn(0);
            return;
        }

        audioAnalyser.getByteFrequencyData(audioVolumeBuffer);
        const volume = calculateVolumeLevel(audioVolumeBuffer);

        if (fcn) fcn(volume);
    }

    static startplay(fcn) {
        console.log("startplay");
        Web.playSound("__recording__");
        if (fcn) fcn(audioBuffers["__recording__"].duration);
    }

    static stopplay(fcn) {
        console.log("stopplay");
        Web.stopSound("__recording__");
        if (fcn) fcn();
    }

    static recorddisappear(b, fcn) {
        console.log("recorddisappear");
        if (fcn) fcn();
    }

    // Record state
    static askpermission() {
        console.log("askpermission");
    }

    // camera functions

    static hascamera() {
        console.log("hascamera");
        return videoRecorderAvailable();
    }

    static startfeed(data, fcn) {
        console.log("startfeed");

        if (webVideo === null) {
            webVideo = new WebVideo(data);
            webVideo.show();
        }

        if (fcn) fcn();
    }

    static stopfeed(fcn) {
        console.log("stopfeed");

        if (webVideo !== null) {
            webVideo.hide();
            webVideo = null;
        }

        if (fcn) fcn();
    }

    static choosecamera(mode, fcn) {
        // This is not needed for the web version
        console.log("choosecamera");
        if (fcn) fcn();
    }

    static captureimage(fcn) {
        console.log("captureimage");

        if (webVideo !== null) {
            // The image is returned as a data URL
            const imgDataURL = webVideo.snapshot();
            if (imgDataURL) {
                // we just want the base64 encoded image data without the header
                let rawImgData = imgDataURL.split(",")[1];
                Camera.processimage(rawImgData);
            }
        }

        if (fcn) fcn();
    }

    static hidesplash(fcn) {
        console.log("hidesplash");
        if (fcn) fcn();
    }

    static trace(str) {
        console.log("trace");
    }

    static parse(str) {
        console.log("parse");
    }

    static tracemedia(str) {
        console.log("tracemedia");
    }

    ignore() {}

    ///////////////
    // Sharing
    ///////////////

    static createZipForProject(projectData, metadata, name, fcn) {
        console.log("createZipForProject");
        if (fcn) fcn();
    }

    // Called on the JS side to trigger native UI for project sharing.
    // fileName: name for the file to share
    // emailSubject: subject text to use for an email
    // emailBody: body HTML to use for an email
    // shareType: 0 for Email; 1 for Airdrop
    // b64data: base-64 encoded .SJR file to share

    static sendSjrToShareDialog(fileName, emailSubject, emailBody, shareType) {
        console.log("sendSjrToShareDialog");
    }

    static registerLibraryAssets(version, assets, fcn) {
        console.log("registerLibraryAssets");
        if (fcn) fcn();
    }

    static duplicateAsset(path, name, fcn) {
        console.log("duplicateAsset");
        if (fcn) fcn();
    }

    // Name of the device/iPad to display on the sharing dialog page
    // fcn is called with the device name as an arg
    static deviceName(fcn) {
        console.log("deviceName");
        if (fcn) fcn("Web");
    }

    static analyticsEvent(category, action, label) {
        console.log("analyticsEvent");
    }

    static setAnalyticsPlacePref(preferredPlace) {
        console.log("setAnalyticsPlacePref");
    }

    static setAnalyticsPref(key, value) {
        console.log("setAnalyticsPref");
    }
}
