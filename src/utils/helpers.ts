export async function initWebGPU() {

    const adapter = await navigator.gpu?.requestAdapter();
    const device = await adapter?.requestDevice();

    if (!device) {
        return fail('need a browser that supports WebGPU');
    }

    const canvas = document.querySelector('canvas');

    if (!canvas) {
        return fail('canvas element not found');
    }

    const context = canvas?.getContext('webgpu');

    if (!context) {
        return fail('could not get webgpu context from canvas');
    }

    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    context?.configure({
        device: device,
        format: presentationFormat,
    });

    return { canvas: canvas, adapter: adapter, device: device, context: context, presentationFormat: presentationFormat };

}

export function createResizeObserver(device: GPUDevice, render: () => void, onResize: () => void): ResizeObserver {
    return new ResizeObserver(entries => {
        for (const entry of entries) {
            
            const canvas = entry.target as HTMLCanvasElement;
            const width = entry.contentBoxSize[0].inlineSize;
            const height = entry.contentBoxSize[0].blockSize;
            
            canvas.width = Math.max(1, Math.min(width, device.limits.maxTextureDimension2D));
            canvas.height = Math.max(1, Math.min(height, device.limits.maxTextureDimension2D));
        }
        
        onResize();
        render();
    });
}

function fail(msg: string): never {
    throw new Error(msg);
}