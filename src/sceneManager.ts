import { vec3, mat4 } from 'wgpu-matrix';
import { Camera } from './camera';

export class Scene {

    sceneData: Float32Array;
    leftEyeData: Float32Array;
    rightEyeData: Float32Array;
    rotatedLeftEyeData: Float32Array;
    rotatedRightEyeData: Float32Array;
    sphereDataSpace: Float32Array;

    device: GPUDevice
    sceneBuffer: GPUBuffer;

    constructor(device: GPUDevice, IPD: number, viewingDistance: number, sceneGap: number, 
    scale: number, sphereCount: number) { //TODO! Need a nice way of dynmically sized scenes 
        this.device = device;
        
        const valuesPerSphere = 8;
        const sceneSize = (20 + valuesPerSphere * sphereCount) * 4; // bytes

        this.sceneData = new Float32Array(20 + valuesPerSphere * sphereCount);
        const buffer = this.sceneData.buffer;
        const dataView = new DataView(buffer); // need this to set the integer sphere count
        // 4 + 4 + 4 + 4 + 1 + 3(pad) + 8 floats per sphere

        this.leftEyeData = this.sceneData.subarray(0, 4);
        this.rightEyeData = this.sceneData.subarray(4, 8);
        this.rotatedLeftEyeData = this.sceneData.subarray(8, 12);
        this.rotatedRightEyeData = this.sceneData.subarray(12, 16); // 0 -> 15

        dataView.setUint32(16 * 4, sphereCount, true); 

        this.sphereDataSpace = this.sceneData.subarray(20, 20 + valuesPerSphere * sphereCount);

        this.leftEyeData.set([-IPD / 2, 0, viewingDistance, 1.0]);
        this.rightEyeData.set([IPD / 2, 0, viewingDistance, 1.0]);
        this.rotatedLeftEyeData.set([0.0, 0.0, 0.0, 0.0]); // undefined until render loop calls...
        this.rotatedRightEyeData.set([0.0, 0.0, 0.0, 0.0]);

        generateSpheres(this.sphereDataSpace, sphereCount, valuesPerSphere, scale, sceneGap);
        //generatePosterExample(this.sphereDataSpace, valuesPerSphere);
        //generateSmile(this.sphereDataSpace, sphereCount, valuesPerSphere, scale, sceneGap);
        //TODO! Not ported the above functions over, can't decide if I want to point a reference to the device with
        //TODO! this.device or not yet...

        this.sceneBuffer = this.device.createBuffer({
        label: 'scene storage',
        size: sceneSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });

        this.device.queue.writeBuffer(this.sceneBuffer, 0, this.sceneData);

    };

    updateEyePositions(camera: Camera, IPD: number, angle: number, otherIPD: number) : void {
        const cameraPosition = camera.position;
        const cameraRight = camera.right;
        const cameraFront = camera.front;

        const theta = angle * Math.PI / 180;

        const rotationMatrix = mat4.axisRotation(cameraFront, theta);

        const leftEye = vec3.sub(cameraPosition, vec3.mulScalar(cameraRight, IPD / 2));
        const rightEye = vec3.add(cameraPosition, vec3.mulScalar(cameraRight, IPD / 2));

        const eyeOffset = vec3.mulScalar(cameraRight, otherIPD / 2);
        const rotatedOffset = vec3.transformMat4(eyeOffset, rotationMatrix);

        const leftEyeRotated = vec3.sub(camera.position, rotatedOffset);
        const rightEyeRotated = vec3.add(camera.position, rotatedOffset);

        this.leftEyeData.set([leftEye[0], leftEye[1], leftEye[2], 1.0]);
        this.rightEyeData.set([rightEye[0], rightEye[1], rightEye[2], 1.0]);
        this.rotatedLeftEyeData.set([leftEyeRotated[0], leftEyeRotated[1], leftEyeRotated[2], 1.0]);
        this.rotatedRightEyeData.set([rightEyeRotated[0], rightEyeRotated[1], rightEyeRotated[2], 1.0]);

        this.device.queue.writeBuffer(this.sceneBuffer, 0, this.sceneData.subarray(0, 16));
        }
    }

function generateSpheres(sphereDataSpace: Float32Array, sphereCount: number, valuesPerSphere: number, scale: number, sceneGap: number) : void {
    for (let i = 0; i < sphereCount; i++) {

        const thisSphereData = sphereDataSpace.subarray(i * valuesPerSphere, (i+1) * valuesPerSphere)

        let x = (Math.random() - 0.5) * 2 * scale;
        let y = (Math.random() - 0.5) * 2 * scale;
        //let z = -Math.random() * sceneGap * scale;
        let z = -Math.random() * sceneGap * scale - 2;

        let r =  (Math.random() * 0.25);

        thisSphereData.set([x, y, z, r, 0.0, 0.0, 0.0, r])

    }
};