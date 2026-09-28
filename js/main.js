(function () {
  'use strict';

  const CHUNK = 16;
  const HEIGHT = 64;
  const SEA = 30;
  const RADIUS = 3;
  const REACH = 7;
  const SEED = 1337;
  const TILE = 16;
  const ATLAS = 256;

  const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, COBBLE = 4, PLANKS = 5,
        LOG = 6, LEAVES = 7, SAND = 8, BRICK = 9, GLASS = 10, WATER = 11, BEDROCK = 12;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash2(x, z, seed) {
    let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + (seed | 0)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  function vnoise(x, z, seed) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi, seed);
    const b = hash2(xi + 1, zi, seed);
    const c = hash2(xi, zi + 1, seed);
    const d = hash2(xi + 1, zi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  function fbm(x, z, seed) {
    let total = 0, amp = 1, freq = 1, norm = 0;
    for (let o = 0; o < 4; o++) {
      total += vnoise(x * freq, z * freq, seed + o * 101) * amp;
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return total / norm;
  }

  function terrainHeight(wx, wz) {
    const n = fbm(wx / 24, wz / 24, SEED);
    return Math.min(Math.floor(20 + n * n * 44), HEIGHT - 2);
  }

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS;
  atlasCanvas.height = ATLAS;
  const actx = atlasCanvas.getContext('2d');

  function fillTile(tile, fn) {
    const col = tile & 15, row = tile >> 4;
    const rnd = mulberry32(SEED + tile * 7919);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const px = fn(x, y, rnd);
        if (!px) continue;
        actx.fillStyle = px[0];
        actx.globalAlpha = px[1] === undefined ? 1 : px[1];
        actx.fillRect(col * TILE + x, row * TILE + y, 1, 1);
      }
    }
    actx.globalAlpha = 1;
  }

  function pick(rnd, colors) {
    return colors[(rnd() * colors.length) | 0];
  }

  function paintAtlas() {
    const greens = ['#5fae3a', '#55a334', '#67b842', '#4f9a2e'];
    const dirtC = ['#8a5a34', '#7c5230', '#94633c', '#714a28'];
    const grayC = ['#8f8f8f', '#868686', '#989898', '#7d7d7d'];
    const sandC = ['#dcd29b', '#d4c98f', '#e2d8a4', '#cfc386'];
    const leafC = ['#2e7d1e', '#287018', '#35901f', '#1f5c13'];
    const logC = ['#6b4a26', '#614423', '#75522b', '#573d1f'];
    const brickC = ['#9c4a3c', '#8f4234', '#a55245'];

    fillTile(0, (x, y, r) => [pick(r, greens)]);
    fillTile(1, (x, y, r) => (y < 3 || (y < 5 && r() < 0.35) ? pick(r, greens) : pick(r, dirtC)));
    fillTile(2, (x, y, r) => [pick(r, dirtC)]);
    fillTile(3, (x, y, r) => [pick(r, grayC)]);
    fillTile(4, (x, y, r) => {
      const mortar = x % 5 === 0 || y % 5 === 0 || ((x + 2) % 8 === 0 && y % 2 === 0) || ((y + 3) % 8 === 0 && x % 3 === 0);
      return [mortar ? '#565656' : pick(r, grayC)];
    });
    fillTile(5, (x, y, r) => {
      const seam = y % 4 === 3;
      const knot = !seam && (x + ((y >> 2) * 5)) % 9 === 0;
      return [seam || knot ? '#6e5430' : pick(r, ['#b08a54', '#a8834e', '#b8915a'])];
    });
    fillTile(6, (x, y, r) => [(x % 4 === 0 || (x % 4 === 3 && r() < 0.4)) ? '#4c3519' : pick(r, logC)]);
    fillTile(7, (x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      return [d > 6.5 || (d > 2 && ((d | 0) % 2 === 1)) ? '#6e4d24' : '#a87c46'];
    });
    fillTile(8, (x, y, r) => [r() < 0.18 ? '#173f0d' : pick(r, leafC)]);
    fillTile(9, (x, y, r) => [pick(r, sandC)]);
    fillTile(10, (x, y, r) => {
      const v = r();
      return [v < 0.33 ? '#262626' : v < 0.66 ? '#3a3a3a' : '#4d4d4d'];
    });
    fillTile(11, (x, y, r) => {
      const off = ((y >> 2) % 2) * 4;
      const mortar = y % 4 === 3 || (x + off) % 8 === 7;
      return [mortar ? '#c2b8b0' : pick(r, brickC)];
    });
    fillTile(12, (x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return ['rgba(220,240,255,0.85)'];
      if ((x + y) % 11 === 3 && x > 2 && y < 12) return ['rgba(255,255,255,0.35)'];
      return ['rgba(200,230,255,0.10)'];
    });
    fillTile(13, (x, y, r) => [r() < 0.25 ? '#3a5fc4' : '#3f68d0', 0.75]);
    fillTile(14, (x, y, r) => [pick(r, ['#e8f0f5', '#f4f9fd', '#dce8f0'])]);
  }

  const BLOCKS = {};
  BLOCKS[GRASS] = { name: 'Grass', top: 0, bottom: 2, side: 1, solid: true, opaque: true };
  BLOCKS[DIRT] = { name: 'Dirt', tile: 2, solid: true, opaque: true };
  BLOCKS[STONE] = { name: 'Stone', tile: 3, solid: true, opaque: true };
  BLOCKS[COBBLE] = { name: 'Cobblestone', tile: 4, solid: true, opaque: true };
  BLOCKS[PLANKS] = { name: 'Planks', tile: 5, solid: true, opaque: true };
  BLOCKS[LOG] = { name: 'Oak Log', top: 7, bottom: 7, side: 6, solid: true, opaque: true };
  BLOCKS[LEAVES] = { name: 'Leaves', tile: 8, solid: true, opaque: true };
  BLOCKS[SAND] = { name: 'Sand', tile: 9, solid: true, opaque: true };
  BLOCKS[BRICK] = { name: 'Bricks', tile: 11, solid: true, opaque: true };
  BLOCKS[GLASS] = { name: 'Glass', tile: 12, solid: true, opaque: false, transparent: true };
  BLOCKS[WATER] = { name: 'Water', tile: 13, solid: false, opaque: false, transparent: true };
  BLOCKS[BEDROCK] = { name: 'Bedrock', tile: 10, solid: true, opaque: true, unbreakable: true };

  function tileFor(id, face) {
    const b = BLOCKS[id];
    if (!b) return 2;
    if (face === 3) return b.top !== undefined ? b.top : b.tile;
    if (face === 2) return b.bottom !== undefined ? b.bottom : b.tile;
    return b.side !== undefined ? b.side : b.tile;
  }

  const FACES = [
    { dir: [-1, 0, 0], shade: 0.70, corners: [
      { pos: [0, 1, 0], uv: [0, 1] }, { pos: [0, 0, 0], uv: [0, 0] },
      { pos: [0, 1, 1], uv: [1, 1] }, { pos: [0, 0, 1], uv: [1, 0] } ] },
    { dir: [1, 0, 0], shade: 0.70, corners: [
      { pos: [1, 1, 1], uv: [0, 1] }, { pos: [1, 0, 1], uv: [0, 0] },
      { pos: [1, 1, 0], uv: [1, 1] }, { pos: [1, 0, 0], uv: [1, 0] } ] },
    { dir: [0, -1, 0], shade: 0.55, corners: [
      { pos: [1, 0, 1], uv: [1, 0] }, { pos: [0, 0, 1], uv: [0, 0] },
      { pos: [1, 0, 0], uv: [1, 1] }, { pos: [0, 0, 0], uv: [0, 1] } ] },
    { dir: [0, 1, 0], shade: 1.00, corners: [
      { pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 1, 0], uv: [1, 0] }, { pos: [1, 1, 0], uv: [0, 0] } ] },
    { dir: [0, 0, -1], shade: 0.85, corners: [
      { pos: [1, 1, 0], uv: [1, 1] }, { pos: [0, 1, 0], uv: [0, 1] },
      { pos: [1, 0, 0], uv: [1, 0] }, { pos: [0, 0, 0], uv: [0, 0] } ] },
    { dir: [0, 0, 1], shade: 0.85, corners: [
      { pos: [0, 1, 1], uv: [1, 1] }, { pos: [1, 1, 1], uv: [0, 1] },
      { pos: [0, 0, 1], uv: [1, 0] }, { pos: [1, 0, 1], uv: [0, 0] } ] }
  ];

  const chunks = new Map();
  const chunkKey = (cx, cz) => cx + ',' + cz;
  const cidx = (x, y, z) => x + z * CHUNK + y * CHUNK * CHUNK;

  function genChunk(cx, cz) {
    const data = new Uint8Array(CHUNK * CHUNK * HEIGHT);
    for (let x = 0; x < CHUNK; x++) {
      for (let z = 0; z < CHUNK; z++) {
        const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        const h = terrainHeight(wx, wz);
        const beach = h <= SEA + 1;
        for (let y = 0; y <= h; y++) {
          let id;
          if (y === 0) id = BEDROCK;
          else if (y === h) id = beach ? SAND : GRASS;
          else if (y >= h - 3) id = beach ? SAND : DIRT;
          else id = STONE;
          data[cidx(x, y, z)] = id;
        }
        for (let y = h + 1; y <= SEA; y++) data[cidx(x, y, z)] = WATER;
      }
    }
    for (let x = 2; x <= 13; x++) {
      for (let z = 2; z <= 13; z++) {
        const wx = cx * CHUNK + x, wz = cz * CHUNK + z;
        const h = terrainHeight(wx, wz);
        if (h + 7 >= HEIGHT || data[cidx(x, h, z)] !== GRASS) continue;
        if (hash2(wx, wz, SEED ^ 0x9e3779b9) >= 0.022) continue;
        const th = 4 + (hash2(wx + 1, wz - 1, SEED) < 0.35 ? 1 : 0);
        for (let y = h + 1; y <= h + th; y++) data[cidx(x, y, z)] = LOG;
        for (let dy = th - 1; dy <= th + 1; dy++) {
          const rad = dy === th + 1 ? 1 : 2;
          for (let lx = -rad; lx <= rad; lx++) {
            for (let lz = -rad; lz <= rad; lz++) {
              if (dy === th + 1 && Math.abs(lx) === 1 && Math.abs(lz) === 1) continue;
              if (lx === 0 && lz === 0 && dy <= th) continue;
              const i = cidx(x + lx, h + dy, z + lz);
              if (data[i] === AIR) data[i] = LEAVES;
            }
          }
        }
      }
    }
    return data;
  }

  function getChunk(cx, cz) {
    const k = chunkKey(cx, cz);
    let c = chunks.get(k);
    if (!c) {
      c = { cx: cx, cz: cz, data: genChunk(cx, cz), meshes: null };
      chunks.set(k, c);
    }
    return c;
  }

  function getBlock(x, y, z) {
    if (y < 0) return BEDROCK;
    if (y >= HEIGHT) return AIR;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = getChunk(cx, cz);
    return c.data[cidx(x - cx * CHUNK, y, z - cz * CHUNK)];
  }

  function isSolid(id) {
    return id !== AIR && BLOCKS[id] && BLOCKS[id].solid;
  }

  function shouldDrawFace(id, nb) {
    if (nb === AIR) return true;
    if (nb === id) return false;
    return BLOCKS[nb] && BLOCKS[nb].transparent;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);
  camera.rotation.order = 'YXZ';

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  scene.background = new THREE.Color(0x8fc7ea);
  scene.fog = new THREE.Fog(0x8fc7ea, 24, 70);
  scene.add(new THREE.AmbientLight(0xffffff, 0.62));
  const sun = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.position.set(30, 60, 18);
  scene.add(sun);

  const texture = new THREE.CanvasTexture(atlasCanvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  const opaqueMat = new THREE.MeshLambertMaterial({ map: texture, vertexColors: true });
  const transMat = new THREE.MeshLambertMaterial({
    map: texture, vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide
  });

  function buildChunkMeshes(c) {
    const lists = {
      op: { pos: [], nrm: [], uv: [], col: [], idx: [] },
      tr: { pos: [], nrm: [], uv: [], col: [], idx: [] }
    };
    const x0 = c.cx * CHUNK, z0 = c.cz * CHUNK;
    for (let y = 0; y < HEIGHT; y++) {
      for (let z = 0; z < CHUNK; z++) {
        for (let x = 0; x < CHUNK; x++) {
          const id = c.data[cidx(x, y, z)];
          if (id === AIR) continue;
          const def = BLOCKS[id];
          const list = def.transparent ? lists.tr : lists.op;
          for (let f = 0; f < 6; f++) {
            const face = FACES[f];
            const nb = getBlock(x0 + x + face.dir[0], y + face.dir[1], z0 + z + face.dir[2]);
            if (!shouldDrawFace(id, nb)) continue;
            const tile = tileFor(id, f);
            const tc = tile & 15, trw = tile >> 4;
            const base = list.pos.length / 3;
            const s = face.shade;
            for (let i = 0; i < 4; i++) {
              const corner = face.corners[i];
              list.pos.push(x0 + x + corner.pos[0], y + corner.pos[1], z0 + z + corner.pos[2]);
              list.nrm.push(face.dir[0], face.dir[1], face.dir[2]);
              list.uv.push((tc + corner.uv[0]) / 16, 1 - (trw + 1 - corner.uv[1]) / 16);
              list.col.push(s, s, s);
            }
            list.idx.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
          }
        }
      }
    }
    c.meshes = [];
    for (const k of ['op', 'tr']) {
      const l = lists[k];
      if (!l.pos.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(l.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(l.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(l.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(l.col, 3));
      g.setIndex(l.idx);
      const m = new THREE.Mesh(g, k === 'op' ? opaqueMat : transMat);
      scene.add(m);
      c.meshes.push(m);
    }
  }

  function removeChunkMeshes(c) {
    if (!c.meshes) return;
    for (const m of c.meshes) {
      scene.remove(m);
      m.geometry.dispose();
    }
    c.meshes = null;
  }

  function rebuildChunk(cx, cz) {
    const c = chunks.get(chunkKey(cx, cz));
    if (c && c.meshes) {
      removeChunkMeshes(c);
      buildChunkMeshes(c);
    }
  }

  function setBlock(x, y, z, id) {
    if (y < 1 || y >= HEIGHT) return;
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK);
    const c = getChunk(cx, cz);
    c.data[cidx(x - cx * CHUNK, y, z - cz * CHUNK)] = id;
    rebuildChunk(cx, cz);
    const lx = x - cx * CHUNK, lz = z - cz * CHUNK;
    if (lx === 0) {
      rebuildChunk(cx - 1, cz);
      if (lz === 0) rebuildChunk(cx - 1, cz - 1);
      if (lz === CHUNK - 1) rebuildChunk(cx - 1, cz + 1);
    }
    if (lx === CHUNK - 1) {
      rebuildChunk(cx + 1, cz);
      if (lz === 0) rebuildChunk(cx + 1, cz - 1);
      if (lz === CHUNK - 1) rebuildChunk(cx + 1, cz + 1);
    }
    if (lz === 0 && lx > 0 && lx < CHUNK - 1) rebuildChunk(cx, cz - 1);
    if (lz === CHUNK - 1 && lx > 0 && lx < CHUNK - 1) rebuildChunk(cx, cz + 1);
  }

  let buildQueue = [];

  function updateChunks() {
    const pcx = Math.floor(player.x / CHUNK), pcz = Math.floor(player.z / CHUNK);
    for (const c of chunks.values()) {
      if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > RADIUS + 1) {
        removeChunkMeshes(c);
        if (chunks.size > 600) chunks.delete(chunkKey(c.cx, c.cz));
      }
    }
    if (buildQueue.length === 0) {
      buildQueue = [];
      for (let dx = -RADIUS; dx <= RADIUS; dx++) {
        for (let dz = -RADIUS; dz <= RADIUS; dz++) {
          const cx = pcx + dx, cz = pcz + dz;
          const c = chunks.get(chunkKey(cx, cz));
          if (!c || !c.meshes) buildQueue.push({ cx: cx, cz: cz, d: dx * dx + dz * dz });
        }
      }
      buildQueue.sort((a, b) => a.d - b.d);
    }
    let budget = 2;
    while (buildQueue.length && budget-- > 0) {
      const q = buildQueue.shift();
      const c = getChunk(q.cx, q.cz);
      if (!c.meshes) buildChunkMeshes(c);
    }
  }

  const player = {
    x: 8.5, y: 40, z: 8.5,
    vx: 0, vy: 0, vz: 0,
    yaw: Math.PI * 0.25, pitch: -0.1,
    halfW: 0.3, height: 1.8, eye: 1.62,
    onGround: false, fly: false
  };

  function spawnPlayer() {
    player.y = Math.max(terrainHeight(8, 8), SEA) + 1;
  }

  function collides() {
    const minX = Math.floor(player.x - player.halfW), maxX = Math.floor(player.x + player.halfW);
    const minY = Math.floor(player.y), maxY = Math.floor(player.y + player.height);
    const minZ = Math.floor(player.z - player.halfW), maxZ = Math.floor(player.z + player.halfW);
    for (let x = minX; x <= maxX; x++)
      for (let y = minY; y <= maxY; y++)
        for (let z = minZ; z <= maxZ; z++)
          if (isSolid(getBlock(x, y, z))) return true;
    return false;
  }

  function moveAxis(axis, delta) {
    if (delta === 0) return;
    const prev = player[axis];
    player[axis] = prev + delta;
    if (!collides()) return;
    player[axis] = prev;
    let lo = prev, hi = prev + delta;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      player[axis] = mid;
      if (collides()) hi = mid; else lo = mid;
    }
    player[axis] = lo;
    if (axis === 'y') {
      if (delta < 0) player.onGround = true;
      player.vy = 0;
    } else if (axis === 'x') {
      player.vx = 0;
    } else {
      player.vz = 0;
    }
  }

  const GRAV = 26, JUMP = 8.6, WALK = 4.5, FLY = 11;

  function updatePlayer(dt) {
    let ix = 0, iz = 0;
    if (keys['KeyW']) iz += 1;
    if (keys['KeyS']) iz -= 1;
    if (keys['KeyD']) ix += 1;
    if (keys['KeyA']) ix -= 1;
    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }
    const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
    const speed = player.fly ? FLY : WALK;
    player.vx = (-sin * iz + cos * ix) * speed;
    player.vz = (-cos * iz - sin * ix) * speed;
    if (player.fly) {
      let vy = 0;
      if (keys['Space']) vy += 1;
      if (keys['ShiftLeft'] || keys['ShiftRight']) vy -= 1;
      player.vy = vy * speed;
    } else {
      player.vy -= GRAV * dt;
      if (player.vy < -38) player.vy = -38;
      if (keys['Space'] && player.onGround) player.vy = JUMP;
    }
    moveAxis('x', player.vx * dt);
    player.onGround = false;
    moveAxis('y', player.vy * dt);
    moveAxis('z', player.vz * dt);
  }

  function updateCamera() {
    camera.position.set(player.x, player.y + player.eye, player.z);
    camera.rotation.set(player.pitch, player.yaw, 0);
  }

  const viewDir = new THREE.Vector3();

  function voxelRay(ox, oy, oz, dx, dy, dz) {
    let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tmx = dx !== 0 ? (sx > 0 ? x + 1 - ox : ox - x) * tdx : Infinity;
    let tmy = dy !== 0 ? (sy > 0 ? y + 1 - oy : oy - y) * tdy : Infinity;
    let tmz = dz !== 0 ? (sz > 0 ? z + 1 - oz : oz - z) * tdz : Infinity;
    let px = x, py = y, pz = z, t = 0;
    for (let i = 0; i < 64; i++) {
      const id = getBlock(x, y, z);
      if (id !== AIR && id !== WATER) return { x: x, y: y, z: z, px: px, py: py, pz: pz, id: id };
      px = x; py = y; pz = z;
      if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; }
      else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; }
      else { z += sz; t = tmz; tmz += tdz; }
      if (t > REACH) break;
    }
    return null;
  }

  function currentHit() {
    camera.getWorldDirection(viewDir);
    return voxelRay(camera.position.x, camera.position.y, camera.position.z,
      viewDir.x, viewDir.y, viewDir.z);
  }

  function blockIntersectsPlayer(bx, by, bz) {
    return bx < player.x + player.halfW && bx + 1 > player.x - player.halfW &&
           by < player.y + player.height && by + 1 > player.y &&
           bz < player.z + player.halfW && bz + 1 > player.z - player.halfW;
  }

  const HOTBAR = [GRASS, DIRT, STONE, COBBLE, PLANKS, LOG, LEAVES, BRICK, GLASS];
  let selected = 0;
  let locked = false;

  function breakBlock() {
    const hit = currentHit();
    if (!hit || BLOCKS[hit.id].unbreakable) return;
    setBlock(hit.x, hit.y, hit.z, AIR);
  }

  function placeBlock() {
    const hit = currentHit();
    if (!hit) return;
    const cur = getBlock(hit.px, hit.py, hit.pz);
    if (cur !== AIR && cur !== WATER) return;
    if (blockIntersectsPlayer(hit.px, hit.py, hit.pz)) return;
    setBlock(hit.px, hit.py, hit.pz, HOTBAR[selected]);
  }

  function pickBlock() {
    const hit = currentHit();
    if (!hit) return;
    const i = HOTBAR.indexOf(hit.id);
    if (i >= 0) {
      selected = i;
      updateHotbar();
    }
  }

  const overlay = document.getElementById('overlay');
  const debug = document.getElementById('debug');
  const hotbarEl = document.getElementById('hotbar');

  function buildHotbar() {
    for (let i = 0; i < HOTBAR.length; i++) {
      const def = BLOCKS[HOTBAR[i]];
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.title = def.name;
      const cv = document.createElement('canvas');
      cv.width = TILE;
      cv.height = TILE;
      const g = cv.getContext('2d');
      const tile = def.side !== undefined ? def.side : def.tile;
      g.drawImage(atlasCanvas, (tile & 15) * TILE, (tile >> 4) * TILE, TILE, TILE, 0, 0, TILE, TILE);
      slot.appendChild(cv);
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = i + 1;
      slot.appendChild(num);
      hotbarEl.appendChild(slot);
    }
  }

  function updateHotbar() {
    const slots = hotbarEl.children;
    for (let i = 0; i < slots.length; i++) slots[i].classList.toggle('sel', i === selected);
  }

  const keys = {};

  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (!locked) return;
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyF') {
      player.fly = !player.fly;
      player.vy = 0;
    }
    if (e.code.indexOf('Digit') === 0) {
      const n = parseInt(e.code.slice(5), 10) - 1;
      if (n >= 0 && n < HOTBAR.length) {
        selected = n;
        updateHotbar();
      }
    }
  });

  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    player.yaw -= e.movementX * 0.0022;
    player.pitch -= e.movementY * 0.0022;
    const lim = Math.PI / 2 - 0.02;
    if (player.pitch > lim) player.pitch = lim;
    if (player.pitch < -lim) player.pitch = -lim;
  });

  renderer.domElement.addEventListener('mousedown', (e) => {
    if (!locked) return;
    e.preventDefault();
    if (e.button === 0) breakBlock();
    else if (e.button === 1) pickBlock();
    else if (e.button === 2) placeBlock();
  });

  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

  renderer.domElement.addEventListener('wheel', (e) => {
    if (!locked) return;
    selected = (selected + (e.deltaY > 0 ? 1 : -1) + HOTBAR.length) % HOTBAR.length;
    updateHotbar();
  }, { passive: true });

  overlay.addEventListener('click', () => renderer.domElement.requestPointerLock());

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === renderer.domElement;
    overlay.classList.toggle('hidden', locked);
  });

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  let frames = 0, fps = 0, fpsTime = 0, lastDebug = 0;

  function updateDebug(now) {
    if (now - lastDebug < 250) return;
    lastDebug = now;
    let built = 0;
    for (const c of chunks.values()) if (c.meshes) built++;
    debug.textContent =
      'FPS: ' + fps + '\n' +
      'POS: ' + player.x.toFixed(1) + ' ' + player.y.toFixed(1) + ' ' + player.z.toFixed(1) + '\n' +
      'CHUNKS: ' + built + '\n' +
      'MODE: ' + (player.fly ? 'FLY' : 'WALK') + '\n' +
      'BLOCK: ' + BLOCKS[HOTBAR[selected]].name;
  }

  let last = performance.now();

  function animate(now) {
    requestAnimationFrame(animate);
    const raw = (now - last) / 1000;
    last = now;
    let dt = raw;
    if (dt > 0.05) dt = 0.05;
    frames++;
    fpsTime += raw;
    if (fpsTime >= 1) {
      fps = Math.round(frames / fpsTime);
      frames = 0;
      fpsTime = 0;
    }
    if (locked) updatePlayer(dt);
    updateChunks();
    updateCamera();
    updateDebug(now);
    renderer.render(scene, camera);
  }

  paintAtlas();
  buildHotbar();
  updateHotbar();
  spawnPlayer();
  resize();
  requestAnimationFrame(animate);
})();
