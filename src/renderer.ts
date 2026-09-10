import epipolar_code from './shaders/generateEpipolars.wgsl?raw';

import { Sphere } from './sphere';
import { SphereRenderer } from './sphereRenderer';

import { Billboard } from './billboardManager';
import { Camera } from './camera';

import { vec3, mat4 } from 'wgpu-matrix';
import { renderConfig } from './config';
import { sceneConfig } from './config';

export class Renderer {
    
    // Rendering Options
    coupledEyes: boolean;
    renderSpheres: boolean;
    smoothing: boolean;

    monitorWidth: number;
    recWidth: number;
    recHeight: number;
    monitorHeight: number;
    monitorResolution: [number, number];
    backgroundPlaneDistance: number;

    //TODO! Rethink this later
    billboardUniformBufferValues!: Float32Array;
    resolutionValue!: Float32Array;
    rectangleDimensions!: Float32Array;
    noiseCount!: Float32Array;
    seedCount!: Float32Array;
    referenceBaseline!: Float32Array;

    // Reference to WebGPU Objects
    device: GPUDevice;
    canvas: HTMLCanvasElement;
    context: GPUCanvasContext;
    depthTexture!: GPUTexture;
    renderPassDescriptor: GPURenderPassDescriptor;

    // Assets
    cameraTransformBuffer!: GPUBuffer;

    billboardUniform!: GPUBuffer;
    backgroundPlaneBuffer!: GPUBuffer;
    splatStorageBuffer!: GPUBuffer;
    statsBuffer!: GPUBuffer;

    sceneBuffer: GPUBuffer;

    // Pipeline Objects
    computeEpipolarPipeline!: GPUComputePipeline;

    // BindGroups
    computeEpipolarBindGroup!: GPUBindGroup;

    //Sub Renderers
    sphereRenderer: SphereRenderer;
    billboard: Billboard;


    constructor(device: GPUDevice, canvas: HTMLCanvasElement, context: GPUCanvasContext, format: GPUTextureFormat, sceneBuffer: GPUBuffer) {
        
        this.device = device;
        this.canvas = canvas;
        this.context = context;

        this.coupledEyes = true;
        this.renderSpheres = true;
        this.smoothing = true;

        this.monitorWidth = renderConfig.monitorWidth;
        this.monitorHeight = renderConfig.monitorHeight;
        this.recWidth = renderConfig.monitorWidth;
        this.recHeight = renderConfig.monitorHeight;
        this.monitorResolution = renderConfig.monitorResolution;
        this.backgroundPlaneDistance = sceneConfig.viewingDistance + sceneConfig.sceneGap * 1.0; //TODO! Need to use information from scene for this passed by engine

        this.sceneBuffer = sceneBuffer;

        this.sphereRenderer = new SphereRenderer(device, format, renderConfig.sphereResolution);
        this.billboard = new Billboard(device, format, this.recWidth, this.recHeight);

        this.renderPassDescriptor = {
            colorAttachments: [
                {
                    view: null as unknown as GPUTextureView,
                    clearValue: [0.3, 0.3, 0.3, 1],
                    loadOp:'clear',
                    storeOp: 'store',
                },
            ],
            depthStencilAttachment: {
            view: null as unknown as GPUTextureView, 
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
            },
        };

        this.updateDepthTexture();
    };

    async initialise() : Promise<void> {

        await this.generateAssets();

        await this.constructPipelines();

    }

    async generateAssets() : Promise<void> {

        this.billboardUniform = this.device.createBuffer({
            label: 'Billboard Uniform Values',
            size: 4 * 4 + 1 * 4 + 1 * 4 + 2 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        //TODO! Rethink this later
        this.billboardUniformBufferValues = new Float32Array(7);
        this.resolutionValue = this.billboardUniformBufferValues.subarray(0, 2);
        this.rectangleDimensions = this.billboardUniformBufferValues.subarray(2, 4);
        this.noiseCount = this.billboardUniformBufferValues.subarray(4, 5);
        this.seedCount = this.billboardUniformBufferValues.subarray(5, 6);
        this.referenceBaseline = this.billboardUniformBufferValues.subarray(6, 7);

        this.resolutionValue.set(this.monitorResolution);
        this.rectangleDimensions.set([this.monitorWidth, this.monitorHeight]);

        this.device.queue.writeBuffer(this.billboardUniform, 0, this.billboardUniformBufferValues);

        this.cameraTransformBuffer = this.device.createBuffer({
            label: 'projection matrices for camera etc',
            size: 4 * 16 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        const splatBufferSize = 4 + 12 + (renderConfig.maxSplats * 16); // atomic count + padding + points

        this.splatStorageBuffer = this.device.createBuffer({
            label: 'Gaussian Splat Storage',
            size: splatBufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        const zeroData = new Uint32Array(1);
        this.device.queue.writeBuffer(this.splatStorageBuffer, 0, zeroData); 

        this.backgroundPlaneBuffer = this.device.createBuffer({
            label: 'Background Plane Buffer',
            size: (2 * 4) * 4, // two descriptive vec4fs
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        })

        this.statsBuffer = this.device.createBuffer({
            label: 'stats',
            size: 3 * 4, // 3 x u32
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

    }

    async constructPipelines() : Promise<void> {

        const computeModule = this.device.createShaderModule({
        code: epipolar_code,
        });

        this.computeEpipolarPipeline = this.device.createComputePipeline({
            label: 'storage texture',
            layout: 'auto',
            compute: {
            module: computeModule,
            },
        });

        this.computeEpipolarBindGroup = this.device.createBindGroup({
            label: 'compute',
            layout: this.computeEpipolarPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.billboardUniform }},
                { binding: 1, resource: { buffer: this.cameraTransformBuffer }},
                { binding: 2, resource: { buffer: this.sceneBuffer }},
                { binding: 3, resource: { buffer: this.splatStorageBuffer }},
                { binding: 4, resource: { buffer: this.statsBuffer }},
                { binding: 5, resource: { buffer: this.backgroundPlaneBuffer }}
            ]
        })

        this.sphereRenderer.createBindGroup(this.cameraTransformBuffer, this.sceneBuffer);
        this.billboard.createBindGroup(this.billboardUniform, this.splatStorageBuffer, this.cameraTransformBuffer);

    }

    render = (encoder: GPUCommandEncoder, camera: Camera) : void => {

        // Pre render computes.
        const billboardTransform = this.constructBillboardMatrix(camera);
        const viewMatrix = camera.getViewMatrix();
        const aspectRatio = this.canvas.width/this.canvas.height;
        const projectionMatrix = camera.getProjectionMatrix(aspectRatio);

        this.device.queue.writeBuffer(this.cameraTransformBuffer, (2 * 16) * 4, viewMatrix);
        this.device.queue.writeBuffer(this.cameraTransformBuffer, (3 * 16) * 4, projectionMatrix);

        if (this.coupledEyes) {
            const inverseBillboardTransform: Float32Array = mat4.inverse(billboardTransform);
            this.device.queue.writeBuffer(this.cameraTransformBuffer, 0, billboardTransform);
            this.device.queue.writeBuffer(this.cameraTransformBuffer, (1 * 16) * 4, inverseBillboardTransform);
        }

        const backgroundPlaneOrigin = vec3.add(
            camera.position,
            vec3.mulScalar(camera.front, this.backgroundPlaneDistance)
        );
        const planeNormal = vec3.negate(camera.front);

        const planeData = new Float32Array(8);
        planeData[0] = planeNormal[0];
        planeData[1] = planeNormal[1];
        planeData[2] = planeNormal[2];
        planeData[3] = 0.0;
        planeData[4] = backgroundPlaneOrigin[0];
        planeData[5] = backgroundPlaneOrigin[1];
        planeData[6] = backgroundPlaneOrigin[2];
        planeData[7] = 0.0;

        this.device.queue.writeBuffer(this.backgroundPlaneBuffer, 0, planeData);

        encoder.clearBuffer(this.splatStorageBuffer, 0, 4);
        encoder.clearBuffer(this.statsBuffer, 0, 12);

        this.renderPassDescriptor!.colorAttachments[0]!.view =
            this.context.getCurrentTexture().createView();

            
        this.renderPassDescriptor!.depthStencilAttachment!.view = 
            this.depthTexture.createView();

        // Actual drawing.
        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.computeEpipolarPipeline);
        computePass.setBindGroup(0, this.computeEpipolarBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(this.seedCount[0] / renderConfig.workgroupSize), 4);
        computePass.end();

        const pass = encoder.beginRenderPass(this.renderPassDescriptor);
        this.billboard.render(pass);

        if (this.renderSpheres) {
            this.sphereRenderer.render(pass, sceneConfig.sphereCount);
        }
    
        pass.end();

    }

    constructBillboardMatrix(camera: Camera, distance = sceneConfig.viewingDistance) : Float32Array { 
        const position = vec3.add(
            camera.position, 
            vec3.mulScalar(camera.front, distance)
        );
        
        const forward = vec3.negate(camera.front);
        const right = camera.right;
        const up = camera.up;
        
        const modelMatrix = mat4.create(
            right[0],    right[1],    right[2],    0,
            up[0],       up[1],       up[2],       0,
            forward[0],  forward[1],  forward[2],  0,
            position[0], position[1], position[2], 1
        );
        
        return modelMatrix;
    }

    updateDepthTexture = (): void => {
        if (this.depthTexture) this.depthTexture.destroy();
        this.depthTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
    }
    
    toggleCoupleEyes() : void {
        this.coupledEyes = !this.coupledEyes;
    }

    toggleDrawSpheres() : void {
        this.renderSpheres = !this.renderSpheres;
    }

    setNoise(value: number): void {
        this.noiseCount.set([value]);
        this.device.queue.writeBuffer(this.billboardUniform, 16, this.noiseCount);
    }

    setSeedCount(value: number): void {
        this.seedCount.set([value]);
        this.device.queue.writeBuffer(this.billboardUniform, 20, this.seedCount);
    }

    setReferenceBaseline(value: boolean): void {
        this.referenceBaseline.set([value ? 1.0 : 0.0]);
        this.device.queue.writeBuffer(this.billboardUniform, 24, this.referenceBaseline);
    }

}
