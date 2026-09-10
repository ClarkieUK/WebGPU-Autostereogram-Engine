import { PhysicsEngine } from './physicsEngine';
import { initWebGPU } from './utils/helpers';
import { createResizeObserver } from './utils/helpers';
import { Scene } from './sceneManager';
import { Renderer } from './renderer';
import { Camera } from './camera';
import { InputHandler } from './inputHandler';
import { AppSettings, defaults, sceneConfig } from './config';

import GUI from 'https://muigui.org/dist/0.x/muigui.module.js';

export class Engine {

    settings: AppSettings;

    private constructor(
        public device: GPUDevice,
        public canvas: HTMLCanvasElement,
        public scene: Scene,
        public physicsEngine: PhysicsEngine,
        public renderer: Renderer,
        public camera: Camera,
        public inputHandler: InputHandler,
    ) { this.settings = { ...defaults } };

    static async create() : Promise<Engine> {

        const { device, canvas, context, presentationFormat } = await initWebGPU();

        const scene = new Scene(device, 
            sceneConfig.IPD, 
            sceneConfig.viewingDistance, 
            sceneConfig.sceneGap,
            sceneConfig.sceneScale,
            sceneConfig.sphereCount,
        );

        const physicsEngine = new PhysicsEngine(device, scene.sceneBuffer, sceneConfig.sphereCount);

        const renderer = new Renderer(device, canvas, context, presentationFormat, scene.sceneBuffer);
        await renderer.initialise();

        const camera = new Camera(
            [0, 0, sceneConfig.viewingDistance],
            [0, 1, 0],
            -90.0, // axis points out of screen, world axis point up, need to rotate our look 'in'
            0.0 
        );

        const inputHandler = new InputHandler(canvas, camera);

        return new Engine(device, canvas, scene, physicsEngine, renderer, camera, inputHandler);
    }

    frame = () : void => {

        this.inputHandler.update();
        this.scene.updateEyePositions(this.camera, sceneConfig.IPD, this.settings.angle, this.settings.scaler * sceneConfig.IPD)

        const encoder = this.device.createCommandEncoder({});

        this.physicsEngine.recordPass(encoder);

        this.renderer.render(encoder, this.camera);

        this.device.queue.submit([encoder.finish()]);

        requestAnimationFrame(this.frame);

    };

    start() : void {

        // Init Render Values.
        this.renderer.setNoise(this.settings.noise);
        this.renderer.setSeedCount(this.settings.seedCount);
        this.renderer.setReferenceBaseline(this.settings.referenceBaseline);

        // Load up and add all gui elements.
        const gui = new GUI();

        gui.add(this.settings, 'noise', 1, 30000)
            .name('noise count')
            .onChange((value: number) => this.renderer.setNoise(value));

        gui.add(this.settings, 'seedCount', 0, 50 * 64)
            .name('seed count')
            .onChange((value: number) => this.renderer.setSeedCount(value));

        gui.add(this.settings, 'scaler', 0.8, 1.2)
            .name('baseline multiplier')
            .onChange((value: number) => { this.settings.scaler = -value; });

        gui.add(this.settings, 'angle', 0, 360)
            .name('baseline angle')
            .onChange((value: number) => { this.settings.angle = -value; });

        gui.add(this.settings, 'referenceBaseline')
            .name('draw reference baseline?')
            .onChange((value: boolean) => this.renderer.setReferenceBaseline(value));

        gui.add(this.settings, 'vrMode')
            .name('enable vr mode');


        // Set input handler callbacks.
        this.inputHandler.setKeyCallback('KeyP', () => { this.renderer.toggleCoupleEyes(); });
        this.inputHandler.setKeyCallback('KeyO', () => { this.renderer.toggleDrawSpheres(); });
        this.inputHandler.setKeyCallback('KeyI', () => { this.physicsEngine.switchState(); });
        
        // Set observer.
        const observer = createResizeObserver(this.device, this.frame, this.renderer.updateDepthTexture);
        observer.observe(this.canvas);
    }

}