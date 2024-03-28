import ScratchJr from "../editor/ScratchJr";
import OS from "../tablet/OS";
import Camera from "../painteditor/Camera";
import Record from "../editor/ui/Record";
import {
    setupMediaRecording,
    audioRecorderAvailable,
    videoRecorderAvailable,
} from "../tablet/Web";

export function editorMain() {
    OS.getsettings(doNext);
    OS.analyticsEvent("editor", "project_editor_open");
    async function doNext(str) {
        var list = str.split(",");
        OS.path = list[1] == "0" ? list[0] + "/" : undefined;
        await setupMediaRecording();
        Record.available = audioRecorderAvailable();
        Camera.available = videoRecorderAvailable();
        ScratchJr.appinit(window.Settings.scratchJrVersion);
    }
}
