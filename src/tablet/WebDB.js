// Required to let webpack 4 know it needs to copy the wasm file to our assets
import sqlWasm from "!!file-loader?name=sql-wasm-[contenthash].wasm!sql.js/dist/sql-wasm.wasm";
import initSqlJs from "sql.js";

// see https://github.com/sql-js/sql.js/#usage

let db = null;
let initPromise;
let latestThumbnail = null;

// data store locations
let baseKey = null;

window.getStringDBAndThumbnail = getStringDBAndThumbnail;

// function to get the database as a string and the thumbnail
async function getStringDBAndThumbnail() {
    return [getDBString(), latestThumbnail];
}

window.downloadDB = downloadDB;

async function downloadDB() {
    const filename = "scratchDB.sqlite";
    const binaryData = db.export();
    const blob = new Blob([binaryData], { type: "application/octet-stream" });
    const response = new Response(blob, {
        headers: {
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
    const url = URL.createObjectURL(await response.blob());
    window.open(url, "_blank");
    URL.revokeObjectURL(url);
}

/**
 * Allows the user to select a file and asynchronously converts it into a Uint8Array.
 * Creates a hidden file input element and triggers a click event to open the file dialog.
 * @returns {Promise<Uint8Array>} A Promise that resolves with the Uint8Array containing
 * the file data or rejects with an error if the file operation fails.
 */
async function uploadFileToUint8Array() {
    return new Promise((resolve, reject) => {
        // Create a file input element
        const fileInput = document.createElement("input");
        fileInput.type = "file";

        // Add event listener to handle file selection
        fileInput.addEventListener("change", (e) => {
            const file = e.target.files[0];

            if (file) {
                const reader = new FileReader();

                reader.addEventListener("load", (e) => {
                    // Read the file and convert it to a Uint8Array
                    const arrayBuffer = e.target.result;
                    const uint8Array = new Uint8Array(arrayBuffer);

                    // Remove the file input element from the DOM
                    fileInput.parentNode.removeChild(fileInput);

                    resolve(uint8Array);
                });

                reader.addEventListener("error", (e) => {
                    // Remove the file input element from the DOM and reject
                    fileInput.parentNode.removeChild(fileInput);
                    reject(new Error("Error reading file."));
                });

                // Loads the file as an ArrayBuffer and triggers the `load` event listener above
                reader.readAsArrayBuffer(file);
            } else {
                // If no file selected, remove the file input element from the DOM and reject
                fileInput.parentNode.removeChild(fileInput);
                reject(new Error("No file selected."));
            }
        });

        // Trigger a click event to open the file dialog
        document.body.appendChild(fileInput);
        fileInput.click();
    });
}

// converts binary data (a Uint8Array, the data format sql.js exports to) to a UTF-16 string
// see https://github.com/sql-js/sql.js/wiki/Persisting-a-Modified-Database
function binaryDataToUTF16String(binaryData) {
    // We iterate over the binary data in chunks, since there is a maximum stack size.
    // For each chunk, we convert all the data to a string, and then join all the
    // strings together at the end.
    const chunkSize = 0xffff;
    const stringChunks = [];
    for (let i = 0; i < binaryData.length; i += chunkSize) {
        stringChunks.push(
            String.fromCharCode.apply(
                null,
                binaryData.subarray(i, i + chunkSize)
            )
        );
    }
    return stringChunks.join("");
}

// converts a UTF-16 string to binary data (a Uint8Array, the data format sql.js expects)
// see https://github.com/sql-js/sql.js/wiki/Persisting-a-Modified-Database
function UTF16StringToBinaryData(string) {
    const binaryData = new Uint8Array(string.length);
    for (let i = 0; i < string.length; i++) {
        binaryData[i] = string.charCodeAt(i);
    }
    return binaryData;
}

function UTF16StringToUTF8String(utf16String) {
    const utf8Bytes = [];
    for (let i = 0; i < utf16String.length; i++) {
        let charCode = utf16String.charCodeAt(i);

        if (charCode < 0x80) {
            utf8Bytes.push(charCode);
        } else if (charCode < 0x800) {
            utf8Bytes.push((charCode >> 6) | 0xc0);
            utf8Bytes.push((charCode & 0x3f) | 0x80);
        } else {
            utf8Bytes.push((charCode >> 12) | 0xe0);
            utf8Bytes.push(((charCode >> 6) & 0x3f) | 0x80);
            utf8Bytes.push((charCode & 0x3f) | 0x80);
        }
    }

    const chunkSize = 0xffff;
    const stringChunks = [];
    for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
        stringChunks.push(
            String.fromCharCode.apply(null, utf8Bytes.slice(i, i + chunkSize))
        );
    }
    return stringChunks.join("");
}

function UTF8StringToUTF16String(utf8String) {
    let utf16String = "";
    let index = 0;

    while (index < utf8String.length) {
        let codePoint;

        const byte1 = utf8String.charCodeAt(index++);
        if ((byte1 & 0x80) === 0) {
            codePoint = byte1;
        } else if ((byte1 & 0xe0) === 0xc0) {
            const byte2 = utf8String.charCodeAt(index++);
            codePoint = ((byte1 & 0x1f) << 6) | (byte2 & 0x3f);
        } else if ((byte1 & 0xf0) === 0xe0) {
            const byte2 = utf8String.charCodeAt(index++);
            const byte3 = utf8String.charCodeAt(index++);
            codePoint =
                ((byte1 & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f);
        } else {
            const byte2 = utf8String.charCodeAt(index++);
            const byte3 = utf8String.charCodeAt(index++);
            const byte4 = utf8String.charCodeAt(index++);
            codePoint =
                ((byte1 & 0x07) << 18) |
                ((byte2 & 0x3f) << 12) |
                ((byte3 & 0x3f) << 6) |
                (byte4 & 0x3f);
        }

        utf16String += String.fromCharCode(codePoint);
    }

    return utf16String;
}

// see https://github.com/jfo8000/ScratchJr-Desktop/blob/master/src/main.js#L674
function initTables() {
    // TODO: maybe handle errors manually?
    // this.db.handleError = this.handleError;

    db.run(
        "CREATE TABLE IF NOT EXISTS PROJECTS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MTIME DATETIME, ALTMD5 TEXT, POS INTEGER, NAME TEXT, JSON TEXT, THUMBNAIL TEXT, OWNER TEXT, GALLERY TEXT, DELETED TEXT, VERSION TEXT)\n"
    );
    db.run(
        "CREATE TABLE IF NOT EXISTS USERSHAPES (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, NAME TEXT, OWNER TEXT, SCALE TEXT, VERSION TEXT)\n"
    );
    db.run(
        "CREATE TABLE IF NOT EXISTS USERBKGS (ID INTEGER PRIMARY KEY AUTOINCREMENT, CTIME DATETIME DEFAULT CURRENT_TIMESTAMP, MD5 TEXT, ALTMD5 TEXT, WIDTH TEXT, HEIGHT TEXT, EXT TEXT, OWNER TEXT,  VERSION TEXT)\n"
    );
    db.run(
        "CREATE TABLE IF NOT EXISTS PROJECTFILES (MD5 TEXT PRIMARY KEY, CONTENTS TEXT)\n"
    );
}

function runMigrations() {
    try {
        db.run("ALTER TABLE PROJECTS ADD COLUMN ISGIFT INTEGER DEFAULT 0");
    } catch (e) {
        console.log("failed to migrate tables", e);
    }
}

// Hashes a string using SHA-256 and returns it as a base64-encoded string
export async function hashString(inputString) {
    const encoder = new TextEncoder();
    const data = encoder.encode(inputString);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const base64String = btoa(String.fromCharCode.apply(null, hashArray));
    return base64String;
}

// this event will fire whenever the user closes the tab or navigates away from the page
// see https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event#usage_notes
window.addEventListener("beforeunload", function () {
    if (document.visibilityState === "hidden") saveDB();
});

let saveTimeout = null;
export function saveDB() {
    if (db === null) return null;

    if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
        console.log("savedb");

        const binaryData = db.export();
        const stringData = binaryDataToUTF16String(binaryData);
        const dbHash = hashString(stringData);
        // early return if no changes were made to the db string
        if (dbHash === localStorage.getItem(baseKey)) {
            console.log("no changes to save, skipping");
            return stringData;
        } else {
            console.log("changes detected, saving");
        }

        if (window.saveScratchJrProject) {
            window.saveScratchJrProject(
                UTF16StringToUTF8String(stringData),
                latestThumbnail
            );
        }

        localStorage.setItem(baseKey, dbHash);
    }, 1000);
}

// Returns the current database as a UTF-8 string.
// Make sure the database is saved BEFORE calling this function.
export function getDBString() {
    if (db === null) return null;

    const binaryData = db.export();
    return UTF16StringToUTF8String(binaryDataToUTF16String(binaryData));
}

async function getInitialDBString() {
    let dbData = null;

    // Try to load from CodeHS DB
    // This function is defined in scratchjr.js on the CodeHS side and called on page load
    if (window.loadScratchJrProject) {
        let showUploadDB = false;
        const result = await window.loadScratchJrProject();
        // determine whether to show the upload DB button
        // window.loadScratchJrProject was only returning the DB data before this change,
        // but now it also returns the showUploadDB boolean as well, so we need to check
        // if the result is an array or not to keep backwards compatibility
        if (Array.isArray(result)) {
            dbData = result[0];
            showUploadDB = result[1];
        } else {
            dbData = result;
        }
        if (showUploadDB) {
            try {
                const uploadedBinaryData = await uploadFileToUint8Array();
                return binaryDataToUTF16String(uploadedBinaryData);
            } catch (e) {
                // Print out error and continue loading DB from CodeHS
                console.log(e);
            }
        }

        if (dbData) {
            dbData = UTF8StringToUTF16String(dbData);
        }
    }

    return dbData;
}

export async function initDB() {
    console.log("init");

    // return existing promise if it exists
    if (initPromise) {
        return initPromise;
    }

    // create a new promise that resolves with whether we should
    // create a new project once it's initialized
    initPromise = new Promise(async (resolve) => {
        let shouldCreateNewProject = false;
        const SQL = await initSqlJs({
            locateFile: () => sqlWasm,
        });
        window.SQL = SQL;

        if (window.sharedProgramID) {
            const id = window.sharedProgramID;
            baseKey = "sp-" + id;
        } else if (window.studentAssignmentID) {
            const id = window.studentAssignmentID;
            baseKey = "sa-" + id;
        } else if (window.itemID) {
            const id = window.itemID;
            baseKey = "item-" + id;
        } else if (window.scratchJrPage === "editor") {
            alert("No IDs found. DB will not be loaded or saved.");
        }

        // get saved data from codehs, then initialize the database with it if it
        // exists. otherwise, create a new database and initialize the tables and run migrations.
        const dbDataString = await getInitialDBString();
        if (dbDataString) {
            const binaryData = UTF16StringToBinaryData(dbDataString);
            db = new SQL.Database(binaryData);
        } else {
            db = new SQL.Database();
            initTables();
            runMigrations();
            shouldCreateNewProject = true;
        }
        window.db = db;
        console.log("shouldCreateNewProject: ", shouldCreateNewProject);
        if (
            new URLSearchParams(window.location.search).get(
                "show-project-files"
            ) === "true"
        ) {
            await displayProjectFiles();
        }
        resolve(shouldCreateNewProject);
    });

    return initPromise;
}

async function displayProjectFiles() {
    return new Promise(async (resolve) => {
        const rows = JSON.parse(
            await executeQueryFromJSON({
                stmt: `select * from projectfiles`,
            })
        )[0].values;
        const container = document.createElement("div");

        for (const row of rows) {
            const md5 = row[0];
            const contents = row[1];

            // Determine the image type based on the md5 filename
            const imageType = md5.endsWith(".png")
                ? "image/png"
                : "image/svg+xml";

            // Create an img element
            const img = document.createElement("img");

            // Set the src attribute to the data URI
            img.src = `data:${imageType};base64,${contents}`;
            img.title = md5;

            // Append the img element to the container
            container.appendChild(img);
        }

        // Append the container to the DOM
        document.body.appendChild(container);
    });
}

export async function executeQueryFromJSON(json) {
    if (db === null) await initDB();

    // see Web interface, query()
    const { stmt, values } = json;
    return JSON.stringify(db.exec(stmt, values));
}

// see https://github.com/jfo8000/ScratchJr-Desktop/blob/master/src/main.js#L898
export async function executeStatementFromJSON(json) {
    if (db === null) await initDB();
    // see Web interface, stmt()
    const { stmt, values } = json;
    const statement = db.prepare(stmt, values);
    while (statement.step()) statement.get();
    const result = db.exec("select last_insert_rowid();");
    const lastRowId = result[0].values[0][0];
    return lastRowId;
}

function isThumbnail(md5) {
    return md5.endsWith(".png") && md5.includes("_");
}

/**
 * Clears all thumbnails from the PROJECTFILES table in the database.
 *
 * See saveToProjectFiles() for more context.
 */
async function clearThumbnails() {
    const result = JSON.parse(
        await executeQueryFromJSON({
            stmt: `select * from projectfiles`,
        })
    );

    // early return if there are no rows in the table
    if (!result.length) return;

    const rows = result[0].values;
    const md5sToDelete = [];
    for (const row of rows) {
        const md5 = row[0];
        if (isThumbnail(md5)) {
            md5sToDelete.push(md5);
        }
    }

    const placeholders = md5sToDelete.map(() => "?").join(", ");
    await executeStatementFromJSON({
        stmt: `delete from projectfiles where md5 in (${placeholders});`,
        values: md5sToDelete,
    });
}

/**
 * Saves a "project file" to the PROJECTFILES table in the database.
 *
 * There are 2 columns in the table, 1 for filename (fileMD5), and one for the contents
 * (a base64-encoded string representing image data that can be used in a data URI).
 * Additionally, there are 2 categories of project files. One category is thumbnails
 * (or screenshots) that are taken every time the user saves a project. We clear all
 * of the previous thumbnails whenever a new one is saved, otherwise they would
 * accumulate and take up a lot of space. The other category is custom assets, like
 * user-created/-edited sprites or backgrounds. For each custom asset, we save a PNG
 * and SVG representation of the asset. For thumbnails, we save the PNG representation.
 * We can differentiate between the thumbnails and custom asset types by checking the
 * fileMD5; thumbnails have their project ID plus an underscore prefixed to the fileMD5,
 * so we can just check if a PNG file has a "_" in its filename.
 *
 * Reference: https://github.com/jfo8000/ScratchJr-Desktop/blob/master/src/main.js#L842
 *
 * @param {string} fileMD5
 * @param {string} content
 */
export async function saveToProjectFiles(fileMD5, content) {
    // query for the current file contents to see if they actually changed
    let currentContents = "";
    const queryResult = JSON.parse(
        await executeQueryFromJSON({
            stmt: `select contents from projectfiles where md5 = ?`,
            values: [fileMD5],
        })
    );
    if (
        queryResult.length > 0 &&
        queryResult[0].values.length > 0 &&
        queryResult[0].values[0].length > 0
    ) {
        currentContents = queryResult[0].values[0][0];
    }

    // if the contents changed, update the db and save
    if (content !== currentContents) {
        if (isThumbnail(fileMD5)) {
            await clearThumbnails();
            latestThumbnail = "data:image/png;base64," + content;
        }
        await executeStatementFromJSON({
            stmt: `insert or replace into projectfiles (md5, contents) values (?, ?);`,
            values: [fileMD5, content],
        });

        await executeStatementFromJSON({
            stmt: `vacuum;`,
        });

        saveDB();
    }
}

// actually returns SHA-256
export async function getMD5(data) {
    // return crypto.createHash('md5').update(data).digest('hex');
    const utf8 = new TextEncoder().encode(data);
    return crypto.subtle.digest("SHA-256", utf8).then((hashBuffer) => {
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray
            .map((bytes) => bytes.toString(16).padStart(2, "0"))
            .join("");
        return hashHex;
    });
}

// see https://github.com/jfo8000/ScratchJr-Desktop/blob/master/src/main.js#L822
export async function readProjectFile(fileMD5) {
    const json = {};
    json.cond = "MD5 = ?";
    json.items = ["CONTENTS"];
    json.values = [fileMD5];
    const table = "PROJECTFILES";

    json.stmt = `select ${json.items} from ${table} where ${json.cond}${
        json.order ? ` order by ${json.order}` : ""
    }`;

    var rows = await executeQueryFromJSON(json);
    rows = JSON.parse(rows);
    if (rows.length > 0) {
        return rows[0]["values"][0][0];
    }
    return null;
}
