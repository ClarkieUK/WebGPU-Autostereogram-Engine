export interface AppSettings {
    noise: number;
    seedCount: number;
    scaler: number;
    referenceBaseline: boolean;
    angle: number;
    vrMode: boolean; 
}

export const defaults: AppSettings = {
    noise: 0,
    seedCount: 250,
    scaler: 1,
    referenceBaseline: false,
    angle: 0,
    vrMode: false, 
}

export const sceneConfig = {
    IPD: 0.067,
    viewingDistance: 0.55,
    sceneGap: 4,
    sceneScale: 1.5,
    sphereCount: 10,
} as const 

export const renderConfig = {
    monitorWidth: 0.60,
    monitorHeight: 0.35,
    monitorResolution: [2560, 1440] as [number, number],
    maxSplats: 25000,
    sphereResolution: 20,
    workgroupSize: 64,
} as const 