import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PiStudio } from "../../app/studio";
import "../../app/globals.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Desktop renderer root is missing.");
}

createRoot(root).render(
  <StrictMode>
    <PiStudio />
  </StrictMode>,
);
