import { Engine } from "./engine";

async function main() {

    const engine = await Engine.create();
    engine.start();
    
}

main()

// TODO! 
// Think about rendering structure for materials, meshes, for interesting ray tracing etc...
// Integrate Ray tracing in one weekend as excercise and test for compatability...