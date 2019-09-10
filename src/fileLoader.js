import 'three/examples/js/loaders/OBJLoader.js';
import 'three/examples/js/loaders/STLLoader.js';
import * as Utils from "./utils";

const FileLoader = function() {

    this.load = (file, meshy, callback) => {
        const fSplit = Utils.splitFilename(file.name);
        const filename = fSplit.name;
        const format = fSplit.extension;

        const reader = new FileReader();

        switch(format) {

            case 'obj':

                reader.addEventListener("load", ({target}) => {
                    const result = target.result;
                    const object = new THREE.OBJLoader().parse(result);

                    const geo = new THREE.Geometry();

                    if (object && object.children) {
                        for (let i = 0; i < object.children.length; i++) {
                            const bufferGeo = object.children[i].geometry;
                            geo.merge(new THREE.Geometry().fromBufferGeometry(bufferGeo));
                        }
                    }

                    if (callback) callback(geo, filename, meshy);
                });

                reader.readAsText(file);

                break;

            case 'stl':

                reader.addEventListener("load", ({target}) => {
                    const result = target.result;
                    const bufferGeo = new THREE.STLLoader().parse(result);
                    const geo = new THREE.Geometry().fromBufferGeometry(bufferGeo);

                    if (callback) callback(geo, filename, meshy);
                });

                if (reader.readAsBinaryString !== undefined) {
                    reader.readAsBinaryString(file);
                }
                else {
                    reader.readAsArrayBuffer(file);
                }

                break;

            default:
                throw `Unsupported format ${format}`;
        }
    };

};

export { FileLoader }
