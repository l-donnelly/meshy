// Makes a cylinder with a hole in the middle.
// The code is largely the same as that of THREE.CylinderBufferGeometry.

const PipeBufferGeometry = (() => {
    class PipeBufferGeometry extends THREE.BufferGeometry {
        constructor(
            outerRadius,
            innerRadius,
            height,
            radialSegments,
            heightSegments,
            openEnded,
            thetaStart,
            thetaLength
        ) {

            super();

            this.type = 'PipeBufferGeometry';

            this.parameters = {
                outerRadius,
                innerRadius,
                height,
                radialSegments,
                heightSegments,
                openEnded,
                thetaStart,
                thetaLength
            };

            const scope = this;

            outerRadius = outerRadius !== undefined ? outerRadius : 1;
            innerRadius = innerRadius !== undefined ? innerRadius : 0.5;
            height = height || 1;

            radialSegments = Math.floor(radialSegments) || 8;
            heightSegments = Math.floor(heightSegments) || 1;

            openEnded = openEnded !== undefined ? openEnded : false;
            thetaStart = thetaStart !== undefined ? thetaStart : 0.0;
            thetaLength = thetaLength !== undefined ? thetaLength : Math.PI * 2;

            const indices = [];
            const vertices = [];
            const normals = [];
            const uvs = [];

            let index = 0;
            const halfHeight = height / 2;
            let groupStart = 0;

            generateWall(true);
            generateWall(false);

            if (!openEnded) {
                generateCap(true);
                generateCap(false);
            }

            this.setIndex(indices);
            this.addAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            this.addAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
            this.addAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

            function generateWall(outer) {
                let x;
                let y;
                const normal = new THREE.Vector3();
                const vertex = new THREE.Vector3();

                const indexArray = [];
                let groupCount = 0;

                for (y = 0; y <= heightSegments; y++) {
                    const indexRow = [];

                    const v = y / heightSegments;
                    const radius = outer ? outerRadius : innerRadius;

                    for (x = 0; x <= radialSegments; x++) {
                        const u = x / radialSegments;

                        const theta = u * thetaLength + thetaStart;

                        const sinTheta = Math.sin(theta);
                        const cosTheta = Math.cos(theta);

                        vertex.x = radius * sinTheta;
                        vertex.y = -v * height + halfHeight;
                        vertex.z = radius * cosTheta;
                        vertices.push(vertex.x, vertex.y, vertex.z);

                        normal.set(sinTheta, 0, cosTheta); // don't need to normalize
                        if (!outer) normal.negate();
                        normals.push(normal.x, normal.y, normal.z);

                        uvs.push(u, 1 - v);

                        indexRow.push(index++);
                    }

                    indexArray.push(indexRow);
                }

                for (x = 0; x < radialSegments; x++) {
                    for (y = 0; y < heightSegments; y++) {
                        const a = indexArray[y][x];
                        const b = indexArray[y+1][x];
                        const c = indexArray[y+1][x+1];
                        const d = indexArray[y][x+1];

                        if (outer) {
                            indices.push(a, b, d);
                            indices.push(b, c, d);
                        }
                        else {
                            indices.push(a, d, b);
                            indices.push(b, d, c);
                        }

                        groupCount += 6;
                    }
                }

                scope.addGroup(groupStart, groupCount, outer ? 0 : 1);

                groupStart += groupCount;
                console.log(vertices);
            }

            function generateCap(top) {
                let x;
                const vertex = new THREE.Vector3();

                const sign = top ? 1 : -1;
                const idxStart = index;
                let groupCount = 0;

                for (x = 0; x <= radialSegments; x++) {
                    const u = x / radialSegments;
                    const theta = u * thetaLength + thetaStart;

                    const sinTheta = Math.sin(theta);
                    const cosTheta = Math.cos(theta);

                    vertex.x = outerRadius * sinTheta;
                    vertex.y = halfHeight * sign;
                    vertex.z = outerRadius * cosTheta;
                    vertices.push(vertex.x, vertex.y, vertex.z);

                    vertex.x = innerRadius * sinTheta;
                    vertex.y = halfHeight * sign;
                    vertex.z = innerRadius * cosTheta;
                    vertices.push(vertex.x, vertex.y, vertex.z);

                    normals.push(0, sign, 0);
                    normals.push(0, sign, 0);

                    uvs.push(u, 0);
                    uvs.push(u, 1);

                    index++;
                    index++;
                }

                for (x = 0; x < radialSegments; x++) {
                    const idx = idxStart + x * 2;

                    if (top) {
                        indices.push(idx, idx+3, idx+1);
                        indices.push(idx, idx+2, idx+3);
                    }
                    else {
                        indices.push(idx, idx+1, idx+3);
                        indices.push(idx, idx+3, idx+2);
                    }

                    groupCount += 6;
                }

                scope.addGroup(groupStart, groupCount, top ? 2 : 3);

                groupStart += groupCount;
            }
        }
    }

    return PipeBufferGeometry;
})();

export { PipeBufferGeometry }
