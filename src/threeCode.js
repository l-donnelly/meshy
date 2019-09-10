let wrappedModelTransform = function(op, axis, amount, model, printOut) {
    let transform = new Transform(op, axis, amount, model, printOut);
    transform.apply();
};

let wrappedModelScaleToSize = function(axis, value, model) {
    if (wrappedModel) {
        let currentSize = wrappedModel["getSize"+axis]();
        if (currentSize>0) {
            let ratio = value/currentSize;
            if (scaleOnAllAxes) wrappedModelTransform("scale","all",ratio, model);
            else wrappedModelTransform("scale",axis,ratio, model);
        }
        else {
            printOut.error("Couldn't get current model size, try again or reload the model.");
        }
    }
};

this.wrappedModelscaleToMeasurement = function(measurementToScale) {
    if (wrappedModel) {
        let currentValue = wrappedModel.getMeasuredValue(measurementToScale);
        if (currentValue) {
            let ratio = newMeasurementValue/currentValue;
            if (measurementToScale==="crossSection") ratio = Math.sqrt(ratio);
            this.transform("scale","all",ratio);
        }
    }
};

this.loadWrappedModel = function(modelURL, callback) {
    if(scene) {
        if (wrappedModel) {
            scene.remove(wrappedModel);
        }

        let extension;
        if(modelURL.includes(".obj"))
            extension = ".obj";
        else if(modelURL.includes(".stl"))
            extension = ".stl";

        wrappedModel = new Model(
            scene,
            camera,
            canvas

        );

        wrappedModel.isLittleEndian = true;
        wrappedModel.vertexPrecision = 5;
        wrappedModel.thicknessThreshold = 0.1;
        wrappedModel.sliceHeight = .05;
        scaleOnAllAxes = true;

        $.get(modelURL, function(data) {
            let file = new File([data], "model" + extension, {
                type: "text/plain"
            });
            wrappedModel.import(file, function(){
                wrappedModel.setMeshColor("#ffffff");
                wrappedModelTransform("scale","x", 0.01, wrappedModel);
                wrappedModelTransform("scale","y", 0.01, wrappedModel);
                wrappedModelTransform("scale","z", 0.01, wrappedModel);

                let bBox = new THREE.Box3().setFromObject(wrappedModel.basicMesh);
                let centre = new THREE.Vector3();
                bBox.getCenter(centre);
                self.wrappedModeltranslateX(-centre.x);
                self.wrappedModeltranslateY(-centre.y);
                self.wrappedModeltranslateZ(-centre.z);
                wrappedModel.basicMesh.material.side = THREE.DoubleSide;
                wrappedModelLoaded = true;
                if(callback)
                    callback();
            });
        });
    }
};

this.wrappedModeltranslateX = function(xTranslation) { wrappedModelTransform("translate","x",xTranslation, wrappedModel); };
this.wrappedModeltranslateY = function(yTranslation) { wrappedModelTransform("translate","y",yTranslation, wrappedModel); };
this.wrappedModeltranslateZ = function(zTranslation) { wrappedModelTransform("translate","z",zTranslation, wrappedModel); };
this.wrappedModelrotateX = function(xRotation) { wrappedModelTransform("rotate","x",xRotation, wrappedModel); };
this.wrappedModelrotateY = function(yRotation) { wrappedModelTransform("rotate","y",yRotation, wrappedModel); };
this.wrappedModelrotateZ = function(zRotation) { wrappedModelTransform("rotate","z",zRotation, wrappedModel); };
this.wrappedModelscaleX = function(xScale) { wrappedModelTransform("scale","x",xScale, wrappedModel); };
this.wrappedModelscaleY = function(yScale) { wrappedModelTransform("scale","y",yScale, wrappedModel); };
this.wrappedModelscaleZ = function(zScale) { wrappedModelTransform("scale","z",zScale, wrappedModel); };
this.wrappedModelscaleAll = function(allScale) { wrappedModelTransform("scale","all",allScale, wrappedModel); };
this.wrappedModelmirrorX = function() { wrappedModelTransform("mirror","x",null, wrappedModel); };
this.wrappedModelmirrorY = function() { wrappedModelTransform("mirror","y",null, wrappedModel); };
this.wrappedModelmirrorZ = function() { wrappedModelTransform("mirror","z",null, wrappedModel); };
this.wrappedModelfloorX = function() { wrappedModelTransform("floor","x",null, wrappedModel); };
this.wrappedModelfloorY = function() { wrappedModelTransform("floor","y",null, wrappedModel); };
this.wrappedModelfloorZ = function() { wrappedModelTransform("floor","z",null, wrappedModel); };
this.wrappedModelcenterAll = function() { wrappedModelTransform("center","all",null, wrappedModel); };
this.wrappedModelcenterX = function() { wrappedModelTransform("center","x",null, wrappedModel); };
this.wrappedModelcenterY = function() { wrappedModelTransform("center","y",null, wrappedModel); };
this.wrappedModelcenterZ = function() { wrappedModelTransform("center","z",null, wrappedModel); };
this.wrappedModelscaleToXSize = function(newXSize) { wrappedModelScaleToSize("x",newXSize, wrappedModel); };
this.wrappedModelscaleToYSize = function(newYSize) { wrappedModelScaleToSize("y",newYSize, wrappedModel); };
this.wrappedModelscaleToZSize = function(newZSize) { wrappedModelScaleToSize("z",newZSize, wrappedModel); };

this.wrappedModelExport = function(format, filename) {
    if(wrappedModelLoaded)
        wrappedModel.export(format, filename);
};

this.wrappedModelToggleWireframe = function() {
    if(wrappedModelLoaded)
        wrappedModel.toggleWireframe();
};

this.wrappedModelToggleCOM = function() {
    if(wrappedModelLoaded)
        wrappedModel.toggleCenterOfMass();
};

this.wrappedModelSetVertexPrecision = function(precision) {
    if(wrappedModelLoaded)
        wrappedModel.vertexPrecision = precision;
    wrappedModel.setVertexPrecision(wrappedModel.vertexPrecision);
};

this.wrappedModelFlipNormals = function() {
    if(wrappedModelLoaded)
        wrappedModel.flipNormals();
};

this.wrappedModelCalcSurfaceArea = function() {
    if(wrappedModelLoaded)
        wrappedModel.calcSurfaceArea();
};

this.wrappedModelCalcVolume = function() {
    if(wrappedModelLoaded)
        wrappedModel.calcVolume();
};

this.wrappedModelCalcCOM = function() {
    if(wrappedModelLoaded)
        wrappedModel.calcCenterOfMass();
};

this.wrappedModelViewThickness = function(thicknessThreshold) {
    if(wrappedModelLoaded)
        wrappedModel.thicknessThreshold = thicknessThreshold;
    wrappedModel.viewThickness(thicknessThreshold);
};

this.wrappedModelClearThicknessView = function() {
    if(wrappedModelLoaded)
        wrappedModel.clearThicknessView();
};

this.wrappedModelActivateSliceMode = function() {
    if (wrappedModelLoaded)
        wrappedModel.activateSliceMode(wrappedModel.sliceHeight);
};

this.wrappedModelDeactivateSliceMode = function() {
    if (wrappedModelLoaded)
        wrappedModel.deactivateSliceMode();
};

this.wrappedModelsetSliceMode = function() {
    if (wrappedModelLoaded)
        wrappedModel.setSliceMode(wrappedModel.sliceMode);
};

this.wrappedModelGetSliceMode = function() {
    if(wrappedModelLoaded)
        wrappedModel.getSliceMode();
};

this.wrappedModelgetCurrentSlice = function() {
    if(wrappedModelLoaded)
        wrappedModel.getCurrentSlice();
};

this.wrappedModelgetCurrentSlice = function() {
    if (wrappedModelLoaded)
        wrappedModel.setSlice(wrappedModel.currentSlice);
};

this.scaleToRingSize = function() {
    if (wrappedModel &&
        wrappedModel.measurement.active &&
        this.scalableMeasurements.includes("diameter")) {
        let tmpVal = this.newMeasurementValue;
        let tmpType = this.measurementToScale;

        this.newMeasurementValue = this.newRingSize;
        this.measurementToScale = "diameter";
        this.scaleToMeasurement();

        this.newMeasurementValue = tmpVal;
        this.measurementToScale = tmpType;
    }
    else {
        this.printout.warn("A circle measurement must be active to scale to ring size.");
    }
};

this.wrappedModelMeasureLength = function() {
    if (wrappedModel) {
        wrappedModel.activateMeasurement("length");
    }
};

this.wrappedModelMeasureAngle = function(){
    if (wrappedModel) {
        wrappedModel.activateMeasurement("angle");
    }
};

this.wrappedModelMeasureCircle = function(){
    if (wrappedModel) {
        wrappedModel.activateMeasurement("circle");
    }
};

this.wrappedModelMeasureCSX = function() {
    if (wrappedModel) {
        wrappedModel.activateMeasurement("crossSection", "x");
    }
};

this.wrappedModelMeasureCSY = function(){
    if (wrappedModel) {
        wrappedModel.activateMeasurement("crossSection", "y");
    }
};

this.wrappedModelMeasureCSZ = function(){
    if (wrappedModel) {
        wrappedModel.activateMeasurement("crossSection", "z");
    }
};

this.wrappedModelDeactivateMeasurement = function(){
    if (wrappedModel)
        wrappedModel.deactivateMeasurement();
};