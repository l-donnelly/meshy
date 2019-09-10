const GcodeExporter = (() => {
    const newline = '\n';

    // convert per-second speed to per-minute speed
    function perSec2PerMin(val) {
        return val * 60;
    }

    class GcodeExporter {
        constructor() {
            this.filename = "gcode";
            this.extension = "gcode";
            this.travelSpeed = 9000;
            this.coordPrecision = 3,
                this.extruderPrecision = 5;

            this.init();

            this.gcode = "";
        }

        setFilename(filename) {
            if (filename !== undefined) this.filename = filename;
            return this;
        }

        setExtension(extension) {
            if (extension !== undefined) this.extension = extension;
            return this;
        }

        setTravelSpeed(speed) {
            if (speed !== undefined) this.travelSpeed = perSec2PerMin(speed);
            return this;
        }

        setCoordPrecision(precision) {
            if (precision !== undefined) this.coordPrecision = precision;
            return this;
        }

        setExtruderPrecision(precision) {
            if (precision !== undefined) this.extruderPrecision = precision;
            return this;
        }

        init() {
            this.position = new THREE.Vector3();
            this.e = 0;
            this.f = 0;

            this.gcode = "";

            return this;
        }

        write(s) {
            this.gcode += s;
        }

        // write a string and then a newline
        writeLn(s) {
            this.write(s + newline);
        }

        writeNewline() {
            this.write(newline);
        }

        // write a semicolon and then the comment text
        writeComment(c) {
            this.writeLn(`; ${c}`);
        }

        writeHeader() {
            this.writeComment(`FILENAME: ${this.filename}.${this.extension}`);
            this.writeComment("GENERATED WITH MESHY");
        }

        writeAbsolutePositionionMode() {
            this.writeLn("M82");
        }

        writeHeatExtruder(temperature) {
            this.writeLn(`M109 S${temperature}`);
        }

        // movement functions

        // travel to a point using the default travel speed
        writeTravel(pt) {
            this._writeMoveXYZEF("G0", pt, undefined, this.travelSpeed);
        }

        // move to a point, optionally extruding and accelerating to the given speed
        writePrint(pt, e, fps) {
            this._writeMoveXYZEF("G1", pt, e, perSec2PerMin(fps));
        }

        // set only speed
        writeSpeed(speed) {
            const f = perSec2PerMin(speed);
            this.writeLn(`G1 F${f}`);

            this.f = f;
        }

        writeExtrusion(e, fps) {
            let cmd = `G1${this._makeEParam(e)}`;
            this.e = e;

            if (fps !== undefined) {
                const fpm = perSec2PerMin(fps);
                cmd += ` F${fpm}`;
                this.f = fpm;
            }

            this.writeLn(cmd);
        }

        writeExtruderPosition(e) {
            this.writeLn(`G92 ${e}`);
            this.e = e;
        }

        writePrimingSequence(primeExtrusion) {
            // move extruder to endstops
            this.writeLn("G28");
            this.position.set(0, 0, 0);

            // if given a length of filament to extrude for a prime blob, move the
            // extruder up and extrude that much
            if (primeExtrusion) {
                this.writeTravel(this.position.clone().setZ(primeExtrusion * 5));
                this.writeExtruderPosition(0);
                this.writeExtrusion(primeExtrusion, 200);
                this.writeExtruderPosition(0);
            }
        }

        // internal writing functions

        _makeXParam(value) {
            return ` X${value.toFixed(this.coordPrecision)}`;
        }

        _makeYParam(value) {
            return ` Y${value.toFixed(this.coordPrecision)}`;
        }

        _makeZParam(value) {
            return ` Z${value.toFixed(this.coordPrecision)}`;
        }

        _makeEParam(value) {
            return ` E${+value.toFixed(this.extruderPrecision)}`;
        }

        // write move with the given params
        _writeMoveXYZEF(code, pt, e, f) {
            let cmd = code;

            if (pt !== undefined) {
                if (pt.x !== this.position.x) cmd += this._makeXParam(pt.x);
                if (pt.y !== this.position.y) cmd += this._makeYParam(pt.y);
                if (pt.z !== this.position.z) cmd += this._makeZParam(pt.z);

                this.position.copy(pt);
            }

            if (e !== undefined) {
                // e normalized to the given precision
                const en = +e.toFixed(this.extruderPrecision);

                if (en !== this.e) {
                    cmd += ` E${en}`;
                    this.e = en;
                }
            }

            if (f !== undefined && f !== this.f) {
                cmd += ` F${f}`;
                this.f = f;
            }

            this.writeLn(cmd);
        }

        saveToFile() {
            const blob = new Blob([this.gcode], { type: 'text/plain' });
            const fname = `${this.filename}.${this.extension}`;

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
    }

    return GcodeExporter;
})();

export { GcodeExporter }