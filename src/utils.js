/*
  Some utilities, static data, etc.
*/

const epsilonDefault = 1e-5;
const axisDefault = 'z';

export function splitFilename(fullName) {
    const idx = fullName.lastIndexOf('.');
    if (idx===-1) {
        return {
            name: fullName,
            extension: ""
        };
    }
    else {
        return {
            name: fullName.substr(0, idx),
            extension: fullName.substr(idx+1).toLowerCase()
        };
    }
}


// swapping
function swap(arr, i, j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
}


// Vector3 stuff

// for turning "x" etc. into a normalized Vector3 along axis
export const axisToVector3 = axis => {
    const v = new THREE.Vector3();
    v[axis] = 1;
    return v;
};

// turn 0/1/2 component into 'x'/'y'/'z' label
export const vector3ComponentToAxis = component => {
    if (component===0) return 'x';
    else if (component===1) return 'y';
    else return 'z';
};

// cycle axis label to the next axis
export function cycleAxis(axis) {
    if (axis==='x') return 'y';
    else if (axis==='y') return 'z';
    else return 'x';
}

// special vectors
export function getZeroVector() { return new THREE.Vector3(0,0,0); }
export function getOneVector() { return new THREE.Vector3(1,1,1); }

// generate unit vector along given axis
export function makeAxisUnitVector(axis) {
    if (axis === undefined) axis = axisDefault;

    const v = new THREE.Vector3();
    v[axis] = 1;

    return v;
}



export function eulerRadToDeg (euler) {
    const eulerDeg = euler.clone();
    const factor = 180 / Math.PI;

    eulerDeg.x *= factor;
    eulerDeg.y *= factor;
    eulerDeg.z *= factor;

    return eulerDeg;
}
export function eulerDegToRad (euler) {
    const eulerRad = euler.clone();
    const factor = Math.PI / 180;

    eulerRad.x *= factor;
    eulerRad.y *= factor;
    eulerRad.z *= factor;

    return eulerRad;
}
export function eulerRadNormalize(euler) {
    const max = Math.PI * 2;

    euler.x = ((euler.x % max) + max) % max;
    euler.y = ((euler.y % max) + max) % max;
    euler.z = ((euler.z % max) + max) % max;

    return euler;
}
export function eulerDegNormalize(euler) {
    const max = 360;

    euler.x = ((euler.x % max) + max) % max;
    euler.y = ((euler.y % max) + max) % max;
    euler.z = ((euler.z % max) + max) % max;

    return euler;
}

// element max/min
export function vector3MaxElement({x, y, z}) {
    return Math.max(x, y, z);
}
export function vector3MinElement({x, y, z}) {
    return Math.min(x, y, z);
}
// return 'x', 'y', or 'z' depending on which element is greater/lesser
export function vector3ArgMax({x, y, z}) {
    return x>y ? (x>z ? 'x' : 'z') : (y>z ? 'y' : 'z');
}
export function vector3ArgMin({x, y, z}) {
    return x<y ? (x<z ? 'x' : 'z') : (y<z ? 'y' : 'z');
}
export function clamp(x, minVal, maxVal) {
    if (x < minVal) x = minVal;
    else if (x > maxVal) x = maxVal;
    return x;
}
export function inRange(x, minVal, maxVal) {
    return (minVal===undefined || x >= minVal) && (maxVal===undefined || x <= maxVal);
}
export function vector3Abs({x, y, z}) {
    const result = new THREE.Vector3();
    result.x = Math.abs(x);
    result.y = Math.abs(y);
    result.z = Math.abs(z);
    return result;
}
export function vector3AxisMin(v1, v2, axis) {
    if (v1[axis] < v2[axis]) return v1;
    else return v2;
}
export function vector3AxisMax(v1, v2, axis) {
    if (v1[axis] > v2[axis]) return v1;
    else return v2;
}


// object type bool checks and other utilities

export function isArray(item) {
    return (Object.prototype.toString.call(item) === '[object Array]');
}

export function isString(item) {
    return (typeof item === 'string' || item instanceof String);
}

export function isNumber(item) {
    return (typeof item === 'number');
}

export function isFunction(item) {
    return (typeof item === 'function');
}

export function isInfinite(n) {
    return n===Infinity || n===-Infinity;
}

// check if object has properties
export function objectIsEmpty(obj) {
    let isEmpty = true;
    for (const key in obj) {
        isEmpty = false;
        break;
    }
    return isEmpty;
}

export function shallowCopy(obj) {
    return Object.assign({}, obj);
}

// push b's terms onto a without using concat
export function arrayAppend(target, source) {
    const sourceLength = source.length;

    for (let i = 0; i < sourceLength; i++) target.push(source[i]);
}

export function cloneVector3Array(arr) {
    const result = [];

    for (let i = 0; i < arr.length; i++) result.push(arr[i].clone());

    return result;
}

// THREE.Face3- and THREE.Vector3-related functions
// get THREE.Face3 vertices
export function faceGetVerts(face, vertices) {
    return [
        vertices[face.a],
        vertices[face.b],
        vertices[face.c]
    ];
}
export function faceGetMaxAxis(face, vertices, axis) {
    const [a, b, c] = faceGetVerts(face, vertices);
    return Math.max(a[axis], Math.max(b[axis], c[axis]));
}
export function faceGetMinAxis(face, vertices, axis) {
    const [a, b, c] = faceGetVerts(face, vertices);
    return Math.min(a[axis], Math.min(b[axis], c[axis]));
}
export function faceGetBounds(face, vertices) {
    const min = new THREE.Vector3().setScalar(Infinity);
    const max = new THREE.Vector3().setScalar(-Infinity);
    const verts = faceGetVerts(face, vertices);

    for (let v=0; v<3; v++) {
        min.min(verts[v]);
        max.max(verts[v]);
    }

    return {
        min,
        max
    };
}
export function faceGetBoundsAxis(face, vertices, axis) {
    if (axis === undefined) axis = axisDefault;

    const verts = faceGetVerts(face, vertices);
    return {
        max: Math.max(verts[0][axis], Math.max(verts[1][axis], verts[2][axis])),
        min: Math.min(verts[0][axis], Math.min(verts[1][axis], verts[2][axis]))
    };
}
// get THREE.Face3 vertices and sort them in ascending order on axis
export function faceGetVertsSorted(face, vertices, axis) {
    if (axis === undefined) axis = axisDefault;

    const verts = faceGetVerts(face, vertices);
    let ccw = true;
    const a = verts[0][axis];
    const b = verts[1][axis];
    const c = verts[2][axis];

    if (c > a) {
        if (b > c) {
            swap (verts, 1, 2);
            ccw = false;
        }
        else if (a > b) {
            swap (verts, 0, 1);
            ccw = false;
        }
    }
    else {
        if (b > a) {
            swap (verts, 0, 2);
            swap (verts, 1, 2);
        }
        else if (c > b) {
            swap (verts, 0, 2);
            swap (verts, 0, 1);
        }
        else {
            swap (verts, 0, 2);
            ccw = false;
        }
    }

    return {
        verts,
        ccw
    };
}
export function faceGetCenter(face, vertices) {
    const verts = faceGetVerts(face, vertices);
    return verts[0].clone().add(verts[1]).add(verts[2]).divideScalar(3);
}
export function faceGetArea(face, vertices) {
    const [a, b, c] = faceGetVerts(face, vertices);
    return b.clone().sub(a).cross(c.clone().sub(a)).length()/2;
}
// compute THREE.Face3 normal
export function faceComputeNormal(face, vertices) {
    const [a, b, c] = faceGetVerts(face, vertices);
    face.normal.copy(vertsComputeNormal(a, b, c));
}
export function vertsComputeNormal(a, b, c) {
    const ba = a.clone().sub(b);
    const bc = c.clone().sub(b);

    return bc.cross(ba).normalize();
}
// Get THREE.Face3 subscript ('a', 'b', or 'c') for a given 0-2 index.
export function faceGetSubscript(idx) {
    return (idx===0) ? 'a' : ((idx===1) ? 'b' : 'c');
}
export function numHash(n, p) {
    return Math.round(n*p);
}
export function vertexHash({x, y, z}, p) {
    return `${numHash(x, p)}_${numHash(y, p)}_${numHash(z, p)}`;
}

// Remove all meshes with a particular name from a scene.
export function removeMeshByName(scene, name) {
    if (!scene) return;

    for (let i=scene.children.length-1; i>=0; i--) {
        const child = scene.children[i];
        if (child.name == name) {
            scene.remove(child);
        }
    }
}



// for calculating triangle area and efficient cross-products

// u cross v = (uy vz - uz vy, uz vx - ux vz, ux vy - uy vx)
// u = b - a; v = c - a; u cross v = 2 * area
// (b-a) cross (c-a) = 2 * area = (
//  (by-ay)(cz-az) - (bz-az)(cy-ay),
//  (bz-az)(cx-ax) - (bx-ax)(cz-az),
//  (bx-ax)(cy-ay) - (by-ay)(cx-ax),
// )
// calculate triangle area
export function triangleArea(a, b, c, axis) {
    if (axis === undefined) axis = axisDefault;

    return cornerCrossProduct(a, b, c, axis)/2;
}
// calculates cross product of b-a and c-a
export function cornerCrossProduct({ay, az, ax}, {by, bz, bx}, {cz, cy, cx}, axis) {
    if (axis === undefined) axis = axisDefault;

    if (axis === "x") return (by-ay)*(cz-az) - (bz-az)*(by-ay);
    if (axis === "y") return (bz-az)*(cx-ax) - (bx-ax)*(bz-az);
    if (axis === "z") return (bx-ax)*(cy-ay) - (by-ay)*(bx-ax);
    return 0;
}
// cross product component of two vectors
export function crossProductComponent({vy, vz, vx}, {wz, wy, wx}, axis) {
    if (axis === undefined) axis = axisDefault;

    if (axis === "x") return vy*wz - vz*wy;
    if (axis === "y") return vz*wx - vx*wz;
    if (axis === "z") return vx*wy - vy*wx;
    return 0;
}

// intersection stuff

// intersection between line segment and plane normal to axis
export function segmentPlaneIntersection(axis, level, va, vb) {
    if (axis === undefined) axis = axisDefault;

    // if equal, just return va
    if (va[axis] === vb[axis]) return va;

    // calculate linear interpolation factor; note that, as checked above, the
    // denominator will be positive
    const t = (level - va[axis]) / (vb[axis] - va[axis]);
    // difference vector
    const d = vb.clone().sub(va);
    // interpolate
    return va.clone().addScaledVector(d, t);
}

// s1, s2: endpoints of segment
// pt: point emitting ray
// axis: axis orthogonal to plane; therefore:
//  ah: horizontal axis along which ray emits
//  av: orthogonal to ah
// returns: intersection along a1 axis
export function raySegmentIntersectionOnHAxis(s1, s2, pt, axis) {
    if (axis === undefined) axis = axisDefault;

    const ah = cycleAxis(axis);
    const av = cycleAxis(ah);
    return s1[ah] + (s2[ah] - s1[ah]) * (pt[av] - s1[av]) / (s2[av] - s1[av]);
}

// flags signifying which bounds to check for intersection testing
export const BoundCheckFlags = (() => {
    const s0 = 1;
    const s1 = 2;
    const t0 = 4;
    const t1 = 8;

    return {
        none: 0,                // line-line
        s0,                 // ray-line
        s1,
        t0,                 // line-ray
        t1,
        s0t0: s0 | t0,          // ray-ray
        s1t1: s1 | t1,
        s01: s0 | s1,           // segment-line
        t01: t0 | t1,           // line-segment
        s01t0: s0 | s1 | t0,    // segment-ray
        s0t01: s0 | t0 | t1,    // ray-segment
        all: s0 | s1 | t0 | t1  // segment-segment
    };
})();

// returns the intersection (or null) of ray s with line t (both given as rays)
// basically this math:
// https://stackoverflow.com/a/2931703/7416552
// s, t: ray origins
// sd, td: ray directions (not normalized)
// checks: flags signifying which bounds to check
// point of intersection is s + sd * u = t + td * v
export function intersection(s, sd, t, td, checks, axis, epsilon) {
    if (axis === undefined) axis = axisDefault;
    if (epsilon === undefined) epsilon = epsilonDefault;

    const p = calculateIntersectionParams(s, t, sd, td, checks, axis, epsilon);

    if (!p) return null;

    return s.clone().addScaledVector(sd, p.u);
}
// returns intersection point (or null) of s-se segment and t-te segment
// E stands for 'endpoints', as opposed to origin+direction
// params:
//  s, se: first and last point of s segment
//  t, te: first and last point of t segment
export function intersectionE(s, se, t, te, checks, axis, epsilon) {
    const sd = se.clone().sub(s);
    const td = te.clone().sub(t);

    return intersection(s, sd, t, td, checks, axis, epsilon);
}

// shorthand functions for frequently used intersection types
export function lineLineIntersection(s, sd, t, td, axis, epsilon) {
    return intersection(s, sd, t, td, BoundCheckFlags.none, axis, epsilon);
}
export function rayLineIntersection(s, sd, t, td, axis, epsilon) {
    return intersection(s, sd, t, td, BoundCheckFlags.s0, axis, epsilon);
}
export function raySegmentIntersection(s, sd, t, td, axis, epsilon) {
    return intersection(s, sd, t, td, BoundCheckFlags.s0t01, axis, epsilon);
}
export function segmentSegmentIntersection(s, sd, t, td, axis, epsilon) {
    return intersection(s, sd, t, td, BoundCheckFlags.all, axis, epsilon);
}
export function segmentSegmentIntersectionE(s, se, t, te, axis, epsilon) {
    return intersectionE(s, se, t, te, BoundCheckFlags.all, axis, epsilon);
}

// calculate both intersection params for two rays instead of inlining the
// same code multiple times; only return the first param (u, corresponding to s
// ray) if the second doesn't need checking
export function calculateIntersectionParams(s, t, sd, td, checks, axis, epsilon) {
    const ah = cycleAxis(axis);
    const av = cycleAxis(ah);

    const det = sd[ah]*td[av] - sd[av]*td[ah];
    // lines are exactly parallel, so no intersection
    if (equal(det, 0, epsilon)) return null;

    const dh = t[ah] - s[ah];
    const dv = t[av] - s[av];

    // calculate and check u (s param)
    const u = (td[av]*dh - td[ah]*dv) / det;

    const u0 = checks & BoundCheckFlags.s0;
    const u1 = checks & BoundCheckFlags.s1;

    if (u0 && less(u, 0, epsilon)) return null;
    if (u1 && greater(u, 1, epsilon)) return null;

    // if don't need to check v, just return u
    if (checks & BoundCheckFlags.v01 === 0) return {
        u
    };

    // calculate and check v (t param)
    const v = (sd[av]*dh - sd[ah]*dv) / det;

    const v0 = checks & BoundCheckFlags.t0;
    const v1 = checks & BoundCheckFlags.t1;

    if (v0 && less(v, 0, epsilon)) return null;
    if (v1 && greater(v, 1, epsilon)) return null;

    // if all successful, return params
    return {
        u,
        v
    };
}

/*/
/ validate intersection params within the [0, 1] range
// arguments:
//  p: object containing u and v params
//  checks: some combination of BoundCheckFlags enum values
function validateIntersectionParams(p, checks, epsilon) {
  if (p === null) return false;

  var u = p.u;
  var v = p.v;

  var ulb = checks & BoundCheckFlags.Sstart;
  var uub = checks & BoundCheckFlags.Send;
  var vlb = checks & BoundCheckFlags.Tstart;
  var vub = checks & BoundCheckFlags.Tend;

  if (ulb && less(u, 0, epsilon)) return false;
  if (uub && greater(u, 1, epsilon)) return false;
  if (vlb && less(v, 0, epsilon)) return false;
  if (vub && greater(v, 1, epsilon)) return false;

  return true;
}
*/

// bool check if segment ab intersects segment cd
export function segmentIntersectsSegment(checks, axis, epsilon) {
    if (axis === undefined) axis = axisDefault;
    if (epsilon === undefined) epsilon = epsilonDefault;

    return ((left(a, b, c, axis, epsilon) ^ left(a, b, d, axis, epsilon)) &&
        (left(c, d, a, axis, epsilon) ^ left(c, d, b, axis, epsilon)));
}

// find the highest point of intersection between two cones; the cones have
// origins p and q, both open downward on axis, and both have walls forming
// the given angle (in radians) with the axis
// if one cone's origin is inside the other cone, return null
// principle:
// points P and P cast rays at the given angle with the vertical to the closest
// intersection I; first move Q along the I-Q line such that it's level with P
// on axis, find the midpoint of the P-Q line, then move that point down by
// (1/2)|P-Q|/tan(angle)
export function coneConeIntersection(p, q, angle, axis) {
    if (p === q) return null;

    const up = new THREE.Vector3();
    up[axis] = 1;

    const cos = Math.cos(angle);
    const d = q.clone().sub(p).normalize();

    const dot = -d.dot(up);
    // if p's cone contains q or vice versa, no intersection
    if (dot>cos || dot<cos-1) return null;

    // horizontal (orthogonal to axis), normalized vector from p to q
    d[axis] = 0;
    d.normalize();

    const tan = Math.tan(angle);

    // lift or lower q to be level with p on axis
    const diff = q[axis] - p[axis];
    const qnew = q.clone();
    qnew.addScaledVector(up, -diff);
    qnew.addScaledVector(d, -diff * tan);

    // get the midpoint, lower it as described above, that's the intersection
    const midpoint = p.clone().add(qnew).divideScalar(2);
    const len = midpoint.distanceTo(p);
    midpoint[axis] -= len/tan;

    return midpoint;
}

// returns v's distance to the line through a and b
export function distanceToLine(v, a, b) {
    // unit vector from a to b (unit vector along line)
    const abhat = b.clone().sub(a).normalize();

    // vector from a to v
    const av = v.clone().sub(a);
    // projection of a-v vector onto line
    const projection = abhat.multiplyScalar(av.dot(abhat));

    // subtract projection from a-v vector to get orthogonal vector
    return av.sub(projection).length();
}

// find the point on the a-b line that's closest to v
export function projectToLine(v, a, b, axis) {
    if (axis === undefined) axis = axisDefault;

    const ah = cycleAxis(axis);
    var av = cycleAxis(ah);

    // unit vector from a to b (unit vector along line)
    const abhat = b.clone().sub(a).normalize();

    // vector from a to v
    var av = v.clone().sub(a);
    // projection of a-v vector onto line
    const projection = abhat.multiplyScalar(av.dot(abhat));

    return a.clone()
}

// given a point p, and a plane containing point d with normal n, project p to
// the plane along axis
// as the plane is the set of points r s.t. (r-d) dot n = 0, r dot n = d dot n;
// if axis is z, rz = (d dot n - rx*nx - ry*ny) / nz
// if nz == 0, then we can't project, so just return p
export function projectToPlaneOnAxis(p, d, n, axis) {
    if (axis === undefined) axis = axisDefault;

    const ah = cycleAxis(axis);
    const av = cycleAxis(ah);

    // return p if can't project
    if (n[axis] === 0) return p;

    // get the .axis component
    const rz = (d.dot(n) - p[ah]*n[ah] - p[av]*n[av]) / n[axis];

    // set the component
    const pp = p.clone();
    pp[axis] = rz;

    return pp;
}

// takes v and projects out the n component; n is assumed normalized
export function projectOut(v, n) {
    const projection = n.clone().multiplyScalar(v.dot(n));
    return v.clone().sub(projection);
}

// returns an orthogonal vector to v
// default is vector with 0 z-component, but, if v only has a z-component,
// return vector along x
export function orthogonalVector({x, y}) {
    if (x === 0 && y === 0) return new THREE.Vector3(1, 0, 0);
    else return new THREE.Vector3(y, -x, 0).normalize();
}

// true if c is strictly left of a-b segment
export function left(a, b, c, axis, epsilon) {
    if (axis === undefined) axis = axisDefault;
    if (epsilon === undefined) epsilon = epsilonDefault;

    const area = triangleArea(a, b, c, axis);

    return greater(area, 0, epsilon);
}

// true if c is left of or on a-b segment
export function leftOn(a, b, c, axis, epsilon) {
    if (axis === undefined) axis = axisDefault;
    if (epsilon === undefined) epsilon = epsilonDefault;

    const area = triangleArea(a, b, c, axis);

    return !less(area, 0, epsilon);
}

export function pointInsideTriangle(p, a, b, c, axis, epsilon) {
    if (axis === undefined) axis = axisDefault;
    if (epsilon === undefined) epsilon = epsilonDefault;

    return left(a, b, p, axis, epsilon) &&
        left(b, c, p, axis, epsilon) &&
        left(c, a, p, axis, epsilon);
}

// approximate coincidence testing for vectors
export function coincident({ax, ay, az}, {bx, by, bz}, epsilon) {
    if (epsilon === undefined) epsilon = epsilonDefault;

    return equal(ax - bx, 0, epsilon) &&
        equal(ay - by, 0, epsilon) &&
        equal(az - bz, 0, epsilon);
}

// approximate collinearity testing for three vectors
export function collinear(a, b, c, axis, epsilon) {
    if (axis === undefined) axis = axisDefault;
    if (epsilon === undefined) epsilon = epsilonDefault;

    const area = triangleArea(a, b, c, axis);

    return Math.abs(area) < epsilon;
}

// approximate equality for real numbers
export function equal(i, j, epsilon) {
    if (epsilon === undefined) epsilon = epsilonDefault;

    const test = false;
    if (test) {
        if (j===0) return Math.abs(i) < epsilon;
        else return Math.abs(i/j - 1) < epsilon;
    }
    else {
        return equalSimple(i, j, epsilon);
    }
}

export function equalSimple(i, j, epsilon) {
    if (i === Infinity || j === Infinity) return i === j;

    return Math.abs(i - j) < epsilon;
}

// approximate less-than testing for real numbers
export function less(i, j, epsilon) {
    if (epsilon === undefined) epsilon = epsilonDefault;
    return i < j && !equal(i, j, epsilon);
}

// approximate greater-than testing for real numbers
export function greater(i, j, epsilon) {
    if (epsilon === undefined) epsilon = epsilonDefault;
    return i > j && !equal(i, j, epsilon);
}

// standard sorting-type comparator; useful when building more complicated
// comparators because calling less() and greater() together results in two
// equal() checks
export function compare(i, j, epsilon) {
    if (epsilon === undefined) epsilon = epsilonDefault;

    if (equal(i, j, epsilon)) return 0;
    else if (i < j) return -1;
    else return 1;
}


// clamps a to [-1, 1] range and returns its acos
export function acos(a) {
    return Math.acos(clamp(a, -1, 1));
}
// clamps a to [-1, 1] range and returns its asin
export function asin(a) {
    return Math.asin(clamp(a, -1, 1));
}



// for vertex hash maps

// gets the index of a vertex in a hash map, adding it to the map and vertex
// array if necessary
// inputs:
//  map: hash map ({hash:idx} object)
//  v: vertex whose index to get, adding it to the map and array as necessary
//  vertices: array of vertices whose indices are stored in the hash map
//  p: precision factor
export function vertexMapIdx(map, v, vertices, p) {
    const hash = vertexHash(v, p);
    let idx = -1;
    if (map[hash]===undefined) {
        idx = vertices.length;
        map[hash] = idx;
        vertices.push(v);
    }
    else {
        idx = map[hash];
    }
    return idx;
}

// make a hash map of a whole array of vertices at once
export function vertexArrayToMap(map, vertices, p) {
    for (let v=0; v<vertices.length; v++) {
        map[vertexHash(vertices[v], p)] = v;
    }
}


// non-blocking iterator
// params:
//  f: function to repeat
//  n: number of times to repeat the function
//  batchSize (optional): repeat the function this many times at each iteration
//  onDone (optional): call this when done iterating
//  onProgress (optional): call this at every iteration step
//  onStop (optional): call this when the stop() function is called
// usage:
//  make a new instance with at least the first two params, call start()
export function functionIterator(f, n, batchSize, onDone, onProgress, onStop) {
    this.f = f;
    this.n = n;
    this.i = 0;
    this.batchSize = (batchSize===undefined || batchSize<1) ? 1 : batchSize;
    this.onStop = onStop;
    this.onProgress = onProgress;
    this.onDone = onDone;
    this.timer = 0;

    // begin iterating and repeat until done
    this.start = function() {
        this.i = 0;

        this.timer = setTimeout(this.iterate.bind(this), 16);
    };

    // main unit of iteration: repeatedly run f, stopping after batchSize
    // repetitions (or fewer, if we've hit n)
    this.iterate = function() {
        let i;
        const limit = this.i+this.batchSize;
        const n = this.n;
        for (i=this.i; i<limit && i<n; i++) {
            this.f(i);
        }

        this.i = i;

        if (this.onProgress) this.onProgress(i);

        if (i>=n) {
            clearTimeout(this.timer);
            if (this.onDone) this.onDone();
            return;
        }

        this.timer = setTimeout(this.iterate.bind(this), 0);
    };

    // manually terminate the iteration
    this.stop = function() {
        clearTimeout(this.timer);

        if (this.onStop) this.onStop(this.i);
    };

    // return true if there are more iterations to run
    this.running = function() {
        return this.i<this.n;
    }
}



// timer
export class Timer {
    constructor() {
        this.startTime = 0;
        this.endTime = 0;
        this.running = false;
    }

    start() {
        this.startTime = new Date();
        this.running = true;
    }

    stop() {
        this.endTime = new Date();
        this.running = false;
        return this.endTime - this.startTime;
    }

    elapsed() {
        if (this.running) return new Date() - this.startTime;
        else return this.endTime - this.startTime;
    }
}


// chart of ring inner diameters in mm
// (source: https://en.wikipedia.org/wiki/Ring_size)
export const ringSizes = {
    "    0": 11.63,
    " 0.25": 11.84,
    "  0.5": 12.04,
    " 0.75": 12.24,
    "    1": 12.45,
    " 1.25": 12.65,
    "  1.5": 12.85,
    " 1.75": 13.06,
    "    2": 13.26,
    " 2.25": 13.46,
    "  2.5": 13.67,
    " 2.75": 13.87,
    "    3": 14.07,
    " 3.25": 14.27,
    "  3.5": 14.48,
    " 3.75": 14.68,
    "    4": 14.88,
    " 4.25": 15.09,
    "  4.5": 15.29,
    " 4.75": 15.49,
    "    5": 15.7,
    " 5.25": 15.9,
    "  5.5": 16.1,
    " 5.75": 16.31,
    "    6": 16.51,
    " 6.25": 16.71,
    "  6.5": 16.92,
    " 6.75": 17.12,
    "    7": 17.32,
    " 7.25": 17.53,
    "  7.5": 17.73,
    " 7.75": 17.93,
    "    8": 18.14,
    " 8.25": 18.34,
    "  8.5": 18.54,
    " 8.75": 18.75,
    "    9": 18.95,
    " 9.25": 19.15,
    "  9.5": 19.35,
    " 9.75": 19.56,
    "   10": 19.76,
    "10.25": 19.96,
    " 10.5": 20.17,
    "10.75": 20.37,
    "   11": 20.57,
    "11.25": 20.78,
    " 11.5": 20.98,
    "11.75": 21.18,
    "   12": 21.39,
    "12.25": 21.59,
    " 12.5": 21.79,
    "12.75": 22,
    "   13": 22.2,
    "13.25": 22.4,
    " 13.5": 22.61,
    "13.75": 22.81,
    "   14": 23.01,
    "14.25": 23.22,
    " 14.5": 23.42,
    "14.75": 23.62,
    "   15": 23.83,
    "15.25": 24.03,
    " 15.5": 24.23,
    "15.75": 24.43,
    "   16": 24.64
};


// memory usage - from zensh on github: https://gist.github.com/zensh/4975495
export function memorySizeOf(obj) {
    let bytes = 0;

    function sizeOf(obj) {
        if(obj !== null && obj !== undefined) {
            switch(typeof obj) {
                case 'number':
                    bytes += 8;
                    break;
                case 'string':
                    bytes += obj.length * 2;
                    break;
                case 'boolean':
                    bytes += 4;
                    break;
                case 'object':
                    const objClass = Object.prototype.toString.call(obj).slice(8, -1);
                    if(objClass === 'Object' || objClass === 'Array') {
                        for(const key in obj) {
                            if(!obj.hasOwnProperty(key)) continue;
                            sizeOf(obj[key]);
                        }
                    } else bytes += obj.toString().length * 2;
                    break;
            }
        }
        return bytes;
    }

    function formatByteSize(bytes) {
        if(bytes < 1024) return `${bytes} bytes`;
        else if(bytes < 1048576) return `${(bytes / 1024).toFixed(3)} KiB`;
        else if(bytes < 1073741824) return `${(bytes / 1048576).toFixed(3)} MiB`;
        else return `${(bytes / 1073741824).toFixed(3)} GiB`;
    }

    return formatByteSize(sizeOf(obj));
}