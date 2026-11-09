// @ts-nocheck

// Property metadata is only used in Figma Design, so this is a no-op.
function defineProperties(
  _component: unknown,
  _properties: unknown,
): void {}

export default function Effect() { }
export function setup(device, frame) {
    var wgsl = `
diagnostic(off,derivative_uniformity);
struct Uniforms {
  frameData: vec4f,
  inputDimsData: vec4f,
  darkColor: vec4f,
  medColor: vec4f,
  lightColor: vec4f,
  bgColor: vec4f,
  waveScale: vec4f,
  waviness: vec4f,
  angle: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn hash2(p: vec2f) -> f32 {

  var p3 = fract(vec3f(p.xyx) * 0.1031);

  p3 = p3 + dot(p3, p3.yzx + 33.33);

  return fract((p3.x + p3.y) * p3.z);

}

fn noise2d(p: vec2f) -> f32 {

  let i = floor(p);

  let f = fract(p);

  let u = f * f * (3.0 - 2.0 * f);

  return mix(

    mix(hash2(i + vec2f(0.0, 0.0)), hash2(i + vec2f(1.0, 0.0)), u.x),

    mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x),

    u.y

  );

}

fn fbm(p: vec2f) -> f32 {

  var val = 0.0;

  var amp = 0.5;

  var pos = p;

  for (var i = 0; i < 5; i = i + 1) {

    val = val + amp * noise2d(pos);

    pos = pos * 2.0 + vec2f(1.7, 9.2);

    amp = amp * 0.5;

  }

  return val;

}

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment fn fs_main(@location(0) outputUv_in: vec2f) -> @location(0) vec4f {
  let time = u.frameData.x;
  let direction = i32(u.frameData.w);
  let outputUv = outputUv_in;
  let dims = max(u.frameData.yz, vec2f(1.0));
  let inputDims = max(u.inputDimsData.xy, vec2f(1.0));
  let inputTexel = vec2f(1.0) / inputDims;
  let uv = outputUv;
  let texel = inputTexel;
  let aspect = inputDims.x / max(inputDims.y, 1.0);
  let darkColor = u.darkColor;
  let medColor = u.medColor;
  let lightColor = u.lightColor;
  let bgColor = u.bgColor;
  let waveScale = u.waveScale.x;
  let waviness = u.waviness.x;
  let angle = u.angle.x;
  let rad = angle * 3.14159265 / 180.0;
  let ca = cos(rad);
  let sa = sin(rad);
  // aspect-correct coordinates in pixel space
  let p = uv * dims;
  let center = dims * 0.5;
  let cp = p - center;
  let rotP = vec2f(cp.x * ca + cp.y * sa, -cp.x * sa + cp.y * ca);
  // scale to a normalized coordinate based on min dimension
  let minDim = min(dims.x, dims.y);
  let sc = rotP / (minDim * waveScale);

  // time-based offset per direction mode
  var tOffX = 0.0;
  var tOffY = 0.0;
  if (direction == 0) {
    // Inward: bands drift inward (negative Y)
    tOffY = -time;
  } else if (direction == 1) {
    // Outward: bands drift outward (positive Y)
    tOffY = time;
  } else {
    // Angular Flow: bands drift along X axis
    tOffX = time;
  }

  // number of bands
  let numBands = 10.0;
  let bandY = (sc.y + tOffY) * numBands;
  // organic displacement using fbm with time offset
  let disp = fbm(vec2f(sc.x * 3.0 + tOffX, sc.y * 2.0 + tOffY)) * waviness * 2.0
           + fbm(vec2f(sc.x * 1.5 + 5.0 + tOffX, sc.y * 1.0 + 3.0 + tOffY)) * waviness * 1.5;
  let displaced = bandY + disp * numBands * 0.3;
  // determine band index
  let bandIdx = i32(floor(displaced)) % 4;
  var adjIdx = bandIdx;
  if (adjIdx < 0) {
    adjIdx = adjIdx + 4;
  }
  // pick color
  var col = bgColor;
  if (adjIdx == 0) {
    col = darkColor;
  } else if (adjIdx == 1) {
    col = medColor;
  } else if (adjIdx == 2) {
    col = lightColor;
  }
  return vec4f(col.rgb, col.a);
}
`;
    frame.state.module = device.createShaderModule({ code: wgsl });
    frame.state.pipeline = null;
    frame.state.pipelineFormat = null;
    frame.state.quad = device.createBuffer({
        size: 6 * 4 * 4,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(frame.state.quad.getMappedRange()).set([
        -1, -1, 0, 1,
        1, -1, 1, 1,
        -1, 1, 0, 0,
        -1, 1, 0, 0,
        1, -1, 1, 1,
        1, 1, 1, 0,
    ]);
    frame.state.quad.unmap();
    frame.state.uniformBuf = device.createBuffer({
        size: 144,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
}
export function render(device, frame) {
    var params = frame.params || {};
    function finiteNumber(value, fallback) {
        var num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }
    function numberParam(name, fallback) {
        return finiteNumber(params[name], fallback);
    }
    function boolParam(name, fallback) {
        if (typeof params[name] === 'boolean')
            return params[name] ? 1 : 0;
        return fallback ? 1 : 0;
    }
    function selectParam(name, count, fallbackIndex) {
        // A select is a numeric dropdown: params[name] is the chosen option's index.
        var index = Math.round(Number(params[name]));
        return Number.isFinite(index) && index >= 0 && index < count ? index : fallbackIndex;
    }
    function colorParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.r, fallback[0]),
            finiteNumber(value.g, fallback[1]),
            finiteNumber(value.b, fallback[2]),
            finiteNumber(value.a, fallback[3]),
        ];
    }
    function pointParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
        ];
    }
    function pointRadiusParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.radius, fallback[2]),
        ];
    }
    function pointPointLineParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.x2, fallback[2]),
            finiteNumber(value.y2, fallback[3]),
        ];
    }
    function pointAngleRadiusParam(name, fallback) {
        var value = params[name] || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            finiteNumber(value.radius, fallback[2]),
            finiteNumber(value.angle, fallback[3]),
        ];
    }
    function colorPointParam(name, fallback) {
        var value = params[name] || {};
        var color = value.color || {};
        return [
            finiteNumber(value.x, fallback[0]),
            finiteNumber(value.y, fallback[1]),
            0,
            0,
            finiteNumber(color.r, fallback[2]),
            finiteNumber(color.g, fallback[3]),
            finiteNumber(color.b, fallback[4]),
            finiteNumber(color.a, fallback[5]),
        ];
    }
    function gradientParam(name, fallback) {
        var value = params[name] || {};
        var stops = Array.isArray(value.stops) && value.stops.length > 0 ? value.stops : fallback;
        // Layout: 8 stop colors (rgba), then 8 positions packed 4-per-vec4, then the live count.
        var out = new Array(44).fill(0);
        var count = Math.min(stops.length, 8);
        for (var i = 0; i < count; i++) {
            var stop = stops[i] || {};
            var color = stop.color || {};
            out[i * 4] = finiteNumber(color.r, 0);
            out[i * 4 + 1] = finiteNumber(color.g, 0);
            out[i * 4 + 2] = finiteNumber(color.b, 0);
            out[i * 4 + 3] = finiteNumber(color.a, 1);
            out[32 + i] = finiteNumber(stop.position, 0);
        }
        out[40] = count;
        return out;
    }
    var output = frame.output || {};
    var width = Math.max(1, finiteNumber(output.width, 1));
    var height = Math.max(1, finiteNumber(output.height, 1));
    var speed = numberParam("speed", 0.2);
    var direction = selectParam("direction", 3, 2);
    var time = frame.time * 0.001 * speed;
    var inputWidth = width;
    var inputHeight = height;
    device.queue.writeBuffer(frame.state.uniformBuf, 0, new Float32Array([
        time, width, height, direction,
        inputWidth, inputHeight, 0, 0,
        ...colorParam("darkColor", [0.106, 0.294, 0.478, 1]),
        ...colorParam("medColor", [0.357, 0.608, 0.835, 1]),
        ...colorParam("lightColor", [0.659, 0.816, 0.941, 1]),
        ...colorParam("bgColor", [0.918, 0.949, 0.984, 1]),
        numberParam("waveScale", 1.5), 0, 0, 0,
        numberParam("waviness", 1), 0, 0, 0,
        numberParam("angle", 180), 0, 0, 0,
    ]));
    var outputFormat = frame.output.format;
    if (frame.state.pipeline == null || frame.state.pipelineFormat !== outputFormat) {
        frame.state.pipeline = device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: frame.state.module,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 16,
                        attributes: [
                            { shaderLocation: 0, format: 'float32x2', offset: 0 },
                            { shaderLocation: 1, format: 'float32x2', offset: 8 },
                        ],
                    }],
            },
            fragment: {
                module: frame.state.module,
                entryPoint: 'fs_main',
                targets: [{ format: outputFormat }],
            },
            primitive: { topology: 'triangle-list' },
        });
        frame.state.pipelineFormat = outputFormat;
    }
    var bindGroup = device.createBindGroup({
        layout: frame.state.pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: frame.state.uniformBuf } },
        ],
    });
    var encoder = device.createCommandEncoder();
    var pass = encoder.beginRenderPass({
        colorAttachments: [{
                view: frame.output.createView(),
                loadOp: 'clear',
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                storeOp: 'store',
            }],
    });
    pass.setPipeline(frame.state.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, frame.state.quad);
    pass.draw(6);
    pass.end();
    device.queue.submit([encoder.finish()]);
}
defineProperties(Effect, {
    "darkColor": {
        type: "color",
        label: "Dark color",
        defaultValue: { "r": 0.106, "g": 0.294, "b": 0.478, "a": 1 },
    },
    "medColor": {
        type: "color",
        label: "Medium color",
        defaultValue: { "r": 0.357, "g": 0.608, "b": 0.835, "a": 1 },
    },
    "lightColor": {
        type: "color",
        label: "Light color",
        defaultValue: { "r": 0.659, "g": 0.816, "b": 0.941, "a": 1 },
    },
    "bgColor": {
        type: "color",
        label: "Background color",
        defaultValue: { "r": 0.918, "g": 0.949, "b": 0.984, "a": 1 },
    },
    "waveScale": {
        type: "number",
        label: "Wave scale",
        defaultValue: 1.5,
        control: "slider",
        min: 0.2,
        max: 5,
        step: 0.1,
    },
    "waviness": {
        type: "number",
        label: "Waviness",
        defaultValue: 1,
        control: "slider",
        min: 0,
        max: 2,
        step: 0.05,
    },
    "angle": {
        type: "number",
        label: "Angle",
        defaultValue: 180,
        control: "slider",
        min: 0,
        max: 360,
        step: 1,
        unit: "°",
    },
    "speed": {
        type: "number",
        label: "Speed",
        defaultValue: 0.2,
        control: "slider",
        min: 0,
        max: 10,
        step: 0.1,
    },
    "direction": {
        type: "number",
        label: "Direction",
        defaultValue: 2,
        control: "select",
        options: [
            { value: 0, label: "Inward" },
            { value: 1, label: "Outward" },
            { value: 2, label: "Angular Flow" },
        ],
    },
});

export const manifest = {
  "version": 2,
  "name": "Groovy waves",
  "isAnimated": true,
  "usesMouse": false
}
