const fs = require("fs");
const endOfLine = require("os").EOL;
const openDSU = require("opendsu");

const { ALIAS_SYNC_ERR_CODE } = require("../../utils");

function verifySignature(anchorKeySSI, newSSIIdentifier, lastSSIIdentifier) {
    const newSSI = openDSU.loadAPI("keyssi").parse(newSSIIdentifier);
    const timestamp = newSSI.getTimestamp();
    const signature = newSSI.getSignature();
    let dataToVerify = timestamp;
    if (lastSSIIdentifier) {
        dataToVerify = lastSSIIdentifier + dataToVerify;
    }

    if (newSSI.getTypeName() === openDSU.constants.KEY_SSIS.SIGNED_HASH_LINK_SSI) {
        dataToVerify += anchorKeySSI.getIdentifier();
        return anchorKeySSI.verify(dataToVerify, signature);
    }
    if (newSSI.getTypeName() === openDSU.constants.KEY_SSIS.TRANSFER_SSI) {
        dataToVerify += newSSI.getSpecificString();
        return anchorKeySSI.verify(dataToVerify, signature);
    }

    throw Error(`Invalid newSSI type provided`);
}

/**
 * Append `hash` to file only
 * if the `lastHashLink` is the last hash in the file
 *
 * @param {string} path
 * @param {string} hash
 * @param {object} options
 * @param {string|undefined} options.lastHashLink
 * @param {number} options.fileSize
 * @param {callback} callback
 */
function appendHashLink(path, hash, options, callback) {
    fs.open(path, fs.constants.O_RDWR, (err, fd) => {
        if (err) {
            return OpenDSUSafeCallback(callback)(
                createOpenDSUErrorWrapper(`Failed to append hash <${hash}> in file at path <${path}>`, err)
            );
        }

        fs.read(fd, $$.Buffer.alloc(options.fileSize), 0, options.fileSize, null, (err, bytesRead, buffer) => {
            if (err) {
                return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed read file <${path}>`, err));
            }
            // compare the last hash in the file with the one received in the request
            // if they are not the same, exit with error
            const fileContent = buffer.toString().trimEnd();
            const hashes = fileContent ? fileContent.split(endOfLine) : [];
            const lastHashLink = hashes[hashes.length - 1];

            if (hashes.length && lastHashLink !== options.lastHashLink) {
                // TODO
                // options.lastHashLink === null
                const opendsu = require("opendsu");
                const keySSISpace = opendsu.loadAPI("keyssi");
                if (lastHashLink) {
                    const lastSSI = keySSISpace.parse(lastHashLink);
                    if (lastSSI.getTypeName() === opendsu.constants.KEY_SSIS.TRANSFER_SSI) {
                        return __writeNewSSI();
                    }
                }
                console.log(
                    "__appendHashLink error.Unable to add alias: versions out of sync.",
                    lastHashLink,
                    options.lastHashLink
                );
                console.log("existing hashes :", hashes);
                console.log("received hashes :", options);
                return callback({
                    code: ALIAS_SYNC_ERR_CODE,
                    message: "Unable to add alias: versions out of sync",
                });
            }

            function __writeNewSSI() {
                fs.write(fd, hash + endOfLine, options.fileSize, (err) => {
                    if (err) {
                        console.log("__appendHashLink-write : ", err);
                        return OpenDSUSafeCallback(callback)(createOpenDSUErrorWrapper(`Failed write in file <${path}>`, err));
                    }

                    fs.close(fd, callback);
                });
            }

            __writeNewSSI();
        });
    });
}

module.exports = {
    ALIAS_SYNC_ERR_CODE,
    verifySignature,
    appendHashLink,
};
