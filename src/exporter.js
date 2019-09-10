// Generate file output representing the model and save it.
import * as Utils from "./utils";

const Exporter = (() => {

    function Exporter() {
        this.littleEndian = true;
        this.p = 6;
    }

    Object.assign(Exporter.prototype, {

        export(mesh = new THREE.Mesh(), format = "obj", name = "meshy", factor = 1) {
            const littleEndian = this.littleEndian;
            let p = this.p;

            let blob;
            let fname;
            const geo = mesh.geometry;
            const matrix = mesh.matrixWorld;

            const count = geo.faces.length;
            const vertices = geo.vertices;
            const faces = geo.faces;

            const vector = new THREE.Vector3();
            //let writeVector3;

            if (format==="stl") {
                const stlSize = 84 + 50 * count;
                const array = new ArrayBuffer(stlSize);
                let offset = 80;
                const dv = new DataView(array);

                let writeVector3 = function({x, y, z}) {
                    dv.setFloat32(offset, x, littleEndian);
                    dv.setFloat32(offset + 4, y, littleEndian);
                    dv.setFloat32(offset + 8, z, littleEndian);

                    offset += 12;
                };

                // write face count
                dv.setUint32(offset, count, littleEndian);
                offset += 4;

                // write faces
                for (let f = 0; f < count; f++) {
                    let face = faces[f];

                    writeVector3(face.normal);

                    for (let v = 0; v < 3; v++) {
                        vector.copy(vertices[face[Utils.faceGetSubscript(v)]]);
                        vector.applyMatrix4(matrix);
                        vector.multiplyScalar(factor);

                        writeVector3(vector);
                    }

                    // the "attribute byte count" should be set to 0 according to
                    // https://en.wikipedia.org/wiki/STL_(file_format)
                    dv.setUint8(offset, 0);
                    dv.setUint8(offset+1, 0);

                    offset += 2;
                }

                blob = new Blob([dv]);
                fname = `${name}.stl`;
            }
            else if (format=="stlascii") {
                let p = this.p;
                const indent2 = "  ";
                const indent4 = "    ";
                const indent6 = "      ";
                let out = "";

                let writeVector3 = function(v) {
                    let line = "";
                    for (let i=0; i<3; i++) line += ` ${+v.getComponent(i).toFixed(p)}`;
                    return line;
                };

                out =  `solid ${name}\n`;
                for (let f = 0; f < count; f++) {
                    let faceOut = "";
                    let face = faces[f];
                    faceOut += `${indent2}facet normal${writeVector3(face.normal)}\n`;
                    faceOut += `${indent4}outer loop\n`;
                    for (let v = 0; v < 3; v++) {
                        vector.copy(vertices[face[Utils.faceGetSubscript(v)]]);
                        vector.applyMatrix4(matrix);
                        vector.multiplyScalar(factor);

                        faceOut += `${indent6}vertex${writeVector3(vector)}\n`;
                    }
                    faceOut += `${indent4}endloop\n`;
                    faceOut += `${indent2}endfacet\n`;

                    out += faceOut;
                }
                out += "endsolid";

                blob = new Blob([out], { type: 'text/plain' });
                fname = `${name}.stl`;
            }
            else if (format=="obj") {
                let out = "";

                out =  "# OBJ exported from Meshy, 0x00019913.github.io/meshy \n";
                out += "# NB: this file only stores faces and vertex positions. \n";
                out += `# number vertices: ${vertices.length}\n`;
                out += `# number triangles: ${faces.length}\n`;
                out += "#\n";
                out += "# vertices: \n";

                // write the list of vertices
                for (let v = 0; v < vertices.length; v++) {
                    let line = "v";

                    vector.copy(vertices[v]);
                    vector.applyMatrix4(matrix);
                    vector.multiplyScalar(factor);

                    for (let c = 0; c < 3; c++) line += ` ${+vector.getComponent(c).toFixed(p)}`;

                    line += "\n";
                    out += line;
                }

                out += "# faces: \n";
                for (let f = 0; f < count; f++) {
                    let line = "f";
                    let face = faces[f];

                    for (let v = 0; v < 3; v++) {
                        line += ` ${face[Utils.faceGetSubscript(v)] + 1}`;
                    }

                    line += "\n";
                    out += line;
                }

                blob = new Blob([out], { type: 'text/plain' });
                fname = `${name}.obj`;
            }
            else {
                throw `Exporting format '${format}' is not supported.`;

                return;
            }

            const a = document.createElement("a");
            if (window.navigator.msSaveOrOpenBlob) { // IE :(
                window.navigator.msSaveOrOpenBlob(blob, fname);
            }
            else {
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = fname;
                document.body.appendChild(a);
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                });
            }
        }
    });



    return Exporter;

})();

export { Exporter }