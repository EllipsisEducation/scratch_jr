import { gn } from "../utils/lib";
import Localization from "../utils/Localization";
import OS from "../tablet/OS";
import Lobby from "../lobby/Lobby";

export function homeMain() {
    gn("logotab").onclick = homeGoBack;
    homeStrings();
    OS.getsettings(doNext);
    function doNext(str) {
        var list = str.split(",");
        OS.path = list[1] == "0" ? list[0] + "/" : undefined;
        Lobby.appinit(window.Settings.scratchJrVersion);
    }
}

function homeGoBack() {
    const params = new URLSearchParams();
    if (window.studentAssignmentID) {
        params.append("student_assignment_id", window.studentAssignmentID);
    }
    if (window.itemID) {
        params.append("item_id", window.itemID);
    }

    const url = "index.html?back=yes&" + params.toString();
    window.location.href = url;
}

function homeStrings() {
    gn("abouttab-text").textContent = Localization.localize("ABOUT_SCRATCHJR");
    gn("interfacetab-text").textContent =
        Localization.localize("INTERFACE_GUIDE");
    gn("painttab-text").textContent =
        Localization.localize("PAINT_EDITOR_GUIDE");
    gn("blockstab-text").textContent = Localization.localize("BLOCKS_GUIDE");
    gn("privacytab-text").textContent = Localization.localize("PRIVACY_POLICY");
}
