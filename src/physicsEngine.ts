import nbody_code from './shaders/integrator.wgsl?raw';

export class PhysicsEngine {
    
    // Scene information, bound to be static due to the buffers created from them 
    // (see sceneManager.ts for comment details) in current implementation.
    bodyCount: number;
    simulating: boolean; // this CAN change

    // Assigned to the class as member as methods require to call them at runtime.
    physicsParamsBuffer: GPUBuffer;
    physicsPipeline: GPUComputePipeline
    physicsBindGroup: GPUBindGroup
    
    constructor(device: GPUDevice, sceneBuffer: GPUBuffer, sceneBodyCount: number) {

        this.simulating = false;
        this.bodyCount = sceneBodyCount;

        this.physicsParamsBuffer = device.createBuffer({
            label: 'physics params',
            size: 2 * 4, // room for a dt and G value
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        const physicsParams = new Float32Array(2); // values discarded once written to device.
        physicsParams[0] = 0.016; 
        physicsParams[1] = 6.674e-2; // fake G too speed things up a bit
        device.queue.writeBuffer(this.physicsParamsBuffer, 0, physicsParams);

        const physicsModule = device.createShaderModule({
            code: nbody_code,
        })

        this.physicsPipeline = device.createComputePipeline({
            
            label: 'N-Body Physics',
            layout: 'auto',
            compute: {
                module: physicsModule,
            }

        })

        this.physicsBindGroup = device.createBindGroup({
            label: 'physics',
            layout: this.physicsPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: sceneBuffer }},
                { binding: 1, resource: { buffer: this.physicsParamsBuffer }},
            ]
        });

    }

    recordPass(encoder: GPUCommandEncoder) : void {

        if (this.simulating) {
            
            const physicsPass = encoder.beginComputePass();
            physicsPass.setPipeline(this.physicsPipeline);
            physicsPass.setBindGroup(0, this.physicsBindGroup);
            physicsPass.dispatchWorkgroups(this.bodyCount);
            physicsPass.end()

        }

    }

    switchState() : void {
        this.simulating = !this.simulating; 
    }

}