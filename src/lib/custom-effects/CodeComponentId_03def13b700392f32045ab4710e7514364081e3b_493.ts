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
  ripple1: vec4f,
  ripple2: vec4f,
  ripple3: vec4f,
  frequency: vec4f,
  amplitude: vec4f,
  decay: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var inputTex: texture_2d<f32>;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn sampleInput(p: vec2f) -> vec4f {
  return textureSampleLevel(inputTex, samp, clamp(p, vec2f(0.0), vec2f(1.0)), 0.0);
}

fn sampleInputOrZero(p: vec2f) -> vec4f {
  let inside = step(vec2f(0.0), p) * step(p, vec2f(1.0));
  return sampleInput(p) * (inside.x * inside.y);
}

fn rippleContrib(ripple: vec4f, uv: vec2f, dims: vec2f, frequency: f32, amplitude: f32, decay: f32) -> vec3f {
  // ripple: xy = center (%), z = radius (%), w unused
  let centerUv = ripple.xy / 100.0;
  let radiusFrac = ripple.z / 100.0;
  let centerPx = centerUv * dims;
  let px = uv * dims;
  let diff = px - centerPx;
  let radiusPx = radiusFrac * min(dims.x, dims.y);
  let dist = length(diff);
  let normDist = dist / max(radiusPx, 0.001);
  let envelope = exp(-decay * normDist);
  let phase = normDist * frequency * 6.28318;
  let wave = sin(phase) * amplitude * envelope;
  var dir = vec2f(0.0, 0.0);
  if (dist > 0.001) {
    dir = diff / dist;
  }
  // xy = displacement in uv space, z = envelope accumulation
  let disp = dir * (wave / dims);
  return vec3f(disp, envelope);
}

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment fn fs_main(@location(0) outputUv_in: vec2f) -> @location(0) vec4f {
  let outputUv = outputUv_in;
  let dims = max(u.frameData.yz, vec2f(1.0));
  let uv = outputUv;
  let frequency = u.frequency.x;
  let amplitude = u.amplitude.x;
  let decay = u.decay.x;

  let c1 = rippleContrib(u.ripple1, uv, dims, frequency, amplitude, decay);
  let c2 = rippleContrib(u.ripple2, uv, dims, frequency, amplitude, decay);
  let c3 = rippleContrib(u.ripple3, uv, dims, frequency, amplitude, decay);

  let totalDisp = c1.xy + c2.xy + c3.xy;

  let displacedUv = uv + totalDisp;
  return sampleInputOrZero(displacedUv);
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
        size: 128,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    frame.state.sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
    });
    frame.state.placeholder = device.createTexture({
        size: [1, 1, 1],
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    device.queue.writeTexture({ texture: frame.state.placeholder }, new Uint8Array([0, 0, 0, 0]), { bytesPerRow: 4 }, { width: 1, height: 1, depthOrArrayLayers: 1 });
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
    var time = 0;
    var inputWidth = width;
    var inputHeight = height;
    device.queue.writeBuffer(frame.state.uniformBuf, 0, new Float32Array([
        time, width, height, 0,
        inputWidth, inputHeight, 0, 0,
        ...pointRadiusParam("ripple1", [25, 25, 30]), 0,
        ...pointRadiusParam("ripple2", [50, 50, 30]), 0,
        ...pointRadiusParam("ripple3", [75, 75, 30]), 0,
        numberParam("frequency", 8), 0, 0, 0,
        numberParam("amplitude", 12), 0, 0, 0,
        numberParam("decay", 1.5), 0, 0, 0,
    ]));
    var inputView = frame.input != null
        ? frame.input.createView()
        : frame.state.placeholder.createView();
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
            { binding: 1, resource: frame.state.sampler },
            { binding: 2, resource: inputView },
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
    "ripple1": {
        type: "point-radius",
        label: "Ripple 1",
        defaultValue: { "x": 25, "y": 25, "radius": 30 },
        mode: "canvas_and_ui",
        positionUnit: "%",
        radiusUnit: "%",
        minRadius: 1,
        maxRadius: 100,
    },
    "ripple2": {
        type: "point-radius",
        label: "Ripple 2",
        defaultValue: { "x": 50, "y": 50, "radius": 30 },
        mode: "canvas_and_ui",
        positionUnit: "%",
        radiusUnit: "%",
        minRadius: 1,
        maxRadius: 100,
    },
    "ripple3": {
        type: "point-radius",
        label: "Ripple 3",
        defaultValue: { "x": 75, "y": 75, "radius": 30 },
        mode: "canvas_and_ui",
        positionUnit: "%",
        radiusUnit: "%",
        minRadius: 1,
        maxRadius: 100,
    },
    "frequency": {
        type: "number",
        label: "Frequency",
        defaultValue: 8,
        control: "slider",
        min: 1,
        max: 40,
        step: 0.5,
    },
    "amplitude": {
        type: "number",
        label: "Amplitude",
        defaultValue: 12,
        control: "slider",
        min: 0,
        max: 50,
        step: 0.5,
    },
    "decay": {
        type: "number",
        label: "Decay",
        defaultValue: 1.5,
        control: "slider",
        min: 0,
        max: 5,
        step: 0.1,
    },
});

export const manifest = {
  "version": 2,
  "name": "Water ripple",
  "isAnimated": false,
  "usesMouse": false
}
