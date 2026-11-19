"use strict";

// A separate, camera-registered surface beneath the transparent game canvas.
// GLSL ES 1.00 keeps the renderer usable on WebGL 1 hardware as well as WebGL 2 browsers.
const OCEAN_VERTEX = `attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;
const OCEAN_FRAGMENT = `
precision highp float;
uniform vec2 u_resolution, u_viewport;
uniform vec3 u_camera;
uniform float u_time, u_storm, u_tide, u_flash;
uniform vec4 u_beacon, u_boat;
uniform vec3 u_lamp;
uniform sampler2D u_depth;
uniform vec4 u_trails[24];

vec2 hash(vec2 p) {
  return -1.0 + 2.0 * fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)))) * 43758.5453);
}
// Gradient simplex noise: no tile-aligned crests or repeated line primitives.
float simplex(vec2 p) {
  const float K1=0.366025404, K2=0.211324865;
  vec2 i=floor(p+(p.x+p.y)*K1);
  vec2 a=p-i+(i.x+i.y)*K2;
  vec2 o=step(a.yx,a.xy);
  vec2 b=a-o+K2, c=a-1.0+2.0*K2;
  vec3 h=max(0.5-vec3(dot(a,a),dot(b,b),dot(c,c)),0.0);
  vec3 n=h*h*h*h*vec3(dot(a,hash(i)),dot(b,hash(i+o)),dot(c,hash(i+1.0)));
  return dot(n,vec3(70.0));
}
float fbm(vec2 p) {
  float sum=0.0, amp=0.53;
  mat2 rotate=mat2(0.80,-0.60,0.60,0.80);
  for(int i=0;i<4;i++) { sum+=amp*simplex(p); p=rotate*p*2.03+8.7; amp*=0.43; }
  return sum;
}
float seaHeight(vec2 world) {
  vec2 p=world*0.014;
  float slow=u_time*0.13;
  vec2 warp=vec2(simplex(p*0.45+slow),simplex(p*0.45-slow+13.0));
  return fbm(p+warp*0.32+vec2(slow,-slow*0.7))*(0.75+u_storm*0.5)
       + simplex(p*0.32+vec2(-slow*0.4,slow*0.2))*0.65;
}
vec3 lamp(vec2 world, vec3 normal, vec4 light, float heading, float cone) {
  vec2 delta=light.xy-world;
  float range=length(delta);
  vec3 L=normalize(vec3(delta,68.0));
  vec3 V=normalize(vec3(0.0,-0.45,1.0));
  float spec=pow(max(dot(normal,normalize(L+V)),0.0),56.0);
  float direction=dot(normalize(-delta+vec2(0.001)),vec2(cos(heading),sin(heading)));
  float beam=mix(0.20,1.0,smoothstep(cone,cone+0.12,direction));
  float fall=exp(-range/max(1.0,light.z));
  float glitter=0.55+0.45*simplex(world*0.18+u_time*0.16);
  return vec3(1.0,0.73,0.38)*light.w*fall*beam*(spec*1.9+0.025+max(0.0,glitter)*spec);
}
void main() {
  vec2 screen=vec2(gl_FragCoord.x/u_resolution.x,1.0-gl_FragCoord.y/u_resolution.y)*u_viewport;
  vec2 world=(screen-u_camera.xy)/u_camera.z;
  vec3 depths=texture2D(u_depth,clamp(world/vec2(1100.0,620.0),0.0,1.0)).rgb;
  float shore=min(depths.r,mix(depths.g,depths.b,smoothstep(0.05,0.6,u_tide)))*100.0;
  float h=seaHeight(world);
  float hx=seaHeight(world+vec2(1.2,0.0))-h, hy=seaHeight(world+vec2(0.0,1.2))-h;
  vec3 normal=normalize(vec3(-hx*9.0,-hy*9.0,1.0));
  float shallow=exp(-shore*0.038);
  vec3 deep=vec3(0.012,0.034,0.066), shoal=vec3(0.024,0.112,0.119);
  vec3 color=mix(deep,shoal,shallow*0.78);
  float ridge=smoothstep(-0.25,0.65,h);
  color+=vec3(0.024,0.056,0.066)*ridge;
  vec3 moonDirection=normalize(vec3(-0.3,-0.5,1.0));
  float moon=pow(max(dot(normal,moonDirection),0.0),30.0);
  float moonPath=0.18+0.82*exp(-pow((world.x-520.0+sin(world.y*0.006)*100.0)/260.0,2.0));
  color+=vec3(0.075,0.15,0.20)*moon*moonPath;
  color+=lamp(world,normal,u_beacon,u_beacon.x<300.0?u_time*0.58:u_time*0.3,0.91);
  color+=lamp(world,normal,u_boat,u_lamp.x,0.82);
  float caustic=pow(max(0.0,1.0-abs(simplex(world*0.065+vec2(h*0.5,u_time*0.12)))),14.0);
  color+=vec3(0.025,0.071,0.056)*caustic*shallow*(0.4+ridge);
  float shoreNoise=fbm(world*0.075+vec2(u_time*0.14,-u_time*0.12));
  float wash=2.8+2.5*sin(u_time*0.7+shoreNoise*3.0);
  float foam=exp(-pow((shore-wash-shoreNoise*3.0)/3.3,2.0));
  foam*=smoothstep(-0.35,0.6,shoreNoise)*smoothstep(0.0,1.2,shore);
  color=mix(color,vec3(0.50,0.67,0.63),foam*0.38);
  // Each sample is a dissipating turbulent density field, never a polyline.
  float wake=0.0;
  for(int i=0;i<24;i++) {
    vec4 trail=u_trails[i];
    float age=3.0-trail.z;
    vec2 offset=world-trail.xy;
    if(trail.z<=0.0 || dot(offset,offset)>3600.0) continue;
    offset+=vec2(simplex(world*0.12+u_time*0.35),simplex(world*0.1-u_time*0.28))*age*2.4;
    float radius=3.0+age*5.5;
    float density=exp(-dot(offset,offset)/(radius*radius));
    float breakup=smoothstep(-0.5,0.55,simplex(world*0.22+vec2(age,u_time*0.18)));
    float life=max(0.0,trail.z)/3.0;
    float ring=exp(-pow((length(offset)-age*13.0)/(1.2+age*0.6),2.0));
    wake+=(density*breakup*0.28+ring*0.035)*life*min(1.0,trail.w/90.0);
  }
  color=mix(color,vec3(0.48,0.69,0.66),clamp(wake,0.0,0.55));
  color+=vec3(0.14,0.18,0.24)*u_flash;
  // Very low amplitude dithering prevents 8-bit gradient banding.
  color+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;
  gl_FragColor=vec4(color,1.0);
}`;

class OceanSurface {
  constructor(canvas, fallback, renderer) {
    this.canvas = canvas; this.fallback = fallback; this.renderer = renderer;
    this.mode = 'fallback'; this.reason = ''; this.depthKey = null;
    this.fallbackCtx = fallback.getContext('2d', { alpha: false });
    this.buffer = document.createElement('canvas'); this.buffer.width = 275; this.buffer.height = 155;
    this.bufferCtx = this.buffer.getContext('2d', { alpha: false });
    this.pixels = this.bufferCtx.createImageData(275, 155);
    this.noise = noiseFrom(4719); this.trails = new Float32Array(24 * 4);
    this.lastFallbackTime = -1; this.depthPixels = null;
    this.initialize();
    canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); this.useFallback('context-lost'); });
    canvas.addEventListener('webglcontextrestored', () => { this.initialize(); this.depthKey = null; });
  }
  useFallback(reason) {
    this.mode = 'fallback'; this.reason = reason; this.canvas.hidden = true; this.fallback.hidden = false;
  }
  initialize() {
    try {
      const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'high-performance' });
      if (!gl) { this.useFallback('webgl-unavailable'); return; }
      this.gl = gl;
      const compile = (type, source) => {
        const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(shader); gl.deleteShader(shader); throw new Error(log); }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, OCEAN_VERTEX), fragment = compile(gl.FRAGMENT_SHADER, OCEAN_FRAGMENT);
      this.program = gl.createProgram(); gl.attachShader(this.program, vertex); gl.attachShader(this.program, fragment); gl.linkProgram(this.program);
      gl.deleteShader(vertex); gl.deleteShader(fragment);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
      gl.useProgram(this.program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'a_position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.uniforms = Object.fromEntries(['resolution','viewport','camera','time','storm','tide','flash','beacon','boat','lamp','depth','trails[0]'].map(name => [name, gl.getUniformLocation(this.program, 'u_' + name)]));
      this.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.texture);
      for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR);
      for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE);
      gl.uniform1i(this.uniforms.depth, 0);
      this.mode = 'webgl'; this.reason = ''; this.canvas.hidden = false; this.fallback.hidden = true;
    } catch (error) { this.useFallback(String(error.message)); }
  }
  distanceField(path) {
    const canvas = document.createElement('canvas'); canvas.width = 275; canvas.height = 155;
    const ctx = canvas.getContext('2d', { willReadFrequently: true }); ctx.scale(0.25, 0.25); ctx.fill(path);
    const mask = ctx.getImageData(0, 0, 275, 155).data;
    const field = new Float32Array(275 * 155);
    for (let i = 0; i < field.length; i++) field[i] = mask[i * 4 + 3] > 128 ? 0 : 1000;
    for (let y = 0; y < 155; y++) for (let x = 0; x < 275; x++) {
      const i = y * 275 + x;
      if (x) field[i] = Math.min(field[i], field[i - 1] + 1);
      if (y) field[i] = Math.min(field[i], field[i - 275] + 1);
      if (x && y) field[i] = Math.min(field[i], field[i - 276] + Math.SQRT2);
      if (x < 274 && y) field[i] = Math.min(field[i], field[i - 274] + Math.SQRT2);
    }
    for (let y = 154; y >= 0; y--) for (let x = 274; x >= 0; x--) {
      const i = y * 275 + x;
      if (x < 274) field[i] = Math.min(field[i], field[i + 1] + 1);
      if (y < 154) field[i] = Math.min(field[i], field[i + 275] + 1);
      if (x < 274 && y < 154) field[i] = Math.min(field[i], field[i + 276] + Math.SQRT2);
      if (x && y < 154) field[i] = Math.min(field[i], field[i + 274] + Math.SQRT2);
    }
    return field;
  }
  updateDepth(game) {
    const key = game.map.region.id + ':' + game.expedition.district.name + ':' + game.harbor.projects.has('shipwright');
    if (this.depthKey === key) return;
    this.renderer.refreshHarbor();
    const solid = new Path2D();
    for (const tile of game.world.district.tiles) if ([TERRAIN.rubble, TERRAIN.door].includes(tile.type)) solid.rect(tile.x - 14, tile.y - 14, 28, 28);
    const fields = [this.distanceField(this.renderer.harbor.land), this.distanceField(this.renderer.districtLayer().land), this.distanceField(solid)];
    const data = new Uint8Array(275 * 155 * 4);
    for (let i = 0; i < 275 * 155; i++) { for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.min(255, fields[c][i] * 4 / 100 * 255); data[i * 4 + 3] = 255; }
    this.depthPixels = data; this.depthKey = key;
    if (this.mode === 'webgl') { this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture); this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 275, 155, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data); }
  }
  draw(game, camera) {
    this.updateDepth(game);
    if (this.mode !== 'webgl') { this.drawFallback(game, camera); return; }
    const gl = this.gl, u = this.uniforms;
    // Pixel budget avoids runaway fill cost on 4K / high-DPI displays.
    const ratio = Math.min(camera.dpr, 1.25, Math.sqrt(1100000 / Math.max(1, camera.width * camera.height)));
    const width = Math.max(1, Math.round(camera.width * ratio)), height = Math.max(1, Math.round(camera.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    gl.viewport(0, 0, width, height); gl.useProgram(this.program);
    gl.uniform2f(u.resolution, width, height); gl.uniform2f(u.viewport, camera.width, camera.height);
    gl.uniform3f(u.camera, camera.left, camera.top, camera.scale);
    gl.uniform1f(u.time, game.time); gl.uniform1f(u.storm, game.weather.kind === 'storm' ? game.weather.intensity : 0);
    gl.uniform1f(u.tide, game.tide.water); gl.uniform1f(u.flash, game.weather.flash * (this.renderer.reduced.matches ? 0.1 : 1));
    const beacon = game.map.home ? game.world.lighthouse : game.map.region.id === 'lighthouse' ? { x: 780, y: 180 } : { x: -2000, y: -2000 };
    gl.uniform4f(u.beacon, beacon.x, beacon.y, game.harbor.beam * 0.8, 1.15);
    gl.uniform4f(u.boat, game.boat.x, game.boat.y, Math.max(55, game.harbor.lanternRange * 0.7), game.harbor.lanternRange ? 1.15 : 0.14);
    gl.uniform3f(u.lamp, game.boat.heading, 0, 0);
    this.trails.fill(0);
    const trails = game.weather.wake.slice(-24);
    trails.forEach((trail, i) => this.trails.set([trail.x - Math.cos(trail.heading) * 12, trail.y - Math.sin(trail.heading) * 12, trail.life, trail.speed], i * 4));
    gl.uniform4fv(u['trails[0]'], this.trails); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  drawFallback(game, camera) {
    const ctx = this.fallbackCtx;
    if (this.fallback.width !== camera.width || this.fallback.height !== camera.height) { this.fallback.width = camera.width; this.fallback.height = camera.height; }
    // CPU FBM is evaluated in world space at 12 Hz; camera reprojection still runs every frame.
    if (Math.abs(game.time - this.lastFallbackTime) >= 1 / 12 || this.lastFallbackTime < 0 || this.fallbackDepth !== this.depthKey) {
      const data = this.pixels.data, time = game.time * 0.12, noise = this.noise;
      const height = (x, y) => noise(x * 0.035 + time, y * 0.045 - time) * 0.56 + noise(x * 0.078 - time, y * 0.09 + time) * 0.29 + noise(x * 0.17 + time, y * 0.19) * 0.15;
      const light = game.map.home ? game.world.lighthouse : game.map.region.id === 'lighthouse' ? { x: 780, y: 180 } : { x: -2000, y: -2000 };
      for (let y = 0; y < 155; y++) for (let x = 0; x < 275; x++) {
        const wx = x * 4, wy = y * 4, i = (y * 275 + x) * 4;
        const h = height(wx, wy), dx = height(wx + 2, wy) - h, dy = height(wx, wy + 2) - h;
        const distance = Math.min(this.depthPixels[i], this.depthPixels[i + (game.tide.water > 0.5 ? 2 : 1)]) / 255 * 100;
        const shallow = Math.exp(-distance / 26);
        const spec = Math.pow(Math.max(0, 0.92 - dx * 4 - dy * 5), 22);
        const warm = Math.exp(-Math.hypot(wx - light.x, wy - light.y) / 150) + Math.exp(-Math.hypot(wx - game.boat.x, wy - game.boat.y) / 65) * (game.harbor.lanternRange ? 1 : 0.1);
        const foam = Math.exp(-Math.pow((distance - 3 - Math.sin(time * 5 + h * 5) * 2) / 4, 2)) * h * 18;
        data[i] = 4 + h * 6 + spec * (10 + warm * 35) + foam;
        data[i+1] = 11 + h * 16 + shallow * 10 + spec * (22 + warm * 27) + foam;
        data[i+2] = 21 + h * 19 + shallow * 7 + spec * (30 + warm * 12) + foam;
        data[i+3] = 255;
      }
      this.bufferCtx.putImageData(this.pixels, 0, 0); this.lastFallbackTime = game.time; this.fallbackDepth = this.depthKey;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#061522'; ctx.fillRect(0, 0, camera.width, camera.height);
    ctx.setTransform(camera.scale, 0, 0, camera.scale, camera.left, camera.top);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(this.buffer, 0, 0, VIEW.width, VIEW.height);
    game.weather.drawWater(ctx, game);
  }
}
