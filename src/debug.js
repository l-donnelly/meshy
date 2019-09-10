import * as Utils from "./utils";

class Debug {
    constructor(scene) {
        this.scene = scene;
        this.debugPointGeo = new THREE.Geometry();
        this.debugLineGeo = new THREE.Geometry();
    }

    loop({vertex}, fn) {
        if (fn === undefined) fn = () => true;
        let curr = vertex;
        do {
            if (fn(curr)) this.point(curr.v);
            curr = curr.next;
        } while (curr != vertex);
    }

    line(v, w, n, lastonly, o, axis) {
        if (n === undefined) n = 1;
        if (lastonly === undefined) lastonly = false;
        if (o === undefined) o = 0;
        if (axis === undefined) axis = "z";

        for (let i=0; i<=n; i++) {
            if (lastonly && (n==0 || i<n-1)) continue;
            const vert = w.clone().multiplyScalar(i/n).add(v.clone().multiplyScalar((n-i)/n));
            vert.z += o;
            this.debugPointGeo.vertices.push(vert);
        }
        const vv = v.clone();
        vv.z += o;
        const ww = w.clone();
        ww.z += o;
        this.debugLineGeo.vertices.push(vv);
        this.debugLineGeo.vertices.push(ww);
        this.debugPointGeo.verticesNeedUpdate = true;
    }

    oneline(v, w, c, offset, dist) {
        if (c === undefined) c = 0xff6666;
        if (offset === undefined) offset = new THREE.Vector3();
        if (dist !== undefined) offset = offset.clone().setLength(dist);

        const vv = v.clone().add(offset);
        const ww = w.clone().add(offset);

        const geo = new THREE.Geometry();
        geo.vertices.push(vv);
        geo.vertices.push(ww);
        const mat = new THREE.LineBasicMaterial({color: c, linewidth: 1 });
        const mesh = new THREE.LineSegments(geo, mat);
        mesh.name = "debugLine";
        this.scene.add(mesh);

        //this.point(vv);
        //this.point(ww);
    }

    ray(v, r, l) {
        this.line(v, v.clone().add(r.clone().setLength(l)));
    }

    segmentPair(s, se, t, te) {
        const ms = s.clone().add(se).divideScalar(2);
        const mt = t.clone().add(te).divideScalar(2);
        this.line(ms, mt);
    }

    point(v, o, axis) {
        if (o===undefined) o = 0;
        if (axis===undefined) axis = "z";
        let vv = v;
        if (o!==0) {
            vv = v.clone();
            vv[axis] += o;
        }

        this.debugPointGeo.vertices.push(vv);
        this.debugPointGeo.verticesNeedUpdate = true;
    }

    face(f, vs) {
        const [a, b, c] = faceGetVerts(f, vs);
        this.point(a.clone().add(b).add(c).divideScalar(3));
    }

    fedges(f, vs) {
        const [a, b, c] = faceGetVerts(f, vs);
        this.oneline(a, b, 0, undefined, 0x66ff66);
        this.oneline(b, c, 0, undefined, 0x66ff66);
        this.oneline(c, a, 0, undefined, 0x66ff66);
    }

    points(idx, incr) {
        let color = 0xff6666;
        if (incr===undefined) incr = 0;
        if (idx!==undefined) {
            color = parseInt((`0.${Math.sin(idx+incr).toString().substr(6)}`)*0xffffff);
        }
        else idx = 0;
        const debugMaterial = new THREE.PointsMaterial( { color, size: 3, sizeAttenuation: false });
        const debugMesh = new THREE.Points(this.debugPointGeo, debugMaterial);
        debugMesh.name = "debug";
        this.scene.add(debugMesh);

        this.debugPointGeo = new THREE.Geometry();
    }

    lines(idx, incr) {
        let color = 0xff6666;
        if (incr===undefined) incr = 0;
        if (idx!==undefined) {
            color = parseInt((`0.${Math.sin(idx+incr).toString().substr(6)}`)*0xffffff);
            //console.log("%c idx "+idx, 'color: #'+color.toString(16));
        }
        else idx = 0;
        const debugLineMaterial = new THREE.LineBasicMaterial({color, linewidth: 1 });
        const debugLineMesh = new THREE.LineSegments(this.debugLineGeo, debugLineMaterial);
        debugLineMesh.name = "debugLine";
        this.scene.add(debugLineMesh);

        this.debugLineGeo = new THREE.Geometry();

        this.points();
    }

    cleanup() {
        Utils.removeMeshByName(this.scene, "debug");
        Utils.removeMeshByName(this.scene, "debugLine");
    }
}

export { Debug }