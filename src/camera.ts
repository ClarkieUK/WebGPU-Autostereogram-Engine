import { vec3, mat4 } from 'wgpu-matrix';

export enum CameraMovement {
    FORWARD,
    BACKWARD,
    LEFT,
    RIGHT,
    UP,
    DOWN
}

export class Camera {

    position: Float32Array;
    worldUp: Float32Array;
    yaw: number;
    pitch: number;

    front: Float32Array;
    up: Float32Array;
    right: Float32Array;

    movementSpeed: number;
    mouseSensitivity: number;
    zoom: number;

    baseSpeed: number;
    sprintMultiplier: number;

    constructor(position: [number, number, number] = [0, 0, 0], worldUp: [number, number, number] = [0, 1, 0],
         yaw = -90.0, pitch = 0.0) {
        // camera attributes
        this.position = vec3.create(...position);
        this.worldUp = vec3.create(...worldUp);
        this.yaw = yaw;
        this.pitch = pitch;
        
        // camera vectors
        this.front = vec3.create(0, 0, -1);
        this.up = vec3.create(0, 1, 0);
        this.right = vec3.create(1, 0, 0);
        
        // camera options
        this.movementSpeed = 1.0;
        this.mouseSensitivity = 0.1;
        this.zoom = 45.0;
        
        // speed modifier
        this.baseSpeed = 1.0;
        this.sprintMultiplier = 4.0;
        
        this.updateCameraVectors();
    }
    
    updateCameraVectors() : void {

        const front = vec3.create(
            Math.cos(this.yaw * Math.PI / 180) * Math.cos(this.pitch * Math.PI / 180),
            Math.sin(this.pitch * Math.PI / 180),
            Math.sin(this.yaw * Math.PI / 180) * Math.cos(this.pitch * Math.PI / 180)
        );
        
        this.front = vec3.normalize(front);
        
        this.right = vec3.normalize(vec3.cross(this.front, this.worldUp));
        this.up = vec3.normalize(vec3.cross(this.right, this.front));
    }
    
    getViewMatrix() : Float32Array {
        const target = vec3.add(this.position, this.front);
        return mat4.lookAt(this.position, target, this.up);
    }
    
    getProjectionMatrix(aspectRatio: number, near = 0.01, far = 1000.0) : Float32Array {
        return mat4.perspective(
            this.zoom * Math.PI / 180,
            aspectRatio,
            near,
            far
        );
    }
    
    processKeyboard(direction: CameraMovement, deltaTime: number) : void {
        const velocity = this.movementSpeed * deltaTime;
        
        switch(direction) {
            case CameraMovement.FORWARD:
                this.position = vec3.add(this.position, vec3.mulScalar(this.front, velocity));
                break;
            case CameraMovement.BACKWARD:
                this.position = vec3.sub(this.position, vec3.mulScalar(this.front, velocity));
                break;
            case CameraMovement.LEFT:
                this.position = vec3.sub(this.position, vec3.mulScalar(this.right, velocity));
                break;
            case CameraMovement.RIGHT:
                this.position = vec3.add(this.position, vec3.mulScalar(this.right, velocity));
                break;
            case CameraMovement.UP:
                this.position = vec3.add(this.position, vec3.mulScalar(this.up, velocity));
                break;
            case CameraMovement.DOWN:
                this.position = vec3.sub(this.position, vec3.mulScalar(this.up, velocity));
                break;
        }
    }
    
    setSprinting(isSprinting: boolean) : void {
        this.movementSpeed = isSprinting 
            ? this.baseSpeed * this.sprintMultiplier 
            : this.baseSpeed;
    }
    
    processMouseMovement(xOffset: number, yOffset: number, constrainPitch = true) : void {
        xOffset *= this.mouseSensitivity * (this.zoom / 50);
        yOffset *= this.mouseSensitivity * (this.zoom / 50);
        
        this.yaw += xOffset;
        this.pitch += yOffset;
        
        // constrain pitch to prevent screen flip
        if (constrainPitch) {
            if (this.pitch > 89.0) this.pitch = 89.0;
            if (this.pitch < -89.0) this.pitch = -89.0;
        }
        
        this.updateCameraVectors();
    }
    
    processMouseScroll(yOffset: number) : void {
        this.zoom += yOffset;
        
        if (this.zoom < 1.0) this.zoom = 1.0;
        if (this.zoom > 45.0) this.zoom = 45.0;
    }
    
    getDebugInfo() {
        return {
            position: Array.from(this.position),
            yaw: this.yaw,
            pitch: this.pitch,
            zoom: this.zoom,
            speed: this.movementSpeed
        };
    }
}