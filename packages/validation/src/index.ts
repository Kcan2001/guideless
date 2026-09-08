import { z } from "zod";

// Zod 4 probes `Function("")` once to decide whether it may JIT-compile object schemas. Under
// the web app's CSP (no 'unsafe-eval') that probe is a reported violation, so opt out up front.
z.config({ jitless: true });

export * from "./common";
export * from "./booking";
export * from "./auth";
export * from "./admin";
export * from "./marketing";
export * from "./community";
export * from "./hotels";
export * from "./growth";
export * from "./reviews";
export * from "./content";
