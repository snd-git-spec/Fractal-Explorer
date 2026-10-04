import { createRoot } from "react-dom/client";
import Example from "./index";

// No StrictMode — double mount disposes WebGPU mid-init and leaves a blank canvas.
createRoot(document.getElementById("root")!).render(<Example />);
