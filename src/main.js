import { Meshy } from "./meshyImport.js";
import {Units} from "./units";
import {SupportGenerator} from "./supportGenerator";
import {Slicer} from "./slicer";
import {InfoBox} from "./infoBox";
import {Pointer} from "./pointer";
import {Gizmo} from "./gizmo";
import "./dat.gui.min.js";
import { AxisWidget } from "./axisWidget.js";
import { FileLoader } from "./fileLoader.js";
import Detector from "./Detector";
import {Debug} from "./debug";
import {Controls} from "./controls";
import * as Utils from "./utils";

let debug; // todo: remove
let meshy = new Meshy();

let gui;
let filenameController;
let editFolder;
let measurementFolder;
let supportSliceFolder;

let fileInput = document.createElement("input");
fileInput.id = "file";
fileInput.type = "file";
fileInput.onchange = function() { meshy.handleFile(this.files[0], function(){
    filenameController.updateDisplay();
    meshy.pointer.addObject(meshy.model.getMesh());
}); };
document.body.appendChild(fileInput);
meshy.fileInput = fileInput;

// Make the intro menu interactive.
let introVisible = false;
let intro = document.getElementById('intro');
let titleChevron = document.getElementById('titleChevron');
document.getElementById('titlebox').onclick = function(){
  introVisible = !introVisible;
  if (introVisible) {
    intro.className = 'active';
    titleChevron.className = 'up';
  }
  else {
    intro.className = 'inactive';
    titleChevron.className = 'down';
  }
};

// verify that WebGL is enabled
if (!Detector.webgl) {
    const webGLWarning = document.createElement("div");
    webGLWarning.innerHTML = "Welp! Your browser doesn't support WebGL. This page will remain blank.";
    webGLWarning.style.paddingTop = "100px";
    container.appendChild(webGLWarning);
}

// Initialize the viewport, set up everything with WebGL including the
// axis widget.
let initViewport = function() {
    let width;
    let height;

    init();
    animate();

    function init() {
        height = container.offsetHeight;
        width = container.offsetWidth;

        meshy.camera = new THREE.PerspectiveCamera(30, width/height, .1, 10000);
        // z axis is up as is customary for 3D printers
        meshy.camera.up.set(0, 0, 1);

        meshy.scene = new THREE.Scene();
        meshy.scene.background = new THREE.Color(meshy.backgroundColor);
        meshy.debug = new Debug(meshy.scene); // todo: remove

        meshy.overlayScene = new THREE.Scene();

        meshy.controls = new Controls(
            meshy.camera,
            meshy.container,
            {
                r: meshy.buildVolumeSize.length() * 1,
                phi: -Math.PI / 6,
                theta: 5 * Math.PI / 12,
                origin: meshy.defaultCameraCenter()
            }
        );

        // for lighting the scene
        const pointLight = new THREE.PointLight(0xffffff, 3);
        meshy.scene.add(pointLight);
        meshy.controls.addObject(pointLight);
        // for lighting the gizmo
        const gizmoPointLight = pointLight.clone();
        meshy.overlayScene.add(gizmoPointLight);
        meshy.controls.addObject(gizmoPointLight);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
        meshy.scene.add(ambientLight);
        meshy.overlayScene.add(ambientLight);

        meshy.axisWidget = new AxisWidget(meshy.camera);

        meshy.controls.update();

        /* RENDER */
        meshy.renderer = new THREE.WebGLRenderer({ antialias: true });
        meshy.renderer.autoClear = false;
        //meshy.renderer.setClearColor(0x000000, 0);
        //meshy.renderer.shadowMap.enabled = true;
        meshy.renderer.toneMapping = THREE.ReinhardToneMapping;
        meshy.renderer.setPixelRatio(window.devicePixelRatio);
        meshy.renderer.setSize(width, height);
        meshy.container.appendChild(meshy.renderer.domElement);

        addEventListeners();

        // make canvas focusable
        meshy.renderer.domElement.tabIndex = 0;
        // focus the canvas so that keyboard shortcuts work right after loading
        meshy.renderer.domElement.focus();
    }

    function addEventListeners() {
        window.addEventListener('keydown', onKeyDown, false);
        window.addEventListener('resize', onWindowResize, false);
    }

    function onWindowResize() {
        height = meshy.container.offsetHeight;
        width = meshy.container.offsetWidth;
        meshy.camera.aspect = width / height;
        meshy.camera.updateProjectionMatrix();

        meshy.renderer.setSize(width, height);
    }

    // keyboard controls for the rendering canvas
    function onKeyDown(e) {
        // don't intercept keyboard events as normal if a text field is in focus
        if (document.activeElement.nodeName.toLowerCase() === "input") {
            // esc blurs the current text field
            if (e.keyCode === 27) document.activeElement.blur();

            return;
        }

        const k = e.key.toLowerCase();
        let caught = true;

        if (e.ctrlKey) {
            if (e.shiftKey) {
                if (k==="z") meshy.redo();
                else caught = false;
            }
            else {
                if (k==="i") meshy.import();
                else if (k==="z") meshy.undo();
                else if (k==="y") meshy.redo();
                else caught = false;
            }
        }
        else {
            if (k==="f") meshy.cameraToModel();
            else if (k==="c") meshy.toggleCOM();
            else if (k==="w") meshy.toggleWireframe();
            else if (k==="b") meshy.toggleBuildVolume();
            else if (k==="g") meshy.toggleGizmo();
            else caught = false;
        }

        // esc key
        if (e.keyCode === 27) {
            // if setting base, turn that off
            if (meshy.setBaseOn) meshy.endSetBase();
            // else, if not setting base but a measurement is active, remove it
            else meshy.removeCurrentMeasurement();

            caught = true;
        }

        // if some app-specific action was taken, prevent default action (e.g.,
        // propagating an undo to input elements)
        if (caught) e.preventDefault();
    }

    meshy.animationID = -1;

    function animate() {
        meshy.animationID = requestAnimationFrame(animate);
        render();
    }

    function render() {
        if (!meshy.camera || !meshy.scene) return;

        // update controls
        meshy.controls.update();
        // update gizmo size and position
        if (meshy.gizmo && meshy.gizmoVisible && meshy.model) {
            meshy.gizmo.update(meshy.model.getMesh());
        }
        // update pointer cursor
        if (meshy.pointer && meshy.pointer.active) {
            meshy.pointer.updateCursor();
        }
        // update measurement markers
        meshy.forEachMeasurement(({measurement}) => {
            measurement.updateFromCamera(meshy.camera);
        });
        // update axis widget
        meshy.axisWidget.update();

        // render the main scene
        meshy.renderer.clear();
        meshy.renderer.render(meshy.scene, meshy.camera);

        // render the overlay scene
        meshy.renderer.clearDepth();
        meshy.renderer.render(meshy.overlayScene, meshy.camera);
    }

    meshy.makeBuildVolume();
    meshy.pointer = new Pointer(meshy.camera, meshy.renderer.domElement, meshy.scene);
    meshy.handleSnapTransformationToFloorState();
};

let clearFolder = function(folder) {
    for (let i=folder.__controllers.length-1; i>=0; i--) {
        folder.remove(folder.__controllers[i]);
    }
    for (const folderName in folder.__folders) {
        folder.removeFolder(folder.__folders[folderName]);
    }
};

let disableController = function(controller) {
    if (!controller) return;

    controller.domElement.style.pointerEvents = "none";
    controller.domElement.style.opacity = 0.5;
};

let enableController = function(controller) {
    if (!controller) return;

    controller.domElement.style.pointerEvents = "";
    controller.domElement.style.opacity = "";
};

let setFolderDisplayPrecision = function({__controllers, __folders}) {
    for (let ci = 0; ci < __controllers.length; ci++) {
        const controller = __controllers[ci];
        // if number controller, set precision
        if (Utils.isNumber(controller.initialValue)) {
            controller.precision(meshy.displayPrecision);
            controller.updateDisplay();
        }
    }

    for (const fkey in __folders) {
        setFolderDisplayPrecision(__folders[fkey]);
    }
};

let buildEditFolder = function() {
    clearFolder(editFolder);

    editFolder.add(meshy, "snapTransformationsToFloor").name("Snap to floor")
        .title("Snap all transformations to the build volume floor.")
        .onChange(meshy.handleSnapTransformationToFloorState.bind(meshy));

    if (!meshy.model) {
        return;
    }

    meshy.setBaseOn = false;
    meshy.setBaseController = editFolder.add(meshy, "toggleSetBase").name("Set base").title("Select a face to align so that its normal points down.");

    // position vector
    meshy.position = new THREE.Vector3();
    // radian rotation (for internal use) and equivalent degree rotation (for display)
    meshy.rotation = new THREE.Euler();
    meshy.rotationDeg = new THREE.Euler();
    // vector of scale factors
    meshy.scale = new THREE.Vector3();
    // computed size of the model
    meshy.size = new THREE.Vector3();

    meshy.updatePosition();
    meshy.updateRotation();
    meshy.updateScale();
    meshy.updateSize();

    editFolder.add(meshy, "autoCenter").name("Autocenter")
        .title("Center the mesh on x and y; snap to the floor on z.");

    // transformation currently in progress
    meshy.currentTransform = null;

    const translateFolder = editFolder.addFolder("Translate", "Translate the mesh on a given axis.");
    meshy.positionXController = translateFolder.add(meshy.position, "x").onChange(meshy.onTranslate.bind(meshy)).onFinishChange(meshy.onFinishTranslate.bind(meshy)).precision(4);
    meshy.positionYController = translateFolder.add(meshy.position, "y").onChange(meshy.onTranslate.bind(meshy)).onFinishChange(meshy.onFinishTranslate.bind(meshy)).precision(4);
    meshy.positionZController = translateFolder.add(meshy.position, "z").onChange(meshy.onTranslate.bind(meshy)).onFinishChange(meshy.onFinishTranslate.bind(meshy)).precision(4);
    // if snapping transformations to floor, might need to disable a controller
    meshy.handleSnapTransformationToFloorState();

    const rotateFolder = editFolder.addFolder("Rotate",
        "Rotate the mesh about a given axis. NB: the given Euler angles are applied in XYZ order, so subsequent rotations may affect previous rotations.");
    meshy.rotationXController = rotateFolder.add(meshy.rotationDeg, "x", 0, 360).onChange(meshy.onChangeRotationDegrees.bind(meshy)).onFinishChange(meshy.onFinishRotate.bind(meshy));
    meshy.rotationYController = rotateFolder.add(meshy.rotationDeg, "y", 0, 360).onChange(meshy.onChangeRotationDegrees.bind(meshy)).onFinishChange(meshy.onFinishRotate.bind(meshy));
    meshy.rotationZController = rotateFolder.add(meshy.rotationDeg, "z", 0, 360).onChange(meshy.onChangeRotationDegrees.bind(meshy)).onFinishChange(meshy.onFinishRotate.bind(meshy));

    const scaleFolder = editFolder.addFolder("Scale", "Scale the mesh by given criteria.");

    const scaleByFactorFolder = scaleFolder.addFolder("Scale by Factor", "Scale the mesh by a given factor ");
    meshy.scaleXController = scaleByFactorFolder.add(meshy.scale, "x", 0).onChange(meshy.onScaleByFactor.bind(meshy)).onFinishChange(meshy.onFinishScale.bind(meshy));
    meshy.scaleYController = scaleByFactorFolder.add(meshy.scale, "y", 0).onChange(meshy.onScaleByFactor.bind(meshy)).onFinishChange(meshy.onFinishScale.bind(meshy));
    meshy.scaleZController = scaleByFactorFolder.add(meshy.scale, "z", 0).onChange(meshy.onScaleByFactor.bind(meshy)).onFinishChange(meshy.onFinishScale.bind(meshy));

    const scaleToSizeFolder = scaleFolder.addFolder("Scale to Size", "Scale the mesh uniformly to a given size.");

    meshy.scaleToSizeXController = scaleToSizeFolder.add(meshy.size, "x", 0).name("x size").onChange(meshy.onScaleToSize.bind(meshy)).onFinishChange(meshy.onFinishScale.bind(meshy));
    meshy.scaleToSizeYController = scaleToSizeFolder.add(meshy.size, "y", 0).name("y size").onChange(meshy.onScaleToSize.bind(meshy)).onFinishChange(meshy.onFinishScale.bind(meshy));
    meshy.scaleToSizeZController = scaleToSizeFolder.add(meshy.size, "z", 0).name("z size").onChange(meshy.onScaleToSize.bind(meshy)).onFinishChange(meshy.onFinishScale.bind(meshy));

    this.scaleToMeasurementFolder = scaleFolder.addFolder("Scale to Measurement",
        "Set up a measurement and then scale the mesh such that the measurement will now equal the given value.");

    const ringSizeFolder = scaleFolder.addFolder("Scale To Ring Size","Set up a circle measurement around the inner circumference of a ring mesh, then scale so that the mesh will have the correct measurement in mm.");
    ringSizeFolder.add(meshy, "measureCircle").name("1. Mark circle").title("Turn on the circle measurement tool and mark the inner circumference of the ring.");

    meshy.ringSize = 0;

    ringSizeFolder.add(meshy, "ringSize", Utils.ringSizes).name("2. Ring size").title("Select ring size.");
    ringSizeFolder.add(meshy, "scaleToRingSize").name("3. Scale to size").title("Scale the ring.");
    ringSizeFolder.add(meshy, "removeCurrentMeasurement").name("4. End measurement").title("Turn off the measurement tool (ESC).");

    const mirrorFolder = editFolder.addFolder("Mirror", "Mirror the mesh on a given axis in object space.");
    mirrorFolder.add(meshy, "mirrorX").name("Mirror on x").title("Mirror mesh on x axis.");
    mirrorFolder.add(meshy, "mirrorY").name("Mirror on y").title("Mirror mesh on y axis.");
    mirrorFolder.add(meshy, "mirrorZ").name("Mirror on z").title("Mirror mesh on z axis.");

    const floorFolder = editFolder.addFolder("Floor", "Floor the mesh on a given axis.");
    floorFolder.add(meshy, "floorX").name("Floor to x").title("Floor the mesh on x axis.");
    floorFolder.add(meshy, "floorY").name("Floor to y").title("Floor the mesh on y axis.");
    floorFolder.add(meshy, "floorZ").name("Floor to z").title("Floor the mesh on z axis.");

    const centerFolder = editFolder.addFolder("Center", "Center the mesh on a given axis in the build volume.");
    centerFolder.add(meshy, "centerAll").name("Center on all").title("Center the mesh on all axes.");
    centerFolder.add(meshy, "centerX").name("Center on x").title("Center the mesh on x axis.");
    centerFolder.add(meshy, "centerY").name("Center on y").title("Center the mesh on y axis.");

    editFolder.add(meshy, "flipNormals").name("Flip normals").title("Flip mesh normals.");
};

let buildMeasurementFolder = function() {
    clearFolder(measurementFolder);

    measurementFolder.add(meshy, "measureLength").name("Length").title("Measure point-to-point length.");
    measurementFolder.add(meshy, "measureAngle").name("Angle").title("Measure angle (in degrees) between two segments formed by three consecutive points.");
    measurementFolder.add(meshy, "measureCircle").name("Circle").title("Circle measurement: radius, diameter, circumference, arc length.");
    measurementFolder.add(meshy, "measureCrossSectionX").name("Cross-section x").title("Measure cross-section on x axis.");
    measurementFolder.add(meshy, "measureCrossSectionY").name("Cross-section y").title("Measure cross-section on y axis.");
    measurementFolder.add(meshy, "measureCrossSectionZ").name("Cross-section z").title("Measure cross-section on z axis.");
    // todo: remove
    if (meshy.calculateManually === undefined) meshy.calculateManually = false;
    if (meshy.showPreviewMarker === undefined) meshy.showPreviewMarker = false;
    if (meshy.previewMarkerRadiusOffset === undefined) meshy.previewMarkerRadiusOffset = false;
    measurementFolder.add(meshy, "measureLocalCrossSection").name("Local cross-section").title("Measure the cross-section of a single part of the mesh.");
    measurementFolder.add(meshy, "measureConvexHull").name("Convex hull").title("Compute the convex hull for cross-sections.").onChange(meshy.onToggleConvexHull.bind(meshy));

    if (meshy.measurementsExist()) {
        const indices = {};
        meshy.forEachMeasurement(({measurement}, idx) => {
            indices[`${idx} (${measurement.getType()})`] = idx;
        });

        meshy.measurementFolder.add(meshy, "measurementIdx", indices).name("Current").title("Current measurement.").onChange(meshy.onSetCurrentMeasurement.bind(meshy));
        // todo: remove
        //this.measurementFolder.add(this, "measurementCalculate").name("Calculate");
        meshy.measurementFolder.add(meshy, "removeCurrentMeasurement").name("Remove").title("Remove the current measurement.");
        meshy.measurementFolder.add(meshy, "removeAllMeasurements").name("Remove all").title("Remove the all measurements.");
    }
};

let buildSupportFolder = function(folder) {
    folder.add(meshy, "supportAngle", 0, 89).name("Angle").title("Angle defining faces that need support.");
    folder.add(meshy, "supportSpacingFactor", 1, 100).name("Spacing factor").title("Greater spacing factor makes supports more sparse.");
    folder.add(meshy, "supportRadius", 0.0001, 1).name("Radius").title("Base radius for supports. NB: if this radius is too low in comparison with line width, the supports may not print correctly.");
    folder.add(meshy, "supportTaperFactor", 0, 1).name("Taper factor").title("Defines how much the supports taper when connected to the mesh.");
    folder.add(meshy, "supportSubdivs", 4).name("Subdivs").title("Number of subdivisions in the cylindrical support struts.");
    folder.add(meshy, "supportRadiusFnName", ["constant", "sqrt"]).name("Radius function").title("Function that defines how support radius grows with the volume it supports; default is square root.");
    folder.add(meshy, "supportRadiusFnK", 0).name("Function constant").title("Multiplicative constant that modifies the support radius function.");
    folder.add(meshy, "generateSupports").name("Generate supports").title("Generate the supports.");
    folder.add(meshy, "removeSupports").name("Remove supports").title("Remove generated supports.");
};

let buildSliceFolder = function(folder) {
    clearFolder(folder);

    if (meshy.sliceModeOn) {
        const maxLevel = meshy.model.getMaxSliceLevel();
        const minLevel = meshy.model.getMinSliceLevel();

        meshy.currentSliceLevel = meshy.model.getCurrentSliceLevel();
        meshy.sliceLevelController = folder.add(meshy, "currentSliceLevel").min(minLevel).max(maxLevel).step(1).onChange(meshy.setSliceLevel.bind(meshy)).name("Slice").title("Set the current slicing plane.");
        meshy.sliceMode = meshy.model.getSliceMode();
        folder.add(
            meshy,
            "sliceMode",
            { "preview": Slicer.Modes.preview, "full": Slicer.Modes.full }
        ).name("Mode").onChange(meshy.setSliceMode.bind(meshy)).title("Set slicer mode: preview mode shows the mesh sliced at a particular level; full mode shows all layers simultaneously.");

        meshy.sliceDisplayFolder = folder.addFolder("Display", "Display options for the current slice mode.");
        meshy.buildSliceDisplayFolder(meshy.sliceDisplayFolder);
    }
    buildLayerSettingsFolder(folder);
    buildRaftFolder(folder);
    buildGcodeFolder(folder);

    if (meshy.sliceModeOn) folder.add(meshy, "endSliceMode").name("Slice mode off").title("Turn slice mode off.");
    else folder.add(meshy, "startSliceMode").name("Slice mode on").title("Turn slice mode on.");
};

// build support & slicing folder
let buildSupportSliceFolder = function() {
    clearFolder(supportSliceFolder);

    if (meshy.sliceModeOn) {
        this.buildSliceFolder(supportSliceFolder);
    }
    else {
        supportSliceFolder.add(meshy, "layerHeight", .0001, 1).name("Layer height").title("Height of each mesh slice layer.");
        supportSliceFolder.add(meshy, "lineWidth", .0001, 1).name("Line width").title("Width of the print line. Affects minimum resolvable detail size, decimation of sliced contours, and extrusion in the exported G-code.");
        supportSliceFolder.add(meshy, "sliceAxis", ["x", "y", "z"]).name("Up axis").title("Axis normal to the slicing planes.");

        const supportFolder = supportSliceFolder.addFolder("Supports", "Generate supports for printing the model.");
        buildSupportFolder(supportFolder);

        const sliceFolder = supportSliceFolder.addFolder("Slice", "Slice the mesh.");
        buildSliceFolder(sliceFolder);
    }
};

let buildLayerSettingsFolder = function(folder) {
    const sliceLayerSettingsFolder = folder.addFolder("Layer Settings", "Settings for computing layers.");
    clearFolder(sliceLayerSettingsFolder);

    sliceLayerSettingsFolder.add(meshy, "sliceNumWalls", 1, 10).name("Walls").step(1)
        .title("Number of horizontal walls between the print exterior and the interior.");
    sliceLayerSettingsFolder.add(meshy, "sliceNumTopLayers", 1, 10).name("Top layers").step(1)
        .title("Number of layers of solid infill that must be present between the print interior and exterior in the vertical direction.");
    sliceLayerSettingsFolder.add(meshy, "sliceOptimizeTopLayers").name("Optimize top layers")
        .title("Calculate the top layers in an optimized way. This may result in slightly less accurate solid infill computation but should cheapen computation.");
    sliceLayerSettingsFolder.add(meshy, "sliceInfillType", {
        "none": Slicer.InfillTypes.none,
        "solid": Slicer.InfillTypes.solid,
        "grid": Slicer.InfillTypes.grid,
        "lines": Slicer.InfillTypes.lines,
        //"triangle": Slicer.InfillTypes.triangle,
        //"hex": Slicer.InfillTypes.hex
    }).name("Infill type")
        .title("Print infill type: fills the parts of each contour that aren't occupied by solid infill forming top layers. If 'none' is selected, solid top layer infill is still generated.");
    sliceLayerSettingsFolder.add(meshy, "sliceInfillDensity", 0, 1).name("Infill density")
        .title("0 density means no infill, 1 means solid.");
    sliceLayerSettingsFolder.add(meshy, "sliceInfillOverlap", 0, 1).name("Infill overlap")
        .title("Defines how much infill overlaps with the innermost wall. 0 gives a separation of a full line width, 1 means the printline of an infill line starts and ends on the centerline of the wall.");
    if (meshy.sliceModeOn) {
        sliceLayerSettingsFolder.add(meshy, "updateSlicerParams").name("Apply")
            .title("Update the layer parameters and recalculate as necessary.");
    }
};

let buildRaftFolder = function(folder) {
    const sliceRaftFolder = folder.addFolder("Raft", "Settings for computing the raft.");
    clearFolder(sliceRaftFolder);

    sliceRaftFolder.add(meshy, "sliceMakeRaft").name("Make raft")
        .title("Checked if the slicer needs to generate a raft. The raft is formed from several layers of infill to provide initial adhesion to the build plate.");
    sliceRaftFolder.add(meshy, "sliceRaftNumBaseLayers", 0).step(1).name("Base layers")
        .title("Number of raft base layers. These layers are printed slowly to ensure initial adhesion.");
    sliceRaftFolder.add(meshy, "sliceRaftBaseLayerHeight", 0).name("Base height")
        .title("Print height of the raft base layers.");
    sliceRaftFolder.add(meshy, "sliceRaftBaseLineWidth", 0).name("Base width")
        .title("Line width of the raft base layers.");
    sliceRaftFolder.add(meshy, "sliceRaftBaseDensity", 0, 1).name("Base density")
        .title("Density of the infill forming the raft base layers.");
    sliceRaftFolder.add(meshy, "sliceRaftNumTopLayers", 0).step(1).name("Top layers")
        .title("Number of additional layers on top of the raft base layers.");
    sliceRaftFolder.add(meshy, "sliceRaftTopLayerHeight", 0).name("Top height")
        .title("Print height of the raft top layers.");
    sliceRaftFolder.add(meshy, "sliceRaftTopLineWidth", 0).name("Top width")
        .title("Line width of the raft top layers.");
    sliceRaftFolder.add(meshy, "sliceRaftTopDensity", 0, 1).name("Top density")
        .title("Density of the infill forming the raft top layers.");
    sliceRaftFolder.add(meshy, "sliceRaftOffset", 0).name("Offset")
        .title("Horizontal outward offset distance of the raft from the bottom of the mesh. A wider raft will adhere to the build plate better.");
    sliceRaftFolder.add(meshy, "sliceRaftGap", 0).name("Air gap")
        .title("Small air gap between the top of the raft and the bottom of the main print to make detaching the print easier.");
    sliceRaftFolder.add(meshy, "sliceRaftWriteWalls").name("Print perimeter")
        .title("Optionally print the raft with walls around the infill.");
    if (meshy.sliceModeOn) {
        sliceRaftFolder.add(meshy, "updateSlicerParams").name("Apply")
            .title("Update the raft parameters and recalculate as necessary.");
    }
};

let buildGcodeFolder = function(folder) {
    const gcodeFolder = folder.addFolder("G-code", "Settings for computing the G-code.");
    clearFolder(gcodeFolder);

    meshy.gcodeFilenameController = gcodeFolder.add(meshy, "gcodeFilename").name("Filename")
        .title("Filename to save.");
    gcodeFolder.add(meshy, "gcodeExtension", { gcode: "gcode" }).name("Extension")
        .title("File extension.");
    gcodeFolder.add(meshy, "gcodeTemperature", 0).name("Temperature")
        .title("Extruder temperature.");
    gcodeFolder.add(meshy, "gcodeFilamentDiameter", 0.1, 5).name("Filament diameter")
        .title("Filament diameter (mm); affects the computation of how much to extrude.");
    gcodeFolder.add(meshy, "gcodePrimeExtrusion", 0).name("Prime extrusion")
        .title("Small length (mm) of filament to extrude for priming the nozzle.");
    gcodeFolder.add(meshy, "gcodeExtrusionMultiplier", 0).name("Extrusion multiplier")
        .title("Factor that can be used to tweak under- or over-extrusion. Directly multiplies gcode extrusion values. Default is 1.");
    gcodeFolder.add(meshy, "gcodeInfillSpeed", 0).name("Infill speed")
        .title("Speed (mm/s) at which infill is printed. Infill is less sensitive to accuracy issues, so it can be printed more quickly than the walls.");
    gcodeFolder.add(meshy, "gcodeWallSpeed", 0).name("Wall speed")
        .title("Speed (mm/s) at which the walls are printed.");
    gcodeFolder.add(meshy, "gcodeRaftBasePrintSpeed", 0).name("Raft base speed")
        .title("Speed (mm/s) at which the raft base layer should be printed. Should be slow so that the layer is thick and adheres properly.");
    gcodeFolder.add(meshy, "gcodeRaftTopPrintSpeed", 0).name("Raft top speed")
        .title("Speed (mm/s) at which the raft top layer should be printed.");
    gcodeFolder.add(meshy, "gcodeTravelSpeed", 0).name("Travel speed")
        .title("Speed (mm/s) at which the extruder travels while not printing.");
    gcodeFolder.add(meshy, "gcodeCoordinatePrecision", 0).name("Coord precision")
        .title("Number of digits used for filament position coordinates. More digits increases file size.");
    gcodeFolder.add(meshy, "gcodeExtruderPrecision", 0).name("Extruder precision")
        .title("Number of digits used for extrusion values. More digits increases file size.");
    if (meshy.sliceModeOn) {
        gcodeFolder.add(meshy, "gcodeSave", 0).name("Save G-code")
            .title("Generate g-code and save it to a file.");
    }
};

let generateUI = function() {
    gui = new dat.GUI();
    gui.add(meshy, "import").name("Import").title("Import a mesh.");

    const importSettingsFolder = gui.addFolder("Import Settings", "Defaults for the imported mesh.");
    meshy.filename = "meshy";
    meshy.exportUnits = meshy.units;
    meshy.backgroundColor = "#222222";
    meshy.meshColor = "#481a1a";
    meshy.wireframeColor = "#000000";
    meshy.meshRoughness = 0.3;
    meshy.meshMetalness = 0.5;
    meshy.snapTransformationsToFloor = true;

    importSettingsFolder.add(meshy, "importUnits", {mm: Units.mm, cm: Units.cm, inches: Units.inches}).name("Import units").title("Units of the imported mesh.");
    importSettingsFolder.add(meshy, "autocenterOnImport").name("Autocenter").title("Autocenter the mesh upon importing.");

    const exportFolder = gui.addFolder("Export", "Mesh export.");
    filenameController = exportFolder.add(meshy, "filename").name("Filename").title("Filename for the exported mesh.");

    exportFolder.add(meshy, "exportUnits", {mm: Units.mm, cm: Units.cm, inches: Units.inches}).name("Export units").title("Units of the exported mesh.");
    exportFolder.add(meshy, "exportOBJ").name("Export OBJ").title("Export as OBJ file.");
    exportFolder.add(meshy, "exportSTL").name("Export STL").title("Export as binary STL file.");
    exportFolder.add(meshy, "exportSTLascii").name("Export ASCII STL").title("Export as ASCII STL file.");

    const settingsFolder = gui.addFolder("Settings", "Settings for computation.");

    settingsFolder.add(meshy, "isLittleEndian").name("Little endian").title("Endianness toggle for imports and exports.");
    settingsFolder.add(meshy, "vertexPrecision").name("Vertex precision").onChange(meshy.setVertexPrecision.bind(meshy)).title("Precision p; 10^p is used as a conversion factor between floating-point and fixed-point coordinates.");

    editFolder = gui.addFolder("Edit", "Mesh edit functions: translation, scaling, rotation, normals.");
    buildEditFolder();

    const displayFolder = gui.addFolder("Display", "Mesh and build volume display settings.");

    displayFolder.add(meshy, "displayPrecision", 0, 7).step(1).name("Display precision").onChange(meshy.setDisplayPrecision(function(){setFolderDisplayPrecision(editFolder)})).title("Maximal number of decimal places for displaying floating-point values.");
    displayFolder.add(meshy, "toggleGizmo").name("Toggle gizmo").title("Toggle transform gizmo visibility (G).");
    displayFolder.add(meshy, "toggleAxisWidget").name("Toggle axis widget").title("Toggle axis widget visibility.");
    displayFolder.add(meshy, "toggleWireframe").name("Toggle wireframe").title("Toggle mesh wireframe (W).");
    displayFolder.add(meshy, "toggleCOM").name("Toggle center of mass").title("Toggle the center of mass indicator (C).");
    displayFolder.add(meshy, "cameraToModel").name("Camera to model").title("Snap camera to model (F).");
    meshy.backgroundColorController = displayFolder.addColor(meshy, "backgroundColor").name("Background color").onChange(meshy.setBackgroundColor.bind(meshy)).title("Set background color.");
    meshy.meshColorController = displayFolder.addColor(meshy, "meshColor").name("Mesh color").onChange(meshy.setMeshMaterial.bind(meshy)).title("Set mesh color.");
    displayFolder.add(meshy, "meshRoughness", 0, 1).name("Mesh roughness").onChange(meshy.setMeshMaterial.bind(meshy)).title("Set mesh roughness.");
    displayFolder.add(meshy, "meshMetalness", 0, 1).name("Mesh metalness").onChange(meshy.setMeshMaterial.bind(meshy)).title("Set mesh metalness.");
    meshy.meshColorController = displayFolder.addColor(meshy, "wireframeColor").name("Wireframe color").onChange(meshy.setWireframeMaterial.bind(meshy)).title("Set wireframe color.");
    const buildVolumeFolder = displayFolder.addFolder("Build Volume", "Size and visibility settings for the build volume.");
    buildVolumeFolder.add(meshy, "toggleBuildVolume").name("Toggle volume").title("Toggle build volume visibility.");
    buildVolumeFolder.add(meshy, "centerOriginOnBuildPlate").name("Center origin").title("Center the origin on the floor of the build volume or place it in the corner.").onChange(meshy.makeBuildVolume.bind(meshy));
    meshy.buildVolumeXController = buildVolumeFolder.add(meshy.buildVolumeSize, "x", 0).name("Build volume x").title("Build volume size on x in mm.").onChange(meshy.makeBuildVolume.bind(meshy));
    meshy.buildVolumeYController = buildVolumeFolder.add(meshy.buildVolumeSize, "y", 0).name("Build volume y").title("Build volume size on y in mm.").onChange(meshy.makeBuildVolume.bind(meshy));
    meshy.buildVOlumeZController = buildVolumeFolder.add(meshy.buildVolumeSize, "z", 0).name("Build volume z").title("Build volume size on z in mm.").onChange(meshy.makeBuildVolume.bind(meshy));
    meshy.snapTransformationsToFloor = true;

    measurementFolder = gui.addFolder("Measure", "Make calculations based on mouse-placed markers.");
    buildMeasurementFolder();

    // const thicknessFolder = gui.addFolder("Mesh Thickness", "Visualize approximate local mesh thickness.");
    // thicknessFolder.add(meshy, "thicknessThreshold", 0).name("Threshold").title("Thickness threshold: parts of the mesh below this thickness are shown as too thin.");
    // thicknessFolder.add(meshy, "viewThickness").name("View thickness").title("Calculate mesh thickness: parts of the mesh that are too thin are shown in a color interpolated over the [threshold, 0] range.");
    // thicknessFolder.add(meshy, "clearThicknessView").name("Clear thickness view").title("Clear the color indicating parts of the mesh that are too thin.");

    supportSliceFolder = gui.addFolder("Supports & Slicing",
        "Generate supports, slice the mesh, and export the resulting G-code.");

    const repairFolder = gui.addFolder("Repair", "Repair missing polygons.");
    repairFolder.add(meshy, "repair").name("Repair").title("Repair mesh.");
    buildSupportSliceFolder();

    gui.add(meshy, "undo").name("Undo").title("Undo the last edit action.");
    gui.add(meshy, "redo").name("Redo").title("Redo the previous undo.");
    gui.add(meshy, "delete").name("Delete").title("Delete the mesh.");

    let infoBox = new InfoBox(meshy.displayPrecision);
    infoBox.add("Units", meshy, "units");
    infoBox.add("Polycount", meshy, ["model", "getPolyCount"]);
    infoBox.add("Vertex count", meshy, ["model", "getVertexCount"]);
    infoBox.add("x range", meshy, ["model", "getXRange"]);
    infoBox.add("y range", meshy, ["model", "getYRange"]);
    infoBox.add("z range", meshy, ["model", "getZRange"]);
    infoBox.add("Center", meshy, ["model", "getCenter"]);
    infoBox.add("Size", meshy, ["model", "getSize"]);
    infoBox.add("Surface area", meshy, ["model", "surfaceArea"]);
    infoBox.add("Volume", meshy, ["model", "volume"]);
    infoBox.add("Center of mass", meshy, ["model", "centerOfMass"]);
    infoBox.update();
};
initViewport();
generateUI();

