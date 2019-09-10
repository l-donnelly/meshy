let config = {
    gizmo:{
        scaleHandleRadius: 1.5,
        scaleHandleHeight: 4.0,
        scaleHandleRadialSegments: 32,
        scaleHandleOffset: 14,
        scaleOrthogonalHandleRadius: 3.0,
        scaleOrthogonalHandleWidthSegments: 32,
        scaleOrthogonalHandleHeightSegments: 16,
        rotateHandleOuterRadius: 17.3,//(gizmoScaleHandleOffset + gizmoScaleHandleHeight / 2) + (gizmoSpacing=1) + gizmoRotateHandleWidth / 2;
        rotateHandleWidth: 0.6,
        rotateHandleHeight: 0.6,
        rotateHandleRadialSegments: 64,
        rotateOrthogonalHandleOuterRadius: 18.9,//prev + (gizmoSpacing=1) + gizmoRotateHandleWidth
        translateHandleRadius: 1.25,
        translateHandleHeight: 6,
        translateHandleRadialSegments: 32,
        translateHandleOffset: 22.9,//prev + (gizmoSpacing=1) + gizmoTranslateHandleHeight/2
        translateOrthogonalHandleWidth: 8,
        translateOrthogonalHandleHeight: 4,
        translateOrthogonalHandleThickness: 2,
        translateOrthogonalHandleInset: 2,
        translateOrthogonalHandleOffset: 27,//gizmoRotateOrthogonalHandleOuterRadius + (gizmoSpacing=1) + 3;
        scaleFactor: 0.003,
        colliderInflation: 0.5
    }
};

export { config };