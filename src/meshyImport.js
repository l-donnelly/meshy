
/* meshy.js

   classes:

   - Meshy
   description:
    Main class representing the Meshy viewport. Encompasses UI, creating and
    handling the model, and controlling the viewport.
*/
import { Model } from "./model.js";
import { Units } from "./units.js";
import { Printout } from "./printout.js";
import { Transform, EditStack } from "./transform.js";
import { SupportGenerator } from "./supportGenerator.js";
import { Slicer } from "./slicer.js";
import { Gizmo } from "./gizmo.js";
import { Measurement } from "./measurement.js";
import { Exporter } from "./exporter";
import * as Utils from "./utils";
import { FileLoader } from "./fileLoader.js";
import "three/examples/js/QuickHull.js";
import {InfoBox} from "./infoBox";

// Constructor.
class Meshy {
    constructor() {
        this.self = this;
        this.units = Units.mm;

        // params
        this.buildVolumeSize = new THREE.Vector3(145, 145, 175);
        this.buildVolumeMin = null;
        this.buildVolumeMax = null;
        this.centerOriginOnBuildPlate = false;
        this.buildVolumeMaterials = {
            linePrimary: new THREE.LineBasicMaterial({
                color: 0xdddddd,
                linewidth: 1
            }),
            lineSecondary: new THREE.LineBasicMaterial({
                color: 0x777777,
                linewidth: 1
            }),
            lineTertiary: new THREE.LineBasicMaterial({
                color: 0x444444,
                linewidth: 1
            })
        };

        // toggles
        this.importEnabled = true;
        this.importingMeshName = "";
        this.buildVolumeVisible = true;

        this.importUnits = Units.mm;
        this.autocenterOnImport = true;

        // geometry
        this.model = null;
        this.isLittleEndian = true;
        this.vertexPrecision = 5;
        this.displayPrecision = 4;

        // webgl viewport
        this.container = document.getElementById("container");
        this.camera = null;
        this.scene = null;
        this.controls = null;
        this.renderer = null;
        this.axisWidget = null;
        this.printout = new Printout();
        this.printout.log("Meshy is freely available under the MIT license. Thanks for using!");
        this.printout.log("Supported import formats: OBJ, STL.");
        this.printout.log("Controls: LMB (turn), MMB (pan/zoom), RMB (pan), F (center on model), C (center of mass), W (wireframe), B (build volume), G (gizmo)");

        // undo stack
        this.editStack = new EditStack(this.printout);

        this.generateUI();
    }

    // Creates the dat.gui element and the InfoBox, initializes the viewport,
    // initializes build volume.
    generateUI() {

        this.filename = "meshy";
        this.exportUnits = this.units;
        this.backgroundColor = "#222222";
        this.meshColor = "#481a1a";
        this.wireframeColor = "#000000";
        this.meshRoughness = 0.3;
        this.meshMetalness = 0.5;
        this.measurementData = [];
        this.measurementIdx = -1;
        this.measureConvexHull = false;
        this.thicknessThreshold = 1.0;

        this.layerHeight = .1;
        this.lineWidth = 0.1;
        this.sliceAxis = "z";
        this.supportAngle = 45;
        this.supportSpacingFactor = 24;
        this.supportRadius = this.lineWidth * 4;
        this.supportTaperFactor = 0.25;
        this.supportSubdivs = 16;

        this.supportRadiusFnMap = {
            constant: SupportGenerator.RadiusFunctions.constant,
            sqrt: SupportGenerator.RadiusFunctions.sqrt
        };
        this.supportRadiusFnName = "sqrt";
        this.supportRadiusFnK = 0.01;
        this.sliceMode = Slicer.Modes.preview;
        this.sliceModeOn = false;
        this.slicePreviewModeSliceMesh = true;
        this.sliceFullModeUpToLayer = true;
        this.sliceFullModeShowInfill = false;
        this.sliceNumWalls = 2;
        this.sliceNumTopLayers = 10;
        this.sliceOptimizeTopLayers = true;
        this.sliceInfillType = Slicer.InfillTypes.solid;
        this.sliceInfillDensity = 0.1;
        this.sliceInfillOverlap = 0.5;
        this.sliceMakeRaft = true;
        this.sliceRaftNumTopLayers = 3;
        this.sliceRaftTopLayerHeight = 0.1;
        this.sliceRaftTopLineWidth = 0.1;
        this.sliceRaftTopDensity = 1.0;
        this.sliceRaftNumBaseLayers = 1;
        this.sliceRaftBaseLayerHeight = 0.2;
        this.sliceRaftBaseLineWidth = 0.2;
        this.sliceRaftBaseDensity = 0.5;
        this.sliceRaftOffset = 1.0;
        this.sliceRaftGap = 0.05;
        this.sliceRaftWriteWalls = false;
        this.gcodeFilename = this.filename;
        this.gcodeExtension = "gcode";
        this.gcodeTemperature = 200;
        this.gcodeFilamentDiameter = 2.5;
        this.gcodePrimeExtrusion = 3;
        this.gcodeExtrusionMultiplier = 1.0;
        this.gcodeInfillSpeed = 70;
        this.gcodeWallSpeed = 30;
        this.gcodeRaftBasePrintSpeed = 25;
        this.gcodeRaftTopPrintSpeed = 30;
        this.gcodeTravelSpeed = 150;
        this.gcodeCoordinatePrecision = 3;
        this.gcodeExtruderPrecision = 5;
        // gizmo creation:
        this.gizmoVisible = false;

        const _this = this;

        // handle the state of the transformation snap checkbox
        //this.handleSnapTransformationToFloorState();

        this.setBaseOn = false;
        // position vector
        this.position = new THREE.Vector3();
        // radian rotation (for internal use) and equivalent degree rotation (for display)
        this.rotation = new THREE.Euler();
        this.rotationDeg = new THREE.Euler();
        // vector of scale factors
        this.scale = new THREE.Vector3();
        // computed size of the model
        this.size = new THREE.Vector3();

        this.updatePosition();
        this.updateRotation();
        this.updateScale();
        this.updateSize();
    }

    createModel(geometry, filename, meshy) {
        // scale geometry to match internal units (assumes THREE.Geometry)
        if (meshy.units !== meshy.importUnits) {
            const vertices = geometry.vertices;
            const convert = Units.getConverterV3(meshy.importUnits, meshy.units);

            for (let v = 0; v < vertices.length; v++) {
                vertices[v].copy(convert(vertices[v]));
            }
        }

        meshy.model = new Model(
            geometry,
            meshy.scene,
            meshy.camera,
            meshy.container,
            meshy.printout,
            meshy.infoBox,
        );

        meshy.printout.log(`Imported file ${meshy.importingMeshName}`);

        meshy.importEnabled = true;
        meshy.fileInput.value = "";
        meshy.importingMeshName = "";

        meshy.filename = filename;
        meshy.gcodeFilename = filename;
        meshy.gcodeFilenameController.updateDisplay();

        if (meshy.autocenterOnImport) meshy.autoCenter(false);
        else if (meshy.snapTransformationsToFloor) meshy.floor(false);

        meshy.cameraToModel();

        meshy.setMeshMaterial();
        meshy.setWireframeMaterial();
        meshy.createInfoBox();
        meshy.createGizmo();

        meshy.gizmoVisible = true;
        meshy.handleGizmoVisibility();
    };

    // anything that needs to be refreshed by hand (not in every frame)
    updateUI() {
        this.filenameController.updateDisplay();
    }

    // used for internal optimization while building a list of unique vertices
    setVertexPrecision() {
        if (this.model) this.model.setVertexPrecision(this.vertexPrecision);
    }

    setDisplayPrecision(callback) {
        if (this.infoBox) {
            this.infoBox.decimals = this.displayPrecision;
            this.infoBox.update();
        }
        if(callback)
            callback();
    }

    // Functions corresponding to buttons in the dat.gui.
    exportOBJ() { this.export("obj"); }

    exportSTL() { this.export("stl"); }
    exportSTLascii() { this.export("stlascii"); }

    undo() {
        // if slice mode is on, do nothing
        if (this.sliceModeOn) return;

        this.gizmo.transformFinish();

        try {
            this.editStack.undo();
        }
        catch (e) {
            this.printout.warn(e);
        }

        this.infoBox.update();
    }

    redo() {
        // if slice mode is on, do nothing
        if (this.sliceModeOn) return;

        this.gizmo.transformFinish();

        try {
            this.editStack.redo();
        }
        catch (e) {
            this.printout.warn(e);
        }

        this.infoBox.update();
    }

    // functions for handling model transformations

    makeTranslateTransform(invertible) {
        const transform = new Transform("translate", this.model.getPosition());
        const _this = this;

        transform.preprocess = pos => {
            pos = pos.clone();
            // if snapping to floor, floor the model
            if (_this.snapTransformationsToFloor) {
                pos.z = _this.model.getPosition().z - _this.model.getMin().z;
            }
            return pos;
        };
        transform.onApply = pos => {
            // if any measurements active, translate markers
            const delta = pos.clone().sub(_this.model.getPosition());
            _this.forEachMeasurement(({measurement}) => {
                measurement.translate(delta);
            });

            _this.model.translate(pos);
        };
        transform.onEnd = () => { _this.model.translateEnd(); };
        transform.invertible = invertible;

        return transform;
    }

    makeRotateTransform(invertible) {
        const transform = new Transform("rotate", this.model.getRotation());
        const _this = this;

        transform.onApply = euler => {
            // disallow having measurements while rotating
            _this.removeAllMeasurements();

            _this.model.rotate(euler);
        };
        transform.onEnd = () => {
            _this.model.rotateEnd();
            if (_this.snapTransformationsToFloor) _this.floorZ(false);
        };
        transform.invertible = invertible;

        return transform;
    }

    makeScaleTransform(invertible) {
        const transform = new Transform("scale", this.model.getScale());
        const _this = this;

        transform.onApply = scale => {
            scale = scale.clone();
            // never scale to 0
            if (scale.x <= 0) scale.x = 1;
            if (scale.y <= 0) scale.y = 1;
            if (scale.z <= 0) scale.z = 1;

            // scale measurement markers with respect to mesh center
            const vfactor = scale.clone().divide(_this.model.getScale());
            _this.forEachMeasurement(({measurement}, idx) => {
                measurement.scaleFromPoint(vfactor, _this.position);
            });

            _this.onChangeMeasurementToScale();


            _this.model.scale(scale);
        };
        transform.onEnd = () => {
            _this.model.scaleEnd();
            if (_this.snapTransformationsToFloor) _this.floorZ(false);
        };
        transform.invertible = invertible;

        return transform;
    }

    makeMirrorTransform(invertible) {
        const transform = new Transform("mirror");
        const _this = this;

        transform.onApply = axis => { _this.model.mirror(axis); };
        transform.invertible = invertible;

        return transform;
    }

    makeFlipNormalsTransform(invertible) {
        const transform = new Transform("flipNormals");
        const _this = this;

        transform.onApply = () => { _this.model.flipNormals(); };
        transform.invertible = invertible;

        return transform;
    }

    pushEdit(transform, onTransform) {
        if (transform && transform.invertible && !transform.noop()) {
            this.editStack.push(transform, onTransform);
        }
    }

    // called when a translation is in progress
    onTranslate() {
        if (!this.currentTransform) this.currentTransform = this.makeTranslateTransform();

        this.currentTransform.apply(this.position);
        this.infoBox.update();
    }

    // called on translation end
    onFinishTranslate() {
        if (this.currentTransform) this.currentTransform.end();

        this.pushEdit(this.currentTransform, this.updatePosition.bind(this));

        this.currentTransform = null;
        this.updatePosition();
        this.infoBox.update();
    }

    onChangeRotationDegrees() {
        // translate rotation in degrees to rotation in radians
        this.rotation.copy(Utils.eulerRadNormalize(eulerDegToRad(this.rotationDeg)));

        this.onRotate();
    }

    // called when a rotation is in progress
    onRotate() {
        if (!this.currentTransform) this.currentTransform = this.makeRotateTransform();

        this.currentTransform.apply(this.rotation.clone());
    }

    // called on rotation end
    onFinishRotate() {
        if (this.currentTransform) this.currentTransform.end();

        this.pushEdit(this.currentTransform, this.updateRotation.bind(this));

        this.currentTransform = null;
        this.updateRotation();
        this.updatePosition();
        this.updateSize();
        this.infoBox.update();
    }

    // called when scale change is in progress
    onScaleByFactor() {
        if (!this.currentTransform) this.currentTransform = this.makeScaleTransform();

        this.currentTransform.apply(this.scale);
    }

    // called when scaling to size is in progress
    onScaleToSize() {
        // current size - changed dynamically via gui
        const size = this.size;
        // initial model size - only changes at the end of the transform
        const modelSize = this.model.getSize();

        // axis that's being scaled
        const axis = size.x !== modelSize.x ? "x" : size.y !== modelSize.y ? "y" : "z";
        // factor by which to scale - note zero-size failsafe
        const factor = size[axis] !== 0 ? size[axis] / modelSize[axis] : 1;

        // initial scale of model corresponding to the initial size
        const startScale = this.currentTransform ? this.currentTransform.startVal : this.scale;

        // set scale to a value that will result in the new size
        this.scale.copy(startScale.clone().multiplyScalar(factor));

        this.onScaleByFactor();
    }

    onScaleToMeasurement() {
        const result = this.getCurrentMeasurementResult();

        if (!result || !result.ready) return;

        const key = this.measurementToScale;
        const currentValue = result[key];

        if (currentValue !== undefined) {
            let factor = this.measurementToScaleValue / currentValue;
            if (key === "area") factor = Math.sqrt(factor);

            // initial scale of the model
            const startScale = this.currentTransform ? this.currentTransform.startVal : this.scale;

            // set scale
            this.scale.multiplyScalar(factor);

            this.onScaleByFactor();
        }
    }

    // called on scale change end
    onFinishScale() {
        if (this.currentTransform) this.currentTransform.end();

        this.pushEdit(this.currentTransform, this.updateScale.bind(this));

        this.currentTransform = null;
        this.updatePosition();
        this.updateScale();
        this.infoBox.update();
    }

    // instantaneous scaling by factor
    scaleByFactor(factor, invertible) {
        if (!this.model) return;

        if (factor <= 0) factor = 1;

        const transform = this.makeScaleTransform(invertible);

        this.scale.multiplyScalar(factor);
        transform.apply(this.scale.clone());
        transform.end();

        this.pushEdit(transform, this.updateScale.bind(this));
        this.updatePosition();
        this.updateScale();
        this.infoBox.update();
    }

    // instantaneous transformations - mirror, floor, center, autocenter

    mirrorX(invertible) { this.mirror("x", invertible); }

    mirrorY(invertible) { this.mirror("y", invertible); }
    mirrorZ(invertible) { this.mirror("z", invertible); }

    mirror(axis, invertible) {
        if (!this.model) return;

        const transform = this.makeMirrorTransform(invertible);
        transform.apply(axis);

        this.pushEdit(transform);
    }

    floorX(invertible) { this.floor("x", invertible); }
    floorY(invertible) { this.floor("y", invertible); }
    floorZ(invertible) { this.floor("z", invertible); }

    floor(axis, invertible) {
        if (!this.model) return;

        if (axis === undefined) axis = "z";

        // need to know bounds to floor to them
        this.calculateBuildVolumeBounds();

        const transform = this.makeTranslateTransform(invertible);

        this.position[axis] =
            this.buildVolumeMin[axis] + this.model.getPosition()[axis] - this.model.getMin()[axis];
        transform.apply(this.position.clone());
        transform.end();

        this.pushEdit(transform, this.updatePosition.bind(this));
        this.updatePosition();
    }

    centerX(invertible) { this.center("x", invertible); }
    centerY(invertible) { this.center("y", invertible); }
    centerAll(invertible) { this.center("all", invertible); }

    center(axis, invertible) {
        if (!this.model) return;

        if (axis === undefined) axis = "all";

        const center = this.calculateBuildPlateCenter();

        if (axis === "x" || axis === "all") this.position.x = center.x;
        if (axis === "y" || axis === "all") this.position.y = center.y;

        const transform = this.makeTranslateTransform(invertible);

        transform.apply(this.position.clone());
        transform.end();

        this.pushEdit(transform, this.updatePosition.bind(this));
        this.updatePosition();
    }

    autoCenter(invertible) {
        this.position.copy(this.calculateBuildPlateCenter());
        this.position.z += this.model.getSize().z / 2;

        const transform = this.makeTranslateTransform(invertible);

        transform.apply(this.position.clone());
        transform.end();

        this.pushEdit(transform, this.updatePosition.bind(this));
        this.updatePosition();
    }

    toggleSetBase() {
        if (!this.pointer) return;

        // if currently setting the base, cancel
        if (this.setBaseOn) this.endSetBase();
        // else, start
        else this.startSetBase();
    }

    startSetBase() {
        if (this.setBaseOn) return;

        this.setBaseOn = true;

        if (this.setBaseController) this.setBaseController.name("Cancel (ESC)");

        this.forEachMeasurement(({measurement}, idx) => {
            measurement.deactivate();
        });

        this.pointer.deactivate();
        this.pointer.addCallback("set base", this.faceOrientDown.bind(this));
        this.pointer.setCursorPointer();
        this.pointer.activate();
    }

    endSetBase() {
        if (!this.setBaseOn) return;

        this.setBaseOn = false;

        if (this.setBaseController) this.setBaseController.name("Set base");
        if (this.pointer) {
            this.pointer.removeCallback("set base");
            this.pointer.deactivate();
        }

        // a measurement may have been active - treat this as setting it active again
        this.onSetCurrentMeasurement();
    }

    faceOrientDown(intersection) {
        if (!intersection) return;

        const point = intersection.point;
        const face = intersection.face;
        const mesh = intersection.object;

        // get the normal in world space
        const normal = face.normal.clone().transformDirection(mesh.matrixWorld);

        const down = new THREE.Vector3(0, 0, -1);

        const axis = new THREE.Vector3();
        let angle = 0;

        // if already pointing down, do nothing
        if (normal.equals(down)) {
            return;
        }
        // if pointing up, arbitrarily set rotation axis to x
        else if (normal.dot(down) === -1) {
            axis.set(1, 0, 0);
            angle = Math.PI;
        }
        // else, get the axis via cross-product
        else {
            axis.crossVectors(normal, down).normalize();
            angle = Utils.acos(normal.dot(down));
        }

        // make the transform and apply it (this operation is always invertible)
        const transform = this.makeRotateTransform();

        // rotate
        const q = new THREE.Quaternion().setFromEuler(this.rotation);
        const dq = new THREE.Quaternion().setFromAxisAngle(axis, angle);
        this.rotation.setFromQuaternion(q.premultiply(dq));

        transform.apply(this.rotation.clone());
        transform.end();

        this.pushEdit(transform, this.updateRotation.bind(this));
        this.updateRotation();
        this.updatePosition();
        this.updateSize();
        this.infoBox.update();

        this.endSetBase();
    }

    flipNormals() {
        if (!this.model) return;

        const transform = this.makeFlipNormalsTransform();

        transform.apply();

        this.pushEdit(transform);
    }

    // invoked when toggling the checkbox for snapping transformations to floor
    handleSnapTransformationToFloorState() {
        const snap = this.snapTransformationsToFloor;

        // floor, but don't register the action as undoable
        if (snap) this.floorZ(false);

        // if (snap) this.disableController(this.positionZController);
        // else this.enableController(this.positionZController);

        // if (snap) this.gizmo.disableHandle(Gizmo.HandleTypes.translate, "z");
        // else this.gizmo.enableHandle(Gizmo.HandleTypes.translate, "z");
    }

    // position/rotation/scale GUI-updating functions
    updatePosition() {
        if (!this.model) return;

        this.position.copy(this.model.getPosition());

        if (this.positionXController) this.positionXController.updateDisplay();
        if (this.positionYController) this.positionYController.updateDisplay();
        if (this.positionZController) this.positionZController.updateDisplay();
    }

    updateRotation() {
        if (!this.model) return;

        this.rotation.copy(Utils.eulerRadNormalize(this.model.getRotation()));
        this.rotationDeg.copy(Utils.eulerRadToDeg(this.rotation));

        if (this.rotationXController) this.rotationXController.updateDisplay();
        if (this.rotationYController) this.rotationYController.updateDisplay();
        if (this.rotationZController) this.rotationZController.updateDisplay();
    }

    updateScale() {
        if (!this.model) return;

        this.scale.copy(this.model.getScale());

        if (this.scaleXController) this.scaleXController.updateDisplay();
        if (this.scaleYController) this.scaleYController.updateDisplay();
        if (this.scaleZController) this.scaleZController.updateDisplay();

        this.updateSize();
    }

    updateSize() {
        if (!this.model) return;

        this.size.copy(this.model.getSize());

        if (this.scaleToSizeXController) this.scaleToSizeXController.updateDisplay();
        if (this.scaleToSizeYController) this.scaleToSizeYController.updateDisplay();
        if (this.scaleToSizeZController) this.scaleToSizeZController.updateDisplay();
    }

    //buildEditFolder() {

    scaleToRingSize() {
        const measurement = this.getCurrentMeasurement();
        const result = this.getCurrentMeasurementResult();

        // must have an active circle measurement
        if (!measurement || !measurement.active || measurement.getType() !== Measurement.Types.circle
            // must have a measurement result and a diameter field in that result
            || !result || result.diameter === undefined)
        {
            this.printout.warn("Scaling to ring size requires an active, valid circle measurement.");
            return;
        }

        if (!this.ringSize) {
            this.printout.warn("Select a ring size.");
            return;
        }

        const tmpVal = this.measurementToScaleValue;
        const tmpType = this.measurementToScale;

        this.measurementToScale = "diameter";
        this.measurementToScaleValue = this.ringSize;

        this.onScaleToMeasurement();
        this.onFinishScale();

        this.measurementToScale = tmpType;
        this.measurementToScaleValue = tmpVal;

        // update the scale to measurement folder b/c the values changed
        this.onChangeMeasurementToScale();
    }

    onSetCurrentMeasurement() {
        this.pointer.setCursorCircle();

        const currentIdx = this.measurementIdx;

        if (currentIdx < 0) return;

        // deactivate every other measurement
        this.forEachMeasurement(({measurement}, idx) => {
            measurement.deactivate();
        });

        // activate the current measurement
        this.getMeasurementItem(currentIdx).measurement.activate();

        // current measurement changed, so rebuild the scale to measurement folder
        //this.buildScaleToMeasurementFolder();
    }

    onToggleConvexHull() {
        const convexHull = this.measureConvexHull;

        this.forEachMeasurement((item, idx) => {
            const measurement = item.measurement;

            measurement.setParams({ convexHull });

            // recalculate the measurement, but do it only if there's a valid current
            // result, else there's no point
            if (measurement.result && measurement.result.ready) {
                measurement.calculate();
            }
        });
    }

    getMeasurementItem(idx) {
        return this.measurementData[idx];
    }

    getCurrentMeasurement() {
        const item = this.getMeasurementItem(this.measurementIdx);

        return item ? item.measurement : null;
    }

    getCurrentMeasurementResult() {
        if (this.measurementIdx >= 0) return this.measurementData[this.measurementIdx].result;
        else return null;
    }

    setCurrentMeasurementResult(result) {
        const item = this.getMeasurementItem(this.measurementIdx);

        if (item) item.result = result;
    }

    // todo: remove
    measurementCalculate() {
        this.getCurrentMeasurement().calculate();
    }

    removeCurrentMeasurement() {
        const item = this.getMeasurementItem(this.measurementIdx);
        if (!item) return;

        // destroy measurement
        item.measurement.dispose();

        // remove entry from infobox
        this.infoBox.removeList(item.list);

        const measurementCount = this.measurementData.length;

        // remove measurement data item
        this.measurementData.splice(this.measurementIdx, 1);

        // if removing the last measurement, shift current measurement down
        if (this.measurementIdx >= measurementCount - 1) this.measurementIdx--;

        this.onSetCurrentMeasurement();

        //this.buildMeasurementFolder();

        if (!this.measurementsExist()) this.onRemoveLastMeasurement();
    }

    removeAllMeasurements() {
        for (let i = 0, l = this.measurementData.length; i < l; i++) {
            const item = this.getMeasurementItem(i);

            // destroy measurement
            item.measurement.dispose();

            // remove entry from infobox
            this.infoBox.removeList(item.list);
        }

        this.measurementData.length = 0;
        this.measurementIdx = -1;

        //this.buildMeasurementFolder();

        this.onRemoveLastMeasurement();
    }

    measureLength() {
        this.addMeasurement({ type: Measurement.Types.length });
    }

    measureAngle() {
        this.addMeasurement({ type: Measurement.Types.angle });
    }

    measureCircle() {
        this.addMeasurement({ type: Measurement.Types.circle });
    }

    measureCrossSectionX() {
        this.addMeasurement({
            type: Measurement.Types.crossSection,
            axis: "x",
            convexHull: this.measureConvexHull
        });
    }

    measureCrossSectionY() {
        this.addMeasurement({
            type: Measurement.Types.crossSection,
            axis: "y",
            convexHull: this.measureConvexHull
        });
    }

    measureCrossSectionZ() {
        this.addMeasurement({
            type: Measurement.Types.crossSection,
            axis: "z",
            convexHull: this.measureConvexHull
        });
    }

    measureLocalCrossSection() {
        this.addMeasurement({
            type: Measurement.Types.orientedCrossSection,
            nearestContour: true,
            convexHull: this.measureConvexHull,
            // todo: remove
            calculateManually: this.calculateManually,
            showPreviewMarker: this.showPreviewMarker,
            previewMarkerRadiusOffset: this.previewMarkerRadiusOffset
        });
    }

    addMeasurement(params) {
        // slice mode keeps its own copy of the mesh, so don't allow measuring
        if (this.sliceModeOn) {
            this.printout.warn("Cannot measure mesh while slice mode is on.");
            return;
        }

        if (!this.model) return;

        // if setting base, stop doing that
        this.endSetBase();

        // disable rotation and axis scaling handles on the gizmo
        if (this.gizmo) {
            this.gizmo.disableHandle(Gizmo.HandleTypes.rotate, "x");
            this.gizmo.disableHandle(Gizmo.HandleTypes.rotate, "y");
            this.gizmo.disableHandle(Gizmo.HandleTypes.rotate, "z");
            this.gizmo.disableHandle(Gizmo.HandleTypes.rotate, "o");

            this.gizmo.disableHandle(Gizmo.HandleTypes.scale, "x");
            this.gizmo.disableHandle(Gizmo.HandleTypes.scale, "y");
            this.gizmo.disableHandle(Gizmo.HandleTypes.scale, "z");
        }

        // have a set color for the first measurement, random colors for anything after that
        params.color = !this.measurementsExist() ? 0x8adeff : Math.round((Math.random() / 2.0 + 0.5) * 0xffffff);

        // construct the structure containing the measurement, its infobox list, and the result
        const item = {
            measurement: new Measurement(this.pointer, this.scene),
            list: null,
            result: null
        };

        this.measurementIdx = this.measurementData.length;
        this.measurementData.push(item);

        const type = params.type;

        if (type === Measurement.Types.length) {
            item.list = this.infoBox.addList(item.measurement.uuid, "Length", params.color);
            item.list.add("Length", item, ["result", "length"]);
        }
        else if (type === Measurement.Types.angle) {
            item.list = this.infoBox.addList(item.measurement.uuid, "Angle", params.color);
            item.list.add("Angle", item, ["result", "angleDegrees"]);
        }
        else if (type === Measurement.Types.circle) {
            item.list = this.infoBox.addList(item.measurement.uuid, "Circle", params.color);
            item.list.add("Radius", item, ["result", "radius"]);
            item.list.add("Diameter", item, ["result", "diameter"]);
            item.list.add("Circumference", item, ["result", "circumference"]);
            item.list.add("Area", item, ["result", "area"]);
        }
        else if (type === Measurement.Types.crossSection) {
            item.list = this.infoBox.addList(item.measurement.uuid, `Cross-section ${params.axis}`, params.color);
            item.list.add("Area", item, ["result", "area"]);
            item.list.add("Min", item, ["result", "boundingBox", "min"]);
            item.list.add("Max", item, ["result", "boundingBox", "max"]);
            item.list.add("Contour length", item, ["result", "length"]);
        }
        else if (type === Measurement.Types.orientedCrossSection) {
            item.list = this.infoBox.addList(item.measurement.uuid, "Local cross-section", params.color);
            item.list.add("Area", item, ["result", "area"]);
            item.list.add("Min", item, ["result", "boundingBox", "min"]);
            item.list.add("Max", item, ["result", "boundingBox", "max"]);
            item.list.add("Contour length", item, ["result", "length"]);
        }
        else return;

        // construct the onResultChange function

        const _this = this;
        item.measurement.onResultChange = function(result) {
            // need to update the folder if no result or result ready status changed
            // const folderNeedsUpdate =
            //     item.result === null || item.result.ready !== result.ready;

            // update internal result
            item.result = result;

            // if necessary, rebuild the folder
            // if (folderNeedsUpdate) {
            //     _this.buildScaleToMeasurementFolder();
            // }

            // update measurement-to-scale field
            if (!this.currentTransform) _this.onChangeMeasurementToScale();

            // update infobox list
            item.list.update();
        };

        item.measurement.start(params);

        //this.buildMeasurementFolder();
        //this.buildScaleToMeasurementFolder();
        this.onSetCurrentMeasurement();
    }

    forEachMeasurement(fn) {
        for (let m = 0; m < this.measurementData.length; m++) {
            fn(this.measurementData[m], m);
        }
    }

    measurementsExist() {
        return this.measurementData.length > 0;
    }

    //buildScaleToMeasurementFolder() {

    onChangeMeasurementToScale() {
        const result = this.getCurrentMeasurementResult();
        if (!result || !result.ready) return;

        // the new value defaults to the current value
        this.measurementToScaleValue = result[this.measurementToScale];

        // update controller
        const controller = this.measurementToScaleValueController;

        if (controller) controller.updateDisplay();
    }

    onRemoveLastMeasurement() {
        if (this.measurementsExist()) return;

        // clear scale to measurement folder
        if (this.scaleToMeasurementFolder) {
            //this.clearFolder(this.scaleToMeasurementFolder);
            this.measurementToScale = "";
            this.measurementToScaleValueController = null;
        }

        // reenable rotation and axis scaling handles on the gizmo
        if (this.gizmo) {
            this.gizmo.enableHandle(Gizmo.HandleTypes.rotate, "x");
            this.gizmo.enableHandle(Gizmo.HandleTypes.rotate, "y");
            this.gizmo.enableHandle(Gizmo.HandleTypes.rotate, "z");
            this.gizmo.enableHandle(Gizmo.HandleTypes.rotate, "o");

            this.gizmo.enableHandle(Gizmo.HandleTypes.scale, "x");
            this.gizmo.enableHandle(Gizmo.HandleTypes.scale, "y");
            this.gizmo.enableHandle(Gizmo.HandleTypes.scale, "z");
        }
    }

    viewThickness() {
        if (this.model) this.model.viewThickness(this.thicknessThreshold);
    }

    clearThicknessView() {
        if (this.model) this.model.clearThicknessView();
    }

    repair() {
        this.endSliceMode();
        if (this.model) this.model.repair();

        this.infoBox.update();
    }

    generateSupports() {
        if (this.model) {
            if (this.supportRadius < this.lineWidth) {
                this.printout.warn("Support radius is lower than the planar resolution.");
            }
            else if (this.supportRadius * this.supportTaperFactor < this.lineWidth) {
                this.printout.warn("Support taper radius is lower than the planar resolution. This may result in missing support slices.");
            }

            this.model.generateSupports({
                angle: this.supportAngle,
                resolution: this.lineWidth * this.supportSpacingFactor,
                layerHeight: this.layerHeight,
                radius: this.supportRadius,
                taperFactor: this.supportTaperFactor,
                subdivs: this.supportSubdivs,
                radiusFn: this.supportRadiusFnMap[this.supportRadiusFnName],
                radiusFnK: this.supportRadiusFnK,
                axis: this.sliceAxis
            });
        }
    }

    removeSupports() {
        if (this.model) this.model.removeSupports();
    }

    setSliceMode() {
        if (this.model) {
            this.model.setSliceMode(this.sliceMode);
            this.buildSliceDisplayFolder(this.sliceDisplayFolder);
        }
    }

    updateSlicerDisplayParams() {
        if (this.model) {
            this.model.updateSlicerParams({
                previewSliceMesh: this.slicePreviewModeSliceMesh,
                fullUpToLayer: this.sliceFullModeUpToLayer,
                fullShowInfill: this.sliceFullModeShowInfill
            });
            this.setSliceLevel();
        }
    }

    updateSlicerParams() {
        if (this.model) {
            this.model.updateSlicerParams(this.makeSlicerParams());
            if (this.sliceLevelController) {
                this.sliceLevelController.min(this.model.getMinSliceLevel());
                this.sliceLevelController.max(this.model.getMaxSliceLevel());
            }
        }
        this.setSliceLevel();
    }

    startSliceMode() {
        this.removeAllMeasurements();

        if (this.model) {
            this.sliceModeOn = true;
            this.model.startSliceMode(this.makeSlicerParams());
            this.buildSliceFolder(this.supportSliceFolder);
        }
        this.handleGizmoVisibility();
    }

    makeSlicerParams() {
        return {
            mode: this.sliceMode,
            axis: this.sliceAxis,
            layerHeight: this.layerHeight,
            lineWidth: this.lineWidth,
            numWalls: this.sliceNumWalls,
            numTopLayers: this.sliceNumTopLayers,
            optimizeTopLayers: this.sliceOptimizeTopLayers,
            infillType: parseInt(this.sliceInfillType),
            infillDensity: this.sliceInfillDensity,
            infillOverlap: this.sliceInfillOverlap,
            makeRaft: this.sliceMakeRaft,
            raftNumTopLayers: this.sliceRaftNumTopLayers,
            raftTopLayerHeight: this.sliceRaftTopLayerHeight,
            raftTopLineWidth: this.sliceRaftTopLineWidth,
            raftTopDensity: this.sliceRaftTopDensity,
            raftNumBaseLayers: this.sliceRaftNumBaseLayers,
            raftBaseLayerHeight: this.sliceRaftBaseLayerHeight,
            raftBaseLineWidth: this.sliceRaftBaseLineWidth,
            raftBaseDensity: this.sliceRaftBaseDensity,
            raftOffset: this.sliceRaftOffset,
            raftGap: this.sliceRaftGap,
            raftWriteWalls: this.sliceRaftWriteWalls,
            precision: this.vertexPrecision,
            // display params
            previewSliceMesh: this.slicePreviewModeSliceMesh,
            fullUpToLayer: this.sliceFullModeUpToLayer,
            fullShowInfill: this.sliceFullModeShowInfill
        };
    }

    makeGcodeParams() {
        return {
            filename: this.gcodeFilename,
            extension: this.gcodeExtension,
            temperature: this.gcodeTemperature,
            filamentDiameter: this.gcodeFilamentDiameter,
            primeExtrusion: this.gcodePrimeExtrusion,
            extrusionMultiplier: this.gcodeExtrusionMultiplier,
            infillSpeed: this.gcodeInfillSpeed,
            wallSpeed: this.gcodeWallSpeed,
            raftBasePrintSpeed: this.gcodeRaftBasePrintSpeed,
            raftTopPrintSpeed: this.gcodeRaftTopPrintSpeed,
            travelSpeed: this.gcodeTravelSpeed,
            coordPrecision: this.gcodeCoordinatePrecision,
            extruderPrecision: this.gcodeExtruderPrecision
        };
    }

    endSliceMode() {
        this.sliceModeOn = false;
        this.sliceLevelController = null;
        //this.buildSupportSliceFolder();
        if (this.model) {
            this.model.endSliceMode();
        }
        this.handleGizmoVisibility();
    }

    setSliceLevel() {
        if (this.model) {
            this.model.setSliceLevel(this.currentSliceLevel);
        }
    }

    gcodeSave() {
        if (this.model) {
            this.model.gcodeSave(this.makeGcodeParams());
        }
    }

    toggleBuildVolume() {
        this.buildVolumeVisible = !this.buildVolumeVisible;
        this.setBuildVolumeState();
    }

    setBuildVolumeState() {
        const visible = this.buildVolumeVisible;
        this.scene.traverse(o => {
            if (o.name==="buildVolume") o.visible = visible;
        });
    }

    toggleGizmo() {
        if (!this.gizmo) return;

        this.gizmoVisible = !!this.model && !this.gizmoVisible;

        this.handleGizmoVisibility();
    }

    handleGizmoVisibility() {
        this.gizmo.visible = this.sliceModeOn ? false : this.gizmoVisible;
    }

    toggleCOM() {
        if (this.model) {
            this.model.toggleCenterOfMass();
        }
    }

    toggleWireframe() {
        if (this.model) this.model.toggleWireframe();
    }

    toggleAxisWidget() {
        this.axisWidget.toggleVisibility();
    }

    setBackgroundColor() {
        if (this.scene) this.scene.background.set(this.backgroundColor);
    }

    setMeshMaterial() {
        if (this.model) this.model.setMeshMaterialParams({
            color: this.meshColor,
            roughness: this.meshRoughness,
            metalness: this.meshMetalness
        });
    }

    setWireframeMaterial() {
        if (this.model) this.model.setWireframeMaterialParams({
            color: this.wireframeColor
        });
    }

    calculateBuildVolumeBounds() {
        const size = this.buildVolumeSize;
        let x0;
        let x1;
        let y0;
        let y1;
        const z0 = 0;
        const z1 = size.z;

        if (this.centerOriginOnBuildPlate) {
            x0 = -size.x / 2;
            x1 = size.x / 2;
            y0 = -size.y / 2;
            y1 = size.y / 2;
        }
        else {
            x0 = 0;
            x1 = size.x;
            y0 = 0;
            y1 = size.y;
        }

        this.buildVolumeMin = new THREE.Vector3(x0, y0, z0);
        this.buildVolumeMax = new THREE.Vector3(x1, y1, z1);
    }

    calculateBuildVolumeCenter() {
        if (!this.buildVolumeMin || !this.buildVolumeMax) this.calculateBuildVolumeBounds();

        return this.buildVolumeMin.clone().add(this.buildVolumeMax).divideScalar(2);
    }

    calculateBuildPlateCenter() {
        return this.calculateBuildVolumeCenter().setZ(0);
    }

    defaultCameraCenter() {
        return this.calculateBuildVolumeCenter().setZ(this.buildVolumeSize.z/8);
    }

    // Create the build volume.
    makeBuildVolume() {
        Utils.removeMeshByName(this.scene, "buildVolume");
        Utils.removeMeshByName(this.scene, "buildVolumePlane");

        this.calculateBuildVolumeBounds();
        const min = this.buildVolumeMin;
        const max = this.buildVolumeMax;
        const x0 = min.x;
        const x1 = max.x;
        const y0 = min.y;
        const y1 = max.y;
        const z0 = min.z;
        const z1 = max.z;

        // Primary: center line through origin
        // Secondary: lines along multiples of 5
        // Tertiary: everything else
        const geoPrimary = new THREE.Geometry();
        const geoSecondary = new THREE.Geometry();
        const geoTertiary = new THREE.Geometry();
        const geoFloor = new THREE.Geometry();
        const matPrimary = this.buildVolumeMaterials.linePrimary;
        const matSecondary = this.buildVolumeMaterials.lineSecondary;
        const matTertiary = this.buildVolumeMaterials.lineTertiary;
        const matFloor = this.buildVolumeMaterials.floorPlane;

        // draw grid
        for (let i = Math.floor(x0 + 1); i < x1; i++) {
            let geo = i === 0 ? geoPrimary : i%5 === 0 ? geoSecondary : geoTertiary;
            pushSegment(geo, i, y0, z0, i, y1, z0);
        }
        for (let i = Math.floor(y0 + 1); i < y1; i++) {
            let geo = i === 0 ? geoPrimary : i%5 === 0 ? geoSecondary : geoTertiary;
            pushSegment(geo, x0, i, z0, x1, i, z0);
        }

        // draw a box around the build volume
        pushSegment(geoPrimary, x0, y0, z0, x0, y1, z0);
        pushSegment(geoPrimary, x0, y0, z0, x1, y0, z0);
        pushSegment(geoPrimary, x0, y1, z0, x1, y1, z0);
        pushSegment(geoPrimary, x1, y0, z0, x1, y1, z0);

        // vertical box uses a less conspicuous material
        pushSegment(geoTertiary, x0, y0, z1, x0, y1, z1);
        pushSegment(geoTertiary, x0, y0, z1, x1, y0, z1);
        pushSegment(geoTertiary, x0, y1, z1, x1, y1, z1);
        pushSegment(geoTertiary, x1, y0, z1, x1, y1, z1);
        pushSegment(geoTertiary, x0, y0, z0, x0, y0, z1);
        pushSegment(geoTertiary, x0, y1, z0, x0, y1, z1);
        pushSegment(geoTertiary, x1, y0, z0, x1, y0, z1);
        pushSegment(geoTertiary, x1, y1, z0, x1, y1, z1);

        const linePrimary = new THREE.LineSegments(geoPrimary, matPrimary);
        const lineSecondary = new THREE.LineSegments(geoSecondary, matSecondary);
        const lineTertiary = new THREE.LineSegments(geoTertiary, matTertiary);
        linePrimary.name = "buildVolume";
        lineSecondary.name = "buildVolume";
        lineTertiary.name = "buildVolume";
        this.scene.add(linePrimary);
        this.scene.add(lineSecondary);
        this.scene.add(lineTertiary);

        this.setBuildVolumeState();

        function pushSegment({vertices}, x0, y0, z0, x1, y1, z1) {
            const vs = vertices;
            vs.push(new THREE.Vector3(x0, y0, z0));
            vs.push(new THREE.Vector3(x1, y1, z1));
        }
    }

    // Interface for the dat.gui button.
    import() {
        if (this.model) {
            this.printout.warn("A model is already loaded; delete the current model to import a new one.");
            return;
        }

        if (!this.importEnabled) {
            this.printout.warn(`Already importing mesh ${this.importingMeshName}`);
            return;
        }

        if (this.fileInput) {
            this.fileInput.click();
        }
    }

    handleFile(file, callback) {
        this.importingMeshName = file.name;
        this.importEnabled = false;
        let onLoad = this.createModel;
        const loader = new FileLoader();
        try {
            loader.load(file, this, function (geo, fileName, meshy) {
                onLoad(geo, fileName, meshy);
                    if (callback) {
                        callback();
                    }
                }
            )
        }
        catch (e) {
            this.printout.error(e);

            this.importEnabled = true;
            this.fileInput.value = "";
            this.importingMeshName = "";
        }
    }

    // Interface for the dat.gui button. Saves the model.
    export(format) {
        if (!this.model) {
            this.printout.warn("No model to export.");
            return;
        }

        const factor = Units.getFactor(this.units, this.exportUnits);
        const exporter = new Exporter();
        exporter.littleEndian = this.isLittleEndian;
        exporter.p = this.vertexPrecision;

        try {
            exporter.export(this.model.getMesh(), format, this.filename, factor);
            this.printout.log(`Saved file '${this.filename}' as ${format.toUpperCase()}`);
        }
        catch (e) {
            this.printout.error(e);
        }
    }

    // Interface for the dat.gui button. Completely removes the model and resets
    // everything to a clean state.
    delete() {
        // it's necessary to clear file input box because it blocks importing
        // a model with the same name twice in a row
        this.fileInput.value = "";

        if (this.model) {
            this.pointer.removeObject(this.model.getMesh());
            this.model.dispose();
            this.model = null;
        }
        else {
            this.printout.warn("No model to delete.");
            return;
        }

        this.endSliceMode();

        this.removeAllMeasurements();
        this.endSetBase();

        this.editStack.clear();
        //this.buildEditFolder();
        this.gizmo.visible = false;

        this.infoBox.update();

        this.printout.log("Model deleted.");
    }

    // Reposition the camera to look at the model.
    cameraToModel() {
        if (!this.model) {
            this.printout.warn("No model to align camera.");
            return;
        }
        this.controls.update({
            origin: this.model.getCenter(),
            r: this.model.getMaxSize() * 3 // factor of 3 empirically determined
        });
    }
    
    createGizmo() {
        this.gizmoVisible = false;

        this.gizmoSpacing = 1;

        // current radial boundary; next handle begins one spacing unit away from here
        let gizmoEdge = 0;

        this.gizmoScaleHandleRadius = 1.5;
        this.gizmoScaleHandleHeight = 4.0;
        this.gizmoScaleHandleRadialSegments = 32;
        this.gizmoScaleHandleOffset = 14;
        this.gizmoScaleOrthogonalHandleRadius = 3.0;
        this.gizmoScaleOrthogonalHandleWidthSegments = 32;
        this.gizmoScaleOrthogonalHandleHeightSegments = 16;

        // edge of the
        gizmoEdge = this.gizmoScaleHandleOffset + this.gizmoScaleHandleHeight / 2;

        this.gizmoRotateHandleWidth = 0.6;
        this.gizmoRotateHandleHeight = this.gizmoRotateHandleWidth;
        this.gizmoRotateHandleOuterRadius =
            gizmoEdge + this.gizmoSpacing + this.gizmoRotateHandleWidth / 2;
        this.gizmoRotateHandleRadialSegments = 64;

        gizmoEdge = this.gizmoRotateHandleOuterRadius;

        this.gizmoRotateOrthogonalHandleOuterRadius =
            this.gizmoRotateHandleOuterRadius + this.gizmoSpacing + this.gizmoRotateHandleWidth;

        gizmoEdge = this.gizmoRotateOrthogonalHandleOuterRadius;

        this.gizmoTranslateHandleRadius = 1.5;
        this.gizmoTranslateHandleHeight = 7.5;
        this.gizmoTranslateHandleRadialSegments = 32;
        this.gizmoTranslateHandleOffset =
            gizmoEdge + this.gizmoSpacing + this.gizmoTranslateHandleHeight / 2;

        this.gizmoTranslateOrthogonalHandleWidth = 8,
            this.gizmoTranslateOrthogonalHandleHeight = 4,
            this.gizmoTranslateOrthogonalHandleThickness = 0,
            this.gizmoTranslateOrthogonalHandleInset = 2,
            this.gizmoTranslateOrthogonalHandleOffset =
                this.gizmoRotateOrthogonalHandleOuterRadius + this.gizmoSpacing + 3;

        this.gizmoScaleFactor = 0.003;
        this.gizmoColliderInflation = 0.5;

        const _this = this;

        this.gizmo = new Gizmo(this.camera, this.renderer.domElement, {
            scaleHandleRadius: this.gizmoScaleHandleRadius,
            scaleHandleHeight: this.gizmoScaleHandleHeight,
            scaleHandleRadialSegments: this.gizmoScaleHandleRadialSegments,
            scaleHandleOffset: this.gizmoScaleHandleOffset,
            scaleOrthogonalHandleRadius: this.gizmoScaleOrthogonalHandleRadius,
            scaleOrthogonalHandleWidthSegments: this.gizmoScaleOrthogonalHandleWidthSegments,
            scaleOrthogonalHandleHeightSegments: this.gizmoScaleOrthogonalHandleHeightSegments,

            rotateHandleOuterRadius: this.gizmoRotateHandleOuterRadius,
            rotateOrthogonalHandleOuterRadius: this.gizmoRotateOrthogonalHandleOuterRadius,
            rotateHandleWidth: this.gizmoRotateHandleWidth,
            rotateHandleHeight: this.gizmoRotateHandleHeight,
            rotateHandleRadialSegments: this.gizmoRotateHandleRadialSegments,

            translateHandleRadius: this.gizmoTranslateHandleRadius,
            translateHandleHeight: this.gizmoTranslateHandleHeight,
            translateHandleRadialSegments: this.gizmoTranslateHandleRadialSegments,
            translateHandleOffset: this.gizmoTranslateHandleOffset,
            translateOrthogonalHandleWidth: this.gizmoTranslateOrthogonalHandleWidth,
            translateOrthogonalHandleHeight: this.gizmoTranslateOrthogonalHandleHeight,
            translateOrthogonalHandleThickness: this.gizmoTranslateOrthogonalHandleThickness,
            translateOrthogonalHandleInset: this.gizmoTranslateOrthogonalHandleInset,
            translateOrthogonalHandleOffset: this.gizmoTranslateOrthogonalHandleOffset,

            scaleFactor: this.gizmoScaleFactor,
            colliderInflation: this.gizmoColliderInflation,

            onTransform() { _this.controls.disable(); },
            onFinishTransform() { _this.controls.enable(); },

            getPosition() { return _this.position.clone(); },
            setPosition(pos) { _this.position.copy(pos); },
            onTranslate: this.onTranslate.bind(this),
            onFinishTranslate: this.onFinishTranslate.bind(this),

            getRotation() { return _this.rotation.clone(); },
            setRotation(euler) { _this.rotation.copy(euler); },
            onRotate: this.onRotate.bind(this),
            onFinishRotate: this.onFinishRotate.bind(this),

            getScale() { return _this.scale.clone(); },
            setScale(scale) { _this.scale.copy(scale); },
            onScale: this.onScaleByFactor.bind(this),
            onFinishScale: this.onFinishScale.bind(this)
        });

        this.gizmo.visible = false;
        this.gizmo.position.copy(this.calculateBuildPlateCenter());

        this.overlayScene.add(this.gizmo);

        // handle the state of the transformation snap checkbox
        this.handleSnapTransformationToFloorState();
    }

    createInfoBox() {
        this.infoBox = new InfoBox(this.displayPrecision);
        this.infoBox.add("Units", this, "units");
        this.infoBox.add("Polycount", this, ["model","getPolyCount"]);
        this.infoBox.add("Vertex count", this, ["model","getVertexCount"]);
        this.infoBox.add("x range", this, ["model","getXRange"]);
        this.infoBox.add("y range", this, ["model","getYRange"]);
        this.infoBox.add("z range", this, ["model","getZRange"]);
        this.infoBox.add("Center", this, ["model","getCenter"]);
        this.infoBox.add("Size", this, ["model","getSize"]);
        this.infoBox.add("Surface area", this, ["model","surfaceArea"]);
        this.infoBox.add("Volume", this, ["model","volume"]);
        this.infoBox.add("Center of mass", this, ["model","centerOfMass"]);
        this.infoBox.update();
    }
}

export { Meshy }