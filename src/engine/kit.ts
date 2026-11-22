/**
 * Building blocks for explainer dioramas. Everything is created once; per-frame animation only mutates
 * transforms / materials. Shapes are bevelled and smooth-shaded and materials are physically based with a
 * subtle surface grain (see surface.ts), so objects read as real things rather than flat CG.
 *
 * Deliberately NOT used: environment maps (IBL) and bump maps. On the CPU renderer used in CI an environment
 * map alone tripled render time, and bump maps alias into noise on faces seen at a grazing angle.
 */
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DynamicDrawUsage,
  Euler,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshStandardMaterialParameters,
  Object3D,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { bevelBoxGeometry, grainTexture, worldUV } from "./surface";
import { clamp, lerp, rng, sway } from "./math";
import type { Vec3 } from "./types";

/** Physically plausible looks. `grain` adds the shared surface texture (subtle albedo + roughness variation). */
const SURFACES = {
  /** Painted wall, soil, concrete, wood, fabric. */
  matte: { roughness: 0.82, metalness: 0, grain: true },
  /** Coated plastic, car paint, ceramic. */
  gloss: { roughness: 0.28, metalness: 0, grain: false },
  /** Steel, aluminium, pipes, machinery. */
  metal: { roughness: 0.36, metalness: 0.6, grain: true }, // < 1: there is no environment map to reflect
  /** Windows, solar panel faces, screens. */
  glass: { roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.45, grain: false },
  /** Water surfaces and volumes. */
  water: { roughness: 0.08, metalness: 0, transparent: true, opacity: 0.82, grain: false },
} as const;
export type Surface = keyof typeof SURFACES;

/** Options for `Kit.figure` — a wooden-toy person. */
export type FigureOpts = {
  /** "anak" is smaller, "lansia" slightly smaller with grey hair in a bun. Default "dewasa". */
  age?: "anak" | "dewasa" | "lansia";
  /** Colour of the shirt (and of the kerudung, when worn). */
  top?: string;
  /** Colour of the kain / skirt. */
  bottom?: string;
  skin?: string;
  hair?: string;
  headwear?: "none" | "caping" | "mahkota" | "ikat" | "kerudung";
  /** Extra costume trim: "selempang" (sash), "rompi" (open vest) or "none". */
  costume?: "none" | "selempang" | "rompi";
  /** Trim colour for the sash / vest edge / crown band. Defaults to warm gold. */
  trim?: string;
};

/** Recognisable wooden-toy story prop. */
export type PropKind = "lantern" | "crate" | "pot" | "torch" | "scroll" | "rock" | "flower";

/** Per-line acting presets for `poseFigure`. */
export type PoseMode = "idle" | "talk" | "walk" | "wave" | "sad" | "point";

/** The animatable parts `Kit.figure` returns. */
export type FigureParts = {
  root: Group;
  torso: Group;
  head: Group;
  blink: Group;
  armL: Group;
  armR: Group;
  legL: Group;
  legR: Group;
};

/** Options for `Kit.animal` — one generic four-legged animal. */export type AnimalOpts = {
  s?: number;
  color?: string;
  ears?: "bulat" | "runcing" | "panjang";
  horns?: boolean;
  tail?: "pendek" | "panjang";
  stripes?: boolean;
};

export class Kit {
  private cache = new Map<string, MeshStandardMaterial>();
  constructor(public root: Object3D) {}

  /**
   * Cached PBR material. Second argument is a surface preset ("matte" default, "gloss", "metal", "glass",
   * "water") or raw MeshStandardMaterial parameters (which start from "matte" without grain).
   */
  mat(color: string, o: Surface | MeshStandardMaterialParameters = "matte") {
    const k = color + JSON.stringify(o);
    let m = this.cache.get(k);
    if (!m) {
      const { grain, ...preset } = typeof o === "string" ? SURFACES[o] : { ...SURFACES.matte, grain: false, ...o };
      m = new MeshStandardMaterial({ color, ...preset });
      if (grain) {
        m.map = grainTexture();
      }
      this.cache.set(k, m);
    }
    return m;
  }

  private resolve(m: string | Material) {
    return typeof m === "string" ? this.mat(m) : m;
  }

  add<T extends Mesh>(mesh: T, parent: Object3D = this.root, castShadow = true) {
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /**
   * Standard outdoor light rig: sky/ground hemisphere + warm sun with soft shadows + cool rim fill.
   * Call once per world instead of hand-placing lights. `reach` = half-size of the area that must receive
   * shadows (keep it tight: a smaller area means sharper shadows).
   */
  lights({ sun = [9, 16, 12], reach = 16, intensity = 2.6 }: { sun?: Vec3; reach?: number; intensity?: number } = {}) {
    this.root.add(new HemisphereLight("#dbe9ff", "#a08a6c", 0.45));
    const key = new DirectionalLight("#ffe2bd", intensity);
    key.position.set(...sun);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const cam = key.shadow.camera;
    cam.left = cam.bottom = -reach;
    cam.right = cam.top = reach;
    cam.near = 0.5;
    cam.far = Math.hypot(...sun) + reach * 2;
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.03;
    this.root.add(key);
    const rim = new DirectionalLight("#bcd2ff", 0.5);
    rim.position.set(-sun[0] * 1.3, sun[1] * 0.45, sun[2] * 0.6);
    this.root.add(rim);
    return key;
  }

  /** Axis-aligned box from min/max corners, with softly bevelled edges that catch the light. */
  box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: string | Material, parent?: Object3D) {
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const bevel = Math.min(0.035, Math.min(w, h, d) * 0.25);
    const b = new Mesh(worldUV(bevelBoxGeometry(w, h, d, bevel)), this.resolve(m));
    b.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return this.add(b, parent);
  }

  /** Smooth upright cylinder (pipe, pole, tank, silo) centred at x/z, standing on y0. `rTop` tapers it. */
  cyl(x: number, y0: number, z: number, r: number, h: number, m: string | Material, parent?: Object3D, rTop = r) {
    const c = new Mesh(worldUV(new CylinderGeometry(rTop, r, h, 28)), this.resolve(m));
    c.position.set(x, y0 + h / 2, z);
    return this.add(c, parent);
  }

  /** Smooth sphere (tank dome, lamp, ball, head). */
  ball(x: number, y: number, z: number, r: number, m: string | Material, parent?: Object3D) {
    const s = new Mesh(new SphereGeometry(r, 28, 20), this.resolve(m));
    s.position.set(x, y, z);
    return this.add(s, parent);
  }

  /** Box whose top surface can move (water levels). Call .set(y1) every frame. */
  level(x0: number, x1: number, y0: number, z0: number, z1: number, m: Material) {
    const b = new Mesh(new BoxGeometry(1, 1, 1), m);
    b.receiveShadow = true;
    this.root.add(b);
    return Object.assign(b, {
      set: (y1: number) => {
        const h = Math.max(0.001, y1 - y0);
        b.scale.set(x1 - x0, h, z1 - z0);
        b.position.set((x0 + x1) / 2, y0 + h / 2, (z0 + z1) / 2);
        b.visible = y1 > y0 + 0.005;
      },
    });
  }

  house(x: number, z: number, s: number, ry: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = ry;
    const walls = ["#f2ece0", "#efe6d2", "#e9efe9", "#f3e4d6"];
    const roofs = ["#c4473a", "#b5523c", "#a94434"];
    const k = Math.floor(Math.abs(x * 7 + z * 3));
    this.box(-0.45, 0.45, 0, 0.6, -0.4, 0.4, walls[k % 4], g);
    this.box(-0.48, 0.48, 0, 0.06, -0.43, 0.43, "#9a968c", g); // plinth
    const roof = this.add(new Mesh(new ConeGeometry(0.78, 0.45, 4), this.mat(roofs[k % 3], { flatShading: true })), g);
    roof.position.y = 0.82;
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, 0.9);
    this.box(-0.09, 0.09, 0, 0.32, 0.39, 0.415, "#5a4636", g); // door
    const pane = this.mat("#8fb6cf", { roughness: 0.08, metalness: 0.4 });
    for (const wx of [-0.29, 0.29]) {
      this.box(wx - 0.085, wx + 0.085, 0.27, 0.45, 0.395, 0.412, "#fbfaf6", g); // frame
      this.box(wx - 0.065, wx + 0.065, 0.29, 0.43, 0.4, 0.416, pane, g);
    }
    this.root.add(g);
    return g;
  }

  tree(x: number, z: number, s: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const r = rng(Math.round(x * 131 + z * 17));
    this.cyl(0, 0, 0, 0.085, 0.55, "#6f5238", g, 0.055);
    const greens = ["#4f8a4a", "#5d9a52", "#437a43"];
    // canopy = a few overlapping faceted clumps -> irregular silhouette instead of one ball
    for (const [dx, dy, dz, cr] of [[0, 0.82, 0, 0.36], [0.2, 0.7, 0.08, 0.26], [-0.18, 0.72, -0.1, 0.27], [0.02, 1.04, -0.04, 0.24]] as const) {
      const clump = this.add(new Mesh(new IcosahedronGeometry(cr, 1), this.mat(greens[Math.floor(r() * 3)], { flatShading: true })), g);
      clump.position.set(dx + (r() - 0.5) * 0.08, dy, dz + (r() - 0.5) * 0.08);
      clump.rotation.set(r() * 3, r() * 3, r() * 3);
    }
    this.root.add(g);
    return g;
  }

  /** Worker in orange vest + yellow helmet. */
  worker(x: number, z: number, ry: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    const limb = (lx: number, y: number, r: number, len: number, color: string) => {
      const l = this.add(new Mesh(new CapsuleGeometry(r, len, 4, 12), this.mat(color)), g);
      l.position.set(lx, y, 0);
      return l;
    };
    for (const lx of [-0.055, 0.055]) limb(lx, 0.17, 0.045, 0.25, "#2e3a4d"); // legs
    limb(0, 0.47, 0.1, 0.13, "#f08a24").scale.set(1.15, 1, 0.75); // vest
    for (const lx of [-0.15, 0.15]) limb(lx, 0.45, 0.035, 0.2, "#f08a24"); // arms
    this.ball(0, 0.72, 0, 0.095, "#d9a37c", g);
    const helmet = this.add(new Mesh(new SphereGeometry(0.108, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), this.mat("#f2c230", "gloss")), g);
    helmet.position.y = 0.745;
    this.root.add(g);
    return g;
  }

  // ---------------------------------------------------------------------------------------------
  // Nusantara Figurine diorama prefabs (storytelling channels). Warm rounded shapes & cartoon eyes.
  // The returned parts (head, arms, legs, wings, tail) are pivoted at the joint, so rotating them in
  // update(t) moves them the way the real limb would.
  // ---------------------------------------------------------------------------------------------

  /** Mesh from a raw geometry, placed inside `parent`. */
  private part(geo: BufferGeometry, m: string | Material, parent: Object3D, pos: Vec3, scale?: Vec3, rot?: Vec3) {
    const mesh = this.add(new Mesh(geo, this.resolve(m)), parent);
    mesh.position.set(...pos);
    if (scale) mesh.scale.set(...scale);
    if (rot) mesh.rotation.set(...rot);
    return mesh;
  }

  private pivot(parent: Object3D, pos: Vec3) {
    const g = new Group();
    g.position.set(...pos);
    parent.add(g);
    return g;
  }

  /** Expressive cartoon eye (sclera + pupil + specular catchlight) for animals, birds and swimmers. */
  private creatureEye(parent: Object3D, pos: Vec3, r: number, sxSign = 1) {
    const sclera = this.mat("#fdfbf7", "gloss");
    const pupil = this.mat("#241d19", "gloss");
    const dot = this.mat("#ffffff", "gloss");
    this.part(new SphereGeometry(r, 12, 10), sclera, parent, pos, [0.95, 1.12, 0.6]);
    this.part(new SphereGeometry(r * 0.65, 10, 8), pupil, parent, [pos[0], pos[1], pos[2] + r * 0.36], [0.95, 1.08, 0.65]);
    this.part(new SphereGeometry(r * 0.26, 8, 6), dot, parent, [pos[0] + sxSign * r * 0.22, pos[1] + r * 0.3, pos[2] + r * 0.64]);
  }

  /**
   * Cartoon face on a head of radius `r` centred at `c` (looking down +z): white eye + pupil + specular dot,
   * rounded brows, soft blush, small button nose, and a surface-hugging TubeGeometry smile.
   */
  private face(parent: Object3D, c: Vec3, r: number, o: { blush?: boolean; brows?: boolean; child?: boolean; eyesTo?: Object3D } = {}) {
    const sclera = this.mat("#fdfbf7", "gloss");
    const pupil = this.mat("#241d19", "gloss");
    const dot = this.mat("#ffffff", "gloss");
    const eyes = o.eyesTo ?? parent;
    const eyeScale = o.child ? 1.05 : 0.92;
    const eyeY = c[1] + (o.child ? 0 : r * 0.02);
    for (const sx of [-1, 1]) {
      const ex = c[0] + sx * r * 0.35;
      const ey = eyeY;
      const ez = c[2] + r * 0.84;
      this.part(new SphereGeometry(r * 0.185 * eyeScale, 14, 10), sclera, eyes, [ex, ey, ez], [1, 1.15, 0.48]);
      this.part(new SphereGeometry(r * 0.12 * eyeScale, 12, 10), pupil, eyes, [ex + sx * r * 0.01, ey - r * 0.01, ez + r * 0.07], [1, 1.1, 0.55]);
      this.part(new SphereGeometry(r * 0.045 * eyeScale, 8, 7), dot, eyes, [ex + sx * r * 0.045, ey + r * 0.055, ez + r * 0.12]);
      if (o.brows) {
        this.part(new CapsuleGeometry(r * 0.02, r * 0.16, 4, 8), "#3a2a22", parent, [ex, ey + r * 0.28 * eyeScale, ez + r * 0.07], undefined, [0, 0, Math.PI / 2 - sx * 0.1]);
      }
      if (o.blush) {
        this.part(new SphereGeometry(r * 0.105, 10, 8), "#eba090", parent, [c[0] + sx * r * 0.54, eyeY - r * 0.23, c[2] + r * 0.72], [1.1, 0.65, 0.2]);
      }
    }
    this.part(new SphereGeometry(r * 0.072, 12, 10), "#d99e74", parent, [c[0], eyeY - r * 0.15, c[2] + r * 0.98], [1.1, 0.85, 0.85]);
    const smilePts: Vector3[] = [];
    for (let i = -2; i <= 2; i++) {
      const u = i / 2;
      const ang = u * 0.31;
      const sx = Math.sin(ang) * r * 0.94;
      const sy = eyeY - r * 0.35 + u * u * r * 0.075;
      // project onto the [0.96, 1.04, 0.98] head ellipsoid so ends sit flush without jutting out
      const nx = sx / (0.96 * r);
      const ny = (sy - c[1]) / (1.04 * r);
      const sz = 0.98 * r * Math.sqrt(Math.max(0.01, 1 - nx * nx - ny * ny));
      smilePts.push(new Vector3(c[0] + sx, sy, c[2] + sz));
    }
    this.part(new TubeGeometry(new CatmullRomCurve3(smilePts), 10, r * 0.016, 6, false), "#7a3f32", parent, [0, 0, 0]);
  }

  /**
   * Nusantara Figurine person standing on the ground at x/z, facing +z when ry = 0. ~1 unit tall as an adult.
   * Body parts are separate meshes on pivots (`armL`, `armR`, `legL`, `legR`, `head`, `torso`), so swinging a
   * limb in update(t) moves the way a real joint would; headwear and colours carry across shots unchanged.
   */
  figure(x: number, z: number, ry: number, o: FigureOpts = {}) {
    const { age = "dewasa", top = "#c2573f", bottom = "#7a4a33", skin = "#e3b48d", headwear = "none" } = o;
    const costume = o.costume ?? "none";
    const trim = o.trim ?? "#e2b23c";
    const hair = o.hair ?? (age === "lansia" ? "#d8d4ce" : "#2c221d");
    const root = new Group();
    root.position.set(x, 0, z);
    root.rotation.y = ry;
    root.scale.setScalar(age === "anak" ? 0.78 : age === "lansia" ? 0.95 : 1);

    // torso pivoted at waist height y = 0.35 so poseFigure bends naturally without tilting the skirt
    const torso = this.pivot(root, [0, 0.35, 0]);
    this.part(new CylinderGeometry(0.13, 0.17, 0.36, 22), top, torso, [0, 0.19, 0]);
    this.part(new SphereGeometry(0.14, 18, 12), top, torso, [0, 0.35, 0], [1, 0.45, 0.88]);
    this.part(new SphereGeometry(0.168, 18, 12), bottom, torso, [0, 0.02, 0], [1, 0.65, 0.88]);
    this.part(new CylinderGeometry(0.048, 0.06, 0.09, 14), skin, torso, [0, 0.41, 0]);
    if (headwear !== "kerudung") {
      this.part(new TorusGeometry(0.074, 0.016, 10, 20), "#f5efe2", torso, [0, 0.38, 0.008], undefined, [Math.PI / 2, 0, 0]);
    }
    if (costume === "selempang") {
      this.part(new BoxGeometry(0.076, 0.34, 0.024), trim, torso, [0.005, 0.195, 0.152], undefined, [0, 0, 0.62]);
      this.part(new BoxGeometry(0.022, 0.34, 0.026), "#f4e7c8", torso, [0.005, 0.195, 0.153], undefined, [0, 0, 0.62]);
    } else if (costume === "rompi") {
      for (const sx of [-1, 1]) {
        this.part(new BoxGeometry(0.072, 0.29, 0.028), bottom, torso, [sx * 0.072, 0.19, 0.142], undefined, [0, 0, -sx * 0.08]);
        this.part(new BoxGeometry(0.011, 0.29, 0.03), trim, torso, [sx * 0.038, 0.19, 0.144], undefined, [0, 0, -sx * 0.08]);
      }
    }

    const leg = (px: number) => {
      const g = this.pivot(root, [px, 0.34, 0]);
      this.part(new CapsuleGeometry(0.052, 0.2, 6, 12), bottom, g, [0, -0.16, 0]);
      this.part(new CapsuleGeometry(0.048, 0.05, 6, 10), "#4d3d36", g, [0, -0.3, 0.025], undefined, [Math.PI / 2, 0, 0]);
      return g;
    };
    const legL = leg(-0.072), legR = leg(0.072);
    if (headwear === "kerudung") {
      // Skirt stays on root with top radius 0.172 so torso waist tilts cleanly inside without rim clipping
      this.part(new CylinderGeometry(0.172, 0.215, 0.38, 22), bottom, root, [0, 0.19, 0]);
    }

    const arm = (sx: number) => {
      const g = this.pivot(root, [sx * 0.148, 0.67, 0]);
      g.rotation.z = sx * 0.18;
      this.part(new CapsuleGeometry(0.042, 0.18, 6, 12), top, g, [0, -0.105, 0]);
      this.part(new SphereGeometry(0.046, 14, 10), skin, g, [0, -0.225, 0]);
      return g;
    };
    const armL = arm(-1), armR = arm(1);

    const head = this.pivot(root, [0, 0.91, 0]);
    const hc: Vec3 = [0, 0, 0];
    const r = 0.19;
    this.part(new SphereGeometry(r, 22, 16), skin, head, hc, [0.96, 1.04, 0.98]);
    // eyes live on their own pivot so a blink is `blink.scale.y = 0.1` instead of a rebuild
    const blink = this.pivot(head, hc);
    this.face(head, hc, r, { blush: true, brows: true, child: age === "anak", eyesTo: blink });

    if (headwear === "kerudung") {
      this.part(new SphereGeometry(r * 1.03, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48), "#efe6d6", head, [0, 0.02, -0.005], [0.97, 1.02, 0.98], [-0.38, 0, 0]);
      this.part(new SphereGeometry(r * 1.12, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), top, head, [0, 0.018, -0.028], [0.99, 1.06, 1.04], [-0.56, 0, 0]);
      this.part(new TorusGeometry(r * 0.82, 0.036, 10, 22, Math.PI * 1.15), top, head, [0, -0.07, 0.02], [0.98, 0.95, 0.92], [-0.55, 0, Math.PI * 0.925]);
      this.part(new CylinderGeometry(0.128, 0.165, 0.18, 20), top, torso, [0.01, 0.27, 0.025], [0.95, 1.0, 0.85], [0.12, 0, -0.18]);
      this.part(new ConeGeometry(0.165, 0.36, 18), top, torso, [-0.01, 0.22, -0.055], [0.98, 1.0, 0.6], [-0.14, 0, 0.06]);
    } else {
      this.part(new SphereGeometry(r * 1.065, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), hair, head, [0, 0.012, -0.022], [0.98, 1.04, 1.03], [-0.55, 0, 0]);
      this.part(new SphereGeometry(r * 0.72, 16, 10), hair, head, [0, -0.07, -0.085], [1.1, 0.85, 0.85]);
      if (age === "anak") {
        // Jambul Ceria: sculpted front hair sweep + playful top cowlick tufts + temple locks
        this.part(new SphereGeometry(0.11, 16, 12), hair, head, [-0.03, 0.145, 0.06], [1.15, 0.55, 0.8], [0.25, 0.1, 0.2]);
        this.part(new CapsuleGeometry(0.038, 0.065, 6, 10), hair, head, [0.02, 0.215, 0.05], undefined, [0.55, 0, -0.45]);
        this.part(new CapsuleGeometry(0.03, 0.055, 6, 10), hair, head, [-0.05, 0.205, 0.07], undefined, [0.6, 0, 0.35]);
        for (const sx of [-1, 1]) this.part(new CapsuleGeometry(0.024, 0.045, 4, 8), hair, head, [sx * 0.165, 0.015, 0.02], undefined, [0.1, 0, sx * 0.15]);
      } else {
        this.part(new SphereGeometry(0.115, 16, 12), hair, head, [-0.03, 0.135, 0.08], [1.15, 0.45, 0.72], [0.2, 0, 0.22]);
        if (age === "lansia") {
          this.part(new SphereGeometry(0.088, 16, 12), hair, head, [0, 0.01, -0.21], [1.0, 0.95, 0.88]);
          this.part(new CylinderGeometry(0.008, 0.008, 0.22, 8), "#c89b3c", head, [0, 0.02, -0.22], undefined, [0, 0, 0.9]);
        }
      }
    }

    if (headwear === "caping") {
      this.part(new CylinderGeometry(0.182, 0.188, 0.055, 22), "#4e3b2c", head, [0, 0.125, -0.005]);
      this.part(new ConeGeometry(0.32, 0.145, 24), "#dbb468", head, [0, 0.21, -0.01], undefined, [-0.06, 0, 0]);
      this.part(new TorusGeometry(0.315, 0.012, 8, 24), "#a98242", head, [0, 0.138, -0.01], undefined, [Math.PI / 2 - 0.06, 0, 0]);
    } else if (headwear === "mahkota") {
      const gold = this.mat("#e4b53e", "gloss");
      this.part(new CylinderGeometry(0.145, 0.125, 0.07, 22), gold, head, [0, 0.195, -0.005]);
      this.part(new TorusGeometry(0.126, 0.014, 8, 22), gold, head, [0, 0.162, -0.005], undefined, [Math.PI / 2, 0, 0]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        this.part(new ConeGeometry(0.03, 0.065, 8), gold, head, [Math.sin(a) * 0.128, 0.255, Math.cos(a) * 0.128 - 0.005]);
      }
      this.part(new SphereGeometry(0.025, 10, 8), this.mat("#c93434", "gloss"), head, [0, 0.198, 0.132]);
    } else if (headwear === "ikat") {
      this.part(new CylinderGeometry(0.188, 0.194, 0.062, 22), "#a8342a", head, [0, 0.095, -0.005], [0.98, 1, 1.02]);
      this.part(new ConeGeometry(0.05, 0.075, 10), "#a8342a", head, [0.04, 0.145, 0.165], [1.3, 1, 0.5], [0.2, 0, -0.15]);
      this.part(new SphereGeometry(0.038, 12, 10), "#bf4236", head, [0, 0.09, -0.195]);
      for (const sx of [-1, 1]) this.part(new CapsuleGeometry(0.016, 0.08, 4, 8), "#a8342a", head, [sx * 0.036, 0.035, -0.2], undefined, [0.15, 0, sx * 0.45]);
    }

    this.root.add(root);
    return { root, torso, head, blink, armL, armR, legL, legR };
  }

  /** Soft low-poly cloud that drifts across the sky; `sway` it in update(t). */
  cloud(x: number, y: number, z: number, s = 1) {
    const g = new Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    const r = rng(Math.round(x * 71 + z * 29));
    for (const [dx, dy, dz, cr] of [[0, 0, 0, 0.6], [0.5, 0.08, 0.1, 0.44], [-0.48, 0.04, -0.08, 0.4], [0.1, 0.24, -0.05, 0.36]] as const) {
      const clump = this.add(new Mesh(new IcosahedronGeometry(cr, 1), this.mat(r() > 0.5 ? "#f2f4f6" : "#e2e8ee", { flatShading: true })), g, false);
      clump.position.set(dx, dy, dz);
      clump.rotation.set(r() * 3, r() * 3, r() * 3);
    }
    this.root.add(g);
    return g;
  }

  /** Concentric water rings. `setPhase(u)` expands and fades them; drive it from t so it never repeats. */
  ripple(x: number, z: number, maxR = 1.4, color = "#eaf6fb") {
    const root = new Group();
    root.position.set(x, 0.02, z);
    const rings: { mesh: Mesh; mat: MeshBasicMaterial }[] = [];
    for (let i = 0; i < 3; i++) {
      const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5, depthWrite: false });
      const mesh = new Mesh(new TorusGeometry(maxR * 0.5, 0.02, 6, 28), mat);
      mesh.rotation.x = -Math.PI / 2;
      root.add(mesh);
      rings.push({ mesh, mat });
    }
    this.root.add(root);
    return {
      root,
      setPhase: (u: number) => {
        rings.forEach(({ mesh, mat }, i) => {
          const p = (u + i / 3) % 1;
          mesh.scale.setScalar(0.3 + p * 1.4);
          mat.opacity = 0.55 * (1 - p);
        });
      },
    };
  }

  /** Recognisable wooden-toy story prop instead of a bare box. */
  prop(kind: PropKind, x: number, y: number, z: number, s = 1) {
    const g = new Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    switch (kind) {
      case "lantern": {
        this.box(-0.09, 0.09, 0, 0.3, -0.09, 0.09, "#6b4a2c", g);
        const glow = this.ball(0, 0.16, 0, 0.075, this.glowMat("#ffd98a", "#ffb03a"), g);
        glow.castShadow = false;
        this.box(-0.11, 0.11, 0.3, 0.34, -0.11, 0.11, "#4a3220", g);
        break;
      }
      case "crate":
        this.box(-0.2, 0.2, 0, 0.4, -0.2, 0.2, "#b98a5a", g);
        for (const yy of [0.08, 0.32]) this.box(-0.21, 0.21, yy, yy + 0.05, -0.21, 0.21, "#8a6540", g);
        break;
      case "pot":
        this.cyl(0, 0, 0, 0.16, 0.24, "#c4713f", g, 0.2);
        this.ball(0, 0.3, 0, 0.14, "#5d9a52", g);
        break;
      case "torch":
        this.cyl(0, 0, 0, 0.035, 0.5, "#6b4a2c", g);
        this.part(new ConeGeometry(0.1, 0.26, 12), "#f08a24", g, [0, 0.62, 0]);
        this.part(new ConeGeometry(0.055, 0.16, 12), "#ffd066", g, [0, 0.66, 0]);
        break;
      case "scroll":
        this.cyl(-0.14, 0.03, 0, 0.045, 0.28, "#e8dcc0", g);
        this.cyl(0.14, 0.03, 0, 0.045, 0.28, "#e8dcc0", g);
        this.box(-0.14, 0.14, 0.03, 0.05, -0.13, 0.13, "#fbf3de", g);
        break;
      case "rock":
        this.part(new IcosahedronGeometry(0.18, 0), "#8d8f8a", g, [0, 0.1, 0]);
        this.part(new IcosahedronGeometry(0.11, 0), "#a3a59f", g, [0.2, 0.06, 0.08]);
        break;
      case "flower":
        this.cyl(0, 0, 0, 0.015, 0.3, "#4f8a4a", g);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          this.ball(Math.cos(a) * 0.055, 0.32, Math.sin(a) * 0.055, 0.035, "#e8a2c0", g);
        }
        this.ball(0, 0.33, 0, 0.03, "#ffd066", g);
        break;
    }
    this.root.add(g);
    return g;
  }

  /** Round diorama base: a disc of sand or grass on a thick soil rim. Top surface is y = 0. */
  island(x: number, z: number, r: number, ground: "pasir" | "rumput" = "rumput") {
    const g = new Group();
    g.position.set(x, 0, z);
    this.part(new CylinderGeometry(r, r * 0.94, 0.36, 64), "#a57c50", g, [0, -0.2, 0]);
    this.part(new CylinderGeometry(r * 1.005, r * 1.005, 0.05, 64), ground === "pasir" ? "#ecd9a6" : "#7fae5b", g, [0, -0.025, 0]);
    this.root.add(g);
    return g;
  }

  /**
   * Sunset sky dome: one inward-facing sphere with a vertical gradient (no IBL, no post-processing).
   * `top` is the zenith colour, `horizon` the warm band behind the mountains. One mesh per scene.
   */
  sky(top = "#8fb6d8", horizon = "#f7c98b", radius = 60) {
    const geo = new SphereGeometry(radius, 32, 20);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const a = new Color(top);
    const b = new Color(horizon);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      // 0 at the horizon, 1 at the zenith
      // the camera only ever sees a slice near the horizon: keep the warm band low and narrow so the
      // zenith blue does not blend into a grey band across the top of the frame
      const u = Math.max(0, Math.min(1, (pos.getY(i) / radius + 0.06) / 0.55));
      c.copy(b).lerp(a, Math.pow(u, 1.7));
      // vertex colours are consumed as linear; without this the sky renders washed out
      const lin = c.clone().convertSRGBToLinear();
      colors[i * 3] = lin.r;
      colors[i * 3 + 1] = lin.g;
      colors[i * 3 + 2] = lin.b;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    // Basic material: the sky must not be lit or shaded by the scene lights.
    const mesh = new Mesh(geo, new MeshBasicMaterial({ vertexColors: true, side: BackSide, depthWrite: false, toneMapped: false }));
    mesh.frustumCulled = false;
    this.root.add(mesh);
    return mesh;
  }

  /**
   * Receding mountain range for depth: one call places `count` faceted cones on an arc behind the scene,
   * each paler and flatter with distance (aerial perspective without fog or an env map).
   */
  range(x: number, z: number, o: { count?: number; spread?: number; scale?: number; depth?: number; near?: string; far?: string } = {}) {
    const { count = 5, spread = 26, scale = 3.4, depth = 14, near = "#5d8a4f", far = "#a9b8a0" } = o;
    const g = new Group();
    g.position.set(x, 0, z);
    const a = new Color(near).convertSRGBToLinear();
    const b = new Color(far).convertSRGBToLinear();
    const c = new Color();
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0 : i / (count - 1);
      const px = (u - 0.5) * spread + (i % 2 ? 1.6 : -1.2);
      const pz = -u * depth;
      const s = scale * (1 - u * 0.35);
      c.copy(a).lerp(b, u);
      const m = this.add(new Mesh(new ConeGeometry(s, s * 1.25, 7), new MeshStandardMaterial({ color: c.clone(), flatShading: true, roughness: 0.9 })));
      m.position.set(px, s * 0.62, pz);
      m.rotation.y = u * 2.1;
      g.add(m);
    }
    this.root.add(g);
    return g;
  }

  /**
   * Grass tufts, scattered deterministically inside a disc. One InstancedMesh per colour, so a hundred tufts
   * cost a handful of draw calls instead of a hundred meshes (the CPU renderer is fill-rate bound).
   */
  grass(x: number, z: number, r: number, o: { count?: number; seed?: number; color?: string; scale?: number } = {}) {
    const { count = 90, seed = 11, color = "#6f9f4c", scale = 1 } = o;
    const rnd = rng(seed);
    // a flattened cone reads as a blade of grass; a round one reads as a tiny fir tree
    const blade = new ConeGeometry(0.03, 0.15, 4);
    blade.scale(1, 1, 0.32);
    const mesh = new InstancedMesh(blade, this.mat(color, { flatShading: true }), count);
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = false; // hundreds of tiny shadow casters cost more than they add
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    for (let i = 0; i < count; i++) {
      const ang = rnd() * Math.PI * 2;
      const rad = Math.sqrt(rnd()) * r;
      const s = (0.55 + rnd() * 0.5) * scale;
      setInstance(mesh, i, x + Math.cos(ang) * rad, 0.04 * s, z + Math.sin(ang) * rad, s, new Euler(0, rnd() * Math.PI, (rnd() - 0.5) * 0.55));
    }
    this.root.add(mesh);
    return mesh;
  }

  /** Winding dirt path: a chain of overlapping flat discs laid on the ground from one point to another. */
  path(x0: number, z0: number, x1: number, z1: number, o: { width?: number; color?: string; steps?: number } = {}) {
    const { width = 0.5, color = "#b99468", steps = 24 } = o;
    const g = new Group();
    const m = this.mat(color);
    for (let i = 0; i < steps; i++) {
      const u = i / (steps - 1);
      const wobble = Math.sin(u * 4.5) * 0.4;
      const px = lerp(x0, x1, u) + wobble;
      const pz = lerp(z0, z1, u);
      // slightly wider at the near end so the path reads as receding, not as a row of coins
      const w = width * (0.78 + 0.3 * (1 - u));
      const disc = this.add(new Mesh(new CylinderGeometry(w, w, 0.02, 14), m));
      disc.position.set(px, 0.012, pz);
      disc.scale.z = 1.35;
      g.add(disc);
    }
    this.root.add(g);
    return g;
  }

  /** Low bush: three faceted clumps, cheaper than a tree and good for filling the middle distance. */
  bush(x: number, z: number, s = 1, color = "#4f8a4a") {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    for (const [dx, dz, cr] of [[0, 0, 0.34], [0.26, 0.1, 0.24], [-0.22, -0.12, 0.22]] as const) {
      const c = this.add(new Mesh(new IcosahedronGeometry(cr, 1), this.mat(color, { flatShading: true })), g);
      c.position.set(dx, cr * 0.72, dz);
      c.rotation.set(dx * 3, dz * 5, cr * 4);
    }
    this.root.add(g);
    return g;
  }

  /** Coconut palm with a leaning trunk. */
  palm(x: number, z: number, s: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const r = rng(Math.round(x * 97 + z * 31));
    const lean = 0.1 + r() * 0.08;
    g.rotation.y = r() * Math.PI * 2;
    let px = 0, py = 0;
    for (let i = 0; i < 6; i++) {
      const a = lean * i * 0.5;
      this.part(new CylinderGeometry(0.05 - i * 0.004, 0.058 - i * 0.004, 0.24, 16), i % 2 ? "#8a6a48" : "#7a5c3e", g, [px, py + 0.11, 0], undefined, [0, 0, -a]);
      px += Math.sin(a) * 0.22;
      py += Math.cos(a) * 0.22;
    }
    const crown = this.pivot(g, [px, py, 0]);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + r() * 0.3;
      const leaf = this.pivot(crown, [0, 0, 0]);
      leaf.rotation.set(0, a, -0.42 - r() * 0.25);
      this.part(new SphereGeometry(0.3, 16, 10), this.mat(i % 2 ? "#4f9a55" : "#5fae62", { flatShading: true }), leaf, [0.3, 0, 0], [1, 0.1, 0.3]);
    }
    for (const [cx, cz] of [[0.06, 0.03], [-0.04, 0.05]] as const) this.ball(px + cx, py - 0.07, cz, 0.05, "#6b4a2c", g);
    this.root.add(g);
    return g;
  }

  /** Wooden boat floating at water level y = 0, bow toward +x when ry = 0. */
  boat(x: number, z: number, s: number, ry: number, sail = true) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = ry;
    this.part(new SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), "#9c5a2e", g, [0, 0.16, 0], [1, 0.42, 0.4]);
    this.part(new CylinderGeometry(0.8, 0.8, 0.04, 32), "#b97440", g, [0, 0.16, 0], [1, 1, 0.4]);
    this.cyl(0.05, 0.16, 0, 0.028, 0.95, "#6e3f1f", g);
    if (sail) {
      this.part(new ConeGeometry(0.44, 0.78, 4), this.mat("#fbf1dc", { flatShading: true }), g, [0.07, 0.72, 0], [1.2, 1, 0.05]);
    }
    this.root.add(g);
    return g;
  }

  /** Faceted mountain; `volcano` flattens the top and adds a glowing crater. */
  mountain(x: number, z: number, s: number, volcano = false) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    const r = rng(Math.round(x * 53 + z * 11));
    g.rotation.y = r() * Math.PI;
    if (volcano) {
      this.part(new CylinderGeometry(0.26, 1, 1.25, 8), this.mat("#6b5f55", { flatShading: true }), g, [0, 0.625, 0]);
      this.part(new CylinderGeometry(0.62, 1.02, 0.5, 8), this.mat("#5f8251", { flatShading: true }), g, [0, 0.25, 0]);
      this.part(new CylinderGeometry(0.2, 0.2, 0.03, 20), this.mat("#ef6a2c", "gloss"), g, [0, 1.25, 0]);
    } else {
      this.part(new ConeGeometry(1, 1.4, 8), this.mat("#6a8f58", { flatShading: true }), g, [0, 0.7, 0]);
      this.part(new ConeGeometry(0.62, 0.9, 7), this.mat("#587c4b", { flatShading: true }), g, [0.62, 0.45, 0.2]);
    }
    this.root.add(g);
    return g;
  }

  /** Small stilt house with a thatched roof; door faces +z when ry = 0. */
  hut(x: number, z: number, s: number, ry: number) {
    const g = new Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.rotation.y = ry;
    for (const sx of [-0.36, 0.36]) for (const sz of [-0.3, 0.3]) this.cyl(sx, 0, sz, 0.035, 0.28, "#6e4f33", g);
    this.box(-0.46, 0.46, 0.26, 0.32, -0.4, 0.4, "#8a6a48", g); // floor
    this.box(-0.4, 0.4, 0.32, 0.72, -0.34, 0.34, "#dcbb84", g); // woven walls
    this.box(-0.09, 0.09, 0.32, 0.6, 0.33, 0.352, "#5a4030", g); // door
    this.part(new ConeGeometry(0.74, 0.5, 4), this.mat("#8c6c3e", { flatShading: true }), g, [0, 0.96, 0], [1, 1, 0.86], [0, Math.PI / 4, 0]);
    this.box(-0.06, 0.06, 0, 0.3, 0.42, 0.46, "#6e4f33", g).rotation.x = -0.5; // ladder
    this.root.add(g);
    return g;
  }

  /**
   * Four-legged Nusantara Figurine animal facing +z when ry = 0 (kerbau, rusa, kancil, harimau, anjing, kucing …):
   * pick colour, ears, horns, tail and stripes. `s` scales it (1 ≈ knee-high dog, 1.8 ≈ buffalo).
   * Rotate `head` or `tail` in update(t).
   */
  animal(x: number, z: number, ry: number, o: AnimalOpts = {}) {
    const { s = 1, color = "#a9764a", ears = "bulat", horns = false, tail: tailOpt = "pendek", stripes = false } = o;
    const belly = stripes ? "#f5ead6" : horns ? "#766e67" : "#ebd9bf";
    const pawColor = horns ? "#2f2925" : stripes ? "#d97a26" : "#8a613b";
    const root = new Group();
    root.position.set(x, 0, z);
    root.rotation.y = ry;
    root.scale.setScalar(s);

    this.part(new CapsuleGeometry(0.145, 0.36, 6, 16), color, root, [0, 0.34, 0], [1.02, 1, 1.02], [Math.PI / 2, 0, 0]);
    this.part(new SphereGeometry(0.145, 16, 12), belly, root, [0, 0.27, 0.04], [0.82, 0.55, 1.65]);
    this.part(new CylinderGeometry(0.085, 0.125, 0.18, 16), color, root, [0, 0.4, 0.22], undefined, [0.55, 0, 0]);
    if (stripes) {
      for (const sz of [-0.14, -0.02, 0.1]) {
        this.part(new TorusGeometry(0.142, 0.016, 8, 20, Math.PI * 1.3), "#2b211b", root, [0, 0.35, sz], [1.03, 1.0, 1], [0, 0, -Math.PI * 0.15]);
      }
    }
    for (const sx of [-0.088, 0.088]) {
      for (const sz of [-0.18, 0.18]) {
        this.part(new CapsuleGeometry(0.044, 0.16, 6, 12), color, root, [sx, 0.15, sz]);
        this.part(new SphereGeometry(0.048, 12, 10), pawColor, root, [sx, 0.036, sz + 0.012], [1.0, 0.72, 1.25]);
      }
    }

    const head = this.pivot(root, [0, 0.48, 0.3]);
    this.part(new SphereGeometry(0.118, 20, 14), color, head, [0, 0.05, 0.03], [1.02, 0.96, 1.04]);
    this.part(new SphereGeometry(0.072, 16, 12), belly, head, [0, 0.01, 0.13], [1.08, 0.78, 0.95]);
    this.part(new SphereGeometry(0.024, 12, 10), horns ? "#3b332e" : "#2e221d", head, [0, 0.035, 0.195], [1.2, 0.85, 0.8]);
    const smilePts: Vector3[] = [];
    for (let i = -2; i <= 2; i++) {
      const u = i / 2;
      const mx = u * 0.034;
      const my = -0.008 + u * u * 0.012;
      // Project onto the [0.0778, 0.0562, 0.0684] muzzle ellipsoid at [0, 0.01, 0.13] so the full smile sits flush
      const nx = mx / 0.0778;
      const ny = (my - 0.01) / 0.0562;
      const mz = 0.13 + 0.0684 * Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny)) + 0.002;
      smilePts.push(new Vector3(mx, my, mz));
    }
    this.part(new TubeGeometry(new CatmullRomCurve3(smilePts), 8, 0.0055, 5, false), "#4a2e23", head, [0, 0, 0]);
    for (const sx of [-1, 1]) {
      this.creatureEye(head, [sx * 0.056, 0.075, 0.125], 0.028, sx);
      if (ears === "runcing") {
        this.part(new ConeGeometry(0.04, 0.1, 12), color, head, [sx * 0.075, 0.17, 0.01], undefined, [0.1, 0, -sx * 0.25]);
        this.part(new ConeGeometry(0.022, 0.065, 10), "#e8baa8", head, [sx * 0.074, 0.165, 0.025], undefined, [0.15, 0, -sx * 0.25]);
      } else if (ears === "panjang") {
        this.part(new CapsuleGeometry(0.025, 0.13, 6, 12), color, head, [sx * 0.06, 0.22, 0], undefined, [0, 0, -sx * 0.2]);
        this.part(new CapsuleGeometry(0.015, 0.09, 4, 8), "#e8baa8", head, [sx * 0.06, 0.215, 0.016], undefined, [0, 0, -sx * 0.2]);
      } else {
        this.part(new SphereGeometry(0.042, 12, 10), color, head, [sx * 0.095, 0.145, 0.02], [1, 1, 0.55]);
        this.part(new SphereGeometry(0.025, 10, 8), "#e8baa8", head, [sx * 0.095, 0.142, 0.036], [1, 1, 0.45]);
      }
      if (horns) {
        this.part(new CapsuleGeometry(0.02, 0.09, 6, 10), "#ede4cf", head, [sx * 0.12, 0.14, 0.01], undefined, [0, 0, -sx * 1.15]);
        this.part(new ConeGeometry(0.02, 0.1, 12), "#ede4cf", head, [sx * 0.185, 0.205, 0.025], undefined, [0.2, 0, -sx * 0.25]);
      }
    }

    const tail = this.pivot(root, [0, 0.34, -0.28]);
    if (tailOpt === "panjang") {
      this.part(new CapsuleGeometry(0.018, 0.22, 4, 10), color, tail, [0, -0.05, -0.09], undefined, [0.65, 0, 0]);
      this.part(new SphereGeometry(0.032, 10, 8), pawColor, tail, [0, -0.14, -0.17], [0.85, 1.2, 0.85]);
    } else {
      this.part(new SphereGeometry(0.048, 12, 10), "#f5ead6", tail, [0, 0.03, -0.04]);
    }
    this.root.add(root);
    return { root, head, tail };
  }

  /** Small bird at height y, facing +z. Rotate `wingL` / `wingR` around z to flap. */
  bird(x: number, y: number, z: number, ry: number, o: { s?: number; color?: string } = {}) {
    const { s = 1, color = "#f2ede2" } = o;
    const root = new Group();
    root.position.set(x, y, z);
    root.rotation.y = ry;
    root.scale.setScalar(s);
    this.part(new SphereGeometry(0.125, 20, 14), color, root, [0, 0.04, 0], [0.9, 0.88, 1.22]);
    this.part(new SphereGeometry(0.098, 16, 12), "#fff9ef", root, [0, 0.01, 0.04], [0.88, 0.8, 0.95]);
    this.part(new SphereGeometry(0.088, 18, 14), color, root, [0, 0.135, 0.11]);
    this.part(new CapsuleGeometry(0.016, 0.04, 4, 8), "#e69938", root, [0, 0.23, 0.09], undefined, [-0.45, 0, 0]);
    this.part(new ConeGeometry(0.032, 0.075, 12), "#ef962d", root, [0, 0.12, 0.215], [1.1, 1, 0.85], [Math.PI / 2 + 0.1, 0, 0]);
    for (const sx of [-1, 1]) {
      this.creatureEye(root, [sx * 0.052, 0.15, 0.175], 0.022, sx);
      this.part(new CylinderGeometry(0.01, 0.01, 0.07, 8), "#e69938", root, [sx * 0.045, -0.08, 0.01]);
      this.part(new SphereGeometry(0.022, 8, 6), "#e69938", root, [sx * 0.045, -0.115, 0.025], [1, 0.5, 1.4]);
    }
    for (const tRy of [-0.24, 0, 0.24]) {
      this.part(new CapsuleGeometry(0.024, 0.12, 4, 8), "#d6cebe", root, [Math.sin(tRy) * 0.05, 0.06, -0.19], [1, 1, 0.35], [Math.PI / 2 - 0.3, tRy, 0]);
    }
    const wing = (sx: number) => {
      const w = this.pivot(root, [sx * 0.08, 0.07, -0.02]);
      this.part(new SphereGeometry(0.135, 16, 12), "#ded6c6", w, [sx * 0.08, -0.01, 0], [1.05, 0.18, 0.62], [0, -sx * 0.25, -sx * 0.2]);
      return w;
    };
    const wingL = wing(-1), wingR = wing(1);
    this.root.add(root);
    return { root, wingL, wingR };
  }

  /** Water animal lying at the surface y = 0, facing +z: a round fish or a friendly crocodile. Rotate `tail` around y. */
  swimmer(x: number, z: number, ry: number, o: { s?: number; color?: string; kind?: "ikan" | "buaya" } = {}) {
    const { s = 1, kind = "ikan" } = o;
    const color = o.color ?? (kind === "buaya" ? "#5f8a4c" : "#f08c3a");
    const root = new Group();
    root.position.set(x, 0, z);
    root.rotation.y = ry;
    root.scale.setScalar(s);
    let tail: Group;
    if (kind === "buaya") {
      const belly = "#d8e0a4";
      this.part(new CapsuleGeometry(0.12, 0.52, 6, 16), color, root, [0, 0.11, 0], [1.2, 0.85, 1], [Math.PI / 2, 0, 0]);
      this.part(new CapsuleGeometry(0.1, 0.46, 6, 14), belly, root, [0, 0.06, 0.02], [1.1, 0.6, 1], [Math.PI / 2, 0, 0]);
      this.part(new CapsuleGeometry(0.085, 0.24, 6, 14), color, root, [0, 0.12, 0.44], [1.28, 0.65, 1], [Math.PI / 2, 0, 0]);
      this.part(new CapsuleGeometry(0.078, 0.22, 6, 12), belly, root, [0, 0.075, 0.43], [1.22, 0.45, 1], [Math.PI / 2, 0, 0]);
      for (const sx of [-1, 1]) {
        this.part(new SphereGeometry(0.048, 12, 10), color, root, [sx * 0.062, 0.195, 0.27]);
        this.creatureEye(root, [sx * 0.062, 0.205, 0.305], 0.032, sx);
        this.part(new SphereGeometry(0.014, 8, 6), "#3a542f", root, [sx * 0.035, 0.175, 0.56]);
        this.part(new SphereGeometry(0.015, 8, 6), "#fbf8ee", root, [sx * 0.095, 0.095, 0.48]);
        for (const sz of [-0.18, 0.18]) {
          this.part(new CapsuleGeometry(0.035, 0.07, 4, 10), color, root, [sx * 0.16, 0.055, sz], undefined, [0, 0, -sx * 0.7]);
          this.part(new SphereGeometry(0.042, 10, 8), "#4d733d", root, [sx * 0.2, 0.022, sz + 0.02], [1.1, 0.45, 1.3]);
        }
      }
      for (let i = 0; i < 5; i++) this.part(new SphereGeometry(0.032, 10, 8), "#476b39", root, [0, 0.21, 0.18 - i * 0.11], [0.7, 0.85, 1.3]);
      tail = this.pivot(root, [0, 0.1, -0.34]);
      this.part(new ConeGeometry(0.11, 0.56, 14), color, tail, [0, 0, -0.24], [1.05, 1, 0.72], [-Math.PI / 2, 0, 0]);
    } else {
      this.part(new SphereGeometry(0.2, 22, 14), color, root, [0, 0.16, 0], [0.56, 0.78, 1.25]);
      this.part(new SphereGeometry(0.16, 16, 12), "#ffe3b8", root, [0, 0.1, 0.04], [0.52, 0.58, 1.05]);
      for (const sx of [-1, 1]) {
        const eyeG = this.pivot(root, [sx * 0.078, 0.195, 0.165]);
        eyeG.rotation.y = sx * 0.65;
        this.creatureEye(eyeG, [0, 0, 0], 0.034, sx);
        this.part(new ConeGeometry(0.055, 0.11, 10), "#f7b259", root, [sx * 0.115, 0.13, 0.04], [0.35, 1, 0.8], [0, 0, -sx * 1.1]);
      }
      this.part(new CapsuleGeometry(0.022, 0.1, 4, 10), "#f7b259", root, [0, 0.32, -0.02], [0.45, 1, 1.4], [-0.4, 0, 0]);
      tail = this.pivot(root, [0, 0.16, -0.22]);
      for (const rx of [-0.38, 0.38]) {
        this.part(new ConeGeometry(0.075, 0.19, 10), "#f7b259", tail, [0, rx * 0.12, -0.08], [0.28, 1, 0.9], [Math.PI / 2 + rx, 0, 0]);
      }
    }
    this.root.add(root);
    return { root, tail };
  }

  /** Instanced spheres for flowing water, bubbles, etc. */
  particles(n: number, color: string, r = 0.09) {    const m = new InstancedMesh(
      new SphereGeometry(r, 16, 12),
      new MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.25 }),
      n,
    );
    m.instanceMatrix.setUsage(DynamicDrawUsage);
    m.frustumCulled = false;
    this.root.add(m);
    return m;
  }

  // ---------------------------------------------------------------------------------------------
  // Mechanical / explainer builders (Kali Aja, Sastra Mesin). Everything is a pure build step: the
  // returned pivots are what update(t) rotates or slides, never the meshes themselves.
  // ---------------------------------------------------------------------------------------------

  private curveOf(points: Vec3[]) {
    return new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  }

  /**
   * Smooth pipe / wire / river along a path. `at(u)` samples the same curve so flow particles and
   * arrows can travel along it. Segments stay low: the CPU renderer is fill-rate bound.
   */
  tube(points: Vec3[], r: number, m: string | Material, o: { tubularSegments?: number; radialSegments?: number; parent?: Object3D } = {}) {
    const { tubularSegments = 28, radialSegments = 10, parent } = o;
    const curve = this.curveOf(points);
    const mesh = new Mesh(worldUV(new TubeGeometry(curve, tubularSegments, r, radialSegments, false)), this.resolve(m));
    this.add(mesh, parent);
    return { mesh, at: (u: number) => curve.getPointAt(clamp(u, 0, 1)).toArray() as Vec3 };
  }

  /** Torus ring: pipe flange, seal, magnetic field, water ripple. */
  ring(x: number, y: number, z: number, r: number, tubeR: number, m: string | Material, o: { rot?: Vec3; parent?: Object3D } = {}) {
    const mesh = this.add(new Mesh(new TorusGeometry(r, tubeR, 10, 24), this.resolve(m)), o.parent, false);
    mesh.position.set(x, y, z);
    if (o.rot) mesh.rotation.set(...o.rot);
    return mesh;
  }

  /** Helical spring / heating coil / induction winding. Compress it with `root.scale.y`. */
  coil(x: number, y0: number, z: number, o: { r?: number; tubeR?: number; h?: number; turns?: number; color?: string | Material; parent?: Object3D } = {}) {
    const { r = 0.25, tubeR = 0.03, h = 0.8, turns = 5, color = "#9aa3ad", parent } = o;
    const steps = 40;
    const points: Vec3[] = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const a = u * turns * Math.PI * 2;
      points.push([x + Math.cos(a) * r, y0 + h * u, z + Math.sin(a) * r]);
    }
    const g = new Group();
    const t = this.tube(points, tubeR, color, { parent: g, tubularSegments: 60, radialSegments: 8 });
    t.mesh.castShadow = false;
    this.root.add(g);
    if (parent) parent.add(g);
    return g;
  }

  /** Toothed gear. Spin `rotor` around the chosen axis; `teeth` boxes sit on the rim. */
  gear(x: number, y: number, z: number, o: { r?: number; thickness?: number; teeth?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D } = {}) {
    const { r = 0.45, thickness = 0.12, teeth = 10, color = "#9aa3ad", axis = "z", parent } = o;
    const root = new Group();
    root.position.set(x, y, z);
    if (axis === "x") root.rotation.y = Math.PI / 2;
    else if (axis === "y") root.rotation.x = Math.PI / 2;
    const rotor = new Group();
    root.add(rotor);
    // hub + rim sit along local +z (the spin axis). They are rotationally symmetric, so they live on
    // `root`: only the cogs need to spin, which keeps `rotor` == the teeth.
    const hub = this.add(new Mesh(worldUV(new CylinderGeometry(r * 0.28, r * 0.28, thickness * 1.4, 20)), this.resolve(color)), root);
    hub.rotation.x = Math.PI / 2;
    const rim = this.add(new Mesh(worldUV(new CylinderGeometry(r, r, thickness, 24)), this.resolve(color)), root);
    rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const cog = this.add(new Mesh(worldUV(bevelBoxGeometry(r * 0.22, r * 0.22, thickness, 0.02)), this.resolve(color)), rotor);
      cog.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
      cog.rotation.z = a;
    }
    this.root.add(root);
    if (parent) parent.add(root);
    return { root, rotor };
  }

  /** Fan / propeller / turbine. Spin `rotor` around the chosen axis. */
  fan(x: number, y: number, z: number, o: { r?: number; blades?: number; color?: string | Material; axis?: "x" | "y" | "z"; parent?: Object3D } = {}) {
    const { r = 0.5, blades = 4, color = "#c8ced6", axis = "z", parent } = o;
    const root = new Group();
    root.position.set(x, y, z);
    if (axis === "x") root.rotation.y = Math.PI / 2;
    else if (axis === "y") root.rotation.x = Math.PI / 2;
    const rotor = new Group();
    root.add(rotor);
    this.ball(0, 0, 0, r * 0.22, color, rotor);
    for (let i = 0; i < blades; i++) {
      const a = (i / blades) * Math.PI * 2;
      const blade = this.add(new Mesh(worldUV(bevelBoxGeometry(r * 0.9, r * 0.34, r * 0.06, 0.02)), this.resolve(color)), rotor);
      blade.position.set(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, 0);
      blade.rotation.z = a;
      blade.rotation.x = 0.5; // pitch: catches the air instead of reading as a flat cross
    }
    this.root.add(root);
    if (parent) parent.add(root);
    return { root, rotor };
  }

  /** 3D vector arrow (force, heat, current, pressure). `setProgress(u)` grows it from `from` to `to`. */  arrow(from: Vec3, to: Vec3, m: string | Material, o: { r?: number; headR?: number; parent?: Object3D } = {}) {
    const { r = 0.03, headR = 0.09, parent } = o;
    const dir = new Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2]);
    const len = Math.max(1e-4, dir.length());
    const root = new Group();
    root.position.set(...from);
    root.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), dir.normalize());
    const shaft = this.add(new Mesh(worldUV(new CylinderGeometry(r, r, len, 12)), this.resolve(m)), root, false);
    shaft.position.y = len / 2;
    const head = this.add(new Mesh(new ConeGeometry(headR, headR * 2.2, 12), this.resolve(m)), root, false);
    head.position.y = len;
    this.root.add(root);
    if (parent) parent.add(root);
    return { root, setProgress: (u: number) => (root.scale.y = clamp(u, 0, 1)) };
  }

  /**
   * Particles flowing along a path (water, air, current, heat). `update(phase)` takes an INTEGRATED phase:
   * pass `flowPhase(t, L(n))` to speed the flow up on a line. Never pass `t * rate` — multiplying t by a
   * ramping rate teleports the dots and runs them backwards.
   * One InstancedMesh, so a hundred dots cost one draw call.
   */
  flowDots(points: Vec3[], count: number, color: string, o: { r?: number; speed?: number; parent?: Object3D } = {}) {
    const { r = 0.045, speed = 0.35, parent } = o;
    const curve = this.curveOf(points);
    const mesh = new InstancedMesh(
      new SphereGeometry(r, 10, 8),
      new MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.35 }),
      count,
    );
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    this.root.add(mesh);
    if (parent) parent.add(mesh);
    const update = (phase: number) => {
      for (let i = 0; i < count; i++) {
        const u = (((i / count + phase * speed) % 1) + 1) % 1;
        const p = curve.getPointAt(u);
        setInstance(mesh, i, p.x, p.y, p.z);
      }
      mesh.instanceMatrix.needsUpdate = true;
    };
    update(0);
    return Object.assign(mesh, { update });
  }

  /**
   * Slide outer casings aside to reveal the inside. The base position is captured on the first call, so
   * reopening (openU back to 0) returns every part exactly where it was built.
   */
  cutaway(parts: readonly Object3D[], openU: number, offset: Vec3) {
    const u = clamp(openU);
    for (const part of parts) {
      let base = this.cutawayBase.get(part);
      if (!base) {
        base = [part.position.x, part.position.y, part.position.z];
        this.cutawayBase.set(part, base);
      }
      part.position.set(base[0] + offset[0] * u, base[1] + offset[1] * u, base[2] + offset[2] * u);
      part.visible = u < 0.99;
    }
  }

  private cutawayBase = new WeakMap<Object3D, Vec3>();

  /**
   * Uncached emissive material for parts that light up while being explained. `mat()` caches by colour,
   * so a pulsing part must never share one: drive `emissiveIntensity` from `pulse(t, L(n))` here.
   */
  glowMat(color: string, emissive: string, o: Surface | MeshStandardMaterialParameters = "matte") {
    const { grain, ...preset } = typeof o === "string" ? SURFACES[o] : { ...SURFACES.matte, grain: false, ...o };
    const m = new MeshStandardMaterial({ color, emissive, emissiveIntensity: 0, ...preset });
    if (grain) m.map = grainTexture();
    return m;
  }
}

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
export const setInstance = (mesh: InstancedMesh, i: number, x: number, y: number, z: number, s = 1, rot?: Euler) => {
  _p.set(x, y, z);
  _s.setScalar(s);
  if (rot) _q.setFromEuler(rot);
  else _q.identity();
  _m.compose(_p, _q, _s);
  mesh.setMatrixAt(i, _m);
};

/**
 * Per-line acting for a wooden-toy figure. Switch `mode` with the script line being spoken
 * (`beat`/`stepIndex`) so a character never stands frozen: breathing and blinks in "idle", gesturing
 * in "talk", alternating legs in "walk". Pure function of `t`.
 */
export const poseFigure = (fig: FigureParts, t: number, mode: PoseMode, seed = 0) => {
  // reset every frame: the parts are shared state, so each pose must fully describe itself
  fig.head.rotation.set(0, 0, 0);
  fig.torso.rotation.set(0, 0, 0);
  // Kit.figure builds the arms splayed on Z (g.rotation.z = sx * 0.18): reset on the same axis
  fig.armL.rotation.set(0, 0, -0.18);
  fig.armR.rotation.set(0, 0, 0.18);
  fig.legL.rotation.set(0, 0, 0);
  fig.legR.rotation.set(0, 0, 0);
  fig.blink.scale.set(1, 1, 1);

  switch (mode) {
    case "walk": {
      const step = Math.sin(t * 6 + seed);
      fig.legL.rotation.x = step * 0.42;
      fig.legR.rotation.x = -step * 0.42;
      fig.armL.rotation.x = -step * 0.3;
      fig.armR.rotation.x = step * 0.3;
      fig.armL.rotation.z = -0.18 - step * 0.11;
      fig.armR.rotation.z = 0.18 + step * 0.11;
      fig.torso.rotation.x = -0.05;
      break;
    }
    case "talk": {
      fig.armR.rotation.z = 0.55 + sway(t, seed) * 0.16;
      fig.armR.rotation.x = -0.35 + sway(t, seed + 3) * 0.2;
      fig.head.rotation.y = sway(t, seed + 1) * 0.16;
      fig.head.rotation.x = 0.06 + Math.sin(t * 3.2) * 0.05;
      fig.torso.rotation.x = sway(t, seed + 5) * 0.02;
      break;
    }
    case "wave": {
      fig.armR.rotation.z = 1.15 + sway(t, seed) * 0.22;
      fig.head.rotation.z = 0.06;
      fig.torso.rotation.x = sway(t, seed + 2) * 0.02;
      break;
    }
    case "sad": {
      fig.head.rotation.x = 0.34;
      fig.torso.rotation.x = 0.1;
      fig.armL.rotation.z = -0.06;
      fig.armR.rotation.z = 0.06;
      break;
    }
    case "point": {
      fig.armR.rotation.x = -1.35;
      fig.armR.rotation.z = 0.16;
      fig.head.rotation.y = -0.12;
      break;
    }
    case "idle":
    default: {
      fig.torso.rotation.x = sway(t, seed) * 0.03;
      fig.head.rotation.y = sway(t, seed + 4) * 0.08;
      fig.armL.rotation.z = -0.18 - sway(t, seed + 6) * 0.03;
      fig.armR.rotation.z = 0.18 + sway(t, seed + 7) * 0.03;
      break;
    }
  }

  // everyone blinks now and then, whatever they are doing
  const blinkPhase = sway(t, seed + 9);
  fig.blink.scale.y = blinkPhase > 0.94 ? 0.12 : 1;
};
