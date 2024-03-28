import { preprocessAndLoadCss } from "../utils/lib";
import Localization from "../utils/Localization";
import InitialOptions from "../utils/InitialOptions";
import OS from "../tablet/OS";
import IO from "../tablet/IO";
import MediaLib from "../tablet/MediaLib";
import * as db from "../tablet/WebDB.js";

import { indexMain } from "./index";
import { homeMain } from "./home";
import { editorMain } from "./editor";
import { gettingStartedMain } from "./gettingstarted";
import {
    inappInterfaceGuide,
    inappAbout,
    inappBlocksGuide,
    inappPaintEditorGuide,
    inappPrivacyPolicy,
} from "./inapp";

/* This function replicates the behavior of the `.on<event>` properties but is
 * implemented using `addEventListener` and `removeEventListener`. This allows
 * only one handler to be registered for each event. Touch events in ScratchJr
 * were previously implemented using the `.on<event>` properties, but these
 * are apparently not implemented correctly on all devices (more specifically,
 * all the `ontouch*` properties do not work on touchscreen chromebooks). We
 * maintain the same behavior by only allowing one handler to be registered,
 * which is depended on by some parts of ScratchJr (e.g. various handlers are
 * attached to the window at different times based on the state of the app,
 * but only one handler should be active at any time).
 *
 * Params
 * ------
 * event: string
 *   The name of the event to register a handler for.
 * handler: function
 *   The event handler to register. If undefined, the existing handler for the
 *   event will be removed.
 * target: object
 *   The object to register the event handler on. Defaults to `window` if not
 *   provided.
 *
 */
window.setEventHandler = function (event, handler, target) {
    if (target === undefined) {
        target = window;
    }
    if (!Object.hasOwn(target, "_scratchJrEventHandlers")) {
        target._scratchJrEventHandlers = {};
    }
    const existingHandler = target._scratchJrEventHandlers[event];
    if (existingHandler !== undefined) {
        target.removeEventListener(event, existingHandler);
    }
    if (handler !== undefined) {
        target.addEventListener(event, handler);
        target._scratchJrEventHandlers[event] = handler;
    }
};

function loadSettings(settingsRoot, whenDone) {
    IO.requestFromServer(settingsRoot + "settings.json", (result) => {
        window.Settings = JSON.parse(result);
        whenDone();
    });
}

// App-wide entry-point
window.onload = async () => {
    // Function to be called after settings, locale strings, and Media Lib
    // are asynchronously loaded. This is overwritten per HTML page below.
    let entryFunction = () => {};

    // Root directory for includes. Needed in case we are in the inapp-help
    // directory (and root becomes '../')
    let root = "./";

    // scratchJrPage is defined in the HTML pages
    let page = window.scratchJrPage;

    const params = new URLSearchParams(window.location.search);
    if (!window.studentAssignmentID) {
        window.studentAssignmentID = params.get("student_assignment_id", null);
    }
    if (!window.itemID) {
        window.itemID = params.get("item_id", null);
    }

    if (window.setupTimeTracking && window.setActive) {
        window.setupTimeTracking();
        window.addEventListener('mousemove', window.setActive);
        window.addEventListener('touchstart', window.setActive);
        window.addEventListener('keydown', window.setActive);
    }

    console.log("waitin for db");
    const shouldCreateNewProject = await db.initDB();
    console.log("done waitin for db");

    // Load CSS and set root/entryFunction for all pages
    switch (page) {
        case "index":
            // Index page (splash screen)
            preprocessAndLoadCss("css", "css/font.css");
            preprocessAndLoadCss("css", "css/base.css");
            preprocessAndLoadCss("css", "css/start.css");
            preprocessAndLoadCss("css", "css/thumbs.css");
            /* For parental gate. These CSS properties should be refactored */
            preprocessAndLoadCss("css", "css/editor.css");
            entryFunction = () =>
                OS.waitForInterface(function () {
                    var assets = Object.keys(MediaLib.keys).join(",");
                    OS.registerLibraryAssets(
                        MediaLib.version,
                        assets,
                        indexMain
                    );
                });
            break;
        case "home":
            // Lobby pages
            preprocessAndLoadCss("css", "css/font.css");
            preprocessAndLoadCss("css", "css/base.css");
            preprocessAndLoadCss("css", "css/lobby.css");
            preprocessAndLoadCss("css", "css/thumbs.css");
            entryFunction = () => OS.waitForInterface(homeMain);
            break;
        case "editor":
            // Editor pages
            preprocessAndLoadCss("css", "css/font.css");
            preprocessAndLoadCss("css", "css/base.css");
            preprocessAndLoadCss("css", "css/editor.css");
            preprocessAndLoadCss("css", "css/editorleftpanel.css");
            preprocessAndLoadCss("css", "css/editorstage.css");
            preprocessAndLoadCss("css", "css/editormodal.css");
            preprocessAndLoadCss("css", "css/librarymodal.css");
            preprocessAndLoadCss("css", "css/paintlook.css");
            entryFunction = () =>
                OS.waitForInterface(() => {
                    if (shouldCreateNewProject) {
                        var obj = {};
                        obj.name =
                            Localization.localize("NEW_PROJECT_PREFIX") +
                            " " +
                            1;
                        obj.version = window.Settings.scratchJrVersion;
                        obj.mtime = new Date().getTime().toString();
                        IO.createProject(obj, editorMain);
                    } else editorMain();
                });
            break;
        case "gettingStarted":
            // Getting started video page
            preprocessAndLoadCss("css", "css/font.css");
            preprocessAndLoadCss("css", "css/base.css");
            preprocessAndLoadCss("css", "css/gs.css");
            entryFunction = () => OS.waitForInterface(gettingStartedMain);
            break;
        case "inappAbout":
            // About ScratchJr in-app help frame
            preprocessAndLoadCss("style", "style/about.css");
            entryFunction = () => inappAbout();
            root = "../";
            break;
        case "inappInterfaceGuide":
            // Interface guide in-app help frame
            preprocessAndLoadCss("style", "style/style.css");
            preprocessAndLoadCss("style", "style/interface.css");
            entryFunction = () => inappInterfaceGuide();
            root = "../";
            break;
        case "inappPaintEditorGuide":
            // Paint editor guide in-app help frame
            preprocessAndLoadCss("style", "style/style.css");
            preprocessAndLoadCss("style", "style/paint.css");
            entryFunction = () => inappPaintEditorGuide();
            root = "../";
            break;
        case "inappBlocksGuide":
            // Blocks guide in-app help frame
            preprocessAndLoadCss("style", "style/style.css");
            preprocessAndLoadCss("style", "style/blocks.css");
            entryFunction = () => inappBlocksGuide();
            root = "../";
            break;
        case "inappPrivacyPolicy":
            // Blocks guide in-app help frame
            preprocessAndLoadCss("style", "style/style.css");
            preprocessAndLoadCss("style", "style/privacy.css");
            entryFunction = () => inappPrivacyPolicy();
            root = "../";
            break;
    }

    // Start up sequence
    // Load settings from JSON
    loadSettings(root, () => {
        // Load locale strings from JSON
        Localization.includeLocales(root, () => {
            // Load Media Lib from JSON
            MediaLib.loadMediaLib(root, () => {
                entryFunction();
            });
        });
        // Initialize currentUsage data
        InitialOptions.initWithSettings(window.Settings.initialOptions);
    });
};
